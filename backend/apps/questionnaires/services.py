from datetime import timedelta
from django.conf import settings
from django.db import transaction
from django.utils import timezone

from apps.prospects.models import ConsentRecord, Prospect
from apps.tracking.models import EventType, TrackingEvent
from .models import QuestionnaireResponse, QuestionnaireSession, SessionStatus
from .schema import TOTAL_STEPS, normalize_phone, validate_step

UTM_FIELDS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"]


class ServiceError(Exception):
    def __init__(self, message, status=400, errors=None):
        self.message, self.status, self.errors = message, status, errors or {}


def log_event(session, type_, step=None):
    TrackingEvent.objects.create(session=session, type=type_, step=step)


def create_session(utm=None):
    utm = {k: (v or "")[:100] for k, v in (utm or {}).items() if k in UTM_FIELDS}
    session, token = QuestionnaireSession.create_with_token(**utm)
    log_event(session, EventType.SESSION_STARTED, 0)
    return session, token


def answers_of(session):
    out = {}
    for r in session.responses.all():
        out[r.field] = (r.value == "true") if r.field == "consent" else r.value
    return out


def touch(session):
    session.last_activity_at = timezone.now()


@transaction.atomic
def save_step(session, step, data, complete):
    session = QuestionnaireSession.objects.select_for_update().get(pk=session.pk)
    if session.status in (SessionStatus.SUBMITTED, SessionStatus.EXPIRED, SessionStatus.INVALIDATED):
        raise ServiceError("Cette session n'accepte plus de modifications.", 409)
    if not 0 <= step < TOTAL_STEPS:
        raise ServiceError("Étape inconnue.", 404)
    if step > session.last_completed_step + 1:  # on ne fait pas confiance à l'étape envoyée par le navigateur
        raise ServiceError("Les étapes précédentes doivent d'abord être terminées.", 400)
    clean, errors = validate_step(step, data, complete)
    if complete:  # valide l'étape entière en fusionnant avec les réponses déjà stockées
        stored = answers_of(session)
        merged = {k: v for k, v in {**stored, **clean}.items() if k in _step_fields(step)}
        _, errors = validate_step(step, merged, True)
    if errors:
        raise ServiceError("Réponses invalides.", 400, errors)
    if session.transition(SessionStatus.IN_PROGRESS):
        log_event(session, EventType.SESSION_RESUMED, step)
    changed = False
    existing = {r.field: r for r in session.responses.all()}
    for field, value in clean.items():
        stored_value = "true" if value is True else "false" if value is False else value
        if field in existing:
            if existing[field].value != stored_value:
                existing[field].value = stored_value
                existing[field].save(update_fields=["value", "updated_at"])
                changed = True
        else:
            QuestionnaireResponse.objects.create(session=session, field=field, value=stored_value)
            changed = True
    if clean.get("consent") is True and "consent" not in existing:
        log_event(session, EventType.CONSENT_GIVEN, step)
    session.current_step = min(step + 1, TOTAL_STEPS - 1) if complete else step
    if complete and step > session.last_completed_step:
        session.last_completed_step = step
        log_event(session, EventType.STEP_COMPLETED, step)
    elif changed:
        recent = TrackingEvent.objects.filter(session=session, type=EventType.ANSWERS_SAVED, step=step,
                                              created_at__gte=timezone.now() - timedelta(seconds=30)).exists()
        if not recent:
            log_event(session, EventType.ANSWERS_SAVED, step)
    touch(session)
    session.save()
    return session


def _step_fields(step):
    from .schema import STEP_FIELDS
    return STEP_FIELDS[step]


@transaction.atomic
def submit(session):
    session = QuestionnaireSession.objects.select_for_update().get(pk=session.pk)
    if session.status == SessionStatus.SUBMITTED:
        return session  # idempotent
    if session.status in (SessionStatus.EXPIRED, SessionStatus.INVALIDATED):
        raise ServiceError("Cette session n'est plus valide.", 409)
    if session.last_completed_step < TOTAL_STEPS - 1:
        raise ServiceError("Le questionnaire est incomplet.", 400,
                           {"missing_steps": list(range(session.last_completed_step + 1, TOTAL_STEPS))})
    a = answers_of(session)
    if a.get("consent") is not True:
        raise ServiceError("Le consentement est obligatoire.", 400, {"consent": "Le consentement est obligatoire."})
    email = a["email"].strip().lower()
    prospect, _ = Prospect.objects.update_or_create(email=email, defaults={
        "first_name": a["first"], "last_name": a["last"], "phone": normalize_phone(a["whatsapp"])})
    ConsentRecord.objects.create(prospect=prospect, session=session, text_version=settings.CONSENT_TEXT_VERSION)
    session.prospect = prospect
    if session.transition(SessionStatus.SUBMITTED):
        session.submitted_at = timezone.now()
        log_event(session, EventType.SESSION_SUBMITTED, TOTAL_STEPS - 1)
    touch(session)
    session.save()
    return session


def mark_abandoned(now=None, minutes=None):
    """Marque abandonnées les sessions en cours inactives depuis N minutes (configurable)."""
    now = now or timezone.now()
    limit = now - timedelta(minutes=minutes if minutes is not None else settings.ABANDON_AFTER_MINUTES)
    count = 0
    for s in QuestionnaireSession.objects.filter(status=SessionStatus.IN_PROGRESS, last_activity_at__lt=limit):
        with transaction.atomic():
            s = QuestionnaireSession.objects.select_for_update().get(pk=s.pk)
            if s.status == SessionStatus.IN_PROGRESS and s.last_activity_at < limit and s.transition(SessionStatus.ABANDONED):
                s.save(update_fields=["status"])  # last_activity_at inchangée : l'abandon n'est pas une activité
                log_event(s, EventType.SESSION_ABANDONED, s.current_step)
                count += 1
    return count


def expire_old(now=None, days=None):
    """Expire les sessions abandonnées depuis plus de N jours (règle de conservation)."""
    now = now or timezone.now()
    limit = now - timedelta(days=days if days is not None else settings.EXPIRE_AFTER_DAYS)
    count = 0
    for s in QuestionnaireSession.objects.filter(status=SessionStatus.ABANDONED, last_activity_at__lt=limit):
        if s.transition(SessionStatus.EXPIRED):
            s.save(update_fields=["status"])
            log_event(s, EventType.SESSION_EXPIRED, s.current_step)
            count += 1
    return count

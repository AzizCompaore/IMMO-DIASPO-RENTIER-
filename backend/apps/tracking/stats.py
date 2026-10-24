from django.db.models import Avg, ExpressionWrapper, F, DurationField, Q
from django.utils.dateparse import parse_date

from apps.questionnaires.models import QuestionnaireSession, SessionStatus
from .models import TrackingEvent


def filter_sessions(qs, params):
    """Filtres communs au tableau de bord, à la liste et à l'export : période (date de début) et source UTM."""
    d1, d2 = parse_date(params.get("date_from") or ""), parse_date(params.get("date_to") or "")
    if d1:
        qs = qs.filter(started_at__date__gte=d1)
    if d2:
        qs = qs.filter(started_at__date__lte=d2)
    if params.get("utm_source"):
        qs = qs.filter(utm_source=params["utm_source"])
    return qs


def pct(num, den):
    return round(100 * num / den, 1) if den else None


def build_stats(params):
    qs = filter_sessions(QuestionnaireSession.objects.all(), params)
    total = qs.count()
    by = {s: qs.filter(status=s).count() for s in SessionStatus.values}
    identified = qs.filter(responses__field__in=["email", "whatsapp"], responses__value__gt="").distinct().count()
    avg = qs.filter(status=SessionStatus.SUBMITTED, submitted_at__isnull=False).annotate(
        d=ExpressionWrapper(F("submitted_at") - F("started_at"), output_field=DurationField())).aggregate(a=Avg("d"))["a"]
    by_step = {i: qs.filter(status__in=[SessionStatus.ABANDONED, SessionStatus.EXPIRED], current_step=i).count() for i in range(4)}
    recent = TrackingEvent.objects.filter(session__in=qs).select_related("session").order_by("-created_at")[:10]
    return {
        "total_started": total,
        "identified_contacts": identified,   # sessions ayant saisi un e-mail ou un téléphone
        "submitted": by["submitted"], "in_progress": by["in_progress"], "abandoned": by["abandoned"],
        "expired": by["expired"], "invalidated": by["invalidated"],
        # Taux : voir README. Dénominateur = toutes les sessions commencées de la période filtrée.
        "completion_rate": pct(by["submitted"], total),
        "abandonment_rate": pct(by["abandoned"] + by["expired"], total),
        "avg_completion_seconds": round(avg.total_seconds()) if avg else None,
        "dropoff_by_step": by_step,
        "utm_sources": sorted(set(QuestionnaireSession.objects.exclude(utm_source="").values_list("utm_source", flat=True))),
        "recent_activity": [{"session_id": str(e.session_id), "type": e.type, "step": e.step, "at": e.created_at} for e in recent],
    }

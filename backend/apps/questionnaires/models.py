import hashlib
import hmac
import secrets
import uuid
from django.db import models
from django.utils import timezone


class SessionStatus(models.TextChoices):
    IN_PROGRESS = "in_progress", "En cours"
    ABANDONED = "abandoned", "Abandonné"
    SUBMITTED = "submitted", "Soumis"
    EXPIRED = "expired", "Expiré"
    INVALIDATED = "invalidated", "Invalidé"


# Transitions autorisées (documentées dans le README). Un questionnaire soumis est définitif.
ALLOWED_TRANSITIONS = {
    SessionStatus.IN_PROGRESS: {SessionStatus.ABANDONED, SessionStatus.SUBMITTED, SessionStatus.INVALIDATED},
    SessionStatus.ABANDONED: {SessionStatus.IN_PROGRESS, SessionStatus.SUBMITTED, SessionStatus.EXPIRED, SessionStatus.INVALIDATED},
    SessionStatus.SUBMITTED: set(), SessionStatus.EXPIRED: set(), SessionStatus.INVALIDATED: set(),
}


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


class QuestionnaireSession(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)  # UUID4 aléatoire, sans lien avec l'identité
    token_hash = models.CharField(max_length=64)  # jeton de reprise : seul son hash est stocké
    status = models.CharField(max_length=20, choices=SessionStatus.choices, default=SessionStatus.IN_PROGRESS, db_index=True)
    current_step = models.PositiveSmallIntegerField(default=0)
    last_completed_step = models.SmallIntegerField(default=-1)
    started_at = models.DateTimeField(default=timezone.now, db_index=True)
    last_activity_at = models.DateTimeField(default=timezone.now, db_index=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    prospect = models.ForeignKey("prospects.Prospect", null=True, blank=True, on_delete=models.SET_NULL, related_name="sessions")
    utm_source = models.CharField(max_length=100, blank=True, db_index=True)
    utm_medium = models.CharField(max_length=100, blank=True)
    utm_campaign = models.CharField(max_length=100, blank=True)
    utm_content = models.CharField(max_length=100, blank=True)
    utm_term = models.CharField(max_length=100, blank=True)

    class Meta:
        ordering = ["-last_activity_at"]

    @classmethod
    def create_with_token(cls, **kwargs):
        token = secrets.token_urlsafe(32)
        return cls.objects.create(token_hash=hash_token(token), **kwargs), token

    def check_token(self, token: str) -> bool:
        return bool(token) and hmac.compare_digest(self.token_hash, hash_token(token))

    @property
    def steps_completed(self):
        return self.last_completed_step + 1

    @property
    def progress_percent(self):
        from .schema import TOTAL_STEPS
        return round(100 * self.steps_completed / TOTAL_STEPS)

    def transition(self, new_status):
        """Change le statut en respectant les transitions autorisées. Retourne True si le statut a changé."""
        if new_status == self.status:
            return False
        if new_status not in ALLOWED_TRANSITIONS[SessionStatus(self.status)]:
            raise ValueError(f"Transition interdite : {self.status} -> {new_status}")
        self.status = new_status
        return True


class QuestionnaireResponse(models.Model):
    """Une ligne par (session, champ) : les mises à jour répétées écrasent la valeur, jamais de doublon."""
    session = models.ForeignKey(QuestionnaireSession, on_delete=models.CASCADE, related_name="responses")
    field = models.CharField(max_length=40)
    value = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["session", "field"], name="uniq_response_per_session_field")]

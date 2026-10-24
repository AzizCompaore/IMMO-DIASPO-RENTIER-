from django.db import models


class EventType(models.TextChoices):
    SESSION_STARTED = "session_started", "Ouverture du questionnaire"
    SESSION_RESUMED = "session_resumed", "Reprise de la session"
    STEP_VIEWED = "step_viewed", "Étape affichée"
    ANSWERS_SAVED = "answers_saved", "Réponses sauvegardées"
    STEP_COMPLETED = "step_completed", "Étape terminée"
    SESSION_SUBMITTED = "session_submitted", "Questionnaire soumis"
    SESSION_ABANDONED = "session_abandoned", "Session marquée abandonnée"
    SESSION_EXPIRED = "session_expired", "Session expirée"
    SESSION_INVALIDATED = "session_invalidated", "Session invalidée"
    CONSENT_GIVEN = "consent_given", "Consentement enregistré"


# Seuls ces types peuvent être signalés par le navigateur ; les autres sont créés exclusivement par le serveur.
CLIENT_EVENT_TYPES = {EventType.STEP_VIEWED}


class TrackingEvent(models.Model):
    session = models.ForeignKey("questionnaires.QuestionnaireSession", on_delete=models.CASCADE, related_name="events")
    type = models.CharField(max_length=30, choices=EventType.choices, db_index=True)
    step = models.SmallIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)

    class Meta:
        ordering = ["created_at", "id"]

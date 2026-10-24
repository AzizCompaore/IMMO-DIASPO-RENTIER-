import uuid
from django.conf import settings
from django.db import models


class CommercialStatus(models.TextChoices):
    NEW = "new", "Nouveau"
    TO_CONTACT = "to_contact", "À contacter"
    CONTACTED = "contacted", "Contacté"
    QUALIFYING = "qualifying", "En qualification"
    QUALIFIED = "qualified", "Qualifié"
    REJECTED = "rejected", "Non retenu"
    CONVERTED = "converted", "Converti"


class Prospect(models.Model):
    """Personne identifiée ayant consenti à être recontactée. Statut commercial distinct du statut du questionnaire."""
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    email = models.EmailField(unique=True)  # stocké en minuscules
    phone = models.CharField(max_length=30)
    commercial_status = models.CharField(max_length=20, choices=CommercialStatus.choices, default=CommercialStatus.NEW)
    internal_notes = models.TextField(blank=True)
    # Préparation CRM : identifiant externe et état de synchronisation (aucune API CRM branchée à ce stade).
    crm_external_id = models.CharField(max_length=100, blank=True, db_index=True)
    crm_synced_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]

    @property
    def full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def __str__(self):
        return self.full_name


class ConsentRecord(models.Model):
    """Preuve du consentement : texte (version), date, session. Pas d'adresse IP ni d'empreinte navigateur."""
    prospect = models.ForeignKey(Prospect, on_delete=models.CASCADE, related_name="consents")
    session = models.ForeignKey("questionnaires.QuestionnaireSession", on_delete=models.SET_NULL, null=True, related_name="consents")
    purpose = models.CharField(max_length=60, default="recontact_commercial")
    text_version = models.CharField(max_length=60)
    given_at = models.DateTimeField(auto_now_add=True)
    withdrawn_at = models.DateTimeField(null=True, blank=True)


class AuditLog(models.Model):
    """Traçabilité des actions administratives importantes (statut commercial, notes, exports)."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    action = models.CharField(max_length=40)
    prospect = models.ForeignKey(Prospect, null=True, blank=True, on_delete=models.SET_NULL, related_name="audit_logs")
    field = models.CharField(max_length=40, blank=True)
    old_value = models.TextField(blank=True)
    new_value = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-created_at"]

from django.core.management.base import BaseCommand
from apps.questionnaires import services


class Command(BaseCommand):
    help = "Marque les sessions inactives comme abandonnées et expire les anciennes (à planifier toutes les 5 min)."

    def handle(self, *args, **opts):
        a, e = services.mark_abandoned(), services.expire_old()
        self.stdout.write(f"abandonnées: {a}, expirées: {e}")

from django.contrib.auth.models import Group
from django.core.management.base import BaseCommand
from apps.core.roles import ALL_ROLES


class Command(BaseCommand):
    help = "Crée les groupes de rôles (Administrateur, Commercial, Lecture seule)."

    def handle(self, *a, **o):
        for r in ALL_ROLES:
            Group.objects.get_or_create(name=r)
        self.stdout.write("Rôles créés.")

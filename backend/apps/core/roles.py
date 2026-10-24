ADMIN, COMMERCIAL, READONLY = "Administrateur", "Commercial", "Lecture seule"
ALL_ROLES = [ADMIN, COMMERCIAL, READONLY]


def role_of(user):
    if not user.is_authenticated or not user.is_active:
        return None
    if user.is_superuser:
        return ADMIN
    names = set(user.groups.values_list("name", flat=True))
    for r in ALL_ROLES:  # le rôle le plus élevé l'emporte
        if r in names:
            return r
    return None

"""Questions du questionnaire (reprises à l'identique de la maquette). Source de validation côté serveur."""
import re

COUNTRIES = ["France", "Belgique", "Suisse", "Allemagne", "Royaume-Uni", "Italie", "Espagne",
             "Canada", "États-Unis", "Côte d’Ivoire", "Autre"]
CHOICES = {
    "employment": ["CDD", "CDI de moins de 3 ans", "CDI de 3 ans ou plus", "Autre"],
    "family": ["Marié(e)", "Séparé(e)", "Célibataire", "Pacsé(e)", "Autre"],
    "housing": ["Propriétaire", "Locataire", "Autre"],
    "income": ["Moins de 3 000 €", "De 3 000 € à 6 000 €", "Plus de 6 000 €"],
    "savings": ["Moins de 10 000 €", "De 10 000 € à 30 000 €", "Plus de 30 000 €"],
    "budget": ["De 100 000 € à 150 000 €", "De 150 000 € à 250 000 €", "Plus de 250 000 €"],
    "deposit": ["Moins de 15 000 €", "De 15 000 € à 30 000 €", "De 30 000 € à 60 000 €", "Plus de 60 000 €"],
    "horizon": ["Moins de 3 mois", "De 3 à 6 mois", "Plus de 6 mois"],
}
# Champs par étape (0 à 3). Les noms sont ceux de la maquette.
STEP_FIELDS = {
    0: ["country", "otherCountry", "employment", "family", "housing"],
    1: ["income", "savings"],
    2: ["budget", "deposit", "horizon"],
    3: ["first", "last", "whatsapp", "email", "consent"],
}
TOTAL_STEPS = len(STEP_FIELDS)
STEP_LABELS = ["Votre profil", "Votre situation financière", "Votre projet immobilier", "Vos coordonnées"]
ALL_FIELDS = [f for fs in STEP_FIELDS.values() for f in fs]
REQUIRED_BY_STEP = {
    0: ["country", "employment", "family", "housing"],
    1: ["income", "savings"], 2: ["budget", "deposit", "horizon"],
    3: ["first", "last", "whatsapp", "email", "consent"],
}
PHONE_RE = re.compile(r"^\+?[0-9]{7,15}$")
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]{2,}$")


def normalize_phone(value):
    return re.sub(r"[\s().-]", "", value or "")


def validate_step(step, data, complete):
    """Retourne (valeurs_nettoyées, erreurs). En sauvegarde partielle, seuls les choix invalides sont rejetés
    et le texte libre n'est contrôlé qu'en longueur ; à la complétion, tout est strict."""
    clean, errors = {}, {}
    for field in STEP_FIELDS[step]:
        if field not in data:
            continue
        value = data[field]
        if field == "consent":
            if not isinstance(value, bool):
                errors[field] = "Valeur booléenne attendue."
            else:
                clean[field] = value
            continue
        if not isinstance(value, str):
            errors[field] = "Texte attendu."
            continue
        value = value.strip()
        if len(value) > 200:
            errors[field] = "Valeur trop longue."
            continue
        if value == "":
            clean[field] = ""
            continue
        if field == "country" and value not in COUNTRIES:
            errors[field] = "Pays non reconnu."
        elif field in CHOICES and value not in CHOICES[field]:
            errors[field] = "Choix non reconnu."
        elif complete and field == "email" and not EMAIL_RE.match(value):
            errors[field] = "Adresse e-mail invalide."
        elif complete and field == "whatsapp" and not PHONE_RE.match(normalize_phone(value)):
            errors[field] = "Numéro de téléphone invalide (ex. +33600000000)."
        else:
            clean[field] = value
    if complete:
        merged_missing = [f for f in REQUIRED_BY_STEP[step] if f not in clean or clean[f] in ("", False)]
        for f in merged_missing:
            errors.setdefault(f, "Ce champ est obligatoire." if f != "consent" else "Le consentement est obligatoire.")
        if step == 0 and clean.get("country") == "Autre" and not clean.get("otherCountry"):
            errors["otherCountry"] = "Merci de préciser votre pays."
    return clean, errors

/** Questions reprises à l'identique de la maquette. Le serveur revalide chaque valeur (apps/questionnaires/schema.py). */
export const COUNTRIES = ["France", "Belgique", "Suisse", "Allemagne", "Royaume-Uni", "Italie", "Espagne", "Canada", "États-Unis", "Côte d’Ivoire"];
export const CHOICES: Record<string, string[]> = {
  employment: ["CDD", "CDI de moins de 3 ans", "CDI de 3 ans ou plus", "Autre"],
  family: ["Marié(e)", "Séparé(e)", "Célibataire", "Pacsé(e)", "Autre"],
  housing: ["Propriétaire", "Locataire", "Autre"],
  income: ["Moins de 3 000 €", "De 3 000 € à 6 000 €", "Plus de 6 000 €"],
  savings: ["Moins de 10 000 €", "De 10 000 € à 30 000 €", "Plus de 30 000 €"],
  budget: ["De 100 000 € à 150 000 €", "De 150 000 € à 250 000 €", "Plus de 250 000 €"],
  deposit: ["Moins de 15 000 €", "De 15 000 € à 30 000 €", "De 30 000 € à 60 000 €", "Plus de 60 000 €"],
  horizon: ["Moins de 3 mois", "De 3 à 6 mois", "Plus de 6 mois"],
};
export const STEP_FIELDS: string[][] = [
  ["country", "otherCountry", "employment", "family", "housing"],
  ["income", "savings"],
  ["budget", "deposit", "horizon"],
  ["first", "last", "whatsapp", "email", "consent"],
];
export const STEP_NAMES = ["Votre profil", "Votre situation financière", "Votre projet immobilier", "Vos coordonnées"];

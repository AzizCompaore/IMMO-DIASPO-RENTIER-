import type { Answers } from "./services/questionnaireApi";

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;
const PHONE_RE = /^\+?[0-9]{7,15}$/;
export const normalizePhone = (v: string) => v.replace(/[\s().-]/g, "");

const REQUIRED: string[][] = [
  ["country", "employment", "family", "housing"], ["income", "savings"], ["budget", "deposit", "horizon"],
  ["first", "last", "whatsapp", "email", "consent"],
];

/** Miroir de la validation serveur (qui reste l'autorité). Retourne {champ: message}. */
export function validateStep(step: number, a: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const f of REQUIRED[step]) {
    const v = a[f];
    if (v === undefined || v === "" || v === false || (typeof v === "string" && !v.trim()))
      errors[f] = f === "consent" ? "Le consentement est obligatoire." : "Merci de compléter ce champ.";
  }
  if (step === 0 && a.country === "Autre" && !String(a.otherCountry ?? "").trim()) errors.otherCountry = "Merci de préciser votre pays.";
  if (step === 3) {
    if (!errors.email && !EMAIL_RE.test(String(a.email).trim())) errors.email = "Adresse e-mail invalide.";
    if (!errors.whatsapp && !PHONE_RE.test(normalizePhone(String(a.whatsapp)))) errors.whatsapp = "Numéro invalide (ex. +33 6 00 00 00 00).";
  }
  return errors;
}

import { describe, expect, it } from "vitest";
import { validateStep } from "../validation";
import { CHOICES, STEP_FIELDS } from "../questionnaireSchema";

describe("validateStep", () => {
  it("exige tous les champs de l'étape 1", () => {
    expect(Object.keys(validateStep(0, {})).sort()).toEqual(["country", "employment", "family", "housing"]);
  });
  it("exige la précision du pays quand « Autre »", () => {
    const a = { country: "Autre", employment: "CDD", family: "Marié(e)", housing: "Locataire" };
    expect(validateStep(0, a).otherCountry).toBeTruthy();
    expect(validateStep(0, { ...a, otherCountry: "Maroc" })).toEqual({});
  });
  it("valide e-mail, téléphone et consentement", () => {
    const base = { first: "A", last: "B", whatsapp: "+33 6 00 00 00 00", email: "a@b.co", consent: true };
    expect(validateStep(3, base)).toEqual({});
    expect(validateStep(3, { ...base, email: "x" }).email).toBeTruthy();
    expect(validateStep(3, { ...base, whatsapp: "12" }).whatsapp).toBeTruthy();
    expect(validateStep(3, { ...base, consent: false }).consent).toBeTruthy();
  });
  it("conserve les questions de la maquette", () => {
    expect(STEP_FIELDS.flat()).toHaveLength(15);
    expect(CHOICES.deposit).toHaveLength(4);
  });
});

/** Configuration centralisée : aucun lien fictif dans le code. Valeurs fournies par l'entreprise via .env. */
const v = (x: string | undefined) => (x ?? "").trim();

export const CONFIG = {
  apiBase: v(import.meta.env.VITE_API_BASE) || "/api/v1",
  demoMode: v(import.meta.env.VITE_DEMO_MODE).toLowerCase() === "true",
  videoUrl: v(import.meta.env.VITE_VIDEO_URL),
  thankYouVideoUrl: v(import.meta.env.VITE_THANKYOU_VIDEO_URL) || (import.meta.env.BASE_URL === "/" ? "/images/VIDEO%20derni%C3%A8re%20page.mp4" : ""),
  whatsappGroupUrl: v(import.meta.env.VITE_WHATSAPP_GROUP_URL),
  legalUrl: v(import.meta.env.VITE_LEGAL_URL),
  privacyUrl: v(import.meta.env.VITE_PRIVACY_URL),
  termsUrl: v(import.meta.env.VITE_TERMS_URL),
  questionnairePath: "/questionnaire",
};

export const isWhatsappUrl = (u: string) => /^https:\/\/chat\.whatsapp\.com\//.test(u);

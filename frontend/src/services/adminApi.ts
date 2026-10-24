import { ApiError, request } from "./api";

export interface Me { username: string; role: "Administrateur" | "Commercial" | "Lecture seule" }
export interface Row {
  id: string; identified: boolean; name: string | null; email: string | null; phone: string | null; prospect_id: string | null;
  started_at: string; last_activity_at: string; current_step: number; current_step_label: string; last_completed_step: number;
  progress_percent: number; status: string; commercial_status: string | null; submitted_at: string | null; utm_source: string;
}
export interface Stats {
  total_started: number; identified_contacts: number; submitted: number; in_progress: number; abandoned: number; expired: number; invalidated: number;
  completion_rate: number | null; abandonment_rate: number | null; avg_completion_seconds: number | null;
  dropoff_by_step: Record<string, number>; utm_sources: string[];
  recent_activity: { session_id: string; type: string; step: number | null; at: string }[];
}
export interface Detail extends Row {
  answers: Record<string, string | boolean>; missing_fields: { step: number; step_label: string; field: string }[];
  utm: Record<string, string>;
  prospect: null | { id: string; commercial_status: string; internal_notes: string; crm_external_id: string; consents: { purpose: string; text_version: string; given_at: string; withdrawn_at: string | null }[] };
  timeline: { type: string; label: string; step: number | null; at: string }[];
}
export interface Page<T> { count: number; next: string | null; previous: string | null; results: T[] }

const qs = (p: Record<string, string>) => { const s = new URLSearchParams(Object.entries(p).filter(([, v]) => v)).toString(); return s ? "?" + s : ""; };

export const csrf = () => request<{ csrfToken: string }>("/auth/csrf/");
export const login = (username: string, password: string) => request<Me>("/auth/login/", { method: "POST", body: { username, password } });
export const logout = () => request<void>("/auth/logout/", { method: "POST" });
export const me = () => request<Me>("/auth/me/");
export const stats = (p: Record<string, string>) => request<Stats>("/admin/stats/" + qs(p));
export const sessions = (p: Record<string, string>) => request<Page<Row>>("/admin/sessions/" + qs(p));
export const detail = (id: string) => request<Detail>(`/admin/sessions/${id}/`);
export async function downloadClientPdf(id: string): Promise<void> {
  let response: Response;
  try {
    response = await fetch(`/api/v1/admin/sessions/${id}/pdf/`, {
      headers: { Accept: "application/pdf" },
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "Connexion impossible. Vérifiez votre réseau et réessayez.");
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ApiError(response.status, data.detail ?? "Impossible de télécharger la fiche PDF.");
  }
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `client-${id}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export const updateProspect = (id: string, body: { commercial_status?: string; internal_notes?: string }) =>
  request<{ commercial_status: string; internal_notes: string }>(`/admin/prospects/${id}/`, { method: "PATCH", body });

export const SESSION_STATUS: Record<string, string> = { in_progress: "En cours", abandoned: "Abandonné", submitted: "Soumis", expired: "Expiré", invalidated: "Invalidé" };
export const COMMERCIAL_STATUS: Record<string, string> = { new: "Nouveau", to_contact: "À contacter", contacted: "Contacté", qualifying: "En qualification", qualified: "Qualifié", rejected: "Non retenu", converted: "Converti" };
export const FIELD_LABELS: Record<string, string> = {
  country: "Pays de résidence", otherCountry: "Autre pays", employment: "Situation professionnelle", family: "Situation familiale", housing: "Logement",
  income: "Revenus mensuels nets", savings: "Épargne", budget: "Montant à financer", deposit: "Apport", horizon: "Délai d'acquisition",
  first: "Prénom", last: "Nom", whatsapp: "Téléphone WhatsApp", email: "E-mail", consent: "Consentement",
};
export const fmt = (d: string | null) => (d ? new Date(d).toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" }) : "—");

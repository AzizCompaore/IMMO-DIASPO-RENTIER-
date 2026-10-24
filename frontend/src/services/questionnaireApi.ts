import { request } from "./api";

export type Answers = Record<string, string | boolean>;
export interface SessionData { id: string; status: string; current_step: number; last_completed_step: number; progress_percent: number; answers: Answers; token?: string }

const auth = (token: string) => ({ "X-Session-Token": token });

export const createSession = (utm: Record<string, string>) => request<SessionData>("/sessions/", { method: "POST", body: utm });
export const getSession = (id: string, token: string) => request<SessionData>(`/sessions/${id}/`, { headers: auth(token) });
export const saveStep = (id: string, token: string, step: number, answers: Answers, complete: boolean) =>
  request<SessionData>(`/sessions/${id}/steps/${step}/`, { method: "PUT", headers: auth(token), body: { answers, complete } });
export const sendStepViewed = (id: string, token: string, step: number) =>
  request<void>(`/sessions/${id}/events/`, { method: "POST", headers: auth(token), body: { type: "step_viewed", step } }).catch(() => undefined);
export const submitSession = (id: string, token: string) =>
  request<{ id: string; status: string }>(`/sessions/${id}/submit/`, { method: "POST", headers: auth(token) });

import { CONFIG } from "../config";

export class ApiError extends Error {
  constructor(public status: number, message: string, public errors: Record<string, string> = {}) { super(message); }
  get isNetwork() { return this.status === 0; }
}

const cookie = (name: string) => document.cookie.split("; ").find((c) => c.startsWith(name + "="))?.split("=")[1];

export async function request<T>(path: string, opts: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<T> {
  const method = opts.method ?? "GET";
  const headers: Record<string, string> = { Accept: "application/json", ...opts.headers };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") { const t = cookie("csrftoken"); if (t) headers["X-CSRFToken"] = decodeURIComponent(t); }
  let res: Response;
  try {
    res = await fetch(CONFIG.apiBase + path, { method, headers, credentials: "same-origin", body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined });
  } catch {
    throw new ApiError(0, "Connexion impossible. Vérifiez votre réseau et réessayez.");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.detail ?? "Une erreur est survenue.", data.errors ?? {});
  return data as T;
}

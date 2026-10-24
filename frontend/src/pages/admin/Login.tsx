import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError } from "../../services/api";
import * as api from "../../services/adminApi";
import "../../styles/admin.css";

export default function Login() {
  const nav = useNavigate();
  const [u, setU] = useState(""); const [p, setP] = useState(""); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  useEffect(() => { api.csrf().catch(() => setErr("Serveur injoignable.")); }, []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr("");
    try { await api.login(u, p); nav("/admin", { replace: true }); }
    catch (x) { setErr(x instanceof ApiError ? (x.status === 429 ? "Trop de tentatives. Réessayez dans une minute." : x.message) : "Erreur."); }
    finally { setBusy(false); }
  };
  return (
    <div className="adm adm-login">
      <form className="adm-card" onSubmit={submit}>
        <h1>Connexion</h1><p className="muted">Espace réservé au personnel autorisé d'URIEL GROUP.</p>
        <label>Identifiant<input value={u} onChange={(e) => setU(e.target.value)} autoComplete="username" required /></label>
        <label>Mot de passe<input type="password" value={p} onChange={(e) => setP(e.target.value)} autoComplete="current-password" required /></label>
        {err && <p className="adm-err" role="alert">{err}</p>}
        <button className="adm-btn" disabled={busy}>{busy ? "Connexion…" : "Se connecter"}</button>
      </form>
    </div>
  );
}

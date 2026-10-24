import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import * as api from "../../services/adminApi";
import { useMe } from "./AdminLayout";

const dur = (s: number | null) => (s == null ? "—" : s < 90 ? `${s} s` : `${Math.round(s / 60)} min`);
const EVT: Record<string, string> = { session_started: "Ouverture", session_resumed: "Reprise", step_viewed: "Étape affichée", answers_saved: "Sauvegarde", step_completed: "Étape terminée", session_submitted: "Soumission", session_abandoned: "Abandon", session_expired: "Expiration", session_invalidated: "Invalidation", consent_given: "Consentement" };

export default function Dashboard() {
  const me = useMe();
  const [f, setF] = useState({ date_from: "", date_to: "", utm_source: "", status: "", step: "", commercial_status: "", q: "" });
  const [page, setPage] = useState(1);
  const [order, setOrder] = useState("-last_activity_at");
  const [stats, setStats] = useState<api.Stats | null>(null);
  const [list, setList] = useState<api.Page<api.Row> | null>(null);
  const [err, setErr] = useState("");
  const period = { date_from: f.date_from, date_to: f.date_to, utm_source: f.utm_source };
  const key = JSON.stringify([f, page, order]);
  useEffect(() => {
    setErr("");
    api.stats(period).then(setStats).catch((e) => setErr(e.message));
    api.sessions({ ...f, page: String(page), ordering: order }).then(setList).catch((e) => setErr(e.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const set = (k: string, v: string) => { setF({ ...f, [k]: v }); setPage(1); };
  const sort = (field: string) => { setOrder(order === field ? "-" + field : field); setPage(1); };
  const arrow = (field: string) => (order === field ? " ▲" : order === "-" + field ? " ▼" : "");
  const cards: [string, string | number][] = stats ? [
    ["Sessions commencées", stats.total_started], ["Coordonnées saisies", stats.identified_contacts], ["Terminés", stats.submitted],
    ["En cours", stats.in_progress], ["Abandonnés", stats.abandoned], ["Expirés", stats.expired],
    ["Taux de complétion", stats.completion_rate == null ? "—" : stats.completion_rate + " %"],
    ["Taux d'abandon", stats.abandonment_rate == null ? "—" : stats.abandonment_rate + " %"], ["Durée moyenne", dur(stats.avg_completion_seconds)],
  ] : [];
  return (
    <>
      {err && <p className="adm-err" role="alert">{err}</p>}
      <section className="adm-filters" aria-label="Filtres">
        <label>Du<input type="date" value={f.date_from} onChange={(e) => set("date_from", e.target.value)} /></label>
        <label>Au<input type="date" value={f.date_to} onChange={(e) => set("date_to", e.target.value)} /></label>
        <label>Source<select value={f.utm_source} onChange={(e) => set("utm_source", e.target.value)}><option value="">Toutes</option>{stats?.utm_sources.map((s) => <option key={s}>{s}</option>)}</select></label>
      </section>
      <section className="adm-cards">{cards.map(([l, v]) => <div className="adm-stat" key={l}><span>{l}</span><strong>{v}</strong></div>)}</section>
      {stats && <p className="muted small">Taux de complétion = questionnaires soumis ÷ sessions commencées sur la période. Taux d'abandon = (abandonnés + expirés) ÷ sessions commencées ; les sessions « en cours » ne sont pas comptées comme abandons. Arrêts par étape (abandonnés/expirés) : {[0, 1, 2, 3].map((i) => `étape ${i + 1} : ${stats.dropoff_by_step[i] ?? 0}`).join(" · ")}.</p>}

      <section className="adm-panel">
        <div className="adm-bar">
          <h2>Prospects et sessions</h2>
          <input type="search" placeholder="Nom, e-mail, téléphone, identifiant…" value={f.q} onChange={(e) => set("q", e.target.value)} />
          <select aria-label="Statut du formulaire" value={f.status} onChange={(e) => set("status", e.target.value)}><option value="">Tous les statuts</option>{Object.entries(api.SESSION_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select aria-label="Étape" value={f.step} onChange={(e) => set("step", e.target.value)}><option value="">Toutes les étapes</option>{[0, 1, 2, 3].map((i) => <option key={i} value={i}>Étape {i + 1}</option>)}</select>
          <select aria-label="Statut commercial" value={f.commercial_status} onChange={(e) => set("commercial_status", e.target.value)}><option value="">Tous statuts commerciaux</option>{Object.entries(api.COMMERCIAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        </div>
        <div className="adm-scroll"><table>
          <thead><tr><th>Prospect</th><th>E-mail / téléphone</th><th><button onClick={() => sort("started_at")}>Début{arrow("started_at")}</button></th><th><button onClick={() => sort("last_activity_at")}>Dernière activité{arrow("last_activity_at")}</button></th><th><button onClick={() => sort("current_step")}>Étape{arrow("current_step")}</button></th><th><button onClick={() => sort("progress")}>Progression{arrow("progress")}</button></th><th>Formulaire</th><th>Commercial</th><th>Soumis le</th></tr></thead>
          <tbody>
            {!list ? <tr><td colSpan={9}>Chargement…</td></tr> : list.results.length === 0 ? <tr><td colSpan={9}>Aucune session ne correspond aux filtres.</td></tr> : list.results.map((r) => (
              <tr key={r.id}>
                <td><Link to={`/admin/sessions/${r.id}`}>{r.name || (r.identified ? "Identifiée (partiel)" : "Session anonyme")}</Link><br /><small className="muted">{r.id.slice(0, 8)}</small></td>
                <td>{r.email ?? "—"}<br /><small>{r.phone ?? ""}</small></td>
                <td>{api.fmt(r.started_at)}</td><td>{api.fmt(r.last_activity_at)}</td>
                <td>{r.current_step + 1}/4 · {r.current_step_label}<br /><small className="muted">dernière terminée : {r.last_completed_step < 0 ? "aucune" : r.last_completed_step + 1}</small></td>
                <td><div className="bar"><i style={{ width: r.progress_percent + "%" }} /></div>{r.progress_percent} %</td>
                <td><span className={`pill ${r.status}`}>{api.SESSION_STATUS[r.status]}</span></td>
                <td>{r.commercial_status ? api.COMMERCIAL_STATUS[r.commercial_status] : "—"}</td><td>{api.fmt(r.submitted_at)}</td>
              </tr>))}
          </tbody>
        </table></div>
        {list && <div className="adm-pager"><span>{list.count} résultat(s)</span><button className="adm-btn ghost" disabled={!list.previous} onClick={() => setPage(page - 1)}>Précédent</button><span>Page {page}</span><button className="adm-btn ghost" disabled={!list.next} onClick={() => setPage(page + 1)}>Suivant</button></div>}
      </section>

      <section className="adm-panel"><h2>Dernières activités</h2>
        {stats?.recent_activity.length ? <ul className="adm-recent">{stats.recent_activity.map((e, i) => <li key={i}>{api.fmt(e.at)} — {EVT[e.type] ?? e.type}{e.step != null ? ` (étape ${e.step + 1})` : ""} · <Link to={`/admin/sessions/${e.session_id}`}>{e.session_id.slice(0, 8)}</Link></li>)}</ul> : <p className="muted">Aucune activité.</p>}
      </section>
    </>
  );
}

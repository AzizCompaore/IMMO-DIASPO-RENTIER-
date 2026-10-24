import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import * as api from "../../services/adminApi";
import { useMe } from "./AdminLayout";

export default function SessionDetail() {
  const { id } = useParams();
  const me = useMe();
  const [d, setD] = useState<api.Detail | null>(null);
  const [err, setErr] = useState(""); const [msg, setMsg] = useState(""); const [pdfMsg, setPdfMsg] = useState("");
  const [status, setStatus] = useState(""); const [notes, setNotes] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  useEffect(() => { api.detail(id!).then((x) => { setD(x); setStatus(x.prospect?.commercial_status ?? ""); setNotes(x.prospect?.internal_notes ?? ""); }).catch((e) => setErr(e.message)); }, [id]);
  if (err) return <p className="adm-err" role="alert">{err}</p>;
  if (!d) return <p className="adm-loading">Chargement…</p>;
  const canEdit = me.role !== "Lecture seule" && !!d.prospect;
  const save = async () => {
    setMsg("");
    try { await api.updateProspect(d.prospect!.id, { commercial_status: status, internal_notes: notes }); setMsg("Modifications enregistrées."); }
    catch (e) { setMsg((e as Error).message); }
  };
  const downloadPdf = async () => {
    setPdfMsg(""); setPdfBusy(true);
    try { await api.downloadClientPdf(d.id); setPdfMsg("Téléchargement PDF lancé."); }
    catch (e) { setPdfMsg((e as Error).message); }
    finally { setPdfBusy(false); }
  };
  const answered = Object.keys(api.FIELD_LABELS).filter((k) => d.answers[k] !== undefined && d.answers[k] !== "");
  return (
    <>
      <p><Link to="/admin">← Retour à la liste</Link></p>
      <h1>{d.name || (d.identified ? "Session identifiée (partielle)" : "Session anonyme")} <span className={`pill ${d.status}`}>{api.SESSION_STATUS[d.status]}</span></h1>
      {me.role === "Administrateur" && d.prospect && d.status === "submitted" && <p><button className="adm-btn" onClick={downloadPdf} disabled={pdfBusy}>{pdfBusy ? "Préparation du PDF…" : "Télécharger la fiche client (PDF)"}</button> {pdfMsg && <span role="status">{pdfMsg}</span>}</p>}
      <p className="muted">Session {d.id} · début {api.fmt(d.started_at)} · dernière activité {api.fmt(d.last_activity_at)} · soumission {api.fmt(d.submitted_at)}{d.utm_source ? ` · source ${d.utm_source}` : ""}</p>
      <div className="adm-grid">
        <section className="adm-panel"><h2>Progression</h2>
          <div className="bar big"><i style={{ width: d.progress_percent + "%" }} /></div>
          <p>{d.progress_percent} % · étape actuelle : {d.current_step + 1}/4 ({d.current_step_label}) · dernière étape terminée : {d.last_completed_step < 0 ? "aucune" : d.last_completed_step + 1}</p>
          <h2>Coordonnées</h2>
          <p>{d.name ?? "—"}<br />{d.email ?? "—"}<br />{d.phone ?? "—"}</p>
          {!d.prospect && d.identified && <p className="muted small">Coordonnées partielles, sans consentement enregistré : non exploitables commercialement.</p>}
          <h2>Consentement</h2>
          {d.prospect?.consents.length ? d.prospect.consents.map((c, i) => <p key={i}>{c.purpose} · texte « {c.text_version} » · donné le {api.fmt(c.given_at)}{c.withdrawn_at ? ` · retiré le ${api.fmt(c.withdrawn_at)}` : ""}</p>) : <p className="muted">Aucun consentement enregistré.</p>}
          <h2>Suivi commercial</h2>
          {d.prospect ? (<>
            <label>Statut<select value={status} disabled={!canEdit} onChange={(e) => setStatus(e.target.value)}>{Object.entries(api.COMMERCIAL_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label>Notes internes<textarea rows={4} value={notes} disabled={!canEdit} maxLength={5000} onChange={(e) => setNotes(e.target.value)} /></label>
            {canEdit && <button className="adm-btn" onClick={save}>Enregistrer</button>} {msg && <span role="status">{msg}</span>}
          </>) : <p className="muted">Pas encore de prospect (aucune soumission avec consentement).</p>}
        </section>
        <section className="adm-panel"><h2>Réponses fournies</h2>
          <dl className="adm-dl">{answered.map((k) => <div key={k}><dt>{api.FIELD_LABELS[k]}</dt><dd>{typeof d.answers[k] === "boolean" ? (d.answers[k] ? "Oui" : "Non") : String(d.answers[k])}</dd></div>)}</dl>
          <h2>Réponses manquantes</h2>
          {d.missing_fields.length ? <ul>{d.missing_fields.map((m) => <li key={m.field}>Étape {m.step + 1} — {api.FIELD_LABELS[m.field]} <em className="muted">(non renseigné)</em></li>)}</ul> : <p className="muted">Aucune.</p>}
        </section>
        <section className="adm-panel wide"><h2>Chronologie du parcours</h2>
          <ol className="adm-timeline">{d.timeline.map((e, i) => <li key={i}><time>{api.fmt(e.at)}</time> {e.label}{e.step != null ? ` — étape ${e.step + 1}` : ""}</li>)}</ol>
        </section>
      </div>
    </>
  );
}

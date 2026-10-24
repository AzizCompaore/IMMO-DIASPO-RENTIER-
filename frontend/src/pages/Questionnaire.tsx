import { Link, useLocation, useNavigate } from "react-router-dom";
import { CONFIG } from "../config";
import { CHOICES, COUNTRIES, STEP_NAMES } from "../questionnaireSchema";
import { useQuestionnaire } from "../hooks/useQuestionnaire";
import "../styles/questionnaire.css";

type A = Record<string, string | boolean>;

function Choices({ name, label, answers, set, errors }: { name: string; label: string; answers: A; set: (f: string, v: string) => void; errors: Record<string, string> }) {
  return (
    <fieldset className="field" style={{ border: 0, padding: 0, margin: "0 0 23px" }}>
      <legend>{label}</legend>
      <div className="choices">
        {CHOICES[name].map((o) => (
          <label className="choice" key={o}>
            <input type="radio" name={name} value={o} checked={answers[name] === o} onChange={() => set(name, o)} />
            <span>{o}</span>
          </label>
        ))}
      </div>
      {errors[name] && <p className="field-err" role="alert">{errors[name]}</p>}
    </fieldset>
  );
}

export default function Questionnaire() {
  const { search } = useLocation();
  const nav = useNavigate();
  const q = useQuestionnaire(search, () => nav("/merci", { replace: true }));
  const { answers: a, setAnswer: set, fieldErrors: fe, step } = q;
  const text = (id: string, label: string, props: React.InputHTMLAttributes<HTMLInputElement>) => (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input className="text-input" id={id} value={String(a[id] ?? "")} onChange={(e) => set(id, e.target.value)} aria-invalid={!!fe[id]} {...props} />
      {fe[id] && <p className="field-err" role="alert">{fe[id]}</p>}
    </div>
  );
  const saveText = { idle: "", saving: "Enregistrement…", saved: "Réponses enregistrées", error: "Enregistrement impossible — vos réponses restent affichées" }[q.saveState];

  return (
    <div className="qn">
      <header><div className="brand"><img className="brand-logo" src={CONFIG.logoUrl} alt="" />IMMO <span>DIASPO</span> RENTIER</div><div className="brand-note">Une solution dédiée à la diaspora</div></header>
      <main>
        <section className="intro">
          <div className="eyebrow">Votre projet immobilier à Abidjan</div>
          <h1>Vérifiez votre éligibilité <span style={{ color: "var(--terra)" }}>au financement.</span></h1>
          <p>Quelques informations suffisent pour préparer un premier échange avec notre équipe. La vérification est gratuite et sans engagement.</p>
        </section>
        {CONFIG.demoMode && <div className="demo-banner" role="status">
          <strong>Mode aperçu</strong> — vos réponses restent dans cette page, ne sont ni envoyées ni enregistrées. N’utilisez pas de vraies informations personnelles.
        </div>}
        <div className="shell">
          <section className="form-card">
            {q.loadError ? (
              <div role="alert"><p className="error">{q.loadError}</p><button className="btn" type="button" onClick={q.retry}>Réessayer</button></div>
            ) : !q.ready ? <p>Chargement…</p> : (
              <form noValidate onSubmit={(e) => { e.preventDefault(); q.goNext(); }}>
                <div className="progress-top"><strong>{`0${step + 1} — ${STEP_NAMES[step]}`}</strong><span>Étape {step + 1} sur 4</span></div>
                <div className="track" role="progressbar" aria-valuemin={1} aria-valuemax={4} aria-valuenow={step + 1}>
                  {[0, 1, 2, 3].map((i) => <div key={i} className={`segment${i <= step ? " active" : ""}`} />)}
                </div>
                <p className={`save-state${q.saveState === "error" ? " err" : ""}`} aria-live="polite" style={{ margin: "-14px 0 14px", minHeight: 18 }}>{CONFIG.demoMode ? "Aucun enregistrement en mode aperçu" : saveText}</p>

                {step === 0 && <div className="step active">
                  <h2>Parlons de vous</h2><p className="step-desc">Votre situation nous aide à préparer un échange adapté à votre profil.</p>
                  <div className="field">
                    <label htmlFor="country">Dans quel pays résidez-vous actuellement ?</label>
                    <select id="country" value={String(a.country ?? "")} onChange={(e) => set("country", e.target.value)}>
                      <option value="">Sélectionnez votre pays</option>
                      {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                      <option value="Autre">Autre pays</option>
                    </select>
                    {fe.country && <p className="field-err" role="alert">{fe.country}</p>}
                    {a.country === "Autre" && <><input className="text-input" aria-label="Précisez votre pays" placeholder="Précisez votre pays" style={{ marginTop: 10 }} value={String(a.otherCountry ?? "")} onChange={(e) => set("otherCountry", e.target.value)} />{fe.otherCountry && <p className="field-err" role="alert">{fe.otherCountry}</p>}</>}
                  </div>
                  <Choices name="employment" label="Quelle est votre situation professionnelle ?" answers={a} set={set} errors={fe} />
                  <Choices name="family" label="Quelle est votre situation familiale ?" answers={a} set={set} errors={fe} />
                  <Choices name="housing" label="Quel est votre statut d'occupation de logement ?" answers={a} set={set} errors={fe} />
                </div>}
                {step === 1 && <div className="step active">
                  <h2>Votre situation financière</h2><p className="step-desc">Ces informations sont indicatives et serviront uniquement à préparer la qualification humaine.</p>
                  <Choices name="income" label="Quels sont vos revenus mensuels nets ?" answers={a} set={set} errors={fe} />
                  <Choices name="savings" label="De quelle épargne disposez-vous actuellement ?" answers={a} set={set} errors={fe} />
                  <p className="hint">L'épargne correspond à vos réserves financières totales, et non uniquement à la somme que vous souhaitez investir.</p>
                </div>}
                {step === 2 && <div className="step active">
                  <h2>Votre projet immobilier</h2><p className="step-desc">Précisons le financement souhaité, votre apport et le calendrier de votre acquisition à Abidjan.</p>
                  <Choices name="budget" label="Quel montant souhaitez-vous financer pour votre investissement locatif ?" answers={a} set={set} errors={fe} />
                  <Choices name="deposit" label="Quel apport souhaitez-vous mobiliser pour cet investissement ?" answers={a} set={set} errors={fe} />
                  <Choices name="horizon" label="Dans quel délai souhaitez-vous acquérir ?" answers={a} set={set} errors={fe} />
                </div>}
                {step === 3 && <div className="step active">
                  <h2>Comment vous contacter ?</h2><p className="step-desc">Une conseillère pourra vous recontacter pour approfondir votre demande.</p>
                  <div className="contact-grid">
                    {text("first", "Prénom", { autoComplete: "given-name", placeholder: "Votre prénom" })}
                    {text("last", "Nom", { autoComplete: "family-name", placeholder: "Votre nom" })}
                    {text("whatsapp", "Téléphone WhatsApp", { type: "tel", autoComplete: "tel", placeholder: "+33 6 00 00 00 00" })}
                    {text("email", "Adresse e-mail", { type: "email", autoComplete: "email", placeholder: "vous@exemple.com" })}
                  </div>
                  <div className="field">
                    {CONFIG.demoMode
                      ? <p className="privacy">En production, l’envoi d’une demande nécessite votre consentement. Aucun consentement n’est demandé ni conservé en mode aperçu.</p>
                      : <label className="choice"><input type="checkbox" checked={a.consent === true} onChange={(e) => set("consent", e.target.checked)} /><span>J'accepte d'être recontacté(e) au sujet de ma demande et j'ai pris connaissance des informations relatives au traitement de mes données.</span></label>}
                    {fe.consent && <p className="field-err" role="alert">{fe.consent}</p>}
                  </div>
                  <p className="privacy">{CONFIG.demoMode
                    ? "Mode aperçu : ne saisissez pas de coordonnées réelles. Aucune réponse n’est envoyée ni conservée."
                    : <>Vos réponses sont enregistrées au fil du questionnaire afin de vous permettre de le reprendre. Les mentions d'information définitives (finalité, durée de conservation, droits) seront publiées par URIEL GROUP.{" "}
                      {CONFIG.privacyUrl ? <a href={CONFIG.privacyUrl} target="_blank" rel="noopener noreferrer">Politique de confidentialité</a> : null}</>}</p>
                </div>}

                <p className="error" id="error" role="alert" aria-live="polite">{q.error}</p>
                <div className="actions">
                  <button className="btn back" type="button" onClick={q.goBack} style={{ visibility: step ? "visible" : "hidden" }}>← Précédent</button>
                  <button className="btn" type="submit" disabled={q.busy}>{q.busy ? "Enregistrement…" : CONFIG.demoMode && step === 3 ? "Terminer l’aperçu →" : step === 3 ? "Vérifier mon éligibilité →" : "Continuer →"}</button>
                </div>
              </form>
            )}
          </section>
          <aside className="aside">
            <div className="eyebrow">Une démarche accompagnée</div><h3>Votre projet commence ici.</h3>
            <p>Ce questionnaire prépare un échange personnalisé avec notre équipe.</p>
            <ul><li>Une démarche gratuite</li><li>Un entretien humain, sans scoring automatique</li><li>Une analyse préliminaire, sans garantie de financement</li></ul>
            <p style={{ fontSize: 12, borderTop: "1px solid #dec9b8", paddingTop: 14 }}>IMMO DIASPO RENTIER — Investir dans l'immobilier locatif à Abidjan depuis l'étranger.</p>
          </aside>
        </div>
      </main>
      <footer>© 2026 IMMO DIASPO RENTIER · <Link to="/">Retour à l'accueil</Link></footer>
    </div>
  );
}

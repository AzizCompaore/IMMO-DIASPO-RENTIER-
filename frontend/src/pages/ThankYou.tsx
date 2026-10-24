import { Navigate } from "react-router-dom";
import { CONFIG, isWhatsappUrl } from "../config";
import VideoEmbed from "../components/VideoEmbed";
import { LegalLink } from "../components/LegalLinks";
import "../styles/thankyou.css";

function Whatsapp() {
  const ok = isWhatsappUrl(CONFIG.whatsappGroupUrl);
  return (
    <a className="btn whatsapp-link" href={ok ? CONFIG.whatsappGroupUrl : "#"} {...(ok ? { target: "_blank", rel: "noopener noreferrer" } : { onClick: (e) => { e.preventDefault(); alert("Le lien du groupe WhatsApp sera disponible prochainement."); } })}>
      Rejoindre le groupe WhatsApp <span aria-hidden="true">→</span>
    </a>
  );
}

export default function ThankYou() {
  const demoSubmission = CONFIG.demoMode && sessionStorage.getItem("idr_demo_preview") === "1";
  if (sessionStorage.getItem("idr_submitted") !== "1" && !demoSubmission) return <Navigate to="/" replace />;
  const svg = (d: React.ReactNode) => <svg viewBox="0 0 24 24" aria-hidden="true">{d}</svg>;
  return (
    <div className="ty">
      <header className="header"><div className="container"><a className="brand" href="#top"><img className="brand-logo" src={CONFIG.logoUrl} alt="" />IMMO DIASPO RENTIER</a><span className="byline">URIEL GROUP</span></div></header>
      <main id="top">
        <section className="hero container" aria-labelledby="hero-title">
          {demoSubmission && <p className="demo-notice" role="status">Mode démonstration : aucune demande n’a été transmise ni enregistrée.</p>}
          <div className="check" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6 9 17l-5-5" /></svg></div>
          <h1 id="hero-title">Félicitations pour cette première étape vers votre investissement immobilier à Abidjan.</h1>
          <p className="confirmation">{demoSubmission ? "Aperçu du parcours terminé." : "Votre demande a bien été reçue !"}</p>
          <div className="video" aria-label="Vidéo de remerciement et prochaines étapes">
            <VideoEmbed url={CONFIG.thankYouVideoUrl} title="Vidéo de remerciement IMMO DIASPO RENTIER"
              fallback={<div className="video-placeholder"><span className="play" aria-hidden="true">▶</span><span>Vidéo de remerciement et prochaines étapes</span></div>} />
          </div>
          <Whatsapp />
          <p className="note">Rejoignez notre espace d'accueil pour recevoir les informations nécessaires à la suite de votre démarche.</p>
        </section>
        <section className="steps-section" aria-labelledby="steps-title"><div className="container">
          <p className="eyebrow">Les prochaines étapes</p><h2 id="steps-title">Que se passe-t-il maintenant ?</h2>
          <div className="steps">
            <article className="step"><div className="step-top">{svg(<><path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 20l1.4-4.7A8 8 0 1 1 20 11.5Z" /><path d="M8 10h8M8 13h5" /></>)}<span className="number">01</span></div><h3>Rejoignez le groupe WhatsApp</h3><p>Accédez à notre espace d'accueil et recevez les premières informations sur votre démarche.</p></article>
            <article className="step"><div className="step-top">{svg(<><circle cx="12" cy="8" r="4" /><path d="M4 21v-2a8 8 0 0 1 16 0v2" /></>)}<span className="number">02</span></div><h3>Échangez avec notre conseillère</h3><p>Une conseillère vous contacte individuellement et vous aide à organiser votre rendez-vous.</p></article>
            <article className="step"><div className="step-top">{svg(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M7 3v4M17 3v4M3 10h18m-12 6 2 2 4-4" /></>)}<span className="number">03</span></div><h3>Rencontrez un conseiller financier</h3><p>Réservez votre entretien pour analyser votre situation et évaluer la faisabilité de votre projet.</p></article>
          </div>
        </div></section>
        <section className="closing container"><div className="banner"><h2>Votre projet immobilier avance. Ne manquez pas la prochaine étape.</h2><p>Rejoignez dès maintenant notre groupe WhatsApp d'accueil pour poursuivre votre parcours.</p><Whatsapp /></div></section>
      </main>
      <footer className="footer"><div className="container"><span>© 2026 IMMO DIASPO RENTIER · CAP.AFRIK / CAP.225</span><nav aria-label="Liens légaux"><LegalLink href={CONFIG.legalUrl}>Mentions légales</LegalLink><LegalLink href={CONFIG.privacyUrl}>Confidentialité</LegalLink></nav></div></footer>
    </div>
  );
}

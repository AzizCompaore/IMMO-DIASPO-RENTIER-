import { Link, useLocation } from "react-router-dom";
import { CONFIG } from "../config";
import VideoEmbed from "../components/VideoEmbed";
import { LegalLink } from "../components/LegalLinks";
import "../styles/landing.css";

const Icon = ({ id, className = "ico" }: { id: string; className?: string }) => <svg className={className} aria-hidden="true"><use href={`#${id}`} /></svg>;

function Cta({ small = false }: { small?: boolean }) {
  const { search } = useLocation(); // conserve les paramètres UTM jusqu'au questionnaire
  return (
    <Link className={`btn${small ? " btn-small" : ""}`} to={CONFIG.questionnairePath + search}>
      Vérifier mon éligibilité <Icon id="i-arrow" className="" />
    </Link>
  );
}
const Fine = () => <p className="fine">Gratuit · Quelques minutes · Sans engagement</p>;

export default function Landing() {
  return (
    <div className="lp">
      <svg aria-hidden="true" style={{ position: "absolute", width: 0, height: 0, overflow: "hidden" }} xmlns="http://www.w3.org/2000/svg">
        <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></symbol>
        <symbol id="i-plane" viewBox="0 0 24 24"><path d="m3 21 7-8-7-3 2-2 9 2 6-6c2-2 4 0 2 2l-6 6 2 9-2 2-3-7-8 7z" fill="none" stroke="currentColor" strokeLinejoin="round" /></symbol>
        <symbol id="i-coins" viewBox="0 0 24 24"><ellipse cx="8" cy="6" rx="6" ry="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M2 6v8c0 2 3 3 6 3m-6-7c0 2 3 3 6 3m4-5v-2m-4 7v4" fill="none" stroke="currentColor" strokeWidth="1.7" /><ellipse cx="16" cy="14" rx="6" ry="3" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M10 14v5c0 2 3 3 6 3s6-1 6-3v-5m-12 4c0 2 3 3 6 3s6-1 6-3" fill="none" stroke="currentColor" strokeWidth="1.7" /></symbol>
        <symbol id="i-house" viewBox="0 0 24 24"><path d="m2 11 10-8 10 8M5 10v11h14V10M10 21v-7h4v7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></symbol>
        <symbol id="i-check" viewBox="0 0 24 24"><rect x="4" y="3" width="16" height="19" rx="2" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 9h8m-8 4 2 2 5-5" fill="none" stroke="currentColor" strokeWidth="1.7" /></symbol>
        <symbol id="i-chat" viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-8 8 9 9 0 0 1-4-1l-5 2 2-5a8 8 0 1 1 15-4Z" fill="none" stroke="currentColor" strokeWidth="1.7" /><path d="M8 12h8m-8-4h6" fill="none" stroke="currentColor" strokeWidth="1.7" /></symbol>
        <symbol id="i-play" viewBox="0 0 24 24"><path d="m8 5 12 7-12 7z" /></symbol>
      </svg>

      <header className="header"><div className="wrap head-inner">
        <a className="brand" href="#accueil" aria-label="Retour en haut"><img className="brand-logo" src={CONFIG.logoUrl} alt="" /><span><span className="brand-name">URIEL GROUP</span><br /><span className="brand-sub">INVESTIR · BÂTIR · PÉRENNISER</span></span></a>
        <Cta small />
      </div></header>

      <main id="accueil">
        <section className="hero"><div className="wrap hero-grid">
          <div>
            <div className="eyebrow">IMMO DIASPO RENTIER</div>
            <h1>Devenez propriétaire à Abidjan, <span className="accent">où que vous soyez.</span></h1>
            <p className="hero-lead">Financez votre prochain investissement immobilier à Abidjan grâce à <strong>IMMO DIASPO RENTIER</strong>, une solution de financement dédiée aux membres de la diaspora.</p>
            <div className="benefits">
              <div className="benefit"><Icon id="i-plane" /><span>Depuis votre pays de résidence</span></div>
              <div className="benefit"><Icon id="i-coins" /><span>Solutions de financement adaptées à votre profil</span></div>
              <div className="benefit"><Icon id="i-house" /><span>Pour construire votre patrimoine locatif</span></div>
            </div>
            <Cta /><Fine />
          </div>
          <div className="video-frame">
            {CONFIG.videoUrl ? (
              <div className="video-embed"><VideoEmbed url={CONFIG.videoUrl} title="Présentation IMMO DIASPO RENTIER" fallback={null} /></div>
            ) : (
              <div className="video-poster" role="img" aria-label="Vidéo de présentation à venir">
                <span className="video-tag">IMMO DIASPO RENTIER<br />ABIDJAN · CÔTE D'IVOIRE</span>
                <span className="play"><Icon id="i-play" className="" /></span>
                <span className="video-caption">Découvrez comment commencer votre projet immobilier depuis la diaspora.</span>
              </div>
            )}
            <div className="video-action"><Cta /><Fine /></div>
          </div>
        </div></section>

        <section className="promise"><div className="wrap promise-grid">
          <div><div className="eyebrow">VOTRE PROJET, NOTRE EXPERTISE</div><h2>Vous vivez à l'étranger ? Votre projet immobilier à Abidjan peut commencer dès aujourd'hui.</h2></div>
          <div>
            <p>Vous percevez vos revenus à l'étranger et souhaitez investir dans l'immobilier en Côte d'Ivoire ?</p>
            <p><strong>IMMO DIASPO RENTIER</strong> vous permet d'explorer les solutions de financement adaptées à votre profil, afin de concrétiser votre projet d'acquisition et de construire progressivement votre <strong>patrimoine immobilier locatif à Abidjan.</strong></p>
            <p className="highlight">Première étape : vérifiez votre éligibilité au financement.</p>
            <div className="section-action"><Cta /></div>
          </div>
        </div></section>

        <section className="steps"><div className="wrap">
          <div className="eyebrow">VOTRE PARCOURS EN 3 ÉTAPES</div>
          <h2>Une démarche simple et accompagnée</h2>
          <div className="steps-grid">
            <article className="step"><div className="step-top"><Icon id="i-check" /><span className="step-number">01</span></div><h3>Vérifiez votre éligibilité</h3><p>Répondez à quelques questions sur votre situation professionnelle, vos revenus et votre projet immobilier.</p></article>
            <article className="step"><div className="step-top"><Icon id="i-chat" /><span className="step-number">02</span></div><h3>Échangez avec un conseiller financier</h3><p>Bénéficiez d'un entretien individuel pour analyser votre situation et évaluer la faisabilité de votre projet.</p></article>
            <article className="step"><div className="step-top"><Icon id="i-house" /><span className="step-number">03</span></div><h3>Étudiez votre solution de financement</h3><p>Identifiez les possibilités de financement adaptées à votre profil et les prochaines étapes pour réaliser votre investissement.</p></article>
          </div>
          <div className="section-action"><Cta /></div>
        </div></section>

        <section className="cta-band" id="eligibilite"><div className="wrap cta-grid">
          <div><div className="eyebrow">VOTRE PROJET IMMOBILIER COMMENCE ICI</div><h2>Et si votre prochain investissement immobilier commençait aujourd'hui ?</h2></div>
          <div className="cta-action"><Cta /><p>Vérification gratuite, indicative et sans engagement. L'obtention d'un financement reste soumise à l'accord des établissements partenaires.</p></div>
        </div></section>
      </main>

      <footer className="footer"><div className="wrap foot-inner">
        <div><div className="brand-name">IMMO DIASPO RENTIER</div><p>Une solution destinée aux membres de la diaspora souhaitant investir en Côte d'Ivoire.</p><p>© 2026 CAP.AFRIK / CAP.225 · Tous droits réservés.</p></div>
        <nav className="foot-links" aria-label="Informations légales">
          <LegalLink href={CONFIG.legalUrl}>Mentions légales</LegalLink>
          <LegalLink href={CONFIG.privacyUrl}>Politique de confidentialité</LegalLink>
          <LegalLink href={CONFIG.termsUrl}>Conditions d'utilisation</LegalLink>
        </nav>
      </div></footer>
    </div>
  );
}

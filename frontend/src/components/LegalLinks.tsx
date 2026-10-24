import { CONFIG } from "../config";

/** Lien légal configurable ; tant que l'URL n'est pas fournie, il reste inactif et le signale. */
export function LegalLink({ href, children }: { href: string; children: string }) {
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>
    : <a href="#" aria-disabled="true" title="Lien à venir" onClick={(e) => e.preventDefault()}>{children}</a>;
}
export const legalUrls = { legal: CONFIG.legalUrl, privacy: CONFIG.privacyUrl, terms: CONFIG.termsUrl };

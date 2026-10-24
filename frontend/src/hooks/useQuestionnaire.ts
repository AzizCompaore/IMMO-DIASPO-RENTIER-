import { useCallback, useEffect, useRef, useState } from "react";
import { CONFIG } from "../config";
import { ApiError } from "../services/api";
import * as api from "../services/questionnaireApi";
import type { Answers } from "../services/questionnaireApi";
import { STEP_FIELDS } from "../questionnaireSchema";
import { validateStep } from "../validation";

// Le jeton de reprise ne protège qu'un formulaire anonyme ; il reste dans localStorage pour permettre la reprise
// après fermeture du navigateur. Il est supprimé dès la soumission. Il n'ouvre aucun accès à l'administration.
const KEY = "idr_session";
const UTM = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"];
export type SaveState = "idle" | "saving" | "saved" | "error";

const pick = (a: Answers, step: number) => Object.fromEntries(STEP_FIELDS[step].filter((f) => f in a).map((f) => [f, a[f]]));

export function useQuestionnaire(search: string, onSubmitted: () => void) {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [answers, setAnswers] = useState<Answers>({});
  const [step, setStep] = useState(0);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [previewComplete, setPreviewComplete] = useState(false);
  const sess = useRef<{ id: string; token: string } | null>(null);
  const timer = useRef<number>();
  const latest = useRef({ answers, step });
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  latest.current = { answers, step };

  const init = useCallback(async () => {
    setLoadError(""); setReady(false);
    setPreviewComplete(false); setError(""); setFieldErrors({}); setSaveState("idle");
    if (CONFIG.demoMode) {
      sess.current = null;
      setAnswers({}); setStep(0); setReady(true);
      return;
    }
    try {
      const stored = JSON.parse(localStorage.getItem(KEY) ?? "null");
      if (stored?.id && stored?.token) {
        try {
          const s = await api.getSession(stored.id, stored.token);
          sess.current = stored; setAnswers(s.answers); setStep(Math.min(s.current_step, 3));
          api.sendStepViewed(stored.id, stored.token, Math.min(s.current_step, 3));
          setReady(true); return;
        } catch (e) {
          if (!(e instanceof ApiError) || e.isNetwork || e.status >= 500) throw e;
          localStorage.removeItem(KEY); // session invalide, soumise ou expirée : on repart de zéro
        }
      }
      const params = new URLSearchParams(search);
      const utm = Object.fromEntries(UTM.filter((k) => params.get(k)).map((k) => [k, params.get(k)!]));
      const s = await api.createSession(utm);
      sess.current = { id: s.id, token: s.token! };
      localStorage.setItem(KEY, JSON.stringify(sess.current));
      setAnswers({}); setStep(0); setReady(true);
    } catch (e) {
      setLoadError(e instanceof ApiError ? e.message : "Impossible de démarrer le questionnaire.");
    }
  }, [search]);

  useEffect(() => { init(); return () => window.clearTimeout(timer.current); }, [init]);

  // Les envois sont sérialisés pour ne jamais se doubler ni arriver dans le désordre.
  const enqueue = <T,>(fn: () => Promise<T>) => { const p = chain.current.then(fn, fn); chain.current = p.catch(() => undefined); return p; };

  const autosave = useCallback(() => {
    window.clearTimeout(timer.current);
    if (CONFIG.demoMode) return;
    timer.current = window.setTimeout(() => {
      const s = sess.current; if (!s) return;
      const { answers: a, step: st } = latest.current;
      setSaveState("saving");
      enqueue(() => api.saveStep(s.id, s.token, st, pick(a, st), false))
        .then(() => setSaveState("saved"))
        .catch(() => setSaveState("error")); // jamais « enregistré » en cas d'échec
    }, 800);
  }, []);

  const setAnswer = (field: string, value: string | boolean) => {
    setAnswers((a) => ({ ...a, [field]: value }));
    setFieldErrors((e) => { const { [field]: _, ...rest } = e; return rest; });
    setError(""); autosave();
  };

  const completeCurrent = async () => {
    if (CONFIG.demoMode) return;
    const s = sess.current!; window.clearTimeout(timer.current);
    const { answers: a, step: st } = latest.current;
    setSaveState("saving");
    try { await enqueue(() => api.saveStep(s.id, s.token, st, pick(a, st), true)); setSaveState("saved"); }
    catch (e) { setSaveState("error"); throw e; }
  };

  const goBack = () => {
    if (step > 0) {
      window.clearTimeout(timer.current); setStep(step - 1); setError(""); setFieldErrors({});
      if (!CONFIG.demoMode && sess.current) api.sendStepViewed(sess.current.id, sess.current.token, step - 1);
    }
  };

  const goNext = async () => {
    const errs = validateStep(step, answers);
    if (CONFIG.demoMode) {
      delete errs.consent;
      if (Object.keys(errs).length) { setFieldErrors(errs); setError("Merci de compléter les réponses de cette étape pour continuer l’aperçu."); return; }
      if (step < 3) { setStep(step + 1); setFieldErrors({}); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else setPreviewComplete(true);
      return;
    }
    if (Object.keys(errs).length) { setFieldErrors(errs); setError("Merci de compléter toutes les réponses de cette étape."); return; }
    setBusy(true); setError("");
    try {
      await completeCurrent();
      if (step < 3) { const n = step + 1; setStep(n); setFieldErrors({}); api.sendStepViewed(sess.current!.id, sess.current!.token, n); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else {
        await api.submitSession(sess.current!.id, sess.current!.token);
        localStorage.removeItem(KEY); sessionStorage.setItem("idr_submitted", "1"); onSubmitted();
      }
    } catch (e) {
      if (e instanceof ApiError) { setError(e.message); if (Object.keys(e.errors).length) setFieldErrors(e.errors as Record<string, string>); }
      else setError("Une erreur est survenue. Réessayez.");
    } finally { setBusy(false); }
  };

  return { ready, loadError, retry: init, answers, setAnswer, step, goBack, goNext, saveState, error, fieldErrors, busy, previewComplete };
}

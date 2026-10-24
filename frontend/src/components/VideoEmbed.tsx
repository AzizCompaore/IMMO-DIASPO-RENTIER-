import { useEffect, useRef, useState, type ReactNode } from "react";

/** Intègre une vidéo YouTube/Vimeo (iframe) ou un MP4 direct ; affiche `fallback` si l'URL est absente ou invalide. */
export default function VideoEmbed({ url, title, fallback }: { url: string; title: string; fallback: ReactNode }) {
  const slotRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [inView, setInView] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const slot = slotRef.current;
    if (!slot) return;
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting));
    observer.observe(slot);
    return () => observer.disconnect();
  }, []);

  const isLocalVideo = /^\/[^?#]+\.mp4(?:[?#].*)?$/i.test(url);
  let parsed: URL | null = null;
  if (!isLocalVideo) {
    try { parsed = url ? new URL(url) : null; } catch { parsed = null; }
  }
  const isRemoteVideo = !!parsed && /^https?:$/.test(parsed.protocol) && /\.mp4$/i.test(parsed.pathname);
  const isVideo = isLocalVideo || isRemoteVideo;
  const floating = isVideo && playing && !inView && !dismissed;
  const src = isLocalVideo ? url : parsed?.href;

  return (
    <div ref={slotRef} className="video-player-slot">
      <div className={`video-player-surface${floating ? " is-floating" : ""}`}>
        {isVideo ? (
          <video ref={videoRef} src={src} controls playsInline preload="metadata" title={title}
            onPlay={() => { setPlaying(true); setDismissed(false); }}
            onPause={() => setPlaying(false)}
            onEnded={() => setPlaying(false)} />
        ) : parsed && /^https?:$/.test(parsed.protocol) ? (
          <iframe src={parsed.href} title={title} loading="lazy" allowFullScreen
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" />
        ) : fallback}
        {floating && <button className="video-player-close" type="button" aria-label="Arrêter la vidéo flottante"
          onClick={() => { setDismissed(true); videoRef.current?.pause(); }}>×</button>}
      </div>
    </div>
  );
}

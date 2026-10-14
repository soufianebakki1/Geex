import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

const VIDEO_SRC = "/media/konouz-film.mp4";
const POSTER_SRC = "/media/konouz-film-poster.jpg";

const prefersReducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export default function LoginBackdrop({ caption }) {
  const videoRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    // Autoplay policies require the muted property, not only the attribute.
    video.muted = true;
    video.defaultMuted = true;
    if (!prefersReducedMotion()) video.play().catch(() => setPlaying(false));
  }, []);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) video.play().catch(() => setPlaying(false));
    else video.pause();
  }

  return (
    <div className="login-backdrop">
      <video
        ref={videoRef}
        className={`login-backdrop__video ${ready ? "is-ready" : ""}`}
        src={VIDEO_SRC}
        poster={POSTER_SRC}
        muted
        loop
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        tabIndex={-1}
        onPlaying={() => {
          setReady(true);
          setPlaying(true);
        }}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(event) => {
          const { currentTime, duration } = event.currentTarget;
          if (duration) setProgress(currentTime / duration);
        }}
      />
      <div className="login-backdrop__scrim" aria-hidden="true" />

      <div className="login-backdrop__reel">
        <button type="button" className="login-backdrop__toggle" onClick={toggle} aria-label={playing ? "Mettre la vidéo en pause" : "Lire la vidéo"}>
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <div className="login-backdrop__track" aria-hidden="true">
          <span className="login-backdrop__progress" style={{ transform: `scaleX(${progress})` }} />
        </div>
        {caption && <p className="login-backdrop__caption">{caption}</p>}
      </div>
    </div>
  );
}

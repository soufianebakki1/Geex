import { useEffect, useRef } from "react";
import { useNow } from "../hooks/useNow.js";
import { countdownTone, remainingParts } from "./Countdown.jsx";

const SIZE = 84;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const pad = (value) => String(value).padStart(2, "0");

/** Circular countdown: the ring empties as the validity window runs out. */
export default function CountdownRing({ from, to, onExpire }) {
  const now = useNow(1000);
  const end = new Date(to).getTime();
  const total = end - new Date(from).getTime();
  const left = end - now;
  const ratio = total > 0 ? Math.min(1, Math.max(0, left / total)) : 0;
  const tone = countdownTone(left);
  const fired = useRef(false);

  useEffect(() => {
    if (left <= 0 && !fired.current) {
      fired.current = true;
      onExpire?.();
    }
  }, [left, onExpire]);

  const { days, hours, minutes, seconds } = remainingParts(left);
  const [main, sub] = tone === "expired" ? ["—", "expirée"] : days > 0 ? [`${days} j`, `${pad(hours)} h ${pad(minutes)}`] : [`${pad(hours)}:${pad(minutes)}`, `${pad(seconds)} s`];

  return (
    <div className={`countdown-ring countdown-ring--${tone}`} role="timer" aria-label={tone === "expired" ? "Délai expiré" : `Expire dans ${days} jours ${hours} heures ${minutes} minutes`}>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} aria-hidden="true">
        <circle className="countdown-ring__track" cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} strokeWidth={STROKE} />
        <circle
          className="countdown-ring__value"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - ratio)}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>
      <span className="countdown-ring__text">
        <span className="countdown-ring__main num">{main}</span>
        <span className="countdown-ring__sub num">{sub}</span>
      </span>
    </div>
  );
}

import { useEffect, useRef } from "react";
import { useNow } from "../hooks/useNow.js";

const pad = (value) => String(value).padStart(2, "0");

export function remainingParts(ms) {
  const total = Math.max(0, ms);
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total % 86_400_000) / 3_600_000),
    minutes: Math.floor((total % 3_600_000) / 60_000),
    seconds: Math.floor((total % 60_000) / 1000),
  };
}

export function countdownTone(ms) {
  if (ms <= 0) return "expired";
  if (ms < 6 * 3_600_000) return "danger";
  if (ms < 24 * 3_600_000) return "warning";
  return "ok";
}

export default function Countdown({ to, onExpire, compact = false }) {
  const now = useNow(1000);
  const ms = new Date(to).getTime() - now;
  const expired = ms <= 0;
  const fired = useRef(false);

  useEffect(() => {
    if (expired && !fired.current) {
      fired.current = true;
      onExpire?.();
    }
  }, [expired, onExpire]);

  const { days, hours, minutes, seconds } = remainingParts(ms);
  const tone = countdownTone(ms);

  if (compact) {
    return (
      <span className={`countdown-inline countdown-inline--${tone} num`}>
        {expired ? "Expirée" : days > 0 ? `${days} j ${pad(hours)} h` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
      </span>
    );
  }

  if (expired) {
    return <div className="countdown countdown--expired">Délai expiré</div>;
  }

  const units = [
    [days, "jours"],
    [hours, "heures"],
    [minutes, "min"],
    [seconds, "sec"],
  ];

  return (
    <div className={`countdown countdown--${tone}`} role="timer" aria-label={`Expire dans ${days} jours ${hours} heures ${minutes} minutes`}>
      {units.map(([value, label]) => (
        <div key={label} className="countdown__unit">
          <span className="countdown__value num">{pad(value)}</span>
          <span className="countdown__label">{label}</span>
        </div>
      ))}
    </div>
  );
}

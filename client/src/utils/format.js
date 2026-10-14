const numberFormat = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });
const dateFormat = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
const longDateFormat = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function formatNumber(value) {
  return value == null || Number.isNaN(Number(value)) ? "—" : numberFormat.format(value);
}

export function formatMAD(value) {
  return value == null ? "—" : `${numberFormat.format(value)} MAD`;
}

export function formatCompactMAD(value) {
  if (value == null) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toLocaleString("fr-FR", { maximumFractionDigits: 2 })} M MAD`;
  if (abs >= 10_000) return `${Math.round(value / 1_000).toLocaleString("fr-FR")} k MAD`;
  return formatMAD(value);
}

export function formatDate(value) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

export function formatLongDate(value) {
  return value ? longDateFormat.format(new Date(value)) : "—";
}

export function formatDateTime(value) {
  return value ? dateTimeFormat.format(new Date(value)) : "—";
}

export function formatFileSize(bytes) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / (1024 * 1024)).toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Mo`;
}

export function timeAgo(value) {
  if (!value) return "—";
  const diff = Date.now() - new Date(value).getTime();
  const future = diff < 0;
  const minutes = Math.round(Math.abs(diff) / 60_000);
  const say = (text) => (future ? `dans ${text}` : `il y a ${text}`);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return say(`${minutes} min`);
  const hours = Math.round(minutes / 60);
  if (hours < 24) return say(`${hours} h`);
  const days = Math.round(hours / 24);
  if (days === 1) return future ? "demain" : "hier";
  if (days < 30) return say(`${days} j`);
  return formatDate(value);
}

export function daysUntil(value) {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(value);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - start) / 86_400_000);
}

export function initials(name = "") {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function percent(part, total) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}

export function toDateInput(value) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 10);
}

export function toDateTimeInput(value) {
  const date = value ? new Date(value) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

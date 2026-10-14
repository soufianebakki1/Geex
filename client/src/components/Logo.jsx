export default function Logo({ tone = "light", compact = false }) {
  const ink = tone === "light" ? "#fff" : "#241810";
  return (
    <span className="logo" style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <svg width="34" height="34" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill={tone === "light" ? "rgba(250,174,28,0.12)" : "#241810"} />
        <path d="M22 16v32M22 34l18-18M29 28l15 20" stroke="#faae1c" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
      {!compact && (
        <span style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span style={{ fontFamily: "var(--font-display)", fontSize: 19, fontWeight: 600, letterSpacing: "0.06em", color: ink }}>KONOUZ</span>
          <span style={{ marginTop: 4, fontSize: 9.5, fontWeight: 600, letterSpacing: "0.32em", color: "#c5a059" }}>IMMOBILIER</span>
        </span>
      )}
    </span>
  );
}

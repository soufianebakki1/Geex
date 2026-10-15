import logoOnLight from "../assets/brand/konouz-logo.svg";
import logoOnDark from "../assets/brand/konouz-logo-light.svg";

export default function Logo({ tone = "light", size = 64 }) {
  return (
    <img
      className="logo"
      src={tone === "light" ? logoOnDark : logoOnLight}
      alt="Konouz Immobilier"
      height={size}
      style={{ display: "block", height: size, width: "auto" }}
    />
  );
}

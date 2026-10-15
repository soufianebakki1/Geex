import { Link } from "react-router-dom";

export default function StatCard({ icon: Icon, label, value, hint, chip, hero = false, to }) {
  const className = ["stat", hero && "stat--hero", to && "stat--link"].filter(Boolean).join(" ");
  const content = (
    <>
      <div className="stat__top">
        <span className="stat__icon">
          <Icon size={18} />
        </span>
        {chip && <span className={`dash-pill dash-pill--${chip.tone}`}>{chip.label}</span>}
      </div>
      <p className="stat__label">{label}</p>
      <div className="stat__figure">
        <p className="stat__value">{value}</p>
        {hint && <p className="stat__hint">{hint}</p>}
      </div>
    </>
  );

  return to ? (
    <Link to={to} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

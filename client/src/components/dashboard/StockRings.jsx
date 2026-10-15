import { LOT_STATUSES } from "../../utils/status.js";
import { percent } from "../../utils/format.js";

const SIZE = 220;
const STROKE = 12;
const GAP = 5;
const SWEEP = 0.75;
const PILL_TONE = { disponible: "up", pre_reserve: "gold", reserve: "info", vendu: "brand", bloque: "neutral" };

export default function StockRings({ projects }) {
  const total = projects.reduce((sum, project) => sum + project.stock.total, 0);
  const statuses = LOT_STATUSES.map((status) => ({
    ...status,
    count: projects.reduce((sum, project) => sum + (project.stock[status.value] ?? 0), 0),
  })).filter((status) => status.value !== "bloque" || status.count > 0);
  const available = statuses.find((status) => status.value === "disponible")?.count ?? 0;
  const center = SIZE / 2;

  return (
    <div className="rings">
      <div className="rings__figure">
        <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="rings__chart" role="img" aria-label={statuses.map((status) => `${status.label} : ${status.count}`).join(", ")}>
          {statuses.map((status, index) => {
            const radius = center - STROKE / 2 - index * (STROKE + GAP);
            const circumference = 2 * Math.PI * radius;
            const track = circumference * SWEEP;
            const length = total ? (track * status.count) / total : 0;
            return (
              <g key={status.value}>
                <circle className="rings__track" cx={center} cy={center} r={radius} strokeWidth={STROKE} strokeDasharray={`${track} ${circumference}`} />
                {length > 0 && (
                  <circle
                    className="rings__value"
                    cx={center}
                    cy={center}
                    r={radius}
                    strokeWidth={STROKE}
                    stroke={status.color}
                    strokeDasharray={`${length} ${circumference}`}
                    style={{ "--ring-length": length, animationDelay: `${index * 90}ms` }}
                  />
                )}
              </g>
            );
          })}
        </svg>
        <div className="rings__summary">
          <p className="rings__total num">{total}</p>
          <p className="rings__caption">lots au total</p>
          <span className="dash-pill dash-pill--up">{percent(available, total)} % libres</span>
        </div>
      </div>

      <ul className="rings__legend">
        {statuses.map((status) => (
          <li key={status.value}>
            <span className="rings__swatch" style={{ background: status.color }} />
            <span className="grow">{status.label}</span>
            <span className="rings__count num">{status.count}</span>
            <span className={`dash-pill dash-pill--${PILL_TONE[status.value]}`}>{percent(status.count, total)} %</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

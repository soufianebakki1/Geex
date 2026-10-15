import { Link } from "react-router-dom";
import { PROJECT_TYPE } from "../../utils/status.js";

const PALETTE = [
  { fill: "#3d2b1f", ink: "#fff" },
  { fill: "#faae1c", ink: "#241810" },
  { fill: "#c5a059", ink: "#241810" },
  { fill: "#6f5545", ink: "#fff" },
  { fill: "#fbbf47", ink: "#241810" },
];
/** Bubble centres, in % of the cluster box, from largest to smallest programme. */
const SPOTS = [
  [50, 50],
  [25, 36],
  [74, 64],
  [30, 76],
  [77, 26],
];
const MIN_SIZE = 54;
const MAX_SIZE = 112;

const commercialised = (stock) => stock.pre_reserve + stock.reserve + stock.vendu;

export default function ProgramBubbles({ projects }) {
  const ranked = [...projects].sort((a, b) => b.stock.total - a.stock.total);
  const largest = Math.max(...ranked.map((project) => project.stock.total), 1);

  return (
    <div className="bubbles">
      <div className="bubbles__cluster" aria-hidden="true">
        {ranked.slice(0, SPOTS.length).map((project, index) => {
          const size = MIN_SIZE + (MAX_SIZE - MIN_SIZE) * Math.sqrt(project.stock.total / largest);
          const [left, top] = SPOTS[index];
          const { fill, ink } = PALETTE[index];
          return (
            <span
              key={project.id}
              className="bubbles__bubble num"
              style={{ left: `${left}%`, top: `${top}%`, width: size, background: fill, color: ink, animationDelay: `${index * 80}ms`, zIndex: SPOTS.length - index }}
            >
              {project.stock.disponible}
            </span>
          );
        })}
      </div>

      <ul className="bubbles__list">
        {ranked.map((project, index) => (
          <li key={project.id}>
            <Link to={`/lots?projectId=${project.id}`} className="bubbles__row">
              <span className="bubbles__name">
                <span className="bubbles__swatch" style={{ background: PALETTE[index % PALETTE.length].fill }} />
                <span className="truncate">{project.name}</span>
                <span className="bubbles__count num">
                  {project.stock.disponible}/{project.stock.total}
                </span>
              </span>
              <span className="bubbles__meta">
                {[PROJECT_TYPE[project.type]?.label, project.city].filter(Boolean).join(" · ")}
              </span>
              <span className="bubbles__track">
                <span style={{ width: `${project.stock.total ? (commercialised(project.stock) / project.stock.total) * 100 : 0}%`, background: PALETTE[index % PALETTE.length].fill }} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

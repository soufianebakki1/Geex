import { useState } from "react";
import { percent } from "../../utils/format.js";

const TICKS = 4;
const TIP_CEILING = 58;

function busiestStage(stages) {
  return stages.reduce((best, stage, index) => (stage.current > stages[best].current ? index : best), 0);
}

export function PipelineLegend() {
  return (
    <div className="pipeline-legend" aria-hidden="true">
      <span>
        <i className="pipeline-dot pipeline-dot--reached" />
        Ont atteint l'étape
      </span>
      <span>
        <i className="pipeline-dot pipeline-dot--current" />
        Actuellement
      </span>
    </div>
  );
}

export default function PipelineChart({ stages }) {
  const [active, setActive] = useState(() => busiestStage(stages));
  const step = Math.max(1, Math.ceil(Math.max(...stages.map((stage) => stage.count), 1) / TICKS));
  const max = step * TICKS;
  const ticks = Array.from({ length: TICKS + 1 }, (_, index) => max - index * step);
  const height = (value) => `${(value / max) * 100}%`;

  return (
    <div className="pipeline">
      <div className="pipeline__axis" aria-hidden="true">
        {ticks.map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>

      <div className="pipeline__plot">
        <div className="pipeline__grid" aria-hidden="true">
          {ticks.map((tick) => (
            <span key={tick} />
          ))}
        </div>

        <ol className="pipeline__groups">
          {stages.map((stage, index) => {
            const previous = stages[index - 1];
            const edge = index < 2 ? "start" : index > stages.length - 3 ? "end" : "center";
            return (
              <li
                key={stage.stage}
                className={`pipeline__group${index === active ? " is-active" : ""}`}
                tabIndex={0}
                onMouseEnter={() => setActive(index)}
                onFocus={() => setActive(index)}
                aria-label={`${stage.label} : ${stage.count} leads ont atteint l'étape, ${stage.current} actuellement`}
              >
                <div className="pipeline__bars">
                  <span className="pipeline__bar pipeline__bar--reached" style={{ height: height(stage.count) }} />
                  <span className="pipeline__bar pipeline__bar--current" style={{ height: height(stage.current) }} />
                  {index === active && (
                    <div className={`pipeline__tip pipeline__tip--${edge}`} style={{ bottom: `calc(${Math.min((stage.count / max) * 100, TIP_CEILING)}% + 12px)` }} aria-hidden="true">
                      <span>
                        <i className="pipeline-dot pipeline-dot--reached" />
                        <b className="num">{stage.count}</b> ont atteint
                      </span>
                      <span>
                        <i className="pipeline-dot pipeline-dot--current" />
                        <b className="num">{stage.current}</b> actuellement
                      </span>
                      {previous && <span className="pipeline__tip-rate num">{percent(stage.count, previous.count)} % de passage</span>}
                    </div>
                  )}
                </div>
                <span className="pipeline__label">{stage.label}</span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

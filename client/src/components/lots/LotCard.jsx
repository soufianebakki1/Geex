import { ArrowUpRight, Car, Layers, Lock, MapPin } from "lucide-react";
import { Avatar } from "../ui.jsx";
import { formatMAD, formatNumber } from "../../utils/format.js";
import { LOT_STATUS, LOT_TYPE } from "../../utils/status.js";

const HOLDER_LABEL = {
  pre_reserve: "Pré-réservé pour",
  reserve: "Réservé par",
  vendu: "Acquéreur",
};

const FOOT_HINT = {
  disponible: "Disponible à la vente",
  bloque: "Retiré de la vente",
};

function Apartment({ floor }) {
  const lit = 4 - Math.max(0, Math.min(4, floor ?? 0));
  return (
    <>
      <path d="M40 88V14h60v74" />
      <path d="M36 14h68" />
      <path d="M62 14V8h16v6" />
      {[0, 1, 2, 3, 4].map((row) =>
        [0, 1, 2].map((col) => (
          <rect key={`${row}-${col}`} x={48 + col * 16} y={20 + row * 13} width="10" height="8" rx="1" className={row === lit ? "lot-art__lit" : undefined} />
        )),
      )}
      <path d="M112 88V70h14v18" />
      <path d="M116 76h6M116 81h6" />
    </>
  );
}

function Duplex() {
  return (
    <>
      <path d="M38 88V34h64v54" />
      <path d="M30 36 70 10l40 26" />
      <path d="M38 60h64" />
      <rect x="48" y="40" width="14" height="12" rx="1" className="lot-art__lit" />
      <rect x="78" y="40" width="14" height="12" rx="1" className="lot-art__lit" />
      <rect x="48" y="66" width="14" height="12" rx="1" />
      <path d="M78 88V68h14v20" />
      <path d="M112 88V74l8-6 8 6v14" />
    </>
  );
}

function Villa() {
  return (
    <>
      <path d="M28 88V50h76v38" />
      <path d="M20 52 66 24l46 28" />
      <rect x="38" y="60" width="16" height="12" rx="1" className="lot-art__lit" />
      <rect x="78" y="60" width="16" height="12" rx="1" className="lot-art__lit" />
      <path d="M59 88V64h14v24" />
      <path d="M124 88c-1-16-1-30 3-44" />
      <path d="M127 44c-8-5-15-4-20 1M127 44c7-6 14-6 19-2M127 44c-3-7-9-10-15-10M127 44c4-6 10-8 15-6" />
    </>
  );
}

function Terrain() {
  return (
    <>
      <path d="M14 74 54 56l74 8-36 22Z" strokeDasharray="4 4" />
      <path d="M30 80l6-3M108 76l5 3" />
      <path d="M72 56c-9-10-13-17-13-23a13 13 0 0 1 26 0c0 6-4 13-13 23Z" />
      <circle cx="72" cy="33" r="5" className="lot-art__lit" />
    </>
  );
}

function Commerce() {
  return (
    <>
      <path d="M30 88V36h80v52" />
      <path d="M26 36h88l-4-12H30Z" />
      <path d="M26 36c0 6 11 6 11 0 0 6 11 6 11 0 0 6 11 6 11 0 0 6 11 6 11 0 0 6 11 6 11 0 0 6 11 6 11 0 0 6 11 6 11 0 0 6 11 6 11 0" />
      <rect x="46" y="10" width="48" height="10" rx="2" />
      <rect x="38" y="50" width="40" height="28" rx="1" className="lot-art__lit" />
      <path d="M86 88V50h16v38" />
    </>
  );
}

const ART = { f2: Apartment, f3: Apartment, f4: Apartment, duplex: Duplex, villa: Villa, lot: Terrain, commerce: Commerce };

function LotArt({ type, floor }) {
  const Drawing = ART[type] ?? Apartment;
  return (
    <svg className="lot-art" viewBox="0 0 150 92" aria-hidden="true">
      <path d="M4 88h142" className="lot-art__ground" />
      <Drawing floor={floor} />
    </svg>
  );
}

export default function LotCard({ lot, where, floor, onOpen }) {
  const status = LOT_STATUS[lot.status];

  return (
    <button type="button" className={`lot-card lot-card--${lot.status}`} onClick={onOpen}>
      <div className="lot-card__scene">
        <span className="lot-card__status">
          {lot.status === "bloque" ? <Lock size={11} /> : <span className="lot-card__dot" />}
          {status?.label ?? lot.status}
        </span>
        <span className="lot-card__type">{LOT_TYPE[lot.type]?.label ?? lot.type}</span>
        <LotArt type={lot.type} floor={lot.floor} />
        <span className="lot-card__ref">{lot.ref}</span>
        {lot.status === "vendu" && <span className="lot-card__stamp">Vendu</span>}
      </div>

      <div className="lot-card__body">
        <div className="lot-card__figures">
          <span className="lot-card__surface num">
            {formatNumber(lot.surface)}
            <small>m²</small>
          </span>
          <span className="lot-card__price">
            <strong className="num">{formatMAD(lot.price)}</strong>
            <small className="num">{formatMAD(Math.round(lot.price / lot.surface))} / m²</small>
          </span>
        </div>

        {where && (
          <p className="lot-card__where">
            <MapPin size={13} />
            <span className="truncate">{where}</span>
          </p>
        )}

        {(floor || lot.parking) && (
          <div className="lot-card__chips">
            {floor && (
              <span className="lot-chip">
                <Layers size={12} />
                {floor}
              </span>
            )}
            {lot.parking && (
              <span className="lot-chip">
                <Car size={12} />
                Parking
              </span>
            )}
          </div>
        )}

        <div className="lot-card__foot">
          {lot.holder ? (
            <span className="lot-card__holder">
              <Avatar name={lot.holder.name} size="sm" />
              <span className="lot-card__holder-text">
                <small>{HOLDER_LABEL[lot.status] ?? "Client"}</small>
                <span className="truncate">{lot.holder.name}</span>
              </span>
            </span>
          ) : (
            <span className="lot-card__hint">{FOOT_HINT[lot.status] ?? "Voir le détail"}</span>
          )}
          <span className="lot-card__go" aria-hidden="true">
            <ArrowUpRight size={15} />
          </span>
        </div>
      </div>
    </button>
  );
}

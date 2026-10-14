import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LayoutGrid, Lock, LockOpen, Timer } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import { Button, EmptyState, ErrorState, Modal, PageHeader, SearchInput, Skeleton, StatusBadge } from "../components/ui.jsx";
import { formatMAD, formatNumber } from "../utils/format.js";
import { LOT_STATUS, LOT_STATUSES, LOT_TYPES } from "../utils/status.js";

const SORTS = {
  ref: (a, b) => a.ref.localeCompare(b.ref, "fr", { numeric: true }),
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  surface: (a, b) => b.surface - a.surface,
};

const floorLabel = (floor) => (floor == null ? null : floor === 0 ? "RDC" : `${floor}${floor === 1 ? "er" : "e"} étage`);

function LotDetail({ lot, user, onClose, onChanged }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!lot) return null;

  async function toggleBlock() {
    setBusy(true);
    try {
      const updated = await api.lots.update(lot.id, { status: lot.status === "bloque" ? "disponible" : "bloque" });
      onChanged(updated);
      toast.success(updated.status === "bloque" ? `Lot ${lot.ref} bloqué.` : `Lot ${lot.ref} remis en vente.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const canBlock = can(user, "catalog.write") && ["disponible", "bloque"].includes(lot.status);
  const canPreReserve = can(user, "preReservations.write") && lot.status === "disponible";

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={`Lot ${lot.ref}`}
      subtitle={`${lot.project?.name} · ${lot.project?.city}`}
      footer={
        <>
          {canBlock && (
            <Button variant={lot.status === "bloque" ? "secondary" : "danger-ghost"} icon={lot.status === "bloque" ? LockOpen : Lock} onClick={toggleBlock} loading={busy}>
              {lot.status === "bloque" ? "Débloquer" : "Bloquer le lot"}
            </Button>
          )}
          {canPreReserve && (
            <Button variant="primary" icon={Timer} onClick={() => navigate(`/pre-reservations?lotId=${lot.id}`)}>
              Pré-réserver
            </Button>
          )}
        </>
      }
    >
      <div className="lot-detail">
        <div className="lot-detail__price">
          <span className="display num">{formatMAD(lot.price)}</span>
          <StatusBadge map={LOT_STATUS} value={lot.status} />
        </div>
        <dl className="dl">
          <dt>Type</dt>
          <dd>{lot.type}</dd>
          <dt>Surface</dt>
          <dd className="num">{formatNumber(lot.surface)} m²</dd>
          <dt>Pièces</dt>
          <dd>{lot.rooms}</dd>
          {floorLabel(lot.floor) && (
            <>
              <dt>Niveau</dt>
              <dd>{floorLabel(lot.floor)}</dd>
            </>
          )}
          <dt>Prix au m²</dt>
          <dd className="num">{formatMAD(Math.round(lot.price / lot.surface))}</dd>
          {lot.holder && (
            <>
              <dt>Client</dt>
              <dd>
                {can(user, "leads") ? (
                  <Link to={`/leads/${lot.holder.leadId}`} className="link">
                    {lot.holder.name}
                  </Link>
                ) : (
                  lot.holder.name
                )}
                {lot.holder.reservationId && can(user, "reservations") && (
                  <>
                    {" · "}
                    <Link to={`/reservations/${lot.holder.reservationId}`} className="link">
                      réservation
                    </Link>
                  </>
                )}
              </dd>
            </>
          )}
        </dl>
      </div>
    </Modal>
  );
}

export default function LotsPage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("projectId") ?? "";
  const status = params.get("status") ?? "";
  const [type, setType] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("ref");
  const [selectedId, setSelectedId] = useState(null);
  const projects = useAsync(() => api.projects.list(), []);
  const lots = useAsync(() => api.lots.list({ projectId }), [projectId]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lots.data ?? []).filter((lot) => (!type || lot.type === type) && (!q || lot.ref.toLowerCase().includes(q)));
  }, [lots.data, type, query]);

  const counts = useMemo(() => Object.fromEntries(LOT_STATUSES.map((item) => [item.value, base.filter((lot) => lot.status === item.value).length])), [base]);
  const visible = useMemo(() => base.filter((lot) => !status || lot.status === status).sort(SORTS[sort]), [base, status, sort]);
  const selected = lots.data?.find((lot) => lot.id === selectedId) ?? null;
  const currentProject = projects.data?.find((project) => project.id === projectId);

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title={currentProject ? `Lots — ${currentProject.name}` : "Lots"}
        description="Grille des biens et disponibilité en temps réel. Cliquez sur un lot pour le détail et les actions."
      />

      <div className="toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Référence du lot…" />
        <select className="select" value={projectId} onChange={(event) => setParam("projectId", event.target.value)} aria-label="Projet">
          <option value="">Tous les projets</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select className="select" value={type} onChange={(event) => setType(event.target.value)} aria-label="Type de bien">
          <option value="">Tous les types</option>
          {LOT_TYPES.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Trier">
          <option value="ref">Tri : référence</option>
          <option value="priceAsc">Prix croissant</option>
          <option value="priceDesc">Prix décroissant</option>
          <option value="surface">Surface décroissante</option>
        </select>
      </div>

      <div className="status-filter" role="group" aria-label="Filtrer par disponibilité">
        <button type="button" className={`status-filter__item ${!status ? "is-active" : ""}`} onClick={() => setParam("status", "")}>
          Tous <span className="num">{base.length}</span>
        </button>
        {LOT_STATUSES.map((item) => (
          <button
            key={item.value}
            type="button"
            className={`status-filter__item ${status === item.value ? "is-active" : ""}`}
            onClick={() => setParam("status", status === item.value ? "" : item.value)}
            aria-pressed={status === item.value}
          >
            <span className="legend-dot" style={{ background: item.color }} />
            {item.label} <span className="num">{counts[item.value]}</span>
          </button>
        ))}
      </div>

      {lots.loading && !lots.data ? (
        <div className="lot-grid">
          {Array.from({ length: 12 }, (_, index) => (
            <Skeleton key={index} height={150} />
          ))}
        </div>
      ) : lots.error && !lots.data ? (
        <div className="card">
          <ErrorState error={lots.error} onRetry={lots.reload} />
        </div>
      ) : visible.length === 0 ? (
        <div className="card">
          <EmptyState icon={LayoutGrid} title="Aucun lot ne correspond" description="Modifiez les filtres pour élargir la recherche." />
        </div>
      ) : (
        <div className="lot-grid">
          {visible.map((lot) => (
            <button key={lot.id} type="button" className={`lot-tile lot-tile--${lot.status}`} onClick={() => setSelectedId(lot.id)}>
              <div className="row-between">
                <span className="lot-tile__ref">{lot.ref}</span>
                <StatusBadge map={LOT_STATUS} value={lot.status} dot={false} />
              </div>
              <p className="lot-tile__type">
                {lot.type} · {lot.rooms} p.{floorLabel(lot.floor) ? ` · ${floorLabel(lot.floor)}` : ""}
              </p>
              <div className="lot-tile__figures">
                <span className="lot-tile__surface num">
                  {formatNumber(lot.surface)}
                  <small> m²</small>
                </span>
                <span className="lot-tile__price num">{formatMAD(lot.price)}</span>
              </div>
              {!projectId && <p className="lot-tile__project truncate">{lot.project?.name}</p>}
              {lot.holder && <p className="lot-tile__holder truncate">{lot.holder.name}</p>}
            </button>
          ))}
        </div>
      )}

      {selected && (
        <LotDetail
          lot={selected}
          user={user}
          onClose={() => setSelectedId(null)}
          onChanged={(updated) => lots.setData((items) => items.map((item) => (item.id === updated.id ? updated : item)))}
        />
      )}
    </>
  );
}

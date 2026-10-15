import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LayoutGrid, Lock, LockOpen, Pencil, Plus, Timer } from "lucide-react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import LotCard from "../components/lots/LotCard.jsx";
import { Button, EmptyState, ErrorState, Field, FormError, Modal, PageHeader, Pagination, SearchInput, Skeleton, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatMAD, formatNumber } from "../utils/format.js";
import { LOT_STATUS, LOT_STATUSES, LOT_TYPE, LOT_TYPES } from "../utils/status.js";

const SORTS = {
  ref: (a, b) => a.ref.localeCompare(b.ref, "fr", { numeric: true }),
  priceAsc: (a, b) => a.price - b.price,
  priceDesc: (a, b) => b.price - a.price,
  surface: (a, b) => b.surface - a.surface,
};

const floorLabel = (floor) => (floor == null ? null : floor === 0 ? "RDC" : floor < 0 ? `Sous-sol ${-floor}` : `${floor}${floor === 1 ? "er" : "e"} étage`);
const typeLabel = (type) => LOT_TYPE[type]?.label ?? type;
const locationLabel = (lot) => [lot.tranche?.name, lot.building?.name].filter(Boolean).join(" · ");

const EMPTY_LOT = { projectId: "", trancheId: "", buildingId: "", ref: "", type: "f3", floor: "", surface: "", price: "", parking: false };

function LotForm({ open, lot, projects, defaultProjectId, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_LOT);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const structure = useAsync(() => (open && form.projectId ? api.projects.get(form.projectId) : Promise.resolve(null)), [open, form.projectId]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      lot
        ? { projectId: lot.projectId, trancheId: lot.trancheId ?? "", buildingId: lot.buildingId ?? "", ref: lot.ref, type: lot.type, floor: lot.floor ?? "", surface: lot.surface, price: lot.price, parking: Boolean(lot.parking) }
        : { ...EMPTY_LOT, projectId: defaultProjectId ?? "" },
    );
  }, [open, lot, defaultProjectId]);

  const tranches = structure.data?.tranches ?? [];
  const buildings = tranches.find((tranche) => tranche.id === form.trancheId)?.buildings ?? [];
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      trancheId: form.trancheId,
      buildingId: form.buildingId || null,
      ref: form.ref.trim(),
      type: form.type,
      floor: form.floor === "" ? null : Number(form.floor),
      surface: Number(form.surface),
      price: Number(form.price),
      parking: form.parking,
    };
    try {
      const saved = lot ? await api.lots.update(lot.id, payload) : await api.lots.create({ ...payload, projectId: form.projectId });
      onSaved(saved, Boolean(lot));
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      size="lg"
      title={lot ? `Modifier le lot ${lot.ref}` : "Nouveau lot"}
      subtitle={lot ? lot.project?.name : "Ajout au stock d'un projet"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="lot-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="lot-form" className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Projet" required>
            {(id) => (
              <select id={id} className="select" value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value, trancheId: "", buildingId: "" }))} required disabled={Boolean(lot)}>
                <option value="">Sélectionner…</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Numéro du lot" required>
            {(id) => <input id={id} className="input" value={form.ref} onChange={set("ref")} placeholder="A-305" required />}
          </Field>
          <Field label="Tranche" required hint={form.projectId && !structure.loading && !tranches.length ? "Créez d'abord une tranche depuis la page Projets." : undefined}>
            {(id) => (
              <select id={id} className="select" value={form.trancheId} onChange={(event) => setForm((prev) => ({ ...prev, trancheId: event.target.value, buildingId: "" }))} required disabled={!tranches.length}>
                <option value="">{structure.loading ? "Chargement…" : "Sélectionner…"}</option>
                {tranches.map((tranche) => (
                  <option key={tranche.id} value={tranche.id}>
                    {tranche.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Immeuble" hint="Facultatif (villas, terrains)">
            {(id) => (
              <select id={id} className="select" value={form.buildingId} onChange={set("buildingId")} disabled={!buildings.length}>
                <option value="">Aucun</option>
                {buildings.map((building) => (
                  <option key={building.id} value={building.id}>
                    {building.name} ({building.floors} étages)
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Type de lot" required>
            {(id) => (
              <select id={id} className="select" value={form.type} onChange={set("type")}>
                {LOT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Étage" hint="0 = rez-de-chaussée">
            {(id) => <input id={id} className="input" type="number" step="1" value={form.floor} onChange={set("floor")} />}
          </Field>
          <Field label="Superficie" required>
            {(id) => (
              <div className="input-affix">
                <input id={id} className="input" type="number" min="1" step="any" value={form.surface} onChange={set("surface")} required />
                <span className="input-affix__suffix">m²</span>
              </div>
            )}
          </Field>
          <Field label="Prix de vente officiel" required>
            {(id) => (
              <div className="input-affix">
                <input id={id} className="input" type="number" min="1" step="any" value={form.price} onChange={set("price")} required />
                <span className="input-affix__suffix">MAD</span>
              </div>
            )}
          </Field>
          <label className="check span-2">
            <input type="checkbox" checked={form.parking} onChange={(event) => setForm((prev) => ({ ...prev, parking: event.target.checked }))} />
            <span>Parking inclus</span>
          </label>
        </div>
        <FormError error={error ?? structure.error} />
      </form>
    </Modal>
  );
}

function LotHistory({ lotId }) {
  const history = useAsync(() => api.lots.history(lotId), [lotId]);
  if (history.loading && !history.data) return <Skeleton height={60} />;
  if (!history.data?.length) return <p className="small muted">Aucun changement de statut enregistré.</p>;
  return (
    <ul className="history-list">
      {history.data.map((entry) => (
        <li key={entry.id}>
          <span className="history-list__dot" />
          <div className="grow">
            <div>
              {entry.from ? `${LOT_STATUS[entry.from]?.label ?? entry.from} → ` : ""}
              <strong>{LOT_STATUS[entry.to]?.label ?? entry.to}</strong>
              {entry.reason && <span className="muted"> — {entry.reason}</span>}
            </div>
            <div className="xsmall faint">
              {formatDateTime(entry.at)} · {entry.user?.name ?? "Système"}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

function LotDetail({ lot, user, onClose, onChanged, onEdit }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState(null);

  async function changeStatus(status) {
    setBusy(true);
    setError(null);
    try {
      const updated = await api.lots.update(lot.id, { status, reason: reason.trim() });
      onChanged(updated);
      setBlocking(false);
      setReason("");
      toast.success(updated.status === "bloque" ? `Lot ${lot.ref} bloqué.` : `Lot ${lot.ref} remis en vente.`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  const canWrite = can(user, "catalog.write") && ["disponible", "bloque"].includes(lot.status);
  const canPreReserve = can(user, "preReservations.write") && lot.status === "disponible";

  return (
    <Modal
      open
      onClose={onClose}
      busy={busy}
      title={`Lot ${lot.ref}`}
      subtitle={`${lot.project?.name}${locationLabel(lot) ? ` · ${locationLabel(lot)}` : ""}`}
      footer={
        blocking ? (
          <>
            <Button variant="ghost" onClick={() => setBlocking(false)} disabled={busy}>
              Annuler
            </Button>
            <Button variant="danger" icon={Lock} onClick={() => changeStatus("bloque")} loading={busy}>
              Confirmer le blocage
            </Button>
          </>
        ) : (
          <>
            {canWrite && (
              <Button variant="ghost" icon={Pencil} onClick={() => onEdit(lot)}>
                Modifier
              </Button>
            )}
            {canWrite &&
              (lot.status === "bloque" ? (
                <Button icon={LockOpen} onClick={() => changeStatus("disponible")} loading={busy}>
                  Débloquer
                </Button>
              ) : (
                <Button variant="danger-ghost" icon={Lock} onClick={() => setBlocking(true)}>
                  Bloquer le lot
                </Button>
              ))}
            {canPreReserve && (
              <Button variant="primary" icon={Timer} onClick={() => navigate(`/pre-reservations?lotId=${lot.id}`)}>
                Pré-réserver
              </Button>
            )}
          </>
        )
      }
    >
      <div className="lot-detail">
        <div className="lot-detail__price">
          <span className="display num">{formatMAD(lot.price)}</span>
          <StatusBadge map={LOT_STATUS} value={lot.status} />
        </div>
        {blocking && (
          <Field label="Raison du blocage" required>
            {(id) => <textarea id={id} className="textarea" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Réserve technique, lot réservé au syndic…" data-autofocus />}
          </Field>
        )}
        <FormError error={error} />
        <dl className="dl">
          <dt>Type</dt>
          <dd>{typeLabel(lot.type)}</dd>
          <dt>Superficie</dt>
          <dd className="num">{formatNumber(lot.surface)} m²</dd>
          {lot.tranche && (
            <>
              <dt>Tranche</dt>
              <dd>{lot.tranche.name}</dd>
            </>
          )}
          {lot.building && (
            <>
              <dt>Immeuble</dt>
              <dd>{lot.building.name}</dd>
            </>
          )}
          {floorLabel(lot.floor) && (
            <>
              <dt>Étage</dt>
              <dd>{floorLabel(lot.floor)}</dd>
            </>
          )}
          <dt>Parking</dt>
          <dd>{lot.parking ? "Inclus" : "Non inclus"}</dd>
          <dt>Prix au m²</dt>
          <dd className="num">{formatMAD(Math.round(lot.price / lot.surface))}</dd>
          <dt>Ajouté au stock</dt>
          <dd>{formatDate(lot.createdAt)}</dd>
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
        <div>
          <p className="section-title">Historique du statut</p>
          <LotHistory lotId={lot.id} key={lot.status} />
        </div>
      </div>
    </Modal>
  );
}

const PAGE_SIZE = 50;

export default function LotsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [params, setParams] = useSearchParams();
  const projectId = params.get("projectId") ?? "";
  const status = params.get("status") ?? "";
  const [type, setType] = useState("");
  const [trancheId, setTrancheId] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("ref");
  const [selectedId, setSelectedId] = useState(null);
  const [editing, setEditing] = useState(null);
  const [page, setPage] = useState(1);
  const gridTop = useRef(null);
  const projects = useAsync(() => api.projects.list(), []);
  const lots = useAsync(() => api.lots.list({ projectId }), [projectId]);
  const canWrite = can(user, "catalog.write");

  useEffect(() => setTrancheId(""), [projectId]);

  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const tranches = useMemo(() => {
    const seen = new Map();
    (lots.data ?? []).forEach((lot) => lot.tranche && seen.set(lot.tranche.id, lot.tranche.name));
    return [...seen].map(([id, name]) => ({ id, name }));
  }, [lots.data]);

  const base = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (lots.data ?? []).filter((lot) => (!type || lot.type === type) && (!trancheId || lot.trancheId === trancheId) && (!q || lot.ref.toLowerCase().includes(q)));
  }, [lots.data, type, trancheId, query]);

  const counts = useMemo(() => Object.fromEntries(LOT_STATUSES.map((item) => [item.value, base.filter((lot) => lot.status === item.value).length])), [base]);
  const visible = useMemo(() => base.filter((lot) => !status || lot.status === status).sort(SORTS[sort]), [base, status, sort]);
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = visible.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [projectId, status, type, trancheId, query, sort]);

  function goToPage(next) {
    setPage(next);
    gridTop.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  const selected = lots.data?.find((lot) => lot.id === selectedId) ?? null;
  const currentProject = projects.data?.find((project) => project.id === projectId);
  const upsert = (saved) => lots.setData((items) => (items.some((item) => item.id === saved.id) ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved]));

  return (
    <>
      <PageHeader
        title={currentProject ? `Lots — ${currentProject.name}` : "Lots"}
        actions={
          canWrite && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>
              Nouveau lot
            </Button>
          )
        }
      />

      <div className="toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Numéro du lot…" />
        <select className="select" value={projectId} onChange={(event) => setParam("projectId", event.target.value)} aria-label="Projet">
          <option value="">Tous les projets</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {projectId && tranches.length > 1 && (
          <select className="select" value={trancheId} onChange={(event) => setTrancheId(event.target.value)} aria-label="Tranche">
            <option value="">Toutes les tranches</option>
            {tranches.map((tranche) => (
              <option key={tranche.id} value={tranche.id}>
                {tranche.name}
              </option>
            ))}
          </select>
        )}
        <select className="select" value={type} onChange={(event) => setType(event.target.value)} aria-label="Type de lot">
          <option value="">Tous les types</option>
          {LOT_TYPES.map((item) => (
            <option key={item.value} value={item.value}>
              {item.label}
            </option>
          ))}
        </select>
        <select className="select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Trier">
          <option value="ref">Tri : numéro</option>
          <option value="priceAsc">Prix croissant</option>
          <option value="priceDesc">Prix décroissant</option>
          <option value="surface">Superficie décroissante</option>
        </select>
      </div>

      <div className="status-filter" role="group" aria-label="Filtrer par disponibilité" ref={gridTop}>
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
            <Skeleton key={index} height={290} />
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
        <>
          <div className="lot-grid">
            {pageItems.map((lot) => (
              <LotCard
                key={lot.id}
                lot={lot}
                where={projectId ? locationLabel(lot) : [lot.project?.name, lot.tranche?.name].filter(Boolean).join(" · ")}
                floor={floorLabel(lot.floor)}
                onOpen={() => setSelectedId(lot.id)}
              />
            ))}
          </div>
          <Pagination page={currentPage} pageSize={PAGE_SIZE} total={visible.length} onChange={goToPage} />
        </>
      )}

      {selected && !editing && (
        <LotDetail
          lot={selected}
          user={user}
          onClose={() => setSelectedId(null)}
          onChanged={upsert}
          onEdit={(lot) => setEditing(lot)}
        />
      )}

      <LotForm
        open={Boolean(editing)}
        lot={editing?.id ? editing : null}
        projects={projects.data ?? []}
        defaultProjectId={projectId}
        onClose={() => setEditing(null)}
        onSaved={(saved, updated) => {
          upsert(saved);
          setEditing(null);
          toast.success(updated ? `Lot ${saved.ref} mis à jour.` : `Lot ${saved.ref} ajouté au stock.`);
          if (!updated && projectId && saved.projectId !== projectId) setParam("projectId", saved.projectId);
        }}
      />
    </>
  );
}

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building, Building2, CalendarDays, FileText, HardHat, Landmark, Layers, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import { Badge, Button, EmptyState, ErrorState, Field, FormError, LoadingBlock, Modal, PageHeader, Skeleton } from "../components/ui.jsx";
import { formatCompactMAD, formatDate, toDateInput } from "../utils/format.js";
import { CONSISTANCE_OPTIONS, LOT_STATUSES, PROJECT_TYPE, PROJECT_TYPES } from "../utils/status.js";

const EMPTY = { name: "", type: "residence", promoterId: "", managerId: "", address: "", consistance: [], tfMere: "", deliveryDate: "", active: true };
const consistanceLabel = (values = []) =>
  CONSISTANCE_OPTIONS.filter((option) => values.includes(option.value))
    .map((option) => option.label)
    .join(", ");

function ProjectForm({ open, project, onClose, onSaved }) {
  const promoters = useAsync(() => (open ? api.promoters.list() : Promise.resolve(null)), [open]);
  const managers = useAsync(() => (open ? api.managers.list() : Promise.resolve(null)), [open]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(project ? { ...EMPTY, ...project, deliveryDate: toDateInput(project.deliveryDate) } : EMPTY);
  }, [open, project]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));
  const toggleConsistance = (value) =>
    setForm((prev) => ({ ...prev, consistance: prev.consistance.includes(value) ? prev.consistance.filter((item) => item !== value) : [...prev.consistance, value] }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      type: form.type,
      promoterId: form.promoterId,
      managerId: form.managerId,
      address: form.address.trim(),
      consistance: form.consistance,
      tfMere: form.tfMere.trim(),
      deliveryDate: form.deliveryDate,
      active: form.active,
    };
    try {
      const saved = project ? await api.projects.update(project.id, payload) : await api.projects.create(payload);
      onSaved(saved, Boolean(project));
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
      title={project ? `Modifier — ${project.name}` : "Nouveau projet"}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="project-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="project-form" className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Nom du projet" required>
            {(id) => <input id={id} className="input" value={form.name} onChange={set("name")} required />}
          </Field>
          <Field label="Type de projet" required>
            {(id) => (
              <select id={id} className="select" value={form.type} onChange={set("type")}>
                {PROJECT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Promoteur" required>
            {(id) => (
              <select id={id} className="select" value={form.promoterId} onChange={set("promoterId")} required disabled={!promoters.data}>
                <option value="">{promoters.data ? "Sélectionner…" : "Chargement…"}</option>
                {(promoters.data ?? []).map((promoter) => (
                  <option key={promoter.id} value={promoter.id}>
                    {promoter.company}
                    {promoter.group ? ` — ${promoter.group}` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Chef de projet" required>
            {(id) => (
              <select id={id} className="select" value={form.managerId} onChange={set("managerId")} required disabled={!managers.data}>
                <option value="">{managers.data ? "Sélectionner…" : "Chargement…"}</option>
                {(managers.data ?? []).map((manager) => (
                  <option key={manager.id} value={manager.id}>
                    {manager.name}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Adresse" required className="span-2">
            {(id) => <input id={id} className="input" value={form.address} onChange={set("address")} placeholder="Avenue, quartier, ville" required />}
          </Field>
          <Field label="Consistance" required className="span-2" hint="Typologies proposées dans le projet">
            {() => (
              <div className="row wrap" role="group" aria-label="Consistance" style={{ gap: 6 }}>
                {CONSISTANCE_OPTIONS.map((option) => (
                  <button key={option.value} type="button" className={`chip ${form.consistance.includes(option.value) ? "is-active" : ""}`} aria-pressed={form.consistance.includes(option.value)} onClick={() => toggleConsistance(option.value)}>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="TF mère" hint="Titre foncier mère">
            {(id) => <input id={id} className="input" value={form.tfMere} onChange={set("tfMere")} placeholder="TF 12345/C" />}
          </Field>
          <Field label="Date prévue de livraison" required>
            {(id) => <input id={id} className="input" type="date" value={form.deliveryDate} onChange={set("deliveryDate")} required />}
          </Field>
          {project && (
            <label className="check span-2">
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((prev) => ({ ...prev, active: event.target.checked }))} />
              <span>Projet en cours de commercialisation</span>
            </label>
          )}
        </div>
        <FormError error={error ?? promoters.error ?? managers.error} />
      </form>
    </Modal>
  );
}

function InlineAdd({ label, fields, onSubmit }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onSubmit(values);
      setValues({});
      setOpen(false);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button size="sm" variant="ghost" icon={Plus} onClick={() => setOpen(true)}>
        {label}
      </Button>
    );
  }
  return (
    <form className="structure__add" onSubmit={submit}>
      {fields.map((field) => (
        <input
          key={field.name}
          className="input"
          type={field.type ?? "text"}
          min={field.min}
          placeholder={field.placeholder}
          aria-label={field.placeholder}
          value={values[field.name] ?? ""}
          onChange={(event) => setValues((prev) => ({ ...prev, [field.name]: event.target.value }))}
          required={field.required}
          style={field.width ? { width: field.width } : undefined}
        />
      ))}
      <Button size="sm" variant="primary" type="submit" loading={busy}>
        Ajouter
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setOpen(false)} disabled={busy}>
        Annuler
      </Button>
      <FormError error={error} />
    </form>
  );
}

function StructureModal({ projectId, canEdit, onClose, onChanged }) {
  const toast = useToast();
  const detail = useAsync(() => api.projects.get(projectId), [projectId]);
  const project = detail.data;

  const apply = (saved) => {
    detail.setData(saved);
    onChanged(saved);
  };
  const remove = async (action) => {
    try {
      apply(await action());
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <Modal open onClose={onClose} size="lg" title={project ? `Structure — ${project.name}` : "Structure du projet"} subtitle="Tranches, immeubles et nombre de lots rattachés">
      {detail.loading && !project ? (
        <LoadingBlock rows={3} />
      ) : detail.error && !project ? (
        <ErrorState error={detail.error} onRetry={detail.reload} compact />
      ) : (
        <div className="stack">
          {project.tranches.length === 0 && <p className="muted small">Aucune tranche : ajoutez-en une pour y rattacher des immeubles et des lots.</p>}
          {project.tranches.map((tranche) => (
            <section key={tranche.id} className="structure">
              <header className="structure__head">
                <Layers size={16} />
                <div className="grow">
                  <p className="strong">{tranche.name}</p>
                  {tranche.description && <p className="xsmall muted">{tranche.description}</p>}
                </div>
                <span className="xsmall muted num">{tranche.lotCount} lot(s)</span>
                {canEdit && tranche.lotCount === 0 && (
                  <Button size="sm" variant="danger-ghost" iconOnly icon={Trash2} aria-label={`Supprimer ${tranche.name}`} title="Supprimer la tranche" onClick={() => remove(() => api.projects.removeTranche(tranche.id))} />
                )}
              </header>
              <ul className="structure__list">
                {tranche.buildings.map((building) => (
                  <li key={building.id}>
                    <Building size={14} />
                    <span className="grow">
                      {building.name} <span className="muted">· {building.floors} étage(s)</span>
                    </span>
                    <span className="xsmall muted num">{building.lotCount} lot(s)</span>
                    {canEdit && building.lotCount === 0 && (
                      <Button size="sm" variant="danger-ghost" iconOnly icon={Trash2} aria-label={`Supprimer ${building.name}`} title="Supprimer l'immeuble" onClick={() => remove(() => api.projects.removeBuilding(building.id))} />
                    )}
                  </li>
                ))}
                {tranche.buildings.length === 0 && <li className="muted xsmall">Pas d'immeuble (villas, lots de terrain…)</li>}
              </ul>
              {canEdit && (
                <InlineAdd
                  label="Ajouter un immeuble"
                  fields={[
                    { name: "name", placeholder: "Nom de l'immeuble", required: true },
                    { name: "floors", placeholder: "Étages", type: "number", min: 0, required: true, width: 96 },
                  ]}
                  onSubmit={async (values) => {
                    apply(await api.projects.addBuilding(tranche.id, { name: values.name, floors: Number(values.floors) }));
                    toast.success("Immeuble ajouté.");
                  }}
                />
              )}
            </section>
          ))}
          {canEdit && project && (
            <InlineAdd
              label="Ajouter une tranche"
              fields={[
                { name: "name", placeholder: "Nom de la tranche", required: true },
                { name: "description", placeholder: "Description (optionnelle)" },
              ]}
              onSubmit={async (values) => {
                apply(await api.projects.addTranche(project.id, values));
                toast.success("Tranche ajoutée.");
              }}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function ProjectCard({ project, canEdit, onEdit, onStructure }) {
  const { stock } = project;
  const engaged = stock.pre_reserve + stock.reserve + stock.vendu;
  return (
    <article className="project-card">
      <header className="project-card__head">
        <div className="grow">
          <h2 className="project-card__name">{project.name}</h2>
          <p className="project-card__place">
            <MapPin size={13} />
            {project.address}
          </p>
        </div>
        <div className="stack-xs" style={{ alignItems: "flex-end" }}>
          <Badge tone="brand">{PROJECT_TYPE[project.type]?.label ?? project.type}</Badge>
          {!project.active && <Badge tone="neutral">Clôturé</Badge>}
        </div>
      </header>

      <div className="project-card__stock">
        <div className="row-between">
          <span className="small strong">Stock</span>
          <span className="xsmall muted num">
            {engaged} / {stock.total} lots engagés
          </span>
        </div>
        <div className="stock-bar stock-bar--lg">
          {LOT_STATUSES.map((status) =>
            stock[status.value] ? <span key={status.value} style={{ flexGrow: stock[status.value], background: status.color }} title={`${status.label} : ${stock[status.value]}`} /> : null,
          )}
        </div>
        <dl className="project-card__counts">
          {LOT_STATUSES.map((status) => (
            <div key={status.value}>
              <dt>
                <span className="legend-dot" style={{ background: status.color }} />
                {status.label}
              </dt>
              <dd className="num">{stock[status.value]}</dd>
            </div>
          ))}
        </dl>
      </div>

      <dl className="project-card__meta">
        <div>
          <dt>
            <Landmark size={13} /> Promoteur
          </dt>
          <dd>{project.promoter?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>
            <HardHat size={13} /> Chef de projet
          </dt>
          <dd>{project.manager?.name ?? "—"}</dd>
        </div>
        <div>
          <dt>
            <CalendarDays size={13} /> Livraison prévue
          </dt>
          <dd>{formatDate(project.deliveryDate)}</dd>
        </div>
        <div>
          <dt>
            <FileText size={13} /> TF mère
          </dt>
          <dd>{project.tfMere || "—"}</dd>
        </div>
        <div>
          <dt>Consistance</dt>
          <dd>{consistanceLabel(project.consistance) || "—"}</dd>
        </div>
        <div>
          <dt>Valeur disponible</dt>
          <dd className="num">{formatCompactMAD(stock.availableValue)}</dd>
        </div>
      </dl>

      <footer className="project-card__foot">
        {canEdit && (
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => onEdit(project)}>
            Modifier
          </Button>
        )}
        <Button size="sm" variant="ghost" icon={Layers} onClick={() => onStructure(project.id)}>
          {project.trancheCount} tranche{project.trancheCount > 1 ? "s" : ""}
        </Button>
        <Link to={`/lots?projectId=${project.id}`} className="btn btn--secondary btn--sm project-card__cta">
          Voir les {stock.total} lots
          <ArrowRight size={15} />
        </Link>
      </footer>
    </article>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const projects = useAsync(() => api.projects.list(), []);
  const [editing, setEditing] = useState(null);
  const [structureId, setStructureId] = useState(null);
  const canEdit = can(user, "catalog.write");

  const replace = (saved) => projects.setData((items) => items.map((item) => (item.id === saved.id ? { ...item, ...saved } : item)));

  const totals = (projects.data ?? []).reduce(
    (acc, project) => ({
      lots: acc.lots + project.stock.total,
      available: acc.available + project.stock.disponible,
      value: acc.value + project.stock.availableValue,
    }),
    { lots: 0, available: 0, value: 0 },
  );

  return (
    <>
      <PageHeader
        eyebrow="Catalogue"
        title="Projets"
        description="Programmes immobiliers, leur structure (tranches, immeubles) et l'état du stock."
        actions={
          canEdit && (
            <Button variant="primary" icon={Plus} onClick={() => setEditing({})}>
              Nouveau projet
            </Button>
          )
        }
      />

      {projects.data && projects.data.length > 0 && (
        <div className="stat-grid" style={{ marginBottom: 20 }}>
          <div className="stat">
            <p className="stat__label">Projets en cours</p>
            <p className="stat__value">{projects.data.filter((project) => project.active).length}</p>
          </div>
          <div className="stat">
            <p className="stat__label">Lots au total</p>
            <p className="stat__value">{totals.lots}</p>
          </div>
          <div className="stat">
            <p className="stat__label">Lots disponibles</p>
            <p className="stat__value">{totals.available}</p>
          </div>
          <div className="stat">
            <p className="stat__label">Valeur du stock disponible</p>
            <p className="stat__value">{formatCompactMAD(totals.value)}</p>
          </div>
        </div>
      )}

      {projects.loading && !projects.data ? (
        <div className="project-grid">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} height={360} />
          ))}
        </div>
      ) : projects.error && !projects.data ? (
        <div className="card">
          <ErrorState error={projects.error} onRetry={projects.reload} />
        </div>
      ) : projects.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={Building2} title="Aucun projet" description="Créez un premier projet pour y rattacher des tranches et des lots." />
        </div>
      ) : (
        <div className="project-grid">
          {projects.data.map((project) => (
            <ProjectCard key={project.id} project={project} canEdit={canEdit} onEdit={setEditing} onStructure={setStructureId} />
          ))}
        </div>
      )}

      <ProjectForm
        open={Boolean(editing)}
        project={editing?.id ? editing : null}
        onClose={() => setEditing(null)}
        onSaved={(saved, updated) => {
          projects.setData((items) => (updated ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved]));
          setEditing(null);
          toast.success(updated ? "Projet mis à jour." : "Projet créé.");
          if (!updated) setStructureId(saved.id);
        }}
      />

      {structureId && <StructureModal projectId={structureId} canEdit={canEdit} onClose={() => setStructureId(null)} onChanged={replace} />}
    </>
  );
}

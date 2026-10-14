import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CalendarDays, HardHat, Landmark, MapPin, Pencil, Plus } from "lucide-react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import { Button, EmptyState, ErrorState, Field, FormError, Modal, PageHeader, Skeleton, StatusBadge } from "../components/ui.jsx";
import { formatCompactMAD, formatDate, toDateInput } from "../utils/format.js";
import { LOT_STATUSES, PROJECT_STATUS, PROJECT_STATUSES, PROJECT_TYPES } from "../utils/status.js";

const EMPTY = { name: "", city: "", type: "Résidentiel", status: "en_commercialisation", promoterId: "", managerId: "", deliveryDate: "", description: "" };

function ProjectForm({ open, project, onClose, onSaved }) {
  const promoters = useAsync(() => (open ? api.promoters.list() : Promise.resolve(null)), [open]);
  const managers = useAsync(() => (open ? api.managers.list() : Promise.resolve(null)), [open]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(project ? { ...EMPTY, ...project, deliveryDate: toDateInput(project.deliveryDate), description: project.description ?? "" } : EMPTY);
  }, [open, project]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      name: form.name.trim(),
      city: form.city.trim(),
      type: form.type,
      status: form.status,
      promoterId: form.promoterId,
      managerId: form.managerId,
      deliveryDate: form.deliveryDate,
      description: form.description.trim(),
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
          <Field label="Nom du programme" required>
            {(id) => <input id={id} className="input" value={form.name} onChange={set("name")} required />}
          </Field>
          <Field label="Ville" required>
            {(id) => <input id={id} className="input" value={form.city} onChange={set("city")} required />}
          </Field>
          <Field label="Type">
            {(id) => (
              <select id={id} className="select" value={form.type} onChange={set("type")}>
                {PROJECT_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Statut">
            {(id) => (
              <select id={id} className="select" value={form.status} onChange={set("status")}>
                {PROJECT_STATUSES.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
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
                    {promoter.name}
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
          <Field label="Livraison prévue" required>
            {(id) => <input id={id} className="input" type="date" value={form.deliveryDate} onChange={set("deliveryDate")} required />}
          </Field>
          <Field label="Description" className="span-2">
            {(id) => <textarea id={id} className="textarea" value={form.description} onChange={set("description")} />}
          </Field>
        </div>
        <FormError error={error ?? promoters.error ?? managers.error} />
      </form>
    </Modal>
  );
}

function ProjectCard({ project, canEdit, onEdit }) {
  const { stock } = project;
  const engaged = stock.pre_reserve + stock.reserve + stock.vendu;
  return (
    <article className="project-card">
      <header className="project-card__head">
        <div className="grow">
          <h2 className="project-card__name">{project.name}</h2>
          <p className="project-card__place">
            <MapPin size={13} />
            {project.city} · {project.type}
          </p>
        </div>
        <StatusBadge map={PROJECT_STATUS} value={project.status} dot={false} />
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
            <CalendarDays size={13} /> Livraison
          </dt>
          <dd>{formatDate(project.deliveryDate)}</dd>
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
  const canEdit = can(user, "catalog.write");

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
        description="Programmes immobiliers et état du stock de chaque projet."
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
            <p className="stat__label">Programmes</p>
            <p className="stat__value">{projects.data.length}</p>
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
          <EmptyState icon={Building2} title="Aucun projet" description="Créez un premier programme pour y rattacher des lots." />
        </div>
      ) : (
        <div className="project-grid">
          {projects.data.map((project) => (
            <ProjectCard key={project.id} project={project} canEdit={canEdit} onEdit={setEditing} />
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
        }}
      />
    </>
  );
}

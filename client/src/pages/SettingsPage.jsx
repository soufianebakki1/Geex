import { useEffect, useMemo, useState } from "react";
import { Check, Megaphone, Pencil, Plus, RotateCcw, Trash2, UserPlus, UsersRound } from "lucide-react";
import { api } from "../api/index.js";
import { USE_MOCKS } from "../api/client.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { ACTIONS, AREAS, AREA_LABELS, ROLES, ROLE_LABEL } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import { Avatar, Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingBlock, Modal, PageHeader } from "../components/ui.jsx";

const ACTION_LABELS = {
  "leads.write": "Créer et modifier les leads",
  "leads.assign": "Affecter les leads aux commerciaux",
  "leads.close": "Marquer un lead livré ou clôturé",
  "catalog.write": "Gérer projets, tranches, immeubles et lots",
  "preReservations.write": "Poser des pré-réservations",
  "preReservations.extend": "Prolonger une pré-réservation",
  "dossiers.upload": "Téléverser les pièces",
  "dossiers.validate": "Valider ou rejeter les pièces",
  "reservations.confirm": "Créer et signer les réservations",
  "reservations.approveDiscount": "Approuver les remises",
  "reservations.close": "Désistement, résiliation, clôture",
  "payments.create": "Saisir des paiements",
  "payments.validate": "Valider les paiements",
  "promoters.write": "Gérer les promoteurs",
  "managers.write": "Gérer les chefs de projet",
  "sources.write": "Gérer les sources marketing",
  "users.manage": "Gérer les utilisateurs",
};

function SourcesCard() {
  const toast = useToast();
  const sources = useAsync(() => api.sources.list(), []);
  const [form, setForm] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState(null);

  const groups = useMemo(() => {
    const map = new Map();
    (sources.data ?? []).forEach((source) => map.set(source.category, [...(map.get(source.category) ?? []), source]));
    return [...map];
  }, [sources.data]);
  const categories = groups.map(([category]) => category);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = { category: form.category.trim(), name: form.name.trim() };
      if (form.id) {
        const updated = await api.sources.update(form.id, payload);
        sources.setData((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
      } else {
        const created = await api.sources.create(payload);
        sources.setData((items) => [...items, { ...created, leadCount: 0 }]);
      }
      toast.success("Source enregistrée.");
      setForm(null);
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    setDeleteBusy(true);
    setDeleteError(null);
    try {
      await api.sources.remove(deleting.id);
      sources.setData((items) => items.filter((item) => item.id !== deleting.id));
      toast.success("Source supprimée.");
      setDeleting(null);
    } catch (err) {
      setDeleteError(errorMessage(err));
    } finally {
      setDeleteBusy(false);
    }
  }

  return (
    <Card
      title="Sources marketing"
      subtitle="Canaux d'acquisition proposés à la saisie d'un lead, regroupés par catégorie."
      actions={
        <Button size="sm" icon={Plus} onClick={() => setForm({ category: "", name: "" })}>
          Ajouter une source
        </Button>
      }
      flush
    >
      {sources.loading && !sources.data ? (
        <div className="card__body">
          <LoadingBlock rows={3} />
        </div>
      ) : sources.error && !sources.data ? (
        <ErrorState error={sources.error} onRetry={sources.reload} />
      ) : groups.length === 0 ? (
        <EmptyState icon={Megaphone} title="Aucune source" />
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Catégorie</th>
                <th>Source</th>
                <th className="align-right">Leads</th>
                <th className="cell-actions">Actions</th>
              </tr>
            </thead>
            <tbody>
              {groups.flatMap(([category, items]) =>
                items.map((source, index) => (
                  <tr key={source.id}>
                    <td>{index === 0 ? <span className="cell-primary">{category}</span> : null}</td>
                    <td>{source.name}</td>
                    <td className="align-right num">{source.leadCount}</td>
                    <td className="cell-actions">
                      <div className="btn-group">
                        <Button size="sm" variant="ghost" iconOnly icon={Pencil} onClick={() => setForm(source)} aria-label={`Modifier ${source.name}`} title="Modifier" />
                        <Button
                          size="sm"
                          variant="danger-ghost"
                          iconOnly
                          icon={Trash2}
                          onClick={() => {
                            setDeleteError(null);
                            setDeleting(source);
                          }}
                          aria-label={`Supprimer ${source.name}`}
                          title="Supprimer"
                        />
                      </div>
                    </td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(form)}
        onClose={() => setForm(null)}
        busy={saving}
        size="sm"
        title={form?.id ? `Modifier — ${form.name}` : "Nouvelle source marketing"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setForm(null)} disabled={saving}>
              Annuler
            </Button>
            <Button variant="primary" type="submit" form="source-form" loading={saving}>
              Enregistrer
            </Button>
          </>
        }
      >
        <form id="source-form" className="stack" onSubmit={save}>
          <Field label="Catégorie" required hint="Choisissez une catégorie existante ou saisissez-en une nouvelle">
            {(id) => (
              <>
                <input id={id} className="input" list="source-categories" value={form?.category ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} required />
                <datalist id="source-categories">
                  {categories.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Nom de la source" required>
            {(id) => <input id={id} className="input" value={form?.name ?? ""} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} placeholder="Facebook, Panneaux…" required />}
          </Field>
          <FormError error={error} />
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={`Supprimer ${deleting?.name ?? ""} ?`}
        description="Une source déjà utilisée par des leads ne peut pas être supprimée."
        confirmLabel="Supprimer"
        tone="danger"
        busy={deleteBusy}
        error={deleteError}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </Card>
  );
}

function UserForm({ open, editing, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isEdit = Boolean(editing?.id);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      isEdit
        ? { lastName: editing.lastName ?? "", firstName: editing.firstName ?? "", email: editing.email, role: editing.role, phone: editing.phone ?? "" }
        : { lastName: "", firstName: "", email: "", role: "commercial", phone: "", password: "" },
    );
  }, [open, editing, isEdit]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const person = { lastName: form.lastName.trim(), firstName: form.firstName.trim(), phone: form.phone.trim() };
      const saved = isEdit ? await api.users.update(editing.id, { ...person, role: form.role }) : await api.users.create({ ...form, ...person, email: form.email.trim() });
      onSaved(saved, isEdit);
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
      title={isEdit ? `Modifier — ${editing.name}` : "Ajouter un utilisateur"}
      subtitle={isEdit ? undefined : "Transmettez le mot de passe provisoire à l'utilisateur par un canal sécurisé."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="user-form" loading={saving}>
            Enregistrer
          </Button>
        </>
      }
    >
      <form id="user-form" className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Nom" required>
            {(id) => <input id={id} className="input" value={form.lastName ?? ""} onChange={set("lastName")} required />}
          </Field>
          <Field label="Prénom" required>
            {(id) => <input id={id} className="input" value={form.firstName ?? ""} onChange={set("firstName")} required />}
          </Field>
          <Field label="Email" required hint={isEdit ? "L'email sert d'identifiant et ne peut pas être modifié." : undefined}>
            {(id) => <input id={id} className="input" type="email" value={form.email ?? ""} onChange={set("email")} required disabled={isEdit} />}
          </Field>
          <Field label="Téléphone">
            {(id) => <input id={id} className="input" type="tel" value={form.phone ?? ""} onChange={set("phone")} />}
          </Field>
          <Field label="Rôle" required>
            {(id) => (
              <select id={id} className="select" value={form.role ?? ""} onChange={set("role")}>
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>
                    {role.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {!isEdit && (
            <Field label="Mot de passe provisoire" required hint="8 caractères minimum">
              {(id) => <input id={id} className="input" type="text" value={form.password ?? ""} onChange={set("password")} required minLength={8} autoComplete="new-password" />}
            </Field>
          )}
        </div>
        <FormError error={error} />
      </form>
    </Modal>
  );
}

function PermissionMatrix() {
  const rows = [
    ...Object.entries(AREAS).map(([key, roles]) => ({ key, label: `Accès — ${AREA_LABELS[key]}`, roles })),
    ...Object.entries(ACTIONS).map(([key, roles]) => ({ key, label: ACTION_LABELS[key] ?? key, roles })),
  ];
  return (
    <div className="table-wrap">
      <table className="table matrix">
        <thead>
          <tr>
            <th>Permission</th>
            {ROLES.map((role) => (
              <th key={role.value} className="matrix__role">
                {role.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>
              <td>{row.label}</td>
              {ROLES.map((role) => (
                <td key={role.value} className="matrix__cell">
                  {row.roles.includes(role.value) ? <Check size={16} aria-label="Autorisé" /> : <span className="faint" aria-label="Non autorisé">—</span>}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SettingsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const users = useAsync(() => api.users.list(), []);
  const [editing, setEditing] = useState(null);
  const [toggling, setToggling] = useState(null);
  const [toggleBusy, setToggleBusy] = useState(false);
  const [toggleError, setToggleError] = useState(null);
  const [resetOpen, setResetOpen] = useState(false);

  async function toggleActive() {
    setToggleBusy(true);
    setToggleError(null);
    try {
      const updated = await api.users.update(toggling.id, { active: !toggling.active });
      users.setData((items) => items.map((item) => (item.id === updated.id ? updated : item)));
      toast.success(updated.active ? `${updated.name} est réactivé.` : `${updated.name} est désactivé.`);
      setToggling(null);
    } catch (error) {
      setToggleError(errorMessage(error));
    } finally {
      setToggleBusy(false);
    }
  }

  async function resetDemo() {
    const { resetMockData } = await import("../api/mock/server.js");
    resetMockData();
    window.location.assign("/");
  }

  return (
    <>
      <PageHeader
        title="Paramètres"
        actions={
          <Button variant="primary" icon={UserPlus} onClick={() => setEditing({})}>
            Ajouter un utilisateur
          </Button>
        }
      />

      <div className="stack">
        <Card title="Utilisateurs" subtitle="Un compte désactivé ne peut plus se connecter ; son historique est conservé." flush>
          {users.loading && !users.data ? (
            <div className="card__body">
              <LoadingBlock />
            </div>
          ) : users.error && !users.data ? (
            <ErrorState error={users.error} onRetry={users.reload} />
          ) : users.data.length === 0 ? (
            <EmptyState icon={UsersRound} title="Aucun utilisateur" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Utilisateur</th>
                    <th>Rôle</th>
                    <th>Téléphone</th>
                    <th>Statut</th>
                    <th className="cell-actions">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.data.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div className="row">
                          <Avatar name={item.name} />
                          <div>
                            <div className="cell-primary">
                              {item.name}
                              {item.id === user.id && <span className="faint xsmall"> (vous)</span>}
                            </div>
                            <div className="cell-secondary">{item.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={["admin", "direction"].includes(item.role) ? "brand" : "outline"}>{ROLE_LABEL[item.role]}</Badge>
                      </td>
                      <td>{item.phone || <span className="faint">—</span>}</td>
                      <td>{item.active ? <Badge tone="success" dot>Actif</Badge> : <Badge tone="neutral" dot>Désactivé</Badge>}</td>
                      <td className="cell-actions">
                        <div className="btn-group">
                          <Button size="sm" variant="ghost" iconOnly icon={Pencil} onClick={() => setEditing(item)} aria-label={`Modifier ${item.name}`} title="Modifier" />
                          <Button
                            size="sm"
                            variant={item.active ? "danger-ghost" : "secondary"}
                            disabled={item.id === user.id}
                            onClick={() => {
                              setToggleError(null);
                              setToggling(item);
                            }}
                          >
                            {item.active ? "Désactiver" : "Réactiver"}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <SourcesCard />

        <Card title="Rôles et permissions" subtitle="Droits appliqués par le serveur ; l'interface masque les actions non autorisées." flush>
          <PermissionMatrix />
        </Card>

        {USE_MOCKS && (
          <Card title="Données de démonstration" subtitle="Visible uniquement en développement, lorsque l'application fonctionne sans backend.">
            <div className="row-between wrap">
              <p className="small muted">Remet le jeu de données de démonstration dans son état initial (leads, lots, paiements…).</p>
              <Button icon={RotateCcw} onClick={() => setResetOpen(true)}>
                Réinitialiser
              </Button>
            </div>
          </Card>
        )}
      </div>

      <UserForm
        open={Boolean(editing)}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={(saved, updated) => {
          users.setData((items) => (updated ? items.map((item) => (item.id === saved.id ? saved : item)) : [...items, saved]));
          setEditing(null);
          toast.success(updated ? "Utilisateur mis à jour." : `${saved.name} a été ajouté.`);
        }}
      />

      <ConfirmDialog
        open={Boolean(toggling)}
        title={toggling?.active ? `Désactiver ${toggling?.name} ?` : `Réactiver ${toggling?.name} ?`}
        description={toggling?.active ? "Ses sessions en cours seront fermées et il ne pourra plus se connecter." : "Il pourra de nouveau se connecter avec ses identifiants."}
        confirmLabel={toggling?.active ? "Désactiver" : "Réactiver"}
        tone={toggling?.active ? "danger" : "primary"}
        busy={toggleBusy}
        error={toggleError}
        onClose={() => setToggling(null)}
        onConfirm={toggleActive}
      />

      <ConfirmDialog
        open={resetOpen}
        title="Réinitialiser les données de démonstration ?"
        description="Toutes les modifications effectuées en local seront perdues."
        confirmLabel="Réinitialiser"
        tone="danger"
        onClose={() => setResetOpen(false)}
        onConfirm={resetDemo}
      />
    </>
  );
}

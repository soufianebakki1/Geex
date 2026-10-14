import { useEffect, useState } from "react";
import { Check, Pencil, RotateCcw, UserPlus, UsersRound } from "lucide-react";
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
  "catalog.write": "Gérer projets et lots",
  "preReservations.write": "Poser des pré-réservations",
  "dossiers.upload": "Téléverser les pièces",
  "dossiers.validate": "Valider les pièces",
  "reservations.confirm": "Confirmer les réservations",
  "payments.create": "Saisir des paiements",
  "payments.validate": "Valider les paiements",
  "promoters.write": "Gérer les promoteurs",
  "managers.write": "Gérer les chefs de projet",
  "users.manage": "Gérer les utilisateurs",
};

function UserForm({ open, editing, onClose, onSaved }) {
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const isEdit = Boolean(editing?.id);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(isEdit ? { name: editing.name, email: editing.email, role: editing.role, phone: editing.phone ?? "" } : { name: "", email: "", role: "commercial", phone: "", password: "" });
  }, [open, editing, isEdit]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const saved = isEdit
        ? await api.users.update(editing.id, { name: form.name.trim(), role: form.role, phone: form.phone.trim() })
        : await api.users.create({ ...form, name: form.name.trim(), email: form.email.trim() });
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
          <Field label="Nom complet" required className="span-2">
            {(id) => <input id={id} className="input" value={form.name ?? ""} onChange={set("name")} required />}
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
        eyebrow="Administration"
        title="Paramètres"
        description="Comptes utilisateurs, rôles et droits d'accès à l'application."
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
                        <Badge tone={item.role === "admin" ? "brand" : "outline"}>{ROLE_LABEL[item.role]}</Badge>
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

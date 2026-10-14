import { useEffect, useState } from "react";
import { api } from "../api/index.js";
import { LEAD_SOURCES } from "../utils/status.js";
import { Button, Field, FormError, Modal } from "./ui.jsx";

const EMPTY = { firstName: "", lastName: "", phone: "", email: "", address: "", city: "", source: "Site web", budget: "", projectId: "", agentId: "", notes: "" };

export default function LeadFormModal({ open, lead, projects = [], team = [], currentUser, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const agents = currentUser?.role === "admin" ? team.filter((member) => ["commercial", "admin"].includes(member.role)) : [];

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(
      lead
        ? { ...EMPTY, ...lead, budget: lead.budget ?? "", projectId: lead.projectId ?? "", agentId: lead.agentId ?? "", email: lead.email ?? "", address: lead.address ?? "", city: lead.city ?? "", notes: lead.notes ?? "" }
        : { ...EMPTY, agentId: currentUser?.role === "commercial" ? currentUser.id : "" },
    );
  }, [open, lead, currentUser]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = {
      firstName: form.firstName.trim(),
      lastName: form.lastName.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: form.address.trim(),
      city: form.city.trim(),
      source: form.source,
      budget: form.budget === "" ? null : Number(form.budget),
      projectId: form.projectId || null,
      agentId: form.agentId || undefined,
      notes: form.notes.trim(),
    };
    try {
      const saved = lead ? await api.leads.update(lead.id, payload) : await api.leads.create(payload);
      onSaved(saved);
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
      title={lead ? "Modifier le prospect" : "Nouveau lead"}
      subtitle={lead ? `${lead.firstName} ${lead.lastName}` : "Les champs marqués d'un astérisque sont obligatoires."}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="lead-form" loading={saving}>
            {lead ? "Enregistrer" : "Créer le lead"}
          </Button>
        </>
      }
    >
      <form id="lead-form" className="stack" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Prénom" required>
            {(id) => <input id={id} className="input" value={form.firstName} onChange={set("firstName")} required autoComplete="given-name" />}
          </Field>
          <Field label="Nom" required>
            {(id) => <input id={id} className="input" value={form.lastName} onChange={set("lastName")} required autoComplete="family-name" />}
          </Field>
          <Field label="Téléphone" required>
            {(id) => <input id={id} className="input" type="tel" value={form.phone} onChange={set("phone")} required placeholder="+212 6 …" />}
          </Field>
          <Field label="Email">
            {(id) => <input id={id} className="input" type="email" value={form.email} onChange={set("email")} placeholder="nom@exemple.com" />}
          </Field>
          <Field label="Adresse" required className="span-2">
            {(id) => <input id={id} className="input" value={form.address} onChange={set("address")} required autoComplete="street-address" />}
          </Field>
          <Field label="Ville">
            {(id) => <input id={id} className="input" value={form.city} onChange={set("city")} />}
          </Field>
          <Field label="Source" required>
            {(id) => (
              <select id={id} className="select" value={form.source} onChange={set("source")} required>
                {LEAD_SOURCES.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Projet concerné" required>
            {(id) => (
              <select id={id} className="select" value={form.projectId} onChange={set("projectId")} required>
                <option value="">Sélectionner un projet…</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} — {project.city}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Budget">
            {(id) => (
              <div className="input-affix">
                <input id={id} className="input num" type="number" min="0" step="any" value={form.budget} onChange={set("budget")} />
                <span className="input-affix__suffix">MAD</span>
              </div>
            )}
          </Field>
          {agents.length > 0 && (
            <Field label="Commercial assigné" className="span-2">
              {(id) => (
                <select id={id} className="select" value={form.agentId} onChange={set("agentId")}>
                  <option value="">Moi-même</option>
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
          <Field label="Notes" className="span-2">
            {(id) => <textarea id={id} className="textarea" value={form.notes} onChange={set("notes")} placeholder="Attentes, contraintes, typologie recherchée…" />}
          </Field>
        </div>
        <FormError error={error} />
      </form>
    </Modal>
  );
}

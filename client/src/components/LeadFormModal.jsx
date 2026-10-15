import { useEffect, useMemo, useState } from "react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { CLIENT_TYPES, FINANCING_MODES, LOT_TYPES, MOTIVATIONS, PURCHASE_DELAYS } from "../utils/status.js";
import { Button, Field, FormError, Modal } from "./ui.jsx";

const EMPTY = {
  fullName: "",
  clientType: "particulier",
  phone: "",
  email: "",
  address: "",
  sourceId: "",
  projectId: "",
  agentId: "",
  propertyType: "",
  desiredCity: "",
  budgetMin: "",
  budgetMax: "",
  surfaceMin: "",
  surfaceMax: "",
  financing: "",
  purchaseDelay: "",
  motivation: "",
  remark: "",
};
const NUMBER_KEYS = ["budgetMin", "budgetMax", "surfaceMin", "surfaceMax"];

function RangeField({ label, unit, min, max, onMin, onMax }) {
  return (
    <Field label={label}>
      {(id) => (
        <div className="row">
          <div className="input-affix grow">
            <input id={id} className="input num" type="number" min="0" step="any" value={min} onChange={onMin} placeholder="Min." aria-label={`${label} minimum`} />
            <span className="input-affix__suffix">{unit}</span>
          </div>
          <span className="faint">–</span>
          <div className="input-affix grow">
            <input className="input num" type="number" min="0" step="any" value={max} onChange={onMax} placeholder="Max." aria-label={`${label} maximum`} />
            <span className="input-affix__suffix">{unit}</span>
          </div>
        </div>
      )}
    </Field>
  );
}

export default function LeadFormModal({ open, lead, projects = [], team = [], currentUser, onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const sources = useAsync(() => (open ? api.sources.list() : Promise.resolve(null)), [open]);
  const canAssign = currentUser?.role === "admin";
  const agents = canAssign ? team.filter((member) => ["commercial", "admin"].includes(member.role)) : [];

  const sourceGroups = useMemo(() => {
    const map = new Map();
    (sources.data ?? []).forEach((source) => map.set(source.category, [...(map.get(source.category) ?? []), source]));
    return [...map];
  }, [sources.data]);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setForm(lead ? Object.fromEntries(Object.keys(EMPTY).map((key) => [key, lead[key] ?? ""])) : { ...EMPTY, agentId: currentUser?.role === "commercial" ? currentUser.id : "" });
  }, [open, lead, currentUser]);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    const payload = Object.fromEntries(Object.entries(form).map(([key, value]) => [key, typeof value === "string" ? value.trim() : value]));
    NUMBER_KEYS.forEach((key) => {
      payload[key] = payload[key] === "" ? null : Number(payload[key]);
    });
    payload.financing = payload.financing || null;
    if (canAssign) payload.agentId = payload.agentId || null;
    else delete payload.agentId;
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
      size="lg"
      title={lead ? "Modifier le prospect" : "Nouveau lead"}
      subtitle={lead ? lead.fullName : "Les champs marqués d'un astérisque sont obligatoires."}
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
        <p className="section-title">Prospect</p>
        <div className="form-grid">
          <Field label="Nom et prénom" required>
            {(id) => <input id={id} className="input" value={form.fullName} onChange={set("fullName")} required autoComplete="name" />}
          </Field>
          <Field label="Type de client" required>
            {(id) => (
              <select id={id} className="select" value={form.clientType} onChange={set("clientType")}>
                {CLIENT_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Téléphone" required>
            {(id) => <input id={id} className="input" type="tel" value={form.phone} onChange={set("phone")} required placeholder="+212 6 …" />}
          </Field>
          <Field label="Email" hint="Facultatif">
            {(id) => <input id={id} className="input" type="email" value={form.email} onChange={set("email")} placeholder="nom@exemple.com" />}
          </Field>
          <Field label="Adresse" required className="span-2">
            {(id) => <input id={id} className="input" value={form.address} onChange={set("address")} required autoComplete="street-address" />}
          </Field>
        </div>

        <p className="section-title">Origine et suivi</p>
        <div className="form-grid">
          <Field label="Source" required>
            {(id) => (
              <select id={id} className="select" value={form.sourceId} onChange={set("sourceId")} required disabled={!sources.data}>
                <option value="">{sources.data ? "Sélectionner une source…" : "Chargement…"}</option>
                {sourceGroups.map(([category, items]) =>
                  items.length === 1 && items[0].name === category ? (
                    <option key={items[0].id} value={items[0].id}>
                      {category}
                    </option>
                  ) : (
                    <optgroup key={category} label={category}>
                      {items.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.name}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </select>
            )}
          </Field>
          <Field label="Projet" required>
            {(id) => (
              <select id={id} className="select" value={form.projectId} onChange={set("projectId")} required>
                <option value="">Sélectionner un projet…</option>
                {projects
                  .filter((project) => project.active || project.id === form.projectId)
                  .map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name} — {project.city}
                    </option>
                  ))}
              </select>
            )}
          </Field>
          {canAssign && (
            <Field label="Commercial affecté" className="span-2" hint={form.agentId ? undefined : "Sans commercial, le lead reste à l'étape « Nouveau »."}>
              {(id) => (
                <select id={id} className="select" value={form.agentId} onChange={set("agentId")}>
                  {!lead?.agentId && <option value="">Non affecté</option>}
                  {agents.map((agent) => (
                    <option key={agent.id} value={agent.id}>
                      {agent.name}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          )}
        </div>

        <p className="section-title">Recherche</p>
        <div className="form-grid">
          <Field label="Type de bien souhaité">
            {(id) => (
              <select id={id} className="select" value={form.propertyType} onChange={set("propertyType")}>
                <option value="">Indifférent</option>
                {LOT_TYPES.map((type) => (
                  <option key={type.value} value={type.label}>
                    {type.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Ville souhaitée">
            {(id) => <input id={id} className="input" value={form.desiredCity} onChange={set("desiredCity")} />}
          </Field>
          <RangeField label="Budget" unit="MAD" min={form.budgetMin} max={form.budgetMax} onMin={set("budgetMin")} onMax={set("budgetMax")} />
          <RangeField label="Surface" unit="m²" min={form.surfaceMin} max={form.surfaceMax} onMin={set("surfaceMin")} onMax={set("surfaceMax")} />
          <Field label="Mode de financement">
            {(id) => (
              <select id={id} className="select" value={form.financing} onChange={set("financing")}>
                <option value="">Non précisé</option>
                {FINANCING_MODES.map((mode) => (
                  <option key={mode.value} value={mode.value}>
                    {mode.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Délai d'achat">
            {(id) => (
              <select id={id} className="select" value={form.purchaseDelay} onChange={set("purchaseDelay")}>
                <option value="">Non précisé</option>
                {PURCHASE_DELAYS.map((delay) => (
                  <option key={delay}>{delay}</option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Motivation" className="span-2">
            {(id) => (
              <>
                <input id={id} className="input" list="lead-motivations" value={form.motivation} onChange={set("motivation")} placeholder="Résidence principale, investissement…" />
                <datalist id="lead-motivations">
                  {MOTIVATIONS.map((motivation) => (
                    <option key={motivation} value={motivation} />
                  ))}
                </datalist>
              </>
            )}
          </Field>
          <Field label="Remarque" className="span-2">
            {(id) => <textarea id={id} className="textarea" value={form.remark} onChange={set("remark")} placeholder="Attentes, contraintes, informations utiles…" />}
          </Field>
        </div>
        <FormError error={error ?? sources.error} />
      </form>
    </Modal>
  );
}

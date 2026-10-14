import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Mail, MapPin, MessageCircle, Pencil, Phone, Timer, Footprints, Handshake } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import LeadFormModal from "../components/LeadFormModal.jsx";
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, ErrorState, Field, FormError, LoadingBlock, PageHeader, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatMAD, timeAgo, toDateTimeInput } from "../utils/format.js";
import { CONTACT_TYPE, CONTACT_TYPES, ENGAGED_STAGES, LEAD_STAGE, LEAD_STAGES, PRE_RESERVATION_STATUS, RESERVATION_STATUS } from "../utils/status.js";

const CONTACT_ICONS = { appel: Phone, email: Mail, whatsapp: MessageCircle, visite: Footprints, rdv: Handshake };

function ContactLog({ leadId, canWrite, contacts, onAdded }) {
  const [form, setForm] = useState({ type: "appel", date: toDateTimeInput(), summary: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.leads.addContact(leadId, { ...form, date: new Date(form.date).toISOString() });
      setForm({ type: form.type, date: toDateTimeInput(), summary: "" });
      onAdded();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Journal de contacts" subtitle="Appels, emails, visites et rendez-vous avec le prospect.">
      {canWrite && (
        <form className="contact-form" onSubmit={submit}>
          <div className="contact-form__types" role="radiogroup" aria-label="Type de contact">
            {CONTACT_TYPES.map((type) => {
              const Icon = CONTACT_ICONS[type.value];
              return (
                <button
                  key={type.value}
                  type="button"
                  role="radio"
                  aria-checked={form.type === type.value}
                  className={`chip ${form.type === type.value ? "is-active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, type: type.value }))}
                >
                  <Icon size={14} />
                  {type.label}
                </button>
              );
            })}
          </div>
          <div className="contact-form__row">
            <Field label="Date" className="contact-form__date">
              {(id) => <input id={id} className="input" type="datetime-local" value={form.date} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} required />}
            </Field>
            <Field label="Compte rendu" className="grow">
              {(id) => (
                <textarea
                  id={id}
                  className="textarea"
                  rows={2}
                  value={form.summary}
                  onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                  placeholder="Ce qui a été dit, les prochaines étapes…"
                  required
                />
              )}
            </Field>
          </div>
          <FormError error={error} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button variant="dark" size="sm" type="submit" loading={saving} disabled={!form.summary.trim()}>
              Enregistrer le contact
            </Button>
          </div>
        </form>
      )}

      {contacts.loading && !contacts.data ? (
        <LoadingBlock rows={3} />
      ) : contacts.error && !contacts.data ? (
        <ErrorState compact error={contacts.error} onRetry={contacts.reload} />
      ) : contacts.data.length === 0 ? (
        <EmptyState compact icon={Phone} title="Aucun contact enregistré" />
      ) : (
        <ul className="contact-list">
          {contacts.data.map((contact) => {
            const Icon = CONTACT_ICONS[contact.type] ?? Phone;
            return (
              <li key={contact.id} className="contact-list__item">
                <span className="contact-list__icon">
                  <Icon size={15} />
                </span>
                <div className="grow">
                  <div className="row-between wrap">
                    <span className="strong small">{CONTACT_TYPE[contact.type]?.label}</span>
                    <span className="xsmall faint">{formatDateTime(contact.date)}</span>
                  </div>
                  <p className="contact-list__summary">{contact.summary}</p>
                  <p className="xsmall faint">par {contact.user?.name ?? "—"}</p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function LeadDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const lead = useAsync(() => api.leads.get(id), [id]);
  const contacts = useAsync(() => api.leads.contacts(id), [id]);
  const activities = useAsync(() => api.leads.activities(id), [id]);
  const projects = useAsync(() => api.projects.list(), []);
  const team = useAsync(() => api.team.list(), []);
  const [editing, setEditing] = useState(false);
  const [stageSaving, setStageSaving] = useState(false);
  const canWrite = can(user, "leads.write");

  const refreshAll = () => {
    lead.reload({ silent: true });
    contacts.reload({ silent: true });
    activities.reload({ silent: true });
  };

  async function changeStage(stage) {
    setStageSaving(true);
    try {
      await api.leads.update(id, { stage });
      toast.success(`Étape mise à jour : ${LEAD_STAGE[stage].label}.`);
      refreshAll();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setStageSaving(false);
    }
  }

  if (lead.loading && !lead.data) {
    return (
      <>
        <PageHeader back={{ to: "/leads", label: "Leads" }} title="Chargement…" />
        <LoadingBlock rows={6} />
      </>
    );
  }
  if (lead.error && !lead.data) {
    return (
      <>
        <PageHeader back={{ to: "/leads", label: "Leads" }} title="Fiche prospect" />
        <div className="card">
          <ErrorState error={lead.error} onRetry={lead.reload} />
        </div>
      </>
    );
  }

  const data = lead.data;
  const engaged = ENGAGED_STAGES.includes(data.stage);
  const activePre = data.preReservations?.find((pre) => pre.status === "active");
  const selectableStages = LEAD_STAGES.filter((stage) => !ENGAGED_STAGES.includes(stage.value) || stage.value === data.stage);

  return (
    <>
      <PageHeader
        back={{ to: "/leads", label: "Leads" }}
        eyebrow="Fiche prospect"
        title={`${data.firstName} ${data.lastName}`}
        meta={
          <>
            <StatusBadge map={LEAD_STAGE} value={data.stage} />
            <Badge tone="outline">{data.source}</Badge>
            <span className="xsmall faint">Créé {timeAgo(data.createdAt)}</span>
          </>
        }
        actions={
          canWrite && (
            <>
              <select
                className="select"
                style={{ width: "auto" }}
                value={data.stage}
                disabled={engaged || stageSaving}
                onChange={(event) => changeStage(event.target.value)}
                aria-label="Étape du pipeline"
                title={engaged ? "L'étape suit l'avancement de la réservation" : undefined}
              >
                {selectableStages.map((stage) => (
                  <option key={stage.value} value={stage.value}>
                    {stage.label}
                  </option>
                ))}
              </select>
              <Button icon={Pencil} onClick={() => setEditing(true)}>
                Modifier
              </Button>
              {can(user, "preReservations.write") && !engaged && data.stage !== "perdu" && (
                <ButtonLink to={`/pre-reservations?leadId=${data.id}`} variant="primary" icon={Timer}>
                  Pré-réserver un lot
                </ButtonLink>
              )}
            </>
          )
        }
      />

      <div className="detail-grid">
        <div className="stack">
          <Card title="Coordonnées">
            <dl className="dl">
              <dt>Téléphone</dt>
              <dd>
                <a className="link" href={`tel:${data.phone.replace(/\s/g, "")}`}>
                  {data.phone}
                </a>
              </dd>
              <dt>Email</dt>
              <dd>{data.email ? <a className="link" href={`mailto:${data.email}`}>{data.email}</a> : <span className="faint">—</span>}</dd>
              <dt>Ville</dt>
              <dd>
                {data.city ? (
                  <span className="row">
                    <MapPin size={14} className="faint" />
                    {data.city}
                  </span>
                ) : (
                  <span className="faint">—</span>
                )}
              </dd>
            </dl>
          </Card>

          <Card title="Projet & budget">
            <dl className="dl">
              <dt>Projet d'intérêt</dt>
              <dd>{data.project ? `${data.project.name} · ${data.project.city}` : <span className="faint">Non précisé</span>}</dd>
              <dt>Budget</dt>
              <dd className="num">{data.budget ? formatMAD(data.budget) : <span className="faint">—</span>}</dd>
              <dt>Commercial</dt>
              <dd>
                {data.agent ? (
                  <span className="row">
                    <Avatar name={data.agent.name} size="sm" />
                    {data.agent.name}
                  </span>
                ) : (
                  "—"
                )}
              </dd>
              <dt>Dernier contact</dt>
              <dd>{data.lastContactAt ? formatDateTime(data.lastContactAt) : <span className="faint">Jamais</span>}</dd>
            </dl>
            {data.notes && <p className="note">{data.notes}</p>}
          </Card>

          {(data.preReservations?.length > 0 || data.reservation) && (
            <Card title="Engagements">
              <ul className="engagements">
                {data.reservation && (
                  <li>
                    <div className="grow">
                      <p className="strong small">Réservation {data.reservation.number}</p>
                      <p className="xsmall muted">
                        Lot {data.reservation.lot?.ref} · {formatMAD(data.reservation.price)}
                      </p>
                    </div>
                    <div className="row">
                      <StatusBadge map={RESERVATION_STATUS} value={data.reservation.status} />
                      {can(user, "reservations") && (
                        <Link to={`/reservations/${data.reservation.id}`} className="link xsmall">
                          Ouvrir
                        </Link>
                      )}
                    </div>
                  </li>
                )}
                {data.preReservations.map((pre) => (
                  <li key={pre.id}>
                    <div className="grow">
                      <p className="strong small">Pré-réservation · lot {pre.lot?.ref}</p>
                      <p className="xsmall muted">
                        {formatDate(pre.createdAt)} · acompte {formatMAD(pre.deposit)}
                      </p>
                    </div>
                    <div className="row">
                      <StatusBadge map={PRE_RESERVATION_STATUS} value={pre.status} />
                      {pre.dossierId && can(user, "dossiers") && (
                        <Link to={`/dossiers/${pre.dossierId}`} className="link xsmall">
                          Dossier
                        </Link>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
              {activePre && can(user, "preReservations") && (
                <Link to="/pre-reservations" className="link small">
                  Suivre le délai de validité
                </Link>
              )}
            </Card>
          )}
        </div>

        <div className="stack">
          <ContactLog leadId={id} canWrite={canWrite} contacts={contacts} onAdded={refreshAll} />

          <Card title="Chronologie" subtitle="Historique complet des actions sur ce prospect.">
            {activities.loading && !activities.data ? (
              <LoadingBlock rows={3} />
            ) : activities.error && !activities.data ? (
              <ErrorState compact error={activities.error} onRetry={activities.reload} />
            ) : activities.data.length === 0 ? (
              <EmptyState compact icon={CalendarDays} title="Aucune activité" />
            ) : (
              <ol className="timeline">
                {activities.data.map((item) => (
                  <li key={item.id} className={`timeline__item timeline__item--${item.type}`}>
                    <span className="timeline__dot" />
                    <div>
                      <p className="small">{item.message}</p>
                      <p className="xsmall faint">
                        {formatDateTime(item.at)} · {item.user?.name ?? "Système"}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>
      </div>

      <LeadFormModal
        open={editing}
        lead={data}
        projects={projects.data ?? []}
        team={team.data ?? []}
        currentUser={user}
        onClose={() => setEditing(false)}
        onSaved={() => {
          setEditing(false);
          toast.success("Fiche mise à jour.");
          refreshAll();
        }}
      />
    </>
  );
}

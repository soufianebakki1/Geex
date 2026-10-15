import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CalendarDays, Footprints, Mail, MessageCircle, MessagesSquare, Pencil, Phone, Timer } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import LeadCancelDialog from "../components/LeadCancelDialog.jsx";
import LeadFormModal from "../components/LeadFormModal.jsx";
import { Avatar, Badge, Button, ButtonLink, Card, EmptyState, ErrorState, Field, FormError, LoadingBlock, PageHeader, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatMAD, formatNumber, timeAgo, toDateInput, toDateTimeInput } from "../utils/format.js";
import {
  CLIENT_TYPE,
  CONTACT_CHANNEL,
  CONTACT_CHANNELS,
  CONTACT_RESULT,
  CONTACT_RESULTS,
  ENGAGED_STAGES,
  FINANCING_MODE,
  FOLLOW_UP_OUTCOME,
  FOLLOW_UP_OUTCOMES,
  LEAD_STAGE,
  MANUAL_STAGES,
  PRE_RESERVATION_STATUS,
  RESERVATION_STATUS,
} from "../utils/status.js";

const CHANNEL_ICONS = { telephone: Phone, whatsapp: MessageCircle, email: Mail, visite: Footprints, autre: MessagesSquare };
const LOCKED_STAGES = [...ENGAGED_STAGES, "livre", "cloture"];

const range = (min, max, format) => {
  if (min != null && max != null) return `${format(min)} – ${format(max)}`;
  if (max != null) return `jusqu'à ${format(max)}`;
  if (min != null) return `à partir de ${format(min)}`;
  return null;
};
const surface = (value) => `${formatNumber(value)} m²`;
const empty = <span className="faint">—</span>;

function FollowUpSlot({ lead, slot, canWrite, onSave }) {
  const dateKey = `followUp${slot}Date`;
  const outcomeKey = `followUp${slot}Outcome`;
  const initial = { date: lead[dateKey] ? toDateInput(lead[dateKey]) : "", outcome: lead[outcomeKey] ?? "" };
  const [form, setForm] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    setForm({ date: lead[dateKey] ? toDateInput(lead[dateKey]) : "", outcome: lead[outcomeKey] ?? "" });
    setError(null);
  }, [lead, dateKey, outcomeKey]);

  const locked = slot === 2 && !lead.followUp1Date;
  const dirty = form.date !== initial.date || form.outcome !== initial.outcome;
  const due = Boolean(lead[dateKey] && !lead[outcomeKey] && toDateInput(lead[dateKey]) <= toDateInput());
  const outcome = FOLLOW_UP_OUTCOME[lead[outcomeKey]];

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave({ [dateKey]: form.date ? `${form.date}T09:00` : null, [outcomeKey]: form.outcome || null });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className={`follow-up ${due ? "is-due" : ""}`} onSubmit={submit}>
      <div className="row-between" style={{ marginBottom: 8 }}>
        <p className="follow-up__label">{slot === 1 ? "1re relance" : "2e relance"}</p>
        {outcome ? <Badge tone={outcome.tone}>{outcome.label}</Badge> : due ? <Badge tone="warning">À faire</Badge> : null}
      </div>
      {canWrite ? (
        <div className="stack-xs">
          <Field label="Date de relance">
            {(id) => <input id={id} className="input" type="date" value={form.date} disabled={locked} onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))} />}
          </Field>
          <Field label="Sort" hint={locked ? "Planifiez d'abord la 1re relance." : undefined}>
            {(id) => (
              <select id={id} className="select" value={form.outcome} disabled={locked || !form.date} onChange={(event) => setForm((prev) => ({ ...prev, outcome: event.target.value }))}>
                <option value="">En attente</option>
                {FOLLOW_UP_OUTCOMES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label} → {item.next}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <FormError error={error} />
          {dirty && (
            <div className="row" style={{ justifyContent: "flex-end" }}>
              <Button size="sm" variant="ghost" onClick={() => setForm(initial)} disabled={saving}>
                Annuler
              </Button>
              <Button size="sm" variant="dark" type="submit" loading={saving}>
                Enregistrer
              </Button>
            </div>
          )}
        </div>
      ) : (
        <p className="small num">{lead[dateKey] ? formatDate(lead[dateKey]) : <span className="faint">Non planifiée</span>}</p>
      )}
    </form>
  );
}

function ContactLog({ leadId, canWrite, contacts, onAdded }) {
  const blank = () => ({ channel: "telephone", result: "contact_etabli", durationMinutes: "", at: toDateTimeInput(), notes: "" });
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.leads.addContact(leadId, {
        ...form,
        durationMinutes: form.durationMinutes === "" ? null : Number(form.durationMinutes),
        at: new Date(form.at).toISOString(),
      });
      setForm({ ...blank(), channel: form.channel });
      onAdded();
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card title="Interactions" subtitle="Appels, messages, emails et visites avec le prospect.">
      {canWrite && (
        <form className="contact-form" onSubmit={submit}>
          <div className="contact-form__types" role="radiogroup" aria-label="Canal">
            {CONTACT_CHANNELS.map((channel) => {
              const Icon = CHANNEL_ICONS[channel.value];
              return (
                <button
                  key={channel.value}
                  type="button"
                  role="radio"
                  aria-checked={form.channel === channel.value}
                  className={`chip ${form.channel === channel.value ? "is-active" : ""}`}
                  onClick={() => setForm((prev) => ({ ...prev, channel: channel.value }))}
                >
                  <Icon size={14} />
                  {channel.label}
                </button>
              );
            })}
          </div>
          <div className="form-grid">
            <Field label="Résultat" required>
              {(id) => (
                <select id={id} className="select" value={form.result} onChange={set("result")}>
                  {CONTACT_RESULTS.map((result) => (
                    <option key={result.value} value={result.value}>
                      {result.label}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="row" style={{ alignItems: "flex-start" }}>
              <Field label="Date" className="grow">
                {(id) => <input id={id} className="input" type="datetime-local" value={form.at} onChange={set("at")} required />}
              </Field>
              <Field label="Durée (min)" className="contact-form__duration">
                {(id) => <input id={id} className="input num" type="number" min="0" value={form.durationMinutes} onChange={set("durationMinutes")} />}
              </Field>
            </div>
            <Field label="Notes" className="span-2">
              {(id) => <textarea id={id} className="textarea" rows={2} value={form.notes} onChange={set("notes")} placeholder="Ce qui a été dit, les prochaines étapes…" />}
            </Field>
          </div>
          <FormError error={error} />
          <div className="row" style={{ justifyContent: "flex-end" }}>
            <Button variant="dark" size="sm" type="submit" loading={saving}>
              Enregistrer l'interaction
            </Button>
          </div>
        </form>
      )}

      {contacts.loading && !contacts.data ? (
        <LoadingBlock rows={3} />
      ) : contacts.error && !contacts.data ? (
        <ErrorState compact error={contacts.error} onRetry={contacts.reload} />
      ) : contacts.data.length === 0 ? (
        <EmptyState compact icon={Phone} title="Aucune interaction enregistrée" />
      ) : (
        <ul className="contact-list">
          {contacts.data.map((contact) => {
            const Icon = CHANNEL_ICONS[contact.channel] ?? MessagesSquare;
            return (
              <li key={contact.id} className="contact-list__item">
                <span className="contact-list__icon">
                  <Icon size={15} />
                </span>
                <div className="grow">
                  <div className="row-between wrap">
                    <span className="row">
                      <span className="strong small">{CONTACT_CHANNEL[contact.channel]?.label ?? contact.channel}</span>
                      <StatusBadge map={CONTACT_RESULT} value={contact.result} dot={false} />
                    </span>
                    <span className="xsmall faint">
                      {formatDateTime(contact.at)}
                      {contact.durationMinutes ? ` · ${contact.durationMinutes} min` : ""}
                    </span>
                  </div>
                  {contact.notes && <p className="contact-list__summary">{contact.notes}</p>}
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
  const [cancelling, setCancelling] = useState(null);
  const [stageSaving, setStageSaving] = useState(false);
  const canWrite = can(user, "leads.write");
  const canClose = can(user, "leads.close");

  const refreshAll = () => {
    lead.reload({ silent: true });
    contacts.reload({ silent: true });
    activities.reload({ silent: true });
  };

  async function changeStage(stage) {
    if (stage === "annule") {
      setCancelling({});
      return;
    }
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

  async function saveFollowUp(patch) {
    if (Object.values(patch).includes("annulation") && lead.data.stage !== "annule") {
      setCancelling(patch);
      return;
    }
    await api.leads.update(id, patch);
    toast.success("Relance enregistrée.");
    refreshAll();
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
  const stageOptions = [
    ...(LOCKED_STAGES.includes(data.stage) ? [data.stage] : []),
    ...MANUAL_STAGES.filter((stage) => !LOCKED_STAGES.includes(data.stage) && !(stage === "nouveau" && data.agentId) && !(stage !== "nouveau" && !data.agentId)),
    ...(canClose && ["signe", "en_paiement"].includes(data.stage) ? ["livre"] : []),
    ...(canClose && data.stage === "livre" ? ["cloture"] : []),
    ...(LOCKED_STAGES.includes(data.stage) ? [] : ["annule"]),
  ];
  if (!stageOptions.includes(data.stage)) stageOptions.unshift(data.stage);
  const budget = range(data.budgetMin, data.budgetMax, formatMAD);
  const area = range(data.surfaceMin, data.surfaceMax, surface);

  return (
    <>
      <PageHeader
        back={{ to: "/leads", label: "Leads" }}
        title={data.fullName}
        meta={
          <>
            <StatusBadge map={LEAD_STAGE} value={data.stage} />
            <Badge tone="outline">{CLIENT_TYPE[data.clientType]?.label}</Badge>
            {data.source && <Badge tone="outline">{data.source.name}</Badge>}
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
                disabled={stageSaving || stageOptions.length < 2}
                onChange={(event) => changeStage(event.target.value)}
                aria-label="Étape du pipeline"
                title={engaged ? "L'étape suit l'avancement de la réservation" : undefined}
              >
                {stageOptions.map((stage) => (
                  <option key={stage} value={stage}>
                    {LEAD_STAGE[stage].label}
                  </option>
                ))}
              </select>
              <Button icon={Pencil} onClick={() => setEditing(true)}>
                Modifier
              </Button>
              {can(user, "preReservations.write") && !LOCKED_STAGES.includes(data.stage) && data.stage !== "annule" && (
                <ButtonLink to={`/pre-reservations?leadId=${data.id}`} variant="primary" icon={Timer}>
                  Pré-réserver un lot
                </ButtonLink>
              )}
            </>
          )
        }
      />

      {data.stage === "annule" && data.cancelReason && (
        <p className="note" style={{ marginBottom: 16 }}>
          <strong>Lead annulé</strong> — {data.cancelReason}
        </p>
      )}

      <div className="detail-grid">
        <div className="stack">
          <Card title="Coordonnées">
            <dl className="dl">
              <dt>Téléphone</dt>
              <dd>
                <a className="link num" href={`tel:${data.phone.replace(/\s/g, "")}`}>
                  {data.phone}
                </a>
              </dd>
              <dt>Email</dt>
              <dd>{data.email ? <a className="link" href={`mailto:${data.email}`}>{data.email}</a> : empty}</dd>
              <dt>Adresse</dt>
              <dd>{data.address || empty}</dd>
              <dt>Commercial</dt>
              <dd>
                {data.agent ? (
                  <span className="row">
                    <Avatar name={data.agent.name} size="sm" />
                    {data.agent.name}
                  </span>
                ) : (
                  <Badge tone="warning">À affecter</Badge>
                )}
              </dd>
              <dt>Dernière activité</dt>
              <dd>{data.lastActivityAt ? formatDateTime(data.lastActivityAt) : <span className="faint">Aucune</span>}</dd>
            </dl>
          </Card>

          <Card title="Recherche">
            <dl className="dl">
              <dt>Projet</dt>
              <dd>{data.project ? `${data.project.name} · ${data.project.city}` : empty}</dd>
              <dt>Type de bien</dt>
              <dd>{data.propertyType || empty}</dd>
              <dt>Ville souhaitée</dt>
              <dd>{data.desiredCity || empty}</dd>
              <dt>Budget</dt>
              <dd className="num">{budget ?? empty}</dd>
              <dt>Surface</dt>
              <dd className="num">{area ?? empty}</dd>
              <dt>Financement</dt>
              <dd>{FINANCING_MODE[data.financing]?.label ?? empty}</dd>
              <dt>Délai d'achat</dt>
              <dd>{data.purchaseDelay || empty}</dd>
              <dt>Motivation</dt>
              <dd>{data.motivation || empty}</dd>
            </dl>
            {data.remark && <p className="note">{data.remark}</p>}
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
                      <p className="strong small">
                        {pre.number} · lot {pre.lot?.ref}
                      </p>
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
          <Card title="Relances" subtitle="Suivi téléphonique : date et sort de chaque relance. Une annulation archive le lead.">
            <div className="follow-ups">
              <FollowUpSlot lead={data} slot={1} canWrite={canWrite} onSave={saveFollowUp} />
              <FollowUpSlot lead={data} slot={2} canWrite={canWrite} onSave={saveFollowUp} />
            </div>
          </Card>

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

      <LeadCancelDialog
        lead={cancelling ? data : null}
        extra={cancelling ?? undefined}
        onClose={() => setCancelling(null)}
        onCancelled={() => {
          setCancelling(null);
          toast.success("Lead annulé et archivé.");
          refreshAll();
        }}
      />
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { AlarmClock, Building2, CircleCheckBig, FolderCheck, Hourglass, Plus, Quote, TimerReset, Wallet, X } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useNow } from "../hooks/useNow.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import CountdownRing from "../components/CountdownRing.jsx";
import StatCard from "../components/dashboard/StatCard.jsx";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormError, FormStep, LoadingBlock, Modal, PageHeader, Segmented, StatusBadge } from "../components/ui.jsx";
import { formatCompactMAD, formatDate, formatDateTime, formatMAD, formatNumber, percent } from "../utils/format.js";
import { DOSSIER_CLIENT_TYPES, LOT_TYPE, MANUAL_STAGES, PAYMENT_METHOD, PAYMENT_METHODS, PRE_RESERVATION_STATUS } from "../utils/status.js";

const VALIDITY_OPTIONS = [
  { hours: 48, label: "48 h" },
  { hours: 72, label: "72 h" },
  { hours: 168, label: "7 jours" },
];
const EXTEND_OPTIONS = [
  { hours: 24, label: "24 h" },
  { hours: 48, label: "48 h" },
  { hours: 72, label: "72 h" },
  { hours: 168, label: "7 jours" },
];
const REASONS = ["Attente de l'apport", "Attente de l'accord de crédit", "Visite de confirmation", "Réflexion du client", "Validation familiale"];
const HOUR = 3_600_000;

const lotLabel = (lot) => [LOT_TYPE[lot?.type]?.label ?? lot?.type, lot?.building?.name ?? lot?.tranche?.name].filter(Boolean).join(" · ");

function ChoiceGroup({ label, options, value, onChange }) {
  return (
    <div className="segmented segmented--full" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button key={option.hours} type="button" role="radio" aria-checked={value === option.hours} className={`segmented__item ${value === option.hours ? "is-active" : ""}`} onClick={() => onChange(option.hours)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

function PreReservationModal({ onClose, onCreated }) {
  const [params] = useSearchParams();
  const leads = useAsync(() => api.leads.list(), []);
  const lots = useAsync(() => api.lots.list({ status: "disponible" }), []);
  const projects = useAsync(() => api.projects.list(), []);
  const [form, setForm] = useState({ leadId: params.get("leadId") ?? "", projectId: "", lotId: params.get("lotId") ?? "", deposit: "50000", depositMethod: "virement", validityHours: 48, reason: "", comments: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!lots.data || !form.lotId || form.projectId) return;
    const lot = lots.data.find((item) => item.id === form.lotId);
    if (lot) setForm((prev) => ({ ...prev, projectId: lot.projectId }));
  }, [lots.data, form.lotId, form.projectId]);

  useEffect(() => {
    if (!leads.data || !form.leadId || form.projectId || form.lotId) return;
    const lead = leads.data.find((item) => item.id === form.leadId);
    if (lead?.projectId) setForm((prev) => ({ ...prev, projectId: lead.projectId }));
  }, [leads.data, form.leadId, form.projectId, form.lotId]);

  const eligibleLeads = (leads.data ?? []).filter((lead) => lead.agentId && MANUAL_STAGES.includes(lead.stage));
  const availableLots = (lots.data ?? []).filter((lot) => !form.projectId || lot.projectId === form.projectId);
  const selectedLot = lots.data?.find((lot) => lot.id === form.lotId);
  const preselectedLeadIneligible = form.leadId && leads.data && !eligibleLeads.some((lead) => lead.id === form.leadId);
  const depositRatio = selectedLot && Number(form.deposit) ? percent(Number(form.deposit), selectedLot.price) : null;
  const loading = (leads.loading && !leads.data) || (lots.loading && !lots.data);

  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const created = await api.preReservations.create({
        leadId: form.leadId,
        lotId: form.lotId,
        deposit: Number(form.deposit),
        depositMethod: form.depositMethod,
        validityHours: Number(form.validityHours),
        reason: form.reason.trim(),
        comments: form.comments.trim(),
      });
      onCreated(created);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      size="lg"
      onClose={onClose}
      busy={saving}
      title="Nouvelle pré-réservation"
      subtitle="Le lot est bloqué pour le client pendant la durée choisie, contre un acompte."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="pre-form" loading={saving} disabled={loading || !form.leadId || !form.lotId || !form.reason.trim() || preselectedLeadIneligible}>
            Pré-réserver le lot
          </Button>
        </>
      }
    >
      {loading ? (
        <LoadingBlock rows={4} />
      ) : (
        <form id="pre-form" className="pre-form" onSubmit={submit}>
          <FormStep number="1" title="Client et lot">
            <Field label="Client" required error={preselectedLeadIneligible ? "Ce lead n'est pas affecté, a déjà un engagement en cours ou est clôturé." : undefined}>
              {(id) => (
                <select id={id} className="select" value={form.leadId} onChange={set("leadId")} required>
                  <option value="">Sélectionner un lead…</option>
                  {eligibleLeads.map((lead) => (
                    <option key={lead.id} value={lead.id}>
                      {lead.fullName} — {lead.phone}
                    </option>
                  ))}
                </select>
              )}
            </Field>
            <div className="pre-form__pair">
              <Field label="Projet">
                {(id) => (
                  <select id={id} className="select" value={form.projectId} onChange={(event) => setForm((prev) => ({ ...prev, projectId: event.target.value, lotId: "" }))}>
                    <option value="">Tous les projets</option>
                    {(projects.data ?? []).map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              <Field label="Lot disponible" required hint={`${availableLots.length} lot(s) disponible(s)`}>
                {(id) => (
                  <select id={id} className="select" value={form.lotId} onChange={set("lotId")} required>
                    <option value="">Sélectionner un lot…</option>
                    {availableLots.map((lot) => (
                      <option key={lot.id} value={lot.id}>
                        {lot.ref} · {lotLabel(lot)} · {formatNumber(lot.surface)} m² · {formatMAD(lot.price)}
                        {form.projectId ? "" : ` (${lot.project?.name})`}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
            {selectedLot && (
              <div className="pre-form__lot-card">
                <span className="pre-form__lot-icon">
                  <Building2 size={18} />
                </span>
                <div className="grow">
                  <p className="strong">
                    Lot {selectedLot.ref} · {selectedLot.project?.name}
                  </p>
                  <p className="xsmall muted">
                    {lotLabel(selectedLot)} · {formatNumber(selectedLot.surface)} m²
                  </p>
                </div>
                <div className="align-right">
                  <p className="xsmall muted">Prix du lot</p>
                  <p className="pre-form__price num">{formatMAD(selectedLot.price)}</p>
                </div>
              </div>
            )}
          </FormStep>

          <FormStep number="2" title="Acompte">
            <div className="pre-form__pair">
              <Field label="Montant" required hint={depositRatio != null ? `${depositRatio} % du prix du lot` : undefined}>
                {(id) => (
                  <div className="input-affix">
                    <input id={id} className="input num" type="number" min="1" step="any" value={form.deposit} onChange={set("deposit")} required />
                    <span className="input-affix__suffix">MAD</span>
                  </div>
                )}
              </Field>
              <Field label="Mode de versement" required>
                {(id) => (
                  <select id={id} className="select" value={form.depositMethod} onChange={set("depositMethod")} required>
                    {PAYMENT_METHODS.map((method) => (
                      <option key={method.value} value={method.value}>
                        {method.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
            </div>
          </FormStep>

          <FormStep number="3" title="Durée et motif">
            <Field label="Validité" required hint="48 h par défaut. À l'expiration, le lot est automatiquement remis en vente.">
              {() => <ChoiceGroup label="Durée de validité" options={VALIDITY_OPTIONS} value={Number(form.validityHours)} onChange={(hours) => setForm((prev) => ({ ...prev, validityHours: hours }))} />}
            </Field>
            <Field label="Motif" required>
              {(id) => (
                <>
                  <input id={id} className="input" list="pre-reasons" value={form.reason} onChange={set("reason")} required placeholder="Attente de l'apport, accord de crédit…" />
                  <datalist id="pre-reasons">
                    {REASONS.map((reason) => (
                      <option key={reason} value={reason} />
                    ))}
                  </datalist>
                </>
              )}
            </Field>
            <Field label="Commentaires">
              {(id) => <textarea id={id} className="textarea" rows={2} value={form.comments} onChange={set("comments")} placeholder="Conditions particulières, informations utiles…" />}
            </Field>
          </FormStep>

          <FormError error={error ?? leads.error ?? lots.error} />
        </form>
      )}
    </Modal>
  );
}

function PreReservationCard({ pre, now, canWrite, canExtend, onConvert, onCancel, onExtend, onExpire }) {
  const left = new Date(pre.expiresAt).getTime() - now;
  const expired = left <= 0;
  const urgent = !expired && left < 24 * HOUR;

  return (
    <article className={`pre-card${urgent ? " is-urgent" : ""}${expired ? " is-expired" : ""}`}>
      <header className="pre-card__head">
        <CountdownRing from={pre.createdAt} to={pre.expiresAt} onExpire={onExpire} />
        <div className="pre-card__who">
          <p className="pre-card__number">
            <span className="num">{pre.number}</span>
            {pre.extendedAt && <Badge tone="gold">Prolongée</Badge>}
          </p>
          <h3 className="pre-card__name">
            <Link to={`/leads/${pre.lead?.id}`}>{pre.lead?.name}</Link>
          </h3>
          <p className="pre-card__lot">
            <Building2 size={14} />
            <span className="truncate">
              Lot <b>{pre.lot?.ref}</b> · {lotLabel(pre.lot)} · {pre.lot?.project?.name}
            </span>
          </p>
        </div>
      </header>

      <dl className="pre-card__facts">
        <div>
          <dt>Acompte</dt>
          <dd className="num">{formatMAD(pre.deposit)}</dd>
          <span>
            {PAYMENT_METHOD[pre.depositMethod]?.label ?? pre.depositMethod} · {percent(pre.deposit, pre.lot?.price)} %
          </span>
        </div>
        <div>
          <dt>Prix du lot</dt>
          <dd className="num">{formatMAD(pre.lot?.price)}</dd>
        </div>
        <div>
          <dt>Expire le</dt>
          <dd>{formatDateTime(pre.expiresAt)}</dd>
        </div>
      </dl>

      <p className="pre-card__reason">
        <Quote size={14} />
        <span>{pre.reason || "Aucun motif indiqué"}</span>
      </p>
      {pre.comments && <p className="pre-card__note">{pre.comments}</p>}

      <footer className="pre-card__foot">
        <p className="pre-card__meta">
          Créée le {formatDateTime(pre.createdAt)} par {pre.createdByUser?.name ?? "—"}
          {pre.agent && pre.agent.id !== pre.createdByUser?.id ? ` · commercial ${pre.agent.name}` : ""}
        </p>
        {(canWrite || canExtend) && (
          <div className="pre-card__actions">
            {canExtend && (
              <Button variant="ghost" size="sm" icon={TimerReset} onClick={() => onExtend(pre)} disabled={expired}>
                Prolonger
              </Button>
            )}
            {canWrite && (
              <>
                <Button variant="ghost" size="sm" icon={X} onClick={() => onCancel(pre)} disabled={expired}>
                  Annuler
                </Button>
                <Button variant="dark" size="sm" icon={FolderCheck} onClick={() => onConvert(pre)} disabled={expired}>
                  Constituer le dossier
                </Button>
              </>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}

function summaryCards(active, history, now) {
  const urgent = active.filter((pre) => {
    const left = new Date(pre.expiresAt).getTime() - now;
    return left > 0 && left < 24 * HOUR;
  });
  const critical = urgent.filter((pre) => new Date(pre.expiresAt).getTime() - now < 6 * HOUR).length;
  const converted = history.filter((pre) => pre.status === "convertie").length;
  return [
    {
      icon: Hourglass,
      label: "En cours",
      value: active.length,
      hint: "lots bloqués pour vos clients",
      chip: active.length ? { label: formatCompactMAD(active.reduce((sum, pre) => sum + (pre.lot?.price ?? 0), 0)), tone: "gold" } : null,
      hero: true,
    },
    {
      icon: AlarmClock,
      label: "Urgentes",
      value: urgent.length,
      hint: "expirent dans moins de 24 h",
      chip: critical ? { label: `${critical} < 6 h`, tone: "warn" } : { label: "Sous contrôle", tone: "up" },
    },
    {
      icon: Wallet,
      label: "Acomptes reçus",
      value: formatCompactMAD(active.reduce((sum, pre) => sum + (pre.deposit ?? 0), 0)),
      hint: "sur les options en cours",
    },
    {
      icon: CircleCheckBig,
      label: "Converties",
      value: converted,
      hint: "transformées en dossier",
      chip: history.length ? { label: `${percent(converted, history.length)} %`, tone: "up" } : null,
    },
  ];
}

export default function PreReservationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const now = useNow(30_000);
  const list = useAsync(() => api.preReservations.list(), []);
  const canWrite = can(user, "preReservations.write");
  const canExtend = can(user, "preReservations.extend");
  const [tab, setTab] = useState("active");
  const [creating, setCreating] = useState(() => canWrite && (params.has("leadId") || params.has("lotId")));
  const [converting, setConverting] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [extending, setExtending] = useState(null);
  const [extension, setExtension] = useState({ hours: 24, reason: "" });
  const [clientType, setClientType] = useState("particulier");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);

  const active = useMemo(() => (list.data ?? []).filter((pre) => pre.status === "active").sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)), [list.data]);
  const history = useMemo(() => (list.data ?? []).filter((pre) => pre.status !== "active"), [list.data]);
  const refresh = useCallback(() => list.reload({ silent: true }), [list.reload]);

  function closeForm() {
    setCreating(false);
    if (params.has("leadId") || params.has("lotId")) setParams({}, { replace: true });
  }

  async function runAction(kind) {
    setBusy(true);
    setActionError(null);
    try {
      if (kind === "convert") {
        const dossier = await api.preReservations.convert(converting.id, clientType);
        toast.success("Dossier ouvert. Ajoutez les pièces justificatives.");
        navigate(`/dossiers/${dossier.id}`);
      } else if (kind === "extend") {
        const saved = await api.preReservations.extend(extending.id, Number(extension.hours), extension.reason.trim());
        toast.success(`Pré-réservation ${saved.number} prolongée jusqu'au ${formatDateTime(saved.expiresAt)}.`);
        setExtending(null);
        refresh();
      } else {
        await api.preReservations.cancel(cancelling.id, cancelReason.trim());
        toast.success("Pré-réservation annulée, le lot est remis en vente.");
        setCancelling(null);
        refresh();
      }
    } catch (error) {
      setActionError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const newButton = canWrite && (
    <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
      Nouvelle pré-réservation
    </Button>
  );

  return (
    <>
      <PageHeader title="Pré-réservations" actions={newButton} />

      {list.loading && !list.data ? (
        <LoadingBlock rows={4} />
      ) : list.error && !list.data ? (
        <div className="card">
          <ErrorState error={list.error} onRetry={list.reload} />
        </div>
      ) : (
        <div className="pre">
          <div className="pre-summary">
            {summaryCards(active, history, now).map((card) => (
              <StatCard key={card.label} {...card} />
            ))}
          </div>

          <div className="pre-toolbar">
            <Segmented
              label="Statut"
              value={tab}
              onChange={setTab}
              items={[
                { value: "active", label: "En cours", count: active.length },
                { value: "history", label: "Historique", count: history.length },
              ]}
            />
            {tab === "active" && active.length > 0 && <p className="pre-toolbar__hint">Les plus proches de l'expiration en premier</p>}
          </div>

          {tab === "active" ? (
            active.length === 0 ? (
              <div className="card dash-card">
                <EmptyState icon={Hourglass} title="Aucune pré-réservation en cours" description="Les options posées sur des lots apparaîtront ici avec leur délai restant." action={newButton} />
              </div>
            ) : (
              <div className="pre-grid">
                {active.map((pre) => (
                  <PreReservationCard
                    key={pre.id}
                    pre={pre}
                    now={now}
                    canWrite={canWrite}
                    canExtend={canExtend}
                    onExpire={refresh}
                    onConvert={(item) => {
                      setActionError(null);
                      setClientType(item.lead?.clientType ?? "particulier");
                      setConverting(item);
                    }}
                    onExtend={(item) => {
                      setActionError(null);
                      setExtension({ hours: 24, reason: "" });
                      setExtending(item);
                    }}
                    onCancel={(item) => {
                      setActionError(null);
                      setCancelReason("");
                      setCancelling(item);
                    }}
                  />
                ))}
              </div>
            )
          ) : history.length === 0 ? (
            <div className="card dash-card">
              <EmptyState compact title="Aucun historique" description="Les pré-réservations converties, expirées ou annulées apparaîtront ici." />
            </div>
          ) : (
            <Card className="dash-card" flush>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>N°</th>
                      <th>Client</th>
                      <th>Lot</th>
                      <th className="align-right">Acompte</th>
                      <th>Créée le</th>
                      <th>Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((pre) => (
                      <tr key={pre.id}>
                        <td className="num small">{pre.number}</td>
                        <td>
                          <div className="cell-primary">{pre.lead?.name}</div>
                          <div className="cell-secondary">{pre.reason}</div>
                        </td>
                        <td>
                          <div>{pre.lot?.ref}</div>
                          <div className="cell-secondary">{pre.lot?.project?.name}</div>
                        </td>
                        <td className="align-right">
                          <div className="num">{formatMAD(pre.deposit)}</div>
                          <div className="cell-secondary">{PAYMENT_METHOD[pre.depositMethod]?.label}</div>
                        </td>
                        <td>{formatDate(pre.createdAt)}</td>
                        <td>
                          <div className="row">
                            <StatusBadge map={PRE_RESERVATION_STATUS} value={pre.status} />
                            {pre.dossierId && can(user, "dossiers") && (
                              <Link to={`/dossiers/${pre.dossierId}`} className="link xsmall">
                                Dossier
                              </Link>
                            )}
                          </div>
                          {pre.cancelReason && <div className="cell-secondary">Motif : {pre.cancelReason}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </div>
      )}

      {creating && (
        <PreReservationModal
          onClose={closeForm}
          onCreated={(created) => {
            list.setData((items) => [created, ...(items ?? [])]);
            setTab("active");
            closeForm();
            toast.success(`Lot ${created.lot?.ref} pré-réservé pour ${created.lead?.name}.`);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(converting)}
        title="Constituer le dossier de réservation ?"
        description={converting ? `Le lot ${converting.lot?.ref} reste bloqué pour ${converting.lead?.name} pendant la collecte des pièces justificatives.` : ""}
        confirmLabel="Ouvrir le dossier"
        tone="dark"
        busy={busy}
        error={actionError}
        onClose={() => setConverting(null)}
        onConfirm={() => runAction("convert")}
      >
        <Field label="Type de client" required hint="Détermine la liste des pièces justificatives à fournir.">
          {(id) => (
            <select id={id} className="select" value={clientType} onChange={(event) => setClientType(event.target.value)}>
              {DOSSIER_CLIENT_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
          )}
        </Field>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(extending)}
        title="Prolonger la pré-réservation ?"
        description={extending ? `${extending.number} — lot ${extending.lot?.ref}, expire actuellement le ${formatDateTime(extending.expiresAt)}.` : ""}
        confirmLabel="Prolonger"
        tone="dark"
        busy={busy}
        error={actionError}
        onClose={() => setExtending(null)}
        onConfirm={() => (extension.reason.trim() ? runAction("extend") : setActionError("Indiquez le motif de la prolongation."))}
      >
        <div className="stack">
          <Field label="Durée supplémentaire" required>
            {() => <ChoiceGroup label="Durée supplémentaire" options={EXTEND_OPTIONS} value={extension.hours} onChange={(hours) => setExtension((prev) => ({ ...prev, hours }))} />}
          </Field>
          <Field label="Motif de la prolongation" required>
            {(id) => <textarea id={id} className="textarea" rows={2} value={extension.reason} onChange={(event) => setExtension((prev) => ({ ...prev, reason: event.target.value }))} placeholder="Accord de crédit en cours, client à l'étranger…" />}
          </Field>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Annuler la pré-réservation ?"
        description={cancelling ? `Le lot ${cancelling.lot?.ref} sera immédiatement remis en vente. L'acompte de ${formatMAD(cancelling.deposit)} devra être traité séparément.` : ""}
        confirmLabel="Annuler la pré-réservation"
        tone="danger"
        busy={busy}
        error={actionError}
        onClose={() => setCancelling(null)}
        onConfirm={() => (cancelReason.trim() ? runAction("cancel") : setActionError("Indiquez le motif de l'annulation."))}
      >
        <Field label="Motif de l'annulation" required>
          {(id) => <textarea id={id} className="textarea" rows={2} value={cancelReason} onChange={(event) => setCancelReason(event.target.value)} placeholder="Client renonce, financement refusé, changement de lot…" />}
        </Field>
      </ConfirmDialog>
    </>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FolderCheck, Hourglass, TimerReset, X } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useNow } from "../hooks/useNow.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import Countdown from "../components/Countdown.jsx";
import { Badge, Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingBlock, PageHeader, ProgressBar, Segmented, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatMAD, formatNumber, percent } from "../utils/format.js";
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

const lotLabel = (lot) => [LOT_TYPE[lot?.type]?.label ?? lot?.type, lot?.building?.name ?? lot?.tranche?.name].filter(Boolean).join(" · ");

function PreReservationForm({ onCreated }) {
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
      setForm((prev) => ({ ...prev, leadId: "", lotId: "", reason: "", comments: "" }));
      lots.reload({ silent: true });
      leads.reload({ silent: true });
    } catch (err) {
      setError(err);
    } finally {
      setSaving(false);
    }
  }

  const loading = (leads.loading && !leads.data) || (lots.loading && !lots.data);

  return (
    <Card title="Nouvelle pré-réservation" subtitle="Bloque le lot pour le client pendant la durée de validité, contre un acompte.">
      {loading ? (
        <LoadingBlock rows={4} />
      ) : (
        <form className="stack" onSubmit={submit}>
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

          {selectedLot && (
            <div className="pre-form__lot">
              <div>
                <p className="xsmall muted">Prix du lot</p>
                <p className="strong num">{formatMAD(selectedLot.price)}</p>
              </div>
              <div>
                <p className="xsmall muted">Projet</p>
                <p className="strong">{selectedLot.project?.name}</p>
              </div>
            </div>
          )}

          <div className="stack">
            <Field label="Acompte" required hint={depositRatio != null ? `${depositRatio} % du prix` : undefined}>
              {(id) => (
                <div className="input-affix">
                  <input id={id} className="input num" type="number" min="1" step="any" value={form.deposit} onChange={set("deposit")} required />
                  <span className="input-affix__suffix">MAD</span>
                </div>
              )}
            </Field>
            <Field label="Mode de versement de l'acompte" required>
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
            <Field label="Validité" required hint="48 h par défaut. Au-delà, le lot est automatiquement remis en vente.">
              {() => (
                <div className="segmented segmented--full" role="radiogroup" aria-label="Durée de validité">
                  {VALIDITY_OPTIONS.map((option) => (
                    <button
                      key={option.hours}
                      type="button"
                      role="radio"
                      aria-checked={Number(form.validityHours) === option.hours}
                      className={`segmented__item ${Number(form.validityHours) === option.hours ? "is-active" : ""}`}
                      onClick={() => setForm((prev) => ({ ...prev, validityHours: option.hours }))}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </div>
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
          <FormError error={error ?? leads.error ?? lots.error} />
          <Button variant="primary" type="submit" loading={saving} disabled={!form.leadId || !form.lotId || !form.reason.trim() || preselectedLeadIneligible}>
            Pré-réserver le lot
          </Button>
        </form>
      )}
    </Card>
  );
}

function ActivePreReservation({ pre, canWrite, canExtend, onConvert, onCancel, onExtend, onExpire }) {
  const now = useNow(30_000);
  const total = new Date(pre.expiresAt).getTime() - new Date(pre.createdAt).getTime();
  const left = new Date(pre.expiresAt).getTime() - now;
  const ratio = total > 0 ? Math.max(0, left / total) : 0;
  const expired = left <= 0;
  const tone = ratio < 0.15 ? "danger" : ratio < 0.4 ? "warning" : "gold";

  return (
    <article className={`pre-card ${expired ? "is-expired" : ""}`}>
      <div className="pre-card__main">
        <div className="grow">
          <p className="pre-card__client row wrap">
            <Link to={`/leads/${pre.lead?.id}`} className="strong">
              {pre.lead?.name}
            </Link>
            <span className="xsmall faint num">{pre.number}</span>
            {pre.extendedAt && <Badge tone="gold">Prolongée</Badge>}
          </p>
          <p className="small muted">
            Lot <span className="strong">{pre.lot?.ref}</span> · {lotLabel(pre.lot)} · {pre.lot?.project?.name}
          </p>
          <p className="small">
            <span className="muted">Motif :</span> {pre.reason || "—"}
          </p>
          <p className="xsmall faint">
            Créée le {formatDateTime(pre.createdAt)} par {pre.createdByUser?.name ?? "—"}
            {pre.agent && pre.agent.id !== pre.createdByUser?.id ? ` · commercial ${pre.agent.name}` : ""} · expire le {formatDateTime(pre.expiresAt)}
          </p>
        </div>
        <div className="pre-card__money">
          <p className="xsmall muted">Acompte</p>
          <p className="strong num">{formatMAD(pre.deposit)}</p>
          <p className="xsmall faint">{PAYMENT_METHOD[pre.depositMethod]?.label ?? pre.depositMethod}</p>
          <p className="xsmall faint num">sur {formatMAD(pre.lot?.price)}</p>
        </div>
      </div>
      {pre.comments && <p className="note small" style={{ whiteSpace: "pre-line" }}>{pre.comments}</p>}
      <div className="pre-card__timer">
        <Countdown to={pre.expiresAt} onExpire={onExpire} />
        <ProgressBar value={ratio * 100} tone={tone} label="Temps de validité restant" />
      </div>
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
    </article>
  );
}

export default function PreReservationsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const list = useAsync(() => api.preReservations.list(), []);
  const [tab, setTab] = useState("active");
  const [converting, setConverting] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [cancelReason, setCancelReason] = useState("");
  const [extending, setExtending] = useState(null);
  const [extension, setExtension] = useState({ hours: 24, reason: "" });
  const [clientType, setClientType] = useState("particulier");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const canWrite = can(user, "preReservations.write");
  const canExtend = can(user, "preReservations.extend");

  const active = useMemo(() => (list.data ?? []).filter((pre) => pre.status === "active").sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)), [list.data]);
  const history = useMemo(() => (list.data ?? []).filter((pre) => pre.status !== "active"), [list.data]);
  const refresh = useCallback(() => list.reload({ silent: true }), [list.reload]);

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

  return (
    <>
      <PageHeader eyebrow="Commercial" title="Pré-réservations" description="Option temporaire posée sur un lot. À l'expiration du délai, le lot est automatiquement remis en vente." />

      <div className={`pre-layout ${canWrite ? "" : "pre-layout--single"}`}>
        {canWrite && (
          <PreReservationForm
            onCreated={(created) => {
              list.setData((items) => [created, ...(items ?? [])]);
              setTab("active");
              toast.success(`Lot ${created.lot?.ref} pré-réservé pour ${created.lead?.name}.`);
            }}
          />
        )}

        <div className="stack">
          <div className="row-between wrap">
            <Segmented
              label="Statut"
              value={tab}
              onChange={setTab}
              items={[
                { value: "active", label: "En cours", count: active.length },
                { value: "history", label: "Historique", count: history.length },
              ]}
            />
          </div>

          {list.loading && !list.data ? (
            <LoadingBlock rows={3} />
          ) : list.error && !list.data ? (
            <div className="card">
              <ErrorState error={list.error} onRetry={list.reload} />
            </div>
          ) : tab === "active" ? (
            active.length === 0 ? (
              <div className="card">
                <EmptyState icon={Hourglass} title="Aucune pré-réservation en cours" description="Les options posées sur des lots apparaîtront ici avec leur délai restant." />
              </div>
            ) : (
              active.map((pre) => (
                <ActivePreReservation
                  key={pre.id}
                  pre={pre}
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
              ))
            )
          ) : history.length === 0 ? (
            <div className="card">
              <EmptyState compact title="Aucun historique" />
            </div>
          ) : (
            <div className="card">
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
            </div>
          )}
        </div>
      </div>

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
            {() => (
              <div className="segmented segmented--full" role="radiogroup" aria-label="Durée supplémentaire">
                {EXTEND_OPTIONS.map((option) => (
                  <button
                    key={option.hours}
                    type="button"
                    role="radio"
                    aria-checked={extension.hours === option.hours}
                    className={`segmented__item ${extension.hours === option.hours ? "is-active" : ""}`}
                    onClick={() => setExtension((prev) => ({ ...prev, hours: option.hours }))}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
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

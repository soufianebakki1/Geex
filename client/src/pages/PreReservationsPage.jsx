import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { FolderCheck, Hourglass, X } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useNow } from "../hooks/useNow.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import Countdown from "../components/Countdown.jsx";
import { Button, Card, ConfirmDialog, EmptyState, ErrorState, Field, FormError, LoadingBlock, PageHeader, ProgressBar, Segmented, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatMAD, formatNumber, percent } from "../utils/format.js";
import { PRE_RESERVATION_STATUS } from "../utils/status.js";

const VALIDITY_OPTIONS = [3, 7, 15];
const INELIGIBLE_STAGES = ["pre_reserve", "gagne", "perdu"];

function PreReservationForm({ onCreated }) {
  const [params] = useSearchParams();
  const leads = useAsync(() => api.leads.list(), []);
  const lots = useAsync(() => api.lots.list({ status: "disponible" }), []);
  const projects = useAsync(() => api.projects.list(), []);
  const [form, setForm] = useState({ leadId: params.get("leadId") ?? "", projectId: "", lotId: params.get("lotId") ?? "", deposit: "50000", validityDays: 7, note: "" });
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

  const eligibleLeads = (leads.data ?? []).filter((lead) => !INELIGIBLE_STAGES.includes(lead.stage));
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
        validityDays: Number(form.validityDays),
        note: form.note.trim(),
      });
      onCreated(created);
      setForm((prev) => ({ ...prev, leadId: "", lotId: "", note: "" }));
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
          <Field label="Client" required error={preselectedLeadIneligible ? "Ce lead a déjà un engagement en cours ou est clôturé." : undefined}>
            {(id) => (
              <select id={id} className="select" value={form.leadId} onChange={set("leadId")} required>
                <option value="">Sélectionner un lead…</option>
                {eligibleLeads.map((lead) => (
                  <option key={lead.id} value={lead.id}>
                    {lead.firstName} {lead.lastName} — {lead.phone}
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
                    {lot.ref} · {lot.type} {lot.rooms} p. · {formatNumber(lot.surface)} m² · {formatMAD(lot.price)}
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
            <Field label="Validité" required>
              {() => (
                <div className="segmented segmented--full" role="radiogroup" aria-label="Durée de validité">
                  {VALIDITY_OPTIONS.map((days) => (
                    <button
                      key={days}
                      type="button"
                      role="radio"
                      aria-checked={Number(form.validityDays) === days}
                      className={`segmented__item ${Number(form.validityDays) === days ? "is-active" : ""}`}
                      onClick={() => setForm((prev) => ({ ...prev, validityDays: days }))}
                    >
                      {days} jours
                    </button>
                  ))}
                </div>
              )}
            </Field>
          </div>
          <Field label="Note interne">
            {(id) => <textarea id={id} className="textarea" rows={2} value={form.note} onChange={set("note")} placeholder="Conditions particulières, mode de versement de l'acompte…" />}
          </Field>
          <FormError error={error ?? leads.error ?? lots.error} />
          <Button variant="primary" type="submit" loading={saving} disabled={!form.leadId || !form.lotId || preselectedLeadIneligible}>
            Pré-réserver le lot
          </Button>
        </form>
      )}
    </Card>
  );
}

function ActivePreReservation({ pre, canWrite, onConvert, onCancel, onExpire }) {
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
          <p className="pre-card__client">
            <Link to={`/leads/${pre.lead?.id}`} className="strong">
              {pre.lead?.name}
            </Link>
          </p>
          <p className="small muted">
            Lot <span className="strong">{pre.lot?.ref}</span> · {pre.lot?.type} · {pre.lot?.project?.name}
          </p>
          <p className="xsmall faint">
            Créée le {formatDateTime(pre.createdAt)} par {pre.createdByUser?.name ?? "—"} · expire le {formatDateTime(pre.expiresAt)}
          </p>
        </div>
        <div className="pre-card__money">
          <p className="xsmall muted">Acompte</p>
          <p className="strong num">{formatMAD(pre.deposit)}</p>
          <p className="xsmall faint num">sur {formatMAD(pre.lot?.price)}</p>
        </div>
      </div>
      <div className="pre-card__timer">
        <Countdown to={pre.expiresAt} onExpire={onExpire} />
        <ProgressBar value={ratio * 100} tone={tone} label="Temps de validité restant" />
      </div>
      {canWrite && (
        <div className="pre-card__actions">
          <Button variant="ghost" size="sm" icon={X} onClick={() => onCancel(pre)} disabled={expired}>
            Annuler
          </Button>
          <Button variant="dark" size="sm" icon={FolderCheck} onClick={() => onConvert(pre)} disabled={expired}>
            Constituer le dossier
          </Button>
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
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const canWrite = can(user, "preReservations.write");

  const active = useMemo(() => (list.data ?? []).filter((pre) => pre.status === "active").sort((a, b) => a.expiresAt.localeCompare(b.expiresAt)), [list.data]);
  const history = useMemo(() => (list.data ?? []).filter((pre) => pre.status !== "active"), [list.data]);
  const refresh = useCallback(() => list.reload({ silent: true }), [list.reload]);

  async function runAction(kind) {
    setBusy(true);
    setActionError(null);
    try {
      if (kind === "convert") {
        const dossier = await api.preReservations.convert(converting.id);
        toast.success("Dossier ouvert. Ajoutez les pièces justificatives.");
        navigate(`/dossiers/${dossier.id}`);
      } else {
        await api.preReservations.cancel(cancelling.id);
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
                  onExpire={refresh}
                  onConvert={(item) => {
                    setActionError(null);
                    setConverting(item);
                  }}
                  onCancel={(item) => {
                    setActionError(null);
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
                        <td>
                          <div className="cell-primary">{pre.lead?.name}</div>
                        </td>
                        <td>
                          <div>{pre.lot?.ref}</div>
                          <div className="cell-secondary">{pre.lot?.project?.name}</div>
                        </td>
                        <td className="align-right num">{formatMAD(pre.deposit)}</td>
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
      />
      <ConfirmDialog
        open={Boolean(cancelling)}
        title="Annuler la pré-réservation ?"
        description={cancelling ? `Le lot ${cancelling.lot?.ref} sera immédiatement remis en vente. L'acompte de ${formatMAD(cancelling.deposit)} devra être traité séparément.` : ""}
        confirmLabel="Annuler la pré-réservation"
        tone="danger"
        busy={busy}
        error={actionError}
        onClose={() => setCancelling(null)}
        onConfirm={() => runAction("cancel")}
      />
    </>
  );
}

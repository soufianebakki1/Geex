import { useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Ban, BadgeCheck, Check, CheckCheck, ChevronDown, Circle, Clock3, FilePen, FileText, RotateCcw, Trash2, Upload, X, XCircle } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import { Badge, Button, ButtonLink, Card, ConfirmDialog, ErrorState, Field, FormError, LoadingBlock, Modal, PageHeader, ProgressBar, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatFileSize, formatMAD, percent } from "../utils/format.js";
import { DOCUMENT_CATEGORIES, DOCUMENT_STATUS, DOSSIER_CLIENT_TYPE, DOSSIER_STATUS, LOT_TYPE, RESERVATION_STATUS } from "../utils/status.js";

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const STATUS_ICON = { manquant: Circle, en_attente: Clock3, valide: CheckCheck, rejete: XCircle };
const HISTORY_LABEL = { upload: "Téléversée", replace: "Remplacée", remove: "Retirée", validate: "Validée", reject: "Rejetée", unvalidate: "Validation retirée" };
const MAX_DISCOUNT_RATE = 0.15;
const DEFAULT_TERMS = "Acompte à la pré-réservation, 30 % à la signature du compromis, appels de fonds à l'avancement des travaux et solde à la remise des clés.";

function DocumentRow({ doc, locked, canUpload, canValidate, busy, onUpload, onRemove, onStatus, onReject }) {
  const inputRef = useRef(null);
  const [showHistory, setShowHistory] = useState(false);
  const Icon = STATUS_ICON[doc.status] ?? Circle;
  const history = [...(doc.history ?? [])].reverse();

  return (
    <li className={`doc-row doc-row--${doc.status}`}>
      <span className="doc-row__icon">
        <Icon size={15} />
      </span>
      <div className="grow">
        <div className="row wrap">
          <span className="doc-row__label">{doc.label}</span>
          {!doc.required && <Badge tone="outline">Facultative</Badge>}
        </div>
        {doc.fileName ? (
          <>
            <p className="doc-row__file">
              <FileText size={13} />
              <span className="truncate">{doc.fileName}</span>
            </p>
            <p className="doc-row__meta">
              {formatFileSize(doc.fileSize)} · {formatDateTime(doc.uploadedAt)}
              {doc.uploadedByUser ? ` par ${doc.uploadedByUser.name}` : ""}
            </p>
          </>
        ) : (
          <p className="doc-row__file faint">Aucun fichier</p>
        )}
        {doc.status === "valide" && doc.validatedByUser && (
          <p className="xsmall" style={{ color: "var(--success)" }}>
            Validée par {doc.validatedByUser.name} le {formatDate(doc.validatedAt)}
          </p>
        )}
        {doc.status === "rejete" && doc.rejectReason && (
          <p className="xsmall" style={{ color: "var(--danger)" }}>
            Rejetée : {doc.rejectReason}
          </p>
        )}
        {history.length > 0 && (
          <>
            <button type="button" className="link xsmall row" style={{ gap: 4, marginTop: 4 }} onClick={() => setShowHistory((value) => !value)} aria-expanded={showHistory}>
              Historique ({history.length})
              <ChevronDown size={12} style={{ transform: showHistory ? "rotate(180deg)" : undefined }} />
            </button>
            {showHistory && (
              <ul className="history-list" style={{ marginTop: 8 }}>
                {history.map((entry, index) => (
                  <li key={`${entry.at}-${index}`}>
                    <span className="history-list__dot" />
                    <span className="xsmall">
                      <span className="strong">{HISTORY_LABEL[entry.action] ?? entry.action}</span>
                      {entry.detail ? ` — ${entry.detail}` : ""}
                      <span className="faint">
                        {" "}
                        · {formatDateTime(entry.at)} · {entry.user?.name ?? "—"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      <div className="doc-row__actions">
        <StatusBadge map={DOCUMENT_STATUS} value={doc.status} />
        {!locked && (
          <div className="btn-group">
            {canValidate && ["en_attente", "rejete"].includes(doc.status) && (
              <Button size="sm" variant="success" icon={BadgeCheck} loading={busy === "status"} onClick={() => onStatus(doc, "valide")}>
                Valider
              </Button>
            )}
            {canValidate && ["en_attente", "valide"].includes(doc.status) && (
              <Button size="sm" variant="danger-ghost" icon={X} disabled={busy === "status"} onClick={() => onReject(doc)}>
                Rejeter
              </Button>
            )}
            {canValidate && doc.status === "valide" && (
              <Button size="sm" variant="ghost" icon={RotateCcw} loading={busy === "status"} onClick={() => onStatus(doc, "en_attente")}>
                Annuler la validation
              </Button>
            )}
            {canUpload && doc.status !== "valide" && (
              <>
                <input
                  ref={inputRef}
                  type="file"
                  accept={ACCEPT}
                  hidden
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = "";
                    if (file) onUpload(doc, file);
                  }}
                />
                <Button size="sm" variant={doc.fileName ? "ghost" : "secondary"} icon={Upload} loading={busy === "upload"} onClick={() => inputRef.current?.click()}>
                  {doc.fileName ? "Remplacer" : "Téléverser"}
                </Button>
                {doc.fileName && <Button size="sm" variant="danger-ghost" iconOnly icon={Trash2} loading={busy === "remove"} onClick={() => onRemove(doc)} aria-label={`Retirer ${doc.label}`} title="Retirer" />}
              </>
            )}
          </div>
        )}
      </div>
    </li>
  );
}

function ReservationModal({ open, dossier, onClose }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [form, setForm] = useState({ discount: "", discountReason: "", paymentTerms: DEFAULT_TERMS });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const listPrice = dossier.lot?.price ?? 0;
  const discount = Number(form.discount) || 0;
  const maxDiscount = Math.floor(listPrice * MAX_DISCOUNT_RATE);
  const set = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  async function submit(event) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const reservation = await api.reservations.create({ dossierId: dossier.id, discount, discountReason: form.discountReason.trim(), paymentTerms: form.paymentTerms.trim() });
      toast.success(
        reservation.discountPending
          ? `Réservation ${reservation.number} créée. La remise doit être approuvée par la direction avant la signature.`
          : `Réservation ${reservation.number} créée. Elle peut maintenant être signée.`,
      );
      navigate(`/reservations/${reservation.id}`);
    } catch (err) {
      setError(err);
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      busy={saving}
      title="Créer la réservation"
      subtitle={`${dossier.lead?.name} · lot ${dossier.lot?.ref}`}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button variant="primary" type="submit" form="reservation-form" loading={saving}>
            Créer la réservation
          </Button>
        </>
      }
    >
      <form id="reservation-form" className="stack" onSubmit={submit}>
        <div className="pre-form__lot">
          <div>
            <p className="xsmall muted">Prix catalogue</p>
            <p className="strong num">{formatMAD(listPrice)}</p>
          </div>
          <div>
            <p className="xsmall muted">Prix de vente</p>
            <p className="strong num">{formatMAD(Math.max(listPrice - discount, 0))}</p>
          </div>
        </div>
        <Field label="Remise" hint={`${discount ? `${percent(discount, listPrice)} % du prix · ` : ""}maximum ${formatMAD(maxDiscount)} (15 %). Toute remise est soumise à l'approbation de la direction.`}>
          {(id) => (
            <div className="input-affix">
              <input id={id} className="input num" type="number" min="0" max={maxDiscount} step="any" value={form.discount} onChange={set("discount")} placeholder="0" />
              <span className="input-affix__suffix">MAD</span>
            </div>
          )}
        </Field>
        {discount > 0 && (
          <Field label="Motif de la remise" required>
            {(id) => <input id={id} className="input" value={form.discountReason} onChange={set("discountReason")} required placeholder="Paiement comptant, client fidèle…" />}
          </Field>
        )}
        <Field label="Modalités de paiement">
          {(id) => <textarea id={id} className="textarea" rows={3} value={form.paymentTerms} onChange={set("paymentTerms")} />}
        </Field>
        <FormError error={error} />
      </form>
    </Modal>
  );
}

export default function DossierDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const dossier = useAsync(() => api.dossiers.get(id), [id]);
  const [busy, setBusy] = useState({});
  const [creating, setCreating] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectError, setRejectError] = useState(null);
  const [docReject, setDocReject] = useState(null);
  const [docReason, setDocReason] = useState("");
  const [docError, setDocError] = useState(null);

  const groups = useMemo(() => {
    const map = new Map();
    (dossier.data?.documents ?? []).forEach((doc) => map.set(doc.categorie, [...(map.get(doc.categorie) ?? []), doc]));
    return [...map];
  }, [dossier.data]);

  async function rejectDossier() {
    if (!rejectReason.trim()) return setRejectError("Indiquez le motif du rejet.");
    setRejecting(true);
    setRejectError(null);
    try {
      const updated = await api.dossiers.cancel(id, rejectReason.trim());
      dossier.setData(updated);
      setRejectOpen(false);
      toast.success(`Dossier rejeté, le lot ${updated.lot?.ref} est remis en vente.`);
    } catch (error) {
      setRejectError(errorMessage(error));
    } finally {
      setRejecting(false);
    }
  }

  const run = async (key, kind, action, successMessage) => {
    setBusy((prev) => ({ ...prev, [key]: kind }));
    try {
      const updated = await action();
      dossier.setData(updated);
      if (successMessage) toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(errorMessage(error));
      return false;
    } finally {
      setBusy((prev) => ({ ...prev, [key]: null }));
    }
  };

  function upload(doc, file) {
    if (file.size > MAX_SIZE) return toast.error("Le fichier dépasse la taille maximale de 10 Mo.");
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) return toast.error("Formats acceptés : PDF, JPG ou PNG.");
    return run(doc.key, "upload", () => api.dossiers.uploadDocument(id, doc.key, file), `${doc.label} : fichier reçu.`);
  }

  async function confirmDocReject() {
    if (!docReason.trim()) return setDocError("Indiquez le motif du rejet de la pièce.");
    const ok = await run(docReject.key, "status", () => api.dossiers.setDocumentStatus(id, docReject.key, "rejete", docReason.trim()), `${docReject.label} rejetée.`);
    if (ok) setDocReject(null);
  }

  if (dossier.loading && !dossier.data) {
    return (
      <>
        <PageHeader back={{ to: "/dossiers", label: "Dossiers" }} title="Chargement…" />
        <LoadingBlock rows={6} />
      </>
    );
  }
  if (dossier.error && !dossier.data) {
    return (
      <>
        <PageHeader back={{ to: "/dossiers", label: "Dossiers" }} title="Dossier" />
        <div className="card">
          <ErrorState error={dossier.error} onRetry={dossier.reload} />
        </div>
      </>
    );
  }

  const data = dossier.data;
  const { state } = data;
  const rejected = state.status === "rejete";
  const activeReservation = data.reservation && data.reservation.status !== "annulee" ? data.reservation : null;
  const locked = rejected || Boolean(activeReservation && activeReservation.status !== "en_attente");
  const missing = data.documents.filter((doc) => doc.required && !["en_attente", "valide"].includes(doc.status));
  const canCreate = can(user, "reservations.confirm") && !rejected && !activeReservation && missing.length === 0;
  const canReject = can(user, "preReservations.write") && !locked;

  return (
    <>
      <PageHeader
        back={{ to: "/dossiers", label: "Dossiers" }}
        title={data.lead?.name ?? "Dossier"}
        meta={
          <>
            <StatusBadge map={DOSSIER_STATUS} value={state.status} />
            {data.preReservationNumber && <Badge tone="outline">{data.preReservationNumber}</Badge>}
            <Badge tone="outline">{DOSSIER_CLIENT_TYPE[data.clientType]?.label ?? data.clientType}</Badge>
            <span className="xsmall faint">Ouvert le {formatDate(data.createdAt)}</span>
          </>
        }
        actions={
          <>
            {canReject && (
              <Button
                variant="danger-ghost"
                icon={Ban}
                onClick={() => {
                  setRejectReason("");
                  setRejectError(null);
                  setRejectOpen(true);
                }}
              >
                Rejeter le dossier
              </Button>
            )}
            {activeReservation ? (
              <ButtonLink to={`/reservations/${activeReservation.id}`} variant="dark" icon={FilePen}>
                Réservation {activeReservation.number}
              </ButtonLink>
            ) : (
              can(user, "reservations.confirm") &&
              !rejected && (
                <Button variant="primary" icon={FilePen} onClick={() => setCreating(true)} disabled={!canCreate}>
                  Créer la réservation
                </Button>
              )
            )}
          </>
        }
      />

      {rejected && (
        <div className="callout callout--danger" style={{ marginBottom: 20 }}>
          <Ban size={16} />
          <span>
            Dossier rejeté le {formatDate(data.rejectedAt)}
            {data.rejectedByUser ? ` par ${data.rejectedByUser.name}` : ""} — motif : {data.rejectReason}. Le lot a été remis en vente.
          </span>
        </div>
      )}

      <div className="detail-grid detail-grid--wide-main">
        <div className="stack">
          <Card title="Bien concerné">
            <dl className="dl">
              <dt>Lot</dt>
              <dd>
                {data.lot?.ref} · {LOT_TYPE[data.lot?.type]?.label ?? data.lot?.type}
              </dd>
              <dt>Projet</dt>
              <dd>
                {data.lot?.project?.name}
                {(data.lot?.tranche || data.lot?.building) && <div className="xsmall muted">{[data.lot?.tranche?.name, data.lot?.building?.name].filter(Boolean).join(" · ")}</div>}
              </dd>
              <dt>Prix</dt>
              <dd className="num">{formatMAD(data.lot?.price)}</dd>
              <dt>Acompte versé</dt>
              <dd className="num">{formatMAD(data.deposit)}</dd>
              <dt>Client</dt>
              <dd>
                {can(user, "leads") ? (
                  <Link to={`/leads/${data.lead?.id}`} className="link">
                    {data.lead?.name}
                  </Link>
                ) : (
                  data.lead?.name
                )}
                <div className="xsmall muted">{data.lead?.phone}</div>
              </dd>
              <dt>Commercial</dt>
              <dd>{data.agent?.name ?? "—"}</dd>
            </dl>
          </Card>

          <Card title="Avancement">
            <div className="stack-sm">
              <div className="row-between">
                <span className="small">Pièces obligatoires reçues</span>
                <span className="strong num">
                  {state.received} / {state.required}
                </span>
              </div>
              <ProgressBar value={state.received} max={state.required} tone={state.received === state.required ? "success" : "gold"} size="lg" />
              <div className="row-between">
                <span className="small">Pièces validées par la comptabilité</span>
                <span className="strong num">
                  {state.validated} / {state.required}
                </span>
              </div>
              <ProgressBar value={state.validated} max={state.required} tone="success" />
              {state.rejected > 0 && (
                <p className="xsmall" style={{ color: "var(--danger)" }}>
                  {state.rejected} pièce(s) rejetée(s) à remplacer.
                </p>
              )}
            </div>
            <div className="divider" />
            {rejected ? null : activeReservation ? (
              <div className="callout callout--success">
                <BadgeCheck size={16} />
                <span>
                  Réservation {activeReservation.number} — <StatusBadge map={RESERVATION_STATUS} value={activeReservation.status} dot={false} />
                  {locked && <span className="block xsmall"> Le dossier est verrouillé.</span>}
                </span>
              </div>
            ) : missing.length > 0 ? (
              <div className="callout callout--warning">
                <Circle size={16} />
                <span>
                  Pièces à fournir avant réservation : <strong>{missing.map((doc) => doc.label.split(" (")[0]).join(", ")}</strong>.
                </span>
              </div>
            ) : (
              <div className="callout callout--info">
                <Check size={16} />
                <span>
                  {state.status === "valide"
                    ? `Dossier validé${data.validatedAt ? ` le ${formatDate(data.validatedAt)}` : ""}. La réservation peut être créée et signée.`
                    : "Dossier complet. La réservation peut être créée ; sa signature exige la validation des pièces par la comptabilité."}
                </span>
              </div>
            )}
          </Card>
        </div>

        <Card title="Pièces justificatives" subtitle={`Liste ${DOSSIER_CLIENT_TYPE[data.clientType]?.label.toLowerCase() ?? ""} — PDF, JPG ou PNG, 10 Mo maximum par fichier.`}>
          <div className="stack">
            {groups.map(([category, docs]) => (
              <div key={category}>
                <p className="section-title">{DOCUMENT_CATEGORIES[category] ?? category}</p>
                <ul className="doc-list">
                  {docs.map((doc) => (
                    <DocumentRow
                      key={doc.key}
                      doc={doc}
                      locked={locked}
                      busy={busy[doc.key]}
                      canUpload={can(user, "dossiers.upload")}
                      canValidate={can(user, "dossiers.validate")}
                      onUpload={upload}
                      onRemove={(item) => run(item.key, "remove", () => api.dossiers.removeDocument(id, item.key), `${item.label} : fichier retiré.`)}
                      onStatus={(item, status) => run(item.key, "status", () => api.dossiers.setDocumentStatus(id, item.key, status), status === "valide" ? `${item.label} validée.` : "Validation retirée.")}
                      onReject={(item) => {
                        setDocReason("");
                        setDocError(null);
                        setDocReject(item);
                      }}
                    />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {creating && <ReservationModal open={creating} dossier={data} onClose={() => setCreating(false)} />}

      <ConfirmDialog
        open={Boolean(docReject)}
        title={`Rejeter « ${docReject?.label ?? ""} » ?`}
        description="Le commercial sera notifié et devra fournir une nouvelle pièce."
        confirmLabel="Rejeter la pièce"
        tone="danger"
        busy={busy[docReject?.key] === "status"}
        error={docError}
        onClose={() => setDocReject(null)}
        onConfirm={confirmDocReject}
      >
        <Field label="Motif du rejet" required>
          {(fieldId) => <textarea id={fieldId} className="textarea" rows={2} value={docReason} onChange={(event) => setDocReason(event.target.value)} placeholder="Document illisible, expiré, incomplet…" />}
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={rejectOpen}
        title="Rejeter le dossier ?"
        description={`Le lot ${data.lot?.ref} sera immédiatement remis en vente${activeReservation ? ` et la réservation ${activeReservation.number} sera annulée` : ""}. L'acompte de ${formatMAD(data.deposit)} devra être traité séparément.`}
        confirmLabel="Rejeter le dossier"
        tone="danger"
        busy={rejecting}
        error={rejectError}
        onClose={() => setRejectOpen(false)}
        onConfirm={rejectDossier}
      >
        <Field label="Motif du rejet" required>
          {(fieldId) => <textarea id={fieldId} className="textarea" rows={2} value={rejectReason} onChange={(event) => setRejectReason(event.target.value)} placeholder="Client renonce, dossier non constitué dans les délais…" />}
        </Field>
      </ConfirmDialog>
    </>
  );
}

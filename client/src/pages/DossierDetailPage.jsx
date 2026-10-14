import { useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BadgeCheck, Check, CheckCheck, Circle, FilePen, FileText, RotateCcw, Trash2, Upload } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import { Badge, Button, ButtonLink, Card, ErrorState, LoadingBlock, PageHeader, ProgressBar, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatFileSize, formatMAD } from "../utils/format.js";
import { DOCUMENT_STATUS, DOSSIER_STATUS, RESERVATION_STATUS } from "../utils/status.js";

const MAX_SIZE = 10 * 1024 * 1024;
const ACCEPT = ".pdf,.jpg,.jpeg,.png";
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const STATUS_ICON = { manquant: Circle, recu: Check, valide: CheckCheck };

function DocumentRow({ doc, locked, canUpload, canValidate, busy, onUpload, onRemove, onStatus }) {
  const inputRef = useRef(null);
  const Icon = STATUS_ICON[doc.status];

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
      </div>

      <div className="doc-row__actions">
        <StatusBadge map={DOCUMENT_STATUS} value={doc.status} />
        {!locked && (
          <div className="btn-group">
            {canValidate && doc.status === "recu" && (
              <Button size="sm" variant="success" icon={BadgeCheck} loading={busy === "status"} onClick={() => onStatus(doc, "valide")}>
                Valider
              </Button>
            )}
            {canValidate && doc.status === "valide" && (
              <Button size="sm" variant="ghost" icon={RotateCcw} loading={busy === "status"} onClick={() => onStatus(doc, "recu")}>
                Annuler la validation
              </Button>
            )}
            {canUpload && (
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

export default function DossierDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const dossier = useAsync(() => api.dossiers.get(id), [id]);
  const [busy, setBusy] = useState({});
  const [creating, setCreating] = useState(false);

  const run = async (key, kind, action, successMessage) => {
    setBusy((prev) => ({ ...prev, [key]: kind }));
    try {
      const updated = await action();
      dossier.setData(updated);
      if (successMessage) toast.success(successMessage);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy((prev) => ({ ...prev, [key]: null }));
    }
  };

  function upload(doc, file) {
    if (file.size > MAX_SIZE) return toast.error("Le fichier dépasse la taille maximale de 10 Mo.");
    if (file.type && !ACCEPTED_TYPES.includes(file.type)) return toast.error("Formats acceptés : PDF, JPG ou PNG.");
    return run(doc.key, "upload", () => api.dossiers.uploadDocument(id, doc.key, file), `${doc.label} : fichier reçu.`);
  }

  async function createReservation() {
    setCreating(true);
    try {
      const reservation = await api.reservations.create(id);
      toast.success(`Réservation ${reservation.number} créée. Elle doit maintenant être confirmée.`);
      navigate(`/reservations/${reservation.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setCreating(false);
    }
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
  const locked = data.reservation?.status === "confirmee";
  const missing = data.documents.filter((doc) => doc.required && doc.status === "manquant");
  const canCreate = can(user, "reservations.confirm") && !data.reservation && missing.length === 0;

  return (
    <>
      <PageHeader
        back={{ to: "/dossiers", label: "Dossiers" }}
        eyebrow="Dossier de réservation"
        title={data.lead?.name ?? "Dossier"}
        meta={
          <>
            <StatusBadge map={DOSSIER_STATUS} value={state.status} />
            <span className="xsmall faint">Ouvert le {formatDate(data.createdAt)}</span>
          </>
        }
        actions={
          data.reservation ? (
            <ButtonLink to={`/reservations/${data.reservation.id}`} variant="dark" icon={FilePen}>
              Réservation {data.reservation.number}
            </ButtonLink>
          ) : (
            can(user, "reservations.confirm") && (
              <Button variant="primary" icon={FilePen} onClick={createReservation} loading={creating} disabled={!canCreate}>
                Créer la réservation
              </Button>
            )
          )
        }
      />

      <div className="detail-grid detail-grid--wide-main">
        <div className="stack">
          <Card title="Bien concerné">
            <dl className="dl">
              <dt>Lot</dt>
              <dd>
                {data.lot?.ref} · {data.lot?.type}
              </dd>
              <dt>Projet</dt>
              <dd>{data.lot?.project?.name}</dd>
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
            </div>
            <div className="divider" />
            {data.reservation ? (
              <div className="callout callout--success">
                <BadgeCheck size={16} />
                <span>
                  Réservation {data.reservation.number} — <StatusBadge map={RESERVATION_STATUS} value={data.reservation.status} dot={false} />
                  {locked && <span className="block xsmall"> Le dossier est verrouillé.</span>}
                </span>
              </div>
            ) : missing.length > 0 ? (
              <div className="callout callout--warning">
                <Circle size={16} />
                <span>
                  Pièces manquantes avant réservation : <strong>{missing.map((doc) => doc.label.split(" (")[0]).join(", ")}</strong>.
                </span>
              </div>
            ) : (
              <div className="callout callout--info">
                <Check size={16} />
                <span>Toutes les pièces obligatoires sont reçues. La réservation peut être créée.</span>
              </div>
            )}
          </Card>
        </div>

        <Card title="Pièces justificatives" subtitle="PDF, JPG ou PNG — 10 Mo maximum par fichier.">
          <ul className="doc-list">
            {data.documents.map((doc) => (
              <DocumentRow
                key={doc.key}
                doc={doc}
                locked={locked}
                busy={busy[doc.key]}
                canUpload={can(user, "dossiers.upload")}
                canValidate={can(user, "dossiers.validate")}
                onUpload={upload}
                onRemove={(item) => run(item.key, "remove", () => api.dossiers.removeDocument(id, item.key), `${item.label} : fichier retiré.`)}
                onStatus={(item, status) =>
                  run(item.key, "status", () => api.dossiers.setDocumentStatus(id, item.key, status), status === "valide" ? `${item.label} validée.` : "Validation retirée.")
                }
              />
            ))}
          </ul>
        </Card>
      </div>
    </>
  );
}

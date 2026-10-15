import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, Ban, CalendarClock, Check, FileText, Flag, Lock, Percent, Printer, Wallet, X } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import Logo from "../components/Logo.jsx";
import { SourceMark, bankName } from "../components/payments/BankLogo.jsx";
import { Button, ButtonLink, Card, ConfirmDialog, ErrorState, Field, LoadingBlock, PageHeader, ProgressBar, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatMAD, formatNumber, percent } from "../utils/format.js";
import { DOSSIER_CLIENT_TYPE, INSTALLMENT_STATUS, LOT_TYPE, PAYMENT_METHOD, PAYMENT_STATUS, RESERVATION_END_STATUSES, RESERVATION_STATUS } from "../utils/status.js";

const SIGNED = ["active", "cloturee"];
const END_HINTS = {
  cloturee: "Solde réglé : le lot passe en « Vendu » et le client en « Clôturé ».",
  desistement: "Le client renonce : le lot est remis en vente, les échéances restantes sont annulées.",
  change_ref: "Le client change de bien : le lot est remis en vente et le lead revient en négociation.",
  resiliation: "Résiliation du contrat : le lot est remis en vente, les échéances restantes sont annulées.",
};

const lotDesignation = (lot) => [LOT_TYPE[lot?.type]?.label ?? lot?.type, lot?.tranche?.name, lot?.building?.name].filter(Boolean).join(" · ");

function Bulletin({ reservation }) {
  const { lead, lot, project, installments } = reservation;
  const promoter = project?.promoter;
  const legal = [promoter?.rc && `RC ${promoter.rc}`, promoter?.ifNumber && `IF ${promoter.ifNumber}`, promoter?.ice && `ICE ${promoter.ice}`].filter(Boolean).join(" · ");
  return (
    <section className="bulletin" aria-label="Bulletin de réservation">
      <header className="bulletin__head">
        <Logo tone="dark" size={72} />
        <div className="bulletin__ref">
          <p className="bulletin__title">Bulletin de réservation</p>
          <p className="num">N° {reservation.bulletinNumber}</p>
          <p className="xsmall muted">
            Réservation {reservation.number} · édité le {formatDateTime(reservation.bulletinGeneratedAt)}
          </p>
        </div>
      </header>

      <div className="bulletin__parties">
        <div>
          <p className="bulletin__label">Le réservant</p>
          <p className="strong">{promoter?.name ?? "Konouz Immobilier"}</p>
          {promoter?.group && <p className="xsmall muted">{promoter.group}</p>}
          {promoter?.address && <p>{promoter.address}</p>}
          {legal && <p className="xsmall muted">{legal}</p>}
        </div>
        <div>
          <p className="bulletin__label">Le réservataire</p>
          <p className="strong">{lead?.name}</p>
          <p>{lead?.phone}</p>
          {lead?.email && <p>{lead.email}</p>}
          {lead?.address && <p>{lead.address}</p>}
        </div>
      </div>

      <div className="bulletin__section">
        <p className="bulletin__label">Désignation du bien</p>
        <table className="bulletin__table">
          <tbody>
            <tr>
              <th>Programme</th>
              <td>
                {project?.name} — {project?.city}
              </td>
              <th>Lot</th>
              <td>{lot?.ref}</td>
            </tr>
            <tr>
              <th>Désignation</th>
              <td>
                {lotDesignation(lot)}
                {lot?.floor != null ? `, étage ${lot.floor}` : ""}
              </td>
              <th>Surface</th>
              <td className="num">{formatNumber(lot?.surface)} m²</td>
            </tr>
            <tr>
              <th>Titre foncier mère</th>
              <td className="num">{project?.tfMere || "—"}</td>
              <th>Livraison prévue</th>
              <td>{formatDate(project?.deliveryDate)}</td>
            </tr>
            <tr>
              <th>Prix catalogue</th>
              <td className="num">{formatMAD(reservation.listPrice)}</td>
              <th>Prix de vente</th>
              <td className="num strong">
                {formatMAD(reservation.price)}
                {reservation.discount > 0 && <span className="xsmall muted"> (remise {formatMAD(reservation.discount)})</span>}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bulletin__section">
        <p className="bulletin__label">Modalités de paiement</p>
        {reservation.paymentTerms && <p className="small" style={{ marginBottom: 10 }}>{reservation.paymentTerms}</p>}
        <table className="bulletin__table bulletin__table--list">
          <thead>
            <tr>
              <th>Échéance</th>
              <th>Date</th>
              <th className="align-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {installments
              .filter((item) => !item.cancelled)
              .map((item) => (
                <tr key={item.id}>
                  <td>{item.label}</td>
                  <td>{formatDate(item.dueDate)}</td>
                  <td className="align-right num">{formatMAD(item.amount)}</td>
                </tr>
              ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}>Total</td>
              <td className="align-right num">{formatMAD(reservation.price)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="bulletin__legal">
        Le réservataire reconnaît avoir versé un acompte de {formatMAD(reservation.deposit)} à titre de réservation du bien désigné ci-dessus. La présente réservation sera
        réitérée par la signature d'un compromis de vente dans un délai de quinze jours.
      </p>

      <div className="bulletin__signatures">
        <div>
          <p className="bulletin__label">Pour le réservant</p>
          <div className="bulletin__sign-box" />
        </div>
        <div>
          <p className="bulletin__label">Le réservataire — « Lu et approuvé »</p>
          <div className="bulletin__sign-box" />
        </div>
      </div>
    </section>
  );
}

export default function ReservationDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const toast = useToast();
  const reservation = useAsync(() => api.reservations.get(id), [id]);
  const [dialog, setDialog] = useState(null);
  const [reason, setReason] = useState("");
  const [endStatus, setEndStatus] = useState("cloturee");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const canSign = can(user, "reservations.confirm");
  const canApprove = can(user, "reservations.approveDiscount");
  const canClose = can(user, "reservations.close");

  function open(kind) {
    setError(null);
    setReason("");
    if (kind === "close") setEndStatus(reservation.data.totals.remaining > 0 ? "desistement" : "cloturee");
    setDialog(kind);
  }

  async function act(kind, action, message) {
    setBusy(kind);
    setError(null);
    try {
      const updated = await action();
      reservation.setData(updated);
      setDialog(null);
      toast.success(typeof message === "function" ? message(updated) : message);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function generateBulletin() {
    setBusy("bulletin");
    try {
      const updated = await api.reservations.generateBulletin(id);
      reservation.setData(updated);
      toast.success(`Bulletin ${updated.bulletinNumber} généré.`);
      requestAnimationFrame(() => document.querySelector(".bulletin")?.scrollIntoView({ behavior: "smooth", block: "start" }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  if (reservation.loading && !reservation.data) {
    return (
      <>
        <PageHeader back={{ to: "/reservations", label: "Réservations" }} title="Chargement…" />
        <LoadingBlock rows={6} />
      </>
    );
  }
  if (reservation.error && !reservation.data) {
    return (
      <>
        <PageHeader back={{ to: "/reservations", label: "Réservations" }} title="Réservation" />
        <div className="card">
          <ErrorState error={reservation.error} onRetry={reservation.reload} />
        </div>
      </>
    );
  }

  const data = reservation.data;
  const pending = data.status === "en_attente";
  const signed = SIGNED.includes(data.status);
  const ended = Boolean(data.endedAt);
  const paidPct = percent(data.totals.paid, data.price);
  const docsToValidate = data.dossier ? data.dossier.state.required - data.dossier.state.validated : 0;
  const canGenerate = canSign && signed;

  return (
    <>
      <PageHeader
        back={{ to: "/reservations", label: "Réservations" }}
        eyebrow={`Réservation ${data.number}`}
        title={data.lead?.name}
        meta={
          <>
            <StatusBadge map={RESERVATION_STATUS} value={data.status} />
            <span className="xsmall faint">
              {data.signedAt ? `Signée le ${formatDate(data.signedAt)}${data.signedByUser ? ` par ${data.signedByUser.name}` : ""}` : `Créée le ${formatDate(data.createdAt)}`}
              {data.agent ? ` · commercial ${data.agent.name}` : ""}
            </span>
          </>
        }
        actions={
          <>
            {pending && canApprove && data.discountPending && (
              <>
                <Button variant="danger-ghost" icon={X} onClick={() => open("rejectDiscount")}>
                  Refuser la remise
                </Button>
                <Button variant="dark" icon={Percent} onClick={() => open("approveDiscount")}>
                  Approuver la remise
                </Button>
              </>
            )}
            {pending && canSign && (
              <Button variant="primary" icon={BadgeCheck} disabled={docsToValidate > 0 || data.discountPending} onClick={() => open("sign")}>
                Signer la réservation
              </Button>
            )}
            {data.status === "active" && canClose && (
              <Button variant="secondary" icon={Flag} onClick={() => open("close")}>
                Clôturer / interrompre
              </Button>
            )}
            {canGenerate && (
              <Button variant={data.bulletinNumber ? "secondary" : "primary"} icon={FileText} onClick={generateBulletin} loading={busy === "bulletin"} disabled={data.blocked}>
                {data.bulletinNumber ? "Régénérer le bulletin" : "Générer le bulletin"}
              </Button>
            )}
            {data.bulletinNumber && signed && (
              <Button variant="dark" icon={Printer} onClick={() => window.print()}>
                Imprimer / PDF
              </Button>
            )}
          </>
        }
      />

      {pending && (
        <div className="callout callout--warning" style={{ marginBottom: 20 }}>
          <BadgeCheck size={16} />
          <span>
            {data.discountPending
              ? `Signature impossible : la remise de ${formatMAD(data.discount)} (${data.discountReason}) doit d'abord être approuvée par la direction.`
              : docsToValidate > 0
                ? `Signature impossible : ${docsToValidate} pièce(s) obligatoire(s) du dossier doivent encore être validées par la comptabilité.`
                : `Cette réservation attend sa signature. La signature passe le lot ${data.lot?.ref} en « Réservé », le client en « Signé », génère l'échéancier et transmet l'acompte à la comptabilité.`}
          </span>
        </div>
      )}

      {ended && (
        <div className={`callout ${data.status === "cloturee" ? "callout--success" : "callout--danger"}`} style={{ marginBottom: 20 }}>
          {data.status === "cloturee" ? <Check size={16} /> : <Ban size={16} />}
          <span>
            {RESERVATION_STATUS[data.status]?.label} le {formatDate(data.endedAt)}
            {data.endedByUser ? ` par ${data.endedByUser.name}` : ""} — {data.endReason}
          </span>
        </div>
      )}

      {data.blocked && (
        <div className="callout callout--danger" style={{ marginBottom: 20 }}>
          <Lock size={16} />
          <span>
            Dossier bloqué : {data.blockedReason}. Relancez le client et enregistrez un nouveau paiement ; le dossier se débloque dès sa validation par la comptabilité.
          </span>
        </div>
      )}

      <div className="detail-grid">
        <div className="stack">
          <Card title="Acquéreur">
            <dl className="dl">
              <dt>Nom</dt>
              <dd>
                {can(user, "leads") ? (
                  <Link to={`/leads/${data.lead?.id}`} className="link">
                    {data.lead?.name}
                  </Link>
                ) : (
                  data.lead?.name
                )}
              </dd>
              <dt>Téléphone</dt>
              <dd className="num">{data.lead?.phone}</dd>
              <dt>Email</dt>
              <dd>{data.lead?.email || <span className="faint">—</span>}</dd>
              <dt>Adresse</dt>
              <dd>{data.lead?.address || <span className="faint">—</span>}</dd>
              <dt>Type de dossier</dt>
              <dd>{DOSSIER_CLIENT_TYPE[data.dossier?.clientType]?.label ?? "—"}</dd>
            </dl>
          </Card>
          <Card title="Bien réservé">
            <dl className="dl">
              <dt>Programme</dt>
              <dd>
                {data.project?.name} · {data.project?.city}
              </dd>
              <dt>Lot</dt>
              <dd>
                {data.lot?.ref} · {lotDesignation(data.lot)}
              </dd>
              <dt>Surface</dt>
              <dd className="num">{formatNumber(data.lot?.surface)} m²</dd>
              <dt>TF mère</dt>
              <dd className="num">{data.project?.tfMere || <span className="faint">—</span>}</dd>
              <dt>Livraison</dt>
              <dd>{formatDate(data.project?.deliveryDate)}</dd>
              <dt>Promoteur</dt>
              <dd>{data.project?.promoter?.name ?? "—"}</dd>
              <dt>Dossier</dt>
              <dd>
                {data.dossier ? (
                  <Link to={`/dossiers/${data.dossier.id}`} className="link">
                    {data.dossier.state.validated}/{data.dossier.state.required} pièces validées
                  </Link>
                ) : (
                  "—"
                )}
              </dd>
            </dl>
          </Card>
          {data.paymentTerms && (
            <Card title="Modalités de paiement">
              <p className="small">{data.paymentTerms}</p>
            </Card>
          )}
        </div>

        <div className="stack">
          <Card title="Conditions financières">
            <div className="finance-strip">
              <div>
                <p className="xsmall muted">Prix de vente</p>
                <p className="finance-strip__value num">{formatMAD(data.price)}</p>
                {data.discount > 0 && <p className="xsmall faint num">catalogue {formatMAD(data.listPrice)}</p>}
              </div>
              <div>
                <p className="xsmall muted">Encaissé (validé)</p>
                <p className="finance-strip__value num" style={{ color: "var(--success)" }}>
                  {formatMAD(data.totals.paid)}
                </p>
              </div>
              <div>
                <p className="xsmall muted">Reste à payer</p>
                <p className="finance-strip__value num">{formatMAD(data.totals.remaining)}</p>
              </div>
            </div>
            <ProgressBar value={paidPct} tone="success" size="lg" label="Part encaissée" />
            <div className="row-between" style={{ marginTop: 8 }}>
              <span className="xsmall muted">{paidPct} % encaissé</span>
              {data.totals.pending > 0 && <span className="xsmall" style={{ color: "var(--warning)" }}>{formatMAD(data.totals.pending)} en attente de validation</span>}
            </div>
            {data.discount > 0 && (
              <p className="note small" style={{ marginTop: 14 }}>
                Remise de <strong className="num">{formatMAD(data.discount)}</strong> ({percent(data.discount, data.listPrice)} %) — {data.discountReason.replace(/[.\s]+$/, "")}.{" "}
                {data.approvedByUser ? `Approuvée par ${data.approvedByUser.name} le ${formatDate(data.approvedAt)}.` : "En attente d'approbation."}
              </p>
            )}
            {data.totals.overdue > 0 && (
              <div className="callout callout--danger" style={{ marginTop: 14 }}>
                <CalendarClock size={16} />
                <span>{formatMAD(data.totals.overdue)} d'échéances en retard.</span>
              </div>
            )}
          </Card>

          {data.installments.length > 0 && (
            <Card title="Échéancier" actions={can(user, "schedule") && <Link to={`/echeancier?reservationId=${data.id}`} className="link small">Suivi détaillé</Link>} flush>
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {data.installments.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="cell-primary">{item.label}</div>
                          <div className="cell-secondary">{formatDate(item.dueDate)}</div>
                        </td>
                        <td className="align-right nowrap">
                          <div className="num">{formatMAD(item.amount)}</div>
                          {item.balance > 0 && item.balance < item.amount && <div className="cell-secondary num">reste {formatMAD(item.balance)}</div>}
                        </td>
                        <td className="cell-actions">
                          <StatusBadge map={INSTALLMENT_STATUS} value={item.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {signed && (
            <Card
              title="Paiements"
              actions={data.status === "active" && can(user, "payments.create") && <ButtonLink to={`/paiements?reservationId=${data.id}`} size="sm" icon={Wallet}>Enregistrer</ButtonLink>}
              flush
            >
              {data.payments.length === 0 ? (
                <p className="card__body muted small">Aucun paiement enregistré.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <tbody>
                      {data.payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>
                            <div className="row" style={{ gap: 10, flexWrap: "nowrap" }}>
                              <SourceMark payment={payment} size={28} />
                              <div>
                                <div className="cell-primary">{payment.reference}</div>
                                <div className="cell-secondary">
                                  {PAYMENT_METHOD[payment.method]?.label ?? payment.method} · {formatDate(payment.date)}
                                  {payment.origin === "international" ? ` · ${payment.country}, ${payment.foreignAmount?.toLocaleString("fr-FR")} ${payment.currency}` : payment.bank ? ` · ${bankName(payment)}` : ""}
                                  {payment.installment ? ` · ${payment.installment.label}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="align-right num nowrap">{formatMAD(payment.amount)}</td>
                          <td className="cell-actions">
                            <StatusBadge map={PAYMENT_STATUS} value={payment.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {signed &&
        (data.bulletinNumber ? (
          <div className="bulletin-wrap">
            <div className="row-between bulletin-wrap__bar">
              <h2 className="card__title">Aperçu du bulletin</h2>
              <span className="xsmall muted">Utilisez « Imprimer / PDF » pour l'enregistrer ou l'imprimer.</span>
            </div>
            <Bulletin reservation={data} />
          </div>
        ) : (
          <div className="callout callout--info" style={{ marginTop: 20 }}>
            <FileText size={16} />
            <span>Le bulletin de réservation n'a pas encore été généré.</span>
          </div>
        ))}

      <ConfirmDialog
        open={dialog === "sign"}
        title="Signer la réservation ?"
        description="L'échéancier est généré automatiquement à la signature."
        confirmLabel="Signer"
        tone="primary"
        busy={busy === "sign"}
        error={error}
        onClose={() => setDialog(null)}
        onConfirm={() => act("sign", () => api.reservations.confirm(id), "Réservation signée. L'échéancier a été généré.")}
      >
        <dl className="dl">
          <dt>Client</dt>
          <dd>{data.lead?.name}</dd>
          <dt>Lot</dt>
          <dd>
            {data.lot?.ref} · {data.project?.name}
          </dd>
          <dt>Prix</dt>
          <dd className="num">{formatMAD(data.price)}</dd>
          <dt>Acompte</dt>
          <dd className="num">{formatMAD(data.deposit)}</dd>
        </dl>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "approveDiscount"}
        title="Approuver la remise ?"
        description={`Remise de ${formatMAD(data.discount)} (${percent(data.discount, data.listPrice)} % du prix catalogue) — ${data.discountReason}. Prix de vente : ${formatMAD(data.price)}.`}
        confirmLabel="Approuver"
        tone="dark"
        busy={busy === "approveDiscount"}
        error={error}
        onClose={() => setDialog(null)}
        onConfirm={() => act("approveDiscount", () => api.reservations.decideDiscount(id, "approve"), "Remise approuvée.")}
      />

      <ConfirmDialog
        open={dialog === "rejectDiscount"}
        title="Refuser la remise ?"
        description={`La réservation repassera au prix catalogue de ${formatMAD(data.listPrice)}.`}
        confirmLabel="Refuser la remise"
        tone="danger"
        busy={busy === "rejectDiscount"}
        error={error}
        onClose={() => setDialog(null)}
        onConfirm={() => (reason.trim() ? act("rejectDiscount", () => api.reservations.decideDiscount(id, "reject", reason.trim()), "Remise refusée.") : setError("Indiquez le motif du refus."))}
      >
        <Field label="Motif du refus" required>
          {(fieldId) => <textarea id={fieldId} className="textarea" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />}
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog === "close"}
        title="Issue de la réservation"
        description={END_HINTS[endStatus]}
        confirmLabel={`Confirmer : ${RESERVATION_STATUS[endStatus]?.label.toLowerCase()}`}
        tone={endStatus === "cloturee" ? "primary" : "danger"}
        busy={busy === "close"}
        error={error}
        onClose={() => setDialog(null)}
        onConfirm={() =>
          reason.trim()
            ? act("close", () => api.reservations.close(id, endStatus, reason.trim()), (updated) => `Réservation ${updated.number} : ${RESERVATION_STATUS[updated.status].label.toLowerCase()}.`)
            : setError("Indiquez le motif.")
        }
      >
        <div className="stack">
          <Field label="Issue" required>
            {(fieldId) => (
              <select id={fieldId} className="select" value={endStatus} onChange={(event) => setEndStatus(event.target.value)}>
                {RESERVATION_END_STATUSES.map((status) => (
                  <option key={status} value={status} disabled={status === "cloturee" && data.totals.remaining > 0}>
                    {RESERVATION_STATUS[status].label}
                    {status === "cloturee" && data.totals.remaining > 0 ? ` (solde de ${formatMAD(data.totals.remaining)} non réglé)` : ""}
                  </option>
                ))}
              </select>
            )}
          </Field>
          <Field label="Motif" required>
            {(fieldId) => <textarea id={fieldId} className="textarea" rows={2} value={reason} onChange={(event) => setReason(event.target.value)} />}
          </Field>
        </div>
      </ConfirmDialog>
    </>
  );
}

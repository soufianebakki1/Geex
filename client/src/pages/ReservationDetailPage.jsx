import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { BadgeCheck, CalendarClock, FileText, Printer, Wallet } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import Logo from "../components/Logo.jsx";
import { Button, ButtonLink, Card, ConfirmDialog, ErrorState, LoadingBlock, PageHeader, ProgressBar, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatDateTime, formatMAD, formatNumber, percent } from "../utils/format.js";
import { INSTALLMENT_STATUS, PAYMENT_STATUS, RESERVATION_STATUS } from "../utils/status.js";

function Bulletin({ reservation }) {
  const { lead, lot, project, installments } = reservation;
  return (
    <section className="bulletin" aria-label="Bulletin de réservation">
      <header className="bulletin__head">
        <Logo tone="dark" />
        <div className="bulletin__ref">
          <p className="bulletin__title">Bulletin de réservation</p>
          <p className="num">N° {reservation.bulletinNumber}</p>
          <p className="xsmall muted">Édité le {formatDateTime(reservation.bulletinGeneratedAt)}</p>
        </div>
      </header>

      <div className="bulletin__parties">
        <div>
          <p className="bulletin__label">Le réservant</p>
          <p className="strong">{project?.promoter?.name ?? "Konouz Immobilier"}</p>
          {project?.promoter?.address && <p>{project.promoter.address}</p>}
          {project?.promoter?.ice && <p className="xsmall muted">ICE {project.promoter.ice}</p>}
        </div>
        <div>
          <p className="bulletin__label">Le réservataire</p>
          <p className="strong">
            {lead?.lastName?.toUpperCase()} {lead?.firstName}
          </p>
          <p>{lead?.phone}</p>
          {lead?.email && <p>{lead.email}</p>}
          {lead?.city && <p>{lead.city}</p>}
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
              <th>Type</th>
              <td>
                {lot?.type}, {lot?.rooms} pièces
              </td>
              <th>Surface</th>
              <td className="num">{formatNumber(lot?.surface)} m²</td>
            </tr>
            <tr>
              <th>Livraison prévue</th>
              <td>{formatDate(project?.deliveryDate)}</td>
              <th>Prix de vente</th>
              <td className="num strong">{formatMAD(reservation.price)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="bulletin__section">
        <p className="bulletin__label">Modalités de paiement</p>
        <table className="bulletin__table bulletin__table--list">
          <thead>
            <tr>
              <th>Échéance</th>
              <th>Date</th>
              <th className="align-right">Montant</th>
            </tr>
          </thead>
          <tbody>
            {installments.map((item) => (
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
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const canConfirm = can(user, "reservations.confirm");

  async function confirm() {
    setBusy("confirm");
    setError(null);
    try {
      const updated = await api.reservations.confirm(id);
      reservation.setData(updated);
      setConfirmOpen(false);
      toast.success("Réservation confirmée. L'échéancier a été généré.");
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
  const confirmed = data.status === "confirmee";
  const paidPct = percent(data.totals.paid, data.price);

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
              {confirmed ? `Confirmée le ${formatDate(data.confirmedAt)}${data.confirmedByUser ? ` par ${data.confirmedByUser.name}` : ""}` : `Créée le ${formatDate(data.createdAt)}`}
            </span>
          </>
        }
        actions={
          <>
            {data.status === "en_attente" && canConfirm && (
              <Button
                variant="primary"
                icon={BadgeCheck}
                onClick={() => {
                  setError(null);
                  setConfirmOpen(true);
                }}
              >
                Confirmer la réservation
              </Button>
            )}
            {confirmed && canConfirm && (
              <Button variant={data.bulletinNumber ? "secondary" : "primary"} icon={FileText} onClick={generateBulletin} loading={busy === "bulletin"}>
                {data.bulletinNumber ? "Régénérer le bulletin" : "Générer le bulletin"}
              </Button>
            )}
            {data.bulletinNumber && (
              <Button variant="dark" icon={Printer} onClick={() => window.print()}>
                Imprimer / PDF
              </Button>
            )}
          </>
        }
      />

      {data.status === "en_attente" && (
        <div className="callout callout--warning" style={{ marginBottom: 20 }}>
          <BadgeCheck size={16} />
          <span>
            Cette réservation attend sa confirmation. La confirmation passe le lot {data.lot?.ref} en « Réservé », le client en « Gagné » et génère l'échéancier de paiement.
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
              <dd>{data.lead?.phone}</dd>
              <dt>Email</dt>
              <dd>{data.lead?.email || <span className="faint">—</span>}</dd>
              <dt>Ville</dt>
              <dd>{data.lead?.city || <span className="faint">—</span>}</dd>
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
                {data.lot?.ref} · {data.lot?.type}, {data.lot?.rooms} pièces
              </dd>
              <dt>Surface</dt>
              <dd className="num">{formatNumber(data.lot?.surface)} m²</dd>
              <dt>Livraison</dt>
              <dd>{formatDate(data.project?.deliveryDate)}</dd>
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
        </div>

        <div className="stack">
          <Card title="Conditions financières">
            <div className="finance-strip">
              <div>
                <p className="xsmall muted">Prix de vente</p>
                <p className="finance-strip__value num">{formatMAD(data.price)}</p>
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
            {data.totals.overdue > 0 && (
              <div className="callout callout--danger" style={{ marginTop: 14 }}>
                <CalendarClock size={16} />
                <span>{formatMAD(data.totals.overdue)} d'échéances en retard.</span>
              </div>
            )}
          </Card>

          {confirmed && (
            <Card
              title="Échéancier"
              actions={can(user, "schedule") && <Link to={`/echeancier?reservationId=${data.id}`} className="link small">Suivi détaillé</Link>}
              flush
            >
              <div className="table-wrap">
                <table className="table">
                  <tbody>
                    {data.installments.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="cell-primary">{item.label}</div>
                          <div className="cell-secondary">{formatDate(item.dueDate)}</div>
                        </td>
                        <td className="align-right num nowrap">{formatMAD(item.amount)}</td>
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

          {confirmed && (
            <Card
              title="Paiements"
              actions={can(user, "payments.create") && <ButtonLink to={`/paiements?reservationId=${data.id}`} size="sm" icon={Wallet}>Enregistrer</ButtonLink>}
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
                            <div className="cell-primary">{payment.reference}</div>
                            <div className="cell-secondary">
                              {payment.method} · {formatDate(payment.date)}
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

      {confirmed &&
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
        open={confirmOpen}
        title="Confirmer la réservation ?"
        confirmLabel="Confirmer"
        tone="primary"
        busy={busy === "confirm"}
        error={error}
        onClose={() => setConfirmOpen(false)}
        onConfirm={confirm}
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
    </>
  );
}

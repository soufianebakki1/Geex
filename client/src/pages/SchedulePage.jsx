import { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CalendarClock, TriangleAlert, Wallet } from "lucide-react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { ButtonLink, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, ProgressBar, StatusBadge } from "../components/ui.jsx";
import { daysUntil, formatDate, formatMAD, percent } from "../utils/format.js";
import { INSTALLMENT_STATUS } from "../utils/status.js";

function dueHint(item) {
  if (item.status === "paye") return null;
  const days = daysUntil(item.dueDate);
  if (days < 0) return `${Math.abs(days)} j de retard`;
  if (days === 0) return "Aujourd'hui";
  return `Dans ${days} j`;
}

export default function SchedulePage() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const reservations = useAsync(() => api.reservations.list({ status: "confirmee" }), []);
  const overdue = useAsync(() => api.schedules.overdue(), []);
  const reservationId = params.get("reservationId") ?? "";
  const schedule = useAsync(() => (reservationId ? api.schedules.get(reservationId) : Promise.resolve(null)), [reservationId]);

  useEffect(() => {
    if (!reservationId && reservations.data?.length) {
      setParams({ reservationId: reservations.data[0].id }, { replace: true });
    }
  }, [reservationId, reservations.data, setParams]);

  const data = schedule.data;
  const paidPct = data ? percent(data.totals.paid, data.totals.price) : 0;

  return (
    <>
      <PageHeader
        eyebrow="Finance"
        title="Échéancier"
        description="Calendrier de paiement de chaque réservation et suivi des retards."
        actions={
          reservations.data?.length > 0 && (
            <select className="select" style={{ minWidth: 280 }} value={reservationId} onChange={(event) => setParams({ reservationId: event.target.value }, { replace: true })} aria-label="Réservation">
              {reservations.data.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.number} — {item.lead?.name}
                </option>
              ))}
            </select>
          )
        }
      />

      {overdue.data?.length > 0 && (
        <Card className="overdue-card" title={`${overdue.data.length} échéance(s) en retard`} subtitle="Toutes réservations confondues">
          <ul className="overdue-list">
            {overdue.data.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className={`overdue-list__item ${item.reservationId === reservationId ? "is-active" : ""}`}
                  onClick={() => setParams({ reservationId: item.reservationId }, { replace: true })}
                >
                  <TriangleAlert size={15} />
                  <span className="grow truncate">
                    <span className="strong">{item.leadName}</span> · {item.label}
                  </span>
                  <span className="xsmall muted nowrap">{dueHint(item)}</span>
                  <span className="num strong nowrap">{formatMAD(item.amount - item.paidAmount)}</span>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {reservations.loading && !reservations.data ? (
        <LoadingBlock rows={5} />
      ) : reservations.error && !reservations.data ? (
        <div className="card">
          <ErrorState error={reservations.error} onRetry={reservations.reload} />
        </div>
      ) : reservations.data.length === 0 ? (
        <div className="card">
          <EmptyState icon={CalendarClock} title="Aucune réservation confirmée" description="L'échéancier est généré à la confirmation d'une réservation." />
        </div>
      ) : schedule.loading && !data ? (
        <LoadingBlock rows={5} />
      ) : schedule.error ? (
        <div className="card">
          <ErrorState error={schedule.error} onRetry={schedule.reload} />
        </div>
      ) : data ? (
        <div className="stack" style={{ marginTop: overdue.data?.length ? 20 : 0 }}>
          <div className="schedule-head card">
            <div className="schedule-head__who">
              <p className="xsmall muted">Réservation</p>
              <p className="strong">
                {can(user, "reservations") ? (
                  <Link to={`/reservations/${data.reservation.id}`} className="link">
                    {data.reservation.number}
                  </Link>
                ) : (
                  data.reservation.number
                )}
              </p>
              <p className="small muted">
                {data.reservation.lead?.name} · lot {data.reservation.lot?.ref} · {data.reservation.project?.name}
              </p>
            </div>
            <div className="schedule-head__figures">
              <div>
                <p className="xsmall muted">Prix</p>
                <p className="schedule-head__value num">{formatMAD(data.totals.price)}</p>
              </div>
              <div>
                <p className="xsmall muted">Encaissé</p>
                <p className="schedule-head__value num" style={{ color: "var(--success)" }}>
                  {formatMAD(data.totals.paid)}
                </p>
              </div>
              <div>
                <p className="xsmall muted">Reste</p>
                <p className="schedule-head__value num">{formatMAD(data.totals.remaining)}</p>
              </div>
              <div>
                <p className="xsmall muted">Prochaine échéance</p>
                <p className="schedule-head__value num">{data.next ? formatDate(data.next.dueDate) : "Soldé"}</p>
              </div>
            </div>
            <div className="schedule-head__progress">
              <ProgressBar value={paidPct} tone={data.totals.overdue ? "danger" : "success"} size="lg" label="Part encaissée" />
              <div className="row-between">
                <span className="xsmall muted">{paidPct} % encaissé</span>
                {data.totals.pending > 0 && <span className="xsmall" style={{ color: "var(--warning)" }}>{formatMAD(data.totals.pending)} en attente de validation</span>}
              </div>
            </div>
          </div>

          <Card
            title="Calendrier des échéances"
            actions={can(user, "payments.create") && <ButtonLink to={`/paiements?reservationId=${data.reservation.id}`} size="sm" icon={Wallet}>Enregistrer un paiement</ButtonLink>}
          >
            <ol className="schedule">
              {data.installments.map((item) => {
                const itemPct = percent(item.paidAmount, item.amount);
                return (
                  <li key={item.id} className={`schedule__item schedule__item--${item.status}`}>
                    <span className="schedule__marker num">{item.order}</span>
                    <div className="schedule__body">
                      <div className="schedule__top">
                        <div className="grow">
                          <p className="strong">{item.label}</p>
                          <p className="xsmall muted">
                            {formatDate(item.dueDate)}
                            {dueHint(item) ? ` · ${dueHint(item)}` : ""}
                          </p>
                        </div>
                        <div className="schedule__amounts">
                          <span className="num strong">{formatMAD(item.amount)}</span>
                          <span className="xsmall muted num">{item.paidAmount > 0 && item.status !== "paye" ? `${formatMAD(item.paidAmount)} réglés` : ""}</span>
                        </div>
                        <StatusBadge map={INSTALLMENT_STATUS} value={item.status} />
                      </div>
                      {item.status !== "a_venir" && item.status !== "paye" && <ProgressBar value={itemPct} tone={item.status === "en_retard" ? "danger" : "gold"} label="Part réglée" />}
                    </div>
                  </li>
                );
              })}
            </ol>
          </Card>
        </div>
      ) : null}
    </>
  );
}

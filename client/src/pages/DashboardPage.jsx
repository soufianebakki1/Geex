import { Link } from "react-router-dom";
import { ArrowUpRight, CalendarClock, Hourglass, TrendingUp, UsersRound, Wallet } from "lucide-react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import Countdown from "../components/Countdown.jsx";
import { Avatar, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from "../components/ui.jsx";
import { formatCompactMAD, formatDate, formatLongDate, formatMAD, percent, timeAgo } from "../utils/format.js";
import { INSTALLMENT_STATUS, LEAD_STAGE, LOT_STATUSES } from "../utils/status.js";

function Kpi({ icon: Icon, label, value, hint, to, tone }) {
  const content = (
    <>
      <div className="kpi__top">
        <span className="kpi__icon">
          <Icon size={18} />
        </span>
        {to && <ArrowUpRight size={16} className="kpi__arrow" />}
      </div>
      <p className="kpi__label">{label}</p>
      <p className={`kpi__value ${tone ? `kpi__value--${tone}` : ""}`}>{value}</p>
      {hint && <p className="kpi__hint">{hint}</p>}
    </>
  );
  return to ? (
    <Link to={to} className="kpi kpi--link">
      {content}
    </Link>
  ) : (
    <div className="kpi">{content}</div>
  );
}

function Funnel({ stages }) {
  const max = Math.max(...stages.map((stage) => stage.count), 1);
  return (
    <ol className="funnel">
      {stages.map((stage, index) => {
        const previous = stages[index - 1];
        const conversion = previous ? percent(stage.count, previous.count) : null;
        return (
          <li key={stage.stage} className="funnel__row">
            <div className="funnel__label">
              <span className="funnel__name">{stage.label}</span>
              <span className="funnel__current xsmall faint">{stage.current} actuellement</span>
            </div>
            <div className="funnel__track">
              <div className="funnel__bar" style={{ width: `${Math.max((stage.count / max) * 100, 4)}%`, background: LEAD_STAGE[stage.stage]?.color }}>
                <span className="num">{stage.count}</span>
              </div>
            </div>
            <span className="funnel__rate num">{conversion == null ? "" : `${conversion} %`}</span>
          </li>
        );
      })}
    </ol>
  );
}

function StockBar({ stock }) {
  return (
    <div className="stock-bar" aria-hidden="true">
      {LOT_STATUSES.map((status) =>
        stock[status.value] ? <span key={status.value} style={{ flexGrow: stock[status.value], background: status.color }} title={`${status.label} : ${stock[status.value]}`} /> : null,
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="stack">
      <div className="kpi-grid">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} height={132} />
        ))}
      </div>
      <div className="dash-grid">
        <Skeleton height={340} />
        <Skeleton height={340} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.dashboard.summary(), []);
  const firstName = user.name.split(" ")[0];
  const hour = new Date().getHours();
  const greeting = hour < 18 ? "Bonjour" : "Bonsoir";

  return (
    <>
      <PageHeader eyebrow={formatLongDate(new Date())} title={`${greeting}, ${firstName}`} description="Voici l'état de l'activité commerciale et des encaissements." />

      {loading && !data ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : (
        <div className="stack dashboard">
          <div className="kpi-grid">
            <Kpi icon={UsersRound} label="Leads actifs" value={data.kpis.activeLeads} hint={`${data.kpis.newLeadsThisMonth} nouveaux ce mois-ci`} to={can(user, "leads") ? "/leads" : undefined} />
            <Kpi
              icon={Hourglass}
              label="Pré-réservations actives"
              value={data.kpis.activePreReservations}
              hint={data.kpis.expiringSoon ? `${data.kpis.expiringSoon} expirent sous 48 h` : "Aucune échéance imminente"}
              tone={data.kpis.expiringSoon ? "warning" : undefined}
              to={can(user, "preReservations") ? "/pre-reservations" : undefined}
            />
            <Kpi
              icon={TrendingUp}
              label="Réservations du mois"
              value={data.kpis.reservationsThisMonth}
              hint={data.kpis.reservationsValueThisMonth ? `${formatCompactMAD(data.kpis.reservationsValueThisMonth)} de chiffre d'affaires` : "Aucune réservation confirmée"}
              to={can(user, "reservations") ? "/reservations" : undefined}
            />
            <Kpi
              icon={Wallet}
              label="Encaissé ce mois"
              value={formatCompactMAD(data.kpis.collectedThisMonth)}
              hint={data.kpis.pendingPaymentsCount ? `${data.kpis.pendingPaymentsCount} paiement(s) à valider · ${formatCompactMAD(data.kpis.pendingPaymentsAmount)}` : "Aucun paiement en attente"}
              to={can(user, "payments") ? "/paiements" : undefined}
            />
          </div>

          <div className="dash-grid">
            <Card title="Pipeline commercial" subtitle="Leads ayant atteint chaque étape, et taux de passage d'une étape à la suivante.">
              <Funnel stages={data.funnel} />
              {data.kpis.lostLeads > 0 && <p className="xsmall faint funnel__foot">{data.kpis.lostLeads} lead(s) perdu(s) exclu(s) du pipeline.</p>}
            </Card>

            <Card title="Activité récente" bodyClassName="activity-body">
              {data.activity.length === 0 ? (
                <EmptyState compact title="Aucune activité" />
              ) : (
                <ul className="feed">
                  {data.activity.map((item) => (
                    <li key={item.id} className="feed__item">
                      <Avatar name={item.user?.name ?? "Système"} size="sm" />
                      <div className="grow">
                        <p className="feed__text">
                          {item.lead ? (
                            can(user, "leads") ? (
                              <Link to={`/leads/${item.lead.id}`} className="strong">
                                {item.lead.name}
                              </Link>
                            ) : (
                              <span className="strong">{item.lead.name}</span>
                            )
                          ) : null}
                          {item.lead ? " — " : ""}
                          {item.message}
                        </p>
                        <p className="xsmall faint">
                          {item.user?.name ?? "Système"} · {timeAgo(item.at)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="dash-grid dash-grid--even">
            <Card
              title="Pré-réservations à surveiller"
              subtitle="Triées par date d'expiration"
              actions={can(user, "preReservations") && <Link to="/pre-reservations" className="link small">Tout voir</Link>}
            >
              {data.expiring.length === 0 ? (
                <EmptyState compact icon={Hourglass} title="Aucune pré-réservation active" />
              ) : (
                <ul className="watch-list">
                  {data.expiring.map((pre) => (
                    <li key={pre.id} className="watch-list__item">
                      <div className="grow">
                        <p className="strong truncate">{pre.lead?.name}</p>
                        <p className="xsmall muted truncate">
                          Lot {pre.lot?.ref} · {pre.lot?.project?.name} · acompte {formatMAD(pre.deposit)}
                        </p>
                      </div>
                      <Countdown to={pre.expiresAt} compact />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              title="Échéances à suivre"
              subtitle={data.kpis.overdueCount ? `${data.kpis.overdueCount} en retard · ${formatCompactMAD(data.kpis.overdueAmount)} à recouvrer` : "Retards et échéances des 45 prochains jours"}
              actions={can(user, "schedule") && <Link to="/echeancier" className="link small">Échéancier</Link>}
            >
              {data.upcoming.length === 0 ? (
                <EmptyState compact icon={CalendarClock} title="Aucune échéance proche" />
              ) : (
                <ul className="watch-list">
                  {data.upcoming.map((item) => (
                    <li key={item.id} className="watch-list__item">
                      <div className="grow">
                        <p className="strong truncate">
                          {item.leadName} <span className="faint">· {item.lotRef}</span>
                        </p>
                        <p className="xsmall muted truncate">
                          {item.label} · {formatDate(item.dueDate)}
                        </p>
                      </div>
                      <div className="watch-list__end">
                        <span className="num strong small">{formatMAD(item.amount - item.paidAmount)}</span>
                        <StatusBadge map={INSTALLMENT_STATUS} value={item.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>

          <Card title="Stock par programme" actions={<Link to="/projets" className="link small">Projets</Link>}>
            <div className="stock-list">
              {data.stock.map((project) => (
                <Link key={project.id} to={`/lots?projectId=${project.id}`} className="stock-list__item">
                  <div className="row-between">
                    <span className="strong">{project.name}</span>
                    <span className="xsmall muted num">
                      {project.stock.disponible} / {project.stock.total} disponibles
                    </span>
                  </div>
                  <StockBar stock={project.stock} />
                  <span className="xsmall faint">{project.city}</span>
                </Link>
              ))}
            </div>
            <div className="legend">
              {LOT_STATUSES.map((status) => (
                <span key={status.value} className="legend__item">
                  <span className="legend-dot" style={{ background: status.color }} />
                  {status.label}
                </span>
              ))}
            </div>
          </Card>
        </div>
      )}
    </>
  );
}

import { Link } from "react-router-dom";
import { BellRing, CalendarClock, ChevronRight, Hourglass, Percent, PhoneCall, RefreshCw, TrendingUp, UserPlus, UsersRound, Wallet } from "lucide-react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import Countdown from "../components/Countdown.jsx";
import StatCard from "../components/dashboard/StatCard.jsx";
import PipelineChart, { PipelineLegend } from "../components/dashboard/PipelineChart.jsx";
import StockRings from "../components/dashboard/StockRings.jsx";
import ProgramBubbles from "../components/dashboard/ProgramBubbles.jsx";
import { Avatar, Button, Card, EmptyState, ErrorState, PageHeader, Skeleton, StatusBadge } from "../components/ui.jsx";
import { daysUntil, formatCompactMAD, formatDate, formatLongDate, formatMAD, timeAgo } from "../utils/format.js";
import { INSTALLMENT_STATUS, LEAD_STAGE } from "../utils/status.js";

function attentionItems(kpis, user) {
  return [
    can(user, "leads.assign") && kpis.unassignedLeads > 0 && { icon: UserPlus, label: "Leads à affecter", count: kpis.unassignedLeads, to: "/leads", tone: "warning" },
    can(user, "leads") && kpis.followUpsDue > 0 && { icon: PhoneCall, label: "Relances dues", count: kpis.followUpsDue, to: "/leads?relances=dues", tone: "warning" },
    can(user, "reservations.approveDiscount") && kpis.discountsToApprove > 0 && { icon: Percent, label: "Remises à approuver", count: kpis.discountsToApprove, to: "/reservations", tone: "gold" },
    can(user, "payments.validate") && kpis.pendingPaymentsCount > 0 && { icon: Wallet, label: "Paiements à traiter", count: kpis.pendingPaymentsCount, hint: formatCompactMAD(kpis.pendingPaymentsAmount), to: "/paiements", tone: "info" },
    can(user, "preReservations") && kpis.expiringSoon > 0 && { icon: Hourglass, label: "Pré-réservations expirant sous 48 h", count: kpis.expiringSoon, to: "/pre-reservations", tone: "warning" },
    can(user, "schedule") && kpis.overdueCount > 0 && { icon: CalendarClock, label: "Échéances en retard", count: kpis.overdueCount, hint: formatCompactMAD(kpis.overdueAmount), to: "/echeancier", tone: "danger" },
  ].filter(Boolean);
}

function followUpHint(date) {
  const days = daysUntil(date);
  if (days < 0) return `${Math.abs(days)} j de retard`;
  return "Aujourd'hui";
}

function statCards(kpis, user) {
  return [
    {
      icon: UsersRound,
      label: "Leads actifs",
      value: kpis.activeLeads,
      hint: "nouveaux contacts ce mois-ci",
      chip: { label: `+${kpis.newLeadsThisMonth}`, tone: "gold" },
      to: can(user, "leads") ? "/leads" : undefined,
      hero: true,
    },
    {
      icon: Hourglass,
      label: "Pré-réservations actives",
      value: kpis.activePreReservations,
      hint: kpis.expiringSoon ? "expirent sous 48 h" : "aucune échéance imminente",
      chip: kpis.expiringSoon ? { label: `${kpis.expiringSoon} < 48 h`, tone: "warn" } : { label: "À jour", tone: "up" },
      to: can(user, "preReservations") ? "/pre-reservations" : undefined,
    },
    {
      icon: TrendingUp,
      label: "Réservations du mois",
      value: kpis.reservationsThisMonth,
      hint: kpis.reservationsValueThisMonth ? "de chiffre d'affaires signé" : "aucune réservation signée",
      chip: kpis.reservationsValueThisMonth ? { label: formatCompactMAD(kpis.reservationsValueThisMonth), tone: "up" } : null,
      to: can(user, "reservations") ? "/reservations" : undefined,
    },
    {
      icon: Wallet,
      label: "Encaissé ce mois",
      value: formatCompactMAD(kpis.collectedThisMonth),
      hint: kpis.pendingPaymentsCount ? `${formatCompactMAD(kpis.pendingPaymentsAmount)} en attente de validation` : "aucun paiement en attente",
      chip: kpis.pendingPaymentsCount ? { label: `${kpis.pendingPaymentsCount} à valider`, tone: "info" } : { label: "À jour", tone: "up" },
      to: can(user, "payments") ? "/paiements" : undefined,
    },
  ];
}

function DashboardSkeleton() {
  return (
    <div className="dash">
      <div className="dash-board">
        <div className="dash-board__main">
          <div className="dash-stats">
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} height={150} />
            ))}
          </div>
          <Skeleton height={360} />
        </div>
        <div className="dash-board__side">
          <Skeleton height={420} />
          <Skeleton height={260} />
        </div>
      </div>
    </div>
  );
}

function AttentionList({ items }) {
  if (items.length === 0) return <EmptyState compact title="Rien à signaler" description="Aucune action en attente." />;
  return (
    <ul className="attention">
      {items.map((item) => (
        <li key={item.label}>
          <Link to={item.to} className="attention__row">
            <span className={`attention__icon attention__icon--${item.tone}`}>
              <item.icon size={16} />
            </span>
            <span className="attention__text">
              <span className="attention__label">{item.label}</span>
              {item.hint && <span className="attention__hint num">{item.hint}</span>}
            </span>
            <span className="attention__count num">{item.count}</span>
            <ChevronRight size={15} className="attention__chevron" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.dashboard.summary(), []);
  const firstName = user.name.split(" ")[0];
  const greeting = new Date().getHours() < 18 ? "Bonjour" : "Bonsoir";

  return (
    <>
      <PageHeader
        eyebrow={formatLongDate(new Date())}
        title={`${greeting}, ${firstName}`}
        description="Voici l'état de l'activité commerciale et des encaissements."
        actions={
          data && (
            <Button variant="secondary" icon={RefreshCw} onClick={reload} loading={loading}>
              Actualiser
            </Button>
          )
        }
      />

      {loading && !data ? (
        <DashboardSkeleton />
      ) : error && !data ? (
        <div className="card">
          <ErrorState error={error} onRetry={reload} />
        </div>
      ) : (
        <div className="dash">
          <section className="dash-board">
            <div className="dash-board__main">
              <div className="dash-stats">
                {statCards(data.kpis, user).map((card) => (
                  <StatCard key={card.label} {...card} />
                ))}
              </div>

              <Card className="dash-card" title="Pipeline commercial" subtitle="Leads ayant atteint chaque étape, et leads qui s'y trouvent aujourd'hui." actions={<PipelineLegend />}>
                <PipelineChart stages={data.funnel} />
                {data.kpis.lostLeads > 0 && <p className="dash-foot">{data.kpis.lostLeads} lead(s) annulé(s) exclu(s) du pipeline.</p>}
              </Card>

              <Card className="dash-card" title="Points d'attention" subtitle="Actions en attente selon votre rôle">
                <AttentionList items={attentionItems(data.kpis, user)} />
              </Card>
            </div>

            <div className="dash-board__side">
              <Card className="dash-card" title="Stock des lots" subtitle="Tous programmes confondus" actions={<Link to="/lots" className="link small">Lots</Link>}>
                <StockRings projects={data.stock} />
              </Card>

              <Card className="dash-card" title="Programmes" subtitle="Lots disponibles et part commercialisée" actions={<Link to="/projets" className="link small">Projets</Link>}>
                <ProgramBubbles projects={data.stock} />
              </Card>
            </div>
          </section>

          <section className="dash-row dash-row--two">
            <Card
              className="dash-card"
              title="Relances à faire"
              subtitle="1re et 2e relances arrivées à échéance"
              actions={can(user, "leads") && data.followUps.length > 0 && <Link to="/leads?relances=dues" className="link small">Tout voir</Link>}
            >
              {data.followUps.length === 0 ? (
                <EmptyState compact icon={BellRing} title="Aucune relance en attente" />
              ) : (
                <ul className="watch-list">
                  {data.followUps.map((item) => (
                    <li key={`${item.leadId}-${item.slot}`} className="watch-list__item">
                      <Avatar name={item.name} size="sm" />
                      <div className="grow">
                        <p className="strong truncate">
                          <Link to={`/leads/${item.leadId}`}>{item.name}</Link>
                        </p>
                        <p className="xsmall muted truncate">
                          Relance {item.slot} · {item.phone}
                          {item.agent ? ` · ${item.agent.name}` : ""}
                        </p>
                      </div>
                      <div className="watch-list__end">
                        <span className="xsmall strong" style={{ color: daysUntil(item.date) < 0 ? "var(--danger)" : "var(--warning)" }}>
                          {followUpHint(item.date)}
                        </span>
                        <StatusBadge map={LEAD_STAGE} value={item.stage} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card
              className="dash-card"
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
          </section>

          <section className="dash-row dash-row--two">
            <Card
              className="dash-card"
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
                      <span className="dash-date">
                        <span className="dash-date__day num">{new Date(item.dueDate).getDate()}</span>
                        <span className="dash-date__month">{new Date(item.dueDate).toLocaleDateString("fr-FR", { month: "short" })}</span>
                      </span>
                      <div className="grow">
                        <p className="strong truncate">
                          {item.leadName} <span className="faint">· {item.lotRef}</span>
                        </p>
                        <p className="xsmall muted truncate">
                          {item.label} · {formatDate(item.dueDate)}
                        </p>
                      </div>
                      <div className="watch-list__end">
                        <span className="num strong small">{formatMAD(item.balance)}</span>
                        <StatusBadge map={INSTALLMENT_STATUS} value={item.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="dash-card" title="Activité récente" bodyClassName="dash-feed-body">
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
          </section>
        </div>
      )}
    </>
  );
}

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FilePen } from "lucide-react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { Badge, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, ProgressBar, SearchInput, Segmented, StatusBadge } from "../components/ui.jsx";
import { formatDate, formatMAD, percent } from "../utils/format.js";
import { LOT_TYPE, RESERVATION_STATUS } from "../utils/status.js";

const SIGNED = ["active", "cloturee"];
const ENDED = ["annulee", "desistement", "change_ref", "resiliation", "cloturee"];
const inTab = (item, tab) => tab === "all" || (tab === "ended" ? ENDED.includes(item.status) : item.status === tab);

export default function ReservationsPage() {
  const navigate = useNavigate();
  const reservations = useAsync(() => api.reservations.list(), []);
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => {
    const items = reservations.data ?? [];
    return {
      all: items.length,
      en_attente: items.filter((item) => inTab(item, "en_attente")).length,
      active: items.filter((item) => inTab(item, "active")).length,
      ended: items.filter((item) => inTab(item, "ended")).length,
    };
  }, [reservations.data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (reservations.data ?? [])
      .filter((item) => inTab(item, tab))
      .filter((item) => !q || `${item.number} ${item.lead?.name} ${item.lot?.ref} ${item.project?.name}`.toLowerCase().includes(q));
  }, [reservations.data, tab, query]);

  return (
    <>
      <PageHeader eyebrow="Commercial" title="Réservations" description="Réservations issues des dossiers complets : remise, signature, bulletin, encaissements et issue (clôture, désistement, résiliation)." />

      <div className="toolbar">
        <Segmented
          label="Statut"
          value={tab}
          onChange={setTab}
          items={[
            { value: "all", label: "Toutes", count: counts.all },
            { value: "en_attente", label: "À signer", count: counts.en_attente },
            { value: "active", label: "Actives", count: counts.active },
            { value: "ended", label: "Terminées", count: counts.ended },
          ]}
        />
        <span className="toolbar__spacer" />
        <SearchInput value={query} onChange={setQuery} placeholder="N°, client, lot…" />
      </div>

      <Card flush>
        {reservations.loading && !reservations.data ? (
          <div className="card__body">
            <LoadingBlock />
          </div>
        ) : reservations.error && !reservations.data ? (
          <ErrorState error={reservations.error} onRetry={reservations.reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon={FilePen} title="Aucune réservation" description="Les réservations sont créées depuis un dossier complet." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Réservation</th>
                  <th>Client</th>
                  <th>Bien</th>
                  <th className="align-right">Prix</th>
                  <th style={{ minWidth: 160 }}>Encaissé</th>
                  <th>Statut</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => {
                  const paidPct = percent(item.totals.paid, item.price);
                  return (
                    <tr key={item.id} className="is-clickable" onClick={() => navigate(`/reservations/${item.id}`)}>
                      <td>
                        <div className="cell-primary num">{item.number}</div>
                        <div className="cell-secondary">{formatDate(item.signedAt ?? item.createdAt)}</div>
                      </td>
                      <td>
                        <div className="cell-primary">{item.lead?.name}</div>
                        <div className="cell-secondary">{item.lead?.phone}</div>
                      </td>
                      <td>
                        <div>
                          {item.lot?.ref} · {LOT_TYPE[item.lot?.type]?.label ?? item.lot?.type}
                        </div>
                        <div className="cell-secondary">{item.project?.name}</div>
                      </td>
                      <td className="align-right nowrap">
                        <div className="num">{formatMAD(item.price)}</div>
                        {item.discount > 0 && <div className="cell-secondary num">remise {formatMAD(item.discount)}</div>}
                      </td>
                      <td>
                        {SIGNED.includes(item.status) ? (
                          <div className="row">
                            <div className="grow">
                              <ProgressBar value={paidPct} tone={item.totals.overdue ? "danger" : "success"} label="Part encaissée" />
                            </div>
                            <span className="xsmall num muted">{paidPct} %</span>
                          </div>
                        ) : (
                          <span className="faint small">—</span>
                        )}
                      </td>
                      <td>
                        <div className="stack-sm" style={{ gap: 4, alignItems: "flex-start" }}>
                          <StatusBadge map={RESERVATION_STATUS} value={item.status} />
                          {item.discountPending && <Badge tone="warning">Remise à approuver</Badge>}
                          {item.blocked && <Badge tone="danger">Bloquée</Badge>}
                          {item.totals.overdue > 0 && <span className="xsmall" style={{ color: "var(--danger)" }}>Retard {formatMAD(item.totals.overdue)}</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

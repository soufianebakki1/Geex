import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderCheck } from "lucide-react";
import { api } from "../api/index.js";
import { useAsync } from "../hooks/useAsync.js";
import { Card, EmptyState, ErrorState, LoadingBlock, PageHeader, ProgressBar, SearchInput, Segmented, StatusBadge } from "../components/ui.jsx";
import { formatDate } from "../utils/format.js";
import { DOSSIER_CLIENT_TYPE, DOSSIER_STATUS, RESERVATION_STATUS } from "../utils/status.js";

const reserved = (item) => item.reservation && item.reservation.status !== "annulee";

export default function DossiersPage() {
  const navigate = useNavigate();
  const dossiers = useAsync(() => api.dossiers.list(), []);
  const [tab, setTab] = useState("open");
  const [query, setQuery] = useState("");

  const groups = useMemo(() => {
    const items = dossiers.data ?? [];
    const open = items.filter((item) => !reserved(item) && item.state.status !== "rejete");
    return {
      open,
      incomplete: open.filter((item) => ["en_cours", "incomplet"].includes(item.state.status)),
      toValidate: open.filter((item) => item.state.status === "complet"),
      reserved: items.filter(reserved),
      rejected: items.filter((item) => item.state.status === "rejete"),
      all: items,
    };
  }, [dossiers.data]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups[tab].filter((item) => !q || `${item.lead?.name} ${item.lot?.ref} ${item.lot?.project?.name}`.toLowerCase().includes(q));
  }, [groups, tab, query]);

  return (
    <>
      <PageHeader eyebrow="Commercial" title="Dossiers" description="Collecte et contrôle des pièces justificatives. Une réservation ne peut être créée que sur un dossier complet." />

      <div className="toolbar">
        <Segmented
          label="Filtrer les dossiers"
          value={tab}
          onChange={setTab}
          items={[
            { value: "open", label: "En cours", count: groups.open.length },
            { value: "incomplete", label: "Incomplets", count: groups.incomplete.length },
            { value: "toValidate", label: "À valider", count: groups.toValidate.length },
            { value: "reserved", label: "Réservés", count: groups.reserved.length },
            { value: "rejected", label: "Rejetés", count: groups.rejected.length },
            { value: "all", label: "Tous", count: groups.all.length },
          ]}
        />
        <span className="toolbar__spacer" />
        <SearchInput value={query} onChange={setQuery} placeholder="Client, lot, projet…" />
      </div>

      <Card flush>
        {dossiers.loading && !dossiers.data ? (
          <div className="card__body">
            <LoadingBlock />
          </div>
        ) : dossiers.error && !dossiers.data ? (
          <ErrorState error={dossiers.error} onRetry={dossiers.reload} />
        ) : rows.length === 0 ? (
          <EmptyState icon={FolderCheck} title="Aucun dossier" description="Un dossier est ouvert lorsqu'une pré-réservation est convertie." />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Lot</th>
                  <th style={{ minWidth: 180 }}>Pièces obligatoires</th>
                  <th>Statut</th>
                  <th>Réservation</th>
                  <th>Ouvert le</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr key={item.id} className="is-clickable" onClick={() => navigate(`/dossiers/${item.id}`)}>
                    <td>
                      <div className="cell-primary">{item.lead?.name}</div>
                      <div className="cell-secondary">{item.preReservationNumber ?? item.lead?.phone}</div>
                    </td>
                    <td className="small">{DOSSIER_CLIENT_TYPE[item.clientType]?.label ?? "—"}</td>
                    <td>
                      <div>{item.lot?.ref}</div>
                      <div className="cell-secondary">{item.lot?.project?.name}</div>
                    </td>
                    <td>
                      <div className="row">
                        <div className="grow">
                          <ProgressBar value={item.state.received} max={item.state.required} tone={item.state.received === item.state.required ? "success" : "gold"} label="Pièces reçues" />
                        </div>
                        <span className="xsmall num muted">
                          {item.state.received}/{item.state.required}
                        </span>
                      </div>
                    </td>
                    <td>
                      <StatusBadge map={DOSSIER_STATUS} value={item.state.status} />
                    </td>
                    <td>{item.reservation ? <StatusBadge map={RESERVATION_STATUS} value={item.reservation.status} /> : <span className="faint">—</span>}</td>
                    <td className="nowrap">{formatDate(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}

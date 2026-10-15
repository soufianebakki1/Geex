import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { BellRing, Plus, UsersRound } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import LeadCancelDialog from "../components/LeadCancelDialog.jsx";
import LeadFormModal from "../components/LeadFormModal.jsx";
import { Avatar, Badge, Button, Card, EmptyState, ErrorState, LoadingBlock, PageHeader, SearchInput, Segmented, Skeleton, StatusBadge } from "../components/ui.jsx";
import { formatCompactMAD, formatDate, timeAgo } from "../utils/format.js";
import { CLIENT_TYPE, CLOSED_STAGES, ENGAGED_STAGES, FOLLOW_UP_OUTCOME, LEAD_STAGE, LEAD_STAGES, MANUAL_STAGES } from "../utils/status.js";

const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
};
const remarkOf = (lead) => (lead.stage === "annule" && lead.cancelReason ? `Annulé : ${lead.cancelReason}` : lead.remark);
const isDue = (lead) => Boolean(lead.nextFollowUp && lead.nextFollowUp.date <= endOfToday());
const budgetLabel = (lead) => {
  if (lead.budgetMin && lead.budgetMax) {
    const max = formatCompactMAD(lead.budgetMax);
    const unit = max.replace(/^[\d\s.,\u202f\u00a0]+/, "");
    const min = formatCompactMAD(lead.budgetMin);
    return `${min.endsWith(unit) ? min.slice(0, -unit.length).trim() : min} – ${max}`;
  }
  if (lead.budgetMax || lead.budgetMin) return formatCompactMAD(lead.budgetMax ?? lead.budgetMin);
  return null;
};

function LeadCard({ lead, draggable, onDragStart, onDragEnd }) {
  const due = isDue(lead);
  return (
    <Link
      to={`/leads/${lead.id}`}
      className="lead-card"
      draggable={draggable}
      onDragStart={(event) => {
        event.dataTransfer.setData("text/plain", lead.id);
        event.dataTransfer.effectAllowed = "move";
        onDragStart(lead.id);
      }}
      onDragEnd={onDragEnd}
    >
      <div className="row-between">
        <span className="lead-card__name truncate">{lead.fullName}</span>
        {lead.agent ? <Avatar name={lead.agent.name} size="sm" /> : <Badge tone="warning">À affecter</Badge>}
      </div>
      <p className="lead-card__project truncate">{lead.project ? `${lead.project.name} · ${lead.project.city}` : "Projet non précisé"}</p>
      <div className="lead-card__meta">
        {budgetLabel(lead) ? <span className="lead-card__budget num">{budgetLabel(lead)}</span> : <span className="faint xsmall">Budget n.c.</span>}
        {lead.source && <span className="tag">{lead.source.name}</span>}
      </div>
      <p className="lead-card__foot">
        {lead.nextFollowUp ? (
          <span className={due ? "strong" : undefined} style={due ? { color: "var(--warning)" } : undefined}>
            Relance {lead.nextFollowUp.slot} {due ? "due" : "prévue"} {formatDate(lead.nextFollowUp.date)}
          </span>
        ) : lead.lastActivityAt ? (
          `Dernière activité ${timeAgo(lead.lastActivityAt)}`
        ) : (
          `Créé ${timeAgo(lead.createdAt)}`
        )}
      </p>
    </Link>
  );
}

function FollowUpCell({ date, outcome }) {
  if (!date) return <span className="faint">—</span>;
  const meta = FOLLOW_UP_OUTCOME[outcome];
  return (
    <div className="stack-xs">
      <span className="num small">{formatDate(date)}</span>
      {meta ? <Badge tone={meta.tone}>{meta.label}</Badge> : <span className="xsmall faint">À faire</span>}
    </div>
  );
}

function ProspectTable({ leads }) {
  return (
    <div className="table-wrap">
      <table className="table prospect-table">
        <thead>
          <tr>
            <th>Nom et prénom</th>
            <th>Contact</th>
            <th>Adresse</th>
            <th>Source</th>
            <th>Projet</th>
            <th>Commercial affecté</th>
            <th>Relance 1 · sort</th>
            <th>Relance 2 · sort</th>
            <th>Remarque</th>
            <th>Étape</th>
          </tr>
        </thead>
        <tbody>
          {leads.map((lead) => (
            <tr key={lead.id}>
              <td>
                <Link to={`/leads/${lead.id}`} className="cell-primary link">
                  {lead.fullName}
                </Link>
                <div className="cell-secondary">{CLIENT_TYPE[lead.clientType]?.label}</div>
              </td>
              <td>
                <div className="num small">{lead.phone}</div>
                <div className="cell-secondary">{lead.email || "Pas d'email"}</div>
              </td>
              <td className="small">
                <span className="clamp-2" title={lead.address}>
                  {lead.address}
                </span>
              </td>
              <td className="small">{lead.source?.name ?? "—"}</td>
              <td className="small">{lead.project?.name ?? "—"}</td>
              <td className="small">{lead.agent?.name ?? <Badge tone="warning">À affecter</Badge>}</td>
              <td>
                <FollowUpCell date={lead.followUp1Date} outcome={lead.followUp1Outcome} />
              </td>
              <td>
                <FollowUpCell date={lead.followUp2Date} outcome={lead.followUp2Outcome} />
              </td>
              <td className="small muted">
                {remarkOf(lead) ? (
                  <span className="clamp-2" title={remarkOf(lead)}>
                    {remarkOf(lead)}
                  </span>
                ) : (
                  "—"
                )}
              </td>
              <td>
                <StatusBadge map={LEAD_STAGE} value={lead.stage} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function LeadsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get("view") === "tableau" ? "tableau" : "pipeline";
  const leads = useAsync(() => api.leads.list(), []);
  const projects = useAsync(() => api.projects.list(), []);
  const team = useAsync(() => api.team.list(), []);
  const sources = useAsync(() => api.sources.list(), []);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [sourceId, setSourceId] = useState("");
  const [dueOnly, setDueOnly] = useState(params.get("relances") === "dues");
  const [showClosed, setShowClosed] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const canWrite = can(user, "leads.write");
  const agents = (team.data ?? []).filter((member) => member.role === "commercial");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads.data ?? []).filter(
      (lead) =>
        (!projectId || lead.projectId === projectId) &&
        (!agentId || (agentId === "none" ? !lead.agentId : lead.agentId === agentId)) &&
        (!sourceId || lead.sourceId === sourceId) &&
        (!dueOnly || isDue(lead)) &&
        (!q || `${lead.fullName} ${lead.phone} ${lead.email} ${lead.address}`.toLowerCase().includes(q)),
    );
  }, [leads.data, query, projectId, agentId, sourceId, dueOnly]);

  const dueCount = useMemo(() => (leads.data ?? []).filter(isDue).length, [leads.data]);

  const columns = useMemo(
    () =>
      LEAD_STAGES.filter((stage) => showClosed || !CLOSED_STAGES.includes(stage.value)).map((stage) => {
        const items = filtered.filter((lead) => lead.stage === stage.value);
        return { ...stage, items, budget: items.reduce((total, lead) => total + (lead.budgetMax ?? lead.budgetMin ?? 0), 0) };
      }),
    [filtered, showClosed],
  );

  function setView(next) {
    const search = new URLSearchParams(params);
    if (next === "tableau") search.set("view", "tableau");
    else search.delete("view");
    setParams(search, { replace: true });
  }

  async function moveLead(leadId, stage) {
    const lead = leads.data?.find((item) => item.id === leadId);
    if (!lead || lead.stage === stage) return;
    if (ENGAGED_STAGES.includes(lead.stage)) {
      toast.info("Ce lead est engagé dans une réservation : son étape suit l'avancement du dossier.");
      return;
    }
    if (stage === "pre_reserve") {
      navigate(`/pre-reservations?leadId=${lead.id}`);
      return;
    }
    if (stage === "annule") {
      setCancelling(lead);
      return;
    }
    if (!MANUAL_STAGES.includes(stage)) {
      toast.info(`L'étape « ${LEAD_STAGE[stage].label} » suit automatiquement la réservation, la signature et les paiements.`);
      return;
    }
    const previous = leads.data;
    leads.setData((items) => items.map((item) => (item.id === lead.id ? { ...item, stage } : item)));
    try {
      const saved = await api.leads.update(lead.id, { stage });
      leads.setData((items) => items.map((item) => (item.id === saved.id ? saved : item)));
    } catch (error) {
      leads.setData(previous);
      toast.error(errorMessage(error));
    }
  }

  const isLoading = leads.loading && !leads.data;
  const tableRows = view === "tableau" ? filtered.filter((lead) => showClosed || !CLOSED_STAGES.includes(lead.stage)) : [];

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Leads"
        description="Pipeline des prospects et tableau de suivi des relances. La pré-réservation, la réservation et les paiements font avancer les étapes automatiquement."
        actions={
          canWrite && (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              Nouveau lead
            </Button>
          )
        }
      />

      <div className="toolbar">
        <Segmented
          label="Affichage"
          value={view}
          onChange={setView}
          items={[
            { value: "pipeline", label: "Pipeline" },
            { value: "tableau", label: "Tableau des prospects" },
          ]}
        />
        <SearchInput value={query} onChange={setQuery} placeholder="Nom, téléphone, email…" />
        <select className="select" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filtrer par projet">
          <option value="">Tous les projets</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        <select className="select" value={sourceId} onChange={(event) => setSourceId(event.target.value)} aria-label="Filtrer par source">
          <option value="">Toutes les sources</option>
          {(sources.data ?? []).map((source) => (
            <option key={source.id} value={source.id}>
              {source.name === source.category ? source.name : `${source.category} — ${source.name}`}
            </option>
          ))}
        </select>
        {agents.length > 1 && (
          <select className="select" value={agentId} onChange={(event) => setAgentId(event.target.value)} aria-label="Filtrer par commercial">
            <option value="">Tous les commerciaux</option>
            {can(user, "leads.assign") && <option value="none">Non affectés</option>}
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="row wrap" style={{ marginBottom: 14 }}>
        <button type="button" className={`chip ${dueOnly ? "is-active" : ""}`} aria-pressed={dueOnly} onClick={() => setDueOnly((value) => !value)}>
          <BellRing size={14} />
          Relances dues <span className="num">{dueCount}</span>
        </button>
        <button type="button" className={`chip ${showClosed ? "is-active" : ""}`} aria-pressed={showClosed} onClick={() => setShowClosed((value) => !value)}>
          Afficher livrés, clôturés et annulés
        </button>
        <span className="toolbar__spacer" />
        {leads.data && <span className="small muted">{view === "tableau" ? tableRows.length : columns.reduce((total, column) => total + column.items.length, 0)} lead(s)</span>}
      </div>

      {leads.error && !leads.data ? (
        <div className="card">
          <ErrorState error={leads.error} onRetry={leads.reload} />
        </div>
      ) : view === "tableau" ? (
        <Card flush>
          {isLoading ? (
            <div className="card__body">
              <LoadingBlock />
            </div>
          ) : tableRows.length === 0 ? (
            <EmptyState icon={UsersRound} title="Aucun prospect ne correspond" description="Modifiez les filtres pour élargir la recherche." />
          ) : (
            <ProspectTable leads={tableRows} />
          )}
        </Card>
      ) : (
        <div className="kanban" aria-busy={isLoading}>
          {columns.map((column) => (
            <section
              key={column.value}
              className={`kanban__col ${overStage === column.value && dragId ? "is-over" : ""}`}
              onDragOver={(event) => {
                if (!dragId) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                if (overStage !== column.value) setOverStage(column.value);
              }}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) setOverStage(null);
              }}
              onDrop={(event) => {
                event.preventDefault();
                const id = event.dataTransfer.getData("text/plain") || dragId;
                setOverStage(null);
                setDragId(null);
                moveLead(id, column.value);
              }}
              aria-label={column.label}
            >
              <header className="kanban__head">
                <span className="kanban__dot" style={{ background: column.color }} />
                <span className="kanban__title">{column.label}</span>
                <span className="kanban__count">{isLoading ? "…" : column.items.length}</span>
              </header>
              {column.budget > 0 && <p className="kanban__sum num">{formatCompactMAD(column.budget)}</p>}
              <div className="kanban__list">
                {isLoading ? (
                  <>
                    <Skeleton height={112} />
                    <Skeleton height={112} />
                  </>
                ) : column.items.length === 0 ? (
                  <p className="kanban__empty">Aucun lead</p>
                ) : (
                  column.items.map((lead) => (
                    <LeadCard
                      key={lead.id}
                      lead={lead}
                      draggable={canWrite && !ENGAGED_STAGES.includes(lead.stage) && !["livre", "cloture"].includes(lead.stage)}
                      onDragStart={setDragId}
                      onDragEnd={() => {
                        setDragId(null);
                        setOverStage(null);
                      }}
                    />
                  ))
                )}
              </div>
            </section>
          ))}
        </div>
      )}

      {leads.data && leads.data.length === 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <EmptyState icon={UsersRound} title="Aucun lead pour l'instant" description="Ajoutez votre premier prospect pour démarrer le pipeline." />
        </div>
      )}

      <LeadFormModal
        open={creating}
        projects={projects.data ?? []}
        team={team.data ?? []}
        currentUser={user}
        onClose={() => setCreating(false)}
        onSaved={(lead) => {
          leads.setData((items) => [lead, ...(items ?? [])]);
          setCreating(false);
          toast.success(`${lead.fullName} ajouté au pipeline.`);
        }}
      />

      <LeadCancelDialog
        lead={cancelling}
        onClose={() => setCancelling(null)}
        onCancelled={(saved) => {
          leads.setData((items) => items.map((item) => (item.id === saved.id ? saved : item)));
          setCancelling(null);
          setShowClosed(true);
          toast.success(`${saved.fullName} est archivé (annulé).`);
        }}
      />
    </>
  );
}

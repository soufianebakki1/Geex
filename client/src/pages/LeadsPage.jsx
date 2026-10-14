import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, UsersRound } from "lucide-react";
import { api } from "../api/index.js";
import { errorMessage } from "../api/errors.js";
import { useAsync } from "../hooks/useAsync.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import { useToast } from "../components/Toast.jsx";
import LeadFormModal from "../components/LeadFormModal.jsx";
import { Avatar, Button, EmptyState, ErrorState, PageHeader, SearchInput, Skeleton } from "../components/ui.jsx";
import { formatCompactMAD, timeAgo } from "../utils/format.js";
import { ENGAGED_STAGES, LEAD_STAGES } from "../utils/status.js";

const LOCKED_TARGETS = {
  gagne: "Un lead passe à « Gagné » automatiquement lorsque sa réservation est confirmée.",
};

function LeadCard({ lead, draggable, onDragStart, onDragEnd }) {
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
        <span className="lead-card__name truncate">
          {lead.firstName} {lead.lastName}
        </span>
        {lead.agent && <Avatar name={lead.agent.name} size="sm" />}
      </div>
      <p className="lead-card__project truncate">{lead.project ? `${lead.project.name} · ${lead.project.city}` : "Projet non précisé"}</p>
      <div className="lead-card__meta">
        {lead.budget ? <span className="lead-card__budget num">{formatCompactMAD(lead.budget)}</span> : <span className="faint xsmall">Budget n.c.</span>}
        <span className="tag">{lead.source}</span>
      </div>
      <p className="lead-card__foot">{lead.lastContactAt ? `Dernier contact ${timeAgo(lead.lastContactAt)}` : `Créé ${timeAgo(lead.createdAt)}`}</p>
    </Link>
  );
}

export default function LeadsPage() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const leads = useAsync(() => api.leads.list(), []);
  const projects = useAsync(() => api.projects.list(), []);
  const team = useAsync(() => api.team.list(), []);
  const [query, setQuery] = useState("");
  const [projectId, setProjectId] = useState("");
  const [agentId, setAgentId] = useState("");
  const [creating, setCreating] = useState(false);
  const [dragId, setDragId] = useState(null);
  const [overStage, setOverStage] = useState(null);
  const canWrite = can(user, "leads.write");
  const agents = (team.data ?? []).filter((member) => member.role === "commercial");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (leads.data ?? []).filter(
      (lead) =>
        (!projectId || lead.projectId === projectId) &&
        (!agentId || lead.agentId === agentId) &&
        (!q || `${lead.firstName} ${lead.lastName} ${lead.phone} ${lead.email}`.toLowerCase().includes(q)),
    );
  }, [leads.data, query, projectId, agentId]);

  const columns = useMemo(
    () =>
      LEAD_STAGES.map((stage) => {
        const items = filtered.filter((lead) => lead.stage === stage.value);
        return { ...stage, items, budget: items.reduce((total, lead) => total + (lead.budget ?? 0), 0) };
      }),
    [filtered],
  );

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
    if (LOCKED_TARGETS[stage]) {
      toast.info(LOCKED_TARGETS[stage]);
      return;
    }
    const previous = leads.data;
    leads.setData((items) => items.map((item) => (item.id === lead.id ? { ...item, stage } : item)));
    try {
      await api.leads.update(lead.id, { stage });
    } catch (error) {
      leads.setData(previous);
      toast.error(errorMessage(error));
    }
  }

  const isLoading = leads.loading && !leads.data;

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Leads"
        description="Pipeline des prospects. Glissez une carte pour changer d'étape ; la pré-réservation et la vente suivent le dossier."
        actions={
          canWrite && (
            <Button variant="primary" icon={Plus} onClick={() => setCreating(true)}>
              Nouveau lead
            </Button>
          )
        }
      />

      <div className="toolbar">
        <SearchInput value={query} onChange={setQuery} placeholder="Nom, téléphone, email…" />
        <select className="select" value={projectId} onChange={(event) => setProjectId(event.target.value)} aria-label="Filtrer par projet">
          <option value="">Tous les projets</option>
          {(projects.data ?? []).map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
        {agents.length > 1 && (
          <select className="select" value={agentId} onChange={(event) => setAgentId(event.target.value)} aria-label="Filtrer par commercial">
            <option value="">Tous les commerciaux</option>
            {agents.map((agent) => (
              <option key={agent.id} value={agent.id}>
                {agent.name}
              </option>
            ))}
          </select>
        )}
        <span className="toolbar__spacer" />
        {leads.data && <span className="small muted">{filtered.length} lead(s)</span>}
      </div>

      {leads.error && !leads.data ? (
        <div className="card">
          <ErrorState error={leads.error} onRetry={leads.reload} />
        </div>
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
                      draggable={canWrite && !ENGAGED_STAGES.includes(lead.stage)}
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
          toast.success(`${lead.firstName} ${lead.lastName} ajouté au pipeline.`);
        }}
      />
    </>
  );
}

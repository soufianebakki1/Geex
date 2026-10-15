import { Landmark } from "lucide-react";
import { api } from "../api/index.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import CrudPage from "../components/CrudPage.jsx";
import { Badge } from "../components/ui.jsx";

const dash = <span className="faint">—</span>;

const COLUMNS = [
  {
    key: "company",
    label: "Société",
    render: (item) => (
      <>
        <div className="cell-primary">{item.company}</div>
        <div className="cell-secondary">{item.group || "Groupe non renseigné"}</div>
      </>
    ),
  },
  {
    key: "legal",
    label: "RC · IF · ICE",
    render: (item) => (
      <div className="small">
        <div>RC {item.rc || "—"}</div>
        <div className="cell-secondary num">
          IF {item.ifNumber || "—"} · ICE {item.ice || "—"}
        </div>
      </div>
    ),
  },
  { key: "headOffice", label: "Siège social", render: (item) => item.headOffice || dash },
  {
    key: "projects",
    label: "Projets",
    render: (item) =>
      item.projects?.length ? (
        <div className="row wrap" style={{ gap: 4 }}>
          {item.projects.map((project) => (
            <Badge key={project.id} tone="brand">
              {project.name}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="faint">Aucun</span>
      ),
  },
];

const FIELDS = [
  { name: "group", label: "Groupe", placeholder: "Groupe Konouz" },
  { name: "company", label: "Société", required: true, placeholder: "Raison sociale" },
  { name: "rc", label: "RC", hint: "Registre de commerce" },
  { name: "ifNumber", label: "IF", hint: "Identifiant fiscal" },
  { name: "ice", label: "ICE", hint: "Identifiant commun de l'entreprise (15 chiffres)", span: true },
  { name: "headOffice", label: "Siège social", type: "textarea", span: true },
];

const SEARCH_KEYS = ["company", "group", "rc", "ifNumber", "ice", "headOffice"];

export default function PromotersPage() {
  const { user } = useAuth();
  return (
    <CrudPage
      title="Promoteurs"
      entityLabel="Promoteur"
      resource={api.promoters}
      columns={COLUMNS}
      fields={FIELDS}
      searchKeys={SEARCH_KEYS}
      canWrite={can(user, "promoters.write")}
      emptyIcon={Landmark}
    />
  );
}

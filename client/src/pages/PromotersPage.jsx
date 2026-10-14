import { Landmark } from "lucide-react";
import { api } from "../api/index.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import CrudPage from "../components/CrudPage.jsx";
import { Badge } from "../components/ui.jsx";

const COLUMNS = [
  {
    key: "name",
    label: "Promoteur",
    render: (item) => (
      <>
        <div className="cell-primary">{item.name}</div>
        <div className="cell-secondary">{item.ice ? `ICE ${item.ice}` : "ICE non renseigné"}</div>
      </>
    ),
  },
  {
    key: "contactName",
    label: "Contact",
    render: (item) => (
      <>
        <div>{item.contactName || <span className="faint">—</span>}</div>
        <div className="cell-secondary">{[item.phone, item.email].filter(Boolean).join(" · ")}</div>
      </>
    ),
  },
  { key: "city", label: "Ville" },
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
  { name: "name", label: "Raison sociale", required: true, span: true },
  { name: "contactName", label: "Interlocuteur" },
  { name: "ice", label: "ICE", hint: "Identifiant commun de l'entreprise (15 chiffres)" },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "email", label: "Email", type: "email" },
  { name: "city", label: "Ville" },
  { name: "address", label: "Adresse" },
];

const SEARCH_KEYS = ["name", "contactName", "city", "email", "ice"];

export default function PromotersPage() {
  const { user } = useAuth();
  return (
    <CrudPage
      eyebrow="Référentiel"
      title="Promoteurs"
      description="Sociétés de promotion porteuses des programmes commercialisés."
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

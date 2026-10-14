import { HardHat } from "lucide-react";
import { api } from "../api/index.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { can } from "../auth/permissions.js";
import CrudPage from "../components/CrudPage.jsx";
import { Avatar, Badge } from "../components/ui.jsx";

const COLUMNS = [
  {
    key: "name",
    label: "Chef de projet",
    render: (item) => (
      <div className="row">
        <Avatar name={item.name} />
        <div>
          <div className="cell-primary">{item.name}</div>
          <div className="cell-secondary">{item.specialty || "—"}</div>
        </div>
      </div>
    ),
  },
  {
    key: "email",
    label: "Coordonnées",
    render: (item) => (
      <>
        <div>{item.email || <span className="faint">—</span>}</div>
        <div className="cell-secondary">{item.phone}</div>
      </>
    ),
  },
  {
    key: "projects",
    label: "Projets suivis",
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
  { name: "name", label: "Nom complet", required: true, span: true },
  { name: "email", label: "Email", type: "email" },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "specialty", label: "Spécialité", span: true },
];

const SEARCH_KEYS = ["name", "email", "specialty"];

export default function ManagersPage() {
  const { user } = useAuth();
  return (
    <CrudPage
      eyebrow="Référentiel"
      title="Chefs de projet"
      description="Responsables du suivi technique et de la livraison de chaque programme."
      entityLabel="Chef de projet"
      resource={api.managers}
      columns={COLUMNS}
      fields={FIELDS}
      searchKeys={SEARCH_KEYS}
      canWrite={can(user, "managers.write")}
      emptyIcon={HardHat}
    />
  );
}

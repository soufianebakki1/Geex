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
          <div className="cell-primary">
            {item.lastName} {item.firstName}
          </div>
          <div className="cell-secondary">Compte CRM actif</div>
        </div>
      </div>
    ),
  },
  { key: "phone", label: "Téléphone", render: (item) => <span className="num">{item.phone || "—"}</span> },
  { key: "email", label: "Email", render: (item) => item.email },
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
  { name: "lastName", label: "Nom", required: true },
  { name: "firstName", label: "Prénom", required: true },
  { name: "phone", label: "Téléphone", type: "tel" },
  { name: "email", label: "Email", type: "email", required: true, hint: "Sert d'identifiant de connexion au CRM" },
  { name: "password", label: "Mot de passe provisoire", type: "password", required: true, createOnly: true, span: true, hint: "8 caractères minimum, à changer à la première connexion" },
];

const SEARCH_KEYS = ["name", "email", "phone"];

export default function ManagersPage() {
  const { user } = useAuth();
  return (
    <CrudPage
      title="Chefs de projet"
      entityLabel="Chef de projet"
      resource={api.managers}
      columns={COLUMNS}
      fields={FIELDS}
      searchKeys={SEARCH_KEYS}
      canWrite={can(user, "managers.write")}
      emptyIcon={HardHat}
      deleteLabel="Retirer"
      deleteDescription="Le compte CRM de ce chef de projet sera désactivé. Son historique est conservé."
    />
  );
}

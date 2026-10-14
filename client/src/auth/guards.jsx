import { Navigate, useLocation } from "react-router-dom";
import { LoaderCircle, ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import { can, homeFor } from "./permissions.js";
import { ButtonLink, EmptyState } from "../components/ui.jsx";

export function RequireAuth({ children }) {
  const { user, status } = useAuth();
  const location = useLocation();

  if (status === "loading") {
    return (
      <div className="full-loader">
        <LoaderCircle size={24} className="spin" aria-label="Chargement" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  return children;
}

export function RequireArea({ area, children }) {
  const { user } = useAuth();
  if (can(user, area)) return children;
  return (
    <div className="card">
      <EmptyState
        icon={ShieldAlert}
        title="Accès réservé"
        description="Votre rôle ne donne pas accès à cette section. Contactez un administrateur si vous pensez qu'il s'agit d'une erreur."
        action={
          <ButtonLink to={homeFor(user)} size="sm">
            Retour à mon espace
          </ButtonLink>
        }
      />
    </div>
  );
}

import { Route, Routes } from "react-router-dom";
import { Compass } from "lucide-react";
import AppShell from "./components/AppShell.jsx";
import { ButtonLink, EmptyState } from "./components/ui.jsx";
import { RequireArea, RequireAuth } from "./auth/guards.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import LeadsPage from "./pages/LeadsPage.jsx";
import LeadDetailPage from "./pages/LeadDetailPage.jsx";
import ProjectsPage from "./pages/ProjectsPage.jsx";
import LotsPage from "./pages/LotsPage.jsx";
import PreReservationsPage from "./pages/PreReservationsPage.jsx";
import DossiersPage from "./pages/DossiersPage.jsx";
import DossierDetailPage from "./pages/DossierDetailPage.jsx";
import ReservationsPage from "./pages/ReservationsPage.jsx";
import ReservationDetailPage from "./pages/ReservationDetailPage.jsx";
import PaymentsPage from "./pages/PaymentsPage.jsx";
import SchedulePage from "./pages/SchedulePage.jsx";
import PromotersPage from "./pages/PromotersPage.jsx";
import ManagersPage from "./pages/ManagersPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import SettingsPage from "./pages/SettingsPage.jsx";

const guarded = (area, element) => <RequireArea area={area}>{element}</RequireArea>;

function NotFound() {
  return (
    <div className="card">
      <EmptyState
        icon={Compass}
        title="Page introuvable"
        description="L'adresse demandée n'existe pas ou a été déplacée."
        action={
          <ButtonLink to="/" size="sm">
            Retour au tableau de bord
          </ButtonLink>
        }
      />
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={guarded("dashboard", <DashboardPage />)} />
        <Route path="leads" element={guarded("leads", <LeadsPage />)} />
        <Route path="leads/:id" element={guarded("leads", <LeadDetailPage />)} />
        <Route path="projets" element={guarded("projects", <ProjectsPage />)} />
        <Route path="lots" element={guarded("lots", <LotsPage />)} />
        <Route path="pre-reservations" element={guarded("preReservations", <PreReservationsPage />)} />
        <Route path="dossiers" element={guarded("dossiers", <DossiersPage />)} />
        <Route path="dossiers/:id" element={guarded("dossiers", <DossierDetailPage />)} />
        <Route path="reservations" element={guarded("reservations", <ReservationsPage />)} />
        <Route path="reservations/:id" element={guarded("reservations", <ReservationDetailPage />)} />
        <Route path="paiements" element={guarded("payments", <PaymentsPage />)} />
        <Route path="echeancier" element={guarded("schedule", <SchedulePage />)} />
        <Route path="promoteurs" element={guarded("promoters", <PromotersPage />)} />
        <Route path="chefs-de-projet" element={guarded("managers", <ManagersPage />)} />
        <Route path="notifications" element={guarded("notifications", <NotificationsPage />)} />
        <Route path="parametres" element={guarded("settings", <SettingsPage />)} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

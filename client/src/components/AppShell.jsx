import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Building2,
  CalendarClock,
  ChevronDown,
  FilePen,
  FolderCheck,
  HardHat,
  Landmark,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Settings,
  Timer,
  UsersRound,
  Wallet,
  X,
  FlaskConical,
} from "lucide-react";
import { api } from "../api/index.js";
import { USE_MOCKS } from "../api/client.js";
import { useAuth } from "../auth/AuthContext.jsx";
import { AREA_LABELS, ROLE_LABEL, areaForPath, can } from "../auth/permissions.js";
import Logo from "./Logo.jsx";
import { Avatar, Button } from "./ui.jsx";

export const NOTIFICATIONS_CHANGED = "konouz:notifications-changed";

const NAV = [
  { label: "Pilotage", items: [{ to: "/", area: "dashboard", icon: LayoutDashboard, end: true }] },
  {
    label: "Commercial",
    items: [
      { to: "/leads", area: "leads", icon: UsersRound },
      { to: "/pre-reservations", area: "preReservations", icon: Timer },
      { to: "/dossiers", area: "dossiers", icon: FolderCheck },
      { to: "/reservations", area: "reservations", icon: FilePen },
    ],
  },
  {
    label: "Catalogue",
    items: [
      { to: "/projets", area: "projects", icon: Building2 },
      { to: "/lots", area: "lots", icon: LayoutGrid },
    ],
  },
  {
    label: "Finance",
    items: [
      { to: "/paiements", area: "payments", icon: Wallet },
      { to: "/echeancier", area: "schedule", icon: CalendarClock },
    ],
  },
  {
    label: "Référentiel",
    items: [
      { to: "/promoteurs", area: "promoters", icon: Landmark },
      { to: "/chefs-de-projet", area: "managers", icon: HardHat },
    ],
  },
  {
    label: "Compte",
    items: [
      { to: "/notifications", area: "notifications", icon: Bell, badge: "notifications" },
      { to: "/parametres", area: "settings", icon: Settings },
    ],
  },
];

function useUnreadCount() {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    const refresh = () =>
      api.notifications
        .unreadCount()
        .then((result) => active && setCount(result?.count ?? 0))
        .catch(() => {});
    refresh();
    window.addEventListener(NOTIFICATIONS_CHANGED, refresh);
    const timer = setInterval(refresh, 60_000);
    return () => {
      active = false;
      window.removeEventListener(NOTIFICATIONS_CHANGED, refresh);
      clearInterval(timer);
    };
  }, [location.pathname]);

  return count;
}

function UserMenu({ user, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (event) => !ref.current?.contains(event.target) && setOpen(false);
    const onKey = (event) => event.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className="user-chip" onClick={() => setOpen((value) => !value)} aria-expanded={open} aria-haspopup="menu">
        <Avatar name={user.name} tone="gold" />
        <span className="user-chip__name">{user.name.split(" ")[0]}</span>
        <ChevronDown size={15} className="faint" />
      </button>
      {open && (
        <div className="dropdown__menu" role="menu">
          <div className="dropdown__header">
            <div className="strong">{user.name}</div>
            <div className="xsmall muted">{user.email}</div>
            <div className="xsmall faint">{ROLE_LABEL[user.role]}</div>
          </div>
          <button type="button" className="dropdown__item" role="menuitem" onClick={onLogout}>
            <LogOut size={16} />
            Se déconnecter
          </button>
        </div>
      )}
    </div>
  );
}

export default function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [navOpen, setNavOpen] = useState(false);
  const unread = useUnreadCount();
  const area = areaForPath(location.pathname);

  useEffect(() => setNavOpen(false), [location.pathname]);

  async function handleLogout() {
    await logout();
    navigate("/login", { replace: true });
  }

  const groups = NAV.map((group) => ({ ...group, items: group.items.filter((item) => can(user, item.area)) })).filter((group) => group.items.length);

  return (
    <div className={`shell ${navOpen ? "is-nav-open" : ""}`}>
      <aside className="sidebar" aria-label="Navigation principale">
        <div className="sidebar__brand">
          <Link to="/" aria-label="Konouz Immobilier — accueil">
            <Logo size={58} />
          </Link>
          <button type="button" className="sidebar__close" onClick={() => setNavOpen(false)} aria-label="Fermer le menu">
            <X size={18} />
          </button>
        </div>

        <nav className="sidebar__nav">
          {groups.map((group) => (
            <div key={group.label} className="nav-group">
              <p className="nav-group__label">{group.label}</p>
              {group.items.map((item) => (
                <NavLink key={item.to} to={item.to} end={item.end} className="nav-link">
                  <item.icon size={18} />
                  <span>{AREA_LABELS[item.area]}</span>
                  {item.badge === "notifications" && unread > 0 && <span className="nav-link__count">{unread}</span>}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__user">
            <Avatar name={user.name} tone="gold" />
            <div className="grow">
              <div className="sidebar__user-name truncate">{user.name}</div>
              <div className="sidebar__user-role">{ROLE_LABEL[user.role]}</div>
            </div>
            <button type="button" className="sidebar__logout" onClick={handleLogout} aria-label="Se déconnecter" title="Se déconnecter">
              <LogOut size={17} />
            </button>
          </div>
        </div>
      </aside>
      <div className="sidebar-backdrop" onClick={() => setNavOpen(false)} aria-hidden="true" />

      <div className="main">
        <header className="topbar">
          <Button variant="ghost" iconOnly icon={Menu} className="topbar__menu" onClick={() => setNavOpen(true)} aria-label="Ouvrir le menu" />
          <div className="topbar__crumbs">
            <span>Konouz Immobilier</span>
            {area && (
              <>
                <span aria-hidden="true">/</span>
                <strong>{AREA_LABELS[area]}</strong>
              </>
            )}
          </div>
          <div className="topbar__actions">
            {USE_MOCKS && (
              <span className="demo-flag" title="Les données affichées proviennent du serveur de démonstration local.">
                <FlaskConical size={13} />
                <span>Données de démonstration</span>
              </span>
            )}
            <Link to="/notifications" className="btn btn--ghost btn--icon topbar__bell" aria-label={`Notifications${unread ? ` (${unread} non lues)` : ""}`}>
              <Bell size={18} />
              {unread > 0 && <span className="topbar__bell-dot">{unread > 9 ? "9+" : unread}</span>}
            </Link>
            <UserMenu user={user} onLogout={handleLogout} />
          </div>
        </header>

        <main className="content" key={location.pathname}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}

export const ROLES = [
  { value: "admin", label: "Administrateur" },
  { value: "direction", label: "Direction" },
  { value: "commercial", label: "Commercial" },
  { value: "chef_projet", label: "Chef de projet" },
  { value: "comptable", label: "Comptabilité" },
];

export const ROLE_LABEL = Object.fromEntries(ROLES.map((role) => [role.value, role.label]));

const ALL = ROLES.map((role) => role.value);

export const AREAS = {
  dashboard: ALL,
  leads: ["admin", "direction", "commercial", "chef_projet"],
  projects: ALL,
  lots: ALL,
  preReservations: ["admin", "direction", "commercial"],
  dossiers: ["admin", "direction", "commercial", "comptable"],
  reservations: ["admin", "direction", "commercial", "comptable"],
  payments: ["admin", "direction", "commercial", "comptable"],
  schedule: ["admin", "direction", "commercial", "comptable"],
  promoters: ["admin", "direction", "chef_projet"],
  managers: ["admin", "direction"],
  notifications: ALL,
  settings: ["admin"],
};

export const AREA_LABELS = {
  dashboard: "Tableau de bord",
  leads: "Leads",
  projects: "Projets",
  lots: "Lots",
  preReservations: "Pré-réservations",
  dossiers: "Dossiers",
  reservations: "Réservations",
  payments: "Paiements",
  schedule: "Échéancier",
  promoters: "Promoteurs",
  managers: "Chefs de projet",
  notifications: "Notifications",
  settings: "Paramètres",
};

export const ACTIONS = {
  "leads.write": ["admin", "commercial"],
  "leads.assign": ["admin"],
  "leads.close": ["admin"],
  "catalog.write": ["admin", "chef_projet"],
  "preReservations.write": ["admin", "commercial"],
  "preReservations.extend": ["admin", "direction"],
  "dossiers.upload": ["admin", "commercial"],
  "dossiers.validate": ["admin", "comptable"],
  "reservations.confirm": ["admin", "commercial"],
  "reservations.approveDiscount": ["admin", "direction"],
  "reservations.close": ["admin", "direction"],
  "payments.create": ["admin", "commercial", "comptable"],
  "payments.validate": ["admin", "comptable"],
  "promoters.write": ["admin"],
  "managers.write": ["admin"],
  "sources.write": ["admin"],
  "users.manage": ["admin"],
};

export function can(user, key) {
  if (!user) return false;
  const roles = AREAS[key] ?? ACTIONS[key];
  return Boolean(roles?.includes(user.role));
}

const HOME_BY_ROLE = {
  admin: "/",
  direction: "/",
  commercial: "/leads",
  chef_projet: "/projets",
  comptable: "/paiements",
};

export function homeFor(user) {
  return HOME_BY_ROLE[user?.role] ?? "/";
}

const PATH_AREAS = [
  ["/leads", "leads"],
  ["/projets", "projects"],
  ["/lots", "lots"],
  ["/pre-reservations", "preReservations"],
  ["/dossiers", "dossiers"],
  ["/reservations", "reservations"],
  ["/paiements", "payments"],
  ["/echeancier", "schedule"],
  ["/promoteurs", "promoters"],
  ["/chefs-de-projet", "managers"],
  ["/notifications", "notifications"],
  ["/parametres", "settings"],
];

export function areaForPath(pathname) {
  const match = PATH_AREAS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return match ? match[1] : pathname === "/" ? "dashboard" : null;
}

export function canAccessPath(user, path) {
  const pathname = path.split("?")[0];
  const area = areaForPath(pathname);
  return area ? can(user, area) : false;
}

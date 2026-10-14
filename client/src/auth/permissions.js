export const ROLES = [
  { value: "admin", label: "Administrateur" },
  { value: "commercial", label: "Commercial" },
  { value: "chef_projet", label: "Chef de projet" },
  { value: "comptable", label: "Comptable" },
];

export const ROLE_LABEL = Object.fromEntries(ROLES.map((role) => [role.value, role.label]));

const ALL = ROLES.map((role) => role.value);

export const AREAS = {
  dashboard: ALL,
  leads: ["admin", "commercial", "chef_projet"],
  projects: ALL,
  lots: ALL,
  preReservations: ["admin", "commercial"],
  dossiers: ["admin", "commercial", "comptable"],
  reservations: ["admin", "commercial", "comptable"],
  payments: ["admin", "commercial", "comptable"],
  schedule: ["admin", "commercial", "comptable"],
  promoters: ["admin", "chef_projet"],
  managers: ["admin"],
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
  "catalog.write": ["admin", "chef_projet"],
  "preReservations.write": ["admin", "commercial"],
  "dossiers.upload": ["admin", "commercial"],
  "dossiers.validate": ["admin", "comptable"],
  "reservations.confirm": ["admin", "commercial"],
  "payments.create": ["admin", "commercial", "comptable"],
  "payments.validate": ["admin", "comptable"],
  "promoters.write": ["admin"],
  "managers.write": ["admin"],
  "users.manage": ["admin"],
};

export function can(user, key) {
  if (!user) return false;
  const roles = AREAS[key] ?? ACTIONS[key];
  return Boolean(roles?.includes(user.role));
}

const HOME_BY_ROLE = {
  admin: "/",
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

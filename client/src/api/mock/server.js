import { ApiError } from "../errors.js";
import { ACTIONS, AREAS } from "../../auth/permissions.js";
import { createSeed } from "./seed.js";
import {
  DAY,
  HOUR,
  buildSchedule,
  dossierState,
  installmentStatus,
  newDocuments,
  recomputeReservation,
  uid,
} from "./logic.js";

const STORAGE_KEY = "konouz.mock-db.v1";

let db = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Corrupted local data falls back to a fresh seed.
  }
  const seed = createSeed();
  persist(seed);
  return seed;
}

function persist(data = db) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Storage quota or private mode: keep working in memory.
  }
}

export function resetMockData() {
  const sessions = db.sessions;
  db = createSeed();
  db.sessions = sessions;
  persist();
}

/* ------------------------------------------------------------------ */
/* Routing                                                             */
/* ------------------------------------------------------------------ */

const routes = [];

function route(method, pattern, handler, options = {}) {
  const keys = [];
  const source = pattern.replace(/:(\w+)/g, (_, key) => {
    keys.push(key);
    return "([^/]+)";
  });
  routes.push({ method, regex: new RegExp(`^${source}/?$`), keys, handler, ...options });
}

const fail = (status, message) => {
  throw new ApiError(status, message);
};

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function mockRequest(method, path, body, token) {
  await wait(160 + Math.random() * 220);

  const [pathname, search = ""] = path.split("?");
  const query = Object.fromEntries(new URLSearchParams(search));

  let matched = null;
  let params = {};
  for (const candidate of routes) {
    if (candidate.method !== method) continue;
    const match = candidate.regex.exec(pathname);
    if (!match) continue;
    matched = candidate;
    params = Object.fromEntries(candidate.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
    break;
  }
  if (!matched) fail(404, "Ressource introuvable.");

  const userId = token ? db.sessions[token] : null;
  const user = userId ? db.users.find((item) => item.id === userId && item.active) : null;
  if (!matched.public && !user) fail(401, "Votre session a expiré. Veuillez vous reconnecter.");
  if (matched.roles && !matched.roles.includes(user.role)) fail(403, "Vous n'avez pas les droits nécessaires pour cette action.");

  expirePreReservations();
  const result = await matched.handler({ params, query, body: body ?? {}, user, token });
  persist();
  return result === undefined ? null : structuredClone(result);
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const now = () => new Date().toISOString();
const byId = (list, id) => list.find((item) => item.id === id);
const mustFind = (list, id, label) => byId(list, id) ?? fail(404, `${label} introuvable.`);
const sum = (list, pick = (x) => x) => list.reduce((total, item) => total + pick(item), 0);
const startOfMonth = () => {
  const date = new Date();
  return new Date(date.getFullYear(), date.getMonth(), 1).toISOString();
};
const required = (value, message) => {
  if (value === undefined || value === null || String(value).trim() === "") fail(422, message);
};
const positiveNumber = (value, message) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) fail(422, message);
  return number;
};
const roles = (...keys) => [...new Set(keys.flatMap((key) => AREAS[key] ?? ACTIONS[key] ?? []))];

const userSummary = (id) => {
  const user = byId(db.users, id);
  return user ? { id: user.id, name: user.name, role: user.role } : null;
};
const leadName = (lead) => (lead ? `${lead.firstName} ${lead.lastName}` : "—");

function log(activity) {
  db.activities.push({ id: uid("ACT"), at: now(), ...activity });
}

function notify(notification) {
  db.notifications.push({ id: uid("N"), at: now(), readBy: [], roles: null, ...notification });
}

const STAGE_LABEL = {
  nouveau: "Nouveau",
  contacte: "Contacté",
  visite: "Visite",
  negociation: "Négociation",
  pre_reserve: "Pré-réservé",
  gagne: "Gagné",
  perdu: "Perdu",
};
const STAGES = Object.keys(STAGE_LABEL);
const ENGAGED_STAGES = ["pre_reserve", "gagne"];
const CONTACT_LABEL = { appel: "Appel", email: "Email", whatsapp: "WhatsApp", visite: "Visite", rdv: "Rendez-vous" };

function expirePreReservations() {
  const current = Date.now();
  for (const pre of db.preReservations) {
    if (pre.status !== "active" || new Date(pre.expiresAt).getTime() > current) continue;
    pre.status = "expiree";
    const lot = byId(db.lots, pre.lotId);
    if (lot?.status === "pre_reserve") lot.status = "disponible";
    const lead = byId(db.leads, pre.leadId);
    if (lead?.stage === "pre_reserve") lead.stage = "negociation";
    log({ type: "pre_reservation", leadId: pre.leadId, userId: null, message: `Pré-réservation du lot ${lot?.ref ?? ""} expirée — lot remis en vente` });
    notify({ type: "danger", title: "Pré-réservation expirée", message: `${leadName(lead)} — lot ${lot?.ref ?? ""} est de nouveau disponible.`, link: "/pre-reservations", roles: ["admin", "commercial"] });
  }
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function projectRef(id) {
  const project = byId(db.projects, id);
  return project ? { id: project.id, name: project.name, city: project.city } : null;
}

function leadView(lead) {
  return { ...lead, project: projectRef(lead.projectId), agent: userSummary(lead.agentId) };
}

function lotHolder(lot) {
  if (lot.status === "pre_reserve") {
    const pre = db.preReservations.find((item) => item.lotId === lot.id && ["active", "convertie"].includes(item.status));
    const lead = pre && byId(db.leads, pre.leadId);
    if (lead) return { leadId: lead.id, name: leadName(lead), preReservationId: pre.id };
  }
  if (lot.status === "reserve" || lot.status === "vendu") {
    const reservation = db.reservations.find((item) => item.lotId === lot.id && item.status !== "annulee");
    const lead = reservation && byId(db.leads, reservation.leadId);
    if (lead) return { leadId: lead.id, name: leadName(lead), reservationId: reservation.id };
  }
  return null;
}

function lotView(lot) {
  return { ...lot, project: projectRef(lot.projectId), holder: lotHolder(lot) };
}

function stockOf(projectId) {
  const lots = db.lots.filter((lot) => lot.projectId === projectId);
  const count = (status) => lots.filter((lot) => lot.status === status).length;
  return {
    total: lots.length,
    disponible: count("disponible"),
    pre_reserve: count("pre_reserve"),
    reserve: count("reserve"),
    vendu: count("vendu"),
    bloque: count("bloque"),
    availableValue: sum(lots.filter((lot) => lot.status === "disponible"), (lot) => lot.price),
  };
}

function projectView(project) {
  const promoter = byId(db.promoters, project.promoterId);
  const manager = byId(db.managers, project.managerId);
  return {
    ...project,
    promoter: promoter ? { id: promoter.id, name: promoter.name } : null,
    manager: manager ? { id: manager.id, name: manager.name } : null,
    stock: stockOf(project.id),
  };
}

function preReservationView(pre) {
  const lot = byId(db.lots, pre.lotId);
  const lead = byId(db.leads, pre.leadId);
  const dossier = db.dossiers.find((item) => item.preReservationId === pre.id);
  return {
    ...pre,
    lead: lead ? { id: lead.id, name: leadName(lead), phone: lead.phone } : null,
    lot: lot ? { id: lot.id, ref: lot.ref, type: lot.type, surface: lot.surface, price: lot.price, project: projectRef(lot.projectId) } : null,
    createdByUser: userSummary(pre.createdBy),
    dossierId: dossier?.id ?? null,
  };
}

function dossierView(dossier, { detailed = false } = {}) {
  const lead = byId(db.leads, dossier.leadId);
  const lot = byId(db.lots, dossier.lotId);
  const pre = byId(db.preReservations, dossier.preReservationId);
  const reservation = db.reservations.find((item) => item.dossierId === dossier.id);
  const view = {
    id: dossier.id,
    createdAt: dossier.createdAt,
    lead: lead ? { id: lead.id, name: leadName(lead), phone: lead.phone, email: lead.email } : null,
    lot: lot ? { id: lot.id, ref: lot.ref, type: lot.type, surface: lot.surface, price: lot.price, project: projectRef(lot.projectId) } : null,
    deposit: pre?.deposit ?? 0,
    preReservationId: dossier.preReservationId,
    reservation: reservation ? { id: reservation.id, number: reservation.number, status: reservation.status } : null,
    state: dossierState(dossier),
  };
  if (detailed) {
    view.documents = dossier.documents.map((doc) => ({
      ...doc,
      uploadedByUser: userSummary(doc.uploadedBy),
      validatedByUser: userSummary(doc.validatedBy),
    }));
  }
  return view;
}

function installmentView(item) {
  return { ...item, status: installmentStatus(item) };
}

function reservationTotals(reservation) {
  const schedule = db.installments.filter((item) => item.reservationId === reservation.id);
  const validated = sum(
    db.payments.filter((payment) => payment.reservationId === reservation.id && payment.status === "valide"),
    (payment) => payment.amount,
  );
  const pending = sum(
    db.payments.filter((payment) => payment.reservationId === reservation.id && payment.status === "en_attente"),
    (payment) => payment.amount,
  );
  const overdue = sum(
    schedule.filter((item) => installmentStatus(item) === "en_retard"),
    (item) => item.amount - item.paidAmount,
  );
  return { price: reservation.price, paid: validated, pending, remaining: Math.max(reservation.price - validated, 0), overdue };
}

function reservationView(reservation, { detailed = false } = {}) {
  const lead = byId(db.leads, reservation.leadId);
  const lot = byId(db.lots, reservation.lotId);
  const view = {
    ...reservation,
    lead: lead ? { id: lead.id, name: leadName(lead), firstName: lead.firstName, lastName: lead.lastName, phone: lead.phone, email: lead.email, city: lead.city } : null,
    lot: lot ? { id: lot.id, ref: lot.ref, type: lot.type, floor: lot.floor, surface: lot.surface, rooms: lot.rooms, status: lot.status } : null,
    project: projectRef(reservation.projectId),
    totals: reservationTotals(reservation),
    createdByUser: userSummary(reservation.createdBy),
    confirmedByUser: userSummary(reservation.confirmedBy),
  };
  if (detailed) {
    const project = byId(db.projects, reservation.projectId);
    const promoter = project && byId(db.promoters, project.promoterId);
    view.project = project ? { ...projectRef(project.id), deliveryDate: project.deliveryDate, promoter: promoter ? { name: promoter.name, address: promoter.address, ice: promoter.ice } : null } : null;
    view.installments = db.installments
      .filter((item) => item.reservationId === reservation.id)
      .sort((a, b) => a.order - b.order)
      .map(installmentView);
    view.payments = db.payments
      .filter((payment) => payment.reservationId === reservation.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map((payment) => ({ ...payment, createdByUser: userSummary(payment.createdBy) }));
    const dossier = byId(db.dossiers, reservation.dossierId);
    view.dossier = dossier ? { id: dossier.id, state: dossierState(dossier) } : null;
  }
  return view;
}

function paymentView(payment) {
  const reservation = byId(db.reservations, payment.reservationId);
  const lead = reservation && byId(db.leads, reservation.leadId);
  const lot = reservation && byId(db.lots, reservation.lotId);
  return {
    ...payment,
    reservation: reservation ? { id: reservation.id, number: reservation.number } : null,
    lead: lead ? { id: lead.id, name: leadName(lead) } : null,
    lot: lot ? { id: lot.id, ref: lot.ref, project: projectRef(lot.projectId) } : null,
    createdByUser: userSummary(payment.createdBy),
    validatedByUser: userSummary(payment.validatedBy),
  };
}

function notificationVisible(notification, user) {
  return !notification.roles || notification.roles.includes(user.role);
}

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

route("POST", "/auth/login", ({ body }) => {
  const email = String(body.email ?? "").trim().toLowerCase();
  const user = db.users.find((item) => item.email.toLowerCase() === email);
  if (!user || db.credentials[user.email] !== body.password) fail(401, "Email ou mot de passe incorrect.");
  if (!user.active) fail(403, "Ce compte est désactivé. Contactez un administrateur.");
  const token = uid("tok");
  db.sessions[token] = user.id;
  return { token, user };
}, { public: true });

route("GET", "/auth/me", ({ user }) => user);

route("POST", "/auth/logout", ({ token }) => {
  delete db.sessions[token];
  return null;
});

route("GET", "/team", () =>
  db.users.filter((user) => user.active).map((user) => ({ id: user.id, name: user.name, role: user.role })),
);

/* ------------------------------------------------------------------ */
/* Dashboard                                                           */
/* ------------------------------------------------------------------ */

route("GET", "/dashboard", () => {
  const monthStart = startOfMonth();
  const current = Date.now();
  const activeLeads = db.leads.filter((lead) => !["gagne", "perdu"].includes(lead.stage));
  const activePre = db.preReservations.filter((pre) => pre.status === "active");
  const confirmedThisMonth = db.reservations.filter((item) => item.status === "confirmee" && item.confirmedAt >= monthStart);
  const collectedThisMonth = db.payments.filter((payment) => payment.status === "valide" && payment.validatedAt && payment.validatedAt >= monthStart);
  const pendingPayments = db.payments.filter((payment) => payment.status === "en_attente");
  const overdue = db.installments.filter((item) => installmentStatus(item) === "en_retard");

  const funnelStages = STAGES.filter((stage) => stage !== "perdu");
  const funnel = funnelStages.map((stage, index) => ({
    stage,
    label: STAGE_LABEL[stage],
    count: db.leads.filter((lead) => lead.stage !== "perdu" && STAGES.indexOf(lead.stage) >= index).length,
    current: db.leads.filter((lead) => lead.stage === stage).length,
  }));

  const upcoming = db.installments
    .filter((item) => {
      const status = installmentStatus(item);
      if (status === "paye") return false;
      return status === "en_retard" || new Date(item.dueDate).getTime() - current < 45 * DAY;
    })
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
    .map((item) => {
      const reservation = byId(db.reservations, item.reservationId);
      const lead = byId(db.leads, reservation.leadId);
      const lot = byId(db.lots, reservation.lotId);
      return { ...installmentView(item), reservation: { id: reservation.id, number: reservation.number }, leadName: leadName(lead), lotRef: lot?.ref };
    });

  return {
    kpis: {
      activeLeads: activeLeads.length,
      newLeadsThisMonth: db.leads.filter((lead) => lead.createdAt >= monthStart).length,
      activePreReservations: activePre.length,
      expiringSoon: activePre.filter((pre) => new Date(pre.expiresAt).getTime() - current < 48 * HOUR).length,
      reservationsThisMonth: confirmedThisMonth.length,
      reservationsValueThisMonth: sum(confirmedThisMonth, (item) => item.price),
      collectedThisMonth: sum(collectedThisMonth, (payment) => payment.amount),
      pendingPaymentsCount: pendingPayments.length,
      pendingPaymentsAmount: sum(pendingPayments, (payment) => payment.amount),
      overdueAmount: sum(overdue, (item) => item.amount - item.paidAmount),
      overdueCount: overdue.length,
      lostLeads: db.leads.filter((lead) => lead.stage === "perdu").length,
    },
    funnel,
    expiring: activePre
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
      .slice(0, 4)
      .map(preReservationView),
    upcoming,
    activity: [...db.activities]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10)
      .map((activity) => {
        const lead = activity.leadId && byId(db.leads, activity.leadId);
        return { ...activity, user: userSummary(activity.userId), lead: lead ? { id: lead.id, name: leadName(lead) } : null };
      }),
    stock: db.projects.map((project) => ({ id: project.id, name: project.name, city: project.city, stock: stockOf(project.id) })),
  };
});

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

route("GET", "/leads", ({ query }) => {
  const q = (query.q ?? "").trim().toLowerCase();
  return db.leads
    .filter((lead) => !query.stage || lead.stage === query.stage)
    .filter((lead) => !query.projectId || lead.projectId === query.projectId)
    .filter((lead) => !query.agentId || lead.agentId === query.agentId)
    .filter((lead) => !q || `${leadName(lead)} ${lead.phone} ${lead.email}`.toLowerCase().includes(q))
    .sort((a, b) => (b.lastContactAt ?? b.createdAt).localeCompare(a.lastContactAt ?? a.createdAt))
    .map(leadView);
}, { roles: roles("leads") });

function validateLead(data) {
  required(data.firstName, "Le prénom est obligatoire.");
  required(data.lastName, "Le nom est obligatoire.");
  required(data.phone, "Le téléphone est obligatoire.");
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) fail(422, "L'adresse email est invalide.");
  if (data.projectId && !byId(db.projects, data.projectId)) fail(422, "Projet inconnu.");
}

const LEAD_FIELDS = ["firstName", "lastName", "phone", "email", "city", "source", "budget", "projectId", "agentId", "notes"];
const pickFields = (data, fields) => Object.fromEntries(fields.filter((key) => key in data).map((key) => [key, data[key]]));

route("POST", "/leads", ({ body, user }) => {
  validateLead(body);
  const lead = {
    id: uid("L"),
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    city: "",
    source: "Appel entrant",
    budget: null,
    projectId: null,
    notes: "",
    ...pickFields(body, LEAD_FIELDS),
    agentId: body.agentId || user.id,
    budget: body.budget ? Number(body.budget) : null,
    stage: "nouveau",
    createdAt: now(),
    lastContactAt: null,
  };
  db.leads.push(lead);
  log({ type: "lead_created", leadId: lead.id, userId: user.id, message: `Lead créé (source : ${lead.source})` });
  if (lead.agentId !== user.id) {
    notify({ type: "info", title: "Nouveau lead assigné", message: `${leadName(lead)} vous a été assigné.`, link: `/leads/${lead.id}`, roles: ["admin", "commercial"] });
  }
  return leadView(lead);
}, { roles: roles("leads.write") });

route("GET", "/leads/:id", ({ params }) => {
  const lead = mustFind(db.leads, params.id, "Lead");
  const preReservations = db.preReservations
    .filter((pre) => pre.leadId === lead.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(preReservationView);
  const reservation = db.reservations.find((item) => item.leadId === lead.id && item.status !== "annulee");
  return { ...leadView(lead), preReservations, reservation: reservation ? reservationView(reservation) : null };
}, { roles: roles("leads") });

route("PATCH", "/leads/:id", ({ params, body, user }) => {
  const lead = mustFind(db.leads, params.id, "Lead");
  const next = { ...lead, ...pickFields(body, LEAD_FIELDS) };
  validateLead(next);
  if (body.budget !== undefined) next.budget = body.budget ? Number(body.budget) : null;

  if (body.stage && body.stage !== lead.stage) {
    if (!STAGES.includes(body.stage)) fail(422, "Étape inconnue.");
    if (ENGAGED_STAGES.includes(lead.stage)) fail(409, "Ce lead est engagé dans une réservation : son étape suit le dossier.");
    if (body.stage === "pre_reserve") fail(409, "Créez une pré-réservation pour passer un lead à cette étape.");
    if (body.stage === "gagne") fail(409, "Un lead passe à « Gagné » lorsque sa réservation est confirmée.");
    log({ type: "stage", leadId: lead.id, userId: user.id, message: `Étape : ${STAGE_LABEL[lead.stage]} → ${STAGE_LABEL[body.stage]}` });
    next.stage = body.stage;
  }

  Object.assign(lead, next);
  return leadView(lead);
}, { roles: roles("leads.write") });

route("GET", "/leads/:id/contacts", ({ params }) => {
  mustFind(db.leads, params.id, "Lead");
  return db.contacts
    .filter((contact) => contact.leadId === params.id)
    .sort((a, b) => b.date.localeCompare(a.date))
    .map((contact) => ({ ...contact, user: userSummary(contact.userId) }));
}, { roles: roles("leads") });

route("POST", "/leads/:id/contacts", ({ params, body, user }) => {
  const lead = mustFind(db.leads, params.id, "Lead");
  if (!CONTACT_LABEL[body.type]) fail(422, "Type de contact inconnu.");
  required(body.summary, "Le compte rendu est obligatoire.");
  const date = body.date ? new Date(body.date).toISOString() : now();
  const contact = { id: uid("CT"), leadId: lead.id, type: body.type, date, summary: String(body.summary).trim(), userId: user.id };
  db.contacts.push(contact);
  if (!lead.lastContactAt || date > lead.lastContactAt) lead.lastContactAt = date;
  log({ type: "contact", leadId: lead.id, userId: user.id, message: `${CONTACT_LABEL[body.type]} enregistré` });
  if (lead.stage === "nouveau") {
    lead.stage = "contacte";
    log({ type: "stage", leadId: lead.id, userId: user.id, message: "Étape : Nouveau → Contacté" });
  }
  return { ...contact, user: userSummary(user.id) };
}, { roles: roles("leads.write") });

route("GET", "/leads/:id/activities", ({ params }) => {
  mustFind(db.leads, params.id, "Lead");
  return db.activities
    .filter((activity) => activity.leadId === params.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((activity) => ({ ...activity, user: userSummary(activity.userId) }));
}, { roles: roles("leads") });

/* ------------------------------------------------------------------ */
/* Projects & lots                                                     */
/* ------------------------------------------------------------------ */

const PROJECT_FIELDS = ["name", "city", "type", "status", "promoterId", "managerId", "deliveryDate", "description"];

function validateProject(data) {
  required(data.name, "Le nom du projet est obligatoire.");
  required(data.city, "La ville est obligatoire.");
  if (!byId(db.promoters, data.promoterId)) fail(422, "Sélectionnez un promoteur.");
  if (!byId(db.managers, data.managerId)) fail(422, "Sélectionnez un chef de projet.");
  required(data.deliveryDate, "La date de livraison est obligatoire.");
}

route("GET", "/projects", () => db.projects.map(projectView));

route("GET", "/projects/:id", ({ params }) => projectView(mustFind(db.projects, params.id, "Projet")));

route("POST", "/projects", ({ body }) => {
  validateProject(body);
  const project = { id: uid("PJ"), type: "Résidentiel", status: "en_commercialisation", description: "", ...pickFields(body, PROJECT_FIELDS) };
  project.deliveryDate = new Date(project.deliveryDate).toISOString();
  db.projects.push(project);
  return projectView(project);
}, { roles: roles("catalog.write") });

route("PATCH", "/projects/:id", ({ params, body }) => {
  const project = mustFind(db.projects, params.id, "Projet");
  const next = { ...project, ...pickFields(body, PROJECT_FIELDS) };
  validateProject(next);
  next.deliveryDate = new Date(next.deliveryDate).toISOString();
  Object.assign(project, next);
  return projectView(project);
}, { roles: roles("catalog.write") });

route("GET", "/lots", ({ query }) => {
  const q = (query.q ?? "").trim().toLowerCase();
  return db.lots
    .filter((lot) => !query.projectId || lot.projectId === query.projectId)
    .filter((lot) => !query.status || lot.status === query.status)
    .filter((lot) => !query.type || lot.type === query.type)
    .filter((lot) => !q || lot.ref.toLowerCase().includes(q))
    .map(lotView);
});

route("GET", "/lots/:id", ({ params }) => lotView(mustFind(db.lots, params.id, "Lot")));

route("PATCH", "/lots/:id", ({ params, body, user }) => {
  const lot = mustFind(db.lots, params.id, "Lot");
  if (body.status && body.status !== lot.status) {
    const allowed = (lot.status === "disponible" && body.status === "bloque") || (lot.status === "bloque" && body.status === "disponible");
    if (!allowed) fail(409, "Seuls les lots disponibles peuvent être bloqués, et inversement.");
    lot.status = body.status;
    notify({
      type: "info",
      title: body.status === "bloque" ? "Lot bloqué" : "Lot débloqué",
      message: `Le lot ${lot.ref} (${projectRef(lot.projectId)?.name}) a été ${body.status === "bloque" ? "bloqué" : "remis en vente"} par ${user.name}.`,
      link: `/lots?projectId=${lot.projectId}`,
      roles: ["admin", "chef_projet", "commercial"],
    });
  }
  if (body.price !== undefined) {
    if (lot.status !== "disponible" && lot.status !== "bloque") fail(409, "Le prix d'un lot engagé ne peut pas être modifié.");
    lot.price = positiveNumber(body.price, "Le prix doit être un montant positif.");
  }
  return lotView(lot);
}, { roles: roles("catalog.write") });

/* ------------------------------------------------------------------ */
/* Pre-reservations                                                    */
/* ------------------------------------------------------------------ */

route("GET", "/pre-reservations", ({ query }) =>
  db.preReservations
    .filter((pre) => !query.status || pre.status === query.status)
    .filter((pre) => !query.leadId || pre.leadId === query.leadId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(preReservationView),
{ roles: roles("preReservations", "leads") });

route("POST", "/pre-reservations", ({ body, user }) => {
  const lead = mustFind(db.leads, body.leadId, "Lead");
  const lot = mustFind(db.lots, body.lotId, "Lot");
  if (lot.status !== "disponible") fail(409, `Le lot ${lot.ref} n'est plus disponible.`);
  if (["gagne", "perdu"].includes(lead.stage)) fail(409, "Ce lead ne peut pas faire l'objet d'une pré-réservation.");
  if (db.preReservations.some((pre) => pre.leadId === lead.id && pre.status === "active")) fail(409, "Ce lead a déjà une pré-réservation active.");
  const deposit = positiveNumber(body.deposit, "L'acompte doit être un montant positif.");
  if (deposit > lot.price) fail(422, "L'acompte ne peut pas dépasser le prix du lot.");
  const validityDays = Number(body.validityDays);
  if (!Number.isInteger(validityDays) || validityDays < 1 || validityDays > 30) fail(422, "La durée de validité doit être comprise entre 1 et 30 jours.");

  const createdAt = now();
  const pre = {
    id: uid("PR"),
    leadId: lead.id,
    lotId: lot.id,
    deposit,
    validityDays,
    createdAt,
    expiresAt: new Date(Date.now() + validityDays * DAY).toISOString(),
    status: "active",
    createdBy: user.id,
    note: String(body.note ?? "").trim(),
  };
  db.preReservations.push(pre);
  lot.status = "pre_reserve";
  if (lead.stage !== "pre_reserve") {
    log({ type: "stage", leadId: lead.id, userId: user.id, message: `Étape : ${STAGE_LABEL[lead.stage]} → Pré-réservé` });
    lead.stage = "pre_reserve";
  }
  log({ type: "pre_reservation", leadId: lead.id, userId: user.id, message: `Pré-réservation du lot ${lot.ref} (acompte ${deposit.toLocaleString("fr-FR")} MAD, ${validityDays} j)` });
  notify({ type: "info", title: "Nouvelle pré-réservation", message: `${leadName(lead)} — lot ${lot.ref}, valable ${validityDays} jours.`, link: "/pre-reservations", roles: ["admin"] });
  return preReservationView(pre);
}, { roles: roles("preReservations.write") });

route("POST", "/pre-reservations/:id/cancel", ({ params, user }) => {
  const pre = mustFind(db.preReservations, params.id, "Pré-réservation");
  if (pre.status !== "active") fail(409, "Seule une pré-réservation active peut être annulée.");
  pre.status = "annulee";
  const lot = byId(db.lots, pre.lotId);
  if (lot?.status === "pre_reserve") lot.status = "disponible";
  const lead = byId(db.leads, pre.leadId);
  if (lead?.stage === "pre_reserve") lead.stage = "negociation";
  log({ type: "pre_reservation", leadId: pre.leadId, userId: user.id, message: `Pré-réservation du lot ${lot?.ref ?? ""} annulée` });
  return preReservationView(pre);
}, { roles: roles("preReservations.write") });

route("POST", "/pre-reservations/:id/convert", ({ params, user }) => {
  const pre = mustFind(db.preReservations, params.id, "Pré-réservation");
  if (pre.status !== "active") fail(409, "Seule une pré-réservation active peut être convertie en dossier.");
  pre.status = "convertie";
  const dossier = { id: uid("DS"), preReservationId: pre.id, leadId: pre.leadId, lotId: pre.lotId, createdAt: now(), createdBy: user.id, documents: newDocuments() };
  db.dossiers.push(dossier);
  log({ type: "dossier", leadId: pre.leadId, userId: user.id, message: "Dossier de réservation ouvert" });
  return dossierView(dossier, { detailed: true });
}, { roles: roles("preReservations.write") });

/* ------------------------------------------------------------------ */
/* Dossiers                                                            */
/* ------------------------------------------------------------------ */

route("GET", "/dossiers", () =>
  [...db.dossiers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((dossier) => dossierView(dossier)),
{ roles: roles("dossiers") });

route("GET", "/dossiers/:id", ({ params }) =>
  dossierView(mustFind(db.dossiers, params.id, "Dossier"), { detailed: true }),
{ roles: roles("dossiers") });

const MAX_UPLOAD = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];

function findDocument(dossier, key) {
  return dossier.documents.find((doc) => doc.key === key) ?? fail(404, "Pièce introuvable dans ce dossier.");
}

function assertDossierEditable(dossier) {
  const reservation = db.reservations.find((item) => item.dossierId === dossier.id);
  if (reservation?.status === "confirmee") fail(409, "Le dossier d'une réservation confirmée ne peut plus être modifié.");
}

route("POST", "/dossiers/:id/documents/:key", ({ params, body, user }) => {
  const dossier = mustFind(db.dossiers, params.id, "Dossier");
  assertDossierEditable(dossier);
  const doc = findDocument(dossier, params.key);
  const file = typeof body.get === "function" ? body.get("file") : null;
  if (!file) fail(422, "Aucun fichier reçu.");
  if (file.size > MAX_UPLOAD) fail(422, "Le fichier dépasse la taille maximale de 10 Mo.");
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) fail(422, "Formats acceptés : PDF, JPG ou PNG.");
  Object.assign(doc, { status: "recu", fileName: file.name, fileSize: file.size, uploadedAt: now(), uploadedBy: user.id, validatedAt: null, validatedBy: null });
  log({ type: "dossier", leadId: dossier.leadId, userId: user.id, message: `Pièce reçue : ${doc.label}` });
  const state = dossierState(dossier);
  if (state.status === "complet" && state.received === state.required) {
    notify({ type: "info", title: "Dossier complet", message: `Toutes les pièces obligatoires du dossier de ${leadName(byId(db.leads, dossier.leadId))} ont été reçues.`, link: `/dossiers/${dossier.id}`, roles: ["admin", "comptable", "commercial"] });
  }
  return dossierView(dossier, { detailed: true });
}, { roles: roles("dossiers.upload") });

route("DELETE", "/dossiers/:id/documents/:key", ({ params, user }) => {
  const dossier = mustFind(db.dossiers, params.id, "Dossier");
  assertDossierEditable(dossier);
  const doc = findDocument(dossier, params.key);
  Object.assign(doc, { status: "manquant", fileName: null, fileSize: null, uploadedAt: null, uploadedBy: null, validatedAt: null, validatedBy: null });
  log({ type: "dossier", leadId: dossier.leadId, userId: user.id, message: `Pièce retirée : ${doc.label}` });
  return dossierView(dossier, { detailed: true });
}, { roles: roles("dossiers.upload") });

route("PATCH", "/dossiers/:id/documents/:key", ({ params, body, user }) => {
  const dossier = mustFind(db.dossiers, params.id, "Dossier");
  assertDossierEditable(dossier);
  const doc = findDocument(dossier, params.key);
  if (!["valide", "recu"].includes(body.status)) fail(422, "Statut de pièce invalide.");
  if (doc.status === "manquant") fail(409, "La pièce doit d'abord être téléversée.");
  doc.status = body.status;
  doc.validatedAt = body.status === "valide" ? now() : null;
  doc.validatedBy = body.status === "valide" ? user.id : null;
  log({ type: "dossier", leadId: dossier.leadId, userId: user.id, message: `${body.status === "valide" ? "Pièce validée" : "Validation retirée"} : ${doc.label}` });
  return dossierView(dossier, { detailed: true });
}, { roles: roles("dossiers.validate") });

/* ------------------------------------------------------------------ */
/* Reservations                                                        */
/* ------------------------------------------------------------------ */

route("GET", "/reservations", ({ query }) =>
  [...db.reservations]
    .filter((item) => !query.status || item.status === query.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => reservationView(item)),
{ roles: roles("reservations", "payments", "schedule") });

route("GET", "/reservations/:id", ({ params }) =>
  reservationView(mustFind(db.reservations, params.id, "Réservation"), { detailed: true }),
{ roles: roles("reservations") });

route("POST", "/reservations", ({ body, user }) => {
  const dossier = mustFind(db.dossiers, body.dossierId, "Dossier");
  if (db.reservations.some((item) => item.dossierId === dossier.id && item.status !== "annulee")) fail(409, "Une réservation existe déjà pour ce dossier.");
  const state = dossierState(dossier);
  if (state.received < state.required) fail(422, `Il manque ${state.required - state.received} pièce(s) obligatoire(s) au dossier.`);
  const lot = mustFind(db.lots, dossier.lotId, "Lot");
  const pre = byId(db.preReservations, dossier.preReservationId);
  db.counters.reservation += 1;
  const sequence = db.counters.reservation;
  const reservation = {
    id: uid("RS"),
    number: `RES-${new Date().getFullYear()}-${String(sequence).padStart(3, "0")}`,
    dossierId: dossier.id,
    leadId: dossier.leadId,
    lotId: lot.id,
    projectId: lot.projectId,
    price: lot.price,
    deposit: pre?.deposit ?? 0,
    status: "en_attente",
    createdAt: now(),
    createdBy: user.id,
    confirmedAt: null,
    confirmedBy: null,
    bulletinNumber: null,
    bulletinGeneratedAt: null,
  };
  db.reservations.push(reservation);
  log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Réservation ${reservation.number} créée` });
  return reservationView(reservation, { detailed: true });
}, { roles: roles("reservations.confirm") });

route("POST", "/reservations/:id/confirm", ({ params, user }) => {
  const reservation = mustFind(db.reservations, params.id, "Réservation");
  if (reservation.status !== "en_attente") fail(409, "Cette réservation n'est pas en attente de confirmation.");
  const lot = mustFind(db.lots, reservation.lotId, "Lot");
  if (lot.status !== "pre_reserve") fail(409, `Le lot ${lot.ref} n'est plus pré-réservé pour ce client.`);
  const project = mustFind(db.projects, reservation.projectId, "Projet");
  const pre = db.preReservations.find((item) => item.id === byId(db.dossiers, reservation.dossierId)?.preReservationId);

  reservation.status = "confirmee";
  reservation.confirmedAt = now();
  reservation.confirmedBy = user.id;
  lot.status = "reserve";
  const lead = byId(db.leads, reservation.leadId);
  if (lead) {
    log({ type: "stage", leadId: lead.id, userId: user.id, message: `Étape : ${STAGE_LABEL[lead.stage]} → Gagné` });
    lead.stage = "gagne";
  }

  db.installments.push(...buildSchedule({ reservationId: reservation.id, price: reservation.price, deposit: reservation.deposit, startAt: reservation.confirmedAt, deliveryDate: project.deliveryDate }));
  if (reservation.deposit > 0) {
    db.payments.push({
      id: uid("PAY"),
      reservationId: reservation.id,
      amount: reservation.deposit,
      method: "Virement",
      reference: `ACOMPTE-${pre?.id ?? reservation.number}`,
      date: pre?.createdAt ?? reservation.confirmedAt,
      status: "valide",
      note: "Acompte versé à la pré-réservation",
      createdBy: user.id,
      createdAt: reservation.confirmedAt,
      validatedBy: user.id,
      validatedAt: reservation.confirmedAt,
      comment: "",
    });
  }
  recomputeReservation(db, reservation.id);
  log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Réservation ${reservation.number} confirmée — échéancier généré` });
  notify({ type: "success", title: "Réservation confirmée", message: `${reservation.number} — ${leadName(lead)}, lot ${lot.ref}. Échéancier généré.`, link: `/reservations/${reservation.id}`, roles: null });
  return reservationView(reservation, { detailed: true });
}, { roles: roles("reservations.confirm") });

route("POST", "/reservations/:id/bulletin", ({ params, user }) => {
  const reservation = mustFind(db.reservations, params.id, "Réservation");
  if (reservation.status !== "confirmee") fail(409, "Le bulletin ne peut être généré que pour une réservation confirmée.");
  if (!reservation.bulletinNumber) {
    db.counters.bulletin += 1;
    reservation.bulletinNumber = `BR-${new Date().getFullYear()}-${String(db.counters.bulletin).padStart(4, "0")}`;
  }
  reservation.bulletinGeneratedAt = now();
  reservation.bulletinGeneratedBy = user.id;
  log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Bulletin ${reservation.bulletinNumber} généré` });
  return reservationView(reservation, { detailed: true });
}, { roles: roles("reservations.confirm") });

/* ------------------------------------------------------------------ */
/* Payments & schedules                                                */
/* ------------------------------------------------------------------ */

const PAYMENT_METHODS = ["Virement", "Chèque", "Versement bancaire", "Espèces"];

route("GET", "/payments", ({ query }) => {
  const q = (query.q ?? "").trim().toLowerCase();
  return db.payments
    .filter((payment) => !query.status || payment.status === query.status)
    .filter((payment) => !query.reservationId || payment.reservationId === query.reservationId)
    .map(paymentView)
    .filter((payment) => !q || `${payment.lead?.name} ${payment.reference} ${payment.reservation?.number} ${payment.lot?.ref}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
}, { roles: roles("payments") });

route("POST", "/payments", ({ body, user }) => {
  const reservation = mustFind(db.reservations, body.reservationId, "Réservation");
  if (reservation.status !== "confirmee") fail(409, "Les paiements ne peuvent être saisis que sur une réservation confirmée.");
  const amount = positiveNumber(body.amount, "Le montant doit être positif.");
  const { remaining, pending } = reservationTotals(reservation);
  if (amount > remaining - pending) fail(422, "Le montant dépasse le reste à payer (paiements en attente inclus).");
  if (!PAYMENT_METHODS.includes(body.method)) fail(422, "Mode de paiement invalide.");
  required(body.reference, "La référence du paiement est obligatoire.");
  required(body.date, "La date du paiement est obligatoire.");
  const payment = {
    id: uid("PAY"),
    reservationId: reservation.id,
    amount,
    method: body.method,
    reference: String(body.reference).trim(),
    date: new Date(body.date).toISOString(),
    status: "en_attente",
    note: String(body.note ?? "").trim(),
    createdBy: user.id,
    createdAt: now(),
    validatedBy: null,
    validatedAt: null,
    comment: "",
  };
  db.payments.push(payment);
  const lead = byId(db.leads, reservation.leadId);
  log({ type: "payment", leadId: reservation.leadId, userId: user.id, message: `Paiement de ${amount.toLocaleString("fr-FR")} MAD saisi (${payment.method})` });
  notify({ type: "info", title: "Paiement à valider", message: `${payment.method} de ${amount.toLocaleString("fr-FR")} MAD pour ${reservation.number} (${leadName(lead)}).`, link: "/paiements", roles: ["admin", "comptable"] });
  return paymentView(payment);
}, { roles: roles("payments.create") });

function decidePayment({ params, body, user }, status) {
  const payment = mustFind(db.payments, params.id, "Paiement");
  if (payment.status !== "en_attente") fail(409, "Ce paiement a déjà été traité.");
  if (status === "rejete") required(body.comment, "Indiquez le motif du rejet.");
  payment.status = status;
  payment.validatedBy = user.id;
  payment.validatedAt = now();
  payment.comment = String(body.comment ?? "").trim();
  recomputeReservation(db, payment.reservationId);
  const reservation = byId(db.reservations, payment.reservationId);
  log({ type: "payment", leadId: reservation?.leadId, userId: user.id, message: `Paiement de ${payment.amount.toLocaleString("fr-FR")} MAD ${status === "valide" ? "validé" : "rejeté"} par la comptabilité` });
  if (status === "rejete") {
    notify({ type: "danger", title: "Paiement rejeté", message: `${payment.reference} (${reservation?.number}) : ${payment.comment}`, link: "/paiements", roles: ["admin", "commercial"] });
  }
  return paymentView(payment);
}

route("POST", "/payments/:id/validate", (ctx) => decidePayment(ctx, "valide"), { roles: roles("payments.validate") });
route("POST", "/payments/:id/reject", (ctx) => decidePayment(ctx, "rejete"), { roles: roles("payments.validate") });

route("GET", "/schedules", ({ query }) =>
  db.installments
    .map(installmentView)
    .filter((item) => !query.status || item.status === query.status)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .map((item) => {
      const reservation = byId(db.reservations, item.reservationId);
      const lead = reservation && byId(db.leads, reservation.leadId);
      const lot = reservation && byId(db.lots, reservation.lotId);
      return { ...item, reservation: reservation ? { id: reservation.id, number: reservation.number } : null, leadName: leadName(lead), lotRef: lot?.ref };
    }),
{ roles: roles("schedule") });

route("GET", "/schedules/:reservationId", ({ params }) => {
  const reservation = mustFind(db.reservations, params.reservationId, "Réservation");
  const installments = db.installments
    .filter((item) => item.reservationId === reservation.id)
    .sort((a, b) => a.order - b.order)
    .map(installmentView);
  const next = installments.find((item) => item.status !== "paye");
  return { reservation: reservationView(reservation), installments, totals: reservationTotals(reservation), next: next ?? null };
}, { roles: roles("schedule") });

/* ------------------------------------------------------------------ */
/* Directory: promoters, project managers, users                       */
/* ------------------------------------------------------------------ */

const PROMOTER_FIELDS = ["name", "contactName", "email", "phone", "city", "ice", "address"];
const MANAGER_FIELDS = ["name", "email", "phone", "specialty"];

function directoryRoutes(base, collection, fields, label, readRoles, writeRoles, linkKey) {
  const withProjects = (item) => ({
    ...item,
    projects: db.projects.filter((project) => project[linkKey] === item.id).map((project) => ({ id: project.id, name: project.name })),
  });
  const validate = (data) => {
    required(data.name, "Le nom est obligatoire.");
    if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) fail(422, "L'adresse email est invalide.");
  };

  route("GET", base, () => db[collection].map(withProjects), { roles: readRoles });
  route("GET", `${base}/:id`, ({ params }) => withProjects(mustFind(db[collection], params.id, label)), { roles: readRoles });
  route("POST", base, ({ body }) => {
    validate(body);
    const item = { id: uid(collection.slice(0, 3).toUpperCase()), ...Object.fromEntries(fields.map((key) => [key, ""])), ...pickFields(body, fields) };
    db[collection].push(item);
    return withProjects(item);
  }, { roles: writeRoles });
  route("PATCH", `${base}/:id`, ({ params, body }) => {
    const item = mustFind(db[collection], params.id, label);
    const next = { ...item, ...pickFields(body, fields) };
    validate(next);
    Object.assign(item, next);
    return withProjects(item);
  }, { roles: writeRoles });
  route("DELETE", `${base}/:id`, ({ params }) => {
    const item = mustFind(db[collection], params.id, label);
    const linked = db.projects.filter((project) => project[linkKey] === item.id);
    if (linked.length) fail(409, `Impossible de supprimer : rattaché à ${linked.length} projet(s) (${linked.map((p) => p.name).join(", ")}).`);
    db[collection] = db[collection].filter((entry) => entry.id !== item.id);
    return null;
  }, { roles: writeRoles });
}

directoryRoutes("/promoters", "promoters", PROMOTER_FIELDS, "Promoteur", roles("promoters", "catalog.write"), roles("promoters.write"), "promoterId");
directoryRoutes("/project-managers", "managers", MANAGER_FIELDS, "Chef de projet", roles("managers", "catalog.write"), roles("managers.write"), "managerId");

route("GET", "/users", () => db.users, { roles: roles("users.manage") });

route("POST", "/users", ({ body }) => {
  required(body.name, "Le nom est obligatoire.");
  required(body.email, "L'email est obligatoire.");
  if (!/^\S+@\S+\.\S+$/.test(body.email)) fail(422, "L'adresse email est invalide.");
  const email = body.email.trim().toLowerCase();
  if (db.users.some((user) => user.email.toLowerCase() === email)) fail(409, "Un utilisateur utilise déjà cet email.");
  if (!AREAS.dashboard.includes(body.role)) fail(422, "Rôle invalide.");
  if (!body.password || String(body.password).length < 8) fail(422, "Le mot de passe provisoire doit contenir au moins 8 caractères.");
  const user = { id: uid("U"), name: body.name.trim(), email, role: body.role, phone: body.phone ?? "", active: true };
  db.users.push(user);
  db.credentials[email] = body.password;
  return user;
}, { roles: roles("users.manage") });

route("PATCH", "/users/:id", ({ params, body, user: actor }) => {
  const user = mustFind(db.users, params.id, "Utilisateur");
  if (body.role !== undefined && !AREAS.dashboard.includes(body.role)) fail(422, "Rôle invalide.");
  if (user.id === actor.id && (body.active === false || (body.role && body.role !== "admin"))) {
    fail(409, "Vous ne pouvez pas désactiver votre propre compte ni retirer vos droits d'administrateur.");
  }
  if (body.name !== undefined) required(body.name, "Le nom est obligatoire.");
  Object.assign(user, pickFields(body, ["name", "role", "phone", "active"]));
  if (user.active === false) {
    for (const [token, id] of Object.entries(db.sessions)) if (id === user.id) delete db.sessions[token];
  }
  return user;
}, { roles: roles("users.manage") });

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

route("GET", "/notifications", ({ query, user }) =>
  db.notifications
    .filter((notification) => notificationVisible(notification, user))
    .map((notification) => ({ ...notification, read: notification.readBy.includes(user.id) }))
    .filter((notification) => query.unread !== "true" || !notification.read)
    .sort((a, b) => b.at.localeCompare(a.at)),
);

route("GET", "/notifications/unread-count", ({ user }) => ({
  count: db.notifications.filter((notification) => notificationVisible(notification, user) && !notification.readBy.includes(user.id)).length,
}));

route("POST", "/notifications/read-all", ({ user }) => {
  db.notifications.forEach((notification) => {
    if (notificationVisible(notification, user) && !notification.readBy.includes(user.id)) notification.readBy.push(user.id);
  });
  return null;
});

route("POST", "/notifications/:id/read", ({ params, user }) => {
  const notification = mustFind(db.notifications, params.id, "Notification");
  if (!notification.readBy.includes(user.id)) notification.readBy.push(user.id);
  return { ...notification, read: true };
});

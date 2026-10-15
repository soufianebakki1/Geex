import { ApiError } from "../errors.js";
import { ACTIONS, AREAS } from "../../auth/permissions.js";
import {
  CLIENT_TYPE,
  CONTACT_CHANNEL,
  CONTACT_RESULT,
  DOSSIER_CLIENT_TYPE,
  ENGAGED_STAGES,
  FINANCING_MODE,
  FOLLOW_UP_OUTCOME,
  LEAD_STAGE,
  LEAD_STAGE_ORDER,
  LOT_TYPE,
  MANUAL_STAGES,
  BANK,
  BANK_METHODS,
  BANK_REQUIRED_METHODS,
  CURRENCY,
  PAYMENT_METHOD,
  PAYMENT_ORIGIN,
  PENDING_PAYMENT_STATUSES,
  PROJECT_TYPE,
  RESERVATION_END_STATUSES,
  RESERVATION_STATUS,
} from "../../utils/status.js";
import { createSeed } from "./seed.js";
import {
  DAY,
  HOUR,
  buildSchedule,
  dossierState,
  installmentStatus,
  newDocuments,
  recomputeReservation,
  setLotStatus,
  uid,
} from "./logic.js";

const STORAGE_KEY = "konouz.mock-db.v4";

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
const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
};
const isBlank = (value) => value === undefined || value === null || String(value).trim() === "";
const required = (value, message) => {
  if (isBlank(value)) fail(422, message);
};
const positiveNumber = (value, message) => {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) fail(422, message);
  return number;
};
const optionalNumber = (value, message) => {
  if (isBlank(value)) return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) fail(422, message);
  return number;
};
const optionalDate = (value) => (isBlank(value) ? null : new Date(value).toISOString());
const text = (value) => String(value ?? "").trim();
const formatMoney = (value) => `${Number(value).toLocaleString("fr-FR")} MAD`;
const roles = (...keys) => [...new Set(keys.flatMap((key) => AREAS[key] ?? ACTIONS[key] ?? []))];
const allowed = (user, key) => (ACTIONS[key] ?? []).includes(user.role);
const pickFields = (data, fields) => Object.fromEntries(fields.filter((key) => key in data).map((key) => [key, data[key]]));
const formData = (body) => (typeof body?.get === "function" ? Object.fromEntries(body.entries()) : body);

const MAX_UPLOAD = 10 * 1024 * 1024;
const ACCEPTED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
function checkFile(file) {
  if (file.size > MAX_UPLOAD) fail(422, "Le fichier dépasse la taille maximale de 10 Mo.");
  if (file.type && !ACCEPTED_TYPES.includes(file.type)) fail(422, "Formats acceptés : PDF, JPG ou PNG.");
}

const userSummary = (id) => {
  const user = byId(db.users, id);
  return user ? { id: user.id, name: user.name, role: user.role } : null;
};
const leadName = (lead) => lead?.fullName ?? "—";
const stageLabel = (stage) => LEAD_STAGE[stage]?.label ?? stage;
const cityOf = (address = "") => address.split(",").pop()?.trim() ?? "";

function log(activity) {
  db.activities.push({ id: uid("ACT"), at: now(), ...activity });
}

function notify(notification) {
  db.notifications.push({ id: uid("N"), at: now(), readBy: [], roles: null, userIds: null, ...notification });
}

const isCommercial = (user) => user.role === "commercial";
const ownsLead = (user, lead) => !isCommercial(user) || lead?.agentId === user.id;
const ownsLeadId = (user, leadId) => ownsLead(user, byId(db.leads, leadId));

function mustFindLead(user, id) {
  const lead = mustFind(db.leads, id, "Lead");
  if (!ownsLead(user, lead)) fail(404, "Lead introuvable.");
  return lead;
}

function assertOwns(user, leadId) {
  if (!ownsLeadId(user, leadId)) fail(403, "Ce client est suivi par un autre commercial.");
}

function moveLead(lead, stage, userId, suffix = "") {
  if (!lead || lead.stage === stage) return;
  log({ type: "stage", leadId: lead.id, userId, message: `Étape : ${stageLabel(lead.stage)} → ${stageLabel(stage)}${suffix}` });
  lead.stage = stage;
}

function changeLot(lot, status, userId, reason) {
  setLotStatus(db, lot, status, { userId, reason });
}

const nextNumber = (counter, prefix, size) => {
  db.counters[counter] = (db.counters[counter] ?? 0) + 1;
  return `${prefix}-${new Date().getFullYear()}-${String(db.counters[counter]).padStart(size, "0")}`;
};

function expirePreReservations() {
  const current = Date.now();
  for (const pre of db.preReservations) {
    if (pre.status !== "active" || new Date(pre.expiresAt).getTime() > current) continue;
    pre.status = "expiree";
    const lot = byId(db.lots, pre.lotId);
    if (lot?.status === "pre_reserve") changeLot(lot, "disponible", null, `Pré-réservation ${pre.number} expirée`);
    const lead = byId(db.leads, pre.leadId);
    if (lead?.stage === "pre_reserve") moveLead(lead, "en_negociation", null, " (pré-réservation expirée)");
    log({ type: "pre_reservation", leadId: pre.leadId, userId: null, message: `Pré-réservation ${pre.number} du lot ${lot?.ref ?? ""} expirée — lot remis en vente` });
    notify({ type: "danger", title: "Pré-réservation expirée", message: `${leadName(lead)} — lot ${lot?.ref ?? ""} est de nouveau disponible.`, link: "/pre-reservations", roles: ["admin"], userIds: lead?.agentId ? [lead.agentId] : null });
  }
}

/* ------------------------------------------------------------------ */
/* Views                                                               */
/* ------------------------------------------------------------------ */

function projectRef(id) {
  const project = byId(db.projects, id);
  return project ? { id: project.id, name: project.name, address: project.address, city: cityOf(project.address) } : null;
}

function sourceRef(id) {
  const source = byId(db.sources, id);
  return source ? { id: source.id, name: source.name, category: source.category } : null;
}

function nextFollowUp(lead) {
  if (lead.followUp1Date && !lead.followUp1Outcome) return { slot: 1, date: lead.followUp1Date };
  if (lead.followUp2Date && !lead.followUp2Outcome) return { slot: 2, date: lead.followUp2Date };
  return null;
}

function leadView(lead) {
  return { ...lead, project: projectRef(lead.projectId), agent: userSummary(lead.agentId), source: sourceRef(lead.sourceId), nextFollowUp: nextFollowUp(lead) };
}

function lotHolder(lot) {
  if (lot.status === "pre_reserve") {
    const pre = db.preReservations.find((item) => item.lotId === lot.id && ["active", "convertie"].includes(item.status));
    const lead = pre && byId(db.leads, pre.leadId);
    if (lead) return { leadId: lead.id, name: leadName(lead), preReservationId: pre.id };
  }
  if (lot.status === "reserve" || lot.status === "vendu") {
    const reservation = db.reservations.find((item) => item.lotId === lot.id && ["active", "cloturee"].includes(item.status));
    const lead = reservation && byId(db.leads, reservation.leadId);
    if (lead) return { leadId: lead.id, name: leadName(lead), reservationId: reservation.id };
  }
  return null;
}

function lotLocation(lot) {
  const tranche = byId(db.tranches, lot.trancheId);
  const building = byId(db.buildings, lot.buildingId);
  return { tranche: tranche ? { id: tranche.id, name: tranche.name } : null, building: building ? { id: building.id, name: building.name } : null };
}

function lotView(lot) {
  return { ...lot, ...lotLocation(lot), project: projectRef(lot.projectId), holder: lotHolder(lot) };
}

function lotRef(lot) {
  if (!lot) return null;
  return { id: lot.id, ref: lot.ref, type: lot.type, surface: lot.surface, price: lot.price, floor: lot.floor, parking: lot.parking, ...lotLocation(lot), project: projectRef(lot.projectId) };
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

function promoterRef(id) {
  const promoter = byId(db.promoters, id);
  return promoter ? { id: promoter.id, name: promoter.company, company: promoter.company, group: promoter.group } : null;
}

function managerRef(id) {
  const manager = byId(db.users, id);
  return manager ? { id: manager.id, name: manager.name, phone: manager.phone, email: manager.email } : null;
}

function projectView(project, { detailed = false } = {}) {
  const view = {
    ...project,
    city: cityOf(project.address),
    promoter: promoterRef(project.promoterId),
    manager: managerRef(project.managerId),
    stock: stockOf(project.id),
    trancheCount: db.tranches.filter((tranche) => tranche.projectId === project.id).length,
  };
  if (detailed) {
    view.tranches = db.tranches
      .filter((tranche) => tranche.projectId === project.id)
      .map((tranche) => ({
        ...tranche,
        lotCount: db.lots.filter((lot) => lot.trancheId === tranche.id).length,
        buildings: db.buildings
          .filter((building) => building.trancheId === tranche.id)
          .map((building) => ({ ...building, lotCount: db.lots.filter((lot) => lot.buildingId === building.id).length })),
      }));
  }
  return view;
}

function preReservationView(pre) {
  const lot = byId(db.lots, pre.lotId);
  const lead = byId(db.leads, pre.leadId);
  const dossier = db.dossiers.find((item) => item.preReservationId === pre.id);
  return {
    ...pre,
    lead: lead ? { id: lead.id, name: leadName(lead), phone: lead.phone, clientType: lead.clientType } : null,
    lot: lotRef(lot),
    agent: userSummary(pre.agentId),
    createdByUser: userSummary(pre.createdBy),
    cancelledByUser: userSummary(pre.cancelledBy),
    extendedByUser: userSummary(pre.extendedBy),
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
    clientType: dossier.clientType,
    createdAt: dossier.createdAt,
    validatedAt: dossier.validatedAt ?? null,
    agent: userSummary(dossier.agentId),
    lead: lead ? { id: lead.id, name: leadName(lead), phone: lead.phone, email: lead.email } : null,
    lot: lotRef(lot),
    deposit: pre?.deposit ?? 0,
    preReservationId: dossier.preReservationId,
    preReservationNumber: pre?.number ?? null,
    reservation: reservation ? { id: reservation.id, number: reservation.number, status: reservation.status } : null,
    state: dossierState(dossier),
    rejectReason: dossier.rejectReason ?? null,
    rejectedAt: dossier.rejectedAt ?? null,
    rejectedByUser: userSummary(dossier.rejectedBy),
  };
  if (detailed) {
    view.documents = dossier.documents.map((doc) => ({
      ...doc,
      uploadedByUser: userSummary(doc.uploadedBy),
      validatedByUser: userSummary(doc.validatedBy),
      history: (doc.history ?? []).map((entry) => ({ ...entry, user: userSummary(entry.userId) })),
    }));
  }
  return view;
}

function pendingInstallmentIds(reservationId) {
  return db.payments.filter((payment) => payment.reservationId === reservationId && PENDING_PAYMENT_STATUSES.includes(payment.status) && payment.installmentId).map((payment) => payment.installmentId);
}

function installmentView(item) {
  const status = installmentStatus(item, { pendingIds: pendingInstallmentIds(item.reservationId) });
  return { ...item, balance: item.cancelled ? 0 : Math.max(item.amount - item.paidAmount, 0), status };
}

function reservationTotals(reservation) {
  const schedule = db.installments.filter((item) => item.reservationId === reservation.id).map(installmentView);
  const ofReservation = db.payments.filter((payment) => payment.reservationId === reservation.id);
  const validated = sum(ofReservation.filter((payment) => payment.status === "valide"), (payment) => payment.amount);
  const pending = sum(ofReservation.filter((payment) => PENDING_PAYMENT_STATUSES.includes(payment.status)), (payment) => payment.amount);
  const overdue = sum(schedule.filter((item) => item.status === "en_retard"), (item) => item.balance);
  return { price: reservation.price, paid: validated, pending, remaining: Math.max(reservation.price - validated, 0), overdue };
}

function reservationView(reservation, { detailed = false } = {}) {
  const lead = byId(db.leads, reservation.leadId);
  const lot = byId(db.lots, reservation.lotId);
  const view = {
    ...reservation,
    lead: lead ? { id: lead.id, name: leadName(lead), phone: lead.phone, email: lead.email, address: lead.address, clientType: lead.clientType } : null,
    lot: lot ? { ...lotRef(lot), status: lot.status } : null,
    project: projectRef(reservation.projectId),
    agent: userSummary(reservation.agentId),
    totals: reservationTotals(reservation),
    discountPending: reservation.discount > 0 && !reservation.approvedBy,
    createdByUser: userSummary(reservation.createdBy),
    signedByUser: userSummary(reservation.signedBy),
    approvedByUser: userSummary(reservation.approvedBy),
    endedByUser: userSummary(reservation.endedBy),
  };
  if (detailed) {
    const project = byId(db.projects, reservation.projectId);
    const promoter = project && byId(db.promoters, project.promoterId);
    view.project = project
      ? { ...projectRef(project.id), deliveryDate: project.deliveryDate, tfMere: project.tfMere, promoter: promoter ? { name: promoter.company, group: promoter.group, address: promoter.headOffice, ice: promoter.ice, rc: promoter.rc, ifNumber: promoter.ifNumber } : null }
      : null;
    view.installments = db.installments
      .filter((item) => item.reservationId === reservation.id)
      .sort((a, b) => a.order - b.order)
      .map(installmentView);
    view.payments = db.payments
      .filter((payment) => payment.reservationId === reservation.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .map(paymentView);
    const dossier = byId(db.dossiers, reservation.dossierId);
    view.dossier = dossier ? { id: dossier.id, clientType: dossier.clientType, state: dossierState(dossier) } : null;
  }
  return view;
}

function paymentView(payment) {
  const reservation = byId(db.reservations, payment.reservationId);
  const lead = reservation && byId(db.leads, reservation.leadId);
  const lot = reservation && byId(db.lots, reservation.lotId);
  const installment = byId(db.installments, payment.installmentId);
  return {
    ...payment,
    reservation: reservation ? { id: reservation.id, number: reservation.number } : null,
    installment: installment ? { id: installment.id, order: installment.order, label: installment.label } : null,
    lead: lead ? { id: lead.id, name: leadName(lead) } : null,
    lot: lot ? { id: lot.id, ref: lot.ref, project: projectRef(lot.projectId) } : null,
    createdByUser: userSummary(payment.createdBy),
    validatedByUser: userSummary(payment.validatedBy),
  };
}

function notificationVisible(notification, user) {
  const { roles: targetRoles, userIds } = notification;
  if (!targetRoles && !userIds) return true;
  return Boolean(targetRoles?.includes(user.role) || userIds?.includes(user.id));
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

const FUNNEL_STAGES = LEAD_STAGE_ORDER.filter((stage) => stage !== "annule");

route("GET", "/dashboard", ({ user }) => {
  const monthStart = startOfMonth();
  const current = Date.now();
  const leads = db.leads.filter((lead) => ownsLead(user, lead));
  const activeLeads = leads.filter((lead) => !["cloture", "annule"].includes(lead.stage));
  const activePre = db.preReservations.filter((pre) => pre.status === "active" && ownsLeadId(user, pre.leadId));
  const signedThisMonth = db.reservations.filter((item) => item.signedAt && item.signedAt >= monthStart && ownsLeadId(user, item.leadId));
  const collectedThisMonth = db.payments.filter((payment) => payment.status === "valide" && payment.validatedAt && payment.validatedAt >= monthStart);
  const pendingPayments = db.payments.filter((payment) => PENDING_PAYMENT_STATUSES.includes(payment.status));
  const overdue = db.installments.map(installmentView).filter((item) => item.status === "en_retard");
  const todayEnd = endOfToday();

  const funnel = FUNNEL_STAGES.map((stage, index) => ({
    stage,
    label: stageLabel(stage),
    count: leads.filter((lead) => lead.stage !== "annule" && FUNNEL_STAGES.indexOf(lead.stage) >= index).length,
    current: leads.filter((lead) => lead.stage === stage).length,
  }));

  const followUps = leads
    .filter((lead) => !["annule", "cloture"].includes(lead.stage))
    .map((lead) => ({ lead, next: nextFollowUp(lead) }))
    .filter(({ next }) => next && next.date <= todayEnd)
    .sort((a, b) => a.next.date.localeCompare(b.next.date))
    .map(({ lead, next }) => ({ leadId: lead.id, name: leadName(lead), phone: lead.phone, stage: lead.stage, slot: next.slot, date: next.date, agent: userSummary(lead.agentId) }));

  const upcoming = db.installments
    .map(installmentView)
    .filter((item) => ownsLeadId(user, byId(db.reservations, item.reservationId)?.leadId))
    .filter((item) => ["en_retard", "a_venir", "partiellement_payee", "en_attente"].includes(item.status))
    .filter((item) => item.status === "en_retard" || new Date(item.dueDate).getTime() - current < 45 * DAY)
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
    .slice(0, 6)
    .map((item) => {
      const reservation = byId(db.reservations, item.reservationId);
      const lead = byId(db.leads, reservation.leadId);
      const lot = byId(db.lots, reservation.lotId);
      return { ...item, reservation: { id: reservation.id, number: reservation.number }, leadName: leadName(lead), lotRef: lot?.ref };
    });

  return {
    kpis: {
      activeLeads: activeLeads.length,
      newLeadsThisMonth: leads.filter((lead) => lead.createdAt >= monthStart).length,
      unassignedLeads: leads.filter((lead) => !lead.agentId).length,
      followUpsDue: followUps.length,
      activePreReservations: activePre.length,
      expiringSoon: activePre.filter((pre) => new Date(pre.expiresAt).getTime() - current < 48 * HOUR).length,
      reservationsThisMonth: signedThisMonth.length,
      reservationsValueThisMonth: sum(signedThisMonth, (item) => item.price),
      discountsToApprove: db.reservations.filter((item) => item.status === "en_attente" && item.discount > 0 && !item.approvedBy).length,
      collectedThisMonth: sum(collectedThisMonth, (payment) => payment.amount),
      pendingPaymentsCount: pendingPayments.length,
      pendingPaymentsAmount: sum(pendingPayments, (payment) => payment.amount),
      overdueAmount: sum(overdue, (item) => item.balance),
      overdueCount: overdue.length,
      lostLeads: leads.filter((lead) => lead.stage === "annule").length,
    },
    funnel,
    followUps: followUps.slice(0, 6),
    expiring: activePre
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt))
      .slice(0, 4)
      .map(preReservationView),
    upcoming,
    activity: [...db.activities]
      .filter((activity) => !activity.leadId || ownsLeadId(user, activity.leadId))
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 10)
      .map((activity) => {
        const lead = activity.leadId && byId(db.leads, activity.leadId);
        return { ...activity, user: userSummary(activity.userId), lead: lead ? { id: lead.id, name: leadName(lead) } : null };
      }),
    stock: db.projects.filter((project) => project.active).map((project) => ({ id: project.id, name: project.name, city: cityOf(project.address), type: project.type, stock: stockOf(project.id) })),
  };
});

/* ------------------------------------------------------------------ */
/* Marketing sources                                                   */
/* ------------------------------------------------------------------ */

route("GET", "/sources", () =>
  db.sources.map((source) => ({ ...source, leadCount: db.leads.filter((lead) => lead.sourceId === source.id).length })),
);

function validateSource(data) {
  required(data.category, "La catégorie est obligatoire.");
  required(data.name, "Le nom de la source est obligatoire.");
  const duplicate = db.sources.find((source) => source.id !== data.id && source.name.toLowerCase() === text(data.name).toLowerCase() && source.category.toLowerCase() === text(data.category).toLowerCase());
  if (duplicate) fail(409, "Cette source existe déjà dans cette catégorie.");
}

route("POST", "/sources", ({ body }) => {
  validateSource(body);
  const source = { id: uid("SRC"), category: text(body.category), name: text(body.name) };
  db.sources.push(source);
  return source;
}, { roles: roles("sources.write") });

route("PATCH", "/sources/:id", ({ params, body }) => {
  const source = mustFind(db.sources, params.id, "Source");
  const next = { ...source, ...pickFields(body, ["category", "name"]) };
  validateSource(next);
  Object.assign(source, { category: text(next.category), name: text(next.name) });
  return source;
}, { roles: roles("sources.write") });

route("DELETE", "/sources/:id", ({ params }) => {
  const source = mustFind(db.sources, params.id, "Source");
  const used = db.leads.filter((lead) => lead.sourceId === source.id).length;
  if (used) fail(409, `Impossible de supprimer : ${used} lead(s) proviennent de cette source.`);
  db.sources = db.sources.filter((item) => item.id !== source.id);
  return null;
}, { roles: roles("sources.write") });

/* ------------------------------------------------------------------ */
/* Leads                                                               */
/* ------------------------------------------------------------------ */

route("GET", "/leads", ({ query, user }) => {
  const q = (query.q ?? "").trim().toLowerCase();
  const todayEnd = endOfToday();
  return db.leads
    .filter((lead) => ownsLead(user, lead))
    .filter((lead) => !query.stage || lead.stage === query.stage)
    .filter((lead) => !query.projectId || lead.projectId === query.projectId)
    .filter((lead) => !query.sourceId || lead.sourceId === query.sourceId)
    .filter((lead) => !query.agentId || (query.agentId === "none" ? !lead.agentId : lead.agentId === query.agentId))
    .filter((lead) => query.followUp !== "due" || (nextFollowUp(lead)?.date ?? "9999") <= todayEnd)
    .filter((lead) => !q || `${leadName(lead)} ${lead.phone} ${lead.email}`.toLowerCase().includes(q))
    .sort((a, b) => (b.lastActivityAt ?? b.createdAt).localeCompare(a.lastActivityAt ?? a.createdAt))
    .map(leadView);
}, { roles: roles("leads") });

const LEAD_FIELDS = [
  "fullName", "phone", "email", "address", "sourceId", "projectId", "agentId", "clientType", "propertyType",
  "budgetMin", "budgetMax", "desiredCity", "surfaceMin", "surfaceMax", "financing", "purchaseDelay", "motivation",
  "followUp1Date", "followUp1Outcome", "followUp2Date", "followUp2Outcome", "remark",
];
const NUMBER_FIELDS = { budgetMin: "Le budget minimum est invalide.", budgetMax: "Le budget maximum est invalide.", surfaceMin: "La surface minimum est invalide.", surfaceMax: "La surface maximum est invalide." };

function normalizeLead(next) {
  for (const [key, message] of Object.entries(NUMBER_FIELDS)) next[key] = optionalNumber(next[key], message);
  for (const key of ["fullName", "phone", "email", "address", "propertyType", "desiredCity", "purchaseDelay", "motivation", "remark"]) next[key] = text(next[key]);
  next.agentId = next.agentId || null;
  next.financing = next.financing || null;
  next.followUp1Date = optionalDate(next.followUp1Date);
  next.followUp2Date = optionalDate(next.followUp2Date);
  next.followUp1Outcome = next.followUp1Outcome || null;
  next.followUp2Outcome = next.followUp2Outcome || null;
  return next;
}

function validateLead(data) {
  required(data.fullName, "Le nom et prénom sont obligatoires.");
  required(data.phone, "Le téléphone est obligatoire.");
  required(data.address, "L'adresse est obligatoire.");
  required(data.sourceId, "La source du lead est obligatoire.");
  required(data.projectId, "Le projet concerné est obligatoire.");
  if (data.email && !/^\S+@\S+\.\S+$/.test(data.email)) fail(422, "L'adresse email est invalide.");
  if (!byId(db.sources, data.sourceId)) fail(422, "Source inconnue.");
  if (!byId(db.projects, data.projectId)) fail(422, "Projet inconnu.");
  if (!CLIENT_TYPE[data.clientType]) fail(422, "Type de client invalide.");
  if (data.financing && !FINANCING_MODE[data.financing]) fail(422, "Mode de financement invalide.");
  if (data.budgetMin != null && data.budgetMax != null && data.budgetMin > data.budgetMax) fail(422, "Le budget minimum dépasse le budget maximum.");
  if (data.surfaceMin != null && data.surfaceMax != null && data.surfaceMin > data.surfaceMax) fail(422, "La surface minimum dépasse la surface maximum.");
  for (const slot of [1, 2]) {
    const outcome = data[`followUp${slot}Outcome`];
    if (outcome && !FOLLOW_UP_OUTCOME[outcome]) fail(422, `Sort de la relance ${slot} invalide.`);
    if (outcome && !data[`followUp${slot}Date`]) fail(422, `Indiquez la date de la relance ${slot}.`);
  }
  if (data.followUp2Date && !data.followUp1Date) fail(422, "Renseignez la 1re relance avant la 2e.");
  if (data.agentId) {
    const agent = byId(db.users, data.agentId);
    if (!agent || !agent.active || !["admin", "commercial"].includes(agent.role)) fail(422, "Le commercial affecté est invalide.");
  }
}

function notifyAssignment(lead, actor) {
  if (!lead.agentId || lead.agentId === actor.id) return;
  notify({ type: "info", title: "Nouveau lead affecté", message: `${leadName(lead)} vous a été affecté par ${actor.name}.`, link: `/leads/${lead.id}`, userIds: [lead.agentId] });
}

route("POST", "/leads", ({ body, user }) => {
  const lead = normalizeLead({
    id: uid("L"),
    ...Object.fromEntries(LEAD_FIELDS.map((key) => [key, null])),
    ...pickFields(body, LEAD_FIELDS),
    clientType: body.clientType || "particulier",
    agentId: isCommercial(user) ? user.id : body.agentId || null,
    stage: "nouveau",
    assignedAt: null,
    lastActivityAt: null,
    cancelReason: null,
    createdAt: now(),
  });
  lead.followUp1Outcome = null;
  lead.followUp2Outcome = null;
  validateLead(lead);
  if (lead.agentId) {
    lead.stage = "affecte";
    lead.assignedAt = lead.createdAt;
  }
  db.leads.push(lead);
  log({ type: "lead_created", leadId: lead.id, userId: user.id, message: `Lead créé (source : ${sourceRef(lead.sourceId)?.name})` });
  if (lead.agentId) log({ type: "assignment", leadId: lead.id, userId: user.id, message: `Lead affecté à ${userSummary(lead.agentId)?.name}` });
  else notify({ type: "info", title: "Nouveau lead à affecter", message: `${leadName(lead)} attend d'être affecté à un commercial.`, link: `/leads/${lead.id}`, roles: ["admin"] });
  notifyAssignment(lead, user);
  return leadView(lead);
}, { roles: roles("leads.write") });

route("GET", "/leads/:id", ({ params, user }) => {
  const lead = mustFindLead(user, params.id);
  const preReservations = db.preReservations
    .filter((pre) => pre.leadId === lead.id)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(preReservationView);
  const reservation = db.reservations.filter((item) => item.leadId === lead.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
  return { ...leadView(lead), preReservations, reservation: reservation ? reservationView(reservation) : null };
}, { roles: roles("leads") });

function applyStageChange(lead, next, body, user) {
  const target = body.stage;
  if (!target || target === lead.stage) return;
  if (!LEAD_STAGE[target]) fail(422, "Étape inconnue.");
  if (ENGAGED_STAGES.includes(target)) fail(409, "Cette étape suit automatiquement la pré-réservation, la réservation et les paiements.");
  if (ENGAGED_STAGES.includes(lead.stage) && target !== "livre") fail(409, "Ce lead est engagé dans une réservation : son étape suit le dossier.");

  if (target === "livre" || target === "cloture") {
    if (!allowed(user, "leads.close")) fail(403, "Seul un administrateur peut passer un lead à cette étape.");
    if (target === "livre" && !["signe", "en_paiement"].includes(lead.stage)) fail(409, "Seul un lead signé ou en paiement peut être marqué comme livré.");
    if (target === "cloture" && lead.stage !== "livre") fail(409, "Un lead doit être livré avant d'être clôturé.");
  } else if (target === "annule") {
    required(body.cancelReason, "Indiquez le motif d'annulation du lead.");
    next.cancelReason = text(body.cancelReason);
  } else if (MANUAL_STAGES.includes(target)) {
    if (["livre", "cloture"].includes(lead.stage)) fail(409, "Ce lead est livré ou clôturé.");
    if (target === "nouveau" && next.agentId) fail(409, "Un lead affecté ne peut pas revenir à « Nouveau ».");
    if (target !== "nouveau" && !next.agentId) fail(409, "Affectez d'abord ce lead à un commercial.");
    if (lead.stage === "annule") next.cancelReason = null;
  }
  const suffix = target === "annule" ? ` — motif : ${next.cancelReason}` : "";
  log({ type: "stage", leadId: lead.id, userId: user.id, message: `Étape : ${stageLabel(lead.stage)} → ${stageLabel(target)}${suffix}` });
  next.stage = target;
}

route("PATCH", "/leads/:id", ({ params, body, user }) => {
  const lead = mustFindLead(user, params.id);
  const next = normalizeLead({ ...lead, ...pickFields(body, LEAD_FIELDS) });
  if (!allowed(user, "leads.assign")) next.agentId = lead.agentId;
  validateLead(next);

  const reassigned = next.agentId !== lead.agentId;
  if (reassigned) {
    if (!next.agentId) fail(422, "Un lead ne peut pas être désaffecté.");
    next.assignedAt = now();
    log({ type: "assignment", leadId: lead.id, userId: user.id, message: lead.agentId ? `Lead réaffecté : ${userSummary(lead.agentId)?.name} → ${userSummary(next.agentId)?.name}` : `Lead affecté à ${userSummary(next.agentId)?.name}` });
    if (lead.stage === "nouveau" && !body.stage) {
      log({ type: "stage", leadId: lead.id, userId: user.id, message: "Étape : Nouveau → Affecté" });
      next.stage = "affecte";
    }
  }

  for (const slot of [1, 2]) {
    const key = `followUp${slot}Outcome`;
    if (next[key] !== lead[key] && next[key]) {
      log({ type: "follow_up", leadId: lead.id, userId: user.id, message: `Relance ${slot} : ${FOLLOW_UP_OUTCOME[next[key]].label}` });
      next.lastActivityAt = now();
      if (next[key] === "annulation" && lead.stage !== "annule" && !body.stage) body = { ...body, stage: "annule" };
    } else if (next[`followUp${slot}Date`] !== lead[`followUp${slot}Date`] && next[`followUp${slot}Date`] && !next[key]) {
      log({ type: "follow_up", leadId: lead.id, userId: user.id, message: `Relance ${slot} planifiée` });
    }
  }

  applyStageChange(lead, next, body, user);
  Object.assign(lead, next);
  if (reassigned) notifyAssignment(lead, user);
  return leadView(lead);
}, { roles: roles("leads.write") });

route("GET", "/leads/:id/contacts", ({ params, user }) => {
  mustFindLead(user, params.id);
  return db.contacts
    .filter((contact) => contact.leadId === params.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((contact) => ({ ...contact, user: userSummary(contact.userId) }));
}, { roles: roles("leads") });

route("POST", "/leads/:id/contacts", ({ params, body, user }) => {
  const lead = mustFindLead(user, params.id);
  if (!CONTACT_CHANNEL[body.channel]) fail(422, "Canal de contact inconnu.");
  if (!CONTACT_RESULT[body.result]) fail(422, "Indiquez le résultat de l'interaction.");
  const durationMinutes = optionalNumber(body.durationMinutes, "La durée est invalide.");
  const at = body.at ? new Date(body.at).toISOString() : now();
  if (new Date(at).getTime() > Date.now() + 5 * 60_000) fail(422, "Une interaction ne peut pas être datée dans le futur.");
  const contact = { id: uid("CT"), leadId: lead.id, userId: user.id, channel: body.channel, at, durationMinutes, result: body.result, notes: text(body.notes), createdAt: now() };
  db.contacts.push(contact);
  if (!lead.lastActivityAt || at > lead.lastActivityAt) lead.lastActivityAt = at;
  log({ type: "contact", leadId: lead.id, userId: user.id, message: `Interaction enregistrée : ${CONTACT_CHANNEL[body.channel].label} — ${CONTACT_RESULT[body.result].label}` });
  if (["nouveau", "affecte"].includes(lead.stage) && lead.agentId) moveLead(lead, "contacte", user.id);
  return { ...contact, user: userSummary(user.id) };
}, { roles: roles("leads.write") });

route("GET", "/leads/:id/activities", ({ params, user }) => {
  mustFindLead(user, params.id);
  return db.activities
    .filter((activity) => activity.leadId === params.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((activity) => ({ ...activity, user: userSummary(activity.userId) }));
}, { roles: roles("leads") });

/* ------------------------------------------------------------------ */
/* Projects, tranches, buildings, lots                                 */
/* ------------------------------------------------------------------ */

const PROJECT_FIELDS = ["name", "type", "promoterId", "managerId", "address", "consistance", "tfMere", "deliveryDate", "active"];

function validateProject(data) {
  required(data.name, "Le nom du projet est obligatoire.");
  if (!PROJECT_TYPE[data.type]) fail(422, "Sélectionnez le type de projet.");
  if (!byId(db.promoters, data.promoterId)) fail(422, "Sélectionnez un promoteur.");
  const manager = byId(db.users, data.managerId);
  if (!manager || manager.role !== "chef_projet" || !manager.active) fail(422, "Sélectionnez un chef de projet.");
  required(data.address, "L'adresse du projet est obligatoire.");
  if (!Array.isArray(data.consistance) || !data.consistance.length) fail(422, "Indiquez la consistance du projet.");
  if (data.consistance.some((item) => !LOT_TYPE[item])) fail(422, "Consistance invalide.");
  required(data.deliveryDate, "La date prévue de livraison est obligatoire.");
}

const projectNameTaken = (name, id) => db.projects.some((project) => project.id !== id && project.name.toLowerCase() === text(name).toLowerCase());

route("GET", "/projects", () => db.projects.map((project) => projectView(project)));

route("GET", "/projects/:id", ({ params }) => projectView(mustFind(db.projects, params.id, "Projet"), { detailed: true }));

route("POST", "/projects", ({ body }) => {
  const project = { id: uid("PJ"), active: true, tfMere: "", consistance: [], ...pickFields(body, PROJECT_FIELDS), createdAt: now() };
  validateProject(project);
  if (projectNameTaken(project.name)) fail(409, "Un projet porte déjà ce nom.");
  Object.assign(project, { name: text(project.name), address: text(project.address), tfMere: text(project.tfMere), active: project.active !== false, deliveryDate: new Date(project.deliveryDate).toISOString() });
  db.projects.push(project);
  return projectView(project, { detailed: true });
}, { roles: roles("catalog.write") });

route("PATCH", "/projects/:id", ({ params, body }) => {
  const project = mustFind(db.projects, params.id, "Projet");
  const next = { ...project, ...pickFields(body, PROJECT_FIELDS) };
  validateProject(next);
  if (projectNameTaken(next.name, project.id)) fail(409, "Un projet porte déjà ce nom.");
  Object.assign(project, { ...next, name: text(next.name), address: text(next.address), tfMere: text(next.tfMere), active: next.active !== false, deliveryDate: new Date(next.deliveryDate).toISOString() });
  return projectView(project, { detailed: true });
}, { roles: roles("catalog.write") });

route("POST", "/projects/:id/tranches", ({ params, body }) => {
  const project = mustFind(db.projects, params.id, "Projet");
  required(body.name, "Le nom de la tranche est obligatoire.");
  if (db.tranches.some((tranche) => tranche.projectId === project.id && tranche.name.toLowerCase() === text(body.name).toLowerCase())) fail(409, "Cette tranche existe déjà.");
  const tranche = { id: uid("TR"), projectId: project.id, name: text(body.name), description: text(body.description) };
  db.tranches.push(tranche);
  return projectView(project, { detailed: true });
}, { roles: roles("catalog.write") });

route("PATCH", "/tranches/:id", ({ params, body }) => {
  const tranche = mustFind(db.tranches, params.id, "Tranche");
  if (body.name !== undefined) required(body.name, "Le nom de la tranche est obligatoire.");
  Object.assign(tranche, { name: text(body.name ?? tranche.name), description: text(body.description ?? tranche.description) });
  return projectView(byId(db.projects, tranche.projectId), { detailed: true });
}, { roles: roles("catalog.write") });

route("DELETE", "/tranches/:id", ({ params }) => {
  const tranche = mustFind(db.tranches, params.id, "Tranche");
  const lots = db.lots.filter((lot) => lot.trancheId === tranche.id).length;
  if (lots) fail(409, `Impossible de supprimer : ${lots} lot(s) appartiennent à cette tranche.`);
  db.buildings = db.buildings.filter((building) => building.trancheId !== tranche.id);
  db.tranches = db.tranches.filter((item) => item.id !== tranche.id);
  return projectView(byId(db.projects, tranche.projectId), { detailed: true });
}, { roles: roles("catalog.write") });

function validateBuilding(data) {
  required(data.name, "Le nom de l'immeuble est obligatoire.");
  const floors = Number(data.floors);
  if (!Number.isInteger(floors) || floors < 0 || floors > 60) fail(422, "Le nombre d'étages est invalide.");
  return floors;
}

route("POST", "/tranches/:id/buildings", ({ params, body }) => {
  const tranche = mustFind(db.tranches, params.id, "Tranche");
  const floors = validateBuilding(body);
  db.buildings.push({ id: uid("IM"), trancheId: tranche.id, name: text(body.name), floors });
  return projectView(byId(db.projects, tranche.projectId), { detailed: true });
}, { roles: roles("catalog.write") });

route("PATCH", "/buildings/:id", ({ params, body }) => {
  const building = mustFind(db.buildings, params.id, "Immeuble");
  const floors = validateBuilding({ ...building, ...pickFields(body, ["name", "floors"]) });
  const highest = Math.max(-1, ...db.lots.filter((lot) => lot.buildingId === building.id).map((lot) => lot.floor ?? 0));
  if (floors < highest) fail(409, `Des lots existent jusqu'au ${highest}e étage.`);
  Object.assign(building, { name: text(body.name ?? building.name), floors });
  const tranche = byId(db.tranches, building.trancheId);
  return projectView(byId(db.projects, tranche.projectId), { detailed: true });
}, { roles: roles("catalog.write") });

route("DELETE", "/buildings/:id", ({ params }) => {
  const building = mustFind(db.buildings, params.id, "Immeuble");
  const lots = db.lots.filter((lot) => lot.buildingId === building.id).length;
  if (lots) fail(409, `Impossible de supprimer : ${lots} lot(s) sont rattachés à cet immeuble.`);
  db.buildings = db.buildings.filter((item) => item.id !== building.id);
  const tranche = byId(db.tranches, building.trancheId);
  return projectView(byId(db.projects, tranche.projectId), { detailed: true });
}, { roles: roles("catalog.write") });

route("GET", "/lots", ({ query }) => {
  const q = (query.q ?? "").trim().toLowerCase();
  return db.lots
    .filter((lot) => !query.projectId || lot.projectId === query.projectId)
    .filter((lot) => !query.trancheId || lot.trancheId === query.trancheId)
    .filter((lot) => !query.buildingId || lot.buildingId === query.buildingId)
    .filter((lot) => !query.status || lot.status === query.status)
    .filter((lot) => !query.type || lot.type === query.type)
    .filter((lot) => !q || lot.ref.toLowerCase().includes(q))
    .map(lotView);
});

route("GET", "/lots/:id", ({ params }) => lotView(mustFind(db.lots, params.id, "Lot")));

route("GET", "/lots/:id/history", ({ params }) => {
  mustFind(db.lots, params.id, "Lot");
  return db.lotHistory
    .filter((entry) => entry.lotId === params.id)
    .sort((a, b) => b.at.localeCompare(a.at))
    .map((entry) => ({ ...entry, user: userSummary(entry.userId) }));
});

function validateLotShape(data) {
  required(data.ref, "Le numéro du lot est obligatoire.");
  if (!LOT_TYPE[data.type]) fail(422, "Type de lot invalide.");
  const tranche = byId(db.tranches, data.trancheId);
  if (!tranche || tranche.projectId !== data.projectId) fail(422, "Sélectionnez une tranche du projet.");
  const building = data.buildingId ? byId(db.buildings, data.buildingId) : null;
  if (data.buildingId && (!building || building.trancheId !== tranche.id)) fail(422, "L'immeuble ne fait pas partie de cette tranche.");
  const surface = positiveNumber(data.surface, "La superficie doit être positive.");
  const price = positiveNumber(data.price, "Le prix doit être un montant positif.");
  let floor = null;
  if (!isBlank(data.floor)) {
    floor = Number(data.floor);
    if (!Number.isInteger(floor) || floor < -3) fail(422, "L'étage est invalide.");
    if (building && floor > building.floors) fail(422, `${building.name} ne compte que ${building.floors} étage(s).`);
  }
  if (db.lots.some((lot) => lot.id !== data.id && lot.projectId === data.projectId && lot.ref.toLowerCase() === text(data.ref).toLowerCase())) fail(409, `Le lot ${data.ref} existe déjà dans ce projet.`);
  return { ref: text(data.ref), type: data.type, trancheId: tranche.id, buildingId: building?.id ?? null, surface, price, floor, parking: Boolean(data.parking) };
}

route("POST", "/lots", ({ body, user }) => {
  const project = mustFind(db.projects, body.projectId, "Projet");
  const shape = validateLotShape({ ...body, projectId: project.id });
  const lot = { id: `${project.id}-${shape.ref}`.replace(/\s+/g, ""), projectId: project.id, ...shape, status: "disponible", createdAt: now() };
  if (byId(db.lots, lot.id)) lot.id = uid(project.id);
  db.lots.push(lot);
  db.lotHistory.push({ id: uid("HL"), lotId: lot.id, from: null, to: "disponible", userId: user.id, reason: "Ajout au stock", at: lot.createdAt });
  return lotView(lot);
}, { roles: roles("catalog.write") });

route("PATCH", "/lots/:id", ({ params, body, user }) => {
  const lot = mustFind(db.lots, params.id, "Lot");
  const editable = ["disponible", "bloque"].includes(lot.status);
  const shapeKeys = ["ref", "type", "trancheId", "buildingId", "surface", "price", "floor", "parking"];
  if (shapeKeys.some((key) => key in body)) {
    if (!editable) fail(409, "Un lot engagé (pré-réservé, réservé ou vendu) ne peut pas être modifié.");
    Object.assign(lot, validateLotShape({ ...lot, ...pickFields(body, shapeKeys) }));
  }
  if (body.status && body.status !== lot.status) {
    const ok = (lot.status === "disponible" && body.status === "bloque") || (lot.status === "bloque" && body.status === "disponible");
    if (!ok) fail(409, "Seuls les lots disponibles peuvent être bloqués, et inversement.");
    if (body.status === "bloque") required(body.reason, "Indiquez la raison du blocage.");
    changeLot(lot, body.status, user.id, text(body.reason) || (body.status === "disponible" ? "Remise en vente" : ""));
    notify({
      type: "info",
      title: body.status === "bloque" ? "Lot bloqué" : "Lot débloqué",
      message: `Le lot ${lot.ref} (${projectRef(lot.projectId)?.name}) a été ${body.status === "bloque" ? `bloqué : ${text(body.reason)}` : "remis en vente"} par ${user.name}.`,
      link: `/lots?projectId=${lot.projectId}`,
      roles: ["admin", "chef_projet", "commercial"],
    });
  }
  return lotView(lot);
}, { roles: roles("catalog.write") });

/* ------------------------------------------------------------------ */
/* Pre-reservations                                                    */
/* ------------------------------------------------------------------ */

route("GET", "/pre-reservations", ({ query, user }) =>
  db.preReservations
    .filter((pre) => ownsLeadId(user, pre.leadId))
    .filter((pre) => !query.status || pre.status === query.status)
    .filter((pre) => !query.leadId || pre.leadId === query.leadId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map(preReservationView),
{ roles: roles("preReservations", "leads") });

const DEFAULT_VALIDITY_HOURS = 48;
const MAX_VALIDITY_HOURS = 30 * 24;

route("POST", "/pre-reservations", ({ body, user }) => {
  const lead = mustFindLead(user, body.leadId);
  const lot = mustFind(db.lots, body.lotId, "Lot");
  if (!lead.agentId) fail(409, "Affectez d'abord ce lead à un commercial.");
  if (lot.status !== "disponible") fail(409, `Le lot ${lot.ref} n'est plus disponible.`);
  if (db.preReservations.some((pre) => pre.lotId === lot.id && pre.status === "active")) fail(409, `Le lot ${lot.ref} a déjà une pré-réservation active.`);
  if (!MANUAL_STAGES.includes(lead.stage)) fail(409, "Ce lead ne peut pas faire l'objet d'une pré-réservation à son étape actuelle.");
  if (db.preReservations.some((pre) => pre.leadId === lead.id && pre.status === "active")) fail(409, "Ce lead a déjà une pré-réservation active.");
  const deposit = positiveNumber(body.deposit, "L'acompte doit être un montant positif.");
  if (deposit > lot.price) fail(422, "L'acompte ne peut pas dépasser le prix du lot.");
  if (!PAYMENT_METHOD[body.depositMethod]) fail(422, "Mode de versement de l'acompte invalide.");
  required(body.reason, "Indiquez le motif de la pré-réservation.");
  const validityHours = Number(body.validityHours ?? DEFAULT_VALIDITY_HOURS);
  if (!Number.isInteger(validityHours) || validityHours < 1 || validityHours > MAX_VALIDITY_HOURS) fail(422, "La durée de validité doit être comprise entre 1 heure et 30 jours.");

  const createdAt = now();
  const pre = {
    id: uid("PR"),
    number: nextNumber("preReservation", "PR", 4),
    leadId: lead.id,
    lotId: lot.id,
    agentId: lead.agentId,
    deposit,
    depositMethod: body.depositMethod,
    validityHours,
    createdAt,
    expiresAt: new Date(Date.now() + validityHours * HOUR).toISOString(),
    reason: text(body.reason),
    comments: text(body.comments),
    status: "active",
    extendedAt: null,
    cancelReason: null,
    createdBy: user.id,
  };
  db.preReservations.push(pre);
  changeLot(lot, "pre_reserve", user.id, `Pré-réservation ${pre.number}`);
  moveLead(lead, "pre_reserve", user.id);
  const validity = validityHours % 24 === 0 ? `${validityHours / 24} j` : `${validityHours} h`;
  log({ type: "pre_reservation", leadId: lead.id, userId: user.id, message: `Pré-réservation ${pre.number} du lot ${lot.ref} (acompte ${formatMoney(deposit)}, ${validity})` });
  notify({ type: "info", title: "Nouvelle pré-réservation", message: `${pre.number} — ${leadName(lead)}, lot ${lot.ref}, valable ${validity}.`, link: "/pre-reservations", roles: ["admin"], userIds: [lead.agentId] });
  return preReservationView(pre);
}, { roles: roles("preReservations.write") });

route("POST", "/pre-reservations/:id/extend", ({ params, body, user }) => {
  const pre = mustFind(db.preReservations, params.id, "Pré-réservation");
  if (pre.status !== "active") fail(409, "Seule une pré-réservation active peut être prolongée.");
  const hours = Number(body.hours);
  if (!Number.isInteger(hours) || hours < 1 || hours > 7 * 24) fail(422, "La prolongation doit être comprise entre 1 heure et 7 jours.");
  required(body.reason, "Indiquez le motif de la prolongation.");
  const expiresAt = new Date(new Date(pre.expiresAt).getTime() + hours * HOUR);
  if (expiresAt.getTime() - new Date(pre.createdAt).getTime() > MAX_VALIDITY_HOURS * HOUR) fail(422, "Une pré-réservation ne peut pas dépasser 30 jours au total.");
  Object.assign(pre, { expiresAt: expiresAt.toISOString(), extendedAt: now(), extendedBy: user.id, comments: [pre.comments, `Prolongation de ${hours} h : ${text(body.reason)}`].filter(Boolean).join("\n") });
  const lot = byId(db.lots, pre.lotId);
  log({ type: "pre_reservation", leadId: pre.leadId, userId: user.id, message: `Pré-réservation ${pre.number} prolongée de ${hours} h — ${text(body.reason)}` });
  notify({ type: "info", title: "Pré-réservation prolongée", message: `${pre.number} (lot ${lot?.ref}) est prolongée jusqu'au ${expiresAt.toLocaleString("fr-FR")}.`, link: "/pre-reservations", userIds: [pre.agentId] });
  return preReservationView(pre);
}, { roles: roles("preReservations.extend") });

route("POST", "/pre-reservations/:id/cancel", ({ params, body, user }) => {
  const pre = mustFind(db.preReservations, params.id, "Pré-réservation");
  assertOwns(user, pre.leadId);
  if (pre.status !== "active") fail(409, "Seule une pré-réservation active peut être annulée.");
  required(body.reason, "Indiquez le motif de l'annulation.");
  Object.assign(pre, { status: "annulee", cancelReason: text(body.reason), cancelledAt: now(), cancelledBy: user.id });
  const lot = byId(db.lots, pre.lotId);
  if (lot?.status === "pre_reserve") changeLot(lot, "disponible", user.id, `Pré-réservation ${pre.number} annulée : ${pre.cancelReason}`);
  const lead = byId(db.leads, pre.leadId);
  if (lead?.stage === "pre_reserve") moveLead(lead, "en_negociation", user.id);
  log({ type: "pre_reservation", leadId: pre.leadId, userId: user.id, message: `Pré-réservation ${pre.number} du lot ${lot?.ref ?? ""} annulée — motif : ${pre.cancelReason}` });
  return preReservationView(pre);
}, { roles: roles("preReservations.write") });

route("POST", "/pre-reservations/:id/convert", ({ params, body, user }) => {
  const pre = mustFind(db.preReservations, params.id, "Pré-réservation");
  assertOwns(user, pre.leadId);
  if (pre.status !== "active") fail(409, "Seule une pré-réservation active peut être convertie en dossier.");
  const lead = byId(db.leads, pre.leadId);
  const clientType = body.clientType || lead?.clientType || "particulier";
  if (!DOSSIER_CLIENT_TYPE[clientType]) fail(422, "Type de client invalide.");
  pre.status = "convertie";
  const dossier = { id: uid("DS"), preReservationId: pre.id, leadId: pre.leadId, lotId: pre.lotId, agentId: pre.agentId, clientType, status: null, createdAt: now(), createdBy: user.id, validatedAt: null, documents: newDocuments(clientType) };
  db.dossiers.push(dossier);
  log({ type: "dossier", leadId: pre.leadId, userId: user.id, message: `Dossier ${DOSSIER_CLIENT_TYPE[clientType].label.toLowerCase()} ouvert` });
  return dossierView(dossier, { detailed: true });
}, { roles: roles("preReservations.write") });

/* ------------------------------------------------------------------ */
/* Dossiers & documents                                                */
/* ------------------------------------------------------------------ */

route("GET", "/dossiers", ({ query, user }) =>
  db.dossiers
    .filter((dossier) => ownsLeadId(user, dossier.leadId))
    .map((dossier) => dossierView(dossier))
    .filter((dossier) => !query.status || dossier.state.status === query.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
{ roles: roles("dossiers") });

function mustFindDossier(user, id) {
  const dossier = mustFind(db.dossiers, id, "Dossier");
  if (!ownsLeadId(user, dossier.leadId)) fail(404, "Dossier introuvable.");
  return dossier;
}

route("GET", "/dossiers/:id", ({ params, user }) =>
  dossierView(mustFindDossier(user, params.id), { detailed: true }),
{ roles: roles("dossiers") });

route("POST", "/dossiers/:id/cancel", ({ params, body, user }) => {
  const dossier = mustFindDossier(user, params.id);
  if (dossier.status === "rejete") fail(409, "Ce dossier est déjà rejeté.");
  const reservation = db.reservations.find((item) => item.dossierId === dossier.id && item.status !== "annulee");
  if (reservation && reservation.status !== "en_attente") fail(409, "La réservation de ce dossier est signée : utilisez désistement ou résiliation.");
  required(body.reason, "Indiquez le motif du rejet.");
  const reason = text(body.reason);
  Object.assign(dossier, { status: "rejete", rejectReason: reason, rejectedAt: now(), rejectedBy: user.id });
  if (reservation) {
    reservation.status = "annulee";
    reservation.endReason = reason;
    reservation.endedAt = now();
    reservation.endedBy = user.id;
  }
  const lot = byId(db.lots, dossier.lotId);
  if (lot?.status === "pre_reserve") changeLot(lot, "disponible", user.id, `Dossier rejeté : ${reason}`);
  const lead = byId(db.leads, dossier.leadId);
  if (["pre_reserve", "reserve"].includes(lead?.stage)) moveLead(lead, "en_negociation", user.id);
  log({ type: "dossier", leadId: dossier.leadId, userId: user.id, message: `Dossier rejeté, lot ${lot?.ref ?? ""} remis en vente — motif : ${reason}` });
  notify({ type: "warning", title: "Dossier rejeté", message: `${leadName(lead)} — lot ${lot?.ref ?? ""} est de nouveau disponible. Motif : ${reason}`, link: `/dossiers/${dossier.id}`, roles: ["admin"], userIds: lead?.agentId ? [lead.agentId] : null });
  return dossierView(dossier, { detailed: true });
}, { roles: roles("preReservations.write") });

function findDocument(dossier, key) {
  return dossier.documents.find((doc) => doc.key === key) ?? fail(404, "Pièce introuvable dans ce dossier.");
}

function assertDossierEditable(dossier) {
  if (dossier.status === "rejete") fail(409, "Ce dossier est rejeté.");
  const reservation = db.reservations.find((item) => item.dossierId === dossier.id && item.status !== "annulee");
  if (reservation && reservation.status !== "en_attente") fail(409, "Le dossier d'une réservation signée ne peut plus être modifié.");
}

function trackDocument(doc, userId, action, detail = "") {
  doc.history = [...(doc.history ?? []), { at: now(), userId, action, detail }];
}

function refreshDossierValidation(dossier) {
  const state = dossierState(dossier);
  dossier.validatedAt = state.status === "valide" ? dossier.validatedAt ?? now() : null;
  return state;
}

route("POST", "/dossiers/:id/documents/:key", ({ params, body, user }) => {
  const dossier = mustFindDossier(user, params.id);
  assertDossierEditable(dossier);
  const doc = findDocument(dossier, params.key);
  const file = typeof body.get === "function" ? body.get("file") : null;
  if (!file) fail(422, "Aucun fichier reçu.");
  checkFile(file);
  const replaced = doc.status !== "manquant";
  Object.assign(doc, { status: "en_attente", fileName: file.name, fileSize: file.size, uploadedAt: now(), uploadedBy: user.id, validatedAt: null, validatedBy: null, rejectReason: null });
  trackDocument(doc, user.id, replaced ? "replace" : "upload", file.name);
  log({ type: "dossier", leadId: dossier.leadId, userId: user.id, message: `Pièce ${replaced ? "remplacée" : "reçue"} : ${doc.label}` });
  const state = refreshDossierValidation(dossier);
  if (state.status === "complet" && state.received === state.required) {
    const lead = byId(db.leads, dossier.leadId);
    notify({ type: "info", title: "Dossier complet", message: `Toutes les pièces obligatoires du dossier de ${leadName(lead)} ont été reçues et attendent la validation de la comptabilité.`, link: `/dossiers/${dossier.id}`, roles: ["admin", "comptable"], userIds: lead?.agentId ? [lead.agentId] : null });
  }
  return dossierView(dossier, { detailed: true });
}, { roles: roles("dossiers.upload") });

route("DELETE", "/dossiers/:id/documents/:key", ({ params, user }) => {
  const dossier = mustFindDossier(user, params.id);
  assertDossierEditable(dossier);
  const doc = findDocument(dossier, params.key);
  if (doc.status === "manquant") fail(409, "Aucun fichier à retirer.");
  if (doc.status === "valide") fail(409, "Une pièce validée ne peut pas être retirée.");
  trackDocument(doc, user.id, "remove", doc.fileName);
  Object.assign(doc, { status: "manquant", fileName: null, fileSize: null, uploadedAt: null, uploadedBy: null, validatedAt: null, validatedBy: null, rejectReason: null });
  log({ type: "dossier", leadId: dossier.leadId, userId: user.id, message: `Pièce retirée : ${doc.label}` });
  refreshDossierValidation(dossier);
  return dossierView(dossier, { detailed: true });
}, { roles: roles("dossiers.upload") });

route("PATCH", "/dossiers/:id/documents/:key", ({ params, body, user }) => {
  const dossier = mustFind(db.dossiers, params.id, "Dossier");
  assertDossierEditable(dossier);
  const doc = findDocument(dossier, params.key);
  if (!["valide", "en_attente", "rejete"].includes(body.status)) fail(422, "Statut de pièce invalide.");
  if (doc.status === "manquant") fail(409, "La pièce doit d'abord être téléversée.");
  if (body.status === "rejete") required(body.reason, "Indiquez le motif du rejet de la pièce.");
  const previous = doc.status;
  doc.status = body.status;
  doc.validatedAt = body.status === "valide" ? now() : null;
  doc.validatedBy = body.status === "valide" ? user.id : null;
  doc.rejectReason = body.status === "rejete" ? text(body.reason) : null;
  const action = body.status === "valide" ? "validate" : body.status === "rejete" ? "reject" : "unvalidate";
  trackDocument(doc, user.id, action, doc.rejectReason ?? "");
  const label = { validate: "Pièce validée", reject: "Pièce rejetée", unvalidate: "Validation retirée" }[action];
  log({ type: "dossier", leadId: dossier.leadId, userId: user.id, message: `${label} : ${doc.label}${doc.rejectReason ? ` — ${doc.rejectReason}` : ""}` });
  if (body.status === "rejete" && previous !== "rejete") {
    const lead = byId(db.leads, dossier.leadId);
    notify({ type: "warning", title: "Pièce rejetée", message: `${doc.label} (${leadName(lead)}) : ${doc.rejectReason}`, link: `/dossiers/${dossier.id}`, userIds: lead?.agentId ? [lead.agentId] : null, roles: ["admin"] });
  }
  refreshDossierValidation(dossier);
  return dossierView(dossier, { detailed: true });
}, { roles: roles("dossiers.validate") });

/* ------------------------------------------------------------------ */
/* Reservations                                                        */
/* ------------------------------------------------------------------ */

route("GET", "/reservations", ({ query, user }) =>
  db.reservations
    .filter((item) => ownsLeadId(user, item.leadId))
    .filter((item) => !query.status || item.status === query.status)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((item) => reservationView(item)),
{ roles: roles("reservations", "payments", "schedule") });

function mustFindReservation(user, id) {
  const reservation = mustFind(db.reservations, id, "Réservation");
  if (!ownsLeadId(user, reservation.leadId)) fail(404, "Réservation introuvable.");
  return reservation;
}

route("GET", "/reservations/:id", ({ params, user }) =>
  reservationView(mustFindReservation(user, params.id), { detailed: true }),
{ roles: roles("reservations") });

const MAX_DISCOUNT_RATE = 0.15;

route("POST", "/reservations", ({ body, user }) => {
  const dossier = mustFindDossier(user, body.dossierId);
  if (dossier.status === "rejete") fail(409, "Ce dossier est rejeté.");
  if (db.reservations.some((item) => item.dossierId === dossier.id && item.status !== "annulee")) fail(409, "Une réservation existe déjà pour ce dossier.");
  const state = dossierState(dossier);
  if (state.received < state.required) fail(422, `Le dossier doit être complet : il manque ${state.required - state.received} pièce(s) obligatoire(s).`);
  const lot = mustFind(db.lots, dossier.lotId, "Lot");
  if (lot.status !== "pre_reserve") fail(409, `Le lot ${lot.ref} n'est plus bloqué pour ce client.`);
  const discount = optionalNumber(body.discount, "La remise est invalide.") ?? 0;
  if (discount > lot.price * MAX_DISCOUNT_RATE) fail(422, `La remise ne peut pas dépasser ${MAX_DISCOUNT_RATE * 100} % du prix du lot.`);
  if (discount > 0) required(body.discountReason, "Justifiez la remise accordée.");
  const pre = byId(db.preReservations, dossier.preReservationId);
  const reservation = {
    id: uid("RS"),
    number: nextNumber("reservation", "RSV", 4),
    dossierId: dossier.id,
    leadId: dossier.leadId,
    lotId: lot.id,
    projectId: lot.projectId,
    agentId: dossier.agentId,
    listPrice: lot.price,
    discount,
    discountReason: discount > 0 ? text(body.discountReason) : "",
    approvedBy: null,
    approvedAt: null,
    price: lot.price - discount,
    deposit: pre?.deposit ?? 0,
    paymentTerms: text(body.paymentTerms) || "Acompte à la pré-réservation, 30 % à la signature du compromis, appels de fonds à l'avancement des travaux et solde à la remise des clés.",
    status: "en_attente",
    createdAt: now(),
    createdBy: user.id,
    signedAt: null,
    signedBy: null,
    bulletinNumber: null,
    bulletinGeneratedAt: null,
    blocked: false,
    blockedReason: null,
    endReason: null,
    endedAt: null,
    endedBy: null,
  };
  db.reservations.push(reservation);
  const lead = byId(db.leads, reservation.leadId);
  moveLead(lead, "reserve", user.id);
  log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Réservation ${reservation.number} créée${discount ? ` — remise de ${formatMoney(discount)} à approuver` : ""}` });
  if (discount > 0) notify({ type: "warning", title: "Remise à approuver", message: `${reservation.number} — ${leadName(lead)} : remise de ${formatMoney(discount)} (${reservation.discountReason}).`, link: `/reservations/${reservation.id}`, roles: ["admin", "direction"] });
  return reservationView(reservation, { detailed: true });
}, { roles: roles("reservations.confirm") });

route("POST", "/reservations/:id/discount", ({ params, body, user }) => {
  const reservation = mustFind(db.reservations, params.id, "Réservation");
  if (reservation.status !== "en_attente") fail(409, "La remise ne peut être revue que sur une réservation en attente.");
  if (!(reservation.discount > 0) || reservation.approvedBy) fail(409, "Aucune remise en attente d'approbation.");
  const lead = byId(db.leads, reservation.leadId);
  if (body.decision === "approve") {
    Object.assign(reservation, { approvedBy: user.id, approvedAt: now() });
    log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Remise de ${formatMoney(reservation.discount)} approuvée sur ${reservation.number}` });
  } else if (body.decision === "reject") {
    required(body.reason, "Indiquez le motif du refus.");
    log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Remise de ${formatMoney(reservation.discount)} refusée sur ${reservation.number} — ${text(body.reason)}` });
    Object.assign(reservation, { discount: 0, discountReason: "", price: reservation.listPrice });
  } else {
    fail(422, "Décision invalide.");
  }
  notify({ type: body.decision === "approve" ? "success" : "warning", title: body.decision === "approve" ? "Remise approuvée" : "Remise refusée", message: `${reservation.number} — ${leadName(lead)}${body.reason ? ` : ${text(body.reason)}` : ""}`, link: `/reservations/${reservation.id}`, userIds: [reservation.agentId, reservation.createdBy].filter(Boolean) });
  return reservationView(reservation, { detailed: true });
}, { roles: roles("reservations.approveDiscount") });

route("POST", "/reservations/:id/confirm", ({ params, user }) => {
  const reservation = mustFindReservation(user, params.id);
  if (reservation.status !== "en_attente") fail(409, "Cette réservation n'est pas en attente de signature.");
  if (reservation.discount > 0 && !reservation.approvedBy) fail(409, "La remise doit être approuvée par la direction avant la signature.");
  const lot = mustFind(db.lots, reservation.lotId, "Lot");
  if (lot.status !== "pre_reserve") fail(409, `Le lot ${lot.ref} n'est plus pré-réservé pour ce client.`);
  const dossier = mustFind(db.dossiers, reservation.dossierId, "Dossier");
  const state = dossierState(dossier);
  if (state.validated < state.required) fail(422, `${state.required - state.validated} pièce(s) obligatoire(s) doivent encore être validées par la comptabilité.`);
  const project = mustFind(db.projects, reservation.projectId, "Projet");
  const pre = byId(db.preReservations, dossier.preReservationId);

  Object.assign(reservation, { status: "active", signedAt: now(), signedBy: user.id });
  changeLot(lot, "reserve", user.id, `Réservation ${reservation.number} signée`);
  const lead = byId(db.leads, reservation.leadId);
  moveLead(lead, "signe", user.id);

  const schedule = buildSchedule({ reservationId: reservation.id, price: reservation.price, deposit: reservation.deposit, startAt: reservation.signedAt, deliveryDate: project.deliveryDate });
  db.installments.push(...schedule);
  if (reservation.deposit > 0) {
    db.payments.push({
      id: uid("PAY"),
      reservationId: reservation.id,
      installmentId: schedule[0]?.id ?? null,
      amount: reservation.deposit,
      method: pre?.depositMethod ?? "virement",
      origin: "national",
      bank: null,
      bankOther: "",
      country: "",
      foreignBank: "",
      currency: null,
      foreignAmount: null,
      reference: `ACOMPTE-${pre?.number ?? reservation.number}`,
      proofFileName: null,
      date: pre?.createdAt ?? reservation.signedAt,
      status: "en_attente_validation",
      note: "Acompte versé à la pré-réservation",
      createdBy: user.id,
      createdAt: reservation.signedAt,
      validatedBy: null,
      validatedAt: null,
      comment: "",
      rejectReason: null,
    });
  }
  recomputeReservation(db, reservation.id, { userId: user.id });
  log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Réservation ${reservation.number} signée — échéancier généré` });
  notify({ type: "success", title: "Réservation signée", message: `${reservation.number} — ${leadName(lead)}, lot ${lot.ref}. Échéancier généré.`, link: `/reservations/${reservation.id}`, roles: null });
  if (reservation.deposit > 0) {
    notify({ type: "info", title: "Acompte à valider", message: `Acompte de ${formatMoney(reservation.deposit)} pour ${reservation.number} (${leadName(lead)}).`, link: "/paiements", roles: ["admin", "comptable"] });
  }
  return reservationView(reservation, { detailed: true });
}, { roles: roles("reservations.confirm") });

route("POST", "/reservations/:id/bulletin", ({ params, user }) => {
  const reservation = mustFindReservation(user, params.id);
  if (!["active", "cloturee"].includes(reservation.status)) fail(409, "Le bulletin ne peut être généré que pour une réservation signée.");
  if (reservation.blocked) fail(409, `Dossier bloqué : ${reservation.blockedReason}`);
  if (!reservation.bulletinNumber) reservation.bulletinNumber = nextNumber("bulletin", "BR", 4);
  reservation.bulletinGeneratedAt = now();
  reservation.bulletinGeneratedBy = user.id;
  log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Bulletin ${reservation.bulletinNumber} généré` });
  return reservationView(reservation, { detailed: true });
}, { roles: roles("reservations.confirm") });

route("POST", "/reservations/:id/close", ({ params, body, user }) => {
  const reservation = mustFind(db.reservations, params.id, "Réservation");
  if (reservation.status !== "active") fail(409, "Seule une réservation active peut être clôturée ou interrompue.");
  if (!RESERVATION_END_STATUSES.includes(body.status)) fail(422, "Issue de réservation invalide.");
  required(body.reason, "Indiquez le motif.");
  const pending = db.payments.filter((payment) => payment.reservationId === reservation.id && PENDING_PAYMENT_STATUSES.includes(payment.status));
  if (pending.length) fail(409, `Traitez d'abord ${pending.length} paiement(s) en attente sur cette réservation.`);
  const totals = reservationTotals(reservation);
  if (body.status === "cloturee" && totals.remaining > 0) fail(409, `Le solde de ${formatMoney(totals.remaining)} n'est pas réglé.`);

  const reason = text(body.reason);
  const label = RESERVATION_STATUS[body.status].label;
  Object.assign(reservation, { status: body.status, endReason: reason, endedAt: now(), endedBy: user.id });
  const lot = byId(db.lots, reservation.lotId);
  const lead = byId(db.leads, reservation.leadId);
  if (body.status === "cloturee") {
    if (lot && lot.status !== "vendu") changeLot(lot, "vendu", user.id, `Réservation ${reservation.number} clôturée`);
    if (lead && lead.stage !== "cloture") {
      if (lead.stage !== "livre") moveLead(lead, "livre", user.id);
      moveLead(lead, "cloture", user.id);
    }
  } else {
    db.installments.filter((item) => item.reservationId === reservation.id && item.paidAmount < item.amount).forEach((item) => {
      item.cancelled = true;
    });
    if (lot) changeLot(lot, "disponible", user.id, `${label} sur ${reservation.number} : ${reason}`);
    if (lead) {
      if (body.status === "change_ref") moveLead(lead, "en_negociation", user.id, " (changement de référence)");
      else {
        lead.cancelReason = `${label} : ${reason}`;
        moveLead(lead, "annule", user.id, ` — ${label.toLowerCase()} : ${reason}`);
      }
    }
  }
  log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Réservation ${reservation.number} : ${label.toLowerCase()} — ${reason}` });
  notify({ type: body.status === "cloturee" ? "success" : "warning", title: `Réservation — ${label}`, message: `${reservation.number} (${leadName(lead)}, lot ${lot?.ref}) : ${reason}`, link: `/reservations/${reservation.id}`, roles: ["admin", "direction", "comptable"], userIds: [reservation.agentId] });
  return reservationView(reservation, { detailed: true });
}, { roles: roles("reservations.close") });

/* ------------------------------------------------------------------ */
/* Payments & schedules                                                */
/* ------------------------------------------------------------------ */

route("GET", "/payments", ({ query, user }) => {
  const q = (query.q ?? "").trim().toLowerCase();
  const statuses = query.status === "pending" ? PENDING_PAYMENT_STATUSES : query.status ? [query.status] : null;
  return db.payments
    .filter((payment) => ownsLeadId(user, byId(db.reservations, payment.reservationId)?.leadId))
    .filter((payment) => !statuses || statuses.includes(payment.status))
    .filter((payment) => !query.reservationId || payment.reservationId === query.reservationId)
    .map(paymentView)
    .filter((payment) => !q || `${payment.lead?.name} ${payment.reference} ${payment.reservation?.number} ${payment.lot?.ref}`.toLowerCase().includes(q))
    .sort((a, b) => b.date.localeCompare(a.date));
}, { roles: roles("payments") });

function paymentFunds(body) {
  const origin = body.origin || "national";
  if (!PAYMENT_ORIGIN[origin]) fail(422, "Origine des fonds invalide.");
  const usesBank = BANK_METHODS.includes(body.method);
  const needsBank = BANK_REQUIRED_METHODS.includes(body.method);
  const funds = { origin, bank: null, bankOther: "", country: "", foreignBank: "", currency: null, foreignAmount: null };

  if (origin === "national") {
    if (!usesBank) return funds;
    if (isBlank(body.bank)) {
      if (needsBank) fail(422, "Sélectionnez la banque du client.");
      return funds;
    }
    if (!BANK[body.bank]) fail(422, "Banque invalide.");
    if (body.bank === "autre") required(body.bankOther, "Précisez le nom de la banque.");
    return { ...funds, bank: body.bank, bankOther: body.bank === "autre" ? text(body.bankOther) : "" };
  }

  required(body.country, "Indiquez le pays d'où proviennent les fonds.");
  if (!CURRENCY[body.currency]) fail(422, "Sélectionnez la devise envoyée.");
  if (needsBank) required(body.foreignBank, "Indiquez la banque émettrice à l'étranger.");
  return {
    ...funds,
    country: text(body.country),
    foreignBank: usesBank ? text(body.foreignBank) : "",
    currency: body.currency,
    foreignAmount: positiveNumber(body.foreignAmount, "Le montant en devise doit être positif."),
  };
}

route("POST", "/payments", ({ body: raw, user }) => {
  const body = formData(raw);
  const reservation = mustFindReservation(user, body.reservationId);
  if (reservation.status !== "active") fail(409, "Les paiements ne peuvent être saisis que sur une réservation active.");
  const amount = positiveNumber(body.amount, "Le montant doit être positif.");
  const { remaining, pending } = reservationTotals(reservation);
  if (amount > remaining - pending) fail(422, "Le montant dépasse le reste à payer (paiements en attente inclus).");
  if (!PAYMENT_METHOD[body.method]) fail(422, "Mode de paiement invalide.");
  required(body.reference, "La référence du paiement est obligatoire.");
  required(body.date, "La date du paiement est obligatoire.");
  let installmentId = null;
  if (body.installmentId) {
    const installment = mustFind(db.installments, body.installmentId, "Échéance");
    if (installment.reservationId !== reservation.id) fail(422, "Cette échéance n'appartient pas à la réservation.");
    if (installment.cancelled || installment.paidAmount >= installment.amount) fail(409, "Cette échéance est déjà réglée.");
    installmentId = installment.id;
  }
  const funds = paymentFunds(body);
  const proof = body.proof && typeof body.proof === "object" ? body.proof : null;
  if (proof) checkFile(proof);
  const payment = {
    id: uid("PAY"),
    reservationId: reservation.id,
    installmentId,
    amount,
    method: body.method,
    ...funds,
    reference: text(body.reference),
    proofFileName: proof?.name ?? null,
    date: new Date(body.date).toISOString(),
    status: "en_attente_validation",
    note: text(body.note),
    createdBy: user.id,
    createdAt: now(),
    validatedBy: null,
    validatedAt: null,
    comment: "",
    rejectReason: null,
  };
  db.payments.push(payment);
  const lead = byId(db.leads, reservation.leadId);
  const method = PAYMENT_METHOD[payment.method].label;
  const source = payment.origin === "international" ? `${payment.country}, ${payment.foreignAmount.toLocaleString("fr-FR")} ${payment.currency}` : payment.bank && (payment.bankOther || BANK[payment.bank].label);
  log({ type: "payment", leadId: reservation.leadId, userId: user.id, message: `Paiement de ${formatMoney(amount)} saisi (${[method, source].filter(Boolean).join(" · ")})` });
  notify({ type: "info", title: "Paiement à valider", message: `${method} de ${formatMoney(amount)} pour ${reservation.number} (${leadName(lead)}).`, link: "/paiements", roles: ["admin", "comptable"] });
  return paymentView(payment);
}, { roles: roles("payments.create") });

route("POST", "/payments/:id/encashment", ({ params, user }) => {
  const payment = mustFind(db.payments, params.id, "Paiement");
  if (payment.status !== "en_attente_validation") fail(409, "Seul un paiement à valider peut passer en attente d'encaissement.");
  if (!["cheque", "cheque_certifie"].includes(payment.method)) fail(409, "Seuls les chèques passent par l'étape d'encaissement.");
  Object.assign(payment, { status: "en_attente_encaissement", validatedBy: user.id });
  const reservation = byId(db.reservations, payment.reservationId);
  log({ type: "payment", leadId: reservation?.leadId, userId: user.id, message: `Chèque ${payment.reference} remis à l'encaissement` });
  return paymentView(payment);
}, { roles: roles("payments.validate") });

function decidePayment({ params, body, user }, status) {
  const payment = mustFind(db.payments, params.id, "Paiement");
  if (!PENDING_PAYMENT_STATUSES.includes(payment.status)) fail(409, "Ce paiement a déjà été traité.");
  if (status === "rejete") required(body.comment, "Indiquez le motif du rejet.");
  payment.status = status;
  payment.validatedBy = user.id;
  payment.validatedAt = now();
  if (status === "rejete") payment.rejectReason = text(body.comment);
  else payment.comment = text(body.comment);
  recomputeReservation(db, payment.reservationId, { userId: user.id });
  const reservation = byId(db.reservations, payment.reservationId);
  const lead = reservation && byId(db.leads, reservation.leadId);
  log({ type: "payment", leadId: reservation?.leadId, userId: user.id, message: `Paiement de ${formatMoney(payment.amount)} ${status === "valide" ? "validé" : "rejeté"} par la comptabilité` });
  if (status === "valide" && lead?.stage === "signe") moveLead(lead, "en_paiement", user.id);
  if (reservation && status === "rejete") {
    reservation.blocked = true;
    reservation.blockedReason = `paiement ${payment.reference} rejeté (${payment.rejectReason})`;
    log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Dossier ${reservation.number} bloqué — paiement rejeté, relance client nécessaire` });
    notify({ type: "danger", title: "Paiement rejeté — dossier bloqué", message: `${payment.reference} (${reservation.number}) : ${payment.rejectReason}. Relancez le client.`, link: `/reservations/${reservation.id}`, roles: ["admin"], userIds: [...new Set([payment.createdBy, lead?.agentId].filter(Boolean))] });
  }
  if (reservation?.blocked && status === "valide") {
    reservation.blocked = false;
    reservation.blockedReason = null;
    log({ type: "reservation", leadId: reservation.leadId, userId: user.id, message: `Dossier ${reservation.number} débloqué — paiement validé` });
  }
  return paymentView(payment);
}

route("POST", "/payments/:id/validate", (ctx) => decidePayment(ctx, "valide"), { roles: roles("payments.validate") });
route("POST", "/payments/:id/reject", (ctx) => decidePayment(ctx, "rejete"), { roles: roles("payments.validate") });

route("GET", "/schedules", ({ query, user }) =>
  db.installments
    .filter((item) => ownsLeadId(user, byId(db.reservations, item.reservationId)?.leadId))
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

route("GET", "/schedules/:reservationId", ({ params, user }) => {
  const reservation = mustFindReservation(user, params.reservationId);
  const installments = db.installments
    .filter((item) => item.reservationId === reservation.id)
    .sort((a, b) => a.order - b.order)
    .map(installmentView);
  const next = installments.find((item) => !["payee", "annulee"].includes(item.status));
  return { reservation: reservationView(reservation), installments, totals: reservationTotals(reservation), next: next ?? null };
}, { roles: roles("schedule") });

/* ------------------------------------------------------------------ */
/* Directory: promoters, project managers, users                       */
/* ------------------------------------------------------------------ */

const PROMOTER_FIELDS = ["group", "company", "rc", "ifNumber", "ice", "headOffice"];

const withProjects = (item, linkKey) => ({
  ...item,
  projects: db.projects.filter((project) => project[linkKey] === item.id).map((project) => ({ id: project.id, name: project.name })),
});

function validatePromoter(data) {
  required(data.company, "Le nom de la société est obligatoire.");
  if (data.ice && !/^\d{15}$/.test(String(data.ice).replace(/\s+/g, ""))) fail(422, "L'ICE doit comporter 15 chiffres.");
}

route("GET", "/promoters", () => db.promoters.map((item) => withProjects({ ...item, name: item.company }, "promoterId")), { roles: roles("promoters", "catalog.write") });
route("GET", "/promoters/:id", ({ params }) => {
  const item = mustFind(db.promoters, params.id, "Promoteur");
  return withProjects({ ...item, name: item.company }, "promoterId");
}, { roles: roles("promoters", "catalog.write") });

route("POST", "/promoters", ({ body }) => {
  validatePromoter(body);
  const item = { id: uid("PRM"), ...Object.fromEntries(PROMOTER_FIELDS.map((key) => [key, text(body[key])])), createdAt: now() };
  item.ice = item.ice.replace(/\s+/g, "");
  db.promoters.push(item);
  return withProjects({ ...item, name: item.company }, "promoterId");
}, { roles: roles("promoters.write") });

route("PATCH", "/promoters/:id", ({ params, body }) => {
  const item = mustFind(db.promoters, params.id, "Promoteur");
  const next = { ...item, ...pickFields(body, PROMOTER_FIELDS) };
  validatePromoter(next);
  Object.assign(item, Object.fromEntries(PROMOTER_FIELDS.map((key) => [key, text(next[key])])));
  item.ice = item.ice.replace(/\s+/g, "");
  return withProjects({ ...item, name: item.company }, "promoterId");
}, { roles: roles("promoters.write") });

route("DELETE", "/promoters/:id", ({ params }) => {
  const item = mustFind(db.promoters, params.id, "Promoteur");
  const linked = db.projects.filter((project) => project.promoterId === item.id);
  if (linked.length) fail(409, `Impossible de supprimer : rattaché à ${linked.length} projet(s) (${linked.map((p) => p.name).join(", ")}).`);
  db.promoters = db.promoters.filter((entry) => entry.id !== item.id);
  return null;
}, { roles: roles("promoters.write") });

const userView = (user) => ({ ...user });
const managerView = (user) => withProjects(userView(user), "managerId");

function validatePerson(data) {
  required(data.lastName, "Le nom est obligatoire.");
  required(data.firstName, "Le prénom est obligatoire.");
  required(data.email, "L'email est obligatoire.");
  if (!/^\S+@\S+\.\S+$/.test(data.email)) fail(422, "L'adresse email est invalide.");
  const email = text(data.email).toLowerCase();
  if (db.users.some((user) => user.id !== data.id && user.email.toLowerCase() === email)) fail(409, "Un utilisateur utilise déjà cet email.");
}

function createUser(body, role) {
  validatePerson(body);
  if (!body.password || String(body.password).length < 8) fail(422, "Le mot de passe provisoire doit contenir au moins 8 caractères.");
  const firstName = text(body.firstName);
  const lastName = text(body.lastName);
  const user = { id: uid("U"), firstName, lastName, name: `${firstName} ${lastName}`, email: text(body.email).toLowerCase(), role, phone: text(body.phone), active: true, createdAt: now() };
  db.users.push(user);
  db.credentials[user.email] = body.password;
  return user;
}

function updatePerson(user, body) {
  const next = { ...user, ...pickFields(body, ["firstName", "lastName", "email", "phone"]) };
  validatePerson(next);
  const email = text(next.email).toLowerCase();
  if (email !== user.email) {
    db.credentials[email] = db.credentials[user.email];
    delete db.credentials[user.email];
  }
  Object.assign(user, { firstName: text(next.firstName), lastName: text(next.lastName), email, phone: text(next.phone) });
  user.name = `${user.firstName} ${user.lastName}`;
}

route("GET", "/project-managers", () => db.users.filter((user) => user.role === "chef_projet" && user.active).map(managerView), { roles: roles("managers", "catalog.write") });

route("GET", "/project-managers/:id", ({ params }) => {
  const user = mustFind(db.users, params.id, "Chef de projet");
  if (user.role !== "chef_projet") fail(404, "Chef de projet introuvable.");
  return managerView(user);
}, { roles: roles("managers", "catalog.write") });

route("POST", "/project-managers", ({ body }) => managerView(createUser(body, "chef_projet")), { roles: roles("managers.write") });

route("PATCH", "/project-managers/:id", ({ params, body }) => {
  const user = mustFind(db.users, params.id, "Chef de projet");
  if (user.role !== "chef_projet") fail(404, "Chef de projet introuvable.");
  updatePerson(user, body);
  return managerView(user);
}, { roles: roles("managers.write") });

route("DELETE", "/project-managers/:id", ({ params }) => {
  const user = mustFind(db.users, params.id, "Chef de projet");
  if (user.role !== "chef_projet") fail(404, "Chef de projet introuvable.");
  const linked = db.projects.filter((project) => project.managerId === user.id);
  if (linked.length) fail(409, `Impossible de retirer : responsable de ${linked.length} projet(s) (${linked.map((p) => p.name).join(", ")}).`);
  user.active = false;
  for (const [token, id] of Object.entries(db.sessions)) if (id === user.id) delete db.sessions[token];
  return null;
}, { roles: roles("managers.write") });

route("GET", "/users", () => db.users.map(userView), { roles: roles("users.manage") });

route("POST", "/users", ({ body }) => {
  if (!AREAS.dashboard.includes(body.role)) fail(422, "Rôle invalide.");
  return userView(createUser(body, body.role));
}, { roles: roles("users.manage") });

route("PATCH", "/users/:id", ({ params, body, user: actor }) => {
  const user = mustFind(db.users, params.id, "Utilisateur");
  if (body.role !== undefined && !AREAS.dashboard.includes(body.role)) fail(422, "Rôle invalide.");
  if (user.id === actor.id && (body.active === false || (body.role && body.role !== "admin"))) {
    fail(409, "Vous ne pouvez pas désactiver votre propre compte ni retirer vos droits d'administrateur.");
  }
  if (body.role && body.role !== user.role && user.role === "chef_projet" && db.projects.some((project) => project.managerId === user.id)) {
    fail(409, "Ce chef de projet est responsable de projets : réaffectez-les avant de changer son rôle.");
  }
  if (body.active === false && db.leads.some((lead) => lead.agentId === user.id && !["cloture", "annule"].includes(lead.stage))) {
    fail(409, "Ce commercial suit encore des leads actifs : réaffectez-les avant de désactiver son compte.");
  }
  if (["firstName", "lastName", "email", "phone"].some((key) => key in body)) updatePerson(user, body);
  Object.assign(user, pickFields(body, ["role", "active"]));
  if (user.active === false) {
    for (const [token, id] of Object.entries(db.sessions)) if (id === user.id) delete db.sessions[token];
  }
  return userView(user);
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

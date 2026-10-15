import { request } from "./client.js";

function qs(params = {}) {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined && value !== null && value !== "");
  const search = new URLSearchParams(entries).toString();
  return search ? `?${search}` : "";
}

function crud(base) {
  return {
    list: (params) => request("GET", `${base}${qs(params)}`),
    get: (id) => request("GET", `${base}/${id}`),
    create: (data) => request("POST", base, data),
    update: (id, data) => request("PATCH", `${base}/${id}`, data),
    remove: (id) => request("DELETE", `${base}/${id}`),
  };
}

function toForm(data) {
  const form = new FormData();
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") form.append(key, value);
  });
  return form;
}

export const api = {
  auth: {
    login: (email, password) => request("POST", "/auth/login", { email, password }),
    me: () => request("GET", "/auth/me"),
    logout: () => request("POST", "/auth/logout"),
  },

  dashboard: {
    summary: () => request("GET", "/dashboard"),
  },

  team: {
    list: () => request("GET", "/team"),
  },

  sources: crud("/sources"),

  leads: {
    ...crud("/leads"),
    contacts: (id) => request("GET", `/leads/${id}/contacts`),
    addContact: (id, data) => request("POST", `/leads/${id}/contacts`, data),
    activities: (id) => request("GET", `/leads/${id}/activities`),
  },

  projects: {
    ...crud("/projects"),
    addTranche: (projectId, data) => request("POST", `/projects/${projectId}/tranches`, data),
    updateTranche: (id, data) => request("PATCH", `/tranches/${id}`, data),
    removeTranche: (id) => request("DELETE", `/tranches/${id}`),
    addBuilding: (trancheId, data) => request("POST", `/tranches/${trancheId}/buildings`, data),
    updateBuilding: (id, data) => request("PATCH", `/buildings/${id}`, data),
    removeBuilding: (id) => request("DELETE", `/buildings/${id}`),
  },

  lots: {
    list: (params) => request("GET", `/lots${qs(params)}`),
    get: (id) => request("GET", `/lots/${id}`),
    history: (id) => request("GET", `/lots/${id}/history`),
    create: (data) => request("POST", "/lots", data),
    update: (id, data) => request("PATCH", `/lots/${id}`, data),
  },

  preReservations: {
    list: (params) => request("GET", `/pre-reservations${qs(params)}`),
    create: (data) => request("POST", "/pre-reservations", data),
    cancel: (id, reason) => request("POST", `/pre-reservations/${id}/cancel`, { reason }),
    extend: (id, hours, reason) => request("POST", `/pre-reservations/${id}/extend`, { hours, reason }),
    convert: (id, clientType) => request("POST", `/pre-reservations/${id}/convert`, { clientType }),
  },

  dossiers: {
    list: (params) => request("GET", `/dossiers${qs(params)}`),
    get: (id) => request("GET", `/dossiers/${id}`),
    cancel: (id, reason) => request("POST", `/dossiers/${id}/cancel`, { reason }),
    uploadDocument: (id, key, file) => request("POST", `/dossiers/${id}/documents/${key}`, toForm({ file })),
    removeDocument: (id, key) => request("DELETE", `/dossiers/${id}/documents/${key}`),
    setDocumentStatus: (id, key, status, reason) => request("PATCH", `/dossiers/${id}/documents/${key}`, { status, reason }),
  },

  reservations: {
    list: (params) => request("GET", `/reservations${qs(params)}`),
    get: (id) => request("GET", `/reservations/${id}`),
    create: (data) => request("POST", "/reservations", data),
    decideDiscount: (id, decision, reason) => request("POST", `/reservations/${id}/discount`, { decision, reason }),
    confirm: (id) => request("POST", `/reservations/${id}/confirm`),
    generateBulletin: (id) => request("POST", `/reservations/${id}/bulletin`),
    close: (id, status, reason) => request("POST", `/reservations/${id}/close`, { status, reason }),
  },

  payments: {
    list: (params) => request("GET", `/payments${qs(params)}`),
    create: (data) => request("POST", "/payments", data.proof ? toForm(data) : data),
    encashment: (id) => request("POST", `/payments/${id}/encashment`),
    validate: (id, comment) => request("POST", `/payments/${id}/validate`, { comment }),
    reject: (id, comment) => request("POST", `/payments/${id}/reject`, { comment }),
  },

  schedules: {
    get: (reservationId) => request("GET", `/schedules/${reservationId}`),
    overdue: () => request("GET", "/schedules?status=en_retard"),
  },

  promoters: crud("/promoters"),
  managers: crud("/project-managers"),

  notifications: {
    list: (params) => request("GET", `/notifications${qs(params)}`),
    unreadCount: () => request("GET", "/notifications/unread-count"),
    markRead: (id) => request("POST", `/notifications/${id}/read`),
    markAllRead: () => request("POST", "/notifications/read-all"),
  },

  users: crud("/users"),
};

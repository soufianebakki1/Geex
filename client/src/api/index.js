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

  leads: {
    ...crud("/leads"),
    contacts: (id) => request("GET", `/leads/${id}/contacts`),
    addContact: (id, data) => request("POST", `/leads/${id}/contacts`, data),
    activities: (id) => request("GET", `/leads/${id}/activities`),
  },

  projects: crud("/projects"),

  lots: {
    list: (params) => request("GET", `/lots${qs(params)}`),
    get: (id) => request("GET", `/lots/${id}`),
    update: (id, data) => request("PATCH", `/lots/${id}`, data),
  },

  preReservations: {
    list: (params) => request("GET", `/pre-reservations${qs(params)}`),
    create: (data) => request("POST", "/pre-reservations", data),
    cancel: (id, reason) => request("POST", `/pre-reservations/${id}/cancel`, { reason }),
    convert: (id) => request("POST", `/pre-reservations/${id}/convert`),
  },

  dossiers: {
    list: (params) => request("GET", `/dossiers${qs(params)}`),
    get: (id) => request("GET", `/dossiers/${id}`),
    cancel: (id, reason) => request("POST", `/dossiers/${id}/cancel`, { reason }),
    uploadDocument: (id, key, file) => {
      const form = new FormData();
      form.append("file", file);
      return request("POST", `/dossiers/${id}/documents/${key}`, form);
    },
    removeDocument: (id, key) => request("DELETE", `/dossiers/${id}/documents/${key}`),
    setDocumentStatus: (id, key, status) => request("PATCH", `/dossiers/${id}/documents/${key}`, { status }),
  },

  reservations: {
    list: (params) => request("GET", `/reservations${qs(params)}`),
    get: (id) => request("GET", `/reservations/${id}`),
    create: (dossierId) => request("POST", "/reservations", { dossierId }),
    confirm: (id) => request("POST", `/reservations/${id}/confirm`),
    generateBulletin: (id) => request("POST", `/reservations/${id}/bulletin`),
  },

  payments: {
    list: (params) => request("GET", `/payments${qs(params)}`),
    create: (data) => request("POST", "/payments", data),
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

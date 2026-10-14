import { ApiError, defaultMessage } from "./errors.js";

const TOKEN_KEY = "konouz.token";

export const API_BASE = (import.meta.env.VITE_API_URL || "/api").replace(/\/$/, "");

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS
  ? import.meta.env.VITE_USE_MOCKS === "true"
  : import.meta.env.DEV;

export const UNAUTHORIZED_EVENT = "konouz:unauthorized";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

function signalUnauthorized(error) {
  if (error?.status === 401) window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
}

export async function request(method, path, body) {
  const token = tokenStore.get();

  if (USE_MOCKS) {
    const { mockRequest } = await import("./mock/server.js");
    try {
      return await mockRequest(method, path, body, token);
    } catch (error) {
      signalUnauthorized(error);
      throw error;
    }
  }

  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = { Accept: "application/json" };
  if (body !== undefined && !isForm) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    credentials: "include",
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });

  if (response.status === 204) return null;

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const error = new ApiError(response.status, data?.message || defaultMessage(response.status), data);
    signalUnauthorized(error);
    throw error;
  }

  return data;
}

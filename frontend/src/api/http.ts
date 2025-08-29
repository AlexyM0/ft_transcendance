// src/api/http.ts

/**
 * Centralized fetch wrapper :
 * - sets base URL (env overrideable)
 * - alway ssends cookies (session JWT)
 * - normalizes JSON parsing and errors
 * - tiny helpers for query strings and JSON bodies
 */

/**
 * In dev we can leave this empty and rely on Vite proxy
 * In prod, set VITE_API_BASE to the domain
 */
export const API_BASE = (import.meta as any)?.env?.VITE_API_BASE ?? "";

export class HttpError extends Error {
  constructor(public status: number, message: string, public body?: unknown) {
    super(message);
    this.name = "HttpError";
  }
}

/**
 * Build a query string from an object, skipping null/undefined
 */
export function queryString(params?: Record<string, any>): string {
  if (!params) return "";
  const entries = Object.entries(params)
    .filter(([, v]) => v != undefined && v != null)
    .map(([k, v]) => [k, String(v)]);

  return entries.length ? "?" + new URLSearchParams(entries) : "";
}

/**
 * Low-level abstracted function. Called by Http Methods helpers below
 */
export async function http<T = unknown>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(API_BASE + path, {
    // Cookie-based session from backend
    credentials: "include",
    // Default headers, potentially overriden
    headers: { Accept: "application/json", ...(init.headers || {}) },
    ...init,
  });

  // Try to parse JSON; tolerate empty bodies or non-JSON errors
  const text = await res.text();

  function textToJSON(text: string) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  const data = text ? textToJSON(text) : null;

  if (!res.ok) {
    const message = (data && typeof data === "object" && (data as any).message) || (data && typeof data === "object" && (data as any).error) || res.statusText;
    throw new HttpError(res.status, String(message || "HTTP error"), data ?? undefined);
  }
  return data as T;
}

export function getRequest<T>(path: string, params?: Record<string, any>) {
  return http<T>(path + queryString(params), { method: "GET" });
}

export function postRequest<T>(path: string, json?: any) {
  return http<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
}

export function putRequest<T>(path: string, json?: any) {
  return http<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
}

export function deleteRequest<T>(path: string) {
  return http<T>(path, { method: "DELETE" });
}

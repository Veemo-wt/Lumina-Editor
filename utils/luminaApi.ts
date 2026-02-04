/**
 * Lumina API client
 * - Shared backend for all Lumina Suite apps
 * - Auth: X-API-Key (hardcoded here) + X-Username (from localStorage)
 *
 * Configure base URL via VITE_LUMINA_API_BASE (Vite env),
 * fallback to https://api.lumina-suite.tech
 */
import { getUsername } from './username';

export const LUMINA_API_BASE =
    (import.meta as any)?.env?.VITE_LUMINA_API_BASE || "https://api.lumina-suite.tech";

export type LuminaAppName = "scanner" | "editor" | "translate" | "analyze" | "describer" | string;

/** ✅ HARDCODED API KEY */
const LUMINA_API_KEY = "sk_live_3h0a9GbmBKbsf3ydb1xAAGKrao8LlH01";

async function check(res: Response, label: string) {
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`${label} failed: ${res.status} ${txt}`);
  }
  return res;
}

/**
 * Low-level request helper that ALWAYS attaches X-API-Key + X-Username
 * and handles JSON automatically.
 */
async function request(path: string, options: RequestInit = {}) {
  const url = `${LUMINA_API_BASE}${path}`;

  const headers = new Headers(options.headers || {});

  // Set API key always
  headers.set("X-API-Key", LUMINA_API_KEY);

  // Set username from localStorage
  const username = getUsername();
  console.log('🔑 [luminaApi] getUsername():', username);
  if (username) {
    headers.set("X-Username", username);
    console.log('✅ [luminaApi] Added X-Username header:', username);
  } else {
    console.warn('⚠️ [luminaApi] No username in localStorage!');
  }

  // If body is FormData, do NOT set Content-Type manually
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;

  if (!isFormData) {
    // only for JSON/non-form requests
    if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  } else {
    // browser will set multipart boundary itself
    headers.delete("Content-Type");
  }

  const res = await fetch(url, { ...options, headers });
  return res;
}

export function luminaApi(app: LuminaAppName) {
  const base = `/api/${encodeURIComponent(app)}`;

  return {
    async me() {
      const res = await request(`/api/me`);
      await check(res, "me");
      return res.json();
    },

    async listSessions() {
      const res = await request(`${base}/sessions`);
      await check(res, "listSessions");
      return res.json();
    },

    async upsertSession(opts: { id: string; name?: string; maxSessions?: number }) {
      const res = await request(`${base}/sessions`, {
        method: "POST",
        body: JSON.stringify(opts),
      });
      await check(res, "upsertSession");
      return res.json();
    },

    async deleteSession(id: string) {
      const res = await request(`${base}/sessions/${encodeURIComponent(id)}`, {
        method: "DELETE",
      });
      await check(res, "deleteSession");
      return res.json();
    },

    async getState(id: string) {
      const res = await request(`${base}/sessions/${encodeURIComponent(id)}/state`);
      await check(res, "getState");
      return res.json();
    },

    async saveState(id: string, state: unknown) {
      const res = await request(`${base}/sessions/${encodeURIComponent(id)}/state`, {
        method: "PUT",
        body: JSON.stringify(state),
      });
      await check(res, "saveState");
      return res.json();
    },

    async uploadFile(id: string, file: File) {
      const fd = new FormData();
      fd.append("file", file);

      const res = await request(`${base}/sessions/${encodeURIComponent(id)}/files`, {
        method: "POST",
        body: fd,
      });
      await check(res, "uploadFile");
      return res.json();
    },

    async listFiles(id: string) {
      const res = await request(`${base}/sessions/${encodeURIComponent(id)}/files`);
      await check(res, "listFiles");
      return res.json();
    },
  };
}

/**
 * Lumina API client (Cloudflare Access)
 * - Single backend shared by all Lumina Suite apps.
 * - User identity is taken from Cloudflare Access headers on the server side.
 *
 * Configure base URL via VITE_LUMINA_API_BASE (Vite env), fallback to api.lumina-suite.tech.
 */
export const LUMINA_API_BASE =
  (import.meta as any)?.env?.VITE_LUMINA_API_BASE || 'https://api.lumina-suite.tech';

export type LuminaAppName = 'scanner' | 'editor' | 'translate' | 'analyze' | 'describer' | string;

const jsonHeaders = { 'Content-Type': 'application/json' };

async function check(res: Response, label: string) {
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`${label} failed: ${res.status} ${txt}`);
  }
  return res;
}

export function luminaApi(app: LuminaAppName) {
  const base = `${LUMINA_API_BASE}/api/${encodeURIComponent(app)}`;

  return {
    async me() {
      const res = await fetch(`${LUMINA_API_BASE}/api/me`);
      await check(res, 'me');
      return res.json();
    },

    async listSessions() {
      const res = await fetch(`${base}/sessions`);
      await check(res, 'listSessions');
      return res.json();
    },

    async upsertSession(opts: { id: string; name?: string; maxSessions?: number }) {
      const res = await fetch(`${base}/sessions`, {
        method: 'POST',
        headers: jsonHeaders,
        body: JSON.stringify(opts),
      });
      await check(res, 'upsertSession');
      return res.json();
    },

    async deleteSession(id: string) {
      const res = await fetch(`${base}/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await check(res, 'deleteSession');
      return res.json();
    },

    async getState(id: string) {
      const res = await fetch(`${base}/sessions/${encodeURIComponent(id)}/state`);
      await check(res, 'getState');
      return res.json();
    },

    async saveState(id: string, state: unknown) {
      const res = await fetch(`${base}/sessions/${encodeURIComponent(id)}/state`, {
        method: 'PUT',
        headers: jsonHeaders,
        body: JSON.stringify(state),
      });
      await check(res, 'saveState');
      return res.json();
    },

    async uploadFile(id: string, file: File) {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${base}/sessions/${encodeURIComponent(id)}/files`, {
        method: 'POST',
        body: fd,
      });
      await check(res, 'uploadFile');
      return res.json();
    },

    async listFiles(id: string) {
      const res = await fetch(`${base}/sessions/${encodeURIComponent(id)}/files`);
      await check(res, 'listFiles');
      return res.json();
    },
  };
}

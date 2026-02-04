/**
 * Session Manager (server-side)
 * - Sessions live on the Lumina backend (shared across all Lumina Suite apps).
 * - User identity is resolved server-side from Cloudflare Access headers.
 */

import { luminaApi } from './luminaApi';

export interface SessionMeta {
  id: string;
  createdAt: number;
  lastUsedAt: number;
  name?: string;
  fileName?: string;
  totalChunks?: number;
  completedChunks?: number;
}

const api = luminaApi('editor');
const MAX_SESSIONS = 100;

/**
 * Pobiera listę wszystkich sesji (z backendu)
 */
export async function getSessions(): Promise<SessionMeta[]> {
  try {
    const sessions = await api.listSessions();
    return Array.isArray(sessions) ? sessions : [];
  } catch (e) {
    console.error('Failed to load sessions list', e);
    return [];
  }
}

/**
 * Rejestruje/aktualizuje sesję na backendzie
 */
export async function registerSession(sessionId: string, metadata?: Partial<SessionMeta>): Promise<void> {
  try {
    await api.upsertSession({
      id: sessionId,
      name: metadata?.name || metadata?.fileName,
      maxSessions: MAX_SESSIONS,
    });
  } catch (e) {
    console.error('Failed to register session', e);
  }
}

/**
 * Usuwa sesję (metadata + dane) na backendzie
 */
export async function deleteSession(sessionId: string): Promise<void> {
  try {
    await api.deleteSession(sessionId);
  } catch (e) {
    console.error('Failed to delete session', e);
  }
}

/**
 * Generuje nowy unikalny ID sesji
 */
export function generateSessionId(): string {
  return Math.random().toString(36).substring(2, 11);
}

/**
 * Pobiera informacje o sesji (z backendu)
 */
export async function getSessionInfo(sessionId: string): Promise<SessionMeta | null> {
  const sessions = await getSessions();
  return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Aktualizuje nazwę sesji
 */
export async function updateSessionName(sessionId: string, name: string): Promise<void> {
  try {
    await api.upsertSession({ id: sessionId, name: name.trim(), maxSessions: MAX_SESSIONS });
  } catch (e) {
    console.error('Failed to update session name', e);
  }
}

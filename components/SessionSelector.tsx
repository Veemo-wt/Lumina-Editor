import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Trash2, FileText, CheckCircle2, Edit2, Check, X, User, Settings, LogOut } from 'lucide-react';
import { getSessions, deleteSession, generateSessionId, updateSessionName, type SessionMeta } from '../utils/sessionManager';
import { getUsername, setUsername, clearUsername } from '../utils/username';

interface SessionSelectorProps {
  onClose: () => void;
  currentSessionId?: string;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({ onClose, currentSessionId }) => {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [currentUsername, setCurrentUsername] = useState(getUsername() || '');
  const [isEditingUsername, setIsEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState(getUsername() || '');
  const navigate = useNavigate();

  useEffect(() => {
    const loadInitialSessions = async () => {
      const allSessions = await getSessions();
      setSessions(allSessions);
    };
    void loadInitialSessions();
  }, []);

  const loadSessions = async () => {
    const allSessions = await getSessions();
    setSessions(allSessions);
  };

  const handleNewSession = () => {
    const newId = generateSessionId();
    navigate(`/${newId}`);
    onClose();
  };

  const handleSelectSession = (sessionId: string) => {
    navigate(`/${sessionId}`);
    onClose();
  };

  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Czy na pewno chcesz usunąć tę sesję?')) {
      await deleteSession(sessionId);
      await loadSessions();

      if (sessionId === currentSessionId) {
        const newId = generateSessionId();
        navigate(`/${newId}`);
        onClose();
      }
    }
  };

  const handleStartEdit = (session: SessionMeta, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(session.id);
    setEditingName(session.name || session.fileName || `Sesja ${session.id.substring(0, 6)}`);
  };

  const handleSaveEdit = async (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (editingName.trim()) {
      await updateSessionName(sessionId, editingName.trim());
      await loadSessions();
    }
    setEditingId(null);
    setEditingName('');
  };

  const handleCancelEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
    setEditingName('');
  };

  const handleKeyDown = async (e: React.KeyboardEvent, sessionId: string) => {
    if (e.key === 'Enter') {
      e.stopPropagation();
      if (editingName.trim()) {
        await updateSessionName(sessionId, editingName.trim());
        await loadSessions();
      }
      setEditingId(null);
      setEditingName('');
    } else if (e.key === 'Escape') {
      e.stopPropagation();
      setEditingId(null);
      setEditingName('');
    }
  };

  const handleSaveUsername = () => {
    const trimmed = usernameInput.trim();
    if (trimmed.length >= 2) {
      setUsername(trimmed);
      setCurrentUsername(trimmed);
      setIsEditingUsername(false);
    }
  };

  const handleCancelUsernameEdit = () => {
    setUsernameInput(currentUsername);
    setIsEditingUsername(false);
  };

  const handleUsernameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveUsername();
    } else if (e.key === 'Escape') {
      handleCancelUsernameEdit();
    }
  };

  const handleLogout = () => {
    if (confirm('Czy na pewno chcesz się wylogować? Zostaniesz poproszony o podanie nowej nazwy użytkownika.')) {
      clearUsername();
      onClose();
      window.location.reload();
    }
  };

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (hours < 1) return 'Przed chwilą';
    if (hours < 24) return `${hours}h temu`;
    if (days < 7) return `${days}d temu`;

    return date.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
  };

  const getProgress = (session: SessionMeta) => {
    if (!session.totalChunks || session.totalChunks === 0) return 0;
    return Math.round(((session.completedChunks || 0) / session.totalChunks) * 100);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-md">
      <div className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-gray-200/80 bg-white/95 shadow-[0_35px_100px_-45px_rgba(15,23,42,0.65)] dark:border-gray-800 dark:bg-gray-950/95">
        <div className="flex-shrink-0 border-b border-brand-500/30 bg-gradient-to-r from-brand-600 via-brand-600 to-brand-700 p-6">
          <h2 className="text-2xl font-serif font-bold text-white">Sesje edycji</h2>
          <p className="mt-1 text-sm text-brand-100/95">{sessions.length} zapisanych sesji</p>
        </div>

        <div className="flex-shrink-0 border-b border-gray-200/80 bg-gray-50/75 p-4 dark:border-gray-800 dark:bg-gray-900/70">
          <button
            onClick={handleNewSession}
            className="flex w-full items-center gap-3 rounded-2xl border border-dashed border-brand-300 bg-brand-50/90 p-4 text-brand-700 transition-all hover:border-brand-400 hover:bg-brand-100 dark:border-brand-700 dark:bg-brand-900/20 dark:text-brand-300 dark:hover:border-brand-600 dark:hover:bg-brand-900/30"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 shadow-sm">
              <Plus size={20} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold">Nowa sesja</div>
              <div className="text-sm opacity-80">Rozpocznij nową edycję</div>
            </div>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto bg-white/70 dark:bg-gray-950/60">
          <div className="p-4">
            {sessions.length === 0 ? (
              <div className="py-12 text-center text-gray-500 dark:text-gray-400">
                <FileText size={48} className="mx-auto mb-4 opacity-30" />
                <p>Brak zapisanych sesji</p>
                <p className="mt-2 text-sm">Kliknij "Nowa sesja" aby rozpocząć</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessions.map((session) => {
                  const isActive = session.id === currentSessionId;
                  const progress = getProgress(session);

                  return (
                    <div
                      key={session.id}
                      onClick={() => handleSelectSession(session.id)}
                      className={`group relative flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition-all ${
                        isActive
                          ? 'border-brand-500/70 bg-brand-50/80 shadow-[0_10px_30px_-20px_rgba(59,130,246,0.45)] dark:border-brand-700 dark:bg-brand-900/20'
                          : 'border-gray-200/80 bg-white/95 hover:border-gray-300 hover:bg-white dark:border-gray-800 dark:bg-gray-900/85 dark:hover:border-gray-700'
                      }`}
                    >
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl border ${
                          isActive
                            ? 'border-brand-500 bg-brand-600'
                            : 'border-gray-200 bg-gray-100 dark:border-gray-700 dark:bg-gray-800'
                        }`}
                      >
                        <FileText size={24} className={isActive ? 'text-white' : 'text-gray-600 dark:text-gray-300'} />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex items-center gap-2">
                          {editingId === session.id ? (
                            <div className="flex flex-1 items-center gap-2">
                              <input
                                type="text"
                                value={editingName}
                                onChange={(e) => setEditingName(e.target.value)}
                                onKeyDown={(e) => handleKeyDown(e, session.id)}
                                onClick={(e) => e.stopPropagation()}
                                className="flex-1 rounded-lg border border-brand-300 bg-white px-2 py-1 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-600 dark:bg-gray-800 dark:text-gray-100"
                                placeholder="Nazwa sesji..."
                                autoFocus
                              />
                              <button
                                onClick={(e) => handleSaveEdit(session.id, e)}
                                className="rounded p-1 text-green-600 transition-colors hover:bg-green-50 dark:hover:bg-green-900/20"
                                title="Zapisz"
                              >
                                <Check size={16} />
                              </button>
                              <button
                                onClick={handleCancelEdit}
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                                title="Anuluj"
                              >
                                <X size={16} />
                              </button>
                            </div>
                          ) : (
                            <>
                              <h3 className="truncate font-semibold text-gray-800 dark:text-gray-100">
                                {session.name || session.fileName || `Sesja ${session.id.substring(0, 6)}`}
                              </h3>
                              <button
                                onClick={(e) => handleStartEdit(session, e)}
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20"
                                title="Zmień nazwę"
                              >
                                <Edit2 size={14} />
                              </button>
                              {isActive && (
                                <span className="rounded-full bg-brand-600 px-2 py-0.5 text-xs font-medium text-white">Aktywna</span>
                              )}
                            </>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <span className="flex items-center gap-1">
                            <Clock size={14} />
                            {formatDate(session.lastUsedAt)}
                          </span>

                          {session.totalChunks && session.totalChunks > 0 && (
                            <>
                              <span className="flex items-center gap-1">
                                <CheckCircle2 size={14} />
                                {session.completedChunks || 0} / {session.totalChunks}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="h-1.5 overflow-hidden rounded-full bg-gray-200 dark:bg-gray-700">
                                  <div
                                    className="h-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all"
                                    style={{ width: `${progress}%` }}
                                  />
                                </div>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(session.id, e)}
                        className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20"
                        title="Usuń sesję"
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-gray-200/80 bg-gray-50/80 p-4 dark:border-gray-800 dark:bg-gray-900/70">
            <div className="mb-3 flex items-center gap-3">
              <Settings size={18} className="text-brand-600 dark:text-brand-400" />
              <h3 className="font-semibold text-gray-800 dark:text-gray-200">Ustawienia</h3>
            </div>

            <div className="space-y-2">
              <label className="text-sm text-gray-600 dark:text-gray-400">Nazwa użytkownika</label>
              {isEditingUsername ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={(e) => setUsernameInput(e.target.value)}
                    onKeyDown={handleUsernameKeyDown}
                    className="flex-1 rounded-lg border border-brand-300 bg-white px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-600 dark:bg-gray-700 dark:text-gray-100"
                    placeholder="Wpisz nazwę użytkownika..."
                    autoFocus
                  />
                  <button
                    onClick={handleSaveUsername}
                    className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 dark:hover:bg-green-900/20"
                    title="Zapisz"
                  >
                    <Check size={18} />
                  </button>
                  <button
                    onClick={handleCancelUsernameEdit}
                    className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                    title="Anuluj"
                  >
                    <X size={18} />
                  </button>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3 dark:border-gray-700 dark:bg-gray-800/70">
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
                    <User size={16} className="text-brand-600 dark:text-brand-300" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-gray-800 dark:text-gray-200">{currentUsername || 'Nie ustawiono'}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">Identyfikator sesji</div>
                  </div>
                  <button
                    onClick={() => {
                      setIsEditingUsername(true);
                      setUsernameInput(currentUsername);
                    }}
                    className="rounded p-1.5 text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20"
                    title="Edytuj nazwę"
                  >
                    <Edit2 size={14} />
                  </button>
                </div>
              )}

              <button
                onClick={handleLogout}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-red-600 transition-colors hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
              >
                <LogOut size={16} />
                <span className="font-medium">Wyloguj się</span>
              </button>
            </div>
          </div>
        </div>

        <div className="flex-shrink-0 border-t border-gray-200/80 bg-white/95 p-4 dark:border-gray-800 dark:bg-gray-950/95">
          <button
            onClick={onClose}
            className="w-full rounded-xl bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};

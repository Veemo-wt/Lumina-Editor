import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Clock, Trash2, FileText, CheckCircle2, Edit2, Check, X } from 'lucide-react';
import { getSessions, deleteSession, generateSessionId, updateSessionName, type SessionMeta } from '../utils/sessionManager';

interface SessionSelectorProps {
  onClose: () => void;
  currentSessionId?: string;
}

export const SessionSelector: React.FC<SessionSelectorProps> = ({ onClose, currentSessionId }) => {
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadSessions();
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

      // Jeśli usunięto aktywną sesję, przekieruj do nowej
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
    return Math.round((session.completedChunks || 0) / session.totalChunks * 100);
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden border border-gray-200 dark:border-gray-800">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-600 to-brand-700 p-6">
          <h2 className="text-2xl font-serif font-bold text-white">Sesje skanowania</h2>
          <p className="text-brand-100 text-sm mt-1">
            {sessions.length} / 10 aktywnych sesji
          </p>
        </div>

        {/* New Session Button */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <button
            onClick={handleNewSession}
            className="w-full flex items-center gap-3 p-4 bg-brand-50 dark:bg-brand-900/20 border-2 border-dashed border-brand-300 dark:border-brand-700 rounded-xl hover:bg-brand-100 dark:hover:bg-brand-900/30 transition-colors text-brand-700 dark:text-brand-300"
          >
            <div className="w-10 h-10 rounded-full bg-brand-600 flex items-center justify-center">
              <Plus size={20} className="text-white" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-semibold">Nowa sesja</div>
              <div className="text-sm opacity-75">Rozpocznij nowe skanowanie</div>
            </div>
          </button>
        </div>

        {/* Sessions List */}
        <div className="overflow-y-auto max-h-[50vh] p-4">
          {sessions.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <FileText size={48} className="mx-auto mb-4 opacity-30" />
              <p>Brak zapisanych sesji</p>
              <p className="text-sm mt-2">Kliknij "Nowa sesja" aby rozpocząć</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sessions.map((session) => {
                const isActive = session.id === currentSessionId;
                const progress = getProgress(session);

                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    className={`relative flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      isActive
                        ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                        : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 bg-white dark:bg-gray-800'
                    }`}
                  >
                    {/* Icon */}
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      isActive
                        ? 'bg-brand-600'
                        : 'bg-gray-100 dark:bg-gray-700'
                    }`}>
                      <FileText size={24} className={isActive ? 'text-white' : 'text-gray-600 dark:text-gray-300'} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {editingId === session.id ? (
                          <div className="flex items-center gap-2 flex-1">
                            <input
                              type="text"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onKeyDown={(e) => handleKeyDown(e, session.id)}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 text-sm border border-brand-300 dark:border-brand-600 rounded bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-brand-500"
                              placeholder="Nazwa sesji..."
                              autoFocus
                            />
                            <button
                              onClick={(e) => handleSaveEdit(session.id, e)}
                              className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                              title="Zapisz"
                            >
                              <Check size={16} />
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded"
                              title="Anuluj"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <h3 className="font-semibold text-gray-800 dark:text-gray-100 truncate">
                              {session.name || session.fileName || `Sesja ${session.id.substring(0, 6)}`}
                            </h3>
                            <button
                              onClick={(e) => handleStartEdit(session, e)}
                              className="p-1 text-gray-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded transition-colors"
                              title="Zmień nazwę"
                            >
                              <Edit2 size={14} />
                            </button>
                            {isActive && (
                              <span className="px-2 py-0.5 bg-brand-600 text-white text-xs font-medium rounded-full">
                                Aktywna
                              </span>
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
                            <div className="flex-1 min-w-0">
                              <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                                <div
                                  className="h-full bg-brand-600 transition-all"
                                  style={{ width: `${progress}%` }}
                                />
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Delete Button */}
                    <button
                      onClick={(e) => handleDeleteSession(session.id, e)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
          >
            Zamknij
          </button>
        </div>
      </div>
    </div>
  );
};

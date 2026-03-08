import React, { useState, useEffect, useRef } from 'react';
import {
  Download, Loader2, Trash2, Sun, Moon, CheckCircle, XCircle, Clock, ChevronDown,
  FileCheck, FileText, MessageCircle, Share2, FolderOpen, Edit2, Check, X
} from 'lucide-react';
import { AppStage, ChunkData } from '../types';
import { LuminaScanFile } from '../utils/storage';
import FeedbackModal from './FeedbackModal';

interface ExportDropdownProps {
  isExporting: boolean;
  onExport: () => void;
  onExportOriginal: () => void;
  onExportLSF: () => void;
}

const ExportDropdown: React.FC<ExportDropdownProps> = ({ isExporting, onExport, onExportOriginal, onExportLSF }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleExport = () => {
    setIsOpen(false);
    onExport();
  };

  const handleExportOriginal = () => {
    setIsOpen(false);
    onExportOriginal();
  };

  const handleExportLSF = () => {
    setIsOpen(false);
    onExportLSF();
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Eksportuj
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !isExporting && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[250px] rounded-xl border border-gray-200/90 bg-white/95 p-1.5 shadow-[0_20px_55px_-35px_rgba(15,23,42,0.8)] dark:border-gray-700 dark:bg-gray-900/95">
          <button
            onClick={handleExport}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FileCheck size={16} className="text-emerald-500" />
            <div>
              <div className="font-medium">Eksportuj DOCX</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Z zatwierdzonymi poprawkami</div>
            </div>
          </button>

          <button
            onClick={handleExportOriginal}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <FileText size={16} className="text-blue-500" />
            <div>
              <div className="font-medium">Eksportuj oryginał</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">DOCX bez poprawek</div>
            </div>
          </button>

          <div className="my-1 border-t border-gray-200 dark:border-gray-700"></div>

          <button
            onClick={handleExportLSF}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-800"
          >
            <Share2 size={16} className="text-indigo-500" />
            <div>
              <div className="font-medium">Eksportuj sesję LSF</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Aby wrócić do edycji później</div>
            </div>
          </button>
        </div>
      )}
    </div>
  );
};

interface HeaderProps {
  stage: AppStage;
  fileName: string;
  sessionId?: string;
  sessionName?: string;
  sessionUsage?: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
  estimatedTimeRemaining?: string;
  metadata: LuminaScanFile['metadata'] | null;
  isExporting: boolean;
  chunks: ChunkData[];
  config: any;
  onReset: () => void;
  onExport: () => void;
  onExportOriginal: () => void;
  onExportLSF: () => void;
  onOpenSessions?: () => void;
  onUpdateSessionName?: (name: string) => void;
}

const Header: React.FC<HeaderProps> = ({
  stage,
  fileName,
  sessionId,
  sessionName,
  sessionUsage: _sessionUsage,
  estimatedTimeRemaining: _estimatedTimeRemaining,
  metadata,
  isExporting,
  chunks,
  config,
  onReset,
  onExport,
  onExportOriginal,
  onExportLSF,
  onOpenSessions,
  onUpdateSessionName
}) => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark') return true;
      if (saved === 'light') return false;
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });

  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState('');
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  const getSessionData = (): LuminaScanFile | null => {
    if (!chunks || chunks.length === 0) return null;

    let totalMistakes = 0;
    let approvedMistakes = 0;
    let rejectedMistakes = 0;
    let pendingMistakes = 0;
    let completedChunks = 0;

    chunks.forEach((chunk) => {
      if (chunk.status === 'completed') completedChunks++;
      (chunk.mistakes || []).forEach((m: any) => {
        totalMistakes++;
        if (m.status === 'approved') approvedMistakes++;
        else if (m.status === 'rejected') rejectedMistakes++;
        else pendingMistakes++;
      });
    });

    return {
      version: '1.0',
      exportDate: new Date().toISOString(),
      fileName,
      chunks,
      config: {
        scanOptions: config.scanOptions,
        glossary: config.glossary || [],
        characterBible: config.characterBible || [],
        chunkSize: config.chunkSize,
        lookbackSize: config.lookbackSize,
        chapterPattern: config.chapterPattern
      },
      metadata: {
        totalMistakes,
        approvedMistakes,
        rejectedMistakes,
        pendingMistakes,
        totalChunks: chunks.length,
        completedChunks
      }
    };
  };

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [isDark]);

  const handleStartEditName = () => {
    setEditName(sessionName || fileName || `Sesja ${sessionId?.substring(0, 6) || ''}`);
    setIsEditingName(true);
  };

  const handleSaveEditName = () => {
    if (editName.trim() && onUpdateSessionName) {
      onUpdateSessionName(editName.trim());
    }
    setIsEditingName(false);
  };

  const handleCancelEditName = () => {
    setIsEditingName(false);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveEditName();
    } else if (e.key === 'Escape') {
      handleCancelEditName();
    }
  };

  const iconButtonClass =
    'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/80 bg-white/70 text-gray-500 transition-all duration-150 hover:border-gray-300 hover:bg-white hover:text-gray-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-100 dark:focus-visible:ring-offset-gray-950';

  return (
    <header className="z-30 w-full flex-shrink-0 border-b border-gray-200/80 bg-white/90 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.55)] backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-200/80 bg-gradient-to-b from-brand-100 to-brand-200 font-serif font-bold text-brand-700 shadow-sm dark:border-brand-700/50 dark:from-brand-900/40 dark:to-brand-900/10 dark:text-brand-300">
            L
          </div>

          <div className="min-w-0">
            {isEditingName ? (
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="rounded-lg border border-brand-300 bg-white px-2 py-0.5 text-sm font-serif font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-brand-500 dark:border-brand-600 dark:bg-gray-800 dark:text-gray-100"
                  placeholder="Nazwa sesji..."
                  autoFocus
                />
                <button
                  onClick={handleSaveEditName}
                  className="rounded p-1 text-green-600 transition-colors hover:bg-green-50 dark:hover:bg-green-900/20"
                  title="Zapisz"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={handleCancelEditName}
                  className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                  title="Anuluj"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <h1 className="truncate font-serif text-[17px] font-bold leading-tight text-gray-800 dark:text-gray-100">
                  {sessionName || 'Lumina Editor'}
                </h1>
                {onUpdateSessionName && sessionId && (
                  <button
                    onClick={handleStartEditName}
                    className="rounded p-1 text-gray-400 transition-colors hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-900/20"
                    title="Zmień nazwę sesji"
                  >
                    <Edit2 size={12} />
                  </button>
                )}
              </div>
            )}
            {fileName && (
              <p
                className="mt-0.5 max-w-[220px] truncate rounded bg-gray-100 px-1.5 py-0.5 font-mono text-[10px] text-gray-500 dark:bg-gray-900 dark:text-gray-400"
                title={fileName}
              >
                {fileName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5 md:gap-4">
          {stage !== 'upload' && metadata && (
            <div className="hidden items-center gap-2 rounded-xl border border-gray-200 bg-gray-50/90 p-1.5 dark:border-gray-700 dark:bg-gray-900/80 xl:flex">
              <div
                className="flex items-center gap-1.5 rounded-lg border border-amber-200/70 bg-amber-50 px-2.5 py-1 font-mono text-[11px] font-bold text-amber-700 dark:border-amber-900/60 dark:bg-amber-900/30 dark:text-amber-300"
                title="Oczekujące poprawki"
              >
                <Clock size={13} />
                {metadata.pendingMistakes}
              </div>
              <div
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200/70 bg-emerald-50 px-2.5 py-1 font-mono text-[11px] font-medium text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-900/20 dark:text-emerald-300"
                title="Zatwierdzone poprawki"
              >
                <CheckCircle size={13} />
                {metadata.approvedMistakes}
              </div>
              <div
                className="flex items-center gap-1.5 rounded-lg border border-gray-200/90 bg-white px-2.5 py-1 font-mono text-[11px] font-medium text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                title="Odrzucone poprawki"
              >
                <XCircle size={13} />
                {metadata.rejectedMistakes}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            {onOpenSessions && (
              <button
                onClick={onOpenSessions}
                className={iconButtonClass}
                title="Zarządzaj sesjami"
              >
                <FolderOpen size={17} />
              </button>
            )}
            <button
              onClick={() => setIsFeedbackOpen(true)}
              className={iconButtonClass}
              title="Zgłoś sugestię lub błąd"
            >
              <MessageCircle size={17} />
            </button>
            <button
              onClick={() => setIsDark(!isDark)}
              className={iconButtonClass}
              title={isDark ? 'Tryb jasny' : 'Tryb ciemny'}
            >
              {isDark ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            {stage !== 'upload' && (
              <button
                onClick={onReset}
                className={`${iconButtonClass} hover:text-red-500 dark:hover:text-red-400`}
                title="Zamknij projekt"
              >
                <Trash2 size={17} />
              </button>
            )}
            {stage === 'review' && (
              <ExportDropdown
                isExporting={isExporting}
                onExport={onExport}
                onExportOriginal={onExportOriginal}
                onExportLSF={onExportLSF}
              />
            )}
          </div>
        </div>
      </div>

      <FeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        currentFile={fileName}
        getSessionData={getSessionData}
      />
    </header>
  );
};

export default Header;

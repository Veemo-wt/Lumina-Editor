import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, Trash2, Sun, Moon, CheckCircle, XCircle, Clock, ChevronDown, FileCheck, FileText, MessageCircle, Share2, FolderOpen } from 'lucide-react';
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
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
      >
        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Eksportuj
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !isExporting && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[220px] z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={handleExport}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            <FileCheck size={16} className="text-emerald-500" />
            <div>
              <div className="font-medium">Eksportuj DOCX</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Z zatwierdzonymi poprawkami</div>
            </div>
          </button>
          <button
            onClick={handleExportOriginal}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            <FileText size={16} className="text-blue-500" />
            <div>
              <div className="font-medium">Eksportuj oryginał</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">DOCX bez poprawek</div>
            </div>
          </button>
          <div className="border-t border-gray-200 dark:border-gray-700 my-1"></div>
          <button
            onClick={handleExportLSF}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            <Share2 size={16} className="text-purple-500" />
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
  sessionUsage,
  estimatedTimeRemaining,
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
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);

  // Funkcja do generowania eksportu LSF dla feedbacku
  const getSessionData = (): LuminaScanFile | null => {
    if (!chunks || chunks.length === 0) return null;

    // Oblicz statystyki
    let totalMistakes = 0;
    let approvedMistakes = 0;
    let rejectedMistakes = 0;
    let pendingMistakes = 0;
    let completedChunks = 0;

    chunks.forEach(chunk => {
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

  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shadow-sm z-30 flex-shrink-0 w-full relative">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-serif font-bold">L</div>
        <div>
          <h1 className="font-serif font-bold text-gray-800 dark:text-gray-100">Lumina Editor</h1>
          {fileName && <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate max-w-[150px]">{fileName}</p>}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {stage !== 'upload' && metadata && (
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 px-4 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 font-mono font-bold text-sm" title="Oczekujące poprawki">
              <Clock size={14} />
              {metadata.pendingMistakes}
            </div>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono text-xs" title="Zatwierdzone poprawki">
              <CheckCircle size={14} />
              {metadata.approvedMistakes}
            </div>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-mono text-xs" title="Odrzucone poprawki">
              <XCircle size={14} />
              {metadata.rejectedMistakes}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          {onOpenSessions && (
            <button
              onClick={onOpenSessions}
              className="p-2 text-gray-400 hover:text-brand-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Zarządzaj sesjami"
            >
              <FolderOpen size={18} />
            </button>
          )}
          <button
            onClick={() => setIsFeedbackOpen(true)}
            className="p-2 text-gray-400 hover:text-brand-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title="Zgłoś sugestię lub błąd"
          >
            <MessageCircle size={18} />
          </button>
          <button
            onClick={() => setIsDark(!isDark)}
            className="p-2 text-gray-400 hover:text-brand-500 transition-colors rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
            title={isDark ? 'Tryb jasny' : 'Tryb ciemny'}
          >
            {isDark ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          {stage !== 'upload' && (
            <button onClick={onReset} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Zamknij projekt">
              <Trash2 size={18} />
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





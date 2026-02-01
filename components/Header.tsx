import React, { useState, useEffect } from 'react';
import { Download, Loader2, Trash2, Sun, Moon, CheckCircle, XCircle, Clock } from 'lucide-react';
import { AppStage } from '../types';
import { LuminaScanFile } from '../utils/storage';

interface HeaderProps {
  stage: AppStage;
  fileName: string;
  metadata: LuminaScanFile['metadata'] | null;
  isExporting: boolean;
  onReset: () => void;
  onExport: () => void;
}

const Header: React.FC<HeaderProps> = ({
  stage,
  fileName,
  metadata,
  isExporting,
  onReset,
  onExport
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
            <button
              onClick={onExport}
              disabled={isExporting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
            >
              {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
              Eksportuj DOCX
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;





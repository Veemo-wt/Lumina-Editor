import React, { useState, useEffect, useRef } from 'react';
import { Download, Loader2, Clock, Trash2, DollarSign, Cpu, Sun, Moon, ChevronDown, FileText, FileCheck } from 'lucide-react';
import { AppStage } from '../types';

interface ExportDropdownProps {
  isExporting: boolean;
  onExport: () => void;
  onExportOriginal: () => void;
}

const ExportDropdown: React.FC<ExportDropdownProps> = ({ isExporting, onExport, onExportOriginal }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all"
      >
        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
        Eksportuj DOCX
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && !isExporting && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-1 min-w-[200px] z-50 animate-in fade-in slide-in-from-top-2 duration-150">
          <button
            onClick={handleExport}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            <FileCheck size={16} className="text-emerald-500" />
            <div>
              <div className="font-medium">Poprawiony tekst</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Z zatwierdzonymi poprawkami</div>
            </div>
          </button>
          <button
            onClick={handleExportOriginal}
            className="w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 transition-colors"
          >
            <FileText size={16} className="text-blue-500" />
            <div>
              <div className="font-medium">Oryginalny tekst</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Bez żadnych zmian</div>
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
  sessionUsage: {
    promptTokens: number;
    completionTokens: number;
    totalCost: number;
  };
  estimatedTimeRemaining: string;
  isExporting: boolean;
  onReset: () => void;
  onExport: () => void;
  onExportOriginal: () => void;
}

const Header: React.FC<HeaderProps> = ({
  stage,
  fileName,
  sessionUsage,
  estimatedTimeRemaining,
  isExporting,
  onReset,
  onExport,
  onExportOriginal
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
          <h1 className="font-serif font-bold text-gray-800 dark:text-gray-100">Lumina Scanner</h1>
          {fileName && <p className="text-[10px] text-gray-400 dark:text-gray-500 font-mono truncate max-w-[150px]">{fileName}</p>}
        </div>
      </div>

      <div className="flex items-center gap-6">
        {stage !== 'upload' && (
          <div className="flex items-center gap-4 bg-gray-50 dark:bg-gray-800 px-4 py-1.5 rounded-full border border-gray-100 dark:border-gray-700">
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-mono font-bold text-sm" title="Aktualny koszt sesji (na podstawie tokenów)">
              <DollarSign size={14} />
              {sessionUsage.totalCost.toFixed(3)}
            </div>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="flex items-center gap-1.5 text-blue-600 dark:text-blue-400 font-mono text-xs" title="Łączna liczba tokenów (Prompt + Completion)">
              <Cpu size={14} />
              {((sessionUsage.promptTokens + sessionUsage.completionTokens) / 1000).toFixed(1)}k
            </div>
            <div className="h-4 w-px bg-gray-200 dark:bg-gray-700"></div>
            <div className="flex items-center gap-1.5 text-gray-500 dark:text-gray-400 font-mono text-xs" title="Pozostały czas (estymacja)">
              <Clock size={14} />
              {estimatedTimeRemaining}
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
            <button onClick={onReset} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Zresetuj projekt">
              <Trash2 size={18} />
            </button>
          )}
          {stage === 'review' && (
            <ExportDropdown
              isExporting={isExporting}
              onExport={onExport}
              onExportOriginal={onExportOriginal}
            />
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;
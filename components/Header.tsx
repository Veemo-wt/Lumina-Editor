import React from 'react';
import { Download, Loader2, Clock, Trash2, DollarSign, Cpu } from 'lucide-react';
import { AppStage } from '../types';

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
}

const Header: React.FC<HeaderProps> = ({
  stage,
  fileName,
  sessionUsage,
  estimatedTimeRemaining,
  isExporting,
  onReset,
  onExport
}) => {
  return (
    <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shadow-sm z-10 flex-shrink-0">
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
          {stage !== 'upload' && (
            <button onClick={onReset} className="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Zresetuj projekt">
              <Trash2 size={18} />
            </button>
          )}
          {stage === 'review' && (
            <button onClick={onExport} disabled={isExporting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all">
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
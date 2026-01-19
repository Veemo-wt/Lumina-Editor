import React, { useEffect, useRef } from 'react';
import { Play, Pause, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';
import { ChunkData, AppStage } from '../types';

interface TranslationViewProps {
  chunks: ChunkData[];
  currentChunkIdx: number;
  isProcessing: boolean;
  processingError: string | null;
  stage: AppStage;
  onToggleProcessing: () => void;
}

const TranslationView: React.FC<TranslationViewProps> = ({
  chunks,
  currentChunkIdx,
  isProcessing,
  processingError,
  stage,
  onToggleProcessing
}) => {
  const activeChunkRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to active chunk
  useEffect(() => {
    if (activeChunkRef.current) {
      activeChunkRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentChunkIdx]);

  const progressPercent = Math.round((currentChunkIdx / Math.max(chunks.length, 1)) * 100);

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      {/* Global Progress */}
      <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800 sticky top-4 z-20">
         <div className="flex justify-between items-end mb-2">
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Postęp Tłumaczenia</h3>
              <div className="text-2xl font-serif font-bold text-gray-800 dark:text-gray-100">{progressPercent}% <span className="text-xs font-sans text-gray-400 font-normal">({currentChunkIdx} / {chunks.length} segmentów)</span></div>
            </div>
            <div className="flex gap-2">
               {stage === 'processing' && (
                 <button onClick={onToggleProcessing} className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all ${isProcessing ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-brand-600 text-white hover:bg-brand-700'}`}>
                   {isProcessing ? <><Pause size={16} fill="currentColor"/> Wstrzymaj</> : <><Play size={16} fill="currentColor"/> Wznów</>}
                 </button>
               )}
            </div>
         </div>
         <div className="w-full h-3 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
            <div className="h-full bg-brand-600 transition-all duration-700 ease-out" style={{ width: `${progressPercent}%` }}></div>
         </div>
         {processingError && (
           <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-center gap-3 text-red-600 text-sm">
              <AlertTriangle size={16} />
              {processingError}
           </div>
         )}
      </div>

      {/* Chunk Stream */}
      <div className="space-y-6 pb-20">
        {chunks.map((chunk, idx) => (
          <div 
            key={chunk.id} 
            ref={idx === currentChunkIdx ? activeChunkRef : null}
            className={`grid grid-cols-1 lg:grid-cols-2 gap-4 transition-all duration-300 ${chunk.status === 'processing' ? 'scale-[1.01] opacity-100' : 'opacity-80 hover:opacity-100'}`}
          >
            {/* Source */}
            <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1 h-full bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">{chunk.sourceFileName || 'Oryginał'}</span>
                <span className="text-[10px] font-mono text-gray-300">#{idx + 1}</span>
              </div>
              <div className="font-serif text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap text-sm">
                {chunk.originalText}
              </div>
            </div>

            {/* Translation */}
            <div className={`bg-white dark:bg-gray-900 p-6 rounded-2xl border shadow-sm relative min-h-[200px] transition-colors ${chunk.status === 'completed' ? 'border-emerald-100 dark:border-emerald-900/30' : chunk.status === 'error' ? 'border-red-100' : 'border-gray-100 dark:border-gray-800'}`}>
              {chunk.status === 'completed' && <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500"></div>}
              {chunk.status === 'processing' && <div className="absolute top-0 left-0 w-1 h-full bg-brand-500 animate-pulse"></div>}
              
              <div className="flex justify-between items-start mb-4">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter bg-gray-50 dark:bg-gray-800 px-2 py-1 rounded">Tłumaczenie PL</span>
                <div className="flex items-center gap-2">
                   {chunk.status === 'completed' && <CheckCircle2 size={16} className="text-emerald-500" />}
                   {chunk.status === 'processing' && <Loader2 size={16} className="text-brand-600 animate-spin" />}
                   {chunk.status === 'error' && <AlertTriangle size={16} className="text-red-500" />}
                </div>
              </div>

              {chunk.translatedText ? (
                <div className="font-serif text-gray-800 dark:text-gray-100 leading-relaxed whitespace-pre-wrap text-sm animate-in fade-in slide-in-from-bottom-2 duration-700">
                  {chunk.translatedText}
                </div>
              ) : (
                <div className="h-32 flex flex-col items-center justify-center text-gray-300 dark:text-gray-700 italic text-sm">
                   {chunk.status === 'processing' ? 'Pióro w ruchu...' : 'Oczekiwanie w kolejce...'}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TranslationView;
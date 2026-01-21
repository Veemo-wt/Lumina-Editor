import React, { useState, useMemo, useRef, useEffect } from 'react';
import { Play, Pause, AlertTriangle, CheckCircle2, Loader2, X, Check, ChevronLeft, ChevronRight } from 'lucide-react';
import { ChunkData, Mistake, AppStage } from '../types';

interface ScannerViewProps {
  chunks: ChunkData[];
  currentChunkIdx: number;
  isProcessing: boolean;
  processingError: string | null;
  stage: AppStage;
  onToggleProcessing: () => void;
  onApproveMistake: (mistakeId: string) => void;
  onRejectMistake: (mistakeId: string) => void;
  onApproveAll: () => void;
  onRejectAll: () => void;
}

const CATEGORY_LABELS: Record<Mistake['category'], string> = {
  grammar: 'Gramatyka',
  orthography: 'Ortografia',
  punctuation: 'Interpunkcja',
  style: 'Styl',
  gender: 'Rodzaj',
  other: 'Inne'
};

const CATEGORY_COLORS: Record<Mistake['category'], string> = {
  grammar: 'bg-blue-100 text-blue-700 border-blue-200',
  orthography: 'bg-red-100 text-red-700 border-red-200',
  punctuation: 'bg-amber-100 text-amber-700 border-amber-200',
  style: 'bg-purple-100 text-purple-700 border-purple-200',
  gender: 'bg-pink-100 text-pink-700 border-pink-200',
  other: 'bg-gray-100 text-gray-700 border-gray-200'
};

const ScannerView: React.FC<ScannerViewProps> = ({
  chunks,
  currentChunkIdx,
  isProcessing,
  processingError,
  stage,
  onToggleProcessing,
  onApproveMistake,
  onRejectMistake,
  onApproveAll,
  onRejectAll
}) => {
  const [selectedMistakeId, setSelectedMistakeId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<Mistake['category'] | 'all'>('all');
  const [showOnlyPending, setShowOnlyPending] = useState(true);
  const textDisplayRef = useRef<HTMLDivElement>(null);

  // Gather all mistakes from all chunks
  const allMistakes = useMemo(() => {
    return chunks.flatMap(chunk => chunk.mistakes || []);
  }, [chunks]);

  // Filter mistakes
  const filteredMistakes = useMemo(() => {
    return allMistakes.filter(m => {
      if (filterCategory !== 'all' && m.category !== filterCategory) return false;
      if (showOnlyPending && m.status !== 'pending') return false;
      return true;
    });
  }, [allMistakes, filterCategory, showOnlyPending]);

  // Stats
  const stats = useMemo(() => {
    const pending = allMistakes.filter(m => m.status === 'pending').length;
    const approved = allMistakes.filter(m => m.status === 'approved').length;
    const rejected = allMistakes.filter(m => m.status === 'rejected').length;
    return { total: allMistakes.length, pending, approved, rejected };
  }, [allMistakes]);

  // Selected mistake
  const selectedMistake = useMemo(() => {
    return allMistakes.find(m => m.id === selectedMistakeId);
  }, [allMistakes, selectedMistakeId]);

  // Current chunk for the selected mistake
  const selectedChunk = useMemo(() => {
    if (!selectedMistake) return null;
    return chunks.find(c => c.id === selectedMistake.chunkId);
  }, [selectedMistake, chunks]);

  // Navigate between mistakes
  const currentMistakeIndex = filteredMistakes.findIndex(m => m.id === selectedMistakeId);

  const goToNextMistake = () => {
    if (currentMistakeIndex < filteredMistakes.length - 1) {
      setSelectedMistakeId(filteredMistakes[currentMistakeIndex + 1].id);
    }
  };

  const goToPrevMistake = () => {
    if (currentMistakeIndex > 0) {
      setSelectedMistakeId(filteredMistakes[currentMistakeIndex - 1].id);
    }
  };

  // Auto-select first pending mistake when entering review
  useEffect(() => {
    if (stage === 'review' && !selectedMistakeId && filteredMistakes.length > 0) {
      setSelectedMistakeId(filteredMistakes[0].id);
    }
  }, [stage, filteredMistakes, selectedMistakeId]);

  // Scroll to highlighted text when mistake selected
  useEffect(() => {
    if (selectedMistake && textDisplayRef.current) {
      const highlight = textDisplayRef.current.querySelector('.mistake-highlight');
      if (highlight) {
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedMistake]);

  // Render text with highlighted mistake
  const renderTextWithHighlight = (text: string, mistake: Mistake | undefined) => {
    if (!mistake || !text) return <span className="whitespace-pre-wrap">{text}</span>;

    const { start, end } = mistake.position;
    const before = text.slice(0, start);
    const highlighted = text.slice(start, end);
    const after = text.slice(end);

    return (
      <span className="whitespace-pre-wrap">
        {before}
        <mark className="mistake-highlight bg-red-500 dark:bg-red-600 text-white px-1 py-0.5 rounded border-b-2 border-red-700 relative group cursor-pointer">
          {highlighted}
          <span className="absolute -top-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
            → {mistake.suggestedFix}
          </span>
        </mark>
        {after}
      </span>
    );
  };

  const progressPercent = Math.round((currentChunkIdx / Math.max(chunks.length, 1)) * 100);

  // Processing View
  if (stage === 'processing') {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* Progress Header */}
        <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
          <div className="flex justify-between items-end mb-4">
            <div>
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Skanowanie Tekstu</h3>
              <div className="text-2xl font-serif font-bold text-gray-800 dark:text-gray-100">
                {progressPercent}% <span className="text-xs font-sans text-gray-400 font-normal">({currentChunkIdx} / {chunks.length} segmentów)</span>
              </div>
            </div>
            <button
              onClick={onToggleProcessing}
              className={`flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all ${isProcessing ? 'bg-amber-100 text-amber-700 hover:bg-amber-200' : 'bg-brand-600 text-white hover:bg-brand-700'}`}
            >
              {isProcessing ? <><Pause size={16} fill="currentColor" /> Wstrzymaj</> : <><Play size={16} fill="currentColor" /> Wznów</>}
            </button>
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

          {/* Live Stats */}
          <div className="mt-4 grid grid-cols-3 gap-4 text-center">
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{stats.total}</div>
              <div className="text-xs text-gray-500">Znalezionych błędów</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{chunks.filter(c => c.status === 'completed').length}</div>
              <div className="text-xs text-gray-500">Przeskanowanych</div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3">
              <div className="text-2xl font-bold text-gray-800 dark:text-gray-100">{chunks.filter(c => c.status === 'pending').length}</div>
              <div className="text-xs text-gray-500">Pozostało</div>
            </div>
          </div>
        </div>

        {/* Current Processing Chunk */}
        {isProcessing && chunks[currentChunkIdx] && (
          <div className="bg-white dark:bg-gray-900 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-800">
            <div className="flex items-center gap-2 mb-3">
              <Loader2 size={16} className="text-brand-600 animate-spin" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Analizowanie segmentu #{currentChunkIdx + 1}...</span>
            </div>
            <div className="font-serif text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-4">
              {chunks[currentChunkIdx].originalText.slice(0, 500)}...
            </div>
          </div>
        )}
      </div>
    );
  }

  // Review View
  return (
    <div className="h-full flex">
      {/* Mistakes List Panel */}
      <div className="w-80 flex-shrink-0 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-3">Znalezione Błędy</h2>

          {/* Stats Row */}
          <div className="flex gap-2 text-xs mb-3">
            <span className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full">{stats.pending} oczekuje</span>
            <span className="bg-green-100 text-green-700 px-2 py-1 rounded-full">{stats.approved} zatw.</span>
            <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{stats.rejected} odrz.</span>
          </div>

          {/* Filters */}
          <div className="flex gap-2 items-center">
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value as any)}
              className="text-xs border border-gray-200 dark:border-gray-700 rounded px-2 py-1 bg-white dark:bg-gray-800"
            >
              <option value="all">Wszystkie kategorie</option>
              {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400 cursor-pointer">
              <input
                type="checkbox"
                checked={showOnlyPending}
                onChange={(e) => setShowOnlyPending(e.target.checked)}
                className="rounded"
              />
              Tylko oczekujące
            </label>
          </div>
        </div>

        {/* Bulk Actions */}
        <div className="p-2 border-b border-gray-200 dark:border-gray-800 flex gap-2">
          <button
            onClick={onApproveAll}
            className="flex-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded font-medium transition-colors"
          >
            ✓ Zatwierdź wszystkie
          </button>
          <button
            onClick={onRejectAll}
            className="flex-1 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded font-medium transition-colors"
          >
            ✗ Odrzuć wszystkie
          </button>
        </div>

        {/* Mistakes List */}
        <div className="flex-1 overflow-y-auto">
          {filteredMistakes.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {allMistakes.length === 0 ? 'Brak znalezionych błędów' : 'Brak błędów do wyświetlenia'}
            </div>
          ) : (
            filteredMistakes.map((mistake, idx) => (
              <button
                key={mistake.id}
                onClick={() => setSelectedMistakeId(mistake.id)}
                className={`w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${selectedMistakeId === mistake.id ? 'bg-brand-50 dark:bg-brand-900/20 border-l-4 border-l-brand-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[mistake.category]}`}>
                    {CATEGORY_LABELS[mistake.category]}
                  </span>
                  {mistake.status === 'approved' && <CheckCircle2 size={14} className="text-green-500" />}
                  {mistake.status === 'rejected' && <X size={14} className="text-gray-400" />}
                </div>
                <div className="text-sm font-medium text-red-600 dark:text-red-400 line-through mb-1">
                  {mistake.originalText.slice(0, 40)}{mistake.originalText.length > 40 ? '...' : ''}
                </div>
                <div className="text-sm text-green-700 dark:text-green-400">
                  → {mistake.suggestedFix.slice(0, 40)}{mistake.suggestedFix.length > 40 ? '...' : ''}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Content - Text Display */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Selected Mistake Header */}
        {selectedMistake && (
          <div className="p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={goToPrevMistake} disabled={currentMistakeIndex <= 0} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30">
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentMistakeIndex + 1} / {filteredMistakes.length}
              </span>
              <button onClick={goToNextMistake} disabled={currentMistakeIndex >= filteredMistakes.length - 1} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30">
                <ChevronRight size={20} />
              </button>
            </div>

            {selectedMistake.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => { onRejectMistake(selectedMistake.id); goToNextMistake(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-colors"
                >
                  <X size={16} /> Odrzuć
                </button>
                <button
                  onClick={() => { onApproveMistake(selectedMistake.id); goToNextMistake(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
                >
                  <Check size={16} /> Zatwierdź
                </button>
              </div>
            )}

            {selectedMistake.status !== 'pending' && (
              <span className={`text-sm font-medium ${selectedMistake.status === 'approved' ? 'text-green-600' : 'text-gray-500'}`}>
                {selectedMistake.status === 'approved' ? '✓ Zatwierdzone' : '✗ Odrzucone'}
              </span>
            )}
          </div>
        )}

        {/* Mistake Detail Card */}
        {selectedMistake && (
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs px-2 py-1 rounded border ${CATEGORY_COLORS[selectedMistake.category]}`}>
                  {CATEGORY_LABELS[selectedMistake.category]}
                </span>
                <span className="text-xs text-gray-500">Segment #{selectedMistake.chunkId + 1}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Oryginał:</div>
                  <div className="text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded">
                    {selectedMistake.originalText}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Proponowana poprawka:</div>
                  <div className="text-green-700 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 p-2 rounded">
                    {selectedMistake.suggestedFix}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Powód: </span>{selectedMistake.reason}
              </div>
            </div>
          </div>
        )}

        {/* Text Display with Highlighted Mistake */}
        <div ref={textDisplayRef} className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-950">
          {selectedChunk ? (
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
              <div className="text-xs text-gray-400 mb-4">
                {selectedChunk.sourceFileName || `Segment #${selectedChunk.id + 1}`}
              </div>
              <div className="font-serif text-gray-800 dark:text-gray-200 leading-relaxed">
                {renderTextWithHighlight(selectedChunk.originalText, selectedMistake)}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Wybierz błąd z listy, aby zobaczyć go w kontekście
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScannerView;



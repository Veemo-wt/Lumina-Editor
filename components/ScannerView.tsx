import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { Play, Pause, AlertTriangle, CheckCircle2, Loader2, X, Check, ChevronLeft, ChevronRight, RotateCcw, Search, Sparkles, PenTool, Eye, BookOpen, Microscope } from 'lucide-react';
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
  onRevertMistake: (mistakeId: string) => void;
  onApproveAll: (mistakeIds?: string[]) => void;
  onRejectAll: (mistakeIds?: string[]) => void;
}

const CATEGORY_LABELS: Record<Mistake['category'], string> = {
  grammar: 'Gramatyka',
  orthography: 'Ortografia',
  punctuation: 'Interpunkcja',
  style: 'Styl',
  gender: 'Rodzaj',
  localization: 'Lokalizacja',
  formatting: 'Formatowanie',
  other: 'Inne'
};

const CATEGORY_COLORS: Record<Mistake['category'], string> = {
  grammar: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800',
  orthography: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800',
  punctuation: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800',
  style: 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800',
  gender: 'bg-pink-100 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-800',
  localization: 'bg-teal-100 text-teal-700 border-teal-200 dark:bg-teal-900/30 dark:text-teal-300 dark:border-teal-800',
  formatting: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-700/50 dark:text-slate-300 dark:border-slate-600',
  other: 'bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700'
};

// Funny processing messages that rotate
const PROCESSING_MESSAGES = [
  { icon: Search, text: "Tropimy literówki..." },
  { icon: Microscope, text: "Badamy pod lupą..." },
  { icon: PenTool, text: "Pióro w ruchu..." },
  { icon: Eye, text: "Czytamy między wierszami..." },
  { icon: Sparkles, text: "Polerujemy tekst..." },
  { icon: BookOpen, text: "Wertujemy strony..." },
  { icon: Search, text: "Szukamy igły w stogu siana..." },
  { icon: Microscope, text: "Analizujemy składnię..." },
  { icon: PenTool, text: "Sprawdzamy przecinki..." },
  { icon: Eye, text: "Wypatrujemy błędów..." },
  { icon: Sparkles, text: "Czyścimy tekst..." },
  { icon: BookOpen, text: "Konsultujemy ze słownikiem..." },
  { icon: Search, text: "Polujemy na powtórzenia..." },
  { icon: Microscope, text: "Sekcja zwłok zdania..." },
  { icon: PenTool, text: "Redagujemy z pasją..." },
  { icon: Eye, text: "Skanujemy akapity..." },
  { icon: Sparkles, text: "Dopieszczamy interpunkcję..." },
  { icon: BookOpen, text: "Studiujemy gramatykę..." },
];

const ScannerView: React.FC<ScannerViewProps> = ({
  chunks,
  currentChunkIdx,
  isProcessing,
  processingError,
  stage,
  onToggleProcessing,
  onApproveMistake,
  onRejectMistake,
  onRevertMistake,
  onApproveAll,
  onRejectAll
}) => {
  const [selectedMistakeId, setSelectedMistakeId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<Mistake['category'] | 'all'>('all');
  const [showOnlyPending, setShowOnlyPending] = useState(true);
  const textDisplayRef = useRef<HTMLDivElement>(null);
  const [processingMessageIdx, setProcessingMessageIdx] = useState(0);
  const [messageFading, setMessageFading] = useState(false);

  // Rotate processing messages every 3.5 seconds with fade effect
  useEffect(() => {
    if (!isProcessing || stage !== 'processing') return;

    const interval = setInterval(() => {
      // Start fade out
      setMessageFading(true);

      // After fade out, change message and fade in
      setTimeout(() => {
        setProcessingMessageIdx(prev => (prev + 1) % PROCESSING_MESSAGES.length);
        setMessageFading(false);
      }, 300); // 300ms for fade out
    }, 3500);

    return () => clearInterval(interval);
  }, [isProcessing, stage]);

  // Helper to render text with formatting (**bold**, *italic*, and footnotes) as actual styled text
  const renderFormattedText = (text: string): React.ReactNode[] => {
    const result: React.ReactNode[] = [];
    let remaining = text;
    let keyCounter = 0;

    while (remaining.length > 0) {
      // Look for footnote definition [^N]: content (must be at start of line or string)
      const footnoteDefMatch = remaining.match(/^\[\^(\d+)\]:\s*/);
      if (footnoteDefMatch) {
        // This is a footnote definition - render as a styled footnote block
        const footnoteNum = footnoteDefMatch[1];
        remaining = remaining.slice(footnoteDefMatch[0].length);

        // Find the rest of the footnote content (until next footnote def or end)
        let footnoteContent = '';
        const nextFootnoteIdx = remaining.search(/\n\[\^\d+\]:/);
        if (nextFootnoteIdx !== -1) {
          footnoteContent = remaining.slice(0, nextFootnoteIdx);
          remaining = remaining.slice(nextFootnoteIdx + 1); // +1 to skip the newline
        } else {
          footnoteContent = remaining;
          remaining = '';
        }

        result.push(
          <span key={keyCounter++} className="block my-2 pl-4 border-l-2 border-gray-300 dark:border-gray-600 text-sm text-gray-600 dark:text-gray-400">
            <sup className="text-xs font-bold text-brand-600 dark:text-brand-400 mr-1">[{footnoteNum}]</sup>
            {renderFormattedText(footnoteContent.trim())}
          </span>
        );
        continue;
      }

      // Look for footnote separator ---
      if (remaining.startsWith('---')) {
        result.push(
          <span key={keyCounter++} className="block my-4 border-t border-gray-300 dark:border-gray-700 pt-2">
            <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Przypisy</span>
          </span>
        );
        remaining = remaining.slice(3).trimStart();
        continue;
      }

      // Look for footnote reference [^N]
      const footnoteRefMatch = remaining.match(/^\[\^(\d+)\]/);
      if (footnoteRefMatch) {
        const footnoteNum = footnoteRefMatch[1];
        result.push(
          <sup key={keyCounter++} className="text-xs font-bold text-brand-600 dark:text-brand-400 cursor-help" title={`Zobacz przypis ${footnoteNum}`}>
            [{footnoteNum}]
          </sup>
        );
        remaining = remaining.slice(footnoteRefMatch[0].length);
        continue;
      }

      // Look for **bold** first (takes precedence)
      const boldMatch = remaining.match(/^\*\*(.+?)\*\*/);
      if (boldMatch) {
        result.push(<strong key={keyCounter++} className="font-bold">{renderFormattedText(boldMatch[1])}</strong>);
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Look for *italic* (but not **)
      const italicMatch = remaining.match(/^\*([^*]+?)\*/);
      if (italicMatch && !remaining.startsWith('**')) {
        result.push(<em key={keyCounter++} className="italic">{renderFormattedText(italicMatch[1])}</em>);
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Find next marker position
      const nextBoldIdx = remaining.indexOf('**');
      const nextItalicIdx = remaining.search(/(?<!\*)\*(?!\*)/);
      const nextFootnoteRefIdx = remaining.search(/\[\^\d+\]/);
      const nextFootnoteDefIdx = remaining.search(/\n\[\^\d+\]:/);
      const nextSeparatorIdx = remaining.indexOf('---');

      let nextMarkerIdx = remaining.length;
      if (nextBoldIdx !== -1) nextMarkerIdx = Math.min(nextMarkerIdx, nextBoldIdx);
      if (nextItalicIdx !== -1) nextMarkerIdx = Math.min(nextMarkerIdx, nextItalicIdx);
      if (nextFootnoteRefIdx !== -1) nextMarkerIdx = Math.min(nextMarkerIdx, nextFootnoteRefIdx);
      if (nextFootnoteDefIdx !== -1) nextMarkerIdx = Math.min(nextMarkerIdx, nextFootnoteDefIdx + 1); // +1 to include the newline
      if (nextSeparatorIdx !== -1) nextMarkerIdx = Math.min(nextMarkerIdx, nextSeparatorIdx);

      if (nextMarkerIdx > 0) {
        // Add plain text before the marker
        result.push(remaining.slice(0, nextMarkerIdx));
        remaining = remaining.slice(nextMarkerIdx);
      } else if (remaining.length > 0) {
        // No more markers, add rest as plain text
        result.push(remaining);
        break;
      }
    }

    return result;
  };

  // Helper to render text with visible whitespace markers AND formatting
  const renderWithVisibleWhitespace = (text: string, showFormatting: boolean = true) => {
    const hasMultipleSpaces = /  +/.test(text);
    const hasNewlines = /\n/.test(text);

    // First handle whitespace
    if (!hasMultipleSpaces && !hasNewlines) {
      return showFormatting ? renderFormattedText(text) : text;
    }

    const result: React.ReactNode[] = [];
    let i = 0;
    let keyCounter = 0;

    while (i < text.length) {
      if (text[i] === ' ' && text[i + 1] === ' ') {
        // Multiple spaces - show them visibly
        let spaceCount = 0;
        while (text[i + spaceCount] === ' ') spaceCount++;
        result.push(
          <span key={`ws-${keyCounter++}`} className="inline-flex">
            {Array(spaceCount).fill(null).map((_, idx) => (
              <span key={idx} className="inline-block w-[0.5em] bg-amber-300/60 dark:bg-amber-500/40 border-b border-amber-400 dark:border-amber-500 mx-px">&nbsp;</span>
            ))}
          </span>
        );
        i += spaceCount;
      } else if (text[i] === '\n') {
        result.push(<span key={`nl-${keyCounter++}`} className="text-amber-500 dark:text-amber-400 text-[10px]">↵</span>);
        result.push('\n');
        i++;
      } else {
        // Regular text segment - collect until whitespace issue
        let regularText = '';
        while (i < text.length && text[i] !== '\n' && !(text[i] === ' ' && text[i + 1] === ' ')) {
          regularText += text[i];
          i++;
        }
        if (showFormatting) {
          result.push(<span key={`txt-${keyCounter++}`}>{renderFormattedText(regularText)}</span>);
        } else {
          result.push(regularText);
        }
      }
    }

    return <span style={{ whiteSpace: 'pre-wrap' }}>{result}</span>;
  };

  // Gather all mistakes from all chunks
  const allMistakes = useMemo(() => {
    return chunks.flatMap(chunk => chunk.mistakes || []);
  }, [chunks]);

  // Filter mistakes for display list
  const filteredMistakes = useMemo(() => {
    return allMistakes.filter(m => {
      if (filterCategory !== 'all' && m.category !== filterCategory) return false;
      if (showOnlyPending && m.status !== 'pending') return false;
      return true;
    });
  }, [allMistakes, filterCategory, showOnlyPending]);

  // All mistakes for navigation (category filtered but NOT status filtered)
  const navigableMistakes = useMemo(() => {
    return allMistakes.filter(m => {
      if (filterCategory !== 'all' && m.category !== filterCategory) return false;
      return true;
    });
  }, [allMistakes, filterCategory]);

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

    // Combined full text from all chunks with offset tracking
  // NOTE: We don't clean the text here because mistake positions are based on original text
  const fullTextData = useMemo(() => {
    let combinedText = '';
    const chunkOffsets: { chunkId: number; start: number; end: number }[] = [];

    chunks.forEach((chunk, idx) => {
      const start = combinedText.length;
      combinedText += chunk.originalText;
      const end = combinedText.length;
      chunkOffsets.push({ chunkId: chunk.id, start, end });
    });

    return { combinedText, chunkOffsets };
  }, [chunks]);

  // Calculate global positions for all mistakes
  const mistakesWithGlobalPositions = useMemo(() => {
    return allMistakes.map(mistake => {
      const chunkOffset = fullTextData.chunkOffsets.find(co => co.chunkId === mistake.chunkId);
      if (!chunkOffset) return { ...mistake, globalStart: 0, globalEnd: 0 };

      return {
        ...mistake,
        globalStart: chunkOffset.start + mistake.position.start,
        globalEnd: chunkOffset.start + mistake.position.end
      };
    });
  }, [allMistakes, fullTextData]);

  // Navigate between mistakes (uses navigableMistakes which includes all statuses)
  const currentMistakeIndex = navigableMistakes.findIndex(m => m.id === selectedMistakeId);

  const goToNextMistake = useCallback(() => {
    if (currentMistakeIndex < navigableMistakes.length - 1) {
      setSelectedMistakeId(navigableMistakes[currentMistakeIndex + 1].id);
    }
  }, [currentMistakeIndex, navigableMistakes]);

  const goToPrevMistake = useCallback(() => {
    if (currentMistakeIndex > 0) {
      setSelectedMistakeId(navigableMistakes[currentMistakeIndex - 1].id);
    }
  }, [currentMistakeIndex, navigableMistakes]);

  // Keyboard shortcuts
  useEffect(() => {
    if (stage !== 'review') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;

      switch (e.key) {
        case 'ArrowLeft':
        case 'a':
        case 'A':
          e.preventDefault();
          goToPrevMistake();
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          e.preventDefault();
          goToNextMistake();
          break;
        case 'Enter':
          e.preventDefault();
          if (selectedMistakeId) {
            const mistake = allMistakes.find(m => m.id === selectedMistakeId);
            if (mistake) {
              // Approve regardless of current state (overrides rejected)
              if (mistake.status !== 'approved') {
                onApproveMistake(selectedMistakeId);
              }
              goToNextMistake();
            }
          }
          break;
        case 'Backspace':
        case 'Delete':
          e.preventDefault();
          if (selectedMistakeId) {
            const mistake = allMistakes.find(m => m.id === selectedMistakeId);
            if (mistake) {
              // Reject regardless of current state (overrides approved)
              if (mistake.status !== 'rejected') {
                onRejectMistake(selectedMistakeId);
              }
              goToNextMistake();
            }
          }
          break;
        case 'r':
        case 'R':
          e.preventDefault();
          if (selectedMistakeId) {
            const mistake = allMistakes.find(m => m.id === selectedMistakeId);
            if (mistake?.status === 'approved' || mistake?.status === 'rejected') {
              onRevertMistake(selectedMistakeId);
            }
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [stage, selectedMistakeId, allMistakes, goToNextMistake, goToPrevMistake, onApproveMistake, onRejectMistake, onRevertMistake]);

  // Auto-select first mistake when entering review
  useEffect(() => {
    if (stage === 'review' && !selectedMistakeId && navigableMistakes.length > 0) {
      setSelectedMistakeId(navigableMistakes[0].id);
    }
  }, [stage, navigableMistakes, selectedMistakeId]);

  // Scroll to highlighted text when mistake selected
  useEffect(() => {
    if (selectedMistake && textDisplayRef.current) {
      const highlight = textDisplayRef.current.querySelector('.mistake-highlight');
      if (highlight) {
        highlight.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedMistake]);

  // Render text with ALL mistakes highlighted, selected one more prominent
  // For approved mistakes, show the corrected text instead of original
  const renderFullTextWithAllHighlights = () => {
    const text = fullTextData.combinedText;
    if (!text) return null;

    // Sort mistakes by global position
    const sortedMistakes = [...mistakesWithGlobalPositions].sort((a, b) => a.globalStart - b.globalStart);

    // Filter out overlapping mistakes (keep earlier ones)
    const nonOverlappingMistakes = sortedMistakes.reduce((acc, mistake) => {
      const lastMistake = acc[acc.length - 1];
      if (!lastMistake || mistake.globalStart >= lastMistake.globalEnd) {
        acc.push(mistake);
      }
      return acc;
    }, [] as typeof sortedMistakes);

    const elements: React.ReactNode[] = [];
    let lastEnd = 0;

    nonOverlappingMistakes.forEach((mistake, idx) => {
      // Add text before this mistake
      if (mistake.globalStart > lastEnd) {
        elements.push(
          <span key={`text-${idx}`} style={{ whiteSpace: 'pre-wrap' }}>{renderFormattedText(text.slice(lastEnd, mistake.globalStart))}</span>
        );
      }

      // Determine highlighting style and what text to show
      const isSelected = mistake.id === selectedMistakeId;
      const isPending = mistake.status === 'pending';
      const isApproved = mistake.status === 'approved';
      const isRejected = mistake.status === 'rejected';

      // Choose which text to display
      const displayText = isApproved
        ? mistake.suggestedFix  // Show corrected text for approved
        : text.slice(mistake.globalStart, mistake.globalEnd);  // Original for pending/rejected

      let highlightClass = '';
      if (isSelected) {
        // Strong highlight for selected
        if (isApproved) {
          highlightClass = 'bg-green-500 dark:bg-green-600 text-white px-1 py-0.5 rounded border-b-2 border-green-700';
        } else if (isRejected) {
          highlightClass = 'bg-gray-500 dark:bg-gray-600 text-white px-1 py-0.5 rounded border-b-2 border-gray-700';
        } else {
          highlightClass = 'bg-red-500 dark:bg-red-600 text-white px-1 py-0.5 rounded border-b-2 border-red-700';
        }
      } else if (isPending) {
        // Medium highlight for pending
        highlightClass = 'bg-red-200 dark:bg-red-800/50 text-red-900 dark:text-red-200 px-0.5 rounded';
      } else if (isApproved) {
        // Light green for approved - show the fix
        highlightClass = 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-0.5 rounded';
      } else {
        // Very light for rejected - keep original
        highlightClass = 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-500 px-0.5 rounded line-through';
      }

      // Check if this is a whitespace-only mistake (double spaces, etc.)
      const isWhitespaceOnly = /^\s+$/.test(displayText);
      const hasSpecialWhitespace = /  +|\n/.test(displayText);

      elements.push(
        <mark
          key={`mistake-${mistake.id}`}
          className={`${highlightClass} ${isSelected ? 'mistake-highlight' : ''} relative group cursor-pointer transition-all duration-200`}
          style={{ whiteSpace: 'pre-wrap' }}
          onClick={() => setSelectedMistakeId(mistake.id)}
        >
          {(isWhitespaceOnly || (isSelected && hasSpecialWhitespace)) ? renderWithVisibleWhitespace(displayText) : renderFormattedText(displayText)}
          {!isSelected && !isApproved && (
            <span className="absolute -top-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
              → {renderFormattedText(mistake.suggestedFix)}
            </span>
          )}
          {!isSelected && isApproved && (
            <span className="absolute -top-8 left-0 bg-gray-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
              było: {renderFormattedText(text.slice(mistake.globalStart, mistake.globalEnd))}
            </span>
          )}
        </mark>
      );

      lastEnd = mistake.globalEnd;
    });

    // Add remaining text
    if (lastEnd < text.length) {
      elements.push(<span key="text-end" style={{ whiteSpace: 'pre-wrap' }}>{renderFormattedText(text.slice(lastEnd))}</span>);
    }

    return <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{elements}</span>;
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
              <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Skanowanie tekstu</h3>
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
              <div className="text-xs text-gray-500">znalezionych błędów</div>
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
            <div className="flex items-center gap-3 mb-4">
              {(() => {
                const CurrentIcon = PROCESSING_MESSAGES[processingMessageIdx].icon;
                return (
                  <div className={`relative transition-opacity duration-300 ${messageFading ? 'opacity-0' : 'opacity-100'}`}>
                    <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/30 rounded-full flex items-center justify-center">
                      <CurrentIcon size={20} className="text-brand-600 dark:text-brand-400 animate-pulse" />
                    </div>
                    <Loader2 size={14} className="absolute -bottom-1 -right-1 text-brand-600 animate-spin" />
                  </div>
                );
              })()}
              <div className={`transition-opacity duration-300 ${messageFading ? 'opacity-0' : 'opacity-100'}`}>
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200 block">
                  {PROCESSING_MESSAGES[processingMessageIdx].text}
                </span>
                <span className="text-xs text-gray-400 dark:text-gray-500">
                  Segment {currentChunkIdx + 1} z {chunks.length}
                </span>
              </div>
            </div>
            <div className="font-serif text-gray-600 dark:text-gray-400 text-sm leading-relaxed line-clamp-4 pl-[52px]">
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
        <div className="p-2 border-b border-gray-200 dark:border-gray-800 flex flex-col gap-2">
          {filterCategory !== 'all' && (
            <div className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
              Działanie na: <span className="font-medium">{CATEGORY_LABELS[filterCategory]}</span>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={() => onApproveAll(filteredMistakes.filter(m => m.status === 'pending').map(m => m.id))}
              disabled={filteredMistakes.filter(m => m.status === 'pending').length === 0}
              className="flex-1 text-xs bg-green-50 hover:bg-green-100 text-green-700 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✓ Zatwierdź ({filteredMistakes.filter(m => m.status === 'pending').length})
            </button>
            <button
              onClick={() => onRejectAll(filteredMistakes.filter(m => m.status === 'pending').map(m => m.id))}
              disabled={filteredMistakes.filter(m => m.status === 'pending').length === 0}
              className="flex-1 text-xs bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ✗ Odrzuć ({filteredMistakes.filter(m => m.status === 'pending').length})
            </button>
          </div>
        </div>

        {/* Mistakes List */}
        <div className="flex-1 overflow-y-auto">
          {filteredMistakes.length === 0 ? (
            <div className="p-8 text-center text-gray-400">
              {allMistakes.length === 0 ? 'Brak znalezionych błędów' : 'Brak błędów do wyświetlenia'}
            </div>
          ) : (
            filteredMistakes.map((mistake) => (
              <div
                key={mistake.id}
                onClick={() => setSelectedMistakeId(mistake.id)}
                className={`w-full text-left p-3 border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors cursor-pointer ${selectedMistakeId === mistake.id ? 'bg-brand-50 dark:bg-brand-900/20 border-l-4 border-l-brand-500' : ''}`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded border ${CATEGORY_COLORS[mistake.category]}`}>
                      {CATEGORY_LABELS[mistake.category]}
                    </span>
                    {/* Show source only for formatting category */}
                    {mistake.category === 'formatting' && (
                      mistake.source === 'local' || (mistake.source === undefined && mistake.id.includes('-local-')) ? (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                          AUTO
                        </span>
                      ) : (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                          AI
                        </span>
                      )
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {mistake.status === 'approved' && <CheckCircle2 size={14} className="text-green-500" />}
                    {mistake.status === 'rejected' && <X size={14} className="text-gray-400" />}
                    {mistake.status !== 'pending' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); onRevertMistake(mistake.id); }}
                        className="p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900/30 rounded text-amber-600 dark:text-amber-400"
                        title="Przywróć do oczekujących"
                      >
                        <RotateCcw size={12} />
                      </button>
                    )}
                  </div>
                </div>
                <div className="text-sm font-medium text-red-600 dark:text-red-400 line-through mb-1">
                  {renderFormattedText(mistake.originalText.slice(0, 40))}{mistake.originalText.length > 40 ? '...' : ''}
                </div>
                <div className="text-sm text-green-700 dark:text-green-400">
                  → {renderFormattedText(mistake.suggestedFix.slice(0, 40))}{mistake.suggestedFix.length > 40 ? '...' : ''}
                </div>
              </div>
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
              <button onClick={goToPrevMistake} disabled={currentMistakeIndex <= 0} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30" title="Poprzedni (A / ←)">
                <ChevronLeft size={20} />
              </button>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {currentMistakeIndex + 1} / {filteredMistakes.length}
              </span>
              <button onClick={goToNextMistake} disabled={currentMistakeIndex >= filteredMistakes.length - 1} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded disabled:opacity-30" title="Następny (D / →)">
                <ChevronRight size={20} />
              </button>
              {/* Keyboard shortcuts hint */}
              <span className="text-[10px] text-gray-400 dark:text-gray-500 hidden md:inline-block ml-2">
                ← A/D → | Enter=Zatwierdź | Del=Odrzuć | R=Przywróć
              </span>
            </div>

            {selectedMistake.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => { onRejectMistake(selectedMistake.id); goToNextMistake(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium text-sm transition-colors"
                  title="Odrzuć (Backspace / Delete)"
                >
                  <X size={16} /> Odrzuć
                </button>
                <button
                  onClick={() => { onApproveMistake(selectedMistake.id); goToNextMistake(); }}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium text-sm transition-colors"
                  title="Zatwierdź (Enter)"
                >
                  <Check size={16} /> Zatwierdź
                </button>
              </div>
            )}

            {selectedMistake.status !== 'pending' && (
              <div className="flex items-center gap-3">
                <span className={`text-sm font-medium ${selectedMistake.status === 'approved' ? 'text-green-600' : 'text-gray-500'}`}>
                  {selectedMistake.status === 'approved' ? '✓ Zatwierdzone' : '✗ Odrzucone'}
                </span>
                <button
                  onClick={() => onRevertMistake(selectedMistake.id)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/30 dark:hover:bg-amber-900/50 text-amber-700 dark:text-amber-300 rounded-lg font-medium text-xs transition-colors"
                  title="Przywróć do oczekujących (R)"
                >
                  <RotateCcw size={14} /> Przywróć
                </button>
              </div>
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
                {/* Show source only for formatting category */}
                {selectedMistake.category === 'formatting' && (
                  (selectedMistake.source === 'local' || (selectedMistake.source === undefined && selectedMistake.id.includes('-local-'))) ? (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400 border border-cyan-200 dark:border-cyan-800">
                      AUTO
                    </span>
                  ) : (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 border border-violet-200 dark:border-violet-800">
                      AI
                    </span>
                  )
                )}
                <span className="text-xs text-gray-500">Segment #{selectedMistake.chunkId + 1}</span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Oryginał:</div>
                  <div className="text-red-600 dark:text-red-400 font-medium bg-red-50 dark:bg-red-900/20 p-2 rounded" style={{ whiteSpace: 'pre-wrap' }}>
                    {renderWithVisibleWhitespace(selectedMistake.originalText)}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-1">Proponowana poprawka:</div>
                  <div className="text-green-700 dark:text-green-400 font-medium bg-green-50 dark:bg-green-900/20 p-2 rounded" style={{ whiteSpace: 'pre-wrap' }}>
                    {renderWithVisibleWhitespace(selectedMistake.suggestedFix)}
                  </div>
                </div>
              </div>

              <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                <span className="font-medium">Powód: </span>{selectedMistake.reason}
              </div>
            </div>
          </div>
        )}

        {/* Text Display with All Mistakes Highlighted */}
        <div ref={textDisplayRef} className="flex-1 overflow-y-auto p-6 bg-gray-100 dark:bg-gray-950">
          {chunks.length > 0 ? (
            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
              <div className="text-xs text-gray-400 mb-4">
                Pełny tekst • {allMistakes.length} {allMistakes.length === 1 ? 'błąd' : allMistakes.length < 5 ? 'błędy' : 'błędów'}
              </div>
              <div
                className="font-serif text-gray-800 dark:text-gray-200 leading-relaxed"
                style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
              >
                {renderFullTextWithAllHighlights()}
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-gray-400">
              Brak tekstu do wyświetlenia
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ScannerView;



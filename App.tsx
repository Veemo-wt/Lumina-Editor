import React, { useState, useEffect, useRef } from 'react';
import { AppStage, TranslationConfig, ChunkData, RawFile, Mistake } from './types';
import { chunkText, getLookback, saveBlob, generateDocxBlob, createWorldPackage, parseWorldPackage } from './utils/textProcessing';

import { scanChunk } from './services/scanService';

import { saveSession, loadSession, clearSession } from './utils/storage';
import { calculateSessionCost } from './utils/models';
import FileUpload from './components/FileUpload';
import ConfigPanel from './components/ConfigPanel';
import GlossarySidebar from './components/GlossarySidebar';
import Header from './components/Header';
import ScannerView from './components/ScannerView';
import { Loader2 } from 'lucide-react';
import ConfirmModal from './components/ConfirmModal';

const DEFAULT_CONFIG: TranslationConfig = {
  apiKey: '',
  model: 'gpt-4o',
  scanOptions: {
    checkGrammar: true,
    checkOrthography: true,
    checkGender: true,
    checkStyle: false,
    checkPunctuation: true
  },
  glossary: [],
  characterBible: [],
  ragEntries: [],
  chunkSize: 40000,
  lookbackSize: 10000,
  chapterPattern: '(Chapter|Rozdział|Part)\\s+\\d+'
};

const App: React.FC = () => {
  const [stage, setStage] = useState<AppStage>('upload');
  const [rawFiles, setRawFiles] = useState<RawFile[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [config, setConfig] = useState<TranslationConfig>(DEFAULT_CONFIG);
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);

  // Real-time Usage State
  const [sessionUsage, setSessionUsage] = useState({
    promptTokens: 0,
    completionTokens: 0,
    totalCost: 0
  });

  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionStartChunkIdx, setSessionStartChunkIdx] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('--:--');
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    const restoreState = async () => {
      try {
        const saved = await loadSession();
        if (saved && saved.stage !== 'upload') {
          setRawFiles(saved.rawFiles || []);
          setFileName(saved.fileName || '');
          setConfig(prev => ({
            ...DEFAULT_CONFIG,
            ...saved.config,
            ragEntries: saved.config?.ragEntries || []
          }));
          setChunks(saved.chunks || []);
          setCurrentChunkIdx(saved.currentChunkIdx || 0);
          setStage(saved.stage || 'upload');
          setIsProcessing(false);
        }
      } catch (e) {
        console.error("Failed to restore state", e);
      } finally {
        setIsRestoring(false);
      }
    };
    restoreState();
  }, []);

  useEffect(() => {
    if (isRestoring || stage === 'upload') return;
    const timer = setTimeout(() => {
      saveSession({ stage, rawFiles, fileName, config, chunks, currentChunkIdx });
    }, 2000);
    return () => clearTimeout(timer);
  }, [stage, rawFiles, fileName, config, chunks, currentChunkIdx, isRestoring]);

  const handleResetRequest = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async () => {
    await clearSession();
    setStage('upload');
    setRawFiles([]);
    setFileName('');
    setChunks([]);
    setCurrentChunkIdx(0);
    setConfig(DEFAULT_CONFIG);
    setIsProcessing(false);
    setSessionUsage({ promptTokens: 0, completionTokens: 0, totalCost: 0 });
    setIsResetModalOpen(false);
  };

  const handleFileLoaded = async (files: RawFile[], name: string) => {
    setRawFiles(files);
    setFileName(name);
    setStage('config');
  };

  const startScan = async () => {
    console.log('[Scanner] startScan called:', { chunksLength: chunks.length, currentChunkIdx, rawFilesLength: rawFiles.length });

    if (chunks.length > 0 && currentChunkIdx > 0) {
      console.log('[Scanner] Resuming existing session');
      if (currentChunkIdx >= chunks.length) {
        console.log('[Scanner] Session was already complete, going to review');
        setStage('review');
        return;
      }
      setStage('processing');
      setIsProcessing(true);
      setSessionStartTime(Date.now());
      setSessionStartChunkIdx(currentChunkIdx);
      return;
    }

    if (rawFiles.length === 0) {
      console.error('[Scanner] No files to process!');
      setProcessingError('Brak plików do przetworzenia.');
      return;
    }

    let globalChunkId = 0;
    const allChunks: ChunkData[] = [];
    for (const file of rawFiles) {
      const fileChunks = chunkText(file.content, config.chunkSize, config.chapterPattern);
      fileChunks.forEach(c => {
        allChunks.push({
          id: globalChunkId++,
          originalText: c.originalText,
          correctedText: null,
          mistakes: [],
          status: 'pending',
          sourceFileName: c.sourceFileName || file.name
        });
      });
    }

    console.log('[Scanner] Created chunks:', allChunks.length);

    if (allChunks.length === 0) {
      console.error('[Scanner] No chunks created from files!');
      setProcessingError('Nie udało się utworzyć segmentów z plików.');
      return;
    }

    setChunks(allChunks);
    setCurrentChunkIdx(0);
    setStage('processing');
    setIsProcessing(true);
    setSessionStartTime(Date.now());
    setSessionStartChunkIdx(0);
  };

  const updateETR = () => {
    if (!sessionStartTime || currentChunkIdx <= sessionStartChunkIdx) return;
    const chunksProcessedInSession = currentChunkIdx - sessionStartChunkIdx;
    const timeElapsed = Date.now() - sessionStartTime;
    const avgTimePerChunk = timeElapsed / chunksProcessedInSession;
    const timeLeftMs = avgTimePerChunk * (chunks.length - currentChunkIdx);
    const minutes = Math.floor(timeLeftMs / 60000);
    const seconds = Math.floor((timeLeftMs % 60000) / 1000);
    setEstimatedTimeRemaining(`${minutes}m ${seconds}s`);
  };

  const handleExportWorld = async () => {
    try {
      const blob = await createWorldPackage(
        config.glossary,
        config.characterBible,
        config.ragEntries
      );
      saveBlob(`${fileName.replace(/\.[^/.]+$/, "")}_World.lumina`, blob);
    } catch (e) {
      alert("Export failed: " + e);
    }
  };

  const handleImportWorld = async (file: File) => {
    try {
      const { glossary, characterBible, ragEntries } = await parseWorldPackage(file);
      setConfig(prev => ({
        ...prev,
        glossary: [...prev.glossary, ...glossary],
        characterBible: [...prev.characterBible, ...characterBible],
        ragEntries: [...prev.ragEntries, ...ragEntries]
      }));
      alert(`Wczytano: ${glossary.length} terminów, ${characterBible.length} postaci, ${ragEntries.length} segmentów pamięci.`);
    } catch (e) {
      alert("Import failed. Ensure file is valid .lumina package or .json.");
    }
  };

  // Processing Effect - scans chunks and finds mistakes
  useEffect(() => {
    let isMounted = true;
    const processNextChunk = async () => {
      console.log('[Scanner] processNextChunk called:', { isProcessing, currentChunkIdx, chunksLength: chunks.length });

      if (!isProcessing || !isMounted || currentChunkIdx >= chunks.length) {
        console.log('[Scanner] Early exit:', { isProcessing, isMounted, currentChunkIdx, chunksLength: chunks.length });
        if (currentChunkIdx >= chunks.length && chunks.length > 0) {
          setIsProcessing(false);
          setStage('review');
        }
        return;
      }

      const chunk = chunks[currentChunkIdx];
      if (!chunk) {
        console.error('[Scanner] Chunk is undefined at index:', currentChunkIdx);
        return;
      }

      if (chunk.status === 'completed') {
        setCurrentChunkIdx(prev => prev + 1);
        return;
      }

      try {
        console.log('[Scanner] Processing chunk:', chunk.id, 'with model:', configRef.current.model);
        setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'processing' } : c));
        setProcessingError(null);

        // Prepare Context (Lookback)
        let lookbackText = "";
        if (currentChunkIdx > 0) {
          lookbackText = getLookback(chunks[currentChunkIdx - 1].originalText, configRef.current.lookbackSize);
        }

        // Call Scan API - returns mistakes
        console.log('[Scanner] Calling scanChunk API...');
        const result = await scanChunk({
          chunkId: chunk.id,
          chunkText: chunk.originalText,
          lookbackText,
          scanOptions: configRef.current.scanOptions,
          glossary: configRef.current.glossary,
          characterBible: configRef.current.characterBible,
          apiKey: configRef.current.apiKey,
          model: configRef.current.model
        });
        console.log('[Scanner] scanChunk result received:', { mistakesCount: result.mistakes.length, usage: result.usage });

        if (!isMounted) return;

        // Update Stats
        const cost = calculateSessionCost(configRef.current.model, result.usage.prompt_tokens, result.usage.completion_tokens);
        setSessionUsage(prev => ({
          promptTokens: prev.promptTokens + result.usage.prompt_tokens,
          completionTokens: prev.completionTokens + result.usage.completion_tokens,
          totalCost: prev.totalCost + cost
        }));

        // Update chunk with found mistakes
        setChunks(prev => prev.map(c => c.id === chunk.id ? {
          ...c,
          status: 'completed',
          mistakes: result.mistakes,
          correctedText: null // Will be computed when mistakes are approved
        } : c));

        updateETR();
        setCurrentChunkIdx(prev => prev + 1);

      } catch (err: any) {
        console.error('[Scanner] Error during processing:', err);
        if (!isMounted) return;
        setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'error', errorMsg: err.message } : c));
        setIsProcessing(false);
        setProcessingError(err.message || "Błąd API.");
      }
    };
    processNextChunk();
    return () => { isMounted = false; };
  }, [isProcessing, currentChunkIdx, chunks.length]);

  // Approve a single mistake
  const handleApproveMistake = (mistakeId: string) => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m =>
        m.id === mistakeId ? { ...m, status: 'approved' as const } : m
      )
    })));
  };

  // Reject a single mistake
  const handleRejectMistake = (mistakeId: string) => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m =>
        m.id === mistakeId ? { ...m, status: 'rejected' as const } : m
      )
    })));
  };

  // Approve all pending mistakes
  const handleApproveAll = () => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m =>
        m.status === 'pending' ? { ...m, status: 'approved' as const } : m
      )
    })));
  };

  // Reject all pending mistakes
  const handleRejectAll = () => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m =>
        m.status === 'pending' ? { ...m, status: 'rejected' as const } : m
      )
    })));
  };

  // Apply approved fixes to generate corrected text
  const applyCorrectionToChunk = (chunk: ChunkData): string => {
    let text = chunk.originalText;

    // Sort approved mistakes by position (descending) to apply from end to start
    // This prevents position shifts from affecting subsequent replacements
    const approvedMistakes = chunk.mistakes
      .filter(m => m.status === 'approved')
      .sort((a, b) => b.position.start - a.position.start);

    for (const mistake of approvedMistakes) {
      const before = text.slice(0, mistake.position.start);
      const after = text.slice(mistake.position.end);
      text = before + mistake.suggestedFix + after;
    }

    return text;
  };

  // Export corrected document
  const handleExportDocx = async () => {
    setIsExporting(true);

    // Generate corrected text for each chunk
    const correctedChunks = chunks.map(chunk => applyCorrectionToChunk(chunk));
    const fullText = correctedChunks.join('\n\n');

    const blob = await generateDocxBlob(fullText);
    saveBlob(`${fileName}_Corrected.docx`, blob);
    setIsExporting(false);
  };

  if (isRestoring) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-950">
      {stage !== 'upload' && (
        <GlossarySidebar
          glossaryItems={config.glossary}
          characterBible={config.characterBible}
          onAddGlossary={(item) => setConfig(prev => ({ ...prev, glossary: [...prev.glossary, item] }))}
          onAddCharacter={(item) => setConfig(prev => ({ ...prev, characterBible: [...(prev.characterBible || []), item] }))}
          onRemoveGlossary={(id) => setConfig(prev => ({ ...prev, glossary: prev.glossary.filter(g => g.id !== id) }))}
          onRemoveCharacter={(id) => setConfig(prev => ({ ...prev, characterBible: (prev.characterBible || []).filter(c => c.id !== id) }))}
          onImportGlossary={(items) => setConfig(prev => ({ ...prev, glossary: [...prev.glossary, ...items] }))}
          onImportBible={(items) => setConfig(prev => ({ ...prev, characterBible: [...(prev.characterBible || []), ...items] }))}
          onExportWorld={handleExportWorld}
          onImportWorld={handleImportWorld}
        />
      )}

      <div className={`flex-1 flex flex-col h-full overflow-hidden ${stage !== 'upload' ? 'mr-12' : ''}`}>
        <Header
          stage={stage}
          fileName={fileName}
          sessionUsage={sessionUsage}
          estimatedTimeRemaining={estimatedTimeRemaining}
          isExporting={isExporting}
          onReset={handleResetRequest}
          onExport={handleExportDocx}
        />

        <main className="flex-1 overflow-y-auto prose-scroll">
          {stage === 'upload' && <FileUpload onFileLoaded={handleFileLoaded} />}

          {stage === 'config' && (
            <div className="container mx-auto p-4 animate-in fade-in duration-500">
              <ConfigPanel
                config={config}
                onChange={setConfig}
                onStart={startScan}
                fileName={fileName}
                charCount={rawFiles.reduce((acc, f) => acc + f.content.length, 0)}
              />
            </div>
          )}

          {(stage === 'processing' || stage === 'review') && (
            <ScannerView
              chunks={chunks}
              currentChunkIdx={currentChunkIdx}
              isProcessing={isProcessing}
              processingError={processingError}
              stage={stage}
              onToggleProcessing={() => setIsProcessing(!isProcessing)}
              onApproveMistake={handleApproveMistake}
              onRejectMistake={handleRejectMistake}
              onApproveAll={handleApproveAll}
              onRejectAll={handleRejectAll}
            />
          )}
        </main>
      </div>

      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Zakończyć projekt?"
        message="Czy na pewno chcesz zakończyć ten projekt? Cały niezapisany postęp zostanie utracony bezpowrotnie."
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetModalOpen(false)}
        confirmLabel="Zakończ"
        isDangrous={true}
      />
    </div>
  );
};

export default App;


import React, { useState, useEffect, useRef } from 'react';
import { AppStage, TranslationConfig, BookGenre, ChunkData, RawFile } from './types';
import { chunkText, getLookback, saveBlob, generateDocxBlob, createWorldPackage, parseWorldPackage, mergeGlossaryItems } from './utils/textProcessing';
import { translateChunk, extractGlossaryPairs } from './services/geminiService';
import { findSimilarSegments, createRagEntry } from './services/ragService';
import { saveSession, loadSession, clearSession } from './utils/storage';
import { calculateSessionCost } from './utils/models';
import FileUpload from './components/FileUpload';
import ConfigPanel from './components/ConfigPanel';
import GlossarySidebar from './components/GlossarySidebar';
import Header from './components/Header';
import TranslationView from './components/TranslationView';
import { Loader2 } from 'lucide-react';
import ConfirmModal from './components/ConfirmModal';

const DEFAULT_CONFIG: TranslationConfig = {
  apiKey: '',
  model: 'gpt-4o',
  genre: BookGenre.FICTION_LITERARY,
  tone: 'Wierny stylowi oryginału',
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

  // Fixed typo: constSF -> const
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

  const startPipeline = async () => {
    if (chunks.length > 0 && currentChunkIdx > 0) {
      setStage('processing');
      setIsProcessing(true);
      setSessionStartTime(Date.now());
      setSessionStartChunkIdx(currentChunkIdx);
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
          translatedText: null,
          status: 'pending',
          sourceFileName: c.sourceFileName || file.name
        });
      });
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

  // --- EXPORT WORLD HANDLER ---
  const handleExportWorld = async () => {
    try {
      const blob = await createWorldPackage(
        config.glossary,
        config.characterBible,
        config.ragEntries
      );
      saveBlob(`${fileName.replace(/\.[^/.]+$/, "")}_World.zip`, blob);
    } catch (e) {
      alert("Export failed: " + e);
    }
  };

  // --- IMPORT WORLD HANDLER ---
  const handleImportWorld = async (file: File) => {
    try {
      const { glossary, characterBible, ragEntries } = await parseWorldPackage(file);
      setConfig(prev => ({
        ...prev,
        glossary: [...prev.glossary, ...glossary], // Merge logic can be smarter
        characterBible: [...prev.characterBible, ...characterBible],
        ragEntries: [...prev.ragEntries, ...ragEntries]
      }));
      alert(`Wczytano: ${glossary.length} terminów, ${characterBible.length} postaci, ${ragEntries.length} segmentów pamięci.`);
    } catch (e) {
      alert("Import failed. Ensure file is valid .lumina package or .json.");
    }
  };

  useEffect(() => {
    let isMounted = true;
    const processNextChunk = async () => {
      if (!isProcessing || !isMounted || currentChunkIdx >= chunks.length) {
        if (currentChunkIdx >= chunks.length && chunks.length > 0) {
          setIsProcessing(false);
          setStage('review');
        }
        return;
      }

      const chunk = chunks[currentChunkIdx];
      if (chunk.status === 'completed') {
        setCurrentChunkIdx(prev => prev + 1);
        return;
      }

      try {
        setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'processing' } : c));
        setProcessingError(null);

        // 1. Prepare Context (Lookback)
        let lookbackText = "";
        if (currentChunkIdx > 0) {
          lookbackText = getLookback(chunks[currentChunkIdx - 1].originalText, configRef.current.lookbackSize);
        }

        // 2. RAG Retrieval (Vector Search)
        let ragContext = "";
        try {
          const similar = await findSimilarSegments(
            chunk.originalText,
            configRef.current.ragEntries,
            configRef.current.apiKey
          );

          if (similar.length > 0) {
            ragContext = similar.map(s =>
              `SOURCE: "${s.sourceText.slice(0, 150)}..."\nTRANSLATION: "${s.translatedText.slice(0, 150)}..."`
            ).join("\n---\n");
          }
        } catch (ragErr) {
          console.warn("RAG Search failed, continuing without history", ragErr);
        }

        // 3. Translation
        const result = await translateChunk({
          chunkText: chunk.originalText,
          lookbackText,
          genre: configRef.current.genre,
          tone: configRef.current.tone,
          glossary: configRef.current.glossary,
          characterBible: configRef.current.characterBible,
          ragContext, // Pass retrieved context
          apiKey: configRef.current.apiKey,
          model: configRef.current.model
        });

        if (!isMounted) return;

        // 4. Update Stats
        const cost = calculateSessionCost(configRef.current.model, result.usage.prompt_tokens, result.usage.completion_tokens);
        setSessionUsage(prev => ({
          promptTokens: prev.promptTokens + result.usage.prompt_tokens,
          completionTokens: prev.completionTokens + result.usage.completion_tokens,
          totalCost: prev.totalCost + cost
        }));

        setChunks(prev => prev.map(c => c.id === chunk.id ? {
          ...c,
          status: 'completed',
          translatedText: result.text
        } : c));

        // 5. RAG Indexing (Save Result)
        try {
          const newEntry = await createRagEntry(
            chunk.originalText,
            result.text,
            configRef.current.apiKey,
            chunk.sourceFileName || fileName
          );
          if (newEntry) {
            setConfig(prev => ({
              ...prev,
              ragEntries: [...prev.ragEntries, newEntry]
            }));
          }
        } catch (idxErr) {
          console.warn("Failed to index chunk for RAG", idxErr);
        }

        // 6. Continuous Glossary Extraction (Async)
        try {
          extractGlossaryPairs(
            chunk.originalText,
            result.text,
            configRef.current.glossary,
            configRef.current.apiKey,
            configRef.current.model
          ).then(newTerms => {
            if (newTerms.length > 0) {
              setConfig(prev => ({
                ...prev,
                glossary: mergeGlossaryItems(prev.glossary, newTerms)
              }));
            }
          });
        } catch (e) {
          console.warn("Auto-extraction failed silently", e);
        }

        updateETR();
        setCurrentChunkIdx(prev => prev + 1);

      } catch (err: any) {
        if (!isMounted) return;
        setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'error' } : c));
        setIsProcessing(false);
        setProcessingError(err.message || "Błąd API.");
      }
    };
    processNextChunk();
    return () => { isMounted = false; };
  }, [isProcessing, currentChunkIdx, chunks.length]);

  const handleExportDocx = async () => {
    setIsExporting(true);
    const fullText = chunks.map(c => c.translatedText || '').join('\n\n');
    const blob = await generateDocxBlob(fullText);
    saveBlob(`${fileName}_PL.docx`, blob);
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
                onStart={startPipeline}
                fileName={fileName}
                charCount={rawFiles.reduce((acc, f) => acc + f.content.length, 0)}
              />
            </div>
          )}

          {(stage === 'processing' || stage === 'review') && (
            <TranslationView
              chunks={chunks}
              currentChunkIdx={currentChunkIdx}
              isProcessing={isProcessing}
              processingError={processingError}
              stage={stage}
              onToggleProcessing={() => setIsProcessing(!isProcessing)}
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
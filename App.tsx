import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { AppStage, ChunkData, ScanOptions } from './types';
import { saveBlob, generateDocxBlob, generateOriginalDocxBlob } from './utils/textProcessing';
import { saveSession, loadSession, clearSession, importFromLSF, exportToLSF, LuminaScanFile } from './utils/storage';
import { registerSession, generateSessionId, getSessionInfo, updateSessionName } from './utils/sessionManager';
import { hasUsername, setUsername, getUsername } from './utils/username';
import GlossarySidebar from './components/GlossarySidebar';
import Header from './components/Header';
import ScannerView from './components/ScannerView';
import { Loader2, FileText, AlertCircle, CheckCircle2, Upload, BarChart3, FolderOpen } from 'lucide-react';
import ConfirmModal from './components/ConfirmModal';
import { SessionSelector } from './components/SessionSelector';
import UsernamePrompt from './components/UsernamePrompt';

// Uproszczona konfiguracja dla Editora (bez API key)
interface EditorConfig {
  scanOptions: ScanOptions;
  glossary: any[];
  characterBible: any[];
  chunkSize: number;
  lookbackSize: number;
  chapterPattern?: string;
}

const DEFAULT_CONFIG: EditorConfig = {
  scanOptions: {
    checkGrammar: true,
    checkOrthography: true,
    checkGender: true,
    checkStyle: false,
    checkPunctuation: true,
    checkLocalization: false,
    checkFormatting: true,
    wrapThoughtsInQuotes: false,
    indesignImport: false,
    preserveDocxFormatting: true
  },
  glossary: [],
  characterBible: [],
  chunkSize: 40000,
  lookbackSize: 10000,
  chapterPattern: '(Chapter|Rozdział|Part)\\s+\\d+'
};

type EditorStage = 'upload' | 'review';

const App: React.FC = () => {
  const { sessionId: urlSessionId } = useParams<{ sessionId?: string }>();
  const navigate = useNavigate();

  // Auto-redirect if no sessionId
  useEffect(() => {
    if (!urlSessionId) {
      const newId = generateSessionId();
      navigate(`/${newId}`, { replace: true });
    }
  }, [urlSessionId, navigate]);

  const sessionId = urlSessionId || 'default';

  const [stage, setStage] = useState<EditorStage>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [config, setConfig] = useState<EditorConfig>(DEFAULT_CONFIG);
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [isSessionSelectorOpen, setIsSessionSelectorOpen] = useState(false);
  const [isGlossaryOpen, setIsGlossaryOpen] = useState(true);
  const [sessionName, setSessionName] = useState<string>('');
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(() => {
    const hasUser = hasUsername();
    console.log('🔍 [Editor] Username check:', { hasUser, username: hasUser ? getUsername() : null });
    return !hasUser;
  });
  const [importError, setImportError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<LuminaScanFile['metadata'] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Rejestruj sesję przy starcie
  useEffect(() => {
    if (sessionId && sessionId !== 'default') {
      registerSession(sessionId, {
        fileName,
        totalChunks: chunks.length,
        completedChunks: chunks.filter(c => c.status === 'completed').length
      });
    }
  }, [sessionId, fileName, chunks]);

  // Ładuj nazwę sesji
  useEffect(() => {
    if (sessionId && sessionId !== 'default') {
      getSessionInfo(sessionId).then(sessionInfo => {
        if (sessionInfo?.name) {
          setSessionName(sessionInfo.name);
        }
      });
    }
  }, [sessionId]);

  // Restore session on load
  useEffect(() => {
    const restoreState = async () => {
      try {
        const saved = await loadSession(sessionId);
        if (saved && saved.stage === 'review') {
          setFileName(saved.fileName || '');
          setConfig(prev => ({
            ...DEFAULT_CONFIG,
            ...saved.config
          }));
          setChunks(saved.chunks || []);
          setMetadata(saved.metadata || null);
          setStage('review');
        }
      } catch (e) {
        console.error("Failed to restore state", e);
      } finally {
        setIsRestoring(false);
      }
    };

    if (sessionId) {
      restoreState();
    }
  }, [sessionId]);

  // Auto-save session
  useEffect(() => {
    if (isRestoring || stage === 'upload' || !sessionId) return;
    const timer = setTimeout(() => {
      saveSession({ stage, fileName, config, chunks, metadata }, sessionId);
      // Aktualizuj metadata sesji
      registerSession(sessionId, {
        fileName,
        totalChunks: chunks.length,
        completedChunks: chunks.filter(c => c.status === 'completed').length
      });
    }, 2000);
    return () => clearTimeout(timer);
  }, [stage, fileName, config, chunks, metadata, isRestoring, sessionId]);

  const handleResetRequest = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async () => {
    await clearSession(sessionId);
    setStage('upload');
    setFileName('');
    setChunks([]);
    setConfig(DEFAULT_CONFIG);
    setMetadata(null);
    setImportError(null);
    setIsResetModalOpen(false);
  };

  const handleUpdateSessionName = (name: string) => {
    if (sessionId && sessionId !== 'default') {
      updateSessionName(sessionId, name);
      setSessionName(name);
    }
  };

  // Import .lsf file
  const handleFileImport = async (file: File) => {
    if (!file.name.endsWith('.lsf')) {
      setImportError('Proszę wybrać plik .lsf (Lumina Scan File)');
      return;
    }

    try {
      setImportError(null);
      const lsfData = await importFromLSF(file);

      setFileName(lsfData.fileName);
      setChunks(lsfData.chunks);
      setConfig({
        scanOptions: lsfData.config.scanOptions || DEFAULT_CONFIG.scanOptions,
        glossary: lsfData.config.glossary || [],
        characterBible: lsfData.config.characterBible || [],
        chunkSize: lsfData.config.chunkSize || 40000,
        lookbackSize: lsfData.config.lookbackSize || 10000,
        chapterPattern: lsfData.config.chapterPattern
      });
      setMetadata(lsfData.metadata);
      setStage('review');
    } catch (err) {
      setImportError((err as Error).message);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileImport(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileImport(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  // Mistake handlers
  const handleApproveMistake = (mistakeId: string) => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m => m.id === mistakeId ? { ...m, status: 'approved' as const } : m)
    })));
  };

  const handleRejectMistake = (mistakeId: string) => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m => m.id === mistakeId ? { ...m, status: 'rejected' as const } : m)
    })));
  };

  const handleRevertMistake = (mistakeId: string) => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m => m.id === mistakeId ? { ...m, status: 'pending' as const } : m)
    })));
  };

  // Reset ALL mistakes back to pending (undo all changes)
  const handleResetAllMistakes = () => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m => ({ ...m, status: 'pending' as const }))
    })));
  };

  const handleApproveAll = (mistakeIds?: string[]) => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m => {
        if (m.status !== 'pending') return m;
        if (mistakeIds && !mistakeIds.includes(m.id)) return m;
        return { ...m, status: 'approved' as const };
      })
    })));
  };

  const handleRejectAll = (mistakeIds?: string[]) => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m => {
        if (m.status !== 'pending') return m;
        if (mistakeIds && !mistakeIds.includes(m.id)) return m;
        return { ...m, status: 'rejected' as const };
      })
    })));
  };

  // Apply corrections to chunk
  const applyCorrectionToChunk = (chunk: ChunkData): string => {
    const approvedMistakes = chunk.mistakes
      .filter(m => m.status === 'approved')
      .sort((a, b) => b.position.start - a.position.start);

    let text = chunk.originalText;
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
    const correctedChunks = chunks.map(chunk => applyCorrectionToChunk(chunk));
    const fullText = correctedChunks.join('\n\n');
    const blob = await generateDocxBlob(fullText, config.scanOptions.preserveDocxFormatting);
    saveBlob(`${fileName}_Corrected.docx`, blob);
    setIsExporting(false);
  };

  // Export original document without corrections
  const handleExportOriginalDocx = async () => {
    setIsExporting(true);
    const blob = await generateOriginalDocxBlob(chunks, config.scanOptions.preserveDocxFormatting);
    saveBlob(`${fileName}_Original.docx`, blob);
    setIsExporting(false);
  };

  // Export session to .lsf file (to continue editing later)
  const handleExportLSF = () => {
    const blob = exportToLSF(fileName, chunks, config);
    saveBlob(`${fileName}.lsf`, blob);
  };

  // Get session data for feedback
  const getSessionData = (): LuminaScanFile | null => {
    if (!chunks || chunks.length === 0) return null;

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

  // World package handlers (for glossary sidebar)
  const handleExportWorld = async () => {
    const worldData = {
      glossary: config.glossary,
      characterBible: config.characterBible
    };
    const blob = new Blob([JSON.stringify(worldData, null, 2)], { type: 'application/json' });
    saveBlob('lumina_world.json', blob);
  };

  const handleImportWorld = async (file: File) => {
    const text = await file.text();
    const data = JSON.parse(text);
    if (data.glossary) {
      setConfig(prev => ({ ...prev, glossary: [...prev.glossary, ...data.glossary] }));
    }
    if (data.characterBible) {
      setConfig(prev => ({ ...prev, characterBible: [...prev.characterBible, ...data.characterBible] }));
    }
  };

  if (isRestoring) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-950">
        <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
      </div>
    );
  }

  // Upload View
  if (stage === 'upload') {
    return (
      <div className="flex h-screen w-full overflow-hidden bg-gradient-to-b from-gray-100 via-blue-50/30 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-black">
        <div className="flex h-full flex-1 flex-col overflow-hidden">
          <header className="z-30 w-full flex-shrink-0 border-b border-gray-200/80 bg-white/90 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.55)] backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/95">
            <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3 lg:px-6">
            <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-brand-200/80 bg-gradient-to-b from-brand-100 to-brand-200 font-serif font-bold text-brand-700 shadow-sm dark:border-brand-700/50 dark:from-brand-900/40 dark:to-brand-900/10 dark:text-brand-300">
                  L
                </div>
              <div>
                  <h1 className="font-serif text-[17px] font-bold leading-tight text-gray-800 dark:text-gray-100">Lumina Editor</h1>
                  <p className="mt-0.5 text-[10px] text-gray-400 dark:text-gray-500">Edycja korekty dla redaktorów</p>
              </div>
            </div>

            {/* Session selector button in upload view */}
            <button
              onClick={() => setIsSessionSelectorOpen(true)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-200/80 bg-white/70 text-gray-500 transition-all duration-150 hover:border-gray-300 hover:bg-white hover:text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300 dark:hover:border-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-100"
              title="Zarządzaj sesjami"
            >
              <FolderOpen size={18} />
            </button>
            </div>
          </header>

          <main className="prose-scroll flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
            <div className="lt-enter lt-enter-delay-1 mx-auto w-full max-w-xl">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all bg-white/95 dark:bg-gray-900/95 shadow-[0_22px_60px_-40px_rgba(15,23,42,0.5)]
                  ${isDragging 
                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20' 
                    : 'border-gray-300 dark:border-gray-700 hover:border-brand-400 hover:bg-gray-50 dark:hover:bg-gray-900'
                  }
                `}
              >
                <div className="w-16 h-16 mx-auto mb-4 bg-brand-100 dark:bg-brand-900/50 rounded-full flex items-center justify-center">
                  <FileText className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                </div>
                <h2 className="text-xl font-serif font-bold text-gray-800 dark:text-gray-100 mb-2">
                  Importuj plik .lsf
                </h2>
                <p className="text-gray-500 dark:text-gray-400 mb-4">
                  Przeciągnij plik Lumina Scan File tutaj lub kliknij aby wybrać
                </p>
                <p className="text-xs text-gray-400 dark:text-gray-500">
                  Plik .lsf zawiera wyniki analizy do przeglądu i edycji
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".lsf"
                  onChange={handleFileSelect}
                  className="hidden"
                />
              </div>

              {importError && (
                <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex items-center gap-3">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
                  <p className="text-sm text-red-600 dark:text-red-400">{importError}</p>
                </div>
              )}

              <div className="mt-8 grid grid-cols-3 gap-4 text-center">
                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                  <CheckCircle2 className="w-6 h-6 mx-auto mb-2 text-emerald-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Przeglądaj poprawki</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                  <BarChart3 className="w-6 h-6 mx-auto mb-2 text-blue-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Zatwierdź lub odrzuć</p>
                </div>
                <div className="bg-white dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-800">
                  <Upload className="w-6 h-6 mx-auto mb-2 text-brand-500" />
                  <p className="text-xs text-gray-500 dark:text-gray-400">Eksportuj DOCX</p>
                </div>
              </div>
            </div>
          </main>
        </div>

        {/* Session Selector Modal */}
        {isSessionSelectorOpen && (
          <SessionSelector
            onClose={() => setIsSessionSelectorOpen(false)}
            currentSessionId={sessionId}
          />
        )}

        {/* Username prompt for first-time users */}
        {showUsernamePrompt && (
          <UsernamePrompt
            onSubmit={(username) => {
              console.log('💾 [Editor] Saving username:', username);
              setUsername(username);
              setShowUsernamePrompt(false);
              console.log('✅ [Editor] Username saved, prompt hidden');
            }}
          />
        )}
      </div>
    );
  }

  // Review View
  return (
    <div className="flex h-screen w-full overflow-hidden bg-gradient-to-b from-gray-100 via-blue-50/30 to-gray-100 dark:from-gray-950 dark:via-gray-950 dark:to-black">
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
        isOpen={isGlossaryOpen}
        onToggleOpen={setIsGlossaryOpen}
      />

      <div className="flex h-full flex-1 flex-col overflow-hidden">
        <Header
          stage={'review' as AppStage}
          fileName={fileName}
          sessionId={sessionId}
          sessionName={sessionName}
          sessionUsage={{ promptTokens: 0, completionTokens: 0, totalCost: 0 }}
          estimatedTimeRemaining="--:--"
          metadata={metadata}
          isExporting={isExporting}
          chunks={chunks}
          config={config}
          onReset={handleResetRequest}
          onExport={handleExportDocx}
          onExportOriginal={handleExportOriginalDocx}
          onExportLSF={handleExportLSF}
          onOpenSessions={() => setIsSessionSelectorOpen(true)}
          onUpdateSessionName={handleUpdateSessionName}
        />

        <main className={`flex-1 overflow-hidden transition-[margin] duration-300 ${isGlossaryOpen ? 'mr-[384px]' : 'mr-12'}`}>
          <div className="lt-enter lt-enter-delay-2 h-full">
            <ScannerView
              chunks={chunks}
              currentChunkIdx={0}
              isProcessing={false}
              processingError={null}
              stage={'review' as AppStage}
              onToggleProcessing={() => {}}
              onApproveMistake={handleApproveMistake}
              onRejectMistake={handleRejectMistake}
              onRevertMistake={handleRevertMistake}
              onApproveAll={handleApproveAll}
              onRejectAll={handleRejectAll}
              onResetAllMistakes={handleResetAllMistakes}
              fileName={fileName}
              getSessionData={getSessionData}
            />
          </div>
        </main>
      </div>

      <ConfirmModal
        isOpen={isResetModalOpen}
        title="Zamknąć projekt?"
        message="Czy na pewno chcesz zamknąć ten projekt? Niezapisane zmiany zostaną utracone."
        onConfirm={handleConfirmReset}
        onCancel={() => setIsResetModalOpen(false)}
        confirmLabel="Zamknij"
        isDangrous={true}
      />

      {isSessionSelectorOpen && (
        <SessionSelector
          onClose={() => setIsSessionSelectorOpen(false)}
          currentSessionId={sessionId}
        />
      )}

      {/* Username prompt for first-time users */}
      {showUsernamePrompt && (
        <UsernamePrompt
          onSubmit={(username) => {
            console.log('💾 [Editor] Saving username:', username);
            setUsername(username);
            setShowUsernamePrompt(false);
            console.log('✅ [Editor] Username saved, prompt hidden');
          }}
        />
      )}
    </div>
  );
};

export default App;

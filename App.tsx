import React, { useState, useEffect, useRef } from 'react';
import { AppStage, ChunkData, ScanOptions } from './types';
import { saveBlob, generateDocxBlob, generateOriginalDocxBlob } from './utils/textProcessing';
import { saveSession, loadSession, clearSession, importFromLSF, LuminaScanFile } from './utils/storage';
import GlossarySidebar from './components/GlossarySidebar';
import Header from './components/Header';
import ScannerView from './components/ScannerView';
import { Loader2, FileText, AlertCircle, CheckCircle2, Upload, BarChart3 } from 'lucide-react';
import ConfirmModal from './components/ConfirmModal';

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
  const [stage, setStage] = useState<EditorStage>('upload');
  const [fileName, setFileName] = useState<string>('');
  const [config, setConfig] = useState<EditorConfig>(DEFAULT_CONFIG);
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<LuminaScanFile['metadata'] | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Restore session on load
  useEffect(() => {
    const restoreState = async () => {
      try {
        const saved = await loadSession();
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
    restoreState();
  }, []);

  // Auto-save session
  useEffect(() => {
    if (isRestoring || stage === 'upload') return;
    const timer = setTimeout(() => {
      saveSession({ stage, fileName, config, chunks, metadata });
    }, 2000);
    return () => clearTimeout(timer);
  }, [stage, fileName, config, chunks, metadata, isRestoring]);

  const handleResetRequest = () => {
    setIsResetModalOpen(true);
  };

  const handleConfirmReset = async () => {
    await clearSession();
    setStage('upload');
    setFileName('');
    setChunks([]);
    setConfig(DEFAULT_CONFIG);
    setMetadata(null);
    setImportError(null);
    setIsResetModalOpen(false);
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

  const handleApproveAll = () => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m => m.status === 'pending' ? { ...m, status: 'approved' as const } : m)
    })));
  };

  const handleRejectAll = () => {
    setChunks(prev => prev.map(chunk => ({
      ...chunk,
      mistakes: chunk.mistakes.map(m => m.status === 'pending' ? { ...m, status: 'rejected' as const } : m)
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
      <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-950">
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-serif font-bold">L</div>
              <div>
                <h1 className="font-serif font-bold text-gray-800 dark:text-gray-100">Lumina Editor</h1>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">Edycja korekty dla redaktorów</p>
              </div>
            </div>
          </header>

          <main className="flex-1 flex items-center justify-center p-8">
            <div className="max-w-xl w-full">
              <div
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                className={`
                  border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all
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
      </div>
    );
  }

  // Review View
  return (
    <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-950">
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

      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <Header
          stage={'review' as AppStage}
          fileName={fileName}
          metadata={metadata}
          isExporting={isExporting}
          chunks={chunks}
          config={config}
          onReset={handleResetRequest}
          onExport={handleExportDocx}
          onExportOriginal={handleExportOriginalDocx}
        />

        <main className="flex-1 overflow-y-auto prose-scroll mr-12">
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
          />
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
    </div>
  );
};

export default App;


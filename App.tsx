import React, { useState, useEffect, useRef } from 'react';
import { AppStage, TranslationConfig, BookGenre, ChunkData, GlossaryItem, ProcessingStats, RawFile, CharacterTrait } from './types';
import { chunkText, getLookback, downloadFile, saveBlob, generateDocxBlob, mergeGlossaryItems } from './utils/textProcessing';
import { translateChunk, detectGlossaryTerms, extractGlossaryPairs } from './services/geminiService';
import { saveSession, loadSession, clearSession } from './utils/storage';
import FileUpload from './components/FileUpload';
import ConfigPanel from './components/ConfigPanel';
import GlossarySidebar from './components/GlossarySidebar';
import { Download, Play, Pause, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, Sparkles, FileType, Pencil, Clock, Home, Trash2 } from 'lucide-react';

// Default configuration
const DEFAULT_CONFIG: TranslationConfig = {
  apiKey: '',
  model: '', 
  genre: BookGenre.FICTION_LITERARY,
  tone: 'Wierny stylowi oryginału',
  glossary: [],
  characterBible: [],
  chunkSize: 40000, 
  lookbackSize: 10000, 
  chapterPattern: '(Chapter|Rozdział|Part)\\s+\\d+'
};

const App: React.FC = () => {
  // State
  const [stage, setStage] = useState<AppStage>('upload');
  const [rawFiles, setRawFiles] = useState<RawFile[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [config, setConfig] = useState<TranslationConfig>(DEFAULT_CONFIG);
  
  const [chunks, setChunks] = useState<ChunkData[]>([]);
  const [currentChunkIdx, setCurrentChunkIdx] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const [lastAutoAddedTerms, setLastAutoAddedTerms] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  
  // ETR State
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionStartChunkIdx, setSessionStartChunkIdx] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('--:--');

  const activeChunkRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // --- PERSISTENCE LOGIC ---

  // 1. Load State on Mount
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
            characterBible: saved.config?.characterBible || [] // Ensure backward compatibility
          }));
          setChunks(saved.chunks || []);
          setCurrentChunkIdx(saved.currentChunkIdx || 0);
          setStage(saved.stage || 'upload');
          
          // Important: Don't auto-start processing on restore, let user click play
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

  // 2. Auto-Save on Change
  useEffect(() => {
    if (isRestoring || stage === 'upload') return;

    const timer = setTimeout(() => {
      saveSession({
        stage,
        rawFiles,
        fileName,
        config,
        chunks,
        currentChunkIdx
      });
    }, 2000); // Debounce 2s

    return () => clearTimeout(timer);
  }, [stage, rawFiles, fileName, config, chunks, currentChunkIdx, isRestoring]);

  // 3. Reset Project
  const handleResetProject = async () => {
    if (window.confirm("Czy na pewno chcesz zakończyć ten projekt? Postęp zostanie utracony.")) {
      await clearSession();
      setStage('upload');
      setRawFiles([]);
      setFileName('');
      setChunks([]);
      setCurrentChunkIdx(0);
      setConfig(DEFAULT_CONFIG);
      setIsProcessing(false);
      setProcessingError(null);
    }
  };


  // --- ETR LOGIC ---
  useEffect(() => {
    if (isProcessing && sessionStartTime === null) {
      setSessionStartTime(Date.now());
      setSessionStartChunkIdx(currentChunkIdx);
    } else if (!isProcessing) {
      setSessionStartTime(null); 
    }
  }, [isProcessing, currentChunkIdx]);

  const handleFileLoaded = async (files: RawFile[], name: string) => {
    setRawFiles(files);
    setFileName(name);
    setStage('config');
  };

  const startPipeline = async () => {
    // If we already have chunks (e.g. resumption or reconfiguration without full reset), 
    // we might want to keep existing translations or warn. 
    // For now, if chunks exist and we hit start, we assume a re-chunk or restart.
    // BUT if coming from config stage for the first time on a restored session that was in config mode:
    
    if (chunks.length > 0 && currentChunkIdx > 0) {
        // We are resuming. Just set processing.
        setStage('processing');
        setIsProcessing(true);
        return;
    }

    // New Chunking Pipeline
    let globalChunkId = 0;
    const allChunks: ChunkData[] = [];

    for (const file of rawFiles) {
      const fileChunks = chunkText(file.content, config.chunkSize, config.chapterPattern);
      
      fileChunks.forEach(c => {
        let displaySource = c.sourceFileName;
        if (rawFiles.length > 1 && (!displaySource || displaySource === 'Auto-Split')) {
          displaySource = file.name;
        }

        allChunks.push({
          id: globalChunkId++,
          originalText: c.originalText,
          translatedText: null,
          status: 'pending',
          sourceFileName: displaySource
        });
      });
    }

    setChunks(allChunks);
    setCurrentChunkIdx(0);
    
    // Initial glossary detection 
    if (config.glossary.length === 0 && config.apiKey && rawFiles.length > 0) {
      try {
        const sampleText = rawFiles[0].content.slice(0, 50000);
        const detected = await detectGlossaryTerms(sampleText, config.apiKey, config.model);
        setConfig(prev => ({
          ...prev,
          glossary: [...prev.glossary, ...detected]
        }));
      } catch (e) {
        console.error("Initial glossary detection failed", e);
      }
    }

    setStage('processing');
    setIsProcessing(true);
  };

  const updateETR = () => {
    if (!sessionStartTime || currentChunkIdx <= sessionStartChunkIdx) {
      setEstimatedTimeRemaining("Obliczanie...");
      return;
    }

    const chunksProcessedInSession = currentChunkIdx - sessionStartChunkIdx;
    const timeElapsed = Date.now() - sessionStartTime;
    const avgTimePerChunk = timeElapsed / chunksProcessedInSession;
    const chunksLeft = chunks.length - currentChunkIdx;
    const timeLeftMs = avgTimePerChunk * chunksLeft;
    
    const minutes = Math.floor(timeLeftMs / 60000);
    const seconds = Math.floor((timeLeftMs % 60000) / 1000);
    
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      setEstimatedTimeRemaining(`~${hours}h ${minutes % 60}m`);
    } else {
      setEstimatedTimeRemaining(`~${minutes}m ${seconds}s`);
    }
  };

  // Translation Loop
  useEffect(() => {
    let isMounted = true;

    const processNextChunk = async () => {
      if (!isProcessing || !isMounted) return;
      if (currentChunkIdx >= chunks.length) {
        setIsProcessing(false);
        setStage('review');
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

        let lookbackText = "";
        if (currentChunkIdx > 0) {
           const prevChunk = chunks[currentChunkIdx - 1];
           lookbackText = getLookback(prevChunk.originalText, configRef.current.lookbackSize);
        }

        const translatedText = await translateChunk({
          chunkText: chunk.originalText,
          lookbackText,
          genre: configRef.current.genre,
          tone: configRef.current.tone,
          glossary: configRef.current.glossary,
          characterBible: configRef.current.characterBible,
          apiKey: configRef.current.apiKey,
          model: configRef.current.model
        });

        if (!isMounted) return;

        try {
          const newTerms = await extractGlossaryPairs(
            chunk.originalText, 
            translatedText, 
            configRef.current.glossary,
            configRef.current.apiKey,
            configRef.current.model
          );
          
          if (newTerms.length > 0) {
            setLastAutoAddedTerms(newTerms.length);
            setConfig(prev => ({
              ...prev,
              glossary: mergeGlossaryItems(prev.glossary, newTerms)
            }));
            setTimeout(() => setLastAutoAddedTerms(0), 4000);
          }
        } catch (glossaryErr) {
          console.warn("Glossary auto-update skipped", glossaryErr);
        }

        setChunks(prev => prev.map(c => c.id === chunk.id ? { 
          ...c, 
          status: 'completed', 
          translatedText: translatedText 
        } : c));

        await new Promise(r => setTimeout(r, 5000)); 

        if (isMounted) {
           updateETR(); 
           setCurrentChunkIdx(prev => prev + 1);
        }

      } catch (err: any) {
        if (!isMounted) return;
        setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'error', errorMsg: 'API Error' } : c));
        setIsProcessing(false);
        const errorMsg = err.message || "Proces zatrzymany przez błąd API.";
        setProcessingError(errorMsg);
        console.error(err);
      }
    };

    processNextChunk();

    return () => { isMounted = false; };
  }, [isProcessing, currentChunkIdx, chunks.length]); // Dependencies

  useEffect(() => {
    if (stage === 'processing' && activeChunkRef.current) {
      activeChunkRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentChunkIdx, stage]);

  const handleChunkEdit = (id: number, newText: string) => {
    setChunks(prev => prev.map(c => c.id === id ? { ...c, translatedText: newText } : c));
  };

  const totalChars = rawFiles.reduce((acc, f) => acc + f.content.length, 0);
  const getTranslatedText = () => chunks.map(c => c.translatedText || '').join('\n\n');
  const getBaseName = () => fileName.replace(/\.[^/.]+$/, "");

  const handleExportTxt = () => {
    downloadFile(`${getBaseName()}_translated.txt`, getTranslatedText());
  };

  const handleExportDocx = async () => {
    setIsExporting(true);
    try {
      const blob = await generateDocxBlob(getTranslatedText());
      saveBlob(`${getBaseName()}_translated.docx`, blob);
    } catch (e) {
      console.error("Failed to export docx", e);
      setProcessingError("Nie udało się wygenerować pliku DOCX.");
    } finally {
      setIsExporting(false);
    }
  };

  const progressPercent = Math.round((currentChunkIdx / Math.max(chunks.length, 1)) * 100);
  const hasContent = chunks.filter(c => c.status === 'completed').length > 0;

  if (isRestoring) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-brand-600 animate-spin" />
          <p className="text-gray-500 font-medium animate-pulse">Przywracanie sesji...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
      
      {stage !== 'upload' && (
        <GlossarySidebar 
          glossaryItems={config.glossary}
          characterBible={config.characterBible}
          onAddGlossary={(item) => setConfig(prev => ({ ...prev, glossary: [...prev.glossary, item] }))}
          onRemoveGlossary={(id) => setConfig(prev => ({ ...prev, glossary: prev.glossary.filter(g => g.id !== id) }))}
          onRemoveCharacter={(id) => setConfig(prev => ({ ...prev, characterBible: (prev.characterBible || []).filter(c => c.id !== id) }))}
          onImportGlossary={(items) => setConfig(prev => ({ ...prev, glossary: [...prev.glossary, ...items] }))}
          onImportBible={(items) => setConfig(prev => ({ ...prev, characterBible: [...(prev.characterBible || []), ...items] }))}
        />
      )}

      <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all ${stage !== 'upload' ? 'mr-12' : ''}`}>
        
        {/* HEADER */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shadow-sm z-10 flex-shrink-0 transition-colors">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-serif font-bold shadow-lg shadow-brand-500/30">L</div>
             <h1 className="font-serif font-bold text-gray-800 dark:text-gray-100 hidden md:block">Lumina <span className="text-gray-400 dark:text-gray-500 font-sans font-normal text-sm">| Tłumacz Książek</span></h1>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Reset Button (Visible if project started) */}
            {stage !== 'upload' && (
              <button 
                onClick={handleResetProject}
                className="flex items-center gap-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 text-xs font-medium px-2 py-1 transition-colors"
                title="Zamknij i usuń postęp"
              >
                <Trash2 size={14} /> <span className="hidden md:inline">Zakończ Projekt</span>
              </button>
            )}

            {(stage === 'processing' || stage === 'review') ? (
              <div className="flex items-center gap-4">
                 {/* Auto-Add Notification */}
                 {lastAutoAddedTerms > 0 && (
                    <div className="animate-fade-in-down flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                      <Sparkles size={12} />
                      +{lastAutoAddedTerms}
                    </div>
                 )}

                 {/* Progress Bar */}
                 <div className="flex flex-col items-end min-w-[150px]">
                   <div className="flex justify-between w-full text-xs text-gray-500 dark:text-gray-400 uppercase font-semibold mb-1">
                     <span>Postęp</span>
                     {isProcessing && (
                       <span className="flex items-center gap-1 text-brand-600 dark:text-brand-400 normal-case animate-pulse">
                          <Clock size={10} /> {estimatedTimeRemaining}
                       </span>
                     )}
                   </div>
                   <div className="flex items-center gap-2 w-full">
                     <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                       <div className="h-full bg-brand-500 transition-all duration-500" style={{ width: `${progressPercent}%` }}></div>
                     </div>
                     <span className="text-sm font-mono text-brand-600 dark:text-brand-400">{progressPercent}%</span>
                   </div>
                 </div>
                 
                 {/* Play/Pause Controls */}
                 {stage !== 'review' && (
                   isProcessing ? (
                     <button onClick={() => setIsProcessing(false)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                       <Pause size={18} />
                     </button>
                   ) : (
                     <button onClick={() => setIsProcessing(true)} className="p-2 text-brand-500 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md transition-colors animate-pulse">
                       <Play size={18} />
                     </button>
                   )
                 )}

                 {/* Export Buttons */}
                 <div className="flex gap-2">
                   <button 
                      onClick={handleExportTxt}
                      disabled={!hasContent}
                      className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2 hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
                   >
                     <FileType size={14} /> TXT
                   </button>
                   <button 
                      onClick={handleExportDocx}
                      disabled={!hasContent || isExporting}
                      className="bg-gray-900 dark:bg-gray-700 text-white px-3 py-2 rounded-md text-xs font-medium flex items-center gap-2 hover:bg-gray-800 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                   >
                     {isExporting ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />} DOCX
                   </button>
                 </div>
              </div>
            ) : null}
          </div>
        </header>

        <main className="flex-1 overflow-hidden relative">
          
          {stage === 'upload' && (
            <div className="h-full overflow-y-auto">
               <FileUpload onFileLoaded={handleFileLoaded} />
            </div>
          )}

          {stage === 'config' && (
             <div className="h-full overflow-y-auto pb-20">
               <ConfigPanel 
                 config={config} 
                 onChange={setConfig} 
                 onStart={startPipeline}
                 fileName={fileName}
                 charCount={totalChars}
               />
             </div>
          )}

          {(stage === 'processing' || stage === 'review') && (
            <div className="h-full flex overflow-hidden">
              
              <div className="flex-1 overflow-y-auto p-8 prose-scroll bg-gray-100 dark:bg-gray-950 transition-colors">
                <div className="max-w-5xl mx-auto space-y-8 pb-32">
                   
                   {/* Error Banner */}
                   {processingError && (
                     <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg flex items-center gap-3 mb-6 sticky top-0 z-20 shadow-md backdrop-blur-sm">
                        <AlertTriangle className="flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold">Błąd Przetwarzania</p>
                          <p className="text-sm">{processingError}</p>
                          {processingError.includes('404') && (
                            <p className="text-xs mt-1 italic">Wskazówka: Model "gpt-4.1" może nie istnieć. Spróbuj "gpt-4o" lub "gpt-4-turbo".</p>
                          )}
                        </div>
                        <button onClick={() => setIsProcessing(true)} className="underline font-bold whitespace-nowrap hover:text-red-800 dark:hover:text-red-200">Ponów</button>
                     </div>
                   )}

                   {/* Chunks List */}
                   {chunks.map((chunk, idx) => (
                     <div 
                        key={chunk.id} 
                        ref={idx === currentChunkIdx ? activeChunkRef : null}
                        className={`transition-all duration-500 ${idx === currentChunkIdx ? 'scale-100 opacity-100' : 'opacity-80'}`}
                      >
                        <div className="flex justify-between items-end mb-2 px-2">
                           <div className="flex flex-col">
                             <span className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase">{chunk.sourceFileName || `FRAGMENT #${idx + 1}`}</span>
                             <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">Długość: {chunk.originalText.length.toLocaleString()} znaków</span>
                           </div>
                           
                           {chunk.status === 'processing' && <span className="text-brand-600 dark:text-brand-400 text-xs flex items-center gap-1"><Loader2 size={12} className="animate-spin"/> Tłumaczenie...</span>}
                           {chunk.status === 'completed' && <span className="text-green-600 dark:text-green-400 text-xs flex items-center gap-1"><CheckCircle2 size={12}/> Gotowe</span>}
                           {chunk.status === 'error' && <span className="text-red-500 dark:text-red-400 text-xs flex items-center gap-1"><AlertTriangle size={12}/> Błąd</span>}
                        </div>

                        <div className="grid grid-cols-2 gap-6">
                           <div className="bg-white dark:bg-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                              <div className="font-serif text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                {chunk.originalText}
                              </div>
                           </div>

                           <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden flex flex-col transition-colors ${chunk.status === 'processing' ? 'ring-2 ring-brand-400 dark:ring-brand-600' : ''}`}>
                              {chunk.status === 'pending' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 z-10 backdrop-blur-[1px]">
                                   <p className="text-gray-300 dark:text-gray-600 text-sm font-medium">Oczekuje...</p>
                                </div>
                              )}
                              
                              {chunk.translatedText && (
                                <div className="bg-gray-50 dark:bg-gray-900 px-3 py-1 border-b border-gray-100 dark:border-gray-700 flex justify-end">
                                   <span className="text-[10px] text-gray-400 dark:text-gray-500 flex items-center gap-1 uppercase tracking-wider"><Pencil size={10}/> Edytowalny</span>
                                </div>
                              )}

                              <textarea 
                                className="w-full h-full p-6 font-serif text-gray-900 dark:text-gray-100 bg-transparent text-base leading-relaxed resize-none outline-none focus:bg-brand-50/10 dark:focus:bg-brand-900/10 transition-colors placeholder-gray-400 dark:placeholder-gray-600"
                                value={chunk.translatedText || ''}
                                onChange={(e) => handleChunkEdit(chunk.id, e.target.value)}
                                placeholder={chunk.status === 'processing' ? "Generowanie tłumaczenia..." : ""}
                                readOnly={chunk.status === 'pending'}
                                rows={chunk.originalText.split('\n').length + 5} 
                              />
                           </div>
                        </div>
                     </div>
                   ))}

                   {/* Review Stage Footer */}
                   {stage === 'review' && (
                     <div className="text-center py-10 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 mt-10">
                       <h3 className="text-2xl font-serif text-gray-800 dark:text-gray-100 mb-4">Tłumaczenie Zakończone</h3>
                       <p className="text-gray-500 dark:text-gray-400 mb-6">Cały manuskrypt został przetworzony. Sprawdź i pobierz.</p>
                       <div className="flex justify-center gap-4 flex-wrap">
                         <button 
                            onClick={handleExportTxt}
                            className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border border-gray-300 dark:border-gray-600 px-8 py-3 rounded-full font-bold shadow-sm hover:bg-gray-200 dark:hover:bg-gray-600 transition-transform hover:scale-105 flex items-center gap-2"
                         >
                           <FileType size={16} /> Pobierz TXT
                         </button>
                         <button 
                            onClick={handleExportDocx}
                            disabled={isExporting}
                            className="bg-brand-600 text-white px-8 py-3 rounded-full font-bold shadow-lg hover:bg-brand-700 transition-transform hover:scale-105 flex items-center gap-2"
                         >
                           {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />} Pobierz DOCX
                         </button>
                         
                         <div className="w-full basis-full h-4"></div> {/* Spacer */}
                         
                         <button 
                            onClick={handleResetProject}
                            className="text-gray-500 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 text-sm flex items-center gap-2 py-2 px-4 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                         >
                            <Home size={16} /> Wróć do Strony Głównej
                         </button>
                       </div>
                     </div>
                   )}
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
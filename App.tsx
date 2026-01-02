import React, { useState, useEffect, useRef } from 'react';
import { AppStage, TranslationConfig, BookGenre, ChunkData, GlossaryItem, ProcessingStats, RawFile } from './types';
import { chunkText, getLookback, downloadFile, saveBlob, generateDocxBlob, mergeGlossaryItems } from './utils/textProcessing';
import { translateChunk, detectGlossaryTerms, extractGlossaryPairs } from './services/geminiService';
import FileUpload from './components/FileUpload';
import ConfigPanel from './components/ConfigPanel';
import GlossarySidebar from './components/GlossarySidebar';
import { Download, Play, Pause, AlertTriangle, CheckCircle2, Loader2, ArrowLeft, Sparkles, FileType, Pencil, Clock } from 'lucide-react';

// Default configuration
const DEFAULT_CONFIG: TranslationConfig = {
  apiKey: '',
  model: '', 
  genre: BookGenre.FICTION_LITERARY,
  tone: 'Wierny stylowi oryginału',
  glossary: [],
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
  const [lastAutoAddedTerms, setLastAutoAddedTerms] = useState<number>(0);
  const [isExporting, setIsExporting] = useState(false);
  
  // ETR State
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);
  const [sessionStartChunkIdx, setSessionStartChunkIdx] = useState<number>(0);
  const [estimatedTimeRemaining, setEstimatedTimeRemaining] = useState<string>('--:--');

  const activeChunkRef = useRef<HTMLDivElement>(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  // Handle Play/Pause ETR logic
  useEffect(() => {
    if (isProcessing && sessionStartTime === null) {
      setSessionStartTime(Date.now());
      setSessionStartChunkIdx(currentChunkIdx);
    } else if (!isProcessing) {
      setSessionStartTime(null); // Reset when paused so we recalculate fresh on resume
    }
  }, [isProcessing, currentChunkIdx]);

  const handleFileLoaded = async (files: RawFile[], name: string) => {
    setRawFiles(files);
    setFileName(name);
    setStage('config');
  };

  const startPipeline = async () => {
    // 1. Chunk all files
    // We iterate through each source file (chapter) and chunk it independently
    let globalChunkId = 0;
    const allChunks: ChunkData[] = [];

    for (const file of rawFiles) {
      // Pass the chapterPattern to the chunker
      const fileChunks = chunkText(file.content, config.chunkSize, config.chapterPattern);
      
      // Map to ChunkData with global ID
      fileChunks.forEach(c => {
        // If the chunker didn't detect chapters (sourceFileName undefined) or it was sub-chunked, 
        // we might want to preserve the original filename if it's a zip import
        let displaySource = c.sourceFileName;
        
        // If we are processing a zip file with multiple files, prefer the file name
        // UNLESS semantic chunking found a specific chapter inside that file.
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
    
    // Initial glossary detection (use the first file or first 30k chars of combined)
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

  // ETR Calculation Helper
  const updateETR = () => {
    if (!sessionStartTime || currentChunkIdx <= sessionStartChunkIdx) {
      setEstimatedTimeRemaining("Obliczanie...");
      return;
    }

    const chunksProcessedInSession = currentChunkIdx - sessionStartChunkIdx;
    const timeElapsed = Date.now() - sessionStartTime;
    
    // Average ms per chunk
    const avgTimePerChunk = timeElapsed / chunksProcessedInSession;
    
    // Remaining
    const chunksLeft = chunks.length - currentChunkIdx;
    const timeLeftMs = avgTimePerChunk * chunksLeft;
    
    // Format
    const minutes = Math.floor(timeLeftMs / 60000);
    const seconds = Math.floor((timeLeftMs % 60000) / 1000);
    
    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      setEstimatedTimeRemaining(`~${hours}h ${minutes % 60}m`);
    } else {
      setEstimatedTimeRemaining(`~${minutes}m ${seconds}s`);
    }
  };

  // The Translation Engine Effect
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

      // Skip if already done
      if (chunk.status === 'completed') {
        setCurrentChunkIdx(prev => prev + 1);
        return;
      }

      try {
        setChunks(prev => prev.map(c => c.id === chunk.id ? { ...c, status: 'processing' } : c));
        setProcessingError(null);

        // Calculate Lookback
        let lookbackText = "";
        if (currentChunkIdx > 0) {
           const prevChunk = chunks[currentChunkIdx - 1];
           lookbackText = getLookback(prevChunk.originalText, configRef.current.lookbackSize);
        }

        // 1. Translate
        const translatedText = await translateChunk({
          chunkText: chunk.originalText,
          lookbackText,
          genre: configRef.current.genre,
          tone: configRef.current.tone,
          glossary: configRef.current.glossary,
          apiKey: configRef.current.apiKey,
          model: configRef.current.model
        });

        if (!isMounted) return;

        // 2. Auto-Update Glossary
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
          console.warn("Glossary auto-update skipped for chunk", glossaryErr);
        }

        // 3. Mark Complete
        setChunks(prev => prev.map(c => c.id === chunk.id ? { 
          ...c, 
          status: 'completed', 
          translatedText: translatedText 
        } : c));

        await new Promise(r => setTimeout(r, 5000)); // Rate limit buffer

        if (isMounted) {
           updateETR(); // Update ETR statistics after chunk completion
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
  }, [isProcessing, currentChunkIdx, chunks.length]); 

  // Auto-scroll
  useEffect(() => {
    if (stage === 'processing' && activeChunkRef.current) {
      activeChunkRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentChunkIdx, stage]);

  const handleChunkEdit = (id: number, newText: string) => {
    setChunks(prev => prev.map(c => c.id === id ? { ...c, translatedText: newText } : c));
  };

  // Total Chars for Display
  const totalChars = rawFiles.reduce((acc, f) => acc + f.content.length, 0);

  const getTranslatedText = () => chunks.map(c => c.translatedText || '').join('\n\n');
  const getBaseName = () => fileName.replace(/\.[^/.]+$/, "");

  const handleExportTxt = () => {
    const fullTranslation = getTranslatedText();
    downloadFile(`${getBaseName()}_translated.txt`, fullTranslation);
  };

  const handleExportDocx = async () => {
    setIsExporting(true);
    try {
      const fullTranslation = getTranslatedText();
      const blob = await generateDocxBlob(fullTranslation);
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

  return (
    <div className="flex h-screen w-full bg-gray-100 dark:bg-gray-950 transition-colors duration-300">
      
      {stage !== 'upload' && (
        <GlossarySidebar 
          items={config.glossary}
          onAdd={(item) => setConfig(prev => ({ ...prev, glossary: [...prev.glossary, item] }))}
          onRemove={(id) => setConfig(prev => ({ ...prev, glossary: prev.glossary.filter(g => g.id !== id) }))}
          onUpdate={() => {}} 
        />
      )}

      <div className={`flex-1 flex flex-col h-full overflow-hidden transition-all ${stage !== 'upload' ? 'mr-12' : ''}`}>
        
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-4 flex justify-between items-center shadow-sm z-10 flex-shrink-0 transition-colors">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 bg-brand-600 rounded-lg flex items-center justify-center text-white font-serif font-bold shadow-lg shadow-brand-500/30">L</div>
             <h1 className="font-serif font-bold text-gray-800 dark:text-gray-100">Lumina <span className="text-gray-400 dark:text-gray-500 font-sans font-normal text-sm">| Tłumacz Książek</span></h1>
          </div>
          
          {stage === 'processing' || stage === 'review' ? (
            <div className="flex items-center gap-4">
               {lastAutoAddedTerms > 0 && (
                  <div className="animate-fade-in-down flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800 text-amber-700 dark:text-amber-400 rounded-full text-xs font-medium">
                    <Sparkles size={12} />
                    Auto-dodano {lastAutoAddedTerms} terminów
                  </div>
               )}

               {/* Progress & ETR */}
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
               
               {isProcessing ? (
                 <button onClick={() => setIsProcessing(false)} className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 border border-gray-200 dark:border-gray-700 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                   <Pause size={18} />
                 </button>
               ) : (stage !== 'review' &&
                 <button onClick={() => setIsProcessing(true)} className="p-2 text-brand-500 dark:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-md transition-colors">
                   <Play size={18} />
                 </button>
               )}

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
                   
                   {processingError && (
                     <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 p-4 rounded-lg flex items-center gap-3 mb-6 sticky top-0 z-20 shadow-md backdrop-blur-sm">
                        <AlertTriangle className="flex-shrink-0" />
                        <div className="flex-1">
                          <p className="font-bold">Błąd Przetwarzania</p>
                          <p className="text-sm">{processingError}</p>
                          {processingError.includes('404') && (
                            <p className="text-xs mt-1 italic">Wskazówka: Model "gpt-4.1" może nie istnieć. Spróbuj "gpt-4o" lub "gpt-4-turbo" w Konfiguracji.</p>
                          )}
                          {processingError.includes('Rate limit') && (
                            <p className="text-xs mt-1 italic">Czekamy na reset limitu (quota). Kliknij Ponów lub Play za kilka sekund.</p>
                          )}
                        </div>
                        <button onClick={() => setIsProcessing(true)} className="underline font-bold whitespace-nowrap hover:text-red-800 dark:hover:text-red-200">Ponów</button>
                     </div>
                   )}

                   {chunks.map((chunk, idx) => (
                     <div 
                        key={chunk.id} 
                        ref={idx === currentChunkIdx ? activeChunkRef : null}
                        className={`transition-all duration-500 ${idx === currentChunkIdx ? 'scale-100 opacity-100' : 'opacity-80'}`}
                      >
                        {/* Status Header for Chunk */}
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
                           {/* Original */}
                           <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 transition-colors">
                              <div className="font-serif text-gray-600 dark:text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                {chunk.originalText}
                              </div>
                           </div>

                           {/* Translation (Editable) */}
                           <div className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 relative overflow-hidden flex flex-col transition-colors ${chunk.status === 'processing' ? 'ring-2 ring-brand-400 dark:ring-brand-600' : ''}`}>
                              {chunk.status === 'pending' && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-50/50 dark:bg-gray-900/50 z-10 backdrop-blur-[1px]">
                                   <p className="text-gray-300 dark:text-gray-600 text-sm font-medium">Oczekuje...</p>
                                </div>
                              )}
                              
                              {/* Edit Toolbar Indicator */}
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

                   {stage === 'review' && (
                     <div className="text-center py-10">
                       <h3 className="text-2xl font-serif text-gray-800 dark:text-gray-100 mb-4">Tłumaczenie Zakończone</h3>
                       <p className="text-gray-500 dark:text-gray-400 mb-6">Cały manuskrypt został przetworzony. Sprawdź i pobierz.</p>
                       <div className="flex justify-center gap-4">
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
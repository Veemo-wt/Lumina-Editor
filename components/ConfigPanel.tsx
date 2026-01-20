import React, { useMemo, useState } from 'react';
import { BookGenre, TranslationConfig, CharacterTrait } from '../types';
import { 
  Settings, Sliders, Key, Box, Regex, 
  FileText, BookOpen, Feather, ChevronDown, Check,
  Zap, Brain, Sparkles, LayoutTemplate, Users, AlertOctagon
} from 'lucide-react';

interface Props {
  config: TranslationConfig;
  onChange: (newConfig: TranslationConfig) => void;
  onStart: () => void;
  fileName: string;
  charCount: number;
}

interface ModelDef {
  id: string;
  name: string;
  input: number; // Price per 1M
  cachedInput: number; // Price per 1M
  output: number; // Price per 1M
  maxOutput: number; // Max output tokens
  context: string;
  desc: string;
  tags: ('balanced' | 'smart' | 'fast' | 'next-gen')[];
}

// Comprehensive Model Database
const MODELS_DB: ModelDef[] = [
  // --- FLAGSHIPS (GPT-5) ---
  { 
    id: 'gpt-5.2', 
    name: 'GPT-5.2', 
    input: 1.75, cachedInput: 0.85, output: 14.00, 
    maxOutput: 128000,
    context: '400k', 
    desc: 'Flagowiec. 272k Input / 128k Output. Idealny do dużych chunków.',
    tags: ['balanced', 'next-gen']
  },
  { 
    id: 'gpt-5.1', 
    name: 'GPT-5.1', 
    input: 1.25, cachedInput: 0.60, output: 10.00, 
    maxOutput: 128000,
    context: '400k', 
    desc: 'Wysoka wydajność. Limit outputu 128k pozwala na stabilną pracę.',
    tags: ['balanced']
  },
  
  // --- REASONING / PRO ---
  { 
    id: 'gpt-5.2-pro', 
    name: 'GPT-5.2 Pro', 
    input: 21.00, cachedInput: 10.50, output: 168.00, 
    maxOutput: 128000,
    context: '400k', 
    desc: 'Najwyższa jakość literacka. Wolny, ale bardzo dokładny.',
    tags: ['smart', 'next-gen']
  },

  // --- LEGACY / STABLE ---
  { 
    id: 'gpt-4o', 
    name: 'GPT-4o', 
    input: 2.50, cachedInput: 1.25, output: 10.00, 
    maxOutput: 4096, // Conservative default
    context: '128k', 
    desc: 'Klasyk. Uwaga: Mały limit outputu (~4k tokenów), wymaga małych chunków.',
    tags: ['balanced']
  },
  { 
    id: 'gpt-4o-2024-08-06', 
    name: 'GPT-4o (16k)', 
    input: 2.50, cachedInput: 1.25, output: 10.00, 
    maxOutput: 16384,
    context: '128k', 
    desc: 'Wersja ze zwiększonym limitem outputu do 16k tokenów.',
    tags: ['balanced']
  },

  // --- ECONOMY ---
  { 
    id: 'gpt-5-mini', 
    name: 'GPT-5 Mini', 
    input: 0.25, cachedInput: 0.10, output: 2.00, 
    maxOutput: 64000,
    context: '400k', 
    desc: 'Szybki i tani. Dobry kompromis.',
    tags: ['fast']
  },
];

const ConfigPanel: React.FC<Props> = ({ config, onChange, onStart, fileName, charCount }) => {
  const [showModelList, setShowModelList] = useState(false);
  const [isBibleOpen, setIsBibleOpen] = useState(false);
  
  // Character Bible Temp State
  const [newTrait, setNewTrait] = useState<Partial<CharacterTrait>>({ gender: 'male' });

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onChange({ ...config, genre: e.target.value as BookGenre });
  };

  const handleToneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...config, tone: e.target.value });
  };

  const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...config, apiKey: e.target.value });
  };

  const handleModelSelect = (modelId: string) => {
    onChange({ ...config, model: modelId });
    setShowModelList(false);
  };

  const handleChunkSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...config, chunkSize: Number(e.target.value) });
  };

  const handleLookbackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...config, lookbackSize: Number(e.target.value) });
  };

  const handlePatternChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...config, chapterPattern: e.target.value });
  };

  // Add Character to Bible
  const addCharacter = () => {
    if (!newTrait.name || !newTrait.polishName) return;
    const trait: CharacterTrait = {
      id: Date.now().toString(),
      name: newTrait.name,
      polishName: newTrait.polishName,
      gender: newTrait.gender || 'male',
      age: newTrait.age,
      role: newTrait.role,
      speechStyle: newTrait.speechStyle,
      notes: newTrait.notes
    };
    
    onChange({
      ...config,
      characterBible: [...(config.characterBible || []), trait]
    });
    setNewTrait({ gender: 'male' }); // Reset
  };

  const removeCharacter = (id: string) => {
    onChange({
      ...config,
      characterBible: (config.characterBible || []).filter(c => c.id !== id)
    });
  };

  // Model Info & Safety Logic
  const { modelInfo, chunkStatus, safetyWarning } = useMemo(() => {
    const inputModel = config.model.toLowerCase().trim();
    
    // Find model definition
    let modelDef = MODELS_DB.find(m => m.id === inputModel);
    
    // Fallback
    if (!modelDef) {
       const fuzzy = MODELS_DB.find(m => inputModel.includes(m.id));
       modelDef = fuzzy || { 
         id: 'custom', name: 'Custom/Unknown', 
         input: 2.50, cachedInput: 1.25, output: 10.00, 
         maxOutput: 4096, 
         context: '?', desc: 'Ceny domyślne', tags: [] 
       };
    }

    // Safety Checks
    const estimatedOutputTokens = config.chunkSize / 3.5; 
    const maxOut = modelDef.maxOutput;
    
    let status = { color: 'text-emerald-600 dark:text-emerald-400', text: 'Bezpieczny (Szybki)' };
    let warning = null;

    if (estimatedOutputTokens > maxOut) {
       status = { color: 'text-red-600 dark:text-red-400', text: 'KRYTYCZNY: Przekracza limit modelu!' };
       warning = `Wybrany Chunk (${config.chunkSize} znaków ≈ ${Math.round(estimatedOutputTokens)} tokenów) przekracza limit generowania modelu ${modelDef.name} (${maxOut} tokenów). Tłumaczenie zostanie ucięte. Zmniejsz chunk lub zmień model.`;
    } 
    else if (estimatedOutputTokens > maxOut * 0.8) {
       status = { color: 'text-amber-600 dark:text-amber-400', text: 'Ryzykowny (Blisko limitu)' };
    }
    else if (config.chunkSize > 50000) {
       status = { color: 'text-blue-600 dark:text-blue-400', text: 'Duży Kontekst (GPT-5/High-End)' };
    }

    return { 
      modelInfo: modelDef,
      chunkStatus: status, 
      safetyWarning: warning 
    };
  }, [config.model, config.chunkSize]);

  const getTagIcon = (tag: string) => {
    switch(tag) {
      case 'balanced': return <LayoutTemplate size={12} className="text-blue-500 dark:text-blue-400"/>;
      case 'smart': return <Brain size={12} className="text-purple-500 dark:text-purple-400"/>;
      case 'fast': return <Zap size={12} className="text-amber-500 dark:text-amber-400"/>;
      case 'next-gen': return <Sparkles size={12} className="text-emerald-500 dark:text-emerald-400"/>;
      default: return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-visible relative transition-colors">
      
      {/* Header */}
      <div className="p-6 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 flex justify-between items-center transition-colors">
        <div>
           <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <Settings size={20} className="text-brand-600 dark:text-brand-500" />
            Konfiguracja Projektu
           </h2>
           <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-2">
             <FileText size={14} className="text-gray-400 dark:text-gray-500"/>
             Plik: <span className="font-mono text-gray-700 dark:text-gray-300 font-medium">{fileName}</span> 
             <span className="bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-[10px] px-1.5 py-0.5 rounded-full">{charCount.toLocaleString()} znaków</span>
           </p>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
           
           {/* API Key */}
           <div>
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
               <Key size={16} className="text-brand-600 dark:text-brand-500" /> 
               Klucz API OpenAI
             </label>
             <input 
              type="password" 
              value={config.apiKey}
              onChange={handleApiKeyChange}
              placeholder="sk-..."
              className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-mono text-sm transition-colors"
            />
           </div>

           {/* Model Selection - Smart Dropdown */}
           <div className="relative">
             <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
               <Box size={16} className="text-brand-600 dark:text-brand-500" /> 
               Model AI
             </label>
             
             <div className="relative">
               <input 
                  type="text" 
                  value={config.model}
                  onChange={(e) => {
                    onChange({ ...config, model: e.target.value });
                    setShowModelList(true);
                  }}
                  onFocus={() => setShowModelList(true)}
                  placeholder="Wpisz ID lub wybierz..."
                  className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-mono text-sm pr-10 transition-colors"
                />
                <button 
                  onClick={() => setShowModelList(!showModelList)}
                  className="absolute right-3 top-3 text-gray-400 hover:text-brand-500 dark:hover:text-brand-400"
                >
                  <ChevronDown size={18} />
                </button>
             </div>

             {/* Smart Model List Dropdown */}
             {showModelList && (
               <div className="absolute z-50 mt-2 w-[140%] -left-[20%] md:left-0 md:w-full bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 max-h-[400px] overflow-y-auto divide-y divide-gray-100 dark:divide-gray-700 animate-in fade-in slide-in-from-top-2">
                  <div className="sticky top-0 bg-gray-50 dark:bg-gray-900 p-2 text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider border-b border-gray-100 dark:border-gray-700">
                    Wybierz Model do Tłumaczenia
                  </div>
                  {MODELS_DB.map(m => (
                    <button 
                      key={m.id}
                      onClick={() => handleModelSelect(m.id)}
                      className={`w-full text-left p-3 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors flex items-start gap-3 group ${config.model === m.id ? 'bg-brand-50/50 dark:bg-brand-900/20' : ''}`}
                    >
                      <div className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${config.model === m.id ? 'border-brand-500 bg-brand-500 text-white' : 'border-gray-300 dark:border-gray-600'}`}>
                        {config.model === m.id && <Check size={10} />}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="font-bold text-gray-800 dark:text-gray-200 text-sm">{m.name}</span>
                          <span className="font-mono text-[10px] text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 px-1.5 rounded">{m.id}</span>
                        </div>
                        
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug mb-2">{m.desc}</p>
                        
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                           <span className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-1.5 py-0.5 rounded border border-gray-200 dark:border-gray-600" title="Wielkość kontekstu">
                             <Box size={10} /> {m.context}
                           </span>
                           <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400" title="Limit tokenów wyjściowych">
                             Max Out: <span className="font-bold text-brand-600 dark:text-brand-400">{m.maxOutput.toLocaleString()}</span>
                           </span>
                           <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400 ml-auto" title="Cena za 1M tokenów (bez cache)">
                             <span className="font-medium text-gray-700 dark:text-gray-300">${m.input} In</span> / 
                             <span className="font-medium text-gray-700 dark:text-gray-300">${m.output} Out</span>
                           </span>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 items-end">
                        {m.tags.map(t => (
                          <div key={t} title={t} className="bg-white dark:bg-gray-700 p-1 rounded-md border border-gray-100 dark:border-gray-600 shadow-sm">
                            {getTagIcon(t)}
                          </div>
                        ))}
                      </div>
                    </button>
                  ))}
               </div>
             )}
           </div>
        </div>

        {/* Genre Selection */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <BookOpen size={16} className="text-brand-600 dark:text-brand-500" />
            Gatunek Literacki
          </label>
          <select 
            value={config.genre} 
            onChange={handleGenreChange}
            className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none bg-white transition-colors"
          >
            {Object.values(BookGenre).map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">Dostosowuje słownictwo i styl narracji.</p>
        </div>

        {/* Character Bible Config Section */}
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
           <button 
             onClick={() => setIsBibleOpen(!isBibleOpen)}
             className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-left"
           >
             <div className="flex items-center gap-2 font-medium text-gray-700 dark:text-gray-200">
                <Users size={16} className="text-brand-600 dark:text-brand-500" />
                Biblia Postaci ({config.characterBible?.length || 0})
             </div>
             <ChevronDown size={16} className={`transition-transform ${isBibleOpen ? 'rotate-180' : ''}`}/>
           </button>
           
           {isBibleOpen && (
             <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 space-y-4 animate-in slide-in-from-top-2">
                <p className="text-xs text-gray-500 mb-2">
                  Zdefiniuj kluczowe postacie, aby zapewnić spójność płci, wieku i stylu wypowiedzi.
                </p>

                {/* Mini Form */}
                <div className="grid grid-cols-2 gap-2">
                   <input 
                     placeholder="Imię (Oryginał)" 
                     className="p-2 text-xs border rounded dark:bg-gray-800 dark:border-gray-700"
                     value={newTrait.name || ''}
                     onChange={e => setNewTrait({...newTrait, name: e.target.value})}
                   />
                   <input 
                     placeholder="Imię (Polskie)" 
                     className="p-2 text-xs border rounded dark:bg-gray-800 dark:border-gray-700"
                     value={newTrait.polishName || ''}
                     onChange={e => setNewTrait({...newTrait, polishName: e.target.value})}
                   />
                   <select 
                     className="p-2 text-xs border rounded dark:bg-gray-800 dark:border-gray-700"
                     value={newTrait.gender}
                     onChange={e => setNewTrait({...newTrait, gender: e.target.value as any})}
                   >
                     <option value="male">Mężczyzna</option>
                     <option value="female">Kobieta</option>
                     <option value="neutral">Nijaki</option>
                   </select>
                   <input 
                     placeholder="Styl (np. Gwara, Formalny)" 
                     className="p-2 text-xs border rounded dark:bg-gray-800 dark:border-gray-700"
                     value={newTrait.speechStyle || ''}
                     onChange={e => setNewTrait({...newTrait, speechStyle: e.target.value})}
                   />
                </div>
                <button 
                  onClick={addCharacter}
                  disabled={!newTrait.name || !newTrait.polishName}
                  className="w-full py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-xs font-bold rounded transition-colors disabled:opacity-50"
                >
                  Dodaj Postać
                </button>

                {/* List */}
                <div className="max-h-40 overflow-y-auto space-y-1 mt-2">
                   {config.characterBible?.map(c => (
                     <div key={c.id} className="flex justify-between items-center text-xs p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-100 dark:border-gray-700">
                        <span><strong>{c.name}</strong> ({c.gender === 'female' ? 'K' : c.gender === 'male' ? 'M' : 'Nb'})</span>
                        <button onClick={() => removeCharacter(c.id)} className="text-red-400 hover:text-red-600">Usuń</button>
                     </div>
                   ))}
                </div>
             </div>
           )}
        </div>

        {/* Tone/Style */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Feather size={16} className="text-brand-600 dark:text-brand-500" />
            Ton i Styl (Instrukcje)
          </label>
          <input 
            type="text" 
            value={config.tone}
            onChange={handleToneChange}
            placeholder="np. Mroczny, Szorstki, Język archaizowany, Humorystyczny..."
            className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none transition-colors"
          />
        </div>
        
        {/* Chapter Detection Pattern */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <Regex size={16} className="text-brand-600 dark:text-brand-500" /> 
            Wzorzec Wykrywania Rozdziałów (Regex)
          </label>
          <div className="relative">
             <input 
              type="text" 
              value={config.chapterPattern || ''}
              onChange={handlePatternChange}
              placeholder="np. (Chapter|Rozdział|Part) \d+"
              className="w-full p-3 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-mono text-sm transition-colors"
            />
          </div>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Definiuje miejsce podziału pliku. Wielkość liter ignorowana. Zostaw puste dla podziału tylko wg rozmiaru.
            <br/>System automatycznie wymusza "Początek Linii" (^), aby uniknąć fałszywych dopasowań w treści.
          </p>
        </div>

        {/* Advanced Settings (Sliders) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-gray-100 dark:border-gray-700 transition-colors">
           
           {/* Chunk Size */}
           <div>
              <div className="flex justify-between items-center mb-3 min-h-[40px]">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase leading-tight max-w-[65%]">
                    <Sliders size={14} className="flex-shrink-0" /> Limit Znaków (Chunk)
                  </label>
                  <span className={`text-xs font-mono font-bold px-2 py-1 rounded whitespace-nowrap border ${safetyWarning ? 'bg-red-50 text-red-600 border-red-200' : 'bg-brand-50 text-brand-700 border-transparent dark:bg-brand-900/30 dark:text-brand-300'}`}>
                    {config.chunkSize.toLocaleString()} znaków
                  </span>
              </div>
              <input 
                type="range" 
                min="5000" 
                max="100000" 
                step="5000"
                value={config.chunkSize} 
                onChange={handleChunkSizeChange}
                className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${safetyWarning ? 'bg-red-200 dark:bg-red-900/50' : 'bg-gray-200 dark:bg-gray-700'}`}
              />
              <div className="flex justify-between items-center mt-2">
                 <span className={`text-[10px] font-bold ${chunkStatus.color} flex items-center gap-1`}>
                   {safetyWarning && <AlertOctagon size={12}/>}
                   {chunkStatus.text}
                 </span>
              </div>
              {safetyWarning && (
                <div className="mt-2 text-[10px] text-red-500 bg-red-50 dark:bg-red-900/20 p-2 rounded border border-red-100 dark:border-red-800 leading-snug">
                  {safetyWarning}
                </div>
              )}
           </div>

           {/* Lookback Size */}
           <div>
              <div className="flex justify-between items-center mb-3 min-h-[40px]">
                  <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase leading-tight max-w-[65%]">
                    <Sliders size={14} className="flex-shrink-0" /> Kontekst Wsteczny (Lookback)
                  </label>
                  <span className="text-xs font-mono font-bold text-brand-700 dark:text-brand-300 bg-brand-50 dark:bg-brand-900/30 px-2 py-1 rounded whitespace-nowrap">
                    {config.lookbackSize.toLocaleString()} znaków
                  </span>
              </div>
              <input 
                type="range" 
                min="5000" 
                max="30000" 
                step="1000"
                value={config.lookbackSize} 
                onChange={handleLookbackChange}
                className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
               <div className="flex justify-between text-[10px] text-gray-400 dark:text-gray-500 mt-2">
                 <span>5k (Minimalny)</span>
                 <span>30k (Pełny)</span>
              </div>
           </div>
        </div>

        {/* Start Button Overlay in case modal covers it on small screens (not needed here due to absolute positioning, but good for padding) */}
        <div className="mt-4">
          <button 
            onClick={onStart}
            disabled={!config.apiKey || !!safetyWarning}
            className="w-full bg-brand-600 hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-700 disabled:bg-gray-300 dark:disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex flex-col items-center justify-center gap-1"
          >
            <span>Inicjalizuj i Rozpocznij Tłumaczenie</span>
            {safetyWarning && <span className="text-[10px] opacity-80 font-normal">Zablokowane: Chunk przekracza limit outputu modelu</span>}
          </button>
        </div>
        
      </div>
      
      {/* Click outside handler for dropdown could be added to window, but simplified here by onBlur/Focus structure or conditional rendering */}
      {showModelList && (
        <div className="fixed inset-0 z-40" onClick={() => setShowModelList(false)}></div>
      )}
    </div>
  );
};

export default ConfigPanel;
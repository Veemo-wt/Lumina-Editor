import React, { useMemo, useState } from 'react';
import { BookGenre, TranslationConfig, CharacterTrait } from '../types';
import { MODELS_DB, ModelDef } from '../utils/models';
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



const ConfigPanel: React.FC<Props> = ({ config, onChange, onStart, fileName, charCount }) => {
  const [showModelList, setShowModelList] = useState(false);
  const [isBibleOpen, setIsBibleOpen] = useState(false);

  // Character Bible Temp State
  const [newTrait, setNewTrait] = useState<Partial<CharacterTrait>>({ gender: 'male' });

  // Unused handlers removed

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
    switch (tag) {
      case 'balanced': return <LayoutTemplate size={12} className="text-blue-500 dark:text-blue-400" />;
      case 'smart': return <Brain size={12} className="text-purple-500 dark:text-purple-400" />;
      case 'fast': return <Zap size={12} className="text-amber-500 dark:text-amber-400" />;
      case 'next-gen': return <Sparkles size={12} className="text-emerald-500 dark:text-emerald-400" />;
      default: return null;
    }
  };

  return (
    <div className="max-w-3xl mx-auto my-6 bg-white dark:bg-slate-900 rounded-xl shadow-lg border border-slate-200 dark:border-slate-800 overflow-visible relative transition-colors">

      {/* Header */}
      <div className="p-6 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex justify-between items-center transition-colors">
        <div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Settings size={20} className="text-brand-600 dark:text-brand-500" />
            Konfiguracja Projektu
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
            <FileText size={14} className="text-slate-400 dark:text-slate-500" />
            Plik: <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{fileName}</span>
            <span className="bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[10px] px-1.5 py-0.5 rounded-full">{charCount.toLocaleString()} znaków</span>
          </p>
        </div>
      </div>

      <div className="p-8 space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
              <Key size={16} className="text-brand-600 dark:text-brand-500" />
              Klucz API OpenAI
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={handleApiKeyChange}
              placeholder="sk-..."
              className="w-full p-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-mono text-sm transition-colors shadow-sm"
            />
          </div>

          {/* Model Selection - Smart Dropdown */}
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
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
                className="w-full p-3 border border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-white rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent outline-none font-mono text-sm pr-10 transition-colors shadow-sm"
              />
              <button
                onClick={() => setShowModelList(!showModelList)}
                className="absolute right-3 top-3 text-slate-400 hover:text-brand-500 dark:hover:text-brand-400"
              >
                <ChevronDown size={18} />
              </button>
            </div>

            {/* Smart Model List Dropdown */}
            {showModelList && (
              <div className="absolute z-50 mt-2 w-full md:w-[120%] md:-left-[10%] bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 max-h-[400px] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800 animate-in fade-in slide-in-from-top-2">
                <div className="sticky top-0 bg-slate-50 dark:bg-slate-900/95 backdrop-blur-sm p-2 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider border-b border-slate-100 dark:border-slate-800 z-10">
                  Wybierz Model do Tłumaczenia
                </div>
                {MODELS_DB.map(m => (
                  <button
                    key={m.id}
                    onClick={() => handleModelSelect(m.id)}
                    className={`w-full text-left p-3 hover:bg-brand-50 dark:hover:bg-brand-900/30 transition-colors flex items-start gap-3 group ${config.model === m.id ? 'bg-brand-50/50 dark:bg-brand-900/20' : ''}`}
                  >
                    <div className={`mt-1 w-4 h-4 rounded-full border flex items-center justify-center flex-shrink-0 ${config.model === m.id ? 'border-brand-500 bg-brand-500 text-white' : 'border-slate-300 dark:border-slate-600'}`}>
                      {config.model === m.id && <Check size={10} />}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-slate-800 dark:text-slate-200 text-sm">{m.name}</span>
                        <span className="font-mono text-[10px] text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 rounded">{m.id}</span>
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-snug mb-2">{m.desc}</p>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                        <span className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700" title="Wielkość kontekstu">
                          <Box size={10} /> {m.context}
                        </span>
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400" title="Limit tokenów wyjściowych">
                          Max Out: <span className="font-bold text-brand-600 dark:text-brand-400">{m.maxOutput.toLocaleString()}</span>
                        </span>
                        <span className="flex items-center gap-1 text-slate-500 dark:text-slate-400 ml-auto" title="Cena za 1M tokenów (bez cache)">
                          <span className="font-medium text-slate-700 dark:text-slate-300">${m.input} In</span> /
                          <span className="font-medium text-slate-700 dark:text-slate-300">${m.output} Out</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-col gap-1 items-end">
                      {(m.tags || []).map(t => (
                        <div key={t} title={t} className="bg-white dark:bg-slate-800 p-1 rounded-md border border-slate-100 dark:border-slate-700 shadow-sm">
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

        {/* Scan Options */}
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-4 flex items-center gap-2">
            <Sparkles size={16} className="text-brand-600 dark:text-brand-500" />
            Opcje Skanowania (Co sprawdzać?)
          </label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 dark:bg-slate-800/50 p-4 rounded-lg border border-slate-100 dark:border-slate-700">
            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.scanOptions.checkGrammar}
                onChange={() => onChange({ ...config, scanOptions: { ...config.scanOptions, checkGrammar: !config.scanOptions.checkGrammar } })}
                className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-brand-600 transition-colors">Gramatyka i Składnia</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.scanOptions.checkOrthography}
                onChange={() => onChange({ ...config, scanOptions: { ...config.scanOptions, checkOrthography: !config.scanOptions.checkOrthography } })}
                className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-brand-600 transition-colors">Ortografia i Interpunkcja</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.scanOptions.checkGender}
                onChange={() => onChange({ ...config, scanOptions: { ...config.scanOptions, checkGender: !config.scanOptions.checkGender } })}
                className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-brand-600 transition-colors">Zgodność Płci (Biblia Postaci)</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={config.scanOptions.checkStyle}
                onChange={() => onChange({ ...config, scanOptions: { ...config.scanOptions, checkStyle: !config.scanOptions.checkStyle } })}
                className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-brand-600 transition-colors">Styl i Czytelność</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer group col-span-1 md:col-span-2">
              <input
                type="checkbox"
                checked={config.scanOptions.checkPunctuation}
                onChange={() => onChange({ ...config, scanOptions: { ...config.scanOptions, checkPunctuation: !config.scanOptions.checkPunctuation } })}
                className="w-5 h-5 text-brand-600 rounded focus:ring-brand-500 border-slate-300 dark:border-slate-600 dark:bg-slate-700"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200 group-hover:text-brand-600 transition-colors">Angielska vs Polska Interpunkcja (Dialogi)</span>
            </label>
          </div>
        </div>

        {/* Advanced Settings (Sliders) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-slate-100 dark:border-slate-700 transition-colors">

          {/* Chunk Size */}
          <div>
            <div className="flex justify-between items-center mb-3 min-h-[40px]">
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase leading-tight max-w-[65%]">
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
              className={`w-full h-2 rounded-lg appearance-none cursor-pointer ${safetyWarning ? 'bg-red-200 dark:bg-red-900/50' : 'bg-slate-200 dark:bg-slate-700'}`}
            />
            <div className="flex justify-between items-center mt-2">
              <span className={`text-[10px] font-bold ${chunkStatus.color} flex items-center gap-1`}>
                {safetyWarning && <AlertOctagon size={12} />}
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
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase leading-tight max-w-[65%]">
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
              className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 dark:text-slate-500 mt-2">
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
            className="w-full bg-brand-600 hover:bg-brand-700 dark:bg-brand-600 dark:hover:bg-brand-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-4 rounded-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 flex flex-col items-center justify-center gap-1"
          >
            <span>Inicjalizuj i Rozpocznij Skanowanie</span>
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
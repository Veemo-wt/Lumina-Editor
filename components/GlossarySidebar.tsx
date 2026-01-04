import React, { useState } from 'react';
import { GlossaryItem, CharacterTrait } from '../types';
import { Plus, Trash2, Book, AlertCircle, Info, Sparkles, Download, Upload, Users, Globe, FileJson } from 'lucide-react';

interface Props {
  glossaryItems: GlossaryItem[];
  characterBible: CharacterTrait[];
  onAddGlossary: (item: GlossaryItem) => void;
  onRemoveGlossary: (id: string) => void;
  onRemoveCharacter: (id: string) => void;
  onImportGlossary: (items: GlossaryItem[]) => void;
  onImportBible: (items: CharacterTrait[]) => void;
}

const GlossarySidebar: React.FC<Props> = ({ 
  glossaryItems, 
  characterBible,
  onAddGlossary, 
  onRemoveGlossary, 
  onRemoveCharacter,
  onImportGlossary,
  onImportBible
}) => {
  const [isOpen, setIsOpen] = useState(true);
  const [activeTab, setActiveTab] = useState<'glossary' | 'bible'>('glossary');
  
  // Form State
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');
  const [category, setCategory] = useState<GlossaryItem['category']>('character');
  const [description, setDescription] = useState('');
  const [fileImportError, setFileImportError] = useState<string | null>(null);

  const handleAdd = () => {
    if (!term || !translation) return;
    onAddGlossary({
      id: Date.now().toString(),
      term,
      translation,
      category,
      description
    });
    // Reset form
    setTerm('');
    setTranslation('');
    setDescription('');
    setCategory('character');
  };

  const handleExportCSV = () => {
    const header = "Term;Translation;Category;Description\n";
    const rows = glossaryItems.map(i => 
      `"${i.term}";"${i.translation}";"${i.category}";"${i.description || ''}"`
    ).join("\n");
    
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "glossary_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleExportWorld = () => {
    const worldData = {
      createdAt: new Date().toISOString(),
      version: "1.0",
      project: "Lumina World Knowledge Pack",
      glossary: glossaryItems,
      characterBible: characterBible
    };

    const jsonStr = JSON.stringify(worldData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const link = document.createElement("a");
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", "world_knowledge_pack.json");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const handleImportWorld = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileImportError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const json = JSON.parse(text);

        let importedGlossaryCount = 0;
        let importedBibleCount = 0;

        if (Array.isArray(json.glossary)) {
           onImportGlossary(json.glossary);
           importedGlossaryCount = json.glossary.length;
        }

        if (Array.isArray(json.characterBible)) {
           onImportBible(json.characterBible);
           importedBibleCount = json.characterBible.length;
        }

        if (importedGlossaryCount === 0 && importedBibleCount === 0) {
          setFileImportError("Nie znaleziono poprawnych danych w pliku JSON.");
        }
      } catch (err) {
        setFileImportError("Błąd parsowania pliku JSON. Upewnij się, że to poprawny 'World Knowledge Pack'.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileImportError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const lines = text.split('\n');
        const newItems: GlossaryItem[] = [];
        
        const startIndex = lines[0].toLowerCase().includes('term') ? 1 : 0;

        for (let i = startIndex; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          
          const parts = line.split(';');
          if (parts.length < 2) continue;

          const clean = (s: string) => s ? s.replace(/^"|"$/g, '').trim() : '';

          newItems.push({
            id: `import-${Date.now()}-${i}`,
            term: clean(parts[0]),
            translation: clean(parts[1]),
            category: (clean(parts[2]) as any) || 'other',
            description: clean(parts[3])
          });
        }
        
        if (newItems.length > 0) {
          onImportGlossary(newItems);
        } else {
          setFileImportError("Nie znaleziono poprawnych wpisów.");
        }
      } catch (err) {
        setFileImportError("Błąd parsowania pliku CSV.");
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const getCategoryColor = (cat: string) => {
    switch(cat) {
      case 'character': return 'bg-purple-100 text-purple-700QPborder-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
      case 'location': return 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800';
      case 'event': return 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800';
      case 'object': return 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800';
      default: return 'bg-gray-100 text-gray-600 border-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  const getCategoryLabel = (cat: string) => {
    switch(cat) {
      case 'character': return 'Postać';
      case 'location': return 'Lokacja';
      case 'event': return 'Wydarzenie';
      case 'object': return 'Przedmiot';
      default: return 'Inne';
    }
  };

  return (
    <div className={`fixed right-0 top-0 h-full bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 shadow-xl transition-all duration-300 flex flex-col z-30 ${isOpen ? 'w-96' : 'w-12'}`}>
      
      {/* Toggle Handle */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="absolute -left-3 top-1/2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full p-1 shadow-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <Book size={16} className="text-gray-600 dark:text-gray-400" />
      </button>

      {isOpen ? (
        <>
          <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-800">
            <h2 className="font-serif text-lg font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              <Globe size={18} />
              Baza Wiedzy
            </h2>
            <div className="flex gap-2 mt-3">
              <button 
                onClick={() => setActiveTab('glossary')}
                className={`flex-1 text-xs font-bold py-1.5 px-2 rounded transition-colors ${activeTab === 'glossary' ? 'bg-white dark:bg-gray-700 shadow text-brand-600 dark:text-brand-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                Glosariusz ({glossaryItems.length})
              </button>
              <button 
                onClick={() => setActiveTab('bible')}
                className={`flex-1 text-xs font-bold py-1.5 px-2 rounded transition-colors flex items-center justify-center gap-1 ${activeTab === 'bible' ? 'bg-white dark:bg-gray-700 shadow text-brand-600 dark:text-brand-400' : 'text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
              >
                Biblia ({characterBible.length})
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* GLOBAL ACTIONS (Import/Export World) */}
            <div className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg border border-gray-100 dark:border-gray-800 mb-4">
              <p className="text-[10px] text-gray-400 dark:text-gray-500 uppercase font-bold mb-2">Zarządzanie Światem (Saga)</p>
              <div className="flex gap-2">
                 <button onClick={handleExportWorld} className="flex-1 flex items-center justify-center gap-1 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 text-brand-700 dark:text-brand-400 py-1.5 rounded text-xs border border-gray-200 dark:border-gray-700 transition-colors shadow-sm font-medium" title="Pobierz pełną bazę (Glosariusz + Postacie) w JSON">
                   <FileJson size={12} /> Eksportuj Świat
                 </button>
                 <label className="flex-1 flex items-center justify-center gap-1 bg-brand-600 dark:bg-brand-600 hover:bg-brand-700 dark:hover:bg-brand-500 text-white py-1.5 rounded text-xs transition-colors cursor-pointer shadow-sm font-medium" title="Wczytaj bazę z pliku JSON">
                   <Upload size={12} /> Importuj Świat
                   <input type="file" accept=".json" className="hidden" onChange={handleImportWorld} />
                 </label>
              </div>
            </div>
            
            {fileImportError && <p className="text-xs text-red-500 mb-2 p-2 bg-red-50 dark:bg-red-900/10 rounded border border-red-100 dark:border-red-900/30">{fileImportError}</p>}

            {activeTab === 'glossary' && (
              <>
                 <div className="flex gap-2 mb-4 pt-2 border-t border-gray-100 dark:border-gray-800">
                    <button onClick={handleExportCSV} className="flex-1 flex items-center justify-center gap-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 py-1.5 rounded text-xs border border-gray-200 dark:border-gray-700 transition-colors">
                      <Download size={12} /> Tylko CSV
                    </button>
                    <label className="flex-1 flex items-center justify-center gap-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 py-1.5 rounded text-xs border border-gray-200 dark:border-gray-700 transition-colors cursor-pointer">
                      <Upload size={12} /> Import CSV
                      <input type="file" accept=".csv" className="hidden" onChange={handleImportCSV} />
                    </label>
                 </div>

                 {/* Add New Form */}
                 <div className="bg-brand-50 dark:bg-brand-900/10 p-4 rounded-lg border border-brand-100 dark:border-brand-900/30 shadow-sm transition-colors">
                  <h3 className="text-xs font-bold text-brand-800 dark:text-brand-400 mb-3 uppercase tracking-wide flex items-center gap-1">
                    <Plus size={12} /> Dodaj Nowy Wpis
                  </h3>
                  
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <input 
                        value={term}
                        onChange={e => setTerm(e.target.value)}
                        placeholder="Termin Oryginalny"
                        className="text-sm p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded focus:ring-1 focus:ring-brand-500 outline-none"
                      />
                      <input 
                        value={translation}
                        onChange={e => setTranslation(e.target.value)}
                        placeholder="Polskie Tłumaczenie"
                        className="text-sm p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded focus:ring-1 focus:ring-brand-500 outline-none"
                      />
                    </div>
                    
                    <select 
                      value={category}
                      onChange={e => setCategory(e.target.value as any)}
                      className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded focus:ring-1 focus:ring-brand-500 outline-none bg-white"
                    >
                      <option value="character">Postać</option>
                      <option value="location">Lokacja</option>
                      <option value="event">Wydarzenie</option>
                      <option value="object">Przedmiot</option>
                      <option value="other">Inne</option>
                    </select>

                    <textarea 
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Kontekst (np. 'Główny bohater, mówi gwarą', 'Zamek na północy')"
                      rows={2}
                      className="w-full text-sm p-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-800 dark:text-white rounded focus:ring-1 focus:ring-brand-500 outline-none resize-none"
                    />

                    <button 
                      onClick={handleAdd}
                      disabled={!term || !translation}
                      className="w-full bg-brand-600 dark:bg-brand-600 text-white text-xs font-bold py-2.5 rounded hover:bg-brand-700 dark:hover:bg-brand-500 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      Dodaj do Słownika
                    </button>
                  </div>
                </div>

                {/* List */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Aktywne Terminy</h3>
                  </div>

                  {glossaryItems.length === 0 && (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
                      <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Brak zdefiniowanych terminów.</p>
                    </div>
                  )}

                  {glossaryItems.map((item, idx) => {
                    const isAuto = item.id.startsWith('auto-');
                    return (
                      <div key={item.id || idx} className={`group relative bg-white dark:bg-gray-800 border rounded-lg p-3 hover:shadow-md transition-all ${isAuto ? 'border-brand-200 dark:border-brand-900/40 bg-brand-50/30 dark:bg-brand-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                        
                        {isAuto && (
                          <div className="absolute -top-2 -right-2 bg-brand-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-full shadow-sm flex items-center gap-1">
                            <Sparkles size={8} /> AI
                          </div>
                        )}

                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${getCategoryColor(item.category)} uppercase tracking-wider`}>
                              {getCategoryLabel(item.category)}
                            </span>
                          </div>
                          <button 
                            onClick={() => onRemoveGlossary(item.id)}
                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                            title="Usuń termin"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>

                        <div className="mb-2">
                          <span className="font-bold text-gray-800 dark:text-gray-200">{item.term}</span>
                          <span className="mx-2 text-gray-300 dark:text-gray-600">→</span>
                          <span className="font-medium text-brand-700 dark:text-brand-400">{item.translation}</span>
                        </div>
                        
                        {item.description && (
                          <div className="bg-gray-50 dark:bg-gray-900/50 p-2 rounded text-xs text-gray-600 dark:text-gray-400 italic border border-gray-100 dark:border-gray-700 flex gap-2 items-start">
                            <Info size={12} className="mt-0.5 flex-shrink-0 text-gray-400 dark:text-gray-500"/>
                            {item.description}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {activeTab === 'bible' && (
              <div className="space-y-4">
                 <div className="text-xs text-gray-500 dark:text-gray-400 italic bg-gray-50 dark:bg-gray-800/50 p-3 rounded border border-gray-100 dark:border-gray-700">
                    Definiuje kluczowe cechy postaci, aby zapewnić spójność płci, wieku i stylu wypowiedzi w tłumaczeniu.
                 </div>

                 {characterBible.length === 0 && (
                    <div className="text-center py-8 text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
                      <Users size={24} className="mx-auto mb-2 opacity-50" />
                      <p className="text-xs">Brak zdefiniowanych postaci.</p>
                      <p className="text-[10px] mt-1 opacity-70">Dodaj je w panelu Konfiguracji.</p>
                    </div>
                  )}

                  {characterBible.map(char => (
                    <div key={char.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 hover:shadow-md transition-all">
                       <div className="flex justify-between items-start">
                          <div>
                            <div className="font-bold text-gray-800 dark:text-gray-100 text-sm">{char.name}</div>
                            <div className="text-xs text-brand-600 dark:text-brand-400 font-medium mb-1">PL: {char.polishName}</div>
                          </div>
                          <button 
                            onClick={() => onRemoveCharacter(char.id)}
                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                       </div>
                       
                       <div className="flex gap-2 mt-2">
                          <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300 capitalize">{char.gender}</span>
                          {char.age && <span className="text-[10px] bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-gray-600 dark:text-gray-300">{char.age}</span>}
                       </div>
                       
                       {(char.speechStyle || char.notes) && (
                         <div className="mt-2 pt-2 border-t border-gray-100 dark:border-gray-700 text-xs text-gray-500 dark:text-gray-400 italic">
                            {char.speechStyle && <div>Styl: {char.speechStyle}</div>}
                            {char.notes && <div>Notatki: {char.notes}</div>}
                         </div>
                       )}
                    </div>
                  ))}
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="h-full flex flex-col items-center pt-6">
           <div className="w-1 h-8 bg-gray-200 dark:bg-gray-700 rounded-full mb-2"></div>
           <Book size={20} className="text-gray-400 dark:text-gray-600 mb-4" />
        </div>
      )}
    </div>
  );
};

export default GlossarySidebar;
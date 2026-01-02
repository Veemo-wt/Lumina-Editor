import React, { useState } from 'react';
import { GlossaryItem } from '../types';
import { Plus, Trash2, Book, AlertCircle, Info, Sparkles } from 'lucide-react';

interface Props {
  items: GlossaryItem[];
  onAdd: (item: GlossaryItem) => void;
  onRemove: (id: string) => void;
  onUpdate: (item: GlossaryItem) => void;
}

const GlossarySidebar: React.FC<Props> = ({ items, onAdd, onRemove, onUpdate }) => {
  const [isOpen, setIsOpen] = useState(true);
  
  // Form State
  const [term, setTerm] = useState('');
  const [translation, setTranslation] = useState('');
  const [category, setCategory] = useState<GlossaryItem['category']>('character');
  const [description, setDescription] = useState('');

  const handleAdd = () => {
    if (!term || !translation) return;
    onAdd({
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

  const getCategoryColor = (cat: string) => {
    // Keeping original colors for labels as they are distinct enough, 
    // potentially could add dark variants if contrast is poor, but usually pastels work OK on dark backgrounds if text is dark, 
    // BUT here we have `text-purple-700`. On dark mode, we might want `dark:bg-purple-900 dark:text-purple-200`.
    // Let's refine for better dark mode visibility.
    switch(cat) {
      case 'character': return 'bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-800';
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
              <Book size={18} />
              Słownik i Kontekst
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Zdefiniuj encje dla spójności tłumaczenia.</p>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
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
                <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase">Aktywne Terminy ({items.length})</h3>
              </div>

              {items.length === 0 && (
                <div className="text-center py-8 text-gray-400 dark:text-gray-600 border-2 border-dashed border-gray-100 dark:border-gray-800 rounded-lg">
                  <AlertCircle size={24} className="mx-auto mb-2 opacity-50" />
                  <p className="text-xs">Brak zdefiniowanych terminów.</p>
                </div>
              )}

              {items.map((item, idx) => {
                const isAuto = item.id.startsWith('auto-');
                return (
                  <div key={item.id || idx} className={`group relative bg-white dark:bg-gray-800 border rounded-lg p-3 hover:shadow-md transition-all ${isAuto ? 'border-brand-200 dark:border-brand-900/40 bg-brand-50/30 dark:bg-brand-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
                    
                    {/* Visual indicator for new auto-items */}
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
                        onClick={() => onRemove(item.id)}
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
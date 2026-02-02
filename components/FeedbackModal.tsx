import React, { useState, useEffect } from 'react';
import { X, Send, Bug, Lightbulb, MessageSquare, Loader2, CheckCircle, AlertCircle, AlertTriangle, Download, Settings } from 'lucide-react';
import { submitFeedback, exportFeedbackToFile, FeedbackData, getFeedbackServerUrl, setFeedbackServerUrl, getPendingFeedbacks, exportAllPendingFeedbacks, syncPendingFeedback } from '../services/feedbackService';
import { LuminaScanFile } from '../utils/storage';
import { Mistake } from '../types';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile?: string;
  getSessionData?: () => LuminaScanFile | null;
  initialMistakeId?: string;
  initialType?: FeedbackType;
  initialMistake?: Mistake; // Cały obiekt błędu dla auto-wypełnienia
}

type FeedbackType = 'bug' | 'suggestion' | 'wrong_correction' | 'other';

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, currentFile, getSessionData, initialMistakeId, initialType, initialMistake }) => {
  console.log('🔵 FeedbackModal RENDERING with props:', {
    isOpen,
    initialType,
    initialMistakeId,
    initialMistake: initialMistake ? `${initialMistake.id}` : undefined,
    currentFile
  });

  // Initialize state directly from props
  const [type, setType] = useState<FeedbackType>(() => {
    console.log('🟢 Initializing type state with:', initialType || 'bug');
    return initialType || 'bug';
  });

  // Auto-fill title from mistake if provided
  const [title, setTitle] = useState(() => {
    if (initialMistake && initialType === 'wrong_correction') {
      const autoTitle = `Nietrafna poprawka: ${initialMistake.category}`;
      console.log('🟢 Auto-filling title with:', autoTitle);
      return autoTitle;
    }
    return '';
  });

  // Auto-fill description from mistake if provided
  const [description, setDescription] = useState(() => {
    if (initialMistake && initialType === 'wrong_correction') {
      const autoDesc = `Oryginał: "${initialMistake.originalText}"\nProponowana poprawka: "${initialMistake.suggestedFix}"\nPowód: ${initialMistake.reason}`;
      console.log('🟢 Auto-filling description with:', autoDesc);
      return autoDesc;
    }
    return '';
  });
  const [mistakeId, setMistakeId] = useState(() => {
    const value = (initialType === 'wrong_correction' && initialMistakeId) ? initialMistakeId : '';
    console.log('🟢 Initializing mistakeId state with:', value);
    return value;
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; savedLocally?: boolean } | null>(null);
  const [lastFeedback, setLastFeedback] = useState<FeedbackData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(getFeedbackServerUrl());
  const [pendingCount, setPendingCount] = useState(getPendingFeedbacks().length);
  const [isSyncing, setIsSyncing] = useState(false);

  // Debug logging
  useEffect(() => {
    console.log('FeedbackModal mounted', {
      isOpen,
      initialMistakeId,
      initialType,
      currentMistakeId: mistakeId,
      currentType: type
    });
  }, []);

  useEffect(() => {
    console.log('FeedbackModal props changed', { initialMistakeId, initialType });
  }, [initialMistakeId, initialType]);

  // Update fields when modal opens with new props
  useEffect(() => {
    if (!isOpen) return;

    console.log('🔴 === FeedbackModal props received ===');
    console.log('🔴 initialType:', initialType);
    console.log('🔴 initialMistakeId:', initialMistakeId);

    // Refresh pending count
    setPendingCount(getPendingFeedbacks().length);

    // Update type if provided
    if (initialType) {
      console.log('🟡 Setting type to:', initialType);
      setType(initialType);
    } else {
      console.warn('⚠️ initialType is missing!');
    }

    // Update mistakeId if provided and we're dealing with wrong_correction
    if (initialMistakeId && initialType === 'wrong_correction') {
      console.log('🟢 Setting mistakeId to:', initialMistakeId);
      setMistakeId(initialMistakeId);
    } else {
      console.warn('⚠️ Not setting mistakeId. Reason:', {
        hasInitialMistakeId: !!initialMistakeId,
        isWrongCorrection: initialType === 'wrong_correction',
        initialType,
        initialMistakeId
      });
    }
  }, [isOpen, initialMistakeId, initialType]);

  // Debug logging for state changes
  useEffect(() => {
    if (isOpen) {
      console.log('=== FeedbackModal state ===');
      console.log('type:', type);
      console.log('mistakeId:', mistakeId);
    }
  }, [isOpen, type, mistakeId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // For wrong_correction with mistakeId, title is optional (auto-generated if empty)
    const isWrongCorrectionWithId = type === 'wrong_correction' && mistakeId.trim();

    if (!isWrongCorrectionWithId && !title.trim()) {
      console.warn('⚠️ Title is required for this feedback type');
      return;
    }

    setIsSubmitting(true);
    setSubmitResult(null);

    // Pobierz dane sesji (eksport LSF)
    const sessionData = getSessionData?.() || undefined;

    // Auto-generate title if empty for wrong_correction with mistakeId
    const finalTitle = title.trim() || (isWrongCorrectionWithId ? `Zgłoszenie błędu: ${mistakeId}` : '');
    const finalDescription = description.trim() || (isWrongCorrectionWithId ? 'Szczegóły błędu są zawarte w danych sesji LSF.' : '');

    const result = await submitFeedback({
      type,
      title: finalTitle,
      description: finalDescription,
      mistakeId: mistakeId.trim() || undefined,
      currentFile,
    }, sessionData);

    // Zapisz feedback do stanu w przypadku lokalnego zapisu
    if (result.savedLocally) {
      setLastFeedback({
        type,
        title: finalTitle,
        description: finalDescription,
        mistakeId: mistakeId.trim() || undefined,
        currentFile,
        appName: 'Lumina Editor',
        timestamp: new Date().toISOString(),
        sessionData,
      });
    }

    setSubmitResult(result);
    setIsSubmitting(false);

    if (result.success) {
      // Reset formy po 2 sekundach i zamknij
      setTimeout(() => {
        setTitle('');
        setDescription('');
        setMistakeId('');
        setType('bug');
        setSubmitResult(null);
        onClose();
      }, 2000);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setTitle('');
      setDescription('');
      setMistakeId('');
      setType('bug');
      setSubmitResult(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  // Wszystkie dostępne opcje
  const allTypeOptions: { value: FeedbackType; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'bug', label: 'Błąd', icon: <Bug size={16} />, color: 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
    { value: 'wrong_correction', label: 'Nietrafna poprawka', icon: <AlertTriangle size={16} />, color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
    { value: 'suggestion', label: 'Sugestia', icon: <Lightbulb size={16} />, color: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800' },
    { value: 'other', label: 'Inne', icon: <MessageSquare size={16} />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  ];

  // Filtruj opcje w zależności od kontekstu
  const typeOptions = initialMistake
    ? allTypeOptions.filter(opt => opt.value === 'wrong_correction') // Modal z błędem - tylko "Nietrafna poprawka"
    : allTypeOptions.filter(opt => opt.value !== 'wrong_correction'); // Modal ogólny - wszystko oprócz "Nietrafna poprawka"

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {showSettings
              ? 'Ustawienia feedbacku'
              : initialMistake
                ? 'Zgłoś nietrafną poprawkę'
                : 'Zgłoś sugestię lub błąd'}
          </h2>
          <div className="flex items-center gap-1">
            {!initialMistake && (
              <button
                onClick={() => setShowSettings(!showSettings)}
                disabled={isSubmitting}
                className={`p-1.5 transition-colors rounded-lg ${showSettings ? 'text-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                title="Ustawienia"
              >
                <Settings size={18} />
              </button>
            )}
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="p-1.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Settings Panel */}
        {showSettings ? (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                URL serwera feedbacku
              </label>
              <input
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://lumina.local:3001/api/feedback"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Podaj adres serwera feedbacku
              </p>
            </div>

            <button
              onClick={() => {
                setFeedbackServerUrl(serverUrl);
                setShowSettings(false);
              }}
              className="w-full px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Zapisz ustawienia
            </button>

            {pendingCount > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-4 space-y-2">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Masz <span className="font-bold text-amber-600">{pendingCount}</span> zapisanych lokalnie zgłoszeń
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      setIsSyncing(true);
                      const result = await syncPendingFeedback();
                      setIsSyncing(false);
                      setPendingCount(getPendingFeedbacks().length);
                      alert(`Wysłano: ${result.sent}, Niepowodzenie: ${result.failed}`);
                    }}
                    disabled={isSyncing}
                    className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {isSyncing ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Wyślij na serwer
                  </button>
                  <button
                    onClick={() => exportAllPendingFeedbacks()}
                    className="flex-1 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    <Download size={14} />
                    Eksportuj do pliku
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : (
        /* Form */
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {/* Typ zgłoszenia - ukryj gdy jest tylko jedna opcja */}
          {typeOptions.length > 1 ? (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Typ zgłoszenia
              </label>
              <div className="flex gap-2">
                {typeOptions.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    disabled={isSubmitting}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                    type === option.value
                      ? option.color
                      : 'text-gray-500 bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  {option.icon}
                  {option.label}
                </button>
              ))}
            </div>
          </div>
          ) : (
            /* Typ zablokowany - pokaż badge */
            <div className="flex items-center gap-2 px-4 py-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
              <AlertTriangle size={18} className="text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <div className="text-sm font-medium text-orange-700 dark:text-orange-300">Typ zgłoszenia: Nietrafna poprawka</div>
                <div className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">Zgłaszanie błędu w systemie skanowania</div>
              </div>
            </div>
          )}

          {/* Tytuł */}
          <div>
            <label htmlFor="feedback-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tytuł {type === 'wrong_correction' && mistakeId ? <span className="text-gray-400 font-normal">(opcjonalne - auto-wypełnione)</span> : null}
            </label>
            <input
              id="feedback-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              placeholder={type === 'wrong_correction' && mistakeId ? "Zostanie wygenerowane automatycznie..." : "Krótki opis problemu lub sugestii..."}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              required={!(type === 'wrong_correction' && mistakeId)}
            />
          </div>

          {/* Opis */}
          <div>
            <label htmlFor="feedback-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Szczegółowy opis {type === 'wrong_correction' && mistakeId ? <span className="text-gray-400 font-normal">(opcjonalne - auto-wypełnione)</span> : null}
            </label>
            <textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder={type === 'wrong_correction' && mistakeId ? "Szczegóły błędu są dołączone automatycznie..." : "Opisz szczegółowo co się stało lub jaką masz sugestię..."}
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
            />
            {type === 'wrong_correction' && mistakeId && (
              <p className="mt-1 text-xs text-emerald-600 dark:text-emerald-400">
                ✓ Szczegóły błędu zostaną dołączone automatycznie z danymi sesji LSF
              </p>
            )}
          </div>

          {/* ID błędu - tylko dla nietrafnych poprawek */}
          {type === 'wrong_correction' ? (
            <div>
              {console.log('🟢 Rendering mistake ID field with value:', mistakeId)}
              <label htmlFor="feedback-mistake-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ID błędu <span className="text-gray-400 font-normal">(widoczne w liście poprawek)</span>
              </label>
              <input
                id="feedback-mistake-id"
                type="text"
                value={mistakeId}
                onChange={(e) => setMistakeId(e.target.value)}
                disabled={isSubmitting}
                placeholder={initialMistakeId || "np. 1-ai-3 lub 2-local-5"}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                Kliknij w ID przy błędzie aby skopiować do schowka
              </p>

              {/* Mistake details panel */}
              {initialMistake && (
                <div className="mt-3 p-4 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="text-sm font-bold text-gray-700 dark:text-gray-300">📋 Szczegóły nietrafnej poprawki</div>
                    <div className="text-xs font-mono text-gray-500 dark:text-gray-400 bg-white dark:bg-gray-800 px-2 py-1 rounded">
                      {initialMistake.id}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Left column */}
                    <div className="space-y-2">
                      <div className="bg-white dark:bg-gray-800 p-2 rounded">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Kategoria</div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">{initialMistake.category}</div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-2 rounded">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Źródło wykrycia</div>
                        <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          {initialMistake.source === 'ai' ? '🤖 AI' : '⚙️ Reguły lokalne'}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-2 rounded">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Status</div>
                        <div className="text-sm font-medium">
                          {initialMistake.status === 'pending' && <span className="text-amber-600 dark:text-amber-400">⏳ Oczekujący</span>}
                          {initialMistake.status === 'approved' && <span className="text-emerald-600 dark:text-emerald-400">✓ Zatwierdzony</span>}
                          {initialMistake.status === 'rejected' && <span className="text-gray-500 dark:text-gray-400">✗ Odrzucony</span>}
                        </div>
                      </div>

                      <div className="bg-white dark:bg-gray-800 p-2 rounded">
                        <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Lokalizacja</div>
                        <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                          Segment #{initialMistake.chunkId + 1}<br/>
                          Pozycja: {initialMistake.position.start}-{initialMistake.position.end}
                        </div>
                      </div>
                    </div>

                    {/* Right column - Beautiful correction comparison */}
                    <div className="space-y-3">
                      {/* Comparison panel with before/after */}
                      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                        <div className="bg-gradient-to-r from-gray-100 to-gray-50 dark:from-gray-700 dark:to-gray-800 px-3 py-2 border-b border-gray-200 dark:border-gray-700">
                          <div className="text-xs font-bold text-gray-600 dark:text-gray-300 uppercase tracking-wide">🔄 Porównanie zmian</div>
                        </div>

                        <div className="p-3 space-y-3">
                          {/* Before (Original) */}
                          <div className="relative">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/30">
                                <span className="text-xs font-bold text-red-600 dark:text-red-400">−</span>
                              </div>
                              <span className="text-xs font-semibold text-red-700 dark:text-red-400">Przed</span>
                            </div>
                            <div className="ml-7 bg-red-50 dark:bg-red-900/10 border-l-4 border-red-500 pl-3 pr-3 py-2 rounded-r">
                              <div className="text-sm font-mono text-red-900 dark:text-red-300 break-words leading-relaxed">
                                {initialMistake.originalText}
                              </div>
                            </div>
                          </div>

                          {/* Arrow separator */}
                          <div className="flex items-center justify-center py-1">
                            <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500">
                              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                              <span className="text-xl">↓</span>
                              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
                            </div>
                          </div>

                          {/* After (Correction) */}
                          <div className="relative">
                            <div className="flex items-center gap-2 mb-1.5">
                              <div className="flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30">
                                <span className="text-xs font-bold text-green-600 dark:text-green-400">+</span>
                              </div>
                              <span className="text-xs font-semibold text-green-700 dark:text-green-400">Po</span>
                            </div>
                            <div className="ml-7 bg-green-50 dark:bg-green-900/10 border-l-4 border-green-500 pl-3 pr-3 py-2 rounded-r">
                              <div className="text-sm font-mono text-green-900 dark:text-green-300 break-words leading-relaxed">
                                {initialMistake.suggestedFix}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Reason box */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                          <div className="flex-shrink-0 mt-0.5">
                            <div className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800">
                              <span className="text-xs">💡</span>
                            </div>
                          </div>
                          <div className="flex-1">
                            <div className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Powód poprawki</div>
                            <div className="text-sm text-blue-900 dark:text-blue-300 leading-relaxed">{initialMistake.reason}</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                    <div className="text-xs text-gray-500 dark:text-gray-400 italic">
                      💾 Wszystkie powyższe dane zostaną automatycznie dołączone do zgłoszenia w pliku LSF
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <>
              {console.log('⚠️ Mistake ID field NOT rendered. Current type:', type)}
            </>
          )}

          {/* Aktualny plik */}
          {currentFile && (
            <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 px-3 py-2 rounded-lg">
              <span className="font-medium">Aktualny plik:</span> {currentFile}
            </div>
          )}

          {/* Wynik wysyłania */}
          {submitResult && (
            <div className={`flex flex-col gap-2 px-3 py-2 rounded-lg text-sm ${
              submitResult.success 
                ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300' 
                : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
            }`}>
              <div className="flex items-center gap-2">
                {submitResult.success ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                {submitResult.message}
              </div>
              {submitResult.savedLocally && lastFeedback && (
                <button
                  type="button"
                  onClick={() => exportFeedbackToFile(lastFeedback)}
                  className="flex items-center justify-center gap-2 px-3 py-1.5 bg-brand-600 hover:bg-brand-700 text-white rounded text-xs font-medium transition-colors"
                >
                  <Download size={14} />
                  Pobierz jako plik JSON
                </button>
              )}
            </div>
          )}

          {/* Przyciski */}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              Anuluj
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !title.trim()}
              className="px-4 py-2 text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 disabled:bg-gray-400 disabled:cursor-not-allowed rounded-lg transition-all flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Wysyłanie...
                </>
              ) : (
                <>
                  <Send size={16} />
                  Wyślij
                </>
              )}
            </button>
          </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackModal;

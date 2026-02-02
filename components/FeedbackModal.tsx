import React, { useState, useEffect } from 'react';
import { X, Send, Bug, Lightbulb, MessageSquare, Loader2, CheckCircle, AlertCircle, AlertTriangle, Download, Settings } from 'lucide-react';
import { submitFeedback, exportFeedbackToFile, FeedbackData, getFeedbackServerUrl, setFeedbackServerUrl, getPendingFeedbacks, exportAllPendingFeedbacks, syncPendingFeedback } from '../services/feedbackService';
import { LuminaScanFile } from '../utils/storage';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentFile?: string;
  getSessionData?: () => LuminaScanFile | null;
}

type FeedbackType = 'bug' | 'suggestion' | 'wrong_correction' | 'other';

const FeedbackModal: React.FC<FeedbackModalProps> = ({ isOpen, onClose, currentFile, getSessionData }) => {
  const [type, setType] = useState<FeedbackType>('suggestion');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [mistakeId, setMistakeId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState<{ success: boolean; message: string; savedLocally?: boolean } | null>(null);
  const [lastFeedback, setLastFeedback] = useState<FeedbackData | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [serverUrl, setServerUrl] = useState(getFeedbackServerUrl());
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setPendingCount(getPendingFeedbacks().length);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !description.trim()) return;

    setIsSubmitting(true);
    setSubmitResult(null);

    // Pobierz dane sesji (eksport LSF)
    const sessionData = getSessionData?.() || undefined;

    const result = await submitFeedback({
      type,
      title: title.trim(),
      description: description.trim(),
      mistakeId: mistakeId.trim() || undefined,
      currentFile,
    }, sessionData);

    // Zapisz feedback do stanu w przypadku lokalnego zapisu
    if (result.savedLocally) {
      setLastFeedback({
        type,
        title: title.trim(),
        description: description.trim(),
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
        setType('suggestion');
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
      setType('suggestion');
      setSubmitResult(null);
      onClose();
    }
  };

  if (!isOpen) return null;

  const typeOptions: { value: FeedbackType; label: string; icon: React.ReactNode; color: string }[] = [
    { value: 'bug', label: 'Błąd', icon: <Bug size={16} />, color: 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' },
    { value: 'wrong_correction', label: 'Nietrafna poprawka', icon: <AlertTriangle size={16} />, color: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' },
    { value: 'suggestion', label: 'Sugestia', icon: <Lightbulb size={16} />, color: 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
    { value: 'other', label: 'Inne', icon: <MessageSquare size={16} />, color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg mx-4 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
            {showSettings ? 'Ustawienia feedbacku' : 'Zgłoś sugestię lub błąd'}
          </h2>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowSettings(!showSettings)}
              disabled={isSubmitting}
              className={`p-1.5 transition-colors rounded-lg ${showSettings ? 'text-brand-500 bg-brand-50 dark:bg-brand-900/20' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
              title="Ustawienia"
            >
              <Settings size={18} />
            </button>
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
          {/* Typ zgłoszenia */}
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

          {/* Tytuł */}
          <div>
            <label htmlFor="feedback-title" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Tytuł
            </label>
            <input
              id="feedback-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={isSubmitting}
              placeholder="Krótki opis problemu lub sugestii..."
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all"
              required
            />
          </div>

          {/* Opis */}
          <div>
            <label htmlFor="feedback-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Szczegółowy opis
            </label>
            <textarea
              id="feedback-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isSubmitting}
              placeholder="Opisz szczegółowo co się stało lub jaką masz sugestię..."
              rows={4}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all resize-none"
              required
            />
          </div>

          {/* ID błędu - tylko dla nietrafnych poprawek */}
          {type === 'wrong_correction' && (
            <div>
              <label htmlFor="feedback-mistake-id" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                ID błędu <span className="text-gray-400 font-normal">(widoczne w liście poprawek)</span>
              </label>
              <input
                id="feedback-mistake-id"
                type="text"
                value={mistakeId}
                onChange={(e) => setMistakeId(e.target.value)}
                disabled={isSubmitting}
                placeholder="np. 1-ai-3 lub 2-local-5"
                className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all font-mono text-sm"
              />
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                ID znajdziesz przy każdej poprawce w panelu po lewej stronie
              </p>
            </div>
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
              disabled={isSubmitting || !title.trim() || !description.trim()}
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

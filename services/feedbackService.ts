// Serwis do wysyłania feedbacku na lokalne Raspberry Pi
import { LuminaScanFile } from '../utils/storage';

export interface FeedbackData {
  type: 'bug' | 'suggestion' | 'wrong_correction' | 'other';
  title: string;
  description: string;
  mistakeId?: string; // ID błędu przy zgłaszaniu nietrafnej poprawki
  appName: string;
  appVersion?: string;
  timestamp: string;
  userAgent?: string;
  currentFile?: string;
  sessionData?: LuminaScanFile; // Pełen eksport LSF
  originalFileData?: { // Oryginalny plik użytkownika (base64)
    name: string;
    type: string;
    data: string;
  };
}

// Klucz do przechowywania URL serwera feedbacku
const FEEDBACK_URL_KEY = 'lumina_feedback_server_url';
const PENDING_FEEDBACK_KEY = 'lumina_pending_feedback';

// Domyślny URL - można zmienić w ustawieniach
const DEFAULT_FEEDBACK_URL = 'https://feedback-api.lumina-suite.tech/api/feedback\n';

/**
 * Pobierz aktualny URL serwera feedbacku
 */
export const getFeedbackServerUrl = (): string => {
  return localStorage.getItem(FEEDBACK_URL_KEY) || DEFAULT_FEEDBACK_URL;
};

/**
 * Ustaw URL serwera feedbacku
 */
export const setFeedbackServerUrl = (url: string): void => {
  localStorage.setItem(FEEDBACK_URL_KEY, url);
};

/**
 * Pobierz oczekujące feedbacki zapisane lokalnie
 */
export const getPendingFeedbacks = (): FeedbackData[] => {
  try {
    return JSON.parse(localStorage.getItem(PENDING_FEEDBACK_KEY) || '[]');
  } catch {
    return [];
  }
};

/**
 * Zapisz feedback lokalnie
 */
const saveFeedbackLocally = (feedback: FeedbackData): void => {
  const pending = getPendingFeedbacks();
  pending.push(feedback);
  localStorage.setItem(PENDING_FEEDBACK_KEY, JSON.stringify(pending));
};

/**
 * Usuń feedback z lokalnej kolejki
 */
const removePendingFeedback = (timestamp: string): void => {
  const pending = getPendingFeedbacks();
  const filtered = pending.filter(f => f.timestamp !== timestamp);
  localStorage.setItem(PENDING_FEEDBACK_KEY, JSON.stringify(filtered));
};

/**
 * Eksportuj feedback do pliku JSON (do ręcznego przesłania)
 */
export const exportFeedbackToFile = (feedback: FeedbackData): void => {
  const blob = new Blob([JSON.stringify(feedback, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `feedback_${feedback.type}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Eksportuj wszystkie oczekujące feedbacki do pliku
 */
export const exportAllPendingFeedbacks = (): void => {
  const pending = getPendingFeedbacks();
  if (pending.length === 0) return;

  const blob = new Blob([JSON.stringify(pending, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pending_feedbacks_${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

export const submitFeedback = async (
  feedback: Omit<FeedbackData, 'timestamp' | 'userAgent' | 'appName'>,
  sessionData?: LuminaScanFile
): Promise<{ success: boolean; message: string; savedLocally?: boolean }> => {
  const fullFeedback: FeedbackData = {
    ...feedback,
    appName: 'Lumina Editor',
    appVersion: '1.0.0',
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    sessionData,
  };

  const feedbackUrl = getFeedbackServerUrl();

  try {
    const response = await fetch(feedbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(fullFeedback),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return { success: true, message: 'Feedback wysłany pomyślnie!' };
  } catch (error) {
    console.error('Błąd wysyłania feedbacku:', error);

    // Fallback: zapisz lokalnie
    saveFeedbackLocally(fullFeedback);
    return {
      success: true,
      message: 'Serwer niedostępny - feedback zapisany lokalnie. Możesz go wyeksportować do pliku.',
      savedLocally: true
    };
  }
};

/**
 * Wyślij zapisane lokalnie feedbacki na serwer
 */
export const syncPendingFeedback = async (): Promise<{ sent: number; failed: number }> => {
  const pending = getPendingFeedbacks();
  if (pending.length === 0) return { sent: 0, failed: 0 };

  const feedbackUrl = getFeedbackServerUrl();
  let sent = 0;
  const stillPending: FeedbackData[] = [];

  for (const feedback of pending) {
    try {
      const response = await fetch(feedbackUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });

      if (response.ok) {
        sent++;
      } else {
        stillPending.push(feedback);
      }
    } catch {
      stillPending.push(feedback);
    }
  }

  localStorage.setItem(PENDING_FEEDBACK_KEY, JSON.stringify(stillPending));
  return { sent, failed: stillPending.length };
};

/**
 * Wyczyść wszystkie lokalne feedbacki
 */
export const clearPendingFeedbacks = (): void => {
  localStorage.removeItem(PENDING_FEEDBACK_KEY);
};

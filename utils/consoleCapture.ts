/**
 * Console Log Capture - przechwytuje logi konsoli do dołączenia do feedbacku
 * Przechowuje ostatnie N wpisów w buforze cyklicznym.
 */

export interface CapturedLog {
  level: 'log' | 'warn' | 'error' | 'info';
  message: string;
  timestamp: string;
}

const MAX_ENTRIES = 50;
const buffer: CapturedLog[] = [];
let initialized = false;

/**
 * Inicjalizuje przechwytywanie logów konsoli.
 * Wywołaj raz przy starcie aplikacji.
 */
export function initConsoleCapture(): void {
  if (initialized) return;
  initialized = true;

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalInfo = console.info;

  const capture = (level: CapturedLog['level'], original: (...args: any[]) => void) => {
    return (...args: any[]) => {
      try {
        const message = args.map(a => {
          if (typeof a === 'string') return a;
          try { return JSON.stringify(a); } catch { return String(a); }
        }).join(' ');

        buffer.push({
          level,
          message: message.substring(0, 500), // limituj długość pojedynczego wpisu
          timestamp: new Date().toISOString(),
        });

        // Bufor cykliczny - usuń najstarsze
        while (buffer.length > MAX_ENTRIES) {
          buffer.shift();
        }
      } catch {
        // Nie przerywaj działania przy błędzie przechwytywania
      }

      original.apply(console, args);
    };
  };

  console.log = capture('log', originalLog);
  console.warn = capture('warn', originalWarn);
  console.error = capture('error', originalError);
  console.info = capture('info', originalInfo);
}

/**
 * Zwraca kopię przechwyconych logów.
 */
export function getCapturedLogs(): CapturedLog[] {
  return [...buffer];
}

/**
 * Czyści bufor logów.
 */
export function clearCapturedLogs(): void {
  buffer.length = 0;
}

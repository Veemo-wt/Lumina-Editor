export const DB_NAME = 'LuminaDB';
export const STORE_NAME = 'session';
const SESSION_KEY = 'autosave_v1';

const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    // If indexedDB is not available (ejr. some restrictive environments), reject
    if (!window.indexedDB) {
        reject("IndexedDB not supported");
        return;
    }

    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = (event) => reject((event.target as IDBOpenDBRequest).error);
  });
};

export const saveSession = async (data: any) => {
  try {
    const db = await openDB();
    return new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const req = store.put(data, SESSION_KEY);
        
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Failed to save session to IndexedDB", e);
  }
};

export const loadSession = async (): Promise<any> => {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(SESSION_KEY);
      
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch (e) {
    console.warn("Failed to load session from IndexedDB", e);
    return null;
  }
};

export const clearSession = async () => {
    try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(SESSION_KEY);
  } catch (e) {
    console.error("Failed to clear session", e);
  }
};

/**
 * Interfejs dla eksportu pliku .lsf (Lumina Scan File)
 * Zawiera wszystkie dane potrzebne do kontynuacji edycji przez redaktora
 * BEZ klucza API i danych wrażliwych
 */
export interface LuminaScanFile {
  version: string;
  exportDate: string;
  fileName: string;
  chunks: any[]; // ChunkData[]
  config: {
    scanOptions: any;
    glossary: any[];
    characterBible: any[];
    chunkSize: number;
    lookbackSize: number;
    chapterPattern?: string;
  };
  metadata: {
    totalMistakes: number;
    approvedMistakes: number;
    rejectedMistakes: number;
    pendingMistakes: number;
    totalChunks: number;
    completedChunks: number;
  };
}

/**
 * Eksportuje dane sesji do pliku .lsf
 */
export const exportToLSF = (
  fileName: string,
  chunks: any[],
  config: any
): Blob => {
  // Oblicz statystyki
  let totalMistakes = 0;
  let approvedMistakes = 0;
  let rejectedMistakes = 0;
  let pendingMistakes = 0;
  let completedChunks = 0;

  chunks.forEach(chunk => {
    if (chunk.status === 'completed') completedChunks++;
    (chunk.mistakes || []).forEach((m: any) => {
      totalMistakes++;
      if (m.status === 'approved') approvedMistakes++;
      else if (m.status === 'rejected') rejectedMistakes++;
      else pendingMistakes++;
    });
  });

  const lsfData: LuminaScanFile = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    fileName,
    chunks,
    config: {
      scanOptions: config.scanOptions,
      glossary: config.glossary || [],
      characterBible: config.characterBible || [],
      chunkSize: config.chunkSize,
      lookbackSize: config.lookbackSize,
      chapterPattern: config.chapterPattern
    },
    metadata: {
      totalMistakes,
      approvedMistakes,
      rejectedMistakes,
      pendingMistakes,
      totalChunks: chunks.length,
      completedChunks
    }
  };

  const jsonString = JSON.stringify(lsfData, null, 2);
  return new Blob([jsonString], { type: 'application/json' });
};

/**
 * Importuje dane z pliku .lsf
 */
export const importFromLSF = async (file: File): Promise<LuminaScanFile> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data = JSON.parse(content) as LuminaScanFile;

        // Walidacja podstawowa
        if (!data.version || !data.chunks || !data.config) {
          throw new Error('Nieprawidłowy format pliku .lsf');
        }

        resolve(data);
      } catch (err) {
        reject(new Error('Nie udało się odczytać pliku .lsf: ' + (err as Error).message));
      }
    };

    reader.onerror = () => reject(new Error('Błąd odczytu pliku'));
    reader.readAsText(file);
  });
};

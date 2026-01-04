
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

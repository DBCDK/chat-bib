// Saves attached files in IndexedDB, which can hold much more than localStorage.
// The chat history only keeps a short id; the real file lives here and is looked
// up by that id when it's opened. This keeps the chat history small so big files
// don't make it run out of space.

const DB_NAME = "chatbib-files";
const STORE_NAME = "files";

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      if (typeof window === "undefined" || !window.indexedDB) {
        resolve(null);
        return;
      }
      const request = window.indexedDB.open(DB_NAME, 1);
      request.onerror = () => resolve(null);
      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        } catch {
          // errors are handled below
        }
      };
      request.onsuccess = () => resolve(request.result);
    } catch {
      resolve(null);
    }
  });
}

// open the database once and reuse it, instead of opening it every time
let dbPromise: Promise<IDBDatabase | null> | undefined;
function getDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) dbPromise = openDb();
  return dbPromise;
}

// shared by save and delete: make the change, then finish when it's done
async function runWrite(run: (store: IDBObjectStore) => void): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readwrite");
      run(tx.objectStore(STORE_NAME));
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

export function saveFileBlob(id: string, blob: Blob): Promise<void> {
  return runWrite((store) => store.put(blob, id));
}

export async function loadFileBlob(id: string): Promise<Blob | null> {
  const db = await getDb();
  if (!db) return null;
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(id);
      request.onsuccess = () =>
        resolve(request.result instanceof Blob ? request.result : null);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export function deleteFileBlob(id: string): Promise<void> {
  return runWrite((store) => store.delete(id));
}

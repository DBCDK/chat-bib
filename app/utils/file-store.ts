// Keep attachment files separate from chat data; chats refer to them by ID.
const DB_NAME = "chatbib-files";
const STORE_NAME = "files";
const DELETED = ":deleted";
let dbPromise: Promise<IDBDatabase | null> | undefined;
let deletedAtStart: unknown;
let wiping = false;

export function setFileDeletionTime(deleted: unknown): void {
  deletedAtStart = deleted;
}
export function stopFileSaves(): void {
  wiping = true;
}

function getDb(): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    const opening = new Promise<IDBDatabase | null>((resolve) => {
      let settled = false;
      const finish = (db: IDBDatabase | null) => {
        if (settled) return db?.close();
        settled = true;
        clearTimeout(timer);
        resolve(db);
      };
      const timer = setTimeout(() => finish(null), 3000);
      try {
        const request = window.indexedDB.open(DB_NAME, 1);
        request.onerror = () => finish(null);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME))
            db.createObjectStore(STORE_NAME);
        };
        request.onsuccess = () => {
          const db = request.result;
          db.onversionchange = () => {
            db.close();
            dbPromise = undefined;
          };
          finish(db);
        };
      } catch {
        finish(null);
      }
    });
    dbPromise = opening;
    void opening.then((db) => {
      if (!db && dbPromise === opening) dbPromise = undefined;
    });
  }
  return dbPromise;
}

async function runWrite(
  run: (store: IDBObjectStore) => void,
  mode: "save" | "delete" | "clear",
  again = true,
): Promise<void> {
  const error = () =>
    new Error(
      mode === "clear"
        ? "The attached files were not deleted"
        : "Filen kunne ikke gemmes. Prøv igen.",
    );
  const db = await getDb();
  if (!db || (wiping && mode !== "clear")) {
    if (mode !== "delete") throw error();
    return;
  }
  let tx: IDBTransaction;
  try {
    tx = db.transaction(STORE_NAME, "readwrite");
  } catch {
    dbPromise = undefined;
    if (again) return runWrite(run, mode, false);
    if (mode !== "delete") throw error();
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const failed = () => {
      clearTimeout(timer);
      mode === "delete" ? resolve() : reject(error());
    };
    const timer = setTimeout(() => {
      try {
        tx.abort();
      } catch {
        /* Transaction already finished. */
      }
      failed();
    }, 5000);
    tx.oncomplete = () => {
      clearTimeout(timer);
      resolve();
    };
    tx.onerror = tx.onabort = failed;
    try {
      const store = tx.objectStore(STORE_NAME);
      if (mode === "save") {
        const deleted = store.get(DELETED);
        deleted.onsuccess = () => {
          if (
            wiping ||
            (deleted.result !== undefined && deleted.result !== deletedAtStart)
          ) {
            wiping = true;
            tx.abort();
          } else run(store);
        };
      } else run(store);
    } catch {
      tx.abort();
      failed();
    }
  });
}

export function saveFileBlob(id: string, blob: Blob): Promise<void> {
  return runWrite((store) => store.put(blob, id), "save");
}

export async function loadFileBlob(
  id: string,
  again = true,
): Promise<Blob | null> {
  const db = await getDb();
  if (!db) return null;
  let tx: IDBTransaction;
  try {
    tx = db.transaction(STORE_NAME, "readonly");
  } catch {
    dbPromise = undefined;
    return again ? loadFileBlob(id, false) : null;
  }
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      try {
        tx.abort();
      } catch {
        /* Transaction already finished. */
      }
      resolve(null);
    }, 5000);
    const request = tx.objectStore(STORE_NAME).get(id);
    tx.oncomplete = () => {
      clearTimeout(timer);
      resolve(request.result instanceof Blob ? request.result : null);
    };
    tx.onerror = tx.onabort = () => {
      clearTimeout(timer);
      resolve(null);
    };
  });
}

export function deleteFileBlob(id: string): Promise<void> {
  return runWrite((store) => store.delete(id), "delete");
}

export async function clearFileBlobs(
  deletedAt: string | number,
): Promise<void> {
  wiping = true;
  if (!window.indexedDB) return;
  dbPromise = undefined;
  await runWrite((store) => {
    store.clear();
    store.put(deletedAt, DELETED);
  }, "clear");
}

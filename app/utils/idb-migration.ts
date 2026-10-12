import type { StateStorage } from "zustand/middleware";

// Where the chat is kept.
//
// localStorage only gives a page about five megabytes, and a chat with
// documents fills that fast, so chats are kept in IndexedDB instead, which
// gets a much bigger share of disk. localStorage is still read once, to
// carry over anyone's existing chats, and still used as a fallback if the
// browser won't give us IndexedDB.

const IDB_DB_NAME = "keyval-store";
const IDB_STORE_NAME = "keyval";

let dbPromise: Promise<IDBDatabase | null> | null = null;

async function openKeyvalDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(IDB_DB_NAME);
      request.onerror = () => resolve(null);
      request.onupgradeneeded = () => {
        try {
          const db = request.result;
          if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
            db.createObjectStore(IDB_STORE_NAME);
          }
        } catch {
          resolve(null);
        }
      };
      request.onsuccess = () => resolve(request.result);
    } catch {
      resolve(null);
    }
  });
}

// Opened once and shared. Opening it again for every read and write would be
// slow and the chat is saved on every message.
function getDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) {
    return Promise.resolve(null);
  }
  if (!dbPromise) dbPromise = openKeyvalDb();
  return dbPromise;
}

async function getFromIdb(
  db: IDBDatabase,
  key: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const request = tx.objectStore(IDB_STORE_NAME).get(key);
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const result = request.result;
        if (result == null) {
          resolve(null);
        } else if (typeof result === "string") {
          resolve(result);
        } else {
          // an older version of the app saved this as an object
          try {
            resolve(JSON.stringify(result));
          } catch {
            resolve(null);
          }
        }
      };
    } catch {
      resolve(null);
    }
  });
}

// Says false when the write did not happen so the caller can fall back to the
// old place instead of quietly losing the chat.
async function putToIdb(
  db: IDBDatabase,
  key: string,
  value: string,
): Promise<boolean> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      tx.objectStore(IDB_STORE_NAME).put(value, key);
      tx.oncomplete = () => resolve(true);
      tx.onerror = () => resolve(false);
      tx.onabort = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
}

async function deleteFromIdb(db: IDBDatabase, key: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readwrite");
      tx.objectStore(IDB_STORE_NAME).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
    } catch {
      resolve();
    }
  });
}

function readLocal(name: string): string | null {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

function forgetLocal(name: string): void {
  try {
    window.localStorage.removeItem(name);
  } catch {
    // it only means the old copy stays where it is, which is harmless
  }
}

export const migrationAwareStorage: StateStorage = {
  async getItem(name: string): Promise<string | null> {
    const db = await getDb();
    if (!db) return readLocal(name);

    const saved = await getFromIdb(db, name);
    if (saved != null) return saved;

    // Nothing here yet. Take whatever the old place holds and move it over so
    // nobody loses their chats the first time they open the app after this.
    const old = readLocal(name);
    if (old != null && (await putToIdb(db, name, old))) {
      forgetLocal(name);
    }
    return old;
  },

  async setItem(name: string, value: string): Promise<void> {
    const db = await getDb();
    if (db && (await putToIdb(db, name, value))) {
      // the old copy is dropped so it stops taking up the little room
      // localStorage has
      forgetLocal(name);
      return;
    }

    try {
      window.localStorage.setItem(name, value);
    } catch (e) {
      // Only reached when there's no IndexedDB and the small room is full.
      // Throwing here used to freeze the whole page, so the user is told
      // instead — their answer is still on screen, only the saving failed.
      console.error("Could not save the chat", e);
      // only loaded here, when saving actually fails, so the screen code
      // isn't pulled in on every normal page load
      import("../components/ui-lib").then(({ showToast }) =>
        showToast(
          "Der er ikke plads til at gemme mere. Slet en gammel chat for at få plads igen.",
        ),
      );
    }
  },

  async removeItem(name: string): Promise<void> {
    const db = await getDb();
    if (db) await deleteFromIdb(db, name);
    forgetLocal(name);
  },
};

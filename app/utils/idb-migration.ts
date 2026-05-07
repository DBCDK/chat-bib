import type { StateStorage } from "zustand/middleware";

const MIGRATION_FLAG_KEY = "idb-to-localstorage-migrated";
const IDB_DB_NAME = "keyval-store";
const IDB_STORE_NAME = "keyval";
let migrated =
  typeof window !== "undefined"
    ? !!window.localStorage.getItem(MIGRATION_FLAG_KEY)
    : true;

const STORE_KEYS_TO_MIGRATE = [
  "chat-next-web-store",
  "access-control",
  "app-config",
  "mask-store",
  "prompt-store",
  "chat-update",
  "sync",
];

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

async function getFromIdb(
  db: IDBDatabase,
  key: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(IDB_STORE_NAME, "readonly");
      const store = tx.objectStore(IDB_STORE_NAME);
      const request = store.get(key);

      request.onerror = () => resolve(null);

      request.onsuccess = () => {
        const result = request.result;
        if (typeof result === "string") {
          resolve(result);
        } else
          try {
            resolve(JSON.stringify(result));
          } catch {
            resolve(null);
          }
      };
    } catch {
      resolve(null);
    }
  });
}

async function runMigration(): Promise<void> {
  try {
    const db = await openKeyvalDb();
    if (db) {
      for (const key of STORE_KEYS_TO_MIGRATE) {
        const value = await getFromIdb(db, key);
        if (value != null) {
          window.localStorage.setItem(key, value);
        }
      }
    }
  } catch (e) {
    console.error("Failed to migrate IDB to localStorage", e);
  }
  window.localStorage.setItem(MIGRATION_FLAG_KEY, "1");
  migrated = true;
}

export const migrationAwareStorage: StateStorage = {
  async getItem(name: string): Promise<string | null> {
    if (!migrated) {
      await runMigration();
    }

    return window.localStorage.getItem(name);
  },

  async setItem(name: string, value: string): Promise<void> {
    window.localStorage.setItem(name, value);
  },
  async removeItem(name: string): Promise<void> {
    window.localStorage.removeItem(name);
  },
};

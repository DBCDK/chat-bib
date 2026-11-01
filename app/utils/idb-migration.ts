import type { StateStorage } from "zustand/middleware";
import {
  clearFileBlobs,
  setFileDeletionTime,
  stopFileSaves,
} from "./file-store";

const DB_NAME = "keyval-store";
const STORE_NAME = "keyval";
const SAVED_IN_IDB = "saved-in-indexeddb";
const OLD_VERSION_FLAG = "idb-to-localstorage-migrated";
const DELETED = "deleted";
const LOCAL_DELETED = "chatbib-deleted";
const DELETE_PENDING = "pending:";
const TIMEOUT = 5000;
let dbPromise: Promise<IDBDatabase | null> | undefined;
let retryAfter = 0;
let wiping = false;
let started = false;
let deletedAtStart: unknown;
let localDeletedAtStart: string | null | undefined;
const unread = new Set<string>();
const failed = new Set<string>();
const pending = new Map<string, Promise<unknown>>();

// If saved data cannot be loaded, do not replace it with default values.
export function blockSaving(name: string): void {
  unread.add(name);
  failed.add(name);
}
export const loadFailed = (name: string) => failed.has(name);

export function deletionPending(): boolean {
  try {
    return (
      window.localStorage.getItem(LOCAL_DELETED)?.startsWith(DELETE_PENDING) ??
      false
    );
  } catch {
    return false;
  }
}

function getDb(recreate = false): Promise<IDBDatabase | null> {
  if (!dbPromise) {
    if (Date.now() < retryAfter) return Promise.resolve(null);
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
        const request = window.indexedDB.open(DB_NAME);
        request.onerror = () => finish(null);
        request.onupgradeneeded = () => {
          // Don't create an empty database while SAVED_IN_IDB is set. That would
          // hide missing data on reload. Only delete-all may create a replacement.
          try {
            if (
              settled ||
              (!recreate && window.localStorage.getItem(SAVED_IN_IDB) != null)
            ) {
              request.transaction?.abort();
              return;
            }
          } catch {
            request.transaction?.abort();
            return;
          }
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
      if (!db && dbPromise === opening) {
        dbPromise = undefined;
        // Pause retries so each part of a streamed reply doesn't wait for
        // another failed database open.
        retryAfter = Date.now() + TIMEOUT;
      }
    });
  }
  return dbPromise;
}

// Hold the lock through both the IndexedDB write and localStorage cleanup.
// An old local copy could otherwise hide a newer save from another tab.
async function withStorageLock<T>(
  name: string,
  run: (locked: boolean) => Promise<T>,
  mode: "shared" | "exclusive" = "exclusive",
): Promise<T> {
  const locks = window.navigator?.locks;
  if (!locks) return run(false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await locks.request(
      `chatbib-storage:${name}`,
      { mode, signal: controller.signal },
      () => {
        clearTimeout(timer);
        return run(true);
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

// Queue saves per store so a slow retry can't overwrite a newer update.
function ordered<T>(
  name: string,
  run: (locked: boolean) => Promise<T>,
): Promise<T> {
  // Keep delete-all waiting until this operation, including localStorage
  // changes, has finished. Take this shared lock before the store lock
  // so different stores can still run together.
  const locked = () =>
    wiping
      ? run(false)
      : withStorageLock(
          "delete-all",
          () => withStorageLock(name, run),
          "shared",
        );
  const next = (pending.get(name) ?? Promise.resolve()).then(locked, locked);
  pending.set(name, next);
  const clear = () => {
    if (pending.get(name) === next) pending.delete(name);
  };
  void next.then(clear, clear);
  return next;
}

function stopAndReload(): void {
  wiping = true;
  stopFileSaves();
  location.reload();
}

// Remember the deletion marker from the first load, even if IndexedDB is
// unavailable. If another tab deletes data, this tab must reload before saving.
function checkLocalDeletion(): boolean {
  if (wiping) return false;
  const deleted = window.localStorage.getItem(LOCAL_DELETED);
  if (deleted?.startsWith(DELETE_PENDING))
    throw new Error("Browser data deletion is incomplete");
  if (localDeletedAtStart === undefined) {
    localDeletedAtStart = deleted;
    // Give the file store this marker even if chats load from localStorage.
    // Otherwise it could reject a new upload as coming from before that deletion.
    if (!started) setFileDeletionTime(deleted ?? undefined);
  }
  if (deleted === localDeletedAtStart) return true;
  stopAndReload();
  return false;
}

function deletedSince(deleted: unknown): boolean {
  if (!started) {
    started = true;
    deletedAtStart = deleted;
    setFileDeletionTime(deleted);
  }
  if (deleted === deletedAtStart) return false;
  stopAndReload();
  return true;
}

async function read(db: IDBDatabase, name: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const deleted = store.get(DELETED);
    const value = store.get(name);
    const timer = setTimeout(() => {
      try {
        tx.abort();
      } catch {
        /* Transaction already finished. */
      }
      reject(new Error("IndexedDB read timed out"));
    }, TIMEOUT);
    tx.onerror = tx.onabort = () => {
      clearTimeout(timer);
      reject(tx.error ?? new Error("IndexedDB read failed"));
    };
    tx.oncomplete = () => {
      clearTimeout(timer);
      if (deletedSince(deleted.result))
        return reject(new Error("Data was deleted"));
      try {
        resolve(
          value.result == null
            ? null
            : typeof value.result === "string"
              ? value.result
              : JSON.stringify(value.result),
        );
      } catch (error) {
        reject(error);
      }
    };
  });
}

async function write(
  run: (store: IDBObjectStore) => void,
  { retry = true, recreate = false } = {},
): Promise<boolean> {
  const db = await getDb(recreate);
  if (!db) return false;
  try {
    const tx = db.transaction(STORE_NAME, "readwrite");
    return await new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        try {
          tx.abort();
        } catch {
          /* Transaction already finished. */
        }
        resolve(false);
      }, TIMEOUT);
      const finish = (ok: boolean) => {
        clearTimeout(timer);
        resolve(ok);
      };
      tx.oncomplete = () => finish(true);
      tx.onerror = tx.onabort = () => finish(false);
      try {
        run(tx.objectStore(STORE_NAME));
      } catch {
        tx.abort();
        finish(false);
      }
    });
  } catch {
    // The browser may have closed the connection. Retry with a new one.
    dbPromise = undefined;
    return retry ? write(run, { retry: false, recreate }) : false;
  }
}

const change =
  (name: string, value: string | null) => (store: IDBObjectStore) => {
    const deleted = store.get(DELETED);
    deleted.onsuccess = () => {
      try {
        if (!checkLocalDeletion() || deletedSince(deleted.result))
          store.transaction.abort();
        else if (value === null) store.delete(name);
        else store.put(value, name);
      } catch {
        store.transaction.abort();
      }
    };
  };

let marked = false;
function prepareSave(): void {
  if (!marked) {
    // Save this flag before writing new data to IndexedDB. If localStorage
    // is full, stop the migration. Otherwise an older localStorage copy
    // could replace newer IndexedDB data the next time the page loads.
    if (window.localStorage.getItem(SAVED_IN_IDB) === null)
      window.localStorage.setItem(SAVED_IN_IDB, "1");
    marked = true;
  }
}

function afterSave(
  name: string,
  localCopy: string | null,
  locked: boolean,
): void {
  // Allow an older app version to copy data back from IndexedDB only after
  // this save succeeds, so it cannot copy old data after a failed migration.
  window.localStorage.removeItem(OLD_VERSION_FLAG);
  // Another tab's localStorage write may become visible while IndexedDB saves.
  // With the store lock held, that copy is older than this save and can be
  // removed. Without the lock, remove only the copy we read before saving.
  if (
    locked ||
    (localCopy !== null && window.localStorage.getItem(name) === localCopy)
  )
    window.localStorage.removeItem(name);
}

let warned = false;
function warnSaveFailure(error: unknown): void {
  console.error("Could not save browser data", error);
  if (warned) return;
  warned = true;
  // Load ui-lib here to avoid the store -> UI -> locale -> store import loop.
  void import("../components/ui-lib")
    .then(({ showToast }) =>
      showToast(
        "Dine seneste ændringer kunne ikke gemmes. Eksportér vigtige chats, før du lukker siden.",
        undefined,
        9000,
      ),
    )
    .catch(console.error);
}

export const migrationAwareStorage: StateStorage = {
  getItem(name: string): Promise<string | null> {
    unread.add(name);
    return ordered(name, async (locked) => {
      if (!checkLocalDeletion()) throw new Error("Data was deleted");
      const db = await getDb();
      const saved = db ? await read(db, name) : null;
      if (!checkLocalDeletion()) throw new Error("Data was deleted");
      // Older app versions and failed IndexedDB writes save to localStorage.
      // If it cannot be read, stop loading: the IndexedDB copy may be older.
      const local = window.localStorage.getItem(name);
      if (local != null) {
        if (db) {
          prepareSave();
          if (await write(change(name, local))) afterSave(name, local, locked);
        }
        if (wiping) throw new Error("Data was deleted");
        unread.delete(name);
        return local;
      }
      if (!db && window.localStorage.getItem(SAVED_IN_IDB) != null)
        throw new Error("IndexedDB did not open");
      unread.delete(name);
      return saved;
    });
  },
  setItem(name: string, value: string): Promise<void> {
    if (wiping || unread.has(name)) return Promise.resolve();
    return ordered(name, async (locked) => {
      if (wiping || unread.has(name)) return;
      let local: string | null;
      try {
        if (!checkLocalDeletion()) return;
        local = window.localStorage.getItem(name);
      } catch (error) {
        warnSaveFailure(error);
        return;
      }
      try {
        if (await getDb()) {
          prepareSave();
          if (await write(change(name, value))) {
            afterSave(name, local, locked);
            return;
          }
        }
      } catch {
        // If saving a flag or removing the local copy fails, try to save this
        // latest value in localStorage below. An older copy would win on reload.
      }
      if (wiping) return;
      try {
        if (!checkLocalDeletion()) return;
        window.localStorage.setItem(name, value);
      } catch (error) {
        warnSaveFailure(error);
      }
    }).catch(warnSaveFailure);
  },
  removeItem(name: string): Promise<void> {
    return ordered(name, async () => {
      if (wiping || unread.has(name)) return;
      if (!(await write(change(name, null))) && window.indexedDB)
        throw new Error("Saved data could not be removed");
      if (!checkLocalDeletion()) return;
      window.localStorage.removeItem(name);
    });
  },
};

const wipeChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("chatbib-wipe")
    : null;
if (wipeChannel) wipeChannel.onmessage = stopAndReload;

// Each IndexedDB save checks the deletion marker in its transaction. Old tabs
// can't write deleted data back to IndexedDB even if they miss the notification.
export async function clearChatStorage(): Promise<void> {
  wiping = true;
  stopFileSaves();
  await Promise.allSettled(pending.values());
  await withStorageLock("delete-all", async () => {
    const deletedAt = `${Date.now()}-${Math.random()}`;
    const previousDeletion = window.localStorage.getItem(LOCAL_DELETED);
    // Mark deletion as unfinished before removing data. If it stops partway
    // through, the next load must show the recovery screen because some
    // attached files may already be gone.
    window.localStorage.setItem(LOCAL_DELETED, DELETE_PENDING + deletedAt);
    try {
      await clearFileBlobs(deletedAt);
    } catch (error) {
      // This attempt has not changed the files or chats. Restore the previous
      // marker, including any earlier unfinished deletion that still needs a retry.
      if (previousDeletion === null)
        window.localStorage.removeItem(LOCAL_DELETED);
      else window.localStorage.setItem(LOCAL_DELETED, previousDeletion);
      throw error;
    }
    dbPromise = undefined;
    retryAfter = 0;
    const stateDeleted =
      !window.indexedDB ||
      (await write(
        (store) => {
          store.clear();
          store.put(deletedAt, DELETED);
        },
        { recreate: true },
      ));
    if (!stateDeleted)
      throw new Error("Browser data was not completely deleted");
    // Keep localStorage data until the chat database has been cleared.
    // If removing localStorage data fails, leave deletion marked as unfinished.
    const keys = Array.from({ length: window.localStorage.length }, (_, i) =>
      window.localStorage.key(i),
    );
    for (const key of keys)
      if (key !== null && key !== LOCAL_DELETED)
        window.localStorage.removeItem(key);
    window.localStorage.setItem(LOCAL_DELETED, deletedAt);
    wipeChannel?.postMessage("deleted");
  });
}

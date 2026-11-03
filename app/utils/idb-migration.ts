import type { StateStorage } from "zustand/middleware";
import {
  clear,
  get,
  keys,
  promisifyRequest,
  set,
  type UseStore,
} from "idb-keyval";
import { createBrowserStore } from "./indexeddb-store";
import {
  clearFileBlobs,
  setFileDeletionTime,
  stopFileSaves,
} from "./file-store";

let stateStore: UseStore | undefined;
let legacyStore: UseStore | undefined;
const db = () => (stateStore ??= createBrowserStore("chatbib-state", "keyval"));
const legacyDb = () =>
  (legacyStore ??= createBrowserStore("keyval-store", "keyval"));
const SAVED_IN_IDB = "chatbib-saved-in-indexeddb:";
const OLD_VERSION_FLAG = "idb-to-localstorage-migrated";
const DELETED = "deleted";
const LOCAL_DELETED = "chatbib-deleted";
const DELETE_PENDING = "pending:";
let wiping = false;
let stateOpened = false;
let deletedAtStart: string | null | undefined;
const unread = new Set<string>();
const failed = new Set<string>();
const waiting = new Map<string, string | null>();
const saving = new Map<string, Promise<void>>();

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

function stopAndReload(): void {
  wiping = true;
  stopFileSaves();
  location.reload();
}

function checkDeletion(): void {
  if (wiping) throw new Error("Data was deleted");
  const deleted = window.localStorage.getItem(LOCAL_DELETED);
  if (deleted?.startsWith(DELETE_PENDING))
    throw new Error("Browser data deletion is incomplete");
  if (deletedAtStart === undefined) {
    deletedAtStart = deleted;
    setFileDeletionTime(deleted ?? undefined);
  }
  if (deleted !== deletedAtStart) {
    stopAndReload();
    throw new Error("Data was deleted");
  }
}

// Keep the IndexedDB save and localStorage cleanup together across tabs.
// Otherwise one tab could remove another tab's newer localStorage save.
async function withStorageLock<T>(
  run: (locked: boolean) => Promise<T>,
): Promise<T> {
  const locks = window.navigator?.locks;
  if (!locks) return run(false);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    return await locks.request(
      "chatbib-storage",
      { signal: controller.signal },
      () => {
        clearTimeout(timer);
        return run(true);
      },
    );
  } finally {
    clearTimeout(timer);
  }
}

// Check the deletion marker in the same transaction as the read or write.
// A tab opened before deletion must not restore chats if it missed the reload.
const guardedDb: UseStore = (mode, run) =>
  db()(
    mode,
    (store) =>
      new Promise((resolve, reject) => {
        stateOpened = true;
        const deleted = store.get(DELETED);
        deleted.onerror = () => reject(deleted.error);
        deleted.onsuccess = () => {
          try {
            checkDeletion();
            if (
              deleted.result !== undefined &&
              deleted.result !== deletedAtStart
            ) {
              stopAndReload();
              throw new Error("Data was deleted");
            }
            resolve(run(store));
          } catch (error) {
            store.transaction.abort();
            reject(error);
          }
        };
      }),
  );

async function saveToIdb(
  name: string,
  value: string | null,
  locked: boolean,
): Promise<boolean> {
  try {
    checkDeletion();
    const local = window.localStorage.getItem(name);
    // Save the marker first so later loads know to expect data in IndexedDB.
    // If this fails, skip the database write and keep using localStorage.
    if (window.localStorage.getItem(SAVED_IN_IDB + name) === null)
      window.localStorage.setItem(SAVED_IN_IDB + name, "1");
    await set(name, value, guardedDb);
    checkDeletion();
    // Without a lock, only remove the local copy we read before this save.
    if (
      locked ||
      (local !== null && window.localStorage.getItem(name) === local)
    )
      window.localStorage.removeItem(name);
    return true;
  } catch {
    return false;
  }
}

let warned = false;
function warnSaveFailure(error: unknown): void {
  console.error("Could not save browser data", error);
  if (warned) return;
  warned = true;
  // Load the toast code here because its imports lead back to this store.
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

async function flush(name: string): Promise<void> {
  try {
    while (waiting.has(name) && !wiping) {
      await withStorageLock(async (locked) => {
        const value = waiting.get(name);
        waiting.delete(name);
        if (
          value === undefined ||
          wiping ||
          unread.has(name) ||
          failed.has(name)
        )
          return;
        checkDeletion();
        if (!(await saveToIdb(name, value, locked)) && !waiting.has(name)) {
          checkDeletion();
          window.localStorage.setItem(name, value ?? "null");
        }
      });
    }
  } finally {
    saving.delete(name);
  }
}

function queueSave(name: string, value: string | null): Promise<void> {
  if (wiping || unread.has(name) || failed.has(name)) return Promise.resolve();
  // A streamed reply can change the store before the previous save finishes.
  // Keep only the latest waiting update and save it after the current one.
  waiting.set(name, value);
  if (!saving.has(name)) {
    const job = Promise.resolve().then(() => flush(name));
    saving.set(name, job);
  }
  return saving.get(name)!;
}

export const migrationAwareStorage: StateStorage = {
  getItem(name: string): Promise<string | null> {
    unread.add(name);
    return withStorageLock(async (locked) => {
      checkDeletion();
      // Failed IndexedDB saves and older app versions can leave newer data in
      // localStorage. If it cannot be read, the IndexedDB copy may be too old.
      const local = window.localStorage.getItem(name);
      if (local !== null) {
        await saveToIdb(name, local, locked);
        checkDeletion();
        unread.delete(name);
        return local;
      }
      const savedBefore =
        window.localStorage.getItem(SAVED_IN_IDB + name) !== null;
      const oldDraft =
        window.localStorage.getItem("saved-in-indexeddb") !== null;
      let value: string | null | undefined;
      let unavailable = false;
      try {
        value = await get(name, guardedDb);
      } catch (error) {
        // A read error does not mean the database is empty. Try older storage only
        // if this tab has not opened the new database and no saved data marker exists.
        if (stateOpened || savedBefore) throw error;
        unavailable = true;
      }
      if (value === undefined && savedBefore)
        throw new Error("Saved browser data is missing");
      // NextChat kept its old database after moving data to localStorage.
      // Read it only if that move never finished, or the previous adapter
      // stored current data there.
      if (
        value === undefined &&
        (oldDraft || window.localStorage.getItem(OLD_VERSION_FLAG) === null)
      ) {
        let legacy: unknown;
        let legacyOpened = false;
        try {
          legacy = await get(name, (mode, run) =>
            legacyDb()(mode, (store) => {
              legacyOpened = true;
              return run(store);
            }),
          );
          // The old marker covers the whole database. One saved value may be missing,
          // but an empty database could mean saved chats have been lost.
          if (legacy == null && oldDraft && !(await keys(legacyDb())).length)
            throw new Error("Previously saved browser data is missing");
        } catch (error) {
          // If both databases cannot open on first run, use localStorage.
          if (legacyOpened || !unavailable || oldDraft) throw error;
        }
        if (legacy != null) {
          const imported =
            typeof legacy === "string" ? legacy : JSON.stringify(legacy);
          value = imported;
          if (!(await saveToIdb(name, imported, locked))) {
            checkDeletion();
            window.localStorage.setItem(name, imported);
          }
        }
      }
      checkDeletion();
      unread.delete(name);
      return value ?? null;
    });
  },
  setItem(name: string, value: string): Promise<void> {
    return queueSave(name, value).catch(warnSaveFailure);
  },
  removeItem(name: string): Promise<void> {
    // Queue removal with saves so an earlier save cannot restore the data.
    // Store null so the next load does not import the old value again.
    return queueSave(name, null).catch(warnSaveFailure);
  },
};

const wipeChannel =
  typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("chatbib-wipe")
    : null;
if (wipeChannel) wipeChannel.onmessage = stopAndReload;

export async function clearChatStorage(): Promise<void> {
  wiping = true;
  waiting.clear();
  stopFileSaves();
  await Promise.allSettled(saving.values());
  await withStorageLock(async () => {
    const deletedAt = `${Date.now()}-${Math.random()}`;
    const previousDeletion = window.localStorage.getItem(LOCAL_DELETED);
    // Mark deletion as unfinished before removing data. If it stops halfway,
    // the next load must show the recovery screen because files may be missing.
    window.localStorage.setItem(LOCAL_DELETED, DELETE_PENDING + deletedAt);
    try {
      await clearFileBlobs(deletedAt);
    } catch (error) {
      // The files may already be deleted even though we did not get the result.
      // Keep the pending marker so the user can retry from the recovery screen.
      if (error instanceof Error && error.name === "TimeoutError") throw error;
      // The files and chats are still intact. Restore the previous marker.
      if (previousDeletion === null)
        window.localStorage.removeItem(LOCAL_DELETED);
      else window.localStorage.setItem(LOCAL_DELETED, previousDeletion);
      throw error;
    }
    if (window.indexedDB) {
      // Earlier versions copied these chats without removing the old records.
      await clear(legacyDb());
      await db()("readwrite", (store) => {
        store.clear();
        store.put(deletedAt, DELETED);
        return promisifyRequest(store.transaction);
      });
    }
    const keys = Array.from({ length: window.localStorage.length }, (_, i) =>
      window.localStorage.key(i),
    );
    for (const key of keys)
      if (key !== null && key !== LOCAL_DELETED)
        window.localStorage.removeItem(key);
    // Do not import old data after deleting everything, even if IndexedDB was unavailable.
    window.localStorage.setItem(OLD_VERSION_FLAG, "1");
    window.localStorage.setItem(LOCAL_DELETED, deletedAt);
    wipeChannel?.postMessage("deleted");
  });
}

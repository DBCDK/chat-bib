import { delMany, get, promisifyRequest, type UseStore } from "idb-keyval";
import { createBrowserStore } from "./indexeddb-store";

// Store attachment files separately. Chats refer to the files by ID.
const DELETED = ":deleted";
let filesStore: UseStore | undefined;
const files = () =>
  (filesStore ??= createBrowserStore("chatbib-files", "files"));
let deletedAtStart: unknown;
let wiping = false;

export function setFileDeletionTime(deleted: unknown): void {
  deletedAtStart = deleted;
}
export function stopFileSaves(): void {
  wiping = true;
}

// The pictures from a file are stored next to it under the same id plus
// ":images". They are kept out of the chat because the chat is saved again for
// every word of an answer. They are read back before each request.
const imagesKey = (id: string) => id + ":images";

// Saves a file or the pictures from a file. The deletion marker is read in the
// same transaction as the write. So nothing saved here can come back after
// another tab has deleted everything.
async function saveGuarded(
  key: IDBValidKey,
  value: Blob | string[],
): Promise<void> {
  try {
    if (wiping) throw new Error("Data was deleted");
    await files()("readwrite", (store) => {
      const finished = promisifyRequest(store.transaction);
      const deleted = store.get(DELETED);
      deleted.onsuccess = () => {
        if (
          wiping ||
          (deleted.result !== undefined && deleted.result !== deletedAtStart)
        ) {
          wiping = true;
          store.transaction.abort();
          return;
        }
        try {
          store.put(value, key);
        } catch {
          store.transaction.abort();
        }
      };
      return finished;
    });
  } catch {
    throw new Error("Filen kunne ikke gemmes. Prøv igen.");
  }
}

export function saveFileBlob(id: string, blob: Blob): Promise<void> {
  return saveGuarded(id, blob);
}

export function saveFileImages(id: string, images: string[]): Promise<void> {
  return saveGuarded(imagesKey(id), images);
}

export async function loadFileBlob(id: string): Promise<Blob | null> {
  try {
    const value = await get(id, files());
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

export async function loadFileImages(id: string): Promise<string[] | null> {
  try {
    const value = await get(imagesKey(id), files());
    return Array.isArray(value) ? value : null;
  } catch {
    return null;
  }
}

export async function deleteFileBlob(id: string): Promise<void> {
  if (wiping) return;
  try {
    // Remove the file and the pictures taken from it in one transaction.
    await delMany([id, imagesKey(id)], files());
  } catch {
    // Allow removal from the chat even if deleting the saved file fails.
  }
}

export async function clearFileBlobs(
  deletedAt: string | number,
  superseded: () => boolean = () => false,
): Promise<void> {
  wiping = true;
  if (!window.indexedDB) return;
  try {
    await files()("readwrite", (store) => {
      const finished = promisifyRequest(store.transaction);
      // Check inside the transaction so a delayed deletion cannot remove newer
      // files or replace the newer deletion marker.
      if (superseded()) return finished;
      try {
        store.clear();
        store.put(deletedAt, DELETED);
      } catch {
        store.transaction.abort();
      }
      return finished;
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") throw error;
    throw new Error("The attached files were not deleted");
  }
}

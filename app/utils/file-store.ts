import { del, get, promisifyRequest, type UseStore } from "idb-keyval";
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

export async function saveFileBlob(id: string, blob: Blob): Promise<void> {
  try {
    if (wiping) throw new Error("Data was deleted");
    await files()("readwrite", (store) => {
      const finished = promisifyRequest(store.transaction);
      const deleted = store.get(DELETED);
      // Check the deletion marker in the same transaction as the save.
      // Another tab must not clear the files between this check and the save.
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
          store.put(blob, id);
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

export async function loadFileBlob(id: string): Promise<Blob | null> {
  try {
    const value = await get(id, files());
    return value instanceof Blob ? value : null;
  } catch {
    return null;
  }
}

export async function deleteFileBlob(id: string): Promise<void> {
  if (wiping) return;
  try {
    await del(id, files());
  } catch {
    // Allow removal from the chat even if deleting the saved file fails.
  }
}

export async function clearFileBlobs(
  deletedAt: string | number,
): Promise<void> {
  wiping = true;
  if (!window.indexedDB) return;
  try {
    await files()("readwrite", (store) => {
      const finished = promisifyRequest(store.transaction);
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

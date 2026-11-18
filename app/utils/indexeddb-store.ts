import { createStore, type UseStore } from "idb-keyval";

export function createBrowserStore(
  dbName: string,
  storeName: string,
): UseStore {
  let current = createStore(dbName, storeName);
  return (mode, run) =>
    new Promise((resolve, reject) => {
      const store = current;
      let transaction: IDBTransaction | undefined;
      let expired = false;
      const timeoutError = new Error("Opening IndexedDB timed out");
      timeoutError.name = "TimeoutError";
      const abort = () => {
        try {
          transaction?.abort();
        } catch {
          // The transaction may already have finished.
        }
      };
      const timer = setTimeout(() => {
        expired = true;
        // If opening the database gets stuck, try a new connection next time.
        if (current === store) current = createStore(dbName, storeName);
        reject(timeoutError);
      }, 5000);

      try {
        void store(mode, (objectStore) => {
          // Stop the timer here so large reads and saves have time to finish.
          clearTimeout(timer);
          transaction = objectStore.transaction;
          // If the database opens after the timeout, stop before reading or saving.
          if (expired) {
            abort();
            throw timeoutError;
          }
          return run(objectStore);
        }).then(resolve, (error) => {
          abort();
          // Close the connection after an opening timeout so it cannot block
          // database upgrades or deletion.
          if (expired) transaction?.db.close();
          // The cached connection may be closed.
          // Open a new one on the next attempt.
          if (!transaction && current === store)
            current = createStore(dbName, storeName);
          clearTimeout(timer);
          reject(error);
        });
      } catch (error) {
        abort();
        clearTimeout(timer);
        reject(error);
      }
    });
}

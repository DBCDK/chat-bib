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
      const timeoutError = new Error("IndexedDB operation timed out");
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
        if (!transaction && current === store)
          current = createStore(dbName, storeName);
        abort();
        reject(timeoutError);
      }, 5000);

      try {
        void store(mode, (objectStore) => {
          transaction = objectStore.transaction;
          // If the database opens after the timeout, stop before reading or saving.
          if (expired) {
            abort();
            throw timeoutError;
          }
          return run(objectStore);
        }).then(
          (value) => {
            clearTimeout(timer);
            resolve(value);
          },
          (error) => {
            abort();
            // The old connection may finish opening after we have replaced it.
            // Close it so it cannot block database upgrades or deletion.
            if (expired && store !== current) transaction?.db.close();
            clearTimeout(timer);
            reject(error);
          },
        );
      } catch (error) {
        abort();
        clearTimeout(timer);
        reject(error);
      }
    });
}

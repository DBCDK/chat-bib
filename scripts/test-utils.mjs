import fs from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const root = new URL("../", import.meta.url);

// Run the storage code with fake browser APIs to control failures and timing.
// Database transactions run one at a time and apply all changes together;
// request callbacks can add more work.
export function storageBrowser() {
  const databases = new Map();
  const local = new Map();
  const timers = new Map();
  const channels = [];
  const lockQueues = new Map();
  const locks = {
    request(name, { signal, mode = "exclusive" } = {}, run) {
      if (signal?.aborted) return Promise.reject(signal.reason);
      const state = lockQueues.get(name) ?? { held: [], waiting: [] };
      lockQueues.set(name, state);
      return new Promise((resolve, reject) => {
        const request = { mode, run, resolve, reject };
        const pump = () => {
          while (state.waiting.length) {
            const first = state.waiting[0];
            if (
              state.held.length &&
              (first.mode === "exclusive" || state.held[0].mode === "exclusive")
            )
              return;
            state.waiting.shift();
            state.held.push(first);
            first.acquired();
            Promise.resolve()
              .then(first.run)
              .then(first.resolve, first.reject)
              .finally(() => {
                state.held.splice(state.held.indexOf(first), 1);
                pump();
                if (!state.held.length && !state.waiting.length)
                  lockQueues.delete(name);
              });
          }
        };
        const abort = () => {
          const index = state.waiting.indexOf(request);
          if (index < 0) return;
          state.waiting.splice(index, 1);
          reject(signal.reason);
          pump();
        };
        request.acquired = () => signal?.removeEventListener("abort", abort);
        signal?.addEventListener("abort", abort, { once: true });
        state.waiting.push(request);
        pump();
      });
    },
  };
  let now = Date.now();
  const browser = {
    local,
    locks,
    webLocks: false,
    available: true,
    localGetterFails: false,
    localReadFails: false,
    localWriteFails: false,
    localWriteFailsFor: new Set(),
    localRemoveFails: false,
    broadcasts: true,
    advanceTime(milliseconds) {
      now += milliseconds;
    },
    database(name) {
      if (!databases.has(name)) {
        databases.set(name, {
          data: new Map(),
          queue: [],
          openResults: [],
          writeResults: [],
          readResults: [],
          pendingOpens: [],
          pendingCommits: [],
          readErrors: new Set(),
          opens: 0,
          closes: 0,
          transactionThrows: 0,
          exists: true,
        });
      }
      return databases.get(name);
    },
    expireTimers() {
      const callbacks = [...timers.values()];
      timers.clear();
      callbacks.forEach((fn) => fn());
    },
    timerCount: () => timers.size,
  };
  const localStorage = {
    get length() {
      return local.size;
    },
    key: (index) => [...local.keys()][index] ?? null,
    getItem(key) {
      if (browser.localReadFails) throw new Error("localStorage unavailable");
      return local.get(key) ?? null;
    },
    setItem(key, value) {
      if (browser.localWriteFails || browser.localWriteFailsFor.has(key))
        throw new Error("localStorage full");
      local.set(key, String(value));
    },
    removeItem(key) {
      if (browser.localRemoveFails) throw new Error("localStorage unavailable");
      local.delete(key);
    },
    clear: () => local.clear(),
  };
  const indexedDB = {
    open(name) {
      const db = browser.database(name);
      db.opens++;
      const outcome = db.openResults.shift();
      if (outcome === "throw") throw new Error("Open failed");
      const request = {};
      const finish = () => {
        if (outcome === "error") return request.onerror?.();
        if (outcome === "fresh") db.exists = false;
        const upgrade = !db.exists;
        let upgradeAborted = false;
        if (upgrade)
          request.transaction = {
            abort: () => {
              upgradeAborted = true;
            },
          };
        request.result = {
          objectStoreNames: { contains: () => !upgrade },
          createObjectStore: () => {},
          close: () => {
            db.closes++;
          },
          transaction(_name, mode) {
            if (db.transactionThrows > 0) {
              db.transactionThrows--;
              throw new Error("Closed connection");
            }
            const outcome =
              mode === "readwrite"
                ? db.writeResults.shift()
                : db.readResults.shift();
            const jobs = [];
            let active = false;
            let ended = false;
            let staged;
            const leave = () => {
              ended = true;
              db.queue.shift();
              db.queue[0]?.();
            };
            const abort = () => {
              if (ended) return;
              leave();
              queueMicrotask(() => tx.onabort?.());
            };
            const commit = () => {
              if (ended) return;
              if (outcome === "abort" || outcome === "error") {
                leave();
                tx["on" + outcome]?.();
                return;
              }
              if (mode === "readwrite") {
                db.data.clear();
                for (const [key, value] of staged) db.data.set(key, value);
              }
              leave();
              tx.oncomplete?.();
            };
            const pump = () => {
              if (!active || ended) return;
              const job = jobs.shift();
              if (job) {
                job();
                queueMicrotask(pump);
              } else if (outcome === "pending") db.pendingCommits.push(commit);
              else commit();
            };
            const enqueue = (job) => {
              jobs.push(job);
            };
            const store = {
              get(key) {
                const request = {};
                enqueue(() => {
                  if (db.readErrors.has(key)) {
                    request.error = new Error("Read failed");
                    request.onerror?.();
                    tx.onerror?.();
                    abort();
                    return;
                  }
                  request.result = staged.get(key);
                  request.onsuccess?.({ target: request });
                });
                return request;
              },
              put: (value, key) => enqueue(() => staged.set(key, value)),
              delete: (key) => enqueue(() => staged.delete(key)),
              clear: () => enqueue(() => staged.clear()),
            };
            const tx = { objectStore: () => store, abort };
            store.transaction = tx;
            db.queue.push(() => {
              active = true;
              staged = new Map(db.data);
              queueMicrotask(pump);
            });
            if (db.queue.length === 1) db.queue[0]();
            return tx;
          },
        };
        if (upgrade) request.onupgradeneeded?.();
        if (upgradeAborted) return request.onerror?.();
        db.exists = true;
        request.onsuccess?.();
      };
      if (outcome === "pending") db.pendingOpens.push(finish);
      else queueMicrotask(finish);
      return request;
    },
  };
  browser.tab = () => {
    const modules = new Map();
    const notices = [];
    const errors = [];
    let reloads = 0;
    const localHooks = {};
    const tabLocalStorage = {
      get length() {
        return localStorage.length;
      },
      key: localStorage.key,
      getItem(key) {
        const value = localStorage.getItem(key);
        return localHooks.read ? localHooks.read(key, value) : value;
      },
      setItem(key, value) {
        localHooks.beforeWrite?.(key, value);
        localStorage.setItem(key, value);
      },
      removeItem: localStorage.removeItem,
      clear: localStorage.clear,
    };
    const window = {
      get navigator() {
        return browser.webLocks ? { locks } : {};
      },
      get localStorage() {
        if (browser.localGetterFails) throw new Error("localStorage blocked");
        return tabLocalStorage;
      },
      get indexedDB() {
        return browser.available ? indexedDB : undefined;
      },
    };
    function load(path) {
      const url = new URL(path, root);
      if (modules.has(url.href)) return modules.get(url.href);
      const exports = {};
      modules.set(url.href, exports);
      const code = ts.transpileModule(fs.readFileSync(url, "utf8"), {
        compilerOptions: {
          target: ts.ScriptTarget.ES2020,
          module: ts.ModuleKind.CommonJS,
        },
      }).outputText;
      new Function(
        "exports",
        "require",
        "window",
        "location",
        "BroadcastChannel",
        "setTimeout",
        "clearTimeout",
        "Date",
        "console",
        code,
      )(
        exports,
        (name) =>
          name.endsWith("components/ui-lib")
            ? { showToast: (...args) => notices.push(args) }
            : name.startsWith(".")
              ? load(new URL(name + ".ts", url).href)
              : require(name),
        window,
        {
          reload: () => {
            reloads++;
          },
        },
        class BroadcastChannel {
          constructor(name) {
            this.name = name;
            channels.push(this);
          }
          postMessage(data) {
            if (browser.broadcasts)
              for (const other of channels) {
                if (other !== this && other.name === this.name)
                  queueMicrotask(() => other.onmessage?.({ data }));
              }
          }
          close() {}
        },
        (fn) => {
          const id = {};
          timers.set(id, fn);
          return id;
        },
        (id) => timers.delete(id),
        class BrowserDate extends Date {
          static now() {
            return now;
          }
        },
        { error: (...args) => errors.push(args), log() {}, warn() {} },
      );
      return exports;
    }
    return {
      load,
      notices,
      errors,
      localHooks,
      reloads: () => reloads,
      storage: () => load("app/utils/idb-migration.ts"),
      files: () => load("app/utils/file-store.ts"),
    };
  };
  return browser;
}

export async function flush() {
  // Allow queued promises and fake database callbacks to finish.
  for (let n = 0; n < 20; n++) await Promise.resolve();
}

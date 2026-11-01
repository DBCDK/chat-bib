import { create } from "zustand";
import { combine, persist, createJSONStorage } from "zustand/middleware";
import { Updater } from "../typing";
import { deepClone } from "./clone";
import { migrationAwareStorage, blockSaving } from "./idb-migration";

type SecondParam<T> = T extends (
  _f: infer _F,
  _s: infer S,
  ...args: infer _U
) => any
  ? S
  : never;

type MakeUpdater<T> = {
  lastUpdateTime: number;

  markUpdate: () => void;
  update: Updater<T>;
};

type SetStoreState<T> = (
  partial: T | Partial<T> | ((state: T) => T | Partial<T>),
  replace?: boolean | undefined,
) => void;

// Wait for saved data, or it could overwrite a new chat or settings change.
export function hydrated(store: {
  persist: {
    hasHydrated(): boolean;
    onFinishHydration(fn: () => void): () => void;
  };
}): Promise<void> {
  return new Promise((resolve) => {
    if (store.persist.hasHydrated()) return resolve();
    const stop = store.persist.onFinishHydration(() => {
      stop();
      resolve();
    });
  });
}

export function createPersistStore<T extends object, M>(
  state: T,
  methods: (
    set: SetStoreState<T & MakeUpdater<T>>,
    get: () => T & MakeUpdater<T>,
  ) => M,
  persistOptions: SecondParam<typeof persist<T & M & MakeUpdater<T>>>,
) {
  // eslint-disable-next-line no-param-reassign
  if (typeof window !== "undefined") {
    persistOptions.storage = createJSONStorage(() => migrationAwareStorage);
  }

  // Zustand sends load and migrate errors to the returned callback.
  // Log them and block saves so defaults can't overwrite saved data.
  const options = persistOptions as any;
  const storeOnRehydrate = options.onRehydrateStorage;
  // eslint-disable-next-line no-param-reassign
  options.onRehydrateStorage = (preHydrationState: any) => {
    const storeCallback = storeOnRehydrate?.(preHydrationState);
    return (hydratedState: any, error?: unknown) => {
      if (error) {
        blockSaving(options.name);
        console.error(
          `[store:${options.name}] rehydration failed — persisted data was NOT loaded, ` +
            `the store is running on defaults and is not saved until a reload`,
          error,
        );
      }
      storeCallback?.(hydratedState, error);
    };
  };

  return create(
    persist(
      combine(
        {
          ...state,
          lastUpdateTime: 0,
        },
        (set, get) => {
          return {
            ...methods(set, get as any),

            markUpdate() {
              set({ lastUpdateTime: Date.now() } as Partial<
                T & M & MakeUpdater<T>
              >);
            },
            update(updater) {
              const state = deepClone(get());
              updater(state);
              set({
                ...state,
                lastUpdateTime: Date.now(),
              });
            },
          } as M & MakeUpdater<T>;
        },
      ),
      persistOptions as any,
    ),
  );
}

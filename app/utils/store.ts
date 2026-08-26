import { create } from "zustand";
import { combine, persist, createJSONStorage } from "zustand/middleware";
import { Updater } from "../typing";
import { deepClone } from "./clone";
import { migrationAwareStorage } from "./idb-migration";

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

export function createPersistStore<T extends object, M>(
  state: T,
  methods: (
    set: SetStoreState<T & MakeUpdater<T>>,
    get: () => T & MakeUpdater<T>,
  ) => M,
  persistOptions: SecondParam<typeof persist<T & M & MakeUpdater<T>>>,
) {
  // eslint-disable-next-line no-param-reassign
  if (typeof window !== "undefined" && window.localStorage) {
    persistOptions.storage = createJSONStorage(() => migrationAwareStorage);
  }

  // Make hydration failures visible. Zustand runs hydration as a promise chain
  // and hands any rejection — including anything thrown by `migrate` — to the
  // callback returned by `onRehydrateStorage`. When a store does not define
  // one that callback is `undefined`, so the error is discarded without ever
  // reaching the console: the store silently falls back to its defaults and
  // then overwrites the persisted data on the next write. Wrap whatever the
  // store already declared instead of replacing it.
  const options = persistOptions as any;
  const storeOnRehydrate = options.onRehydrateStorage;
  // eslint-disable-next-line no-param-reassign
  options.onRehydrateStorage = (preHydrationState: any) => {
    const storeCallback = storeOnRehydrate?.(preHydrationState);
    return (hydratedState: any, error?: unknown) => {
      if (error) {
        console.error(
          `[store:${options.name}] rehydration failed — persisted data was NOT loaded, ` +
            `the store is running on defaults and may overwrite it`,
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

import { storage } from 'wxt/utils/storage';

/**
 * Every setting Shorts Flow has, as the viewer last left it. Later features add
 * their own key here with its default in `DEFAULT_SETTINGS`; the store, the
 * engine and the Popup pick it up from there.
 */
export type Settings = {
  /** Whether the Shorts Feed Advances on its own when the Current Short ends. */
  autoScroll: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
  autoScroll: true,
};

export interface SettingsStore {
  get(): Promise<Settings>;
  set(changes: Partial<Settings>): Promise<void>;
  /**
   * Calls `listener` with the full settings whenever any of them changes,
   * from this page or any other. Returns a function that stops watching.
   */
  watch(listener: (settings: Settings) => void): () => void;
}

const KEYS = Object.keys(DEFAULT_SETTINGS) as (keyof Settings)[];

// Each setting is its own key in local storage (ADR 0003: never synced), so
// two tabs changing different settings at once never overwrite each other.
const storageKey = (key: keyof Settings) => `local:${key}` as const;

/** The settings in browser storage, shared by every tab, the Popup and the background. */
export function createSettingsStore(): SettingsStore {
  const store: SettingsStore = {
    async get() {
      const items = await storage.getItems(
        KEYS.map((key) => ({ key: storageKey(key), options: { fallback: DEFAULT_SETTINGS[key] } })),
      );
      return Object.fromEntries(items.map(({ value }, i) => [KEYS[i], value])) as Settings;
    },

    async set(changes) {
      await storage.setItems(
        Object.entries(changes).map(([key, value]) => ({ key: storageKey(key as keyof Settings), value })),
      );
    },

    watch(listener) {
      let watching = true;
      const unwatchers = KEYS.map((key) =>
        storage.watch(storageKey(key), async () => {
          const settings = await store.get();
          if (watching) listener(settings);
        }),
      );
      return () => {
        watching = false;
        for (const unwatch of unwatchers) unwatch();
      };
    },
  };
  return store;
}

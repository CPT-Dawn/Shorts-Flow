import { NO_SESSION, type Session, type SessionStore } from '@/settings/session';
import { DEFAULT_SETTINGS, type Settings, type SettingsStore } from '@/settings/settings';

/**
 * An in-memory settings store for engine tests. Share one between two
 * mounted Shorts Feeds to stand in for two tabs of the same browser.
 */
export function createTestSettingsStore(initial: Partial<Settings> = {}): SettingsStore {
  let settings: Settings = { ...DEFAULT_SETTINGS, ...initial };
  const listeners = new Set<(settings: Settings) => void>();

  return {
    async get() {
      return structuredClone(settings);
    },

    async set(changes) {
      settings = { ...settings, ...changes };
      // Like browser storage, tell watchers after the write, not during it.
      const snapshot = structuredClone(settings);
      queueMicrotask(() => listeners.forEach((listener) => listener(snapshot)));
    },

    watch(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/** An in-memory Session store for engine tests, shareable between tabs like the settings one. */
export function createTestSessionStore(initial: Partial<Session> = {}): SessionStore {
  let session: Session = { ...NO_SESSION, ...initial };
  const listeners = new Set<(session: Session) => void>();

  return {
    async get() {
      return { ...session };
    },

    async update(change) {
      session = change({ ...session });
      const snapshot = { ...session };
      queueMicrotask(() => listeners.forEach((listener) => listener(snapshot)));
    },

    watch(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

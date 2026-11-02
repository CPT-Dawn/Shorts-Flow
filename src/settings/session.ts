import { storage } from 'wxt/utils/storage';

/**
 * The current Session: how much the viewer has watched in this sitting. Only
 * its shape and store exist so far; Session tracking and the Break Nudge
 * (#14) fill it in, adding the rules for when a Session ends.
 */
export type Session = {
  shortsWatched: number;
  /** How long Shorts have played on the Shorts Feed this Session, in ms. */
  playingMs: number;
  /** When the viewer was last watching, in ms since the epoch; 0 if never. */
  lastSeenAt: number;
};

export const NO_SESSION: Session = { shortsWatched: 0, playingMs: 0, lastSeenAt: 0 };

/** The current Session, shared by every tab and the Popup. */
export interface SessionStore {
  get(): Promise<Session>;
  /**
   * Replaces the stored Session with what `change` makes of it. Changes from
   * one page apply one after another, each to the Session the last one left.
   */
  update(change: (stored: Session) => Session): Promise<void>;
  /** Calls `listener` whenever the Session changes, from any page. Returns a function that stops watching. */
  watch(listener: (session: Session) => void): () => void;
}

export function createSessionStore(): SessionStore {
  // Local, never synced: the Session never leaves this browser (ADR 0003).
  const item = storage.defineItem<Session>('local:session', { fallback: NO_SESSION });
  let last: Promise<void> = Promise.resolve();
  return {
    get: () => item.getValue(),
    update(change) {
      const next = last.then(async () => item.setValue(change(await item.getValue())));
      // One failed change doesn't stop the ones after it.
      last = next.catch(() => {});
      return next;
    },
    watch: (listener) => item.watch((session) => listener(session ?? NO_SESSION)),
  };
}

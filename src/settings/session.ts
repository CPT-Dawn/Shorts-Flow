import { storage } from 'wxt/utils/storage';
import type { SessionLimit } from './settings';

/**
 * How long with no Short playing ends a Session, in ms: away from the Shorts
 * Feed, or with it paused in front of the viewer.
 */
export const SESSION_GAP = 30 * 60_000;

/** The current Session: how much the viewer has watched in this sitting. */
export type Session = {
  shortsWatched: number;
  /** How long Shorts have played on the Shorts Feed this Session, in ms. */
  playingMs: number;
  /**
   * When the viewer was last watching, a Short playing or just counted, in ms
   * since the epoch; 0 if never.
   */
  lastSeenAt: number;
  /**
   * Where the Session Limit counts from: the Session as it stood when the
   * viewer last dismissed the Break Nudge, so the next one comes only after
   * another full limit. Absent until they first do.
   */
  limitFrom?: Pick<Session, 'shortsWatched' | 'playingMs'>;
};

export const NO_SESSION: Session = { shortsWatched: 0, playingMs: 0, lastSeenAt: 0 };

/**
 * The Session as it stands at `now`, from the one last stored: a new, empty
 * one once no Short has played for `SESSION_GAP`.
 */
export function sessionAt(stored: Session, now: number): Session {
  return now - stored.lastSeenAt >= SESSION_GAP ? NO_SESSION : stored;
}

/** Whether `session` has reached `limit` since the limit last counted from, in Shorts Watched or playing minutes. */
export function limitReached(session: Session, limit: SessionLimit): boolean {
  if (limit.kind === 'off') return false;
  const from = session.limitFrom ?? NO_SESSION;
  return limit.kind === 'shorts'
    ? session.shortsWatched - from.shortsWatched >= limit.value
    : session.playingMs - from.playingMs >= limit.value * 60_000;
}

/** The current Session, shared by every tab and the Popup. */
export interface SessionStore {
  /** The Session as last stored, which may have ended since: see `sessionAt`. */
  get(): Promise<Session>;
  /**
   * Replaces the stored Session with what `change` makes of it. Changes apply
   * one after another, each to the Session the last one left, from this page
   * and, where the browser can coordinate them, from every other tab too.
   */
  update(change: (stored: Session) => Session): Promise<void>;
  /** Calls `listener` whenever the Session changes, from any page. Returns a function that stops watching. */
  watch(listener: (session: Session) => void): () => void;
}

/** The name of the lock every YouTube tab takes to change the stored Session. */
const SESSION_LOCK = 'shorts-flow:session';

export function createSessionStore(): SessionStore {
  // Local, never synced: the Session never leaves this browser (ADR 0003).
  const item = storage.defineItem<Session>('local:session', { fallback: NO_SESSION });
  const apply = async (change: (stored: Session) => Session) => item.setValue(change(await item.getValue()));
  // Every Shorts tab is on www.youtube.com, so they share its Web Locks: two
  // tabs never read and write the Session at once and lose each other's count.
  const locks = globalThis.navigator?.locks;
  const exclusively = (change: (stored: Session) => Session) =>
    locks ? locks.request(SESSION_LOCK, () => apply(change)) : apply(change);
  let last: Promise<void> = Promise.resolve();
  return {
    get: () => item.getValue(),
    update(change) {
      const next = last.then(() => exclusively(change));
      // One failed change doesn't stop the ones after it.
      last = next.catch(() => {});
      return next;
    },
    watch: (listener) => item.watch((session) => listener(session ?? NO_SESSION)),
  };
}

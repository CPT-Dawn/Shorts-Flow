import { limitReached, SESSION_GAP, sessionAt, type Session } from '@/settings/session';
import { createBreakNudge } from './break-nudge';
import type { Feature, Feed } from './feed';
import { currentShortId, shortsVideo } from './youtube';

/** How often to look at the Shorts Feed, in ms. */
const TICK = 250;

/** How long a Short must be the Current Short to count as watched, in ms. */
const COUNT_AFTER = 1000;

/** How often to store the Session while the viewer is watching, in ms. */
const SAVE_EVERY = 10_000;

/**
 * The longest stretch between two looks that counts towards playing time, in
 * ms: browsers slow timers down in a background tab, and stop them while the
 * computer sleeps.
 */
const LONGEST_TICK = 60_000;

/** What this page has seen of the Session since it last stored it. */
type Unsaved = Pick<Session, 'shortsWatched' | 'playingMs'> & {
  /** When the viewer was first and last watching, if they were. */
  firstWatchingAt?: number;
  lastWatchingAt?: number;
};

/**
 * The Session and the Break Nudge, while the page is on the Shorts Feed.
 *
 * Shorts Watched counts a Short each time it becomes the Current Short and
 * stays so for `COUNT_AFTER` while the Shorts Feed is in front of the viewer
 * or playing, whether an Advance or the viewer brought it there: going back
 * to a Short seen before counts it again, and so does coming back to the
 * Shorts Feed on it. A Short looping in place, or waiting in a background
 * tab, stays the same Current Short and counts once. Playing time adds up
 * while a Short plays. A Session ends after `SESSION_GAP` with no Short
 * playing in any tab.
 *
 * When the Session reaches the Session Limit while a Short plays, the Break
 * Nudge pauses it. Dismissing the nudge plays it again and counts the limit
 * afresh from there, for every tab.
 */
export const watchSession: Feature = (feed) => {
  const tracker = trackSession(feed);
  const nudge = createBreakNudge(feed);

  tracker.onTick(({ playing, live }) => {
    const limit = feed.settings()?.sessionLimit;
    if (!playing || nudge.shown || !live || !limit || !limitReached(live, limit)) return;
    shortsVideo(feed.document)?.pause();
    nudge.show(() => {
      tracker.restartLimit();
      void shortsVideo(feed.document)?.play().catch(() => {});
    });
  });
};

type Tick = {
  /** Whether a Short is playing. */
  playing: boolean;
  /** The Session as it stands, every tab's watching included; undefined until read. */
  live: Session | undefined;
};

/**
 * Keeps the stored Session up to date with what this page sees, for as long
 * as the visit lasts. What it counts is stored as a change to whatever the
 * stored Session is by then, so tabs watching at once add up.
 */
function trackSession(feed: Feed) {
  const { document, clock } = feed;
  const store = feed.session;
  // The Current Short, by id (YouTube plays every Short in one `<video>`,
  // so a loop is no new Short); since when it has been in view; and whether
  // it has counted since it became the Current Short.
  let currentShort: string | undefined;
  let currentSince = clock.now();
  let currentCounted = false;
  let lastTick = clock.now();
  let wasPlaying = false;
  let lastWatchingAt: number | undefined;
  let savedAt = -Infinity;
  let unsaved: Unsaved = { shortsWatched: 0, playingMs: 0 };
  // The Session as last stored, by this page or another, with what this page
  // has asked to store since applied; undefined until read.
  let stored: Session | undefined;
  const tickListeners: ((tick: Tick) => void)[] = [];

  const unwatchStored = store.watch((changed) => {
    stored = changed;
  });
  void store.get().then((read) => {
    stored ??= read;
  });

  /** The Session as it stands now, with what this page hasn't stored yet. */
  const live = (): Session | undefined => {
    if (!stored) return undefined;
    const current = sessionAt(stored, unsaved.firstWatchingAt ?? clock.now());
    return {
      ...current,
      shortsWatched: current.shortsWatched + unsaved.shortsWatched,
      playingMs: current.playingMs + unsaved.playingMs,
    };
  };

  /**
   * Stores what this page has seen since it last did, and, given `limitFrom`,
   * where the Session Limit counts from now.
   */
  const save = (limitFrom?: Session['limitFrom']) => {
    const { firstWatchingAt, lastWatchingAt, shortsWatched, playingMs } = unsaved;
    unsaved = { shortsWatched: 0, playingMs: 0 };
    savedAt = clock.now();
    const seen = firstWatchingAt !== undefined && lastWatchingAt !== undefined;
    if (!seen && !limitFrom) return;
    const change = (stored: Session): Session => {
      // A new Session if no Short played, in any tab, for long enough.
      const current = seen ? sessionAt(stored, firstWatchingAt) : stored;
      return {
        ...current,
        shortsWatched: current.shortsWatched + shortsWatched,
        playingMs: current.playingMs + playingMs,
        lastSeenAt: seen ? Math.max(current.lastSeenAt, lastWatchingAt) : current.lastSeenAt,
        ...(limitFrom && { limitFrom }),
      };
    };
    // Counted here at once, before the store says it's done.
    if (stored) stored = change(stored);
    store.update(change).catch(() => {});
  };

  const watched = (at: number) => {
    lastWatchingAt = at;
    unsaved.firstWatchingAt ??= at;
    unsaved.lastWatchingAt = at;
  };

  const tick = () => {
    const now = clock.now();
    const sinceLastTick = Math.min(Math.max(now - lastTick, 0), LONGEST_TICK);
    lastTick = now;
    const playing = aShortPlays(document);

    if (playing) {
      // Playing again after long enough that, as far as this page knows, the
      // Session has ended: the Current Short is the new Session's first.
      if (lastWatchingAt !== undefined && now - lastWatchingAt >= SESSION_GAP) {
        currentSince = now;
        currentCounted = false;
      }
      watched(now);
      // Only time a Short played all through: one that has just started, or
      // just stopped, may not have played for most of it.
      if (wasPlaying) unsaved.playingMs += sinceLastTick;
    }

    const short = currentShortId(document);
    if (short !== currentShort) {
      currentShort = short;
      currentSince = now;
      currentCounted = false;
    }
    if (!playing && document.visibilityState !== 'visible') {
      // In another tab: a Short must be in view a while once they're back.
      currentSince = now;
    } else if (short !== undefined && !currentCounted && now - currentSince >= COUNT_AFTER) {
      currentCounted = true;
      unsaved.shortsWatched++;
      watched(now);
      save();
    }

    for (const listener of tickListeners) listener({ playing, live: live() });

    // Stopped watching: store when, for the Session's end to count from.
    if (wasPlaying && !playing) save();
    else if (now - savedAt >= SAVE_EVERY) save();
    wasPlaying = playing;
    feed.setTimeout(tick, TICK);
  };

  // Closing the tab: store what hasn't been yet, as far as the browser lets a
  // closing page finish.
  document.defaultView!.addEventListener('pagehide', () => save(), { signal: feed.signal });
  feed.signal.addEventListener(
    'abort',
    () => {
      unwatchStored();
      save();
    },
    { once: true },
  );
  tick();

  return {
    /** Calls `listener` each time the tracker has looked at the Shorts Feed. */
    onTick(listener: (tick: Tick) => void) {
      tickListeners.push(listener);
    },
    /** Counts the Session Limit afresh from the Session as it stands now, for every tab. */
    restartLimit() {
      const from = live();
      if (from) save({ shortsWatched: from.shortsWatched, playingMs: from.playingMs });
    },
  };
}

/** Whether the Current Short is playing: not paused, nor waiting for data. */
function aShortPlays(document: Document) {
  const video = shortsVideo(document);
  return !!video && !video.paused && !video.ended && video.readyState >= video.HAVE_FUTURE_DATA;
}

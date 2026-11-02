import { browser } from 'wxt/browser';
import type { ContentScriptContext } from 'wxt/utils/content-script-context';
import { type Clock, mountEngine } from '@/engine/engine';
import { answerFeedStatus } from '@/messaging/feed-status';
import { createSessionStore } from '@/settings/session';
import { createSettingsStore } from '@/settings/settings';

export default defineContentScript({
  // All of youtube.com, not just the Shorts Feed: YouTube reaches /shorts/
  // without a page load, so the engine must already be there to notice.
  // Off the Shorts Feed it does nothing.
  matches: ['https://www.youtube.com/*'],
  main(ctx) {
    // When the extension updates or is removed, the context is invalidated:
    // its signal tears the engine down, and its timers stop with it.
    mountEngine(document, {
      settings: createSettingsStore(),
      session: createSessionStore(),
      getMessage: (name, substitutions) => browser.i18n.getMessage(name, substitutions),
      clock: contextClock(ctx),
      signal: ctx.signal,
    });
    // The Popup asks whether this tab is on the Shorts Feed.
    answerFeedStatus(window, ctx.signal);
  },
});

/** The page's clock, with every timer set through WXT's content-script context. */
function contextClock(ctx: ContentScriptContext): Clock {
  return {
    now: () => performance.timeOrigin + performance.now(),
    setTimeout: (callback, ms) => ctx.setTimeout(callback, ms),
    clearTimeout: (id) => clearTimeout(id),
  };
}

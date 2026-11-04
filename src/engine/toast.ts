import type { Feed } from './feed';
import { placeOnPage } from './on-page';
import { lookVariables } from './youtube-look';

export type ToastOptions = {
  /** One button beside the message, as YouTube's "Undo" or "Retry". */
  action?: { label: string; onPress: () => void };
  /** Hides the toast by itself after this many ms. Without it, it stays until hidden. */
  duration?: number;
};

/** One kind of toast, shown and hidden as often as needed. */
export type Toast = {
  /** Shows `message`, in place of whatever this toast showed before. */
  show(message: string, options?: ToastOptions): void;
  hide(): void;
  readonly shown: boolean;
};

type ToastFeed = Pick<Feed, 'document' | 'signal' | 'setTimeout' | 'clearTimeout'>;

/** Where a visit's toasts go: one stack, bottom left. Keyed by the visit's signal, which every feature shares. */
const stacks = new WeakMap<AbortSignal, HTMLElement>();

/**
 * A toast in YouTube's own style (its snackbar, bottom left, inverted
 * colours), for a short message from Shorts Flow on the Shorts Feed: the
 * Stall notice, a Shortcut's confirmation. Native Look (ADR 0002).
 *
 * `name` tells toasts apart on the page. Each kind keeps its own place in
 * one stack: two showing at once sit one above the other, so a Shortcut's
 * brief confirmation never covers the Stall notice and its Retry. The first
 * kind made sits lowest and stays put as later ones come and go.
 *
 * Each is announced politely to screen readers. Its live region is always
 * in the page and empty while hidden; only the card the eye sees is hidden.
 * Showing puts the card up first and the message in the frame after, so
 * screen readers hear the text arrive in a region they were already
 * watching (one that appears with its text already in it often goes
 * unheard). A toast goes when the visit ends.
 */
export function createToast(feed: ToastFeed, name: string): Toast {
  const { document } = feed;
  const view = document.defaultView!;

  const region = document.createElement('div');
  region.className = 'region';
  region.dataset.toast = name;
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  const card = document.createElement('div');
  card.className = 'toast';
  card.hidden = true;
  const message = document.createElement('div');
  message.className = 'message';
  const actions = document.createElement('div');
  actions.className = 'actions';
  card.append(message, actions);
  region.append(card);
  stackOf(feed).append(region);

  let timer: number | undefined;
  let frame: number | undefined;
  const clearPending = () => {
    if (timer !== undefined) feed.clearTimeout(timer);
    if (frame !== undefined) view.cancelAnimationFrame(frame);
    timer = frame = undefined;
  };
  const hide = () => {
    clearPending();
    card.hidden = true;
    // Empty while hidden, so the next message is news to a screen reader, even the same one.
    message.textContent = '';
    actions.replaceChildren();
  };
  feed.signal.addEventListener('abort', clearPending, { once: true });

  return {
    show(text, { action, duration } = {}) {
      hide();
      card.hidden = false;
      frame = view.requestAnimationFrame(() => {
        frame = undefined;
        message.textContent = text;
        if (!action) return;
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label;
        button.addEventListener('click', () => action.onPress(), { signal: feed.signal });
        actions.append(button);
      });
      if (duration !== undefined) timer = feed.setTimeout(hide, duration);
    },
    hide,
    get shown() {
      return !card.hidden;
    },
  };
}

/** The visit's toast stack, placed on the page with the first toast. */
function stackOf(feed: ToastFeed): HTMLElement {
  let stack = stacks.get(feed.signal);
  if (!stack) {
    const { root } = placeOnPage(feed, 'toasts', { css: TOAST_CSS });
    stack = feed.document.createElement('div');
    stack.className = 'stack';
    root.append(stack);
    stacks.set(feed.signal, stack);
  }
  return stack;
}

/**
 * YouTube's snackbar, from its 2026-11 stylesheets (`snackbarViewModel*`,
 * `ytSnackbarContainer*`, `ytSpecButtonShapeNext*`): inverted colours, so
 * light on the dark theme and dark on the light one, with its blue text
 * button; the colours are YouTube's (youtube-look.ts). The stack keeps
 * YouTube's 16 px from the window's corner, above its 30 px bottom offset,
 * and lets clicks through wherever no card is.
 */
const TOAST_CSS = `
${lookVariables({ light: ':host', dark: ':host([data-theme="dark"])' })}
.stack {
  position: fixed;
  left: 0;
  bottom: 30px;
  z-index: 20000;
  display: flex;
  flex-direction: column-reverse;
  align-items: flex-start;
  padding: 0 16px 16px;
  pointer-events: none;
}
.toast {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  min-width: 288px;
  max-width: 448px;
  min-height: 48px;
  max-height: 64px;
  margin-top: 8px;
  border-radius: 8px;
  background-color: var(--shorts-flow-snackbar);
  color: var(--shorts-flow-snackbar-ink);
  font-family: Roboto, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
  pointer-events: auto;
  animation: slide-in 0.5s ease forwards;
}
.toast[hidden] {
  display: none;
}
.message {
  flex: 1;
  margin: 8px 12px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow-wrap: anywhere;
}
.actions {
  display: flex;
  align-items: center;
  margin-right: 12px;
}
.actions:empty {
  display: none;
}
button {
  height: 40px;
  padding: 0 16px;
  border: none;
  border-radius: 20px;
  background: none;
  color: var(--shorts-flow-snackbar-action);
  font: inherit;
  font-weight: 500;
  line-height: 40px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.05, 0, 0, 1);
}
button:hover,
button:focus-visible {
  background-color: var(--shorts-flow-snackbar-action-hover);
}
button:focus-visible {
  outline: 2px solid var(--shorts-flow-snackbar-action);
  outline-offset: -2px;
}
@keyframes slide-in {
  from { transform: translateY(100%); opacity: 0; }
  to { transform: translateY(0); opacity: 1; }
}
@media (prefers-reduced-motion: reduce) {
  .toast { animation: none; }
}
@media (forced-colors: active) {
  .toast { border: 1px solid CanvasText; }
}
`;

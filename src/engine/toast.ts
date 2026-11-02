import type { Feed } from './feed';
import { placeOnPage } from './on-page';

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

/**
 * A toast in YouTube's own style (its snackbar, bottom left, inverted
 * colours), for a short message from Shorts Flow on the Shorts Feed: the
 * Stall notice, a Shortcut's confirmation. Native Look (ADR 0002).
 *
 * `name` tells toasts apart on the page. Each toast is announced politely to
 * screen readers. It goes when the visit ends.
 */
export function createToast(feed: Pick<Feed, 'document' | 'signal' | 'setTimeout' | 'clearTimeout'>, name: string): Toast {
  const { document } = feed;
  const { root } = placeOnPage(feed, name, { css: TOAST_CSS });

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  toast.hidden = true;
  const message = document.createElement('div');
  message.className = 'message';
  const actions = document.createElement('div');
  actions.className = 'actions';
  toast.append(message, actions);
  root.append(toast);

  let timer: number | undefined;
  const clearTimer = () => {
    if (timer !== undefined) feed.clearTimeout(timer);
    timer = undefined;
  };
  const hide = () => {
    clearTimer();
    toast.hidden = true;
  };

  return {
    show(text, { action, duration } = {}) {
      clearTimer();
      message.textContent = text;
      actions.replaceChildren();
      if (action) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.label;
        button.addEventListener('click', () => action.onPress(), { signal: feed.signal });
        actions.append(button);
      }
      toast.hidden = false;
      if (duration !== undefined) timer = feed.setTimeout(hide, duration);
    },
    hide,
    get shown() {
      return !toast.hidden;
    },
  };
}

/**
 * YouTube's snackbar, from its 2026-11 stylesheets (`snackbarViewModel*`,
 * `ytSnackbarContainer*`, `ytSpecButtonShapeNext*`): inverted colours, so
 * light on the dark theme and dark on the light one, with its blue text button.
 */
const TOAST_CSS = `
:host {
  --toast-background: #0f0f0f;
  --toast-text: #fff;
  --toast-action: #3ea6ff;
  --toast-action-hover: rgba(255, 255, 255, 0.2);
}
:host([data-theme="dark"]) {
  --toast-background: #f1f1f1;
  --toast-text: #0f0f0f;
  --toast-action: #065fd4;
  --toast-action-hover: rgba(0, 0, 0, 0.1);
}
.toast {
  position: fixed;
  left: 0;
  bottom: 30px;
  z-index: 20000;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  min-width: 288px;
  max-width: 448px;
  min-height: 48px;
  max-height: 64px;
  margin: 16px;
  border-radius: 8px;
  background-color: var(--toast-background);
  color: var(--toast-text);
  font-family: Roboto, Arial, sans-serif;
  font-size: 14px;
  font-weight: 400;
  line-height: 20px;
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
  color: var(--toast-action);
  font: inherit;
  font-weight: 500;
  line-height: 40px;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.3s cubic-bezier(0.05, 0, 0, 1);
}
button:hover,
button:focus-visible {
  background-color: var(--toast-action-hover);
}
button:focus-visible {
  outline: 2px solid var(--toast-action);
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

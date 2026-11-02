import type { Feed } from './feed';
import { placeOnPage } from './on-page';

/** The Break Nudge's notice over the player. */
export type BreakNudge = {
  /** Shows the notice, unless it shows already; `onDismiss` is called once the viewer dismisses it. */
  show(onDismiss: () => void): void;
  readonly shown: boolean;
};

/**
 * The Break Nudge's notice: a dialog in YouTube's own style over the player
 * (Native Look, ADR 0002), never the browser's `alert()`. It is calm: a title,
 * a line of text and one button, Keep watching, which has the focus, so
 * Space, Enter and Escape dismiss it too. No countdown; it waits for the
 * viewer. It goes when the visit ends.
 */
export function createBreakNudge(feed: Pick<Feed, 'document' | 'signal' | 'getMessage'>): BreakNudge {
  const { document, getMessage } = feed;
  const { host, root } = placeOnPage(feed, 'break-nudge', { css: BREAK_NUDGE_CSS });

  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'title');
  dialog.setAttribute('aria-describedby', 'text');
  const title = document.createElement('h2');
  title.id = 'title';
  title.textContent = getMessage('breakNudgeTitle');
  const text = document.createElement('p');
  text.id = 'text';
  text.textContent = getMessage('breakNudgeText');
  const keepWatching = document.createElement('button');
  keepWatching.type = 'button';
  keepWatching.textContent = getMessage('breakNudgeKeepWatching');
  const actions = document.createElement('div');
  actions.className = 'actions';
  actions.append(keepWatching);
  dialog.append(title, text, actions);
  root.append(dialog);

  // Nothing of the viewer's reaches YouTube while it shows: no click on the
  // player to play, no Space to play, no ArrowDown to move on.
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend']) {
    host.addEventListener(type, (event) => event.stopPropagation(), { signal: feed.signal });
  }

  let onDismiss: (() => void) | undefined;
  const dismiss = () => {
    if (!onDismiss) return;
    const dismissed = onDismiss;
    onDismiss = undefined;
    dialog.close();
    dismissed();
  };
  keepWatching.addEventListener('click', dismiss, { signal: feed.signal });
  // Escape dismisses it too.
  dialog.addEventListener(
    'cancel',
    (event) => {
      event.preventDefault();
      dismiss();
    },
    { signal: feed.signal },
  );

  return {
    show(dismissed) {
      if (onDismiss) return;
      onDismiss = dismissed;
      dialog.showModal();
      keepWatching.focus();
    },
    get shown() {
      return onDismiss !== undefined;
    },
  };
}

/**
 * YouTube's dialog, from its 2026-11 stylesheets (`ytDialogViewModel*`,
 * `ytSpecButtonShapeNextFilled`): a rounded card on YouTube's raised surface
 * over a dim backdrop, Roboto, and its filled pill button, in each theme.
 */
const BREAK_NUDGE_CSS = `
:host {
  --dialog-background: #fff;
  --dialog-text: #0f0f0f;
  --dialog-secondary: #606060;
  --button-background: #0f0f0f;
  --button-text: #fff;
  --button-hover: #272727;
}
:host([data-theme="dark"]) {
  --dialog-background: #212121;
  --dialog-text: #f1f1f1;
  --dialog-secondary: #aaa;
  --button-background: #f1f1f1;
  --button-text: #0f0f0f;
  --button-hover: #d9d9d9;
}
dialog {
  box-sizing: border-box;
  width: 400px;
  max-width: calc(100vw - 32px);
  padding: 24px;
  border: 0;
  border-radius: 12px;
  background: var(--dialog-background);
  color: var(--dialog-text);
  font-family: Roboto, Arial, sans-serif;
  box-shadow: 0 4px 32px rgba(0, 0, 0, 0.1);
}
dialog::backdrop {
  background: rgba(0, 0, 0, 0.5);
}
h2 {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 700;
}
p {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 20px;
  color: var(--dialog-secondary);
}
.actions {
  display: flex;
  justify-content: flex-end;
  margin-top: 24px;
}
button {
  height: 36px;
  padding: 0 16px;
  border: none;
  border-radius: 18px;
  background: var(--button-background);
  color: var(--button-text);
  font: 500 14px/36px Roboto, Arial, sans-serif;
  cursor: pointer;
}
button:hover {
  background: var(--button-hover);
}
button:focus-visible {
  outline: 2px solid var(--dialog-text);
  outline-offset: 2px;
}
@media (forced-colors: active) {
  dialog { border: 1px solid CanvasText; }
}
`;

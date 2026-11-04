import type { Feed } from './feed';
import { placeOnPage } from './on-page';
import { shortsVideo } from './youtube';
import { lookVariables, YOUTUBE_LOOK } from './youtube-look';

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

  // A modal dialog centres in the window, but an open comments or
  // description panel moves the player aside: centre it over the player.
  const view = document.defaultView!;
  const placeOverPlayer = () => {
    if (!dialog.open) return;
    const player = shortsVideo(document)?.getBoundingClientRect();
    if (!player || player.width === 0 || player.height === 0) {
      dialog.style.removeProperty('inset');
      dialog.style.removeProperty('margin');
      return;
    }
    const { width, height } = dialog.getBoundingClientRect();
    const clamp = (value: number, room: number) => Math.max(16, Math.min(value, room - 16));
    dialog.style.margin = '0';
    dialog.style.inset = `${clamp(player.top + (player.height - height) / 2, view.innerHeight - height)}px auto auto ${clamp(player.left + (player.width - width) / 2, view.innerWidth - width)}px`;
  };
  view.addEventListener('resize', placeOverPlayer, { signal: feed.signal });

  return {
    show(dismissed) {
      if (onDismiss) return;
      onDismiss = dismissed;
      dialog.showModal();
      placeOverPlayer();
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
 * over a dim backdrop, Roboto, and its filled pill button, in each theme's
 * colours (youtube-look.ts). The backdrop takes its colour from the dialog,
 * which only newer browsers let it inherit.
 */
const BREAK_NUDGE_CSS = `
${lookVariables({ light: ':host', dark: ':host([data-theme="dark"])' })}
dialog {
  box-sizing: border-box;
  width: 400px;
  max-width: calc(100vw - 32px);
  padding: 24px;
  border: 0;
  border-radius: 12px;
  background: var(--shorts-flow-dialog);
  color: var(--shorts-flow-ink);
  font-family: Roboto, Arial, sans-serif;
  box-shadow: var(--shorts-flow-dialog-shadow);
}
dialog::backdrop {
  background: ${YOUTUBE_LOOK.light.backdrop};
}
:host([data-theme="dark"]) dialog::backdrop {
  background: ${YOUTUBE_LOOK.dark.backdrop};
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
  color: var(--shorts-flow-secondary);
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
  background: var(--shorts-flow-filled-button);
  color: var(--shorts-flow-filled-button-ink);
  font: 500 14px/36px Roboto, Arial, sans-serif;
  cursor: pointer;
}
button:hover {
  background: var(--shorts-flow-filled-button-hover);
}
button:focus-visible {
  outline: 2px solid var(--shorts-flow-ink);
  outline-offset: 2px;
}
@media (forced-colors: active) {
  dialog { border: 1px solid CanvasText; }
}
`;

import { NO_SESSION, sessionAt, type Session } from '@/settings/session';
import type { PopupContext, StatusPart } from './rows';

/**
 * Calls `listener` with the Session as the stored one stands now (none, once
 * it has ended), as soon as it is read and again whenever any tab changes it,
 * for as long as the Popup is open.
 */
export function watchSession(popup: PopupContext, listener: (session: Session) => void): void {
  const show = (stored: Session) => {
    if (!popup.signal.aborted) listener(sessionAt(stored, Date.now()));
  };
  let changedSinceRead = false;
  const unwatch = popup.session.watch((changed) => {
    changedSinceRead = true;
    show(changed);
  });
  popup.signal.addEventListener('abort', unwatch, { once: true });
  void popup.session.get().then((read) => {
    if (!changedSinceRead) show(read);
  });
}

/** Shorts Watched this Session, on the status line, kept up to date while Shorts play in any tab. */
export const shortsWatched: StatusPart = (popup) => {
  const count = popup.document.createElement('span');
  count.className = 'sf-status-watched';
  // It changes every few seconds while Shorts play: not worth announcing each time.
  count.setAttribute('aria-live', 'off');
  const show = (session: Session) => (count.textContent = popup.message('popupShortsWatched', [String(session.shortsWatched)]));
  show(NO_SESSION);
  watchSession(popup, show);
  return count;
};

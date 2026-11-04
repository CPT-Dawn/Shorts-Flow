import { NO_SESSION, type Session } from '@/settings/session';
import type { SessionLimit } from '@/settings/settings';
import type { PopupMessage } from './messages';
import type { PopupRow } from './rows';
import { watchSession } from './session';

/** The Session Limit a kind starts at when the viewer picks it, in Shorts or minutes. */
const LIMIT_STARTS_AT = 30;

/** The largest Session Limit the Popup takes, in Shorts or minutes. */
const LIMIT_MAX = 999;

const KINDS: [SessionLimit['kind'], PopupMessage][] = [
  ['off', 'popupSessionLimitOff'],
  ['shorts', 'popupSessionLimitShorts'],
  ['minutes', 'popupSessionLimitMinutes'],
];

/**
 * The Session Limit row: off, or a number of Shorts Watched or of minutes
 * before the Break Nudge. While a limit is set, the hint says how far the
 * Session has come towards it since the last Break Nudge, live.
 */
export const sessionLimitRow: PopupRow = (popup) => {
  const { document, signal, getMessage } = popup;
  const id = 'sf-setting-session-limit';

  const kind = document.createElement('select');
  kind.className = 'sf-select';
  kind.setAttribute('aria-labelledby', id);
  kind.setAttribute('aria-describedby', `${id}-hint`);
  for (const [value, label] of KINDS) kind.append(new Option(getMessage(label), value));
  kind.addEventListener(
    'change',
    () => {
      const picked = kind.value as SessionLimit['kind'];
      setLimit(picked === 'off' ? { kind: picked } : { kind: picked, value: LIMIT_STARTS_AT });
    },
    { signal },
  );

  const value = document.createElement('input');
  value.type = 'number';
  value.className = 'sf-select sf-number';
  value.min = '1';
  value.max = String(LIMIT_MAX);
  value.step = '1';
  value.inputMode = 'numeric';
  value.addEventListener(
    'change',
    () => {
      const limit = popup.settings()?.sessionLimit;
      if (!limit || limit.kind === 'off') return;
      const typed = Math.round(value.valueAsNumber);
      const taken = Number.isNaN(typed) ? limit.value : Math.min(Math.max(typed, 1), LIMIT_MAX);
      // Show what was saved, not what was typed: 0 becomes 1, 5000 becomes 999.
      value.value = String(taken);
      setLimit({ kind: limit.kind, value: taken });
    },
    { signal },
  );

  // Disabled until the settings arrive, so nothing shows a guess.
  kind.disabled = true;
  value.hidden = true;

  const controls = document.createElement('span');
  controls.className = 'sf-row-value';
  // The kind first: it decides whether there is a number to set.
  controls.append(kind, value);

  const { item, hint } = popup.row({ id, label: getMessage('popupSessionLimit'), control: controls });

  let session: Session = NO_SESSION;
  const show = () => {
    const limit = popup.settings()?.sessionLimit;
    if (!limit) return;
    kind.value = limit.kind;
    kind.disabled = false;
    value.hidden = limit.kind === 'off';
    if (limit.kind === 'off') {
      hint.textContent = getMessage('popupSessionLimitHintOff');
      return;
    }
    const shorts = limit.kind === 'shorts';
    value.setAttribute('aria-label', getMessage(shorts ? 'popupSessionLimitShortsValue' : 'popupSessionLimitMinutesValue'));
    // Not while the viewer is typing a new one.
    if (document.activeElement !== value) value.value = String(limit.value);
    const from = session.limitFrom ?? NO_SESSION;
    const sofar = shorts
      ? session.shortsWatched - from.shortsWatched
      : Math.floor((session.playingMs - from.playingMs) / 60_000);
    hint.textContent = getMessage(shorts ? 'popupSessionLimitProgressShorts' : 'popupSessionLimitProgressMinutes', [
      popup.formatNumber(Math.min(Math.max(sofar, 0), limit.value)),
      popup.formatNumber(limit.value),
    ]);
  };

  const setLimit = (sessionLimit: SessionLimit) => popup.changeSettings({ sessionLimit });

  popup.watchSettings(show);
  watchSession(popup, (changed) => {
    session = changed;
    show();
  });
  return item;
};

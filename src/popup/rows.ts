import type { SessionStore } from '@/settings/session';
import type { Settings } from '@/settings/settings';
import type { PopupMessage } from './messages';
import { shortsWatched } from './session';
import { sessionLimitRow } from './session-limit-row';
import { shortsControlRow } from './shorts-control-row';
import { skipSponsoredRow } from './skip-sponsored-row';
import { speedRow } from './speed-row';

/** The settings that are on or off, which a switch row can show. */
export type SwitchSetting = { [K in keyof Settings]: Settings[K] extends boolean ? K : never }[keyof Settings];

/**
 * What a row of the Popup gets to build itself with. The Popup builds one for
 * as long as it is open: `signal` aborts when it closes, so a row passes it to
 * every listener it adds.
 */
export type PopupContext = {
  document: Document;
  /** Aborts when the Popup is unmounted. */
  signal: AbortSignal;
  message: (key: PopupMessage, substitutions?: string[]) => string;
  /** The settings as last read, or undefined until the first read arrives: show nothing until then. */
  settings(): Settings | undefined;
  /** Calls `listener` with the settings as soon as they are known, and again on every change from anywhere. */
  watchSettings(listener: (settings: Settings) => void): void;
  /** Saves a settings change; every Shorts tab hears of it at once, and so does the Popup. */
  changeSettings(changes: Partial<Settings>): void;
  /** The current Session, kept by the Shorts tabs. */
  session: SessionStore;
  /**
   * A row of the settings list: `label` (already looked up with `message`) and
   * an optional `hint` under it on the left, `control` on the right. The row
   * gives the label and hint the ids `<id>` and `<id>-hint`, for the control's
   * aria-labelledby and aria-describedby.
   */
  row(parts: { id: string; label: string; hint?: string; control: Node }): HTMLLIElement;
  /**
   * A row with a switch for a setting that is on or off, kept in step with the
   * setting both ways. `hint`, if given, is worked out again from the
   * settings each time they change.
   */
  switchRow(parts: { setting: SwitchSetting; label: string; hint?: (settings: Settings) => string }): HTMLLIElement;
};

/** One row of the Popup's settings list. Called once each time the Popup opens. */
export type PopupRow = (popup: PopupContext) => HTMLElement;

/**
 * Something the status line says after whether the tab is on the Shorts Feed,
 * set off by a middle dot (Shorts Watched, for one). Returns the node to show;
 * it may keep the node up to date for as long as `popup.signal` lasts.
 */
export type StatusPart = (popup: PopupContext) => Node;

/**
 * The settings list, top to bottom. A setting the Popup shows is a module
 * exporting a `PopupRow`, added here; the list stays hidden while it is empty.
 * Planned order: Skip Sponsored Shorts, Show button on Shorts, Speed, Session
 * Limit, Shortcuts.
 */
export const POPUP_ROWS: PopupRow[] = [skipSponsoredRow, shortsControlRow, speedRow, sessionLimitRow];

/** What the status line says after the Shorts Feed, in order. */
export const STATUS_PARTS: StatusPart[] = [shortsWatched];

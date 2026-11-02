import type { PopupRow } from './rows';

/** "Show button on Shorts": whether the Shorts Control shows in YouTube's rail. On by default. */
export const shortsControlRow: PopupRow = (popup) =>
  popup.switchRow({
    setting: 'shortsControlShown',
    label: popup.message('popupShortsControlShown'),
    hint: () => popup.message('popupShortsControlShownHint'),
  });

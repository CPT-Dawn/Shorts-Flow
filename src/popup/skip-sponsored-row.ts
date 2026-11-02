import type { PopupRow } from './rows';

/** The Skip Sponsored Shorts switch. It skips Sponsored Shorts; it blocks no ads. */
export const skipSponsoredRow: PopupRow = (popup) =>
  popup.switchRow({
    setting: 'skipSponsoredShorts',
    label: popup.message('popupSkipSponsored'),
    hint: (settings) => popup.message(settings.skipSponsoredShorts ? 'popupSkipSponsoredOn' : 'popupSkipSponsoredOff'),
  });

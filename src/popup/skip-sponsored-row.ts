import type { PopupRow } from './rows';

/** The Skip Sponsored Shorts switch. It skips Sponsored Shorts; it blocks no ads. */
export const skipSponsoredRow: PopupRow = (popup) =>
  popup.switchRow({
    setting: 'skipSponsoredShorts',
    label: popup.getMessage('popupSkipSponsored'),
    hint: (settings) => popup.getMessage(settings.skipSponsoredShorts ? 'popupSkipSponsoredOn' : 'popupSkipSponsoredOff'),
  });

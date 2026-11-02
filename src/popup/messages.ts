/**
 * The keys in the locale files (public/_locales) of the text the Popup shows.
 * A row that shows text adds its keys here and to the locale files.
 */
export type PopupMessage =
  | 'popupTitle'
  | 'popupVersion'
  | 'popupWhatsNewUnread'
  | 'popupAutoScroll'
  | 'popupAutoScrollOn'
  | 'popupAutoScrollOff'
  | 'popupOnShortsFeed'
  | 'popupOffShortsFeed'
  | 'popupHostAccessLost'
  | 'popupHostAccessHint'
  | 'popupHostAccessRestore'
  | 'popupSkipSponsored'
  | 'popupSkipSponsoredOn'
  | 'popupSkipSponsoredOff'
  | 'popupSettings'
  | 'popupShortsControlShown'
  | 'popupShortsControlShownHint'
  | 'popupSpeed'
  | 'popupSpeedOn'
  | 'popupSpeedOff'
  | 'popupPreferredSpeed'
  | 'popupSpeedValue'
  | 'popupWhatsNew'
  | 'popupReportProblem'
  | 'popupSupport';

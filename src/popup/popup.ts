/** The keys in the locale files the Popup shows. */
export type PopupMessage = 'popupTitle';

export type PopupDeps = {
  /** Looks up a user-facing string in the locale files (browser.i18n.getMessage). */
  message: (key: PopupMessage, substitutions?: string[]) => string;
};

/** Renders the Popup into `doc`. For now only its heading. */
export function mountPopup(doc: Document, { message }: PopupDeps): void {
  const title = message('popupTitle');
  doc.title = title;

  const heading = doc.createElement('h1');
  heading.textContent = title;
  doc.body.append(heading);
}

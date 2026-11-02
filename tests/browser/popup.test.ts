import { afterEach, expect, it } from 'vitest';
import { mountPopup, type PopupMessage } from '@/popup/popup';

// The Popup's words come from the locale files; tests stand in a lookup.
const MESSAGES: Record<PopupMessage, string> = { popupTitle: 'Shorts Flow' };
const message = (key: PopupMessage) => MESSAGES[key];

afterEach(() => {
  document.body.replaceChildren();
});

it('names Shorts Flow in its heading and title, from the locale files', () => {
  mountPopup(document, { message });

  expect(document.querySelector('h1')?.textContent).toBe('Shorts Flow');
  expect(document.title).toBe('Shorts Flow');
});

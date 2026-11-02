import { mountPopup } from '@/popup/popup';

mountPopup(document, {
  message: (key, substitutions) => browser.i18n.getMessage(key, substitutions),
});

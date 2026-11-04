import { storage } from 'wxt/utils/storage';

/**
 * Whether an update has brought news the viewer hasn't opened yet, shown as a
 * dot in the Popup. Kept on this device only.
 */
export interface WhatsNew {
  isUnread(): Promise<boolean>;
  markUnread(): Promise<void>;
  markRead(): Promise<void>;
}

const unread = storage.defineItem<boolean>('local:whatsNewUnread', { fallback: false });

export function createWhatsNew(): WhatsNew {
  return {
    isUnread: () => unread.getValue(),
    markUnread: () => unread.setValue(true),
    markRead: () => unread.setValue(false),
  };
}

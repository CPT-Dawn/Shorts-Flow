# Shorts Flow: Auto Scroll & Ad Skip

Chrome extension for a hands-free YouTube Shorts experience. Auto-scrolls to next video on end, skips ads, and adds on-screen controls.

## Project Structure

- `manifest.json`: Extension configuration (v3).
- `script/content.js`: Main logic. DOM manipulation, scroll detection, ad skipping, on-screen button.
- `script/background.js`: Background service worker (storage/state management).
- `script/script.js`: Logic for `popup/popup.html`.
- `popup/`: UI for extension settings.
- `icons/` & `Assets/`: Graphic assets.

## Key Features & Logic

- **Auto-Scroll**: `content.js` monitors `<video>` elements. When `ended` event fires, it scrolls the next short into view.
- **Ad Skip**: `checkForNewShort` in `content.js` looks for `ytd-ad-slot-renderer` or `ad-button-view-model` and triggers immediate scroll.
- **On-Screen Button**: Injected into the Shorts player `reel-action-bar-view-model`. Toggles `applicationIsOn` state.
- **Settings**: Persistent via `chrome.storage.local`. Includes `scrollOnComments` and `showOnScreenButton`.

### Conventions

- **Selectors**: Centralized at the top of `content.js`. Update `VIDEOS_LIST_SELECTORS` if YouTube DOM changes.
- **State**: Managed via `chrome.storage.local` to sync between popup and content scripts.
- **Retries**: `MAX_RETRIES` (15) and `RETRY_DELAY_MS` (500) used for handling dynamic hydration of elements.
- **Logging**: Prefixed with `[Auto Youtube Shorts Scroller]` or `[Popup]`.

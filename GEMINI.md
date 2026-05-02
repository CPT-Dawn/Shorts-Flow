# Shorts Flow: Auto Scroll & Ad Skip

Chrome extension for a hands-free YouTube Shorts experience. Auto-scrolls to next video on end, skips ads, and adds on-screen controls.

## Project Structure

- `manifest.json`: Extension configuration (v3). Content script runs at `document_end` on `youtube.com/*`.
- `script/content.js`: Core logic. Handles DOM manipulation, scroll detection, ad skipping, and on-screen button injection.
- `script/background.js`: Service worker. Manages extension installation defaults and resets auto-scroll to OFF on browser startup.
- `script/script.js`: Popup UI logic.
- `popup/`: UI files (HTML/CSS) for extension settings.

## Core Logic & Robustness

### Initialization & Lifecycle
- **Dual Detection**: `isShortsPage` checks both URL (`/shorts/`) and DOM elements (`.reel-video-in-sequence`) to handle YouTube's SPA navigation reliably.
- **SPA Support**: Listens for `yt-navigate-finish` to trigger re-detection when navigating between Shorts and other YouTube pages.
- **State Reset**: Auto-scroll (`applicationIsOn`) is explicitly reset to `false` in `stopAutoScrolling` and on browser startup to prevent "ghost" scroll attempts on stale elements.

### Scroll Detection
- **Event Listeners**: Attaches `ended` and `timeupdate` listeners to the active `<video>` element.
- **Safety Polling**: A 2-second interval (`safetyCheckInterval`) acts as a fallback to catch missed `ended` events or videos that hang at the end.
- **Element-Based Tracking**: Uses `currentShortElement` instead of just IDs to maintain stability during DOM reshuffling.
- **Race Condition Prevention**: `isChecking` flag prevents concurrent executions of `checkForNewShort`.

### Selectors & Hydration
- **Selectors**: Centralized at the top of `content.js`.
- **Hydration Handling**: `checkForNewShort` and `waitForNextShort` include retry logic (`MAX_RETRIES`) and small delays to wait for YouTube to hydrate video elements and next-short containers.

## Conventions

- **Logging**: All logs are prefixed with `[Auto Youtube Shorts Scroller]` or `[Popup]`.
- **Storage**: Use `chrome.storage.local`. Keys: `applicationIsOn` (bool), `scrollOnComments` (bool), `showOnScreenButton` (bool).
- **DOM Injection**: Always check `parent.contains(child)` before `insertBefore` to prevent `NotFoundError`. Fallback to `prepend()` or `append()`.
- **Cleanup**: Always remove listeners and reset `_hasEndEvent` flag before switching to a new video or stopping the application.

## Troubleshooting for AI Agents

1. **First Video Not Scrolling**: Check `initiate()` for race conditions between settings fetch and initial `checkForNewShort`. Ensure `yt-navigate-finish` is handled.
2. **Double Scrolling**: Verify `lastScrolledElement` is being set and checked correctly in `onVideoEnded`.
3. **Button Not Appearing**: Check `checkAndManageOnScreenButton` and ensure it's called after DOM updates or scrolls.
4. **Selector Changes**: If detection fails, audit `VIDEOS_LIST_SELECTORS` and `CURRENT_SHORT_SELECTOR` against the current YouTube DOM.

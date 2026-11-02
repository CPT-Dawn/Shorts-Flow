# Shorts Flow

A browser extension that makes YouTube's desktop Shorts feed play hands-free, moving on to the next Short when the current one finishes, with in-page controls that look and feel like a native YouTube feature.

## Language

### Watching

**Shorts Feed**:
The vertically scrolling stream of Shorts at youtube.com/shorts/. The only place Shorts Flow acts.
_Avoid_: Shorts page, feed (unqualified), Shorts shelf on Home

**Short**:
One short video in the Shorts Feed.
_Avoid_: Video, reel, clip

**Current Short**:
The Short the viewer is watching right now, the one occupying the viewport.
_Avoid_: Active video, active reel

**Auto-Scroll**:
The mode in which Shorts Flow Advances the Shorts Feed on its own. It is either on or off, applies everywhere at once, and stays as the viewer left it.
_Avoid_: Auto-play, applicationIsOn, auto-next

**Advance**:
One move from the Current Short to the next Short, made by Shorts Flow.
_Avoid_: Scroll (as a noun), next, skip (unless the Short is a Sponsored Short)

**Sponsored Short**:
An advertisement slotted into the Shorts Feed between Shorts. Not an ad played inside a Short.
_Avoid_: Ad (unqualified), Shorts ad

**Skip Sponsored Shorts**:
The setting under which Shorts Flow Advances past a Sponsored Short as soon as it becomes the Current Short.
_Avoid_: Ad skip, ad block

**Hold**:
A condition under which Auto-Scroll declines to Advance a Short that has ended, because the viewer has stepped in: the Short is paused, the comments or description panel is open, a menu or dialog is open, the viewer is typing, or the viewer scrolled by hand moments ago. The Short simply plays again.
_Avoid_: Pause (that word belongs to the Short), block, Scroll with Comments

**Speed**:
Whether the Shorts Feed plays at the Preferred Speed instead of normal speed. On or off, everywhere, until switched. Exists only while YouTube offers no lasting speed setting of its own for Shorts on desktop.
_Avoid_: Fast mode, playback rate

**Preferred Speed**:
The viewer's chosen playback speed (0.5×–3×) that Speed switches to.
_Avoid_: Custom speed, rate

**Stall**:
When an Advance cannot find the next Short. Shorts Flow tells the viewer quietly and offers a retry; it never reloads or jumps the page.
_Avoid_: Failure, reload fallback

### Wellbeing

**Session**:
One continuous stretch of watching the Shorts Feed. It ends after 30 minutes with no Short playing.
_Avoid_: Visit, sitting

**Shorts Watched**:
The count of Shorts the viewer has seen in the current Session, whether reached by Advance or by hand.
_Avoid_: Scroll count, advances

**Session Limit**:
An optional cap on a Session, in Shorts Watched or in minutes. Off unless the viewer sets it.
_Avoid_: Timer, screen-time limit

**Break Nudge**:
What happens when a Session reaches its Session Limit: the Current Short pauses and a gentle notice appears, which the viewer can dismiss to keep watching.
_Avoid_: Lock, block, alert

### Controls

**Shorts Control**:
The Auto-Scroll button Shorts Flow places in YouTube's action rail beside each Short. A click switches Auto-Scroll; it also opens a small menu of quick settings. The viewer can hide it.
_Avoid_: Quick Toggle, on-screen button, floating button

**Shortcut**:
A single key that acts on the Shorts Feed: Auto-Scroll on/off or Speed on/off. Active only on the Shorts Feed and never while the viewer is typing; the viewer can rebind it. Moving between Shorts is left to YouTube's own keys.
_Avoid_: Hotkey, command, keybind

**Popup**:
The panel that opens from the extension's toolbar icon, and the only place holding every setting. There is no separate settings page.
_Avoid_: Dashboard, options page, settings page

**What's new**:
The Popup link to news about recent versions. After an update it carries a dot until the viewer opens it; only the upgrade from 2.x opens a tab.
_Avoid_: Changelog, release notes, update notification

### Outreach

**Welcome Page**:
The page on the Shorts Flow website opened once, after a fresh install or the upgrade from 2.x.
_Avoid_: Onboarding tab, landing page

**Report Page**:
The page on the Shorts Flow website where a viewer reports a problem, by GitHub issue or by plain message, pre-filled with the extension's version and browser.
_Avoid_: Bug report link, GitHub link

**Goodbye Page**:
The page on the Shorts Flow website opened when the extension is uninstalled; it asks why.
_Avoid_: Uninstall survey

**Support Page**:
The page on the Shorts Flow website where a viewer can choose to rate, share or donate. The extension never links to a payment provider directly.
_Avoid_: Donate link, tip jar

### Brand

**Native Look**:
The rule that everything Shorts Flow draws inside YouTube matches YouTube's own design language, while everything outside YouTube (icon, popup, website, store listing) carries the Shorts Flow brand and never implies YouTube affiliation.
_Avoid_: YouTube theme, clone

# v3 is a fresh rewrite, and carries nothing over from 2.x

The 2.x code was written while learning, has bugs baked into its structure (Auto-Scroll switched itself off on every browser start, page reloads as a fallback, a popup status UI wired to elements that don't exist), and cannot run on Firefox. Rather than repair it, v3 starts from an empty tree on WXT + TypeScript, the stack Reels Flow and Chrono already use. Settings from 2.x are not migrated: there are only three, the new defaults are what most users want, and the upgrade opens the Welcome Page so everyone meets v3 fresh. The upgrade deletes the old 2.x storage keys. The 2.x code is preserved at the `v2.2.0` tag.

## Considered Options

- **Refactor 2.x in place**: keeps history continuous but drags along its structure and selectors.
- **Migrate 2.x settings**: small cost, but `applicationIsOn` was unreliable (forced off at startup), so carrying it would carry the bug's effects too.

# Building Shorts Flow from source

For Firefox Add-ons reviewers: how to rebuild the Firefox package from this
sources zip and get the same files as the one submitted.

## Tools

- [Bun](https://bun.sh) 1.4.4 (the `packageManager` in `package.json`), which
  installs the dependencies and runs the scripts.
- [Node.js](https://nodejs.org) 24 LTS (any version in `engines.node` works),
  which WXT and Vite run on.
- Any OS; the release builds run on Ubuntu.

Every dependency is pinned to an exact version in `package.json`, and
`bun.lock` pins the rest of the tree.

## Build

```sh
bun install --frozen-lockfile
bun run build:firefox
```

`bun install` also runs `wxt prepare`, which generates the `.wxt` folder the
TypeScript config extends. No network access is needed after the install, and
nothing is downloaded at build time: the fonts come from `@fontsource`
packages in `node_modules`.

## Output

The unpacked extension lands in `.output/firefox-mv3/`. Its files match the
submitted package's, file for file. To zip it the way the release does, run
`bunx wxt zip -b firefox`, which writes `.output/shorts-flow-<version>-firefox.zip`.

## What is in this zip

`src/` (the extension's TypeScript and CSS), `public/` (icons and locale
files, copied as they are), `package.json`, `bun.lock`, `tsconfig.json`,
`wxt.config.ts`, this file and the licence. The repository's tests, design
documents and tooling are left out: none of them goes into the package.

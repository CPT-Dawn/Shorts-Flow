import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { zip } from 'wxt';

// The Firefox sources zip goes to Firefox Add-ons reviewers, who rebuild the
// package from it. It must hold what that takes and nothing else: never the
// tests, the design docs, or the YouTube captures kept on this machine only.
const ZIP_TIMEOUT = 120_000;

/** The names of the files in a zip, from its central directory. */
function zipEntries(zip: Buffer): string[] {
  // The end-of-central-directory record: the last thing in the file, 22 bytes plus a comment.
  const end = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (end < 0) throw new Error('Not a zip');
  const count = zip.readUInt16LE(end + 10);
  let offset = zip.readUInt32LE(end + 16);
  const names: string[] = [];
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(offset) !== 0x02014b50) throw new Error('Bad central directory');
    const nameLength = zip.readUInt16LE(offset + 28);
    const extraLength = zip.readUInt16LE(offset + 30);
    const commentLength = zip.readUInt16LE(offset + 32);
    names.push(zip.toString('utf8', offset + 46, offset + 46 + nameLength));
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return names;
}

const silent = () => {};
const quietLogger = {
  debug: silent,
  log: silent,
  info: silent,
  warn: console.warn,
  error: console.error,
  fatal: console.error,
  success: silent,
  level: 0,
};

describe('the Firefox sources zip', () => {
  let outDir = '';
  let entries: string[] = [];
  beforeAll(async () => {
    outDir = await mkdtemp(join(tmpdir(), 'shorts-flow-sources-'));
    const zips = await zip({ browser: 'firefox', outDir, logger: quietLogger });
    const sources = zips.find((path) => basename(path).includes('-sources'));
    if (!sources) throw new Error(`No sources zip among ${zips.join(', ')}`);
    entries = zipEntries(await readFile(sources));
  }, ZIP_TIMEOUT);
  afterAll(() => outDir && rm(outDir, { recursive: true, force: true }));

  it('holds what it takes to rebuild the package, with the instructions', () => {
    expect(entries).toEqual(
      expect.arrayContaining([
        'SOURCE-BUILD.md',
        'LICENSE',
        'package.json',
        'bun.lock',
        'tsconfig.json',
        'wxt.config.ts',
        'src/entrypoints/background.ts',
        'src/entrypoints/content.ts',
        'src/entrypoints/popup/index.html',
        'src/popup/popup.css',
        'public/_locales/en/messages.json',
        'public/icon/shorts-flow.svg',
      ]),
    );
  });

  it('holds nothing but the extension source, its assets and the root build files', () => {
    const rootFiles = ['SOURCE-BUILD.md', 'LICENSE', 'package.json', 'bun.lock', 'tsconfig.json', 'wxt.config.ts'];
    const elsewhere = entries.filter(
      (entry) => !rootFiles.includes(entry) && !entry.startsWith('src/') && !entry.startsWith('public/'),
    );
    expect(elsewhere).toEqual([]);
  });

  it('leaves out tests, docs, YouTube captures, build output and dependencies', () => {
    expect(entries.filter((entry) => /^(docs|tests|scripts|\.output|\.wxt|node_modules)\//.test(entry))).toEqual([]);
    expect(entries.filter((entry) => /\.test\.ts$|page-.*\.html$|stylesheets\//.test(entry))).toEqual([]);
  });
});

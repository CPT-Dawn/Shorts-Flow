import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it } from 'vitest';

// The store listing and the tag workflow are what store visitors and the
// maintainer actually meet at release, so they are checked like code.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

/** The body of one `## Heading` section of a Markdown file. */
function section(markdown: string, heading: string): string {
  const match = new RegExp(`^## ${heading}\\s*$([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm').exec(markdown);
  if (!match) throw new Error(`No "## ${heading}" section`);
  return match[1]!.trim();
}

describe('the store listing', () => {
  const listing = read('docs/release/store-listing.md');
  const messages = JSON.parse(read('public/_locales/en/messages.json'));

  it('is titled "Shorts Flow: Auto-Scroll for YouTube Shorts", as the manifest is', () => {
    expect(section(listing, 'Name')).toBe('Shorts Flow: Auto-Scroll for YouTube Shorts');
    expect(messages.extensionName.message).toBe(section(listing, 'Name'));
  });

  it('uses the manifest description as its summary, within 132 characters', () => {
    const summary = section(listing, 'Summary \\(≤ 132 characters\\)');
    expect(summary).toBe(messages.extensionDescription.message);
    expect(summary.length).toBeLessThanOrEqual(132);
  });

  it('names Skip Sponsored Shorts and says plainly that it does not block ads', () => {
    const description = section(listing, 'Description');
    expect(description).toContain('Skip Sponsored Shorts');
    expect(description).toMatch(/does not block ads/i);
    // Apart from that disclaimer, nothing promises ad blocking or ad skipping.
    const promises = description.replace(/does not block ads/gi, '');
    expect(promises).not.toMatch(/ad[- ]?block|block(s|ing)? ads|\bad[- ]?skip|skip(s|ping)? ads/i);
  });

  it('says it is not affiliated with YouTube', () => {
    expect(section(listing, 'Description')).toContain('Not affiliated with YouTube');
  });

  it('declares no data collected, a single purpose and why it needs each permission', () => {
    const declarations = section(listing, 'Privacy and permissions');
    expect(declarations).toMatch(/single purpose/i);
    expect(declarations).toContain('`storage`');
    expect(declarations).toContain('https://www.youtube.com/*');
    expect(declarations).toMatch(/collects no data|no data collected/i);
    expect(declarations).toMatch(/remote code: no/i);
  });
});

describe('the release workflow', () => {
  let workflow = '';
  beforeAll(() => {
    workflow = read('.github/workflows/release.yml');
  });

  it('runs when a v* tag is pushed', () => {
    expect(workflow).toMatch(/on:\s*\n\s+push:\s*\n\s+tags:\s*\n\s+- ['"]?v\*['"]?/);
  });

  it('builds both zips and attaches them to a GitHub Release', () => {
    expect(workflow).toContain('bun run zip');
    expect(workflow).toMatch(/gh release create/);
    expect(workflow).toContain('.output/*.zip');
  });

  it('never publishes to a store', () => {
    expect(workflow).not.toMatch(/web-ext sign|chrome-webstore|chromewebstore|addons\.mozilla|wxt submit|publish-browser-extension/i);
  });

  it('releases only a tag on main, with build provenance for the zips', () => {
    expect(workflow).toMatch(/fetch-depth: 0/);
    expect(workflow).toContain('git merge-base --is-ancestor "$GITHUB_SHA" origin/main');
    expect(workflow).toMatch(/id-token: write/);
    expect(workflow).toMatch(/attestations: write/);
    expect(workflow).toMatch(
      /uses: actions\/attest-build-provenance@[0-9a-f]{40}[^\n]*\n\s+with:\n\s+subject-path: \.output\/\*\.zip/,
    );
    // Attested before the zips are published.
    expect(workflow.indexOf('attest-build-provenance')).toBeLessThan(workflow.indexOf('gh release create'));
  });
});

describe('the workflows', () => {
  const workflows = ['.github/workflows/ci.yml', '.github/workflows/release.yml'].map((path) => ({ path, text: read(path) }));
  const bun = JSON.parse(read('package.json')).packageManager.replace(/^bun@/, '');

  it('pin every action to a commit, with its version alongside', () => {
    for (const { path, text } of workflows) {
      const uses = [...text.matchAll(/uses:\s*(.+)$/gm)].map((match) => match[1]!.trim());
      expect(uses.length, path).toBeGreaterThan(0);
      for (const action of uses) expect(action, path).toMatch(/^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+(\.\d+)*$/);
    }
  });

  it('run on the Bun version package.json names', () => {
    for (const { path, text } of workflows) {
      expect([...text.matchAll(/bun-version:\s*(\S+)/g)].map((match) => match[1]), path).toEqual([bun]);
    }
  });
});

describe('the build, for Firefox Add-ons reviewers to reproduce', () => {
  const pkg = JSON.parse(read('package.json'));

  it('pins Bun, Node and every dependency', () => {
    expect(pkg.packageManager).toMatch(/^bun@\d+\.\d+\.\d+$/);
    expect(pkg.engines?.node).toMatch(/\S/);
    for (const [name, version] of Object.entries<string>(pkg.devDependencies)) {
      expect(version, name).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it('tells reviewers how to rebuild, and with which Bun', () => {
    const instructions = read('SOURCE-BUILD.md');
    expect(instructions).toContain('bun install --frozen-lockfile');
    expect(instructions).toContain('bun run build:firefox');
    expect(instructions).toContain('.output/firefox-mv3');
    expect(instructions).toContain(pkg.packageManager.replace(/^bun@/, ''));
  });
});

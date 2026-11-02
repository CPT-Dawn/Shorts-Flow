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
});

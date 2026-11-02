import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig, type Plugin } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

export default defineConfig({
  test: {
    projects: [
      {
        // Background and settings tests against WXT's in-memory fake browser.
        plugins: [WxtVitest()],
        test: {
          name: 'lifecycle',
          include: ['tests/lifecycle/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // The test-page tool in scripts/, in Node.
        test: {
          name: 'tools',
          include: ['tests/tools/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        // Engine and Popup tests in real headless browsers. WXT's plugin cannot
        // load here, so modules get their collaborators (settings store,
        // message lookup, ...) injected instead of reaching for `browser`.
        plugins: [serveTestPages()],
        resolve: {
          alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
        },
        test: {
          name: 'browser',
          include: ['tests/browser/**/*.test.ts'],
          // Engine tests watch Shorts of 2 to 3 seconds play out, several in a row.
          testTimeout: 30_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(),
            instances: [{ browser: 'chromium' }, { browser: 'firefox' }],
            // Room for a test page at the window size it was captured in.
            viewport: { width: 1920, height: 1080 },
          },
        },
      },
    ],
  },
});

/**
 * Answers `<any path>?test-page=<name>` with tests/pages/<name>/page.html,
 * byte for byte, so a test page opens at its own /shorts/ address and without
 * the script Vite would inject into an .html file it serves.
 */
function serveTestPages(): Plugin {
  return {
    name: 'shorts-flow:serve-test-pages',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const name = new URL(req.url ?? '/', 'http://test').searchParams.get('test-page');
        if (!name || !/^[a-z0-9-]+$/.test(name)) return next();
        try {
          const page = await readFile(new URL(`./tests/pages/${name}/page.html`, import.meta.url));
          res.setHeader('Content-Type', 'text/html; charset=utf-8');
          res.end(page);
        } catch {
          next();
        }
      });
    },
  };
}

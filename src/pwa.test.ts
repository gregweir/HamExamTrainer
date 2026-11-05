import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The precache promise, as it actually ships:
 *
 *  - the app shell, the CSS and every SHIPPED bank's chunk are PRECACHED —
 *    the bank question data rides the shipped entry chunk, so a first install
 *    is fully offline for both shipped banks (US Tech + CA Basic).
 *  - every figure EMITTED INTO DIST is precached (today only the shipped
 *    banks' figures are emitted; the parked banks' figures are not even
 *    copied, so the precache stays lean).
 *  - offline navigations to any /trainer/ subpath fall back to the app shell
 *    (navigateFallback).
 *  - nothing precached may exceed the 2 MiB per-asset cap set in
 *    vite.config.ts (maximumFileSizeToCacheInBytes).
 *
 * These tests read the ALREADY-BUILT dist/ — the build is never executed
 * inside the vitest process (it belongs to `npm run build` / validate). When
 * dist/ is stale or missing the tests fail with "run npm run build first".
 */
describe('pwa precache manifest (after build)', () => {
  const dist = resolve('dist');
  const built = existsSync(resolve(dist, 'sw.js'));

  /** Built-artifact preflight: names the missing `npm run build`, never builds in-process. */
  const swText = () => {
    if (!existsSync(resolve(dist, 'sw.js'))) {
      throw new Error('dist/sw.js missing — run npm run build first');
    }
    return readFileSync(resolve(dist, 'sw.js'), 'utf8');
  };

  it('the build artifacts exist (run npm run build first)', () => {
    expect(built, 'dist/sw.js missing — run `npm run build` first').toBe(true);
    expect(existsSync(resolve(dist, 'manifest.webmanifest'))).toBe(true);
  });

  it('manifest.webmanifest has the Tartanleaf identity', () => {
    const m = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8'));
    expect(m.name).toBe('Tartanleaf Ham Exam Trainer');
    expect(m.start_url).toBe('/trainer/');
    expect(m.scope).toBe('/trainer/');
    expect(m.theme_color.toLowerCase()).toBe('#2f5e5b');
    expect(m.display).toBe('standalone');
  });

  it('the precache manifest covers the shell, the shipped bank chunk and the css', () => {
    const sw = swText();
    // index.html shell,
    expect(sw).toMatch(/index\.html/);
    // the single shipped entry chunk that carries both banks' question data,
    const chunk = sw.match(/assets\/index-[\w-]+\.js/);
    expect(chunk, 'entry chunk precached').not.toBeNull();
    expect(existsSync(resolve(dist, chunk![0]))).toBe(true);
    // and the stylesheet.
    const css = sw.match(/assets\/index-[\w-]+\.css/);
    expect(css, 'stylesheet precached').not.toBeNull();
  });

  it('the precache manifest includes the figures actually present in dist (shipped banks only)', () => {
    const sw = swText();
    // the shipped figures in dist all appear in the precache manifest
    const figureDir = resolve(dist, 'figures/us-tech');
    expect(existsSync(figureDir), 'shipped figures emitted to dist').toBe(true);
    const figFiles = readdirSync(figureDir).filter((f) => f.endsWith('.png'));
    expect(figFiles.length).toBeGreaterThanOrEqual(3);
    for (const f of figFiles) {
      expect(sw).toContain(`figures/us-tech/${f}`);
    }
    // parked banks' figures are NOT in dist (they ship with their banks)
    expect(existsSync(resolve(dist, 'figures/us-general'))).toBe(false);
    expect(existsSync(resolve(dist, 'figures/us-extra'))).toBe(false);
    expect(sw).not.toMatch(/figures\/us-general/);
    expect(sw).not.toMatch(/figures\/us-extra/);
    expect(sw).not.toMatch(/ca-advanced/);
  });

  it('every precached asset stays under the 2 MiB per-asset cap', () => {
    const sw = swText();
    const urls = [...sw.matchAll(/url:"([^"]+)"/g)].map(m => m[1]!);
    expect(urls.length, 'non-empty precache manifest').toBeGreaterThan(0);
    for (const url of urls) {
      const file = resolve(dist, url);
      expect(existsSync(file), `precache entry exists in dist: ${url}`).toBe(true);
      expect(statSync(file).size, url).toBeLessThan(2 * 1024 * 1024);
    }
  });

  it('offline navigations fall back to the app shell (navigateFallback)', () => {
    const sw = swText();
    // the SW registers a NavigationRoute bound to index.html —
    // any /trainer/ subpath falls back to the app shell offline.
    expect(sw).toContain('registerRoute');
    expect(sw).toMatch(/NavigationRoute\(/);
    expect(sw).toMatch(/createHandlerBoundToURL\("index\.html"\)/);
  });
});

describe('pwa icons (installability)', () => {
  it('the manifest declares 192 + 512 icons that exist in dist', () => {
    const dist = resolve('dist');
    if (!existsSync(resolve(dist, 'manifest.webmanifest'))) {
      throw new Error('dist/manifest.webmanifest missing — run npm run build first');
    }
    expect(existsSync(resolve(dist, 'pwa-192.png'))).toBe(true);
    expect(existsSync(resolve(dist, 'pwa-512.png'))).toBe(true);
    const m = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8'));
    expect(m.icons?.length).toBeGreaterThanOrEqual(2);
    expect(m.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  });
});

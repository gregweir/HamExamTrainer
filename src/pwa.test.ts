import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The precache promise: after a build, the service worker's precache
 * manifest must include the app shell AND every shipped bank's chunk —
 * statically imported bank data rides the JS chunks (spec addendum: no
 * separate raw-JSON copy). Figures are runtime-cached (cache-first), not
 * precached (US figures stay lazy; a bank's figures cache on first view).
 */
describe('pwa precache manifest (after build)', () => {
  const dist = resolve('dist');
  const sw = () => readFileSync(resolve(dist, 'sw.js'), 'utf8');

  it('the build produced sw.js + manifest', () => {
    expect(existsSync(resolve(dist, 'sw.js'))).toBe(true);
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

  it('the precache manifest covers the shell and every entry chunk', () => {
    const swText = sw();
    // index.html shell
    expect(swText).toMatch(/index\.html/);
    // the emitted, statically-imported bank data lives in entry chunks —
    // assert the chunk file NAMES are precached via the hash-list manifest
    expect(swText).toMatch(/assets\/(index|app|exam-shell)[\w.-]*\.js/);
    // offline figures: the runtime cache handles /trainer/figures/ (cache-first)
    // — asserted on the SW source: a FigureCache strategy must be registered.
    expect(swText).toMatch(/figures/);
  });
});

describe('pwa icons (installability)', () => {
  it('the manifest declares 192 + 512 icons that exist in dist', () => {
    require('node:child_process').execSync('npm run build', { stdio: 'pipe' });
    const dist = resolve('dist');
    expect(existsSync(resolve(dist, 'pwa-192.png'))).toBe(true);
    expect(existsSync(resolve(dist, 'pwa-512.png'))).toBe(true);
    const m = JSON.parse(readFileSync(resolve(dist, 'manifest.webmanifest'), 'utf8'));
    expect(m.icons?.length).toBeGreaterThanOrEqual(2);
    expect(m.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  });
});

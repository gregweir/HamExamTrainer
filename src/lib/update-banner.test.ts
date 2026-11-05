import { describe, it, expect, vi } from 'vitest';
import { watchForServiceWorkerUpdate, type ServiceWorkerLike } from './update-banner.js';

function fakeSW(initialController: unknown): Omit<ServiceWorkerLike, 'controller'> & {
  controller: unknown;
  waiting: unknown;
  fireControllerChange(): void;
} {
  let listeners: (() => void)[] = [];
  const sw = {
    controller: initialController,
    waiting: null as unknown,
    getRegistration: async () => ({ waiting: sw.waiting }),
    addEventListener: (_: 'controllerchange', fn: () => void) => { listeners.push(fn); },
    fireControllerChange: () => { listeners.forEach(fn => fn()); },
  };
  return sw;
}

describe('update-banner watcher', () => {
  it('no-ops on environments without serviceWorker support', () => {
    const cb = vi.fn();
    watchForServiceWorkerUpdate(cb, undefined);
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires when a new worker takes over an already-controlled page', () => {
    const cb = vi.fn();
    const sw = fakeSW({ url: '/sw.js' }); // controller existed on load
    watchForServiceWorkerUpdate(cb, sw);
    sw.controller = { url: '/sw-new.js' };
    sw.fireControllerChange();
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('does NOT fire on the very first install (no controller at load)', () => {
    const cb = vi.fn();
    const sw = fakeSW(null); // first visit: nothing controlled the page
    watchForServiceWorkerUpdate(cb, sw);
    sw.controller = { url: '/sw.js' };
    sw.fireControllerChange();
    expect(cb).not.toHaveBeenCalled();
  });

  it('fires from a cold start when a worker is already waiting', async () => {
    const cb = vi.fn();
    const sw = fakeSW({ url: '/sw.js' });
    sw.waiting = { postMessage() {} };
    watchForServiceWorkerUpdate(cb, sw);
    await new Promise(r => setTimeout(r, 5));
    expect(cb).toHaveBeenCalledTimes(1);
  });
});

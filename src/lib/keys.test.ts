import { describe, it, expect } from 'vitest';
import { inFormControl, onWindowKey } from './keys.js';

describe('keyboard helper', () => {
  it('subscribes to window keydown and unsubscribes cleanly', () => {
    const seen: string[] = [];
    const off = onWindowKey(e => seen.push(e.key));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    off();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(seen).toEqual(['1']);
  });

  function fakeEvent(key: string, target: Partial<HTMLInputElement>): KeyboardEvent {
    const e = new KeyboardEvent('keydown', { key, cancelable: true });
    Object.defineProperty(e, 'target', { value: target });
    return e;
  }

  it('ignores keys typed in form controls or with modifiers', () => {
    expect(inFormControl(fakeEvent('1', { tagName: 'SELECT' }))).toBe(true);
    expect(inFormControl(fakeEvent('1', { tagName: 'INPUT' }))).toBe(true);
    const e = fakeEvent('1', { tagName: 'BUTTON' });
    expect(inFormControl(e)).toBe(false);
    const mod = new KeyboardEvent('keydown', { key: '1', ctrlKey: true });
    expect(inFormControl(mod)).toBe(true);
  });
});

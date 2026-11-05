import { describe, it, expect } from 'vitest';
import { nextSchedule, type Sm2Record } from './sm2.js';

const DAY = 86_400_000;
const rec = (over: Partial<Sm2Record> = {}): Sm2Record => ({
  ease: 2.5, intervalDays: 0, dueAt: 0, lastStudiedAt: 0, ...over,
});

describe('nextSchedule (SM-2)', () => {
  it('first successful recall schedules 1 day then (ease unchanged at q4 = 2.5) 6 days', () => {
    const r1 = nextSchedule(rec(), 4, 1000);
    expect(r1.intervalDays).toBe(1);
    expect(r1.ease).toBeCloseTo(2.5, 8); // ease' = 2.5 + (0.1 − 1·(0.08 + 1·0.02)) = 2.5

    const r2 = nextSchedule({ ...rec(), ease: r1.ease ?? 2.5, intervalDays: 1 }, 4, 2000);
    expect(r2.intervalDays).toBe(6);
  });

  it('later recalls multiply the previous interval by ease', () => {
    const state = { ...rec(), ease: 2.2, intervalDays: 6 };
    const r = nextSchedule(state, 4, 1000); // ease unchanged at q4
    expect(r.intervalDays).toBe(Math.round(6 * 2.2));
  });

  it('easier answers raise ease, harder lower it, bounded 1.3-2.5', () => {
    const midEase = { ...rec(), ease: 2.2 };
    const easy = nextSchedule(midEase, 5, 1000); // 2.2 + 0.1
    const hard = nextSchedule(midEase, 3, 1000); // 2.2 − (0.08 + 2·0.02)
    expect(easy.ease).toBeGreaterThan(2.2);
    expect(hard.ease).toBeLessThan(2.2);

    const floor = nextSchedule({ ...rec(), ease: 1.3, intervalDays: 10 }, 0, 1000);
    const ceiling = nextSchedule({ ...rec(), ease: 2.5, intervalDays: 10 }, 5, 1000);
    expect(floor.ease).toBeGreaterThanOrEqual(1.3);
    expect(ceiling.ease).toBeLessThanOrEqual(2.5); // at the ceiling, q5 stays 2.5
  });

  it('a lapse (q < 3) resets the interval to a short relearn streak', () => {
    const r = nextSchedule({ ...rec(), intervalDays: 30, ease: 2.5 }, 2, 1000);
    expect(r.intervalDays).toBe(1);
    expect(r.ease).toBeLessThan(2.5);
  });

  it('dueAt = study time + interval days (ms)', () => {
    const now = 1_700_000_000_000;
    const r = nextSchedule(rec(), 4, now);
    expect(r.dueAt).toBe(now + r.intervalDays * DAY);
  });

  it('is deterministic: same (state, quality, now) → same result', () => {
    const state = { ...rec(), ease: 2.2, intervalDays: 12 };
    const a = nextSchedule(state, 4, 1000);
    const b = nextSchedule(state, 4, 1000);
    expect(a).toEqual(b);
  });
});

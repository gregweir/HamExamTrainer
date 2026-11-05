/**
 * SM-2 spaced-repetition scheduling — pure: (record, quality, now) → next.
 * No storage, no time reads of its own; the caller supplies `now`.
 *
 * Classic SM-2 formulas over 0–5 quality grades:
 *   ease' = ease + (0.1 − (5−q) · (0.08 + (5−q) · 0.02))
 *   q < 3  → lapse: interval resets to 1 day (relearn streak)
 *   q ≥ 3  → interval: 1 → 6 → interval × ease (rounded, days)
 *   ease clamped to [1.3, 2.5]
 */

import type { ScheduleUpdate } from './progress.js';

/** Carries just the fields the scheduler reads — storage-shape agnostic. */
export interface Sm2Record {
  ease: number;
  intervalDays: number;
  dueAt: number;
  lastStudiedAt: number;
}

export const SM2_MIN_EASE = 1.3;
export const SM2_MAX_EASE = 2.5;
const DAY_MS = 86_400_000;

export function nextSchedule(
  record: Sm2Record,
  quality: number,
  now: number,
): ScheduleUpdate {
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const miss = 5 - q;
  const rawEase = record.ease + (0.1 - miss * (0.08 + miss * 0.02));
  const ease = Math.max(SM2_MIN_EASE, Math.min(SM2_MAX_EASE, rawEase));

  let intervalDays: number;
  if (q < 3) {
    // lapse: restart the learning streak
    intervalDays = 1;
  } else if (record.intervalDays === 0) {
    intervalDays = 1;
  } else if (record.intervalDays === 1) {
    intervalDays = 6;
  } else {
    intervalDays = Math.max(1, Math.round(record.intervalDays * ease));
  }

  return { ease, intervalDays, dueAt: now + intervalDays * DAY_MS };
}

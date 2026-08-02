import { describe, expect, it } from 'vitest';
import { remainingSeconds } from './useAbsoluteCountdown';

describe('remainingSeconds', () => {
  it('derives remaining time from an absolute server deadline', () => {
    const now = new Date('2026-08-03T10:00:00.000Z').getTime();
    expect(remainingSeconds('2026-08-03T10:00:07.250Z', now)).toBe(8);
  });

  it('never returns a negative countdown', () => {
    const now = new Date('2026-08-03T10:00:10.000Z').getTime();
    expect(remainingSeconds('2026-08-03T10:00:00.000Z', now)).toBe(0);
    expect(remainingSeconds(null, now)).toBeNull();
  });
});

import { describe, expect, it } from 'vitest';
import { dueLabel, nextReview, startOfDay } from '../src/lib/review';

const DAY = 86_400_000;
const now = new Date('2026-11-25T20:00:00').getTime();

describe('nextReview', () => {
  it('première réussite → 1 jour', () => {
    expect(nextReview(undefined, 10, 10, now)).toEqual({ interval: 1, due: startOfDay(now) + DAY });
  });
  it('réussites successives → 1, 3, 7, 14, 30…', () => {
    let r = nextReview(undefined, 10, 10, now);
    const seen = [r.interval];
    for (let i = 0; i < 4; i++) {
      r = nextReview(r, 10, 10, now);
      seen.push(r.interval);
    }
    expect(seen).toEqual([1, 3, 7, 14, 30]);
  });
  it('60–89 % → même intervalle', () => {
    expect(nextReview({ interval: 7, due: 0 }, 7, 10, now).interval).toBe(7);
  });
  it('< 60 % → retour à 1 jour', () => {
    expect(nextReview({ interval: 30, due: 0 }, 3, 10, now).interval).toBe(1);
  });
});

describe('dueLabel', () => {
  it.each([
    [startOfDay(now), "aujourd'hui"],
    [startOfDay(now) + DAY, 'demain'],
    [startOfDay(now) + 5 * DAY, 'dans 5 j'],
    [startOfDay(now) - DAY, 'en retard d’un jour'],
    [startOfDay(now) - 90 * DAY, 'en retard'],
  ])('%s → %s', (due, label) => {
    expect(dueLabel(due, now)).toBe(label);
  });
});

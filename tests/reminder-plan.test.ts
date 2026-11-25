import { describe, expect, it } from 'vitest';
import { planReminders } from '../src/lib/reminder-plan';

const D = 86_400_000;

describe('planReminders', () => {
  const now = new Date('2026-11-25T20:30:00').getTime();
  it('rien les jours sans révision', () => {
    expect(planReminders(now, [], '19:00')).toHaveLength(0);
  });
  it('heure déjà passée aujourd’hui → à partir de demain', () => {
    const plan = planReminders(now, [{ title: 'A', due: now - D }], '19:00', 3);
    expect(plan[0]!.at.getDate()).toBe(26);
    expect(plan[0]!.at.getHours()).toBe(19);
  });
  it('liste résumée au-delà de 3', () => {
    const items = ['A', 'B', 'C', 'D', 'E'].map((t) => ({ title: t, due: now - D }));
    expect(planReminders(now, items, '19:00', 2)[0]!.body).toBe('A, B et 3 autres');
  });
});

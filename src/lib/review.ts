import type { Content, Palace, Review } from './types';
import { flatLoci } from './util';

const DAY = 86_400_000;
/** Intervalles successifs (jours) quand le test est réussi. */
const STEPS = [1, 3, 7, 14, 30, 60, 120, 240];

export function startOfDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/**
 * Calcule la prochaine révision après un test.
 * ≥ 90 % : on passe à l'intervalle suivant. 60–89 % : on refait le même. < 60 % : retour à 1 jour.
 */
export function nextReview(prev: Review | undefined, score: number, total: number, now = Date.now()): Review {
  const ratio = total ? score / total : 0;
  const cur = prev?.interval ?? 0;
  let interval: number;
  if (ratio >= 0.9) interval = STEPS.find((s) => s > cur) ?? 365;
  else if (ratio >= 0.6) interval = Math.max(1, cur);
  else interval = 1;
  return { interval, due: startOfDay(now) + interval * DAY };
}

/** Repousse à demain sans toucher à l'intervalle. */
export function snooze(r: Review | undefined, now = Date.now()): Review {
  return { interval: r?.interval ?? 1, due: startOfDay(now) + DAY };
}

function dueDate(item: Palace | Content, hasMaterial: boolean): number | null {
  if (!hasMaterial) return null;
  if (item.review) return item.review.due;
  // Jamais testé : première révision le lendemain de la création.
  return startOfDay(item.createdAt) + DAY;
}

export function palaceDue(p: Palace): number | null {
  return dueDate(p, flatLoci(p).length >= 3);
}

export function contentDue(c: Content, p: Palace | undefined): number | null {
  if (!p || c.archived) return null;
  return dueDate(c, Object.values(c.items).some((i) => i.text));
}

export function isDue(due: number | null, now = Date.now()): boolean {
  return due !== null && due <= now;
}

/** « aujourd'hui », « demain », « dans 5 j », « en retard ». */
export function dueLabel(due: number | null, now = Date.now()): string {
  if (due === null) return '';
  const days = Math.round((startOfDay(due) - startOfDay(now)) / DAY);
  if (days < -30) return 'en retard';
  if (days < 0) return days === -1 ? 'en retard d’un jour' : `en retard de ${-days} j`;
  if (days === 0) return "aujourd'hui";
  if (days === 1) return 'demain';
  if (days < 30) return `dans ${days} j`;
  const months = Math.round(days / 30);
  return `dans ${months} mois`;
}

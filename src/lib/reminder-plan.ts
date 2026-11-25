import { startOfDay } from './review';

const DAY = 86_400_000;

export interface PlannedReminder {
  day: number;
  at: Date;
  title: string;
  body: string;
  largeBody: string;
}

function summary(titles: string[]): string {
  if (titles.length <= 3) return titles.join(', ');
  return `${titles.slice(0, 2).join(', ')} et ${titles.length - 2} autres`;
}

/**
 * Planifie les rappels des `days` prochains jours à l'heure `time` (« HH:MM »),
 * uniquement les jours où au moins un élément est dû, avec la liste réelle.
 * Fonction pure : testable sans téléphone.
 */
export function planReminders(now: number, items: { title: string; due: number }[], time: string, days = 21): PlannedReminder[] {
  const [h, m] = time.split(':').map(Number);
  const out: PlannedReminder[] = [];
  for (let d = 0; d < days; d++) {
    const at = new Date(startOfDay(now) + d * DAY + 12 * 3_600_000); // midi, puis on règle l'heure (sûr même au changement d'heure)
    at.setHours(h ?? 19, m ?? 0, 0, 0);
    if (at.getTime() <= now + 60_000) continue;
    const due = items.filter((i) => i.due <= at.getTime()).sort((a, b) => a.due - b.due);
    if (due.length === 0) continue;
    const titles = due.map((i) => i.title);
    out.push({
      day: d,
      at,
      title: due.length === 1 ? 'Une révision t’attend' : `${due.length} révisions t’attendent`,
      body: summary(titles),
      largeBody: `${summary(titles)}. Quelques minutes suffisent pour garder tes palais solides.`,
    });
  }
  return out;
}

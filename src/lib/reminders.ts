import { LocalNotifications } from '@capacitor/local-notifications';
import { db, getPalace } from './store.svelte';
import { contentDue, palaceDue } from './review';
import { planReminders } from './reminder-plan';
import { isNative } from './util';
import { nav } from './nav.svelte';

const CHANNEL = 'revisions';
const BASE_ID = 7000;

export const DEFAULT_TIME = '19:00';

/** Demande la permission de notifier. */
export async function askNotificationPermission(): Promise<boolean> {
  if (!isNative()) return false;
  const cur = await LocalNotifications.checkPermissions();
  if (cur.display === 'granted') return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === 'granted';
}

export async function setupReminders(): Promise<void> {
  if (!isNative()) return;
  await LocalNotifications.createChannel({
    id: CHANNEL,
    name: 'Révisions',
    description: 'Rappel quand des palais ou contenus sont à revoir',
    importance: 3,
    visibility: 1,
    vibration: true,
  }).catch(() => {});
  await LocalNotifications.addListener('localNotificationActionPerformed', () => nav.switchTab('home'));
}

function dueItems(): { title: string; due: number }[] {
  const out: { title: string; due: number }[] = [];
  for (const c of db.contents) {
    if (c.archived) continue;
    const d = contentDue(c, getPalace(c.palaceId));
    if (d !== null) out.push({ title: c.title, due: d });
  }
  for (const p of db.palaces) {
    const d = palaceDue(p);
    if (d !== null) out.push({ title: `trajet « ${p.name} »`, due: d });
  }
  return out.sort((a, b) => a.due - b.due);
}

/**
 * Reprogramme les rappels des 3 prochaines semaines, seulement les jours où quelque chose
 * est à revoir, avec la liste réelle. À appeler après tout changement de révision.
 */
export async function syncReminders(): Promise<void> {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = pending.notifications.filter((n) => n.id >= BASE_ID && n.id < BASE_ID + 100);
    if (ours.length) await LocalNotifications.cancel({ notifications: ours.map((n) => ({ id: n.id })) });

    const r = db.settings.reminder;
    if (!r?.enabled) return;
    const perm = await LocalNotifications.checkPermissions();
    if (perm.display !== 'granted') return;

    const notifications = planReminders(Date.now(), dueItems(), r.time).map((p) => ({
      id: BASE_ID + p.day,
      channelId: CHANNEL,
      title: p.title,
      body: p.body,
      largeBody: p.largeBody,
      smallIcon: 'ic_stat_logidex',
      iconColor: '#0B6B57',
      schedule: { at: p.at, allowWhileIdle: true },
      autoCancel: true,
    }));
    if (notifications.length) await LocalNotifications.schedule({ notifications });
  } catch {
    // Les rappels ne doivent jamais bloquer l'app.
  }
}

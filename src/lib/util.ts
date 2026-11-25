import type { FlatLocus, Palace } from './types';

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Tous les loci du palais dans l'ordre du trajet, numérotés à partir de 1. */
export function flatLoci(palace: Palace): FlatLocus[] {
  const out: FlatLocus[] = [];
  let n = 1;
  for (const room of palace.rooms) {
    for (const locus of room.loci) out.push({ locus, room, n: n++ });
  }
  return out;
}

export function lociCount(palace: Palace): number {
  return palace.rooms.reduce((sum, r) => sum + r.loci.length, 0);
}

export function plural(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

export function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-CA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeDays(ts: number): string {
  const days = Math.floor((Date.now() - ts) / 86_400_000);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 30) return `il y a ${days} j`;
  return formatDate(ts);
}

/** Comparaison sans accents ni majuscules, pour la recherche. */
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();
}

export function move<T>(arr: T[], from: number, to: number): void {
  if (to < 0 || to >= arr.length || from === to) return;
  const [item] = arr.splice(from, 1);
  if (item !== undefined) arr.splice(to, 0, item);
}

export function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Compare deux versions « 1.2.3 ». Retourne > 0 si a est plus récente. */
export function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/, '').split('.').map(Number);
  const pb = b.replace(/^v/, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

export function isNative(): boolean {
  // Capacitor injecte cet objet dans l'app Android.
  const cap = (globalThis as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return !!cap?.isNativePlatform?.();
}

const SMALL = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'mon', 'ma', 'mes', 'un', 'une', 'au', 'aux', 'et', 'à', 'en', 'vers', 'chez']);

/** Initiales d'un nom de palais (« Maison de mes parents » → « MP »). */
export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')
    .split(/[\s'-]+/)
    .filter((w) => w && !SMALL.has(w.toLowerCase()));
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0]!.slice(0, 2).toUpperCase();
  return (words[0]![0]! + words[1]![0]!).toUpperCase();
}

/** Couleur d'avatar stable (1 à 4) dérivée de l'id. */
export function avatarTone(id: string): number {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) | 0;
  return (Math.abs(h) % 4) + 1;
}

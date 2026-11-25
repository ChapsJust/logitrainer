import type { Content, ContentItem, Data, Locus, Palace, QuizResult, Room } from './types';
import { readRaw, writeRaw, writeStartupBackup } from './storage';
import { flatLoci, move, uid } from './util';
import { nextReview, snooze } from './review';

function emptyData(): Data {
  return { schema: 1, palaces: [], contents: [], numbers: {}, settings: { theme: 'auto' } };
}

/** Toutes les données de l'app. Toute modification est sauvegardée automatiquement. */
export const db: Data = $state(emptyData());

export const status = $state({ loaded: false, saveError: '' });

/** Vérifie et complète des données venant du stockage ou d'un fichier importé. */
export function parseData(json: string): Data {
  const raw = JSON.parse(json) as Partial<Data>;
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.palaces)) {
    throw new Error("Ce fichier ne ressemble pas à une sauvegarde Logidex.");
  }
  const base = emptyData();
  return {
    schema: 1,
    palaces: raw.palaces.map((p) => ({
      id: p.id ?? uid(),
      name: p.name ?? 'Palais',
      emoji: p.emoji ?? '🏛️',
      description: p.description ?? '',
      createdAt: p.createdAt ?? Date.now(),
      updatedAt: p.updatedAt ?? Date.now(),
      lastQuiz: p.lastQuiz,
      review: p.review,
      rooms: (p.rooms ?? []).map((r) => ({
        id: r.id ?? uid(),
        name: r.name ?? '',
        loci: (r.loci ?? []).map((l) => ({ id: l.id ?? uid(), name: l.name ?? '', description: l.description ?? '' })),
      })),
    })),
    contents: (raw.contents ?? []).map((c) => ({
      id: c.id ?? uid(),
      palaceId: c.palaceId,
      title: c.title ?? 'Contenu',
      notes: c.notes ?? '',
      items: c.items ?? {},
      createdAt: c.createdAt ?? Date.now(),
      updatedAt: c.updatedAt ?? Date.now(),
      lastQuiz: c.lastQuiz,
      review: c.review,
      archived: c.archived,
    })),
    numbers: raw.numbers ?? {},
    settings: { ...base.settings, ...(raw.settings ?? {}) },
  };
}

function replaceAll(data: Data) {
  db.palaces = data.palaces;
  db.contents = data.contents;
  db.numbers = data.numbers;
  db.settings = data.settings;
}

export async function load(): Promise<void> {
  const raw = await readRaw();
  if (raw) {
    try {
      replaceAll(parseData(raw));
      await writeStartupBackup(raw);
    } catch (e) {
      status.saveError = 'Données illisibles : ' + (e as Error).message;
    }
  }
  status.loaded = true;

  // Sauvegarde automatique : tout changement dans db déclenche une écriture (regroupée).
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = JSON.stringify(db);
  $effect.root(() => {
    $effect(() => {
      const json = JSON.stringify(db);
      if (json === last) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        last = json;
        writeRaw(json)
          .then(() => (status.saveError = ''))
          .catch((e: Error) => (status.saveError = 'Sauvegarde impossible : ' + e.message));
      }, 300);
    });
  });
}

export function importData(json: string): void {
  replaceAll(parseData(json));
}

/** Copie de l'état complet, pour « Annuler ». */
export function snapshot(): string {
  return JSON.stringify(db);
}

export function restore(json: string): void {
  replaceAll(parseData(json));
}

/* ---------- Palais ---------- */

export function getPalace(id: string): Palace | undefined {
  return db.palaces.find((p) => p.id === id);
}

export function createPalace(name: string, emoji: string): Palace {
  const now = Date.now();
  db.palaces.push({
    id: uid(),
    name: name.trim() || 'Nouveau palais',
    emoji,
    description: '',
    rooms: [{ id: uid(), name: '', loci: [] }],
    createdAt: now,
    updatedAt: now,
  });
  return db.palaces[db.palaces.length - 1]!;
}

export function deletePalace(id: string): void {
  db.contents = db.contents.filter((c) => c.palaceId !== id);
  db.palaces = db.palaces.filter((p) => p.id !== id);
}

export function touch(p: Palace | Content): void {
  p.updatedAt = Date.now();
}

/* ---------- Pièces ---------- */

export function addRoom(p: Palace, name: string): Room {
  p.rooms.push({ id: uid(), name: name.trim(), loci: [] });
  touch(p);
  return p.rooms[p.rooms.length - 1]!;
}

export function deleteRoom(p: Palace, roomId: string): void {
  const room = p.rooms.find((r) => r.id === roomId);
  if (!room) return;
  for (const l of room.loci) forgetLocus(p.id, l.id);
  p.rooms = p.rooms.filter((r) => r.id !== roomId);
  if (p.rooms.length === 0) p.rooms.push({ id: uid(), name: '', loci: [] });
  touch(p);
}

export function moveRoom(p: Palace, roomId: string, delta: number): void {
  const i = p.rooms.findIndex((r) => r.id === roomId);
  move(p.rooms, i, i + delta);
  touch(p);
}

/* ---------- Loci ---------- */

export function addLocus(p: Palace, room: Room, name: string, description = ''): Locus {
  room.loci.push({ id: uid(), name: name.trim(), description: description.trim() });
  touch(p);
  return room.loci[room.loci.length - 1]!;
}

/** Retire un locus de tous les contenus du palais. */
function forgetLocus(palaceId: string, locusId: string) {
  for (const c of db.contents) {
    if (c.palaceId === palaceId && c.items[locusId]) delete c.items[locusId];
  }
}

export function deleteLocus(p: Palace, locusId: string): void {
  for (const room of p.rooms) {
    const i = room.loci.findIndex((l) => l.id === locusId);
    if (i >= 0) room.loci.splice(i, 1);
  }
  forgetLocus(p.id, locusId);
  touch(p);
}

/**
 * Déplace un locus d'un cran dans le trajet global (peut changer de pièce).
 * delta = -1 (monter) ou +1 (descendre).
 */
export function moveLocus(p: Palace, locusId: string, delta: -1 | 1): void {
  const ri = p.rooms.findIndex((r) => r.loci.some((l) => l.id === locusId));
  const room = p.rooms[ri];
  if (!room) return;
  const li = room.loci.findIndex((l) => l.id === locusId);
  const target = li + delta;
  if (target >= 0 && target < room.loci.length) {
    move(room.loci, li, target);
  } else {
    // Passe dans la pièce voisine.
    const other = p.rooms[ri + delta];
    if (!other) return;
    const [locus] = room.loci.splice(li, 1);
    if (!locus) return;
    if (delta < 0) other.loci.push(locus);
    else other.loci.unshift(locus);
  }
  touch(p);
}

export function moveLocusToRoom(p: Palace, locusId: string, roomId: string): void {
  const from = p.rooms.find((r) => r.loci.some((l) => l.id === locusId));
  const to = p.rooms.find((r) => r.id === roomId);
  if (!from || !to || from === to) return;
  const i = from.loci.findIndex((l) => l.id === locusId);
  const [locus] = from.loci.splice(i, 1);
  if (locus) to.loci.push(locus);
  touch(p);
}

/* ---------- Contenus ---------- */

export function getContent(id: string): Content | undefined {
  return db.contents.find((c) => c.id === id);
}

export function contentsOf(palaceId: string): Content[] {
  return db.contents.filter((c) => c.palaceId === palaceId);
}

export function createContent(palaceId: string, title: string, notes = ''): Content {
  const now = Date.now();
  db.contents.push({
    id: uid(),
    palaceId,
    title: title.trim() || 'Nouveau contenu',
    notes: notes.trim(),
    items: {},
    createdAt: now,
    updatedAt: now,
  });
  return db.contents[db.contents.length - 1]!;
}

export function deleteContent(id: string): void {
  db.contents = db.contents.filter((c) => c.id !== id);
}

export function setItem(c: Content, locusId: string, item: ContentItem): void {
  if (!item.text.trim() && !item.image.trim()) delete c.items[locusId];
  else c.items[locusId] = { text: item.text.trim(), image: item.image.trim() };
  touch(c);
}

/** Contenus non archivés d'un palais. */
export function activeContentsOf(palaceId: string): Content[] {
  return db.contents.filter((c) => c.palaceId === palaceId && !c.archived);
}

export function setArchived(c: Content, archived: boolean): void {
  c.archived = archived;
  touch(c);
}

/**
 * Déplace un contenu vers un autre palais en gardant l'ordre : l'élément du locus n° k
 * va sur le locus n° k du palais cible. Retourne le nombre d'éléments sans place.
 */
export function moveContentToPalace(c: Content, target: Palace): number {
  const src = getPalace(c.palaceId);
  if (!src || src.id === target.id) return 0;
  const from = flatLoci(src);
  const to = flatLoci(target);
  const items: Content['items'] = {};
  let lost = 0;
  from.forEach((f, i) => {
    const item = c.items[f.locus.id];
    if (!item) return;
    const dest = to[i];
    if (dest) items[dest.locus.id] = item;
    else lost++;
  });
  c.items = items;
  c.palaceId = target.id;
  touch(c);
  return lost;
}

export function filledCount(c: Content, p: Palace): number {
  return flatLoci(p).filter((f) => c.items[f.locus.id]?.text).length;
}

/**
 * Place une liste de lignes sur les loci à partir de la position `start` (1 = premier).
 * Retourne le nombre de lignes qui n'ont pas trouvé de locus.
 */
export function pasteList(c: Content, p: Palace, lines: string[], start: number): number {
  const flat = flatLoci(p);
  let i = start - 1;
  let overflow = 0;
  for (const line of lines) {
    const f = flat[i++];
    if (!f) {
      overflow++;
      continue;
    }
    const prev = c.items[f.locus.id];
    c.items[f.locus.id] = { text: line, image: prev?.image ?? '' };
  }
  touch(c);
  return overflow;
}

export function recordQuiz(target: Palace | Content, result: QuizResult): void {
  target.lastQuiz = result;
  target.review = nextReview(target.review, result.score, result.total, result.at);
}

export function snoozeReview(target: Palace | Content): void {
  target.review = snooze(target.review);
}

/** Déplace un locus dans `roomId`, à la position `index` (calculée sans le locus lui-même). */
export function moveLocusTo(p: Palace, locusId: string, roomId: string, index: number): void {
  const from = p.rooms.find((r) => r.loci.some((l) => l.id === locusId));
  const to = p.rooms.find((r) => r.id === roomId);
  if (!from || !to) return;
  const i = from.loci.findIndex((l) => l.id === locusId);
  const [locus] = from.loci.splice(i, 1);
  if (!locus) return;
  to.loci.splice(Math.max(0, Math.min(index, to.loci.length)), 0, locus);
  touch(p);
}

/** Crée un palais avec une liste de loci (onboarding). */
export function createPalaceWithLoci(name: string, loci: string[]): Palace {
  const p = createPalace(name, '');
  const room = p.rooms[0]!;
  for (const l of loci) addLocus(p, room, l);
  return p;
}

/* ---------- Exemple ---------- */

export function createSample(): Palace {
  const p = createPalace('Mon appartement (exemple)', '🏠');
  p.description = "Un exemple pour comprendre. Modifie-le ou supprime-le quand tu veux.";
  p.rooms = [];
  const plan: [string, [string, string][]][] = [
    ['Entrée', [['Porte d\'entrée', 'Grosse porte brune, poignée froide'], ['Tapis', 'Tapis gris qui gratte'], ['Patère', 'Manteaux empilés']]],
    ['Cuisine', [['Frigo', 'Frigo blanc couvert d\'aimants'], ['Évier', 'Robinet qui coule'], ['Four', 'Porte vitrée, chaleur']]],
    ['Salon', [['Divan', 'Divan bleu moelleux'], ['Télé', 'Grand écran noir'], ['Fenêtre', 'Vue sur la rue']]],
  ];
  for (const [roomName, loci] of plan) {
    const room = addRoom(p, roomName);
    for (const [n, d] of loci) addLocus(p, room, n, d);
  }
  const c = createContent(p.id, 'Liste d\'épicerie', 'Exemple : chaque article est placé sur un locus.');
  const flat = flatLoci(p);
  const items: [string, string][] = [
    ['Lait', 'Une vache défonce la porte'],
    ['Bananes', 'Le tapis est fait de pelures de banane'],
    ['Œufs', 'Les manteaux pondent des œufs'],
    ['Café', 'Le frigo crache du café bouillant'],
    ['Pain', 'Une baguette géante bloque l\'évier'],
  ];
  items.forEach(([text, image], i) => {
    const f = flat[i];
    if (f) c.items[f.locus.id] = { text, image };
  });
  return p;
}

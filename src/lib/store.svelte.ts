import type { Content, ContentItem, Data, LabSession, Locus, Palace, Place, PlaceIcon, QuizResult, Room } from './types';
import { readBackup, readRaw, writeNamed, writeRaw, writeStartupBackup } from './storage';
import { CURRENT_SCHEMA, NewerDataError, parseData } from './migrate';

export { parseData };
import { flatLoci, move, uid } from './util';
import { nextReview, snooze, startOfDay } from './review';

function emptyData(): Data {
  return { schema: 3, places: [], palaces: [], contents: [], numbers: {}, settings: { theme: 'auto' }, lab: { sessions: [] } };
}

/** Toutes les données de l'app. Toute modification est sauvegardée automatiquement. */
export const db: Data = $state(emptyData());

export const status = $state({
  loaded: false,
  saveError: '',
  /** Message d'information (ex. données récupérées depuis une copie). */
  notice: '',
  /** Vrai si on ne doit surtout pas réécrire le fichier (données illisibles ou trop récentes). */
  readOnly: false,
});

function replaceAll(data: Data) {
  db.schema = data.schema;
  db.places = data.places;
  db.palaces = data.palaces;
  db.contents = data.contents;
  db.numbers = data.numbers;
  db.settings = data.settings;
  db.lab = data.lab;
}

export async function load(): Promise<void> {
  const raw = await readRaw();
  if (raw) {
    try {
      const { data, from } = parseData(raw);
      if (from < CURRENT_SCHEMA) {
        // Copie intacte de l'ancien format avant de le transformer.
        await writeNamed(`logidex.avant-format-${CURRENT_SCHEMA}.json`, raw);
      }
      replaceAll(data);
      await writeStartupBackup(raw);
    } catch (e) {
      if (e instanceof NewerDataError) {
        status.readOnly = true;
        status.saveError = e.message;
      } else {
        // Fichier abîmé : on le met de côté et on repart de la copie faite au dernier démarrage réussi.
        await writeNamed(`logidex.illisible-${Date.now()}.json`, raw);
        const backup = await readBackup();
        try {
          if (!backup) throw new Error('aucune copie');
          replaceAll(parseData(backup).data);
          status.notice = 'Le fichier de données était abîmé : tes données ont été récupérées depuis la dernière copie.';
        } catch {
          status.readOnly = true;
          status.saveError =
            'Données illisibles. Rien n’a été effacé : importe une sauvegarde (Réglages) ou une copie de Documents/Logidex.';
        }
      }
    }
  }
  status.loaded = true;

  // Sauvegarde automatique : tout changement dans db déclenche une écriture (regroupée).
  let timer: ReturnType<typeof setTimeout> | undefined;
  let last = JSON.stringify(db);
  $effect.root(() => {
    $effect(() => {
      const json = JSON.stringify(db);
      if (json === last || status.readOnly) return;
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
  replaceAll(parseData(json).data);
  // Un import réussi remplace des données illisibles : on peut de nouveau sauvegarder.
  status.readOnly = false;
  status.saveError = '';
}

/** Copie de l'état complet, pour « Annuler ». */
export function snapshot(): string {
  return JSON.stringify(db);
}

export function restore(json: string): void {
  replaceAll(parseData(json).data);
}

/* ---------- Lieux ---------- */

export function getPlace(id: string | undefined): Place | undefined {
  return id ? db.places.find((l) => l.id === id) : undefined;
}

export function createPlace(name: string, icon: PlaceIcon = 'building'): Place {
  db.places.push({ id: uid(), name: name.trim() || 'Nouveau lieu', icon, createdAt: Date.now() });
  return db.places[db.places.length - 1]!;
}

/** Palais d'un lieu (ou sans lieu si `placeId` est undefined), les plus récents d'abord. */
export function palacesOf(placeId: string | undefined): Palace[] {
  return db.palaces.filter((p) => (p.placeId ?? undefined) === placeId).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Supprime le lieu ; ses palais sont gardés, simplement sans lieu. */
export function deletePlace(id: string): void {
  for (const p of db.palaces) if (p.placeId === id) p.placeId = undefined;
  db.places = db.places.filter((l) => l.id !== id);
}

/**
 * Palais à plusieurs zones qui pourraient être des palais séparés (ex. « École » dont chaque
 * zone est une classe) : pas encore dans un lieu, et l'utilisateur n'a pas dit « c'est un seul trajet ».
 */
export function splitCandidates(): Palace[] {
  const keep = new Set(db.settings.keepAsPalace ?? []);
  return db.palaces.filter(
    (p) => !p.placeId && !p.training && !keep.has(p.id) && p.rooms.filter((r) => r.name).length >= 2,
  );
}

/** Ce que donnera la transformation : un palais par zone. */
export function splitPreview(p: Palace): { name: string; loci: number }[] {
  return p.rooms
    .filter((r) => r.name || r.loci.length)
    .map((r, i) => ({ name: r.name || `${p.name} ${i + 1}`, loci: r.loci.length }));
}

/**
 * Transforme un palais en lieu : chaque zone devient son propre palais, dans le même ordre.
 * Les loci gardent leur identité, donc ce qui y est déposé suit. Un contenu réparti sur
 * plusieurs zones est découpé : une partie par nouveau palais, même titre.
 */
export function splitPalaceIntoPlace(p: Palace): Place {
  const lower = p.name.toLowerCase();
  const icon: PlaceIcon = /maison|appart|chalet|chambre|chez/.test(lower)
    ? 'home'
    : /bureau|travail|job|usine/.test(lower)
      ? 'briefcase'
      : /parc|jardin|for[eê]t|plage/.test(lower)
        ? 'tree'
        : 'building';
  const place = createPlace(p.name, icon);
  const now = Date.now();
  const rooms = p.rooms.filter((r) => r.name || r.loci.length);
  const created: Palace[] = rooms.map((r, i) => ({
    id: uid(),
    name: r.name || `${p.name} ${i + 1}`,
    emoji: '',
    description: '',
    placeId: place.id,
    subject: p.subject,
    rooms: [{ id: uid(), name: '', loci: r.loci.map((l) => ({ ...l })) }],
    createdAt: p.createdAt,
    updatedAt: now,
    lastQuiz: p.lastQuiz ? { ...p.lastQuiz } : undefined,
    review: p.review ? { ...p.review } : undefined,
  }));
  const owner = new Map<string, string>();
  created.forEach((np) => np.rooms[0]!.loci.forEach((l) => owner.set(l.id, np.id)));

  const extra: Content[] = [];
  for (const c of db.contents) {
    if (c.palaceId !== p.id) continue;
    const groups = new Map<string, Content['items']>();
    for (const [locusId, item] of Object.entries(c.items)) {
      const target = owner.get(locusId);
      if (!target) continue;
      const g = groups.get(target) ?? {};
      g[locusId] = item;
      groups.set(target, g);
    }
    const targets = created.map((np) => np.id).filter((id) => groups.has(id));
    if (targets.length === 0) {
      c.palaceId = created[0]?.id ?? c.palaceId;
      continue;
    }
    c.palaceId = targets[0]!;
    c.items = groups.get(targets[0]!) ?? {};
    for (const t of targets.slice(1)) {
      extra.push({
        ...c,
        id: uid(),
        palaceId: t,
        items: groups.get(t) ?? {},
        lastQuiz: c.lastQuiz ? { ...c.lastQuiz } : undefined,
        review: c.review ? { ...c.review } : undefined,
      });
    }
  }
  db.contents.push(...extra);
  const at = db.palaces.findIndex((x) => x.id === p.id);
  db.palaces.splice(at, 1, ...created);
  return place;
}

export function keepAsPalace(p: Palace): void {
  db.settings.keepAsPalace = [...new Set([...(db.settings.keepAsPalace ?? []), p.id])];
}

/* ---------- Palais ---------- */

export function getPalace(id: string): Palace | undefined {
  return db.palaces.find((p) => p.id === id);
}

export function createPalace(name: string, emoji: string, placeId?: string, subject?: string): Palace {
  const now = Date.now();
  db.palaces.push({
    id: uid(),
    name: name.trim() || 'Nouveau palais',
    placeId: placeId || undefined,
    subject: subject?.trim() || undefined,
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
  const more = (item.more ?? []).map((m) => m.trim()).filter(Boolean).slice(0, 3);
  const question = item.question?.trim() || undefined;
  if (!item.text.trim() && !item.image.trim() && !more.length) delete c.items[locusId];
  else
    c.items[locusId] = {
      text: item.text.trim(),
      image: item.image.trim(),
      ...(more.length ? { more } : {}),
      ...(question ? { question } : {}),
    };
  touch(c);
}

/** Tous les éléments à retenir d'un locus (1 à 4). */
export function itemParts(item: ContentItem | undefined): string[] {
  if (!item) return [];
  return [item.text, ...(item.more ?? [])].map((t) => t.trim()).filter(Boolean);
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

const HISTORY_MAX = 300;

/**
 * Enregistre un test. Si la révision n'était pas encore due, c'est de l'entraînement :
 * l'intervalle n'avance pas (on ne « gagne » pas 3 semaines en 3 tests le même soir),
 * mais un échec ramène quand même la révision à demain.
 * `cards` met à jour les points faibles (échecs récents par locus).
 */
export function recordQuiz(
  target: Palace | Content,
  result: QuizResult,
  cards: { key: string; grade: 'known' | 'partial' | 'missed' }[] = [],
): void {
  const due = !target.review || target.review.due <= result.at;
  const ratio = result.total ? result.score / result.total : 0;
  const entry: QuizResult = { ...result, practice: !due || undefined };
  if (due) {
    target.review = nextReview(target.review, result.score, result.total, result.at);
  } else if (ratio < 0.6 && target.review) {
    target.review = { interval: target.review.interval, due: Math.min(target.review.due, startOfDay(result.at) + 86_400_000) };
  }
  target.lastQuiz = entry;
  target.history = [...(target.history ?? []), entry].slice(-HISTORY_MAX);

  const weak = { ...(target.weak ?? {}) };
  for (const c of cards) {
    if (c.grade === 'known') {
      if (weak[c.key]) weak[c.key] = weak[c.key]! - 1;
    } else {
      weak[c.key] = Math.min(5, (weak[c.key] ?? 0) + (c.grade === 'missed' ? 2 : 1));
    }
    if (!weak[c.key]) delete weak[c.key];
  }
  target.weak = Object.keys(weak).length ? weak : undefined;
}

/** Loci considérés comme points faibles (échoués récemment, pas encore rattrapés). */
export function weakKeys(target: Palace | Content): string[] {
  return Object.entries(target.weak ?? {})
    .filter(([, n]) => n >= 2)
    .map(([k]) => k);
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

/* ---------- Laboratoire ---------- */

export function setTraining(p: Palace, on: boolean): void {
  p.training = on || undefined;
  touch(p);
}

export function addLabSession(session: Omit<LabSession, 'id'>): LabSession {
  db.lab.sessions.push({ ...session, id: uid() });
  // On ne garde que les 200 dernières séances.
  if (db.lab.sessions.length > 200) db.lab.sessions.splice(0, db.lab.sessions.length - 200);
  return db.lab.sessions[db.lab.sessions.length - 1]!;
}

export function getLabSession(id: string): LabSession | undefined {
  return db.lab.sessions.find((s) => s.id === id);
}

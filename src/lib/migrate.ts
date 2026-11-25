/**
 * Lecture et migration des données — sans perte.
 *
 * Règles :
 * 1. Chaque format de données a un numéro (`schema`). Une nouvelle version de l'app qui change
 *    le format ajoute une fonction dans MIGRATIONS ; elle transforme l'ancien format en nouveau.
 * 2. Les champs inconnus sont conservés tels quels (rien n'est jeté).
 * 3. Avant toute migration, l'app écrit une copie de l'ancien fichier (voir store.load).
 * 4. Des données plus récentes que l'app ne sont jamais réécrites (lecture seule).
 */
import type { Data } from './types';
import { uid } from './util';

export const CURRENT_SCHEMA = 3;

type Raw = Record<string, unknown> & { schema?: number };

/** Clé = version de départ ; la fonction produit la version suivante. */
const MIGRATIONS: Record<number, (d: Raw) => Raw> = {
  // 1 → 2 (v0.4) : ajout des lieux. Les palais existants restent tels quels, sans lieu.
  1: (d) => ({ ...d, places: Array.isArray(d.places) ? d.places : [] }),
  // 2 → 3 (v0.5) : historique, points faibles, éléments multiples, Laboratoire. Tout est facultatif.
  2: (d) => ({ ...d, lab: d.lab && typeof d.lab === 'object' ? d.lab : { sessions: [] } }),
};

const PLACE_ICONS = ['home', 'building', 'briefcase', 'tree', 'map', 'star'];

export class NewerDataError extends Error {
  constructor(public version: number) {
    super(`Ces données viennent d'une version plus récente de Logidex (format ${version}). Mets l'app à jour.`);
  }
}

export class InvalidDataError extends Error {}

export function migrate(input: Raw): { data: Raw; from: number } {
  const from = typeof input.schema === 'number' ? input.schema : 1;
  if (from > CURRENT_SCHEMA) throw new NewerDataError(from);
  let data = input;
  for (let v = from; v < CURRENT_SCHEMA; v++) {
    const step = MIGRATIONS[v];
    if (!step) throw new InvalidDataError(`Migration ${v} → ${v + 1} manquante.`);
    data = { ...step(data), schema: v + 1 };
  }
  return { data, from };
}

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Obj) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d);
const num = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? v : d);

/** Vérifie, migre et complète des données (stockage ou fichier importé). */
export function parseData(json: string): { data: Data; from: number } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new InvalidDataError("Le fichier n'est pas du JSON valide.");
  }
  const root = obj(parsed);
  if (!Array.isArray(root.palaces)) throw new InvalidDataError("Ce fichier ne ressemble pas à une sauvegarde Logidex.");
  const { data: raw, from } = migrate(root);
  const now = Date.now();

  const places = arr(raw.places).map((lv) => {
    const l = obj(lv);
    return {
      ...l,
      id: str(l.id) || uid(),
      name: str(l.name, 'Lieu'),
      icon: PLACE_ICONS.includes(str(l.icon)) ? str(l.icon) : 'building',
      createdAt: num(l.createdAt, now),
    };
  });
  const placeIds = new Set(places.map((l) => l.id));

  const palaces = arr(raw.palaces).map((pv) => {
    const p = obj(pv);
    const placeId = str(p.placeId);
    return {
      ...p,
      placeId: placeIds.has(placeId) ? placeId : undefined,
      subject: str(p.subject) || undefined,
      id: str(p.id) || uid(),
      name: str(p.name, 'Palais'),
      emoji: str(p.emoji),
      description: str(p.description),
      createdAt: num(p.createdAt, now),
      updatedAt: num(p.updatedAt, now),
      rooms: arr(p.rooms).map((rv) => {
        const r = obj(rv);
        return {
          ...r,
          id: str(r.id) || uid(),
          name: str(r.name),
          loci: arr(r.loci).map((lv) => {
            const l = obj(lv);
            return { ...l, id: str(l.id) || uid(), name: str(l.name), description: str(l.description) };
          }),
        };
      }),
    };
  });

  const contents = arr(raw.contents).map((cv) => {
    const c = obj(cv);
    const items: Record<string, { text: string; image: string; more?: string[]; question?: string }> = {};
    for (const [k, iv] of Object.entries(obj(c.items))) {
      const i = obj(iv);
      const more = arr(i.more).filter((x): x is string => typeof x === 'string' && x.trim() !== '').slice(0, 3);
      items[k] = {
        ...i,
        text: str(i.text),
        image: str(i.image),
        more: more.length ? more : undefined,
        question: str(i.question) || undefined,
      };
    }
    return {
      ...c,
      id: str(c.id) || uid(),
      palaceId: str(c.palaceId),
      title: str(c.title, 'Contenu'),
      notes: str(c.notes),
      items,
      createdAt: num(c.createdAt, now),
      updatedAt: num(c.updatedAt, now),
    };
  });

  const numbers: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj(raw.numbers))) if (typeof v === 'string') numbers[k] = v;

  const settings = { theme: 'auto', ...obj(raw.settings) };

  const labRaw = obj(raw.lab);
  const lab = {
    ...labRaw,
    sessions: arr(labRaw.sessions)
      .map((v) => obj(v))
      .filter((v) => typeof v.at === 'number')
      .map((v) => ({
        ...v,
        id: str(v.id) || uid(),
        palaceId: str(v.palaceId),
        palaceName: str(v.palaceName),
        perLocus: num(v.perLocus, 1),
        words: arr(v.words).filter((w): w is string => typeof w === 'string'),
        encodeMs: num(v.encodeMs, 0),
        correct: num(v.correct, 0),
      })),
  };

  return {
    data: { ...raw, schema: CURRENT_SCHEMA, places, palaces, contents, numbers, settings, lab } as unknown as Data,
    from,
  };
}

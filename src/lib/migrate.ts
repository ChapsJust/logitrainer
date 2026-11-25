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

export const CURRENT_SCHEMA = 1;

type Raw = Record<string, unknown> & { schema?: number };

/** Clé = version de départ ; la fonction produit la version suivante. */
const MIGRATIONS: Record<number, (d: Raw) => Raw> = {
  // Exemple pour une future version 2 :
  // 1: (d) => ({ ...d, places: [] }),
};

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

  const palaces = arr(raw.palaces).map((pv) => {
    const p = obj(pv);
    return {
      ...p,
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
    const items: Record<string, { text: string; image: string }> = {};
    for (const [k, iv] of Object.entries(obj(c.items))) {
      const i = obj(iv);
      items[k] = { ...i, text: str(i.text), image: str(i.image) };
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

  return {
    data: { ...raw, schema: CURRENT_SCHEMA, palaces, contents, numbers, settings } as unknown as Data,
    from,
  };
}

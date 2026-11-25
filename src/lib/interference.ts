import type { Content, Palace } from './types';
import { activeContentsOf, db } from './store.svelte';
import { flatLoci } from './util';

export type Occupancy = 'free' | 'used' | 'mixed';

export interface PalaceUse {
  state: Occupancy;
  active: Content[];
  /** Loci portant des éléments de 2 contenus actifs ou plus. */
  sharedLoci: Set<string>;
  /** Contenus actifs par locus. */
  byLocus: Map<string, Content[]>;
}

/** Qui occupe quoi dans un palais. */
export function palaceUse(p: Palace): PalaceUse {
  const active = activeContentsOf(p.id);
  const byLocus = new Map<string, Content[]>();
  for (const c of active) {
    for (const [locusId, item] of Object.entries(c.items)) {
      if (!item.text) continue;
      const list = byLocus.get(locusId) ?? [];
      list.push(c);
      byLocus.set(locusId, list);
    }
  }
  const sharedLoci = new Set([...byLocus].filter(([, l]) => l.length > 1).map(([id]) => id));
  const state: Occupancy = sharedLoci.size > 0 ? 'mixed' : active.length > 0 ? 'used' : 'free';
  return { state, active, sharedLoci, byLocus };
}

/** Autres contenus actifs qui ont aussi un élément sur ce locus. */
export function neighbours(c: Content, locusId: string): { content: Content; text: string }[] {
  return db.contents
    .filter((o) => o.id !== c.id && o.palaceId === c.palaceId && !o.archived && o.items[locusId]?.text)
    .map((o) => ({ content: o, text: o.items[locusId]!.text }));
}

/** Contenus actifs qui partagent au moins un locus avec `c`, avec le nombre de loci communs. */
export function overlaps(c: Content): { content: Content; count: number }[] {
  if (c.archived) return [];
  const mine = new Set(Object.entries(c.items).filter(([, i]) => i.text).map(([id]) => id));
  const out: { content: Content; count: number }[] = [];
  for (const o of db.contents) {
    if (o.id === c.id || o.palaceId !== c.palaceId || o.archived) continue;
    const count = Object.entries(o.items).filter(([id, i]) => i.text && mine.has(id)).length;
    if (count > 0) out.push({ content: o, count });
  }
  return out;
}

/** Palais libres (aucun contenu actif), les plus grands et les moins récemment utilisés d'abord. */
export function freePalaces(excludeId?: string): Palace[] {
  const lastUse = (p: Palace) =>
    Math.max(0, ...db.contents.filter((c) => c.palaceId === p.id).map((c) => c.updatedAt));
  return db.palaces
    .filter((p) => p.id !== excludeId && !p.training && flatLoci(p).length > 0 && palaceUse(p).state === 'free')
    .sort((a, b) => flatLoci(b).length - flatLoci(a).length || lastUse(a) - lastUse(b));
}

export const OCCUPANCY_LABEL: Record<Occupancy, string> = {
  free: 'Libre',
  used: 'Occupé',
  mixed: 'Mélange',
};

import { describe, expect, it } from 'vitest';
import { CURRENT_SCHEMA, InvalidDataError, NewerDataError, parseData } from '../src/lib/migrate';

const v01 = {
  schema: 1,
  palaces: [
    { id: 'p1', name: 'Maison', emoji: '🏠', description: '', createdAt: 1, updatedAt: 2,
      rooms: [{ id: 'r1', name: 'Entrée', loci: [{ id: 'l1', name: 'Porte', description: 'brune' }] }] },
  ],
  contents: [{ id: 'c1', palaceId: 'p1', title: 'Épicerie', notes: '', items: { l1: { text: 'Lait', image: '' } }, createdAt: 1, updatedAt: 1 }],
  numbers: { '00': 'Sauce' },
  settings: { theme: 'dark' },
};

describe('parseData / migrations', () => {
  it('v0.1 → format actuel sans perte', () => {
    const { data, from } = parseData(JSON.stringify(v01));
    expect(from).toBe(1);
    expect(data.schema).toBe(CURRENT_SCHEMA);
    expect(data.palaces[0]!.rooms[0]!.loci[0]!.name).toBe('Porte');
    expect(data.contents[0]!.items.l1!.text).toBe('Lait');
    expect(data.places).toEqual([]);
    expect(data.lab).toEqual({ sessions: [] });
    expect(data.numbers['00']).toBe('Sauce');
    expect(data.settings.theme).toBe('dark');
  });

  it('champs inconnus conservés et aller-retour stable', () => {
    const v = structuredClone(v01) as Record<string, unknown> & typeof v01;
    (v.contents[0] as Record<string, unknown>).futur = { x: 1 };
    (v as Record<string, unknown>).champInconnu = 42;
    const a = parseData(JSON.stringify(v)).data as unknown as Record<string, unknown>;
    expect(a.champInconnu).toBe(42);
    expect(parseData(JSON.stringify(a)).data).toEqual(a);
  });

  it('format 2 avec lieux, matière, éléments multiples et question', () => {
    const v2 = {
      ...structuredClone(v01),
      schema: 2,
      places: [{ id: 'L1', name: 'École', icon: 'building', createdAt: 3 }],
    };
    Object.assign(v2.palaces[0]!, { placeId: 'L1', subject: 'Maths' });
    Object.assign(v2.contents[0]!.items.l1!, { more: ['Pain', '', 5], question: 'Quoi acheter ?' });
    const { data } = parseData(JSON.stringify(v2));
    expect(data.palaces[0]!.placeId).toBe('L1');
    expect(data.palaces[0]!.subject).toBe('Maths');
    expect(data.contents[0]!.items.l1!.more).toEqual(['Pain']);
    expect(data.contents[0]!.items.l1!.question).toBe('Quoi acheter ?');
  });

  it('lieu disparu → palais sans lieu', () => {
    const v2 = { ...structuredClone(v01), schema: 2, places: [] };
    Object.assign(v2.palaces[0]!, { placeId: 'disparu' });
    expect(parseData(JSON.stringify(v2)).data.palaces[0]!.placeId).toBeUndefined();
  });

  it('format futur → refusé (jamais réécrit)', () => {
    expect(() => parseData(JSON.stringify({ ...v01, schema: 99 }))).toThrow(NewerDataError);
  });

  it('fichiers invalides → erreur claire', () => {
    expect(() => parseData('{abc')).toThrow(InvalidDataError);
    expect(() => parseData('{"foo":1}')).toThrow(InvalidDataError);
  });
});

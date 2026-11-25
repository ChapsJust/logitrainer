import { describe, expect, it } from 'vitest';
import { compare, compareParts, freeRecall } from '../src/lib/match';

describe('compare — tolérance de la dictée', () => {
  it.each([
    ['Hydrogène', 'idrogen'],
    ['Béryllium', 'berylium'],
    ['Carbone', 'carbonne'],
    ['Œufs', 'oeuf'],
    ['Révolution française 1789', 'la révolution française en 17 89'],
    ['Remercier les parents', 'il faut remercier mes parents'],
  ])('« %s » ≈ « %s » → su', (answer, said) => {
    expect(compare(answer, [said]).grade).toBe('known');
  });

  it('mot absent → raté', () => {
    expect(compare('Bore', ['porte']).grade).toBe('missed');
  });

  it('moitié des mots → à moitié', () => {
    expect(compare('Remercier les parents', ['remercier']).grade).toBe('partial');
  });

  it('chiffres différents → raté', () => {
    expect(compare('1534', ['1543']).grade).toBe('missed');
  });
});

describe('compare — négations', () => {
  it('« n’augmente pas » au lieu de « augmente » → au mieux à moitié, signalé', () => {
    const r = compare('La rentabilité augmente', ["la rentabilité n'augmente pas"]);
    expect(r.negation).toBe(true);
    expect(r.grade).toBe('partial');
  });

  it('négation attendue et dite → su', () => {
    const r = compare("La rentabilité n'augmente pas", ['la rentabilité n augmente pas']);
    expect(r.negation).toBe(false);
    expect(r.grade).toBe('known');
  });

  it('négation attendue mais oubliée → signalé', () => {
    expect(compare('Ne jamais diviser par zéro', ['diviser par zéro']).negation).toBe(true);
  });
});

describe('compareParts — plusieurs éléments par locus', () => {
  it('tous retrouvés → su', () => {
    expect(compareParts(['Lion', 'Guitare'], ['guitare et lion']).grade).toBe('known');
  });
  it('un sur deux → à moitié', () => {
    const r = compareParts(['Lion', 'Guitare'], ['un lion']);
    expect(r.found).toBe(1);
    expect(r.grade).toBe('partial');
  });
  it('aucun → raté', () => {
    expect(compareParts(['Lion', 'Guitare', 'Pomme'], ['banane']).grade).toBe('missed');
  });
});

describe('freeRecall — rappel libre dans l’ordre', () => {
  const expected = ['Hydrogène', 'Hélium', 'Lithium', 'Béryllium'];
  it('tout dans l’ordre', () => {
    expect(freeRecall(expected, 'hydrogène hélium lithium béryllium')).toEqual(['ok', 'ok', 'ok', 'ok']);
  });
  it('inversion détectée (un élément signalé hors de l’ordre)', () => {
    const r = freeRecall(expected, 'hydrogène lithium hélium béryllium');
    expect(r.filter((s) => s === 'order')).toHaveLength(1);
    expect(r.filter((s) => s === 'missing')).toHaveLength(0);
  });
  it('oubli détecté', () => {
    expect(freeRecall(expected, 'hydrogène hélium béryllium')).toEqual(['ok', 'ok', 'missing', 'ok']);
  });
  it('éléments de plusieurs mots', () => {
    expect(freeRecall(['Jacques Cartier', 'Révolution française'], 'euh jacques cartier puis la révolution française')).toEqual([
      'ok',
      'ok',
    ]);
  });
});

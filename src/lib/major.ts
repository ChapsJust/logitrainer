/**
 * Système majeur (version française) : chaque chiffre = un son de consonne.
 * Les voyelles sont libres, ce qui permet de transformer un nombre en mot.
 */
export const MAJOR: Record<string, string> = {
  '0': 's, z',
  '1': 't, d',
  '2': 'n',
  '3': 'm',
  '4': 'r',
  '5': 'l',
  '6': 'ch, j',
  '7': 'k, g dur',
  '8': 'f, v',
  '9': 'p, b',
};

/** Exemples de mots (suggestions seulement — tes propres images marchent mieux). */
export const MAJOR_EXAMPLES: Record<string, string> = {
  '00': 'sauce',
  '01': 'site',
  '02': 'scène',
  '10': 'tasse',
  '11': 'tête',
  '12': 'tonne',
  '13': 'dame',
  '21': 'nuit',
  '22': 'nonne',
  '25': 'Nil',
  '31': 'mot',
  '33': 'momie',
  '34': 'mur',
  '41': 'radeau',
  '42': 'reine',
  '44': 'rire',
  '51': 'lutte',
  '55': 'lilas',
  '61': 'chute',
  '66': 'juge',
  '71': 'gâteau',
  '77': 'coq',
  '81': 'fête',
  '88': 'fève',
  '91': 'patte',
  '99': 'bébé',
};

export const NUMBER_KEYS: string[] = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));

export function majorHint(key: string): string {
  return key
    .split('')
    .map((d) => MAJOR[d]?.split(',')[0]?.trim() ?? '')
    .join(' + ');
}

/** Découpe les nombres d'un texte en paires (« 1867 » → 18, 67). Chiffre seul → « 0X ». */
export function numberPairs(text: string): { raw: string; pairs: string[] }[] {
  const groups = text.match(/\d+/g) ?? [];
  return groups
    .filter((g) => g.length <= 12)
    .map((g) => {
      const pairs: string[] = [];
      for (let i = 0; i < g.length; i += 2) {
        const p = g.slice(i, i + 2);
        pairs.push(p.length === 1 ? '0' + p : p);
      }
      return { raw: g, pairs };
    });
}

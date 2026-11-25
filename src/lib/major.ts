/**
 * Système majeur (version française) : chaque chiffre = un son de consonne.
 * Les voyelles sont libres, ce qui permet de transformer un nombre en mot.
 */
/** Astuce pour retenir chaque son. */
export const MAJOR_TRICKS: Record<string, string> = {
  '0': '« zéro » commence par Z',
  '1': 'le T a une seule barre',
  '2': 'le n a 2 jambages',
  '3': 'le m a 3 jambages',
  '4': 'quatRe finit par R',
  '5': 'L = 50 en chiffres romains',
  '6': 'le 6 ressemble à un J retourné',
  '7': 'deux 7 tête-bêche forment un K',
  '8': 'le f manuscrit a 2 boucles, comme le 8',
  '9': 'le 9 est un P à l’envers',
};

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

/**
 * Exemples de mots pour chaque nombre (sons seulement : les lettres muettes et les voyelles nasales
 * comme « an », « on », « in » ne comptent pas). Ce sont des suggestions : tes propres images marchent mieux.
 */
export const MAJOR_WORDS: Record<string, string[]> = {
  '00': ['sauce', 'Suisse', 'oasis'],
  '01': ['site', 'soda', 'suite'],
  '02': ['scène', 'Seine', 'zone'],
  '03': ['sumo', 'zoom', 'cime'],
  '04': ['sirop', 'Zorro', 'soir'],
  '05': ['sel', 'saule', 'salle'],
  '06': ['sauge', 'siège', 'sushi'],
  '07': ['sac', 'ski', 'sec'],
  '08': ['sofa', 'sève', 'savon'],
  '09': ['soupe', 'sapin', 'sabot'],
  '10': ['tasse', 'dose'],
  '11': ['tête', 'date', 'dodo'],
  '12': ['tonne', 'dune', 'antenne'],
  '13': ['dame', 'dôme'],
  '14': ['tour', 'tarot', 'dard'],
  '15': ['tuile', 'toile', 'étoile'],
  '16': ['tache', 'douche', 'tige'],
  '17': ['dague', 'toque', 'taco'],
  '18': ['tofu', 'duvet', 'étoffe'],
  '19': ['taupe', 'tube', 'tapis'],
  '20': ['noce', 'Nice'],
  '21': ['nuit', 'note'],
  '22': ['nonne', 'Nana'],
  '23': ['nem', 'Nîmes'],
  '24': ['Néron', 'nerf', 'noir'],
  '25': ['Nil', 'Noël'],
  '26': ['neige', 'niche', 'nage'],
  '27': ['nuque', 'Nike'],
  '28': ['navet', 'nef'],
  '29': ['nappe'],
  '30': ['masse', 'mousse', 'maïs'],
  '31': ['mite', 'moto', 'mode'],
  '32': ['mine', 'moine', 'menu'],
  '33': ['momie', 'maman', 'mime'],
  '34': ['mur', 'mer', 'mûre'],
  '35': ['mule', 'moule', 'miel'],
  '36': ['mouche', 'mèche', 'image'],
  '37': ['moka', 'Mickey'],
  '38': ['mauve', 'mafia'],
  '39': ['amibe', 'mob'],
  '40': ['rose', 'ruse', 'race'],
  '41': ['route', 'radeau', 'rôti'],
  '42': ['reine', 'renne', 'ruine'],
  '43': ['rame', 'rhum', 'rime'],
  '44': ['rire', 'aurore'],
  '45': ['rôle', 'rallye'],
  '46': ['ruche', 'roche', 'rouge'],
  '47': ['roc', 'rock', 'requin'],
  '48': ['rêve', 'rave'],
  '49': ['robe', 'râpe', 'rubis'],
  '50': ['lasso', 'lys', 'laisse'],
  '51': ['lutte', 'latte', 'loto'],
  '52': ['lune', 'laine'],
  '53': ['lame', 'lime', 'lama'],
  '54': ['lard', 'lyre', 'Laura'],
  '55': ['lilas', 'Lola'],
  '56': ['luge', 'loge'],
  '57': ['lac', 'laque'],
  '58': ['lave', 'louve'],
  '59': ['loupe', 'lobe', 'lapin'],
  '60': ['chaise', 'chasse', 'Jésus'],
  '61': ['chute', 'jade', 'judo'],
  '62': ['chaîne', 'Chine', 'jaune'],
  '63': ['chameau', 'jumeau'],
  '64': ['char', 'chariot', 'jury'],
  '65': ['châle', 'gel', 'chalet'],
  '66': ['juge', 'chouchou'],
  '67': ['choc', 'jockey'],
  '68': ['chef', 'java'],
  '69': ['jupe', 'chapeau', 'jambe'],
  '70': ['cuisse', 'gaz', 'caisse'],
  '71': ['gâteau', 'côte', 'cadeau'],
  '72': ['canne', 'cône', 'canoë'],
  '73': ['gomme', 'écume'],
  '74': ['cœur', 'car', 'cure'],
  '75': ['colle', 'clé', 'école'],
  '76': ['cage', 'cache', 'coche'],
  '77': ['coq', 'cake', 'gag'],
  '78': ['café', 'cave', 'cuve'],
  '79': ['cape', 'coupe', 'cube'],
  '80': ['face', 'vase', 'fesse'],
  '81': ['fête', 'vide'],
  '82': ['veine', 'faune'],
  '83': ['femme', 'fumée'],
  '84': ['fer', 'four', 'verre'],
  '85': ['fil', 'ville', 'vélo'],
  '86': ['vache', 'fiche'],
  '87': ['phoque', 'vague'],
  '88': ['fève', 'Fifi'],
  '89': ['phobie', 'VIP', 'vape'],
  '90': ['puce', 'base', 'bus'],
  '91': ['patte', 'bateau', 'botte'],
  '92': ['panne', 'pneu'],
  '93': ['pomme', 'baume', 'puma'],
  '94': ['poire', 'bar', 'bière'],
  '95': ['pelle', 'balle', 'bulle'],
  '96': ['poche', 'bouche', 'page'],
  '97': ['bec', 'pic', 'bague'],
  '98': ['buffet', 'bœuf'],
  '99': ['bébé', 'papa', 'pipe'],
};

/** Compatibilité : premier exemple de chaque nombre. */
export const MAJOR_EXAMPLES: Record<string, string> = Object.fromEntries(
  Object.entries(MAJOR_WORDS).map(([k, v]) => [k, v[0] ?? '']),
);

export const NUMBER_KEYS: string[] = Array.from({ length: 100 }, (_, i) => String(i).padStart(2, '0'));

export function majorHint(key: string): string {
  return key
    .split('')
    .map((d) => (MAJOR[d]?.split(',')[0]?.trim() ?? '').toUpperCase())
    .join(' + ');
}

/** Sons principaux d'un chiffre en majuscules (« 6 » → « CH »). */
export function soundOf(d: string): string {
  return (MAJOR[d]?.split(',')[0]?.trim() ?? '').toUpperCase();
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

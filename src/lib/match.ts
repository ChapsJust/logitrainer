/**
 * Compare une réponse récitée (ou écrite) à la réponse attendue, avec tolérance :
 * accents, majuscules, pluriels, petites fautes de reconnaissance vocale, mots vides.
 */

const STOP = new Set(
  'le la les l un une des de du d a au aux et ou en sur sous dans pour par avec sans ce cet cette ces c son sa ses mon ma mes ton ta tes leur leurs qui que qu quoi est sont etait il elle ils elles on se s ne n pas plus y the of'.split(
    ' ',
  ),
);

export function tokens(s: string): string[] {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/œ/g, 'oe')
    .replace(/æ/g, 'ae')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean);
}

/** Clé phonétique simplifiée (français) pour absorber les variantes d'orthographe. */
export function phonetic(w: string): string {
  if (/^\d+$/.test(w)) return w;
  return w
    .replace(/ph/g, 'f')
    .replace(/qu/g, 'k')
    .replace(/c(?=[eiy])/g, 's')
    .replace(/[cq]/g, 'k')
    .replace(/g(?=[eiy])/g, 'j')
    .replace(/eau|au/g, 'o')
    .replace(/ai|ei|e(?=r$|z$|t$)/g, 'e')
    .replace(/y/g, 'i')
    .replace(/h/g, '')
    .replace(/([a-z])\1+/g, '$1')
    .replace(/(?<=.)[stdxpz]$/, '')
    .replace(/(?<=..)e$/, '');
}

function lev(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n]!;
}

function same(expected: string, said: string): boolean {
  if (expected === said) return true;
  if (/^\d+$/.test(expected) || /^\d+$/.test(said)) return false;
  const pe = phonetic(expected);
  const ps = phonetic(said);
  if (pe && pe === ps) return true;
  const len = Math.max(expected.length, said.length);
  // Pluriel / féminin : « reine » ≈ « reines », « petit » ≈ « petite ».
  const short = Math.min(expected.length, said.length);
  if (short >= 4 && len - short <= 2 && (expected.startsWith(said) || said.startsWith(expected))) return true;
  const tolerance = len >= 8 ? 2 : len >= 4 ? 1 : 0;
  if (lev(expected, said) <= tolerance) return true;
  return pe.length >= 4 && lev(pe, ps) <= (len >= 8 ? 2 : 1);
}

/** Mots qui inversent le sens d'une phrase. */
const NEG = new Set(['ne', 'n', 'pas', 'jamais', 'aucun', 'aucune', 'non', 'ni', 'sans', 'rien', 'nul', 'nulle']);

function negated(words: string[]): boolean {
  return words.some((w) => NEG.has(w));
}

export interface MatchResult {
  /** Mots attendus avec leur statut, dans l'ordre de la réponse. */
  words: { text: string; key: boolean; found: boolean }[];
  found: number;
  total: number;
  ratio: number;
  /** Suggestion de note. */
  grade: 'known' | 'partial' | 'missed';
  /** Une négation est présente d'un côté et pas de l'autre : le sens est peut-être inversé. */
  negation: boolean;
}

/** Mots « clés » attendus : sans les mots vides (sauf si la réponse n'est faite que de ça). */
function keywords(answer: string): string[] {
  const t = tokens(answer);
  const k = t.filter((w) => !STOP.has(w));
  return k.length ? k : t;
}

export function compare(answer: string, attempts: string[]): MatchResult {
  const keys = keywords(answer);
  let best: Set<string> = new Set();
  for (const attempt of attempts) {
    const said = tokens(attempt);
    // Chiffres dictés séparément (« 17 89 ») → aussi en bloc (« 1789 »).
    const joined = said.join(' ').replace(/(\d+) (?=\d)/g, '$1');
    const pool = [...said, ...tokens(joined)];
    const found = new Set(keys.filter((k) => pool.some((w) => same(k, w))));
    if (found.size > best.size) best = found;
  }
  const keySet = new Set(keys);
  // Découpe la réponse originale en mots affichables (garde la casse et les accents).
  const words = answer
    .split(/(\s+)/)
    .filter((w) => w.trim())
    .map((w) => {
      const norm = tokens(w);
      const key = norm.some((n) => keySet.has(n));
      return { text: w, key, found: key && norm.some((n) => best.has(n)) };
    });
  const total = keys.length || 1;
  const ratio = best.size / total;
  const expectedNeg = negated(tokens(answer));
  const negation = attempts.length > 0 && attempts.every((a) => negated(tokens(a)) !== expectedNeg);
  let grade: MatchResult['grade'] = ratio >= 0.8 ? 'known' : ratio >= 0.4 ? 'partial' : 'missed';
  // Les bons mots avec le sens inverse (« n'augmente pas ») ne valent pas « Su ».
  if (negation && grade === 'known') grade = 'partial';
  return { words, found: best.size, total, ratio, grade, negation };
}

/** Plusieurs éléments sur un même locus : chacun est noté séparément. */
export function compareParts(parts: string[], attempts: string[]): { results: MatchResult[]; found: number; grade: MatchResult['grade'] } {
  const results = parts.map((p) => compare(p, attempts));
  const found = results.filter((r) => r.grade === 'known').length;
  const partialish = results.filter((r) => r.grade !== 'missed').length;
  const grade: MatchResult['grade'] =
    found === parts.length ? 'known' : partialish >= Math.ceil(parts.length / 2) ? 'partial' : 'missed';
  return { results, found, grade };
}

export type RecallStatus = 'ok' | 'order' | 'missing';

/**
 * Rappel libre : la personne récite tout le palais d'un coup, sans indice.
 * On cherche chaque élément attendu dans la récitation, dans l'ordre :
 * « ok » = trouvé à sa place, « order » = trouvé mais pas dans l'ordre, « missing » = absent.
 */
export function freeRecall(expected: string[], said: string): RecallStatus[] {
  const pool = tokens(said);
  const used = new Set<number>();
  let cursor = 0;
  const find = (keys: string[], from: number): number => {
    // Position du premier mot-clé trouvé à partir de `from` (les autres doivent suivre de près).
    for (let i = from; i < pool.length; i++) {
      if (used.has(i) || !same(keys[0]!, pool[i]!)) continue;
      let ok = 1;
      let j = i + 1;
      for (const k of keys.slice(1)) {
        const hit = pool.slice(j, j + 4).findIndex((w, d) => !used.has(j + d) && same(k, w));
        if (hit >= 0) {
          ok++;
          j = j + hit + 1;
        }
      }
      if (ok / keys.length >= 0.6) return i;
    }
    return -1;
  };
  return expected.map((answer) => {
    const keys = keywords(answer);
    if (!keys.length) return 'missing';
    let at = find(keys, cursor);
    let status: RecallStatus = 'ok';
    if (at < 0) {
      at = find(keys, 0);
      status = 'order';
    }
    if (at < 0) return 'missing';
    for (let k = at; k < at + keys.length; k++) used.add(k);
    if (status === 'ok') cursor = at + 1;
    return status;
  });
}

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

export interface MatchResult {
  /** Mots attendus avec leur statut, dans l'ordre de la réponse. */
  words: { text: string; key: boolean; found: boolean }[];
  found: number;
  total: number;
  ratio: number;
  /** Suggestion de note. */
  grade: 'known' | 'partial' | 'missed';
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
  return {
    words,
    found: best.size,
    total,
    ratio,
    grade: ratio >= 0.8 ? 'known' : ratio >= 0.4 ? 'partial' : 'missed',
  };
}

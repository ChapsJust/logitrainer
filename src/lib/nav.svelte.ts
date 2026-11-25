export type QuizKind = 'trajet' | 'content' | 'numbers';
export type QuizOrder = 'forward' | 'backward' | 'random';

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'numbers' }
  | { name: 'settings' }
  | { name: 'place'; id: string }
  | { name: 'palace'; id: string; tab?: 'trajet' | 'contents'; focus?: string }
  | { name: 'content'; id: string; focus?: string }
  | { name: 'fill'; id: string; start?: number }
  | { name: 'numbers-create'; start: string }
  | { name: 'quiz'; kind: QuizKind; id?: string; order: QuizOrder; weakOnly?: boolean; session?: string[] }
  | { name: 'recall'; kind: 'trajet' | 'content'; id: string }
  | { name: 'lab' }
  | { name: 'lab-run'; palaceId: string; perLocus: number; seconds: number }
  | { name: 'lab-recall'; sessionId: string; delayed?: boolean }
  | { name: 'walk'; palaceId: string; contentId?: string };

export type Tab = 'home' | 'search' | 'numbers' | 'lab' | 'settings';

/** Sens de la dernière navigation, pour l'animation de transition. */
export type NavDir = 'forward' | 'back' | 'tab';

class Nav {
  stack: Route[] = $state([{ name: 'home' }]);
  dir: NavDir = $state('tab');
  /** Incrémenté à chaque changement d'écran (clé de transition). */
  version = $state(0);
  private scrolls: number[] = [];

  get current(): Route {
    return this.stack[this.stack.length - 1]!;
  }

  get tab(): Tab {
    return this.stack[0]!.name as Tab;
  }

  go(route: Route) {
    this.scrolls.push(window.scrollY);
    this.stack.push(route);
    this.dir = 'forward';
    this.version++;
    window.scrollTo(0, 0);
  }

  /** Remplace l'écran courant (ex. après une suppression). */
  replace(route: Route) {
    this.stack[this.stack.length - 1] = route;
    this.dir = 'forward';
    this.version++;
    window.scrollTo(0, 0);
  }

  switchTab(tab: Tab) {
    if (this.stack.length === 1 && this.tab === tab) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    this.scrolls = [];
    this.stack = [{ name: tab }];
    this.dir = 'tab';
    this.version++;
    window.scrollTo(0, 0);
  }

  /** Retourne true si on a pu reculer. */
  back(): boolean {
    if (this.stack.length > 1) {
      this.stack.pop();
      this.dir = 'back';
      this.version++;
      const y = this.scrolls.pop() ?? 0;
      requestAnimationFrame(() => window.scrollTo(0, y));
      return true;
    }
    if (this.tab !== 'home') {
      this.switchTab('home');
      return true;
    }
    return false;
  }
}

export const nav = new Nav();

/** Route d'un élément de la session « Tout réviser » (« c:<id> » contenu, « p:<id> » trajet). */
export function sessionRoute(key: string, rest: string[]): Route {
  const [k, id] = [key.slice(0, 1), key.slice(2)];
  return { name: 'quiz', kind: k === 'c' ? 'content' : 'trajet', id, order: 'forward', session: rest };
}

/**
 * Les fenêtres (feuilles, dialogues) s'enregistrent ici pour que le bouton
 * « retour » d'Android les ferme avant de changer d'écran.
 */
const overlays: (() => void)[] = [];

export function pushOverlay(close: () => void): () => void {
  overlays.push(close);
  return () => {
    const i = overlays.lastIndexOf(close);
    if (i >= 0) overlays.splice(i, 1);
  };
}

export function handleBack(): boolean {
  const close = overlays[overlays.length - 1];
  if (close) {
    close();
    return true;
  }
  return nav.back();
}

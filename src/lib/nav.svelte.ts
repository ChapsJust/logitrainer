export type QuizKind = 'trajet' | 'content' | 'numbers';
export type QuizOrder = 'forward' | 'backward' | 'random';

export type Route =
  | { name: 'home' }
  | { name: 'search' }
  | { name: 'numbers' }
  | { name: 'settings' }
  | { name: 'palace'; id: string; tab?: 'trajet' | 'contents' }
  | { name: 'content'; id: string }
  | { name: 'quiz'; kind: QuizKind; id?: string; order: QuizOrder };

export type Tab = 'home' | 'search' | 'numbers' | 'settings';

class Nav {
  stack: Route[] = $state([{ name: 'home' }]);

  get current(): Route {
    return this.stack[this.stack.length - 1]!;
  }

  get tab(): Tab {
    return this.stack[0]!.name as Tab;
  }

  go(route: Route) {
    this.stack.push(route);
    window.scrollTo(0, 0);
  }

  /** Remplace l'écran courant (ex. après une suppression). */
  replace(route: Route) {
    this.stack[this.stack.length - 1] = route;
  }

  switchTab(tab: Tab) {
    this.stack = [{ name: tab }];
    window.scrollTo(0, 0);
  }

  /** Retourne true si on a pu reculer. */
  back(): boolean {
    if (this.stack.length > 1) {
      this.stack.pop();
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

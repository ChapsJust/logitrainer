import type { UpdateInfo } from './update';
import { restore, snapshot } from './store.svelte';

interface Snack {
  id: number;
  message: string;
  action?: { label: string; run: () => void };
}

/** État global de l'interface (non sauvegardé). */
export const app = $state<{ update: UpdateInfo | null; snack: Snack | null }>({ update: null, snack: null });

let timer: ReturnType<typeof setTimeout> | undefined;
let counter = 0;

export function toast(message: string, action?: Snack['action'], ms = 3000): void {
  app.snack = { id: ++counter, message, action };
  clearTimeout(timer);
  timer = setTimeout(() => (app.snack = null), action ? Math.max(ms, 5000) : ms);
}

export function dismissSnack(): void {
  clearTimeout(timer);
  app.snack = null;
}

/** Exécute une suppression en proposant « Annuler » pendant quelques secondes. */
export function withUndo(message: string, fn: () => void): void {
  const snap = snapshot();
  fn();
  toast(message, {
    label: 'Annuler',
    run: () => restore(snap),
  });
}

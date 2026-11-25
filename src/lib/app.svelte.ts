import type { UpdateInfo } from './update';

/** État global de l'interface (non sauvegardé). */
export const app = $state<{ update: UpdateInfo | null; toast: string }>({ update: null, toast: '' });

let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(message: string): void {
  app.toast = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (app.toast = ''), 2500);
}

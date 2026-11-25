import { SystemBars, SystemBarsStyle } from '@capacitor/core';
import type { Theme } from './types';
import { isNative } from './util';

const media = window.matchMedia('(prefers-color-scheme: dark)');

function resolved(theme: Theme): 'light' | 'dark' {
  if (theme === 'auto') return media.matches ? 'dark' : 'light';
  return theme;
}

export function applyTheme(theme: Theme): void {
  const t = resolved(theme);
  document.documentElement.dataset.theme = t;
  const bg = t === 'dark' ? '#0f1513' : '#f5faf7';
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  if (isNative()) {
    // DARK = icônes claires (pour fond sombre), LIGHT = icônes foncées.
    SystemBars.setStyle({ style: t === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => {});
  }
}

export function onSystemThemeChange(cb: () => void): void {
  media.addEventListener('change', cb);
}

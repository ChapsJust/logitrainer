import { Browser } from '@capacitor/browser';
import { APP_VERSION, GITHUB_REPO } from './config';
import { compareVersions, isNative } from './util';

export interface UpdateInfo {
  version: string;
  notes: string;
  pageUrl: string;
  apkUrl?: string;
}

/** Interroge les Releases GitHub. Retourne l'info si une version plus récente existe. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  const res = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (res.status === 404) return null; // aucune release encore
  if (!res.ok) throw new Error(`GitHub a répondu ${res.status}`);
  const rel = (await res.json()) as {
    tag_name: string;
    body?: string;
    html_url: string;
    assets?: { name: string; browser_download_url: string }[];
  };
  if (compareVersions(rel.tag_name, APP_VERSION) <= 0) return null;
  return {
    version: rel.tag_name.replace(/^v/, ''),
    notes: rel.body ?? '',
    pageUrl: rel.html_url,
    apkUrl: rel.assets?.find((a) => a.name.endsWith('.apk'))?.browser_download_url,
  };
}

export async function openExternal(url: string): Promise<void> {
  if (isNative()) await Browser.open({ url });
  else window.open(url, '_blank', 'noopener');
}

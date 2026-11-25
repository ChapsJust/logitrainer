import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db } from './store.svelte';
import { isNative } from './util';

function fileName(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `logidex-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.json`;
}

/** Ouvre le menu de partage Android (Drive, courriel, Fichiers…) avec la sauvegarde. */
export async function exportBackup(): Promise<void> {
  const json = JSON.stringify(db, null, 2);
  const name = fileName();
  if (isNative()) {
    const { uri } = await Filesystem.writeFile({
      path: name,
      data: json,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title: 'Sauvegarde Logidex', files: [uri], dialogTitle: 'Enregistrer la sauvegarde' });
  } else {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  db.settings.lastExportAt = Date.now();
}

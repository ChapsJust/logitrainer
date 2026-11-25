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

const AUTO_DIR = 'Logidex';
const KEEP = 7;

function dayKey(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Sauvegarde automatique (une fois par jour) dans Documents/Logidex sur le téléphone.
 * Ces fichiers survivent à une désinstallation de l'app. On garde les 7 derniers.
 */
export async function autoBackup(force = false): Promise<void> {
  if (!isNative() || db.palaces.length === 0) return;
  const today = dayKey(Date.now());
  if (!force && db.settings.lastAutoBackupAt && dayKey(db.settings.lastAutoBackupAt) === today && !db.settings.autoBackupError) {
    return;
  }
  try {
    const perm = await Filesystem.checkPermissions();
    if (perm.publicStorage !== 'granted') {
      const req = await Filesystem.requestPermissions();
      if (req.publicStorage !== 'granted') throw new Error('permission refusée');
    }
    await Filesystem.writeFile({
      path: `${AUTO_DIR}/logidex-auto-${today}.json`,
      directory: Directory.Documents,
      data: JSON.stringify(db),
      encoding: Encoding.UTF8,
      recursive: true,
    });
    db.settings.lastAutoBackupAt = Date.now();
    db.settings.autoBackupError = undefined;
    // Ménage : on ne garde que les plus récentes.
    const { files } = await Filesystem.readdir({ path: AUTO_DIR, directory: Directory.Documents });
    const autos = files
      .map((f) => f.name)
      .filter((n) => n.startsWith('logidex-auto-'))
      .sort();
    for (const name of autos.slice(0, Math.max(0, autos.length - KEEP))) {
      await Filesystem.deleteFile({ path: `${AUTO_DIR}/${name}`, directory: Directory.Documents }).catch(() => {});
    }
  } catch (e) {
    db.settings.autoBackupError = (e as Error).message || 'erreur inconnue';
  }
}

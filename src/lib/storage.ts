import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { isNative } from './util';

const FILE = 'logidex.json';
const BACKUP = 'logidex.backup.json';
const LS_KEY = 'logidex';

/** Lit les données brutes (JSON) ou null si rien n'est encore sauvegardé. */
export async function readRaw(): Promise<string | null> {
  if (isNative()) {
    try {
      const res = await Filesystem.readFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8 });
      return typeof res.data === 'string' ? res.data : await res.data.text();
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(LS_KEY);
  } catch {
    return null;
  }
}

export async function writeRaw(json: string): Promise<void> {
  if (isNative()) {
    await Filesystem.writeFile({ path: FILE, directory: Directory.Data, encoding: Encoding.UTF8, data: json });
    return;
  }
  localStorage.setItem(LS_KEY, json);
}

/** Copie de sécurité au démarrage (une version en arrière). */
export async function writeStartupBackup(json: string): Promise<void> {
  try {
    if (isNative()) {
      await Filesystem.writeFile({ path: BACKUP, directory: Directory.Data, encoding: Encoding.UTF8, data: json });
    } else {
      localStorage.setItem(LS_KEY + '.backup', json);
    }
  } catch {
    // pas grave
  }
}

/** Copie de sécurité faite au dernier démarrage réussi. */
export async function readBackup(): Promise<string | null> {
  if (isNative()) {
    try {
      const res = await Filesystem.readFile({ path: BACKUP, directory: Directory.Data, encoding: Encoding.UTF8 });
      return typeof res.data === 'string' ? res.data : await res.data.text();
    } catch {
      return null;
    }
  }
  try {
    return localStorage.getItem(LS_KEY + '.backup');
  } catch {
    return null;
  }
}

/** Écrit une copie nommée (avant migration, fichier abîmé…). Ne lève jamais d'erreur. */
export async function writeNamed(name: string, json: string): Promise<void> {
  try {
    if (isNative()) {
      await Filesystem.writeFile({ path: name, directory: Directory.Data, encoding: Encoding.UTF8, data: json });
    } else {
      localStorage.setItem(`${LS_KEY}.${name}`, json);
    }
  } catch {
    // pas grave
  }
}

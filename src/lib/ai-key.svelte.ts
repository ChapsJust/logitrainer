import { Preferences } from '@capacitor/preferences';
import { SecureStorage } from '@aparajita/capacitor-secure-storage';

const KEY = 'anthropic_api_key';

/**
 * La clé API est chiffrée par le Keystore Android (AES-GCM), jamais dans les sauvegardes JSON,
 * et exclue de la sauvegarde automatique d'Android (voir res/xml/*backup*).
 */
export const aiState = $state<{ hasKey: boolean; loaded: boolean }>({ hasKey: false, loaded: false });

let prefixReady: Promise<void> | null = null;
function ready(): Promise<void> {
  prefixReady ??= SecureStorage.setKeyPrefix('logidex_').catch(() => {});
  return prefixReady;
}

export async function getAiKey(): Promise<string | null> {
  await ready();
  try {
    return await SecureStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export async function loadAiKey(): Promise<void> {
  try {
    // Ancienne version : la clé était dans les préférences simples → on la déplace.
    const old = await Preferences.get({ key: KEY });
    if (old.value) {
      await ready();
      await SecureStorage.setItem(KEY, old.value);
      await Preferences.remove({ key: KEY });
    }
    aiState.hasKey = !!(await getAiKey());
  } catch {
    aiState.hasKey = false;
  } finally {
    aiState.loaded = true;
  }
}

export async function saveAiKey(value: string): Promise<void> {
  await ready();
  const v = value.trim();
  if (v) await SecureStorage.setItem(KEY, v);
  else await SecureStorage.removeItem(KEY);
  aiState.hasKey = !!v;
}

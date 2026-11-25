import { Preferences } from '@capacitor/preferences';

const KEY = 'anthropic_api_key';

/** La clé API est gardée dans les préférences de l'app, jamais dans les sauvegardes JSON. */
export const aiState = $state<{ hasKey: boolean; loaded: boolean }>({ hasKey: false, loaded: false });

export async function loadAiKey(): Promise<void> {
  try {
    const { value } = await Preferences.get({ key: KEY });
    aiState.hasKey = !!value;
  } finally {
    aiState.loaded = true;
  }
}

export async function saveAiKey(value: string): Promise<void> {
  const v = value.trim();
  if (v) await Preferences.set({ key: KEY, value: v });
  else await Preferences.remove({ key: KEY });
  aiState.hasKey = !!v;
}

export async function getAiKey(): Promise<string | null> {
  const { value } = await Preferences.get({ key: KEY });
  return value;
}

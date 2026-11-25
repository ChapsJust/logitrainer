import { mount } from 'svelte';
import { App as CapApp } from '@capacitor/app';
import './app.css';
import App from './App.svelte';
import { load, db } from './lib/store.svelte';
import { handleBack } from './lib/nav.svelte';
import { checkForUpdate } from './lib/update';
import { autoBackup } from './lib/backup';
import { loadAiKey } from './lib/ai-key.svelte';
import { setupReminders, syncReminders } from './lib/reminders';
import { app } from './lib/app.svelte';
import { isNative } from './lib/util';

async function start() {
  await load();
  void loadAiKey();
  mount(App, { target: document.getElementById('app')! });

  if (isNative()) {
    // Bouton/geste « retour » d'Android : ferme la fenêtre ouverte, recule, ou quitte.
    CapApp.addListener('backButton', () => {
      if (!handleBack()) CapApp.exitApp();
    });
    // Sauvegarde auto quand l'app passe en arrière-plan (et au démarrage).
    CapApp.addListener('pause', () => {
      void autoBackup();
      void syncReminders();
    });
    setTimeout(() => void autoBackup(), 3000);
    void setupReminders().then(syncReminders);
  }

  // Vérifie les mises à jour au plus une fois par jour, en silence.
  const last = db.settings.lastUpdateCheckAt ?? 0;
  if (isNative() && Date.now() - last > 86_400_000) {
    checkForUpdate()
      .then((u) => {
        app.update = u;
        db.settings.lastUpdateCheckAt = Date.now();
      })
      .catch(() => {});
  }
}

start();

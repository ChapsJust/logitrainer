<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import { db, importData } from '../store.svelte';
  import { autoBackup, exportBackup } from '../backup';
  import { checkForUpdate, openExternal } from '../update';
  import { APP_VERSION, GITHUB_REPO } from '../config';
  import { app, toast } from '../app.svelte';
  import { formatDate, isNative, relativeDays } from '../util';
  import type { Theme } from '../types';

  const themes: { id: Theme; label: string }[] = [
    { id: 'auto', label: 'Auto' },
    { id: 'light', label: 'Clair' },
    { id: 'dark', label: 'Sombre' },
  ];

  let fileInput: HTMLInputElement | undefined = $state();
  let pendingImport = $state<string | null>(null);
  let confirmImport = $state(false);
  let checking = $state(false);
  let guideOpen = $state(false);
  const native = isNative();

  async function doExport() {
    try {
      await exportBackup();
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (!/cancel/i.test(msg)) toast('Export impossible : ' + msg);
    }
  }

  async function onFile(e: Event) {
    const inputEl = e.currentTarget as HTMLInputElement;
    const file = inputEl.files?.[0];
    inputEl.value = '';
    if (!file) return;
    pendingImport = await file.text();
    confirmImport = true;
  }

  function doImport() {
    if (!pendingImport) return;
    try {
      importData(pendingImport);
      toast('Sauvegarde importée');
    } catch (e) {
      toast((e as Error).message);
    }
    pendingImport = null;
  }

  async function check() {
    checking = true;
    try {
      app.update = await checkForUpdate();
      db.settings.lastUpdateCheckAt = Date.now();
      if (!app.update) toast('Tu as la dernière version');
    } catch (e) {
      toast('Vérification impossible : ' + (e as Error).message);
    } finally {
      checking = false;
    }
  }

  async function backupNow() {
    await autoBackup(true);
    toast(db.settings.autoBackupError ? 'Échec : ' + db.settings.autoBackupError : 'Sauvegarde faite dans Documents/Logidex');
  }
</script>

<TopBar title="Réglages" />

<div class="page">
  <h2 class="subheader">Apparence</h2>
  <div class="segmented" style="margin-top: 4px">
    {#each themes as t (t.id)}
      <button class:on={db.settings.theme === t.id} onclick={() => (db.settings.theme = t.id)}>
        {#if db.settings.theme === t.id}<Icon name="check" />{/if}{t.label}
      </button>
    {/each}
  </div>

  <h2 class="subheader">Sauvegarde</h2>
  {#if native}
    <button class="list-item two" onclick={backupNow}>
      <span class="num"><Icon name="shield" size={20} /></span>
      <span class="li-text">
        <span class="li-head">Sauvegarde automatique</span>
        <span class="li-sup" class:err={!!db.settings.autoBackupError}>
          {#if db.settings.autoBackupError}
            Échec : {db.settings.autoBackupError}
          {:else if db.settings.lastAutoBackupAt}
            Chaque jour dans Documents/Logidex · {relativeDays(db.settings.lastAutoBackupAt)}
          {:else}
            Chaque jour dans Documents/Logidex
          {/if}
        </span>
      </span>
      <Icon name="refresh" size={20} class="onv" />
    </button>
  {/if}
  <button class="list-item two" onclick={doExport}>
    <span class="num"><Icon name="upload" size={20} /></span>
    <span class="li-text">
      <span class="li-head">Exporter une copie</span>
      <span class="li-sup">
        Google Drive, courriel…{db.settings.lastExportAt ? ' · dernier export ' + formatDate(db.settings.lastExportAt) : ''}
      </span>
    </span>
  </button>
  <button class="list-item two" onclick={() => fileInput?.click()}>
    <span class="num"><Icon name="download" size={20} /></span>
    <span class="li-text">
      <span class="li-head">Importer une sauvegarde</span>
      <span class="li-sup">Remplace les données actuelles</span>
    </span>
  </button>
  <input bind:this={fileInput} type="file" hidden onchange={onFile} />

  <h2 class="subheader">Mises à jour</h2>
  {#if app.update}
    <div class="card-tonal update">
      <p class="title-m">Version {app.update.version} disponible</p>
      {#if app.update.notes}<p class="body-m notes">{app.update.notes}</p>{/if}
      <div class="row" style="margin-top: 8px">
        <button class="btn filled has-icon" onclick={() => app.update && openExternal(app.update.apkUrl ?? app.update.pageUrl)}>
          <Icon name="download" size={18} />Télécharger
        </button>
      </div>
      <p class="body-m" style="opacity: 0.8; margin-top: 8px">Ouvre le fichier pour l'installer. Tes données sont conservées.</p>
    </div>
  {/if}
  <button class="list-item two" onclick={check} disabled={checking}>
    <span class="num"><Icon name="refresh" size={20} /></span>
    <span class="li-text">
      <span class="li-head">{checking ? 'Vérification…' : 'Vérifier les mises à jour'}</span>
      <span class="li-sup">Version installée : {APP_VERSION}</span>
    </span>
  </button>
  <button class="list-item" onclick={() => openExternal(`https://github.com/${GITHUB_REPO}/releases`)}>
    <span class="num"><Icon name="layers" size={20} /></span>
    <span class="li-text"><span class="li-head">Historique des versions</span></span>
  </button>

  <h2 class="subheader">Aide</h2>
  <button class="list-item two" onclick={() => (guideOpen = true)}>
    <span class="num"><Icon name="book" size={20} /></span>
    <span class="li-text">
      <span class="li-head">La méthode des loci</span>
      <span class="li-sup">Les bases en 5 étapes</span>
    </span>
  </button>

  <p class="label-m onv footer">Logidex {APP_VERSION} · données stockées sur ce téléphone</p>
</div>

<Sheet bind:open={guideOpen} title="La méthode des loci">
  <ol class="guide body-m">
    <li><b>Choisis un lieu que tu connais par cœur</b> : ta maison, ton école, un trajet quotidien.</li>
    <li><b>Définis un trajet fixe</b> avec des endroits distincts (les loci), toujours dans le même ordre. 10 à 20 loci, c'est un bon début.</li>
    <li><b>Dépose une image par locus</b>, qui interagit avec l'endroit : exagérée, en mouvement, avec des sons ou des odeurs.</li>
    <li><b>Repasse le trajet</b> peu après, puis le lendemain, puis la semaine suivante. Logidex te dit quand.</li>
    <li><b>Réutilise tes palais</b> avec modération : laisse passer du temps entre deux contenus pour éviter qu'ils se mélangent.</li>
  </ol>
</Sheet>

<Dialog
  bind:open={confirmImport}
  icon="download"
  title="Remplacer tes données ?"
  message="L'import remplace tous tes palais, contenus et nombres par ceux du fichier. Exporte d'abord si tu veux garder une copie."
  confirmLabel="Importer"
  onconfirm={doImport}
/>

<style>
  .err {
    color: var(--error);
  }

  .update {
    margin: 4px 16px 8px;
  }

  .notes {
    white-space: pre-wrap;
    max-height: 140px;
    overflow: auto;
    margin-top: 4px;
  }

  .guide {
    margin: 0;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .footer {
    text-align: center;
    padding: 32px 16px 0;
  }
</style>

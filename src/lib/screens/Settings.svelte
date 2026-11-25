<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Confirm from '../components/Confirm.svelte';
  import { db, importData } from '../store.svelte';
  import { exportBackup } from '../backup';
  import { checkForUpdate, openExternal } from '../update';
  import { APP_VERSION, GITHUB_REPO } from '../config';
  import { app, toast } from '../app.svelte';
  import { formatDate } from '../util';
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
  let upToDate = $state(false);

  async function doExport() {
    try {
      await exportBackup();
    } catch (e) {
      const msg = (e as Error).message ?? '';
      if (!/cancel/i.test(msg)) toast('Export impossible : ' + msg);
    }
  }

  async function onFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    pendingImport = await file.text();
    confirmImport = true;
  }

  function doImport() {
    if (!pendingImport) return;
    try {
      importData(pendingImport);
      toast('Sauvegarde importée ✓');
    } catch (e) {
      toast((e as Error).message);
    }
    pendingImport = null;
  }

  async function check() {
    checking = true;
    upToDate = false;
    try {
      app.update = await checkForUpdate();
      upToDate = !app.update;
      db.settings.lastUpdateCheckAt = Date.now();
    } catch (e) {
      toast('Vérification impossible : ' + (e as Error).message);
    } finally {
      checking = false;
    }
  }
</script>

<TopBar title="Réglages" />

<div class="page">
  <p class="section-title">Apparence</p>
  <div class="seg">
    {#each themes as t (t.id)}
      <button class:on={db.settings.theme === t.id} onclick={() => (db.settings.theme = t.id)}>{t.label}</button>
    {/each}
  </div>

  <p class="section-title">Sauvegarde</p>
  <div class="card box">
    <p class="small muted">
      Tes données sont uniquement sur ce téléphone. Exporte régulièrement un fichier (Google Drive, courriel…) pour ne rien
      perdre si tu changes de cell.
      {#if db.settings.lastExportAt}<br />Dernier export : <b>{formatDate(db.settings.lastExportAt)}</b>{/if}
    </p>
    <div class="row">
      <button class="btn primary grow" onclick={doExport}>💾 Exporter</button>
      <button class="btn grow" onclick={() => fileInput?.click()}>📂 Importer</button>
    </div>
    <input bind:this={fileInput} type="file" hidden onchange={onFile} />
  </div>

  <p class="section-title">Mises à jour</p>
  <div class="card box">
    <p class="small">Version installée : <b>{APP_VERSION}</b></p>
    {#if app.update}
      <div class="update">
        <b>🎉 Version {app.update.version} disponible</b>
        {#if app.update.notes}<p class="small notes">{app.update.notes}</p>{/if}
        <button class="btn primary block" onclick={() => app.update && openExternal(app.update.apkUrl ?? app.update.pageUrl)}>
          Télécharger l'APK
        </button>
        <p class="muted small">
          Ouvre le fichier téléchargé pour installer. Tes données sont conservées. Avec Obtainium, c'est automatique.
        </p>
      </div>
    {:else}
      <button class="btn block" onclick={check} disabled={checking}>
        {checking ? 'Vérification…' : 'Vérifier les mises à jour'}
      </button>
      {#if upToDate}<p class="small" style="color: var(--good)">✓ Tu as la dernière version.</p>{/if}
    {/if}
    <button class="btn ghost block" onclick={() => openExternal(`https://github.com/${GITHUB_REPO}/releases`)}>
      Voir toutes les versions
    </button>
  </div>

  <p class="section-title">La méthode des loci en bref</p>
  <div class="card box guide">
    <p><b>1. Choisis un lieu que tu connais par cœur</b> — ta maison, ton école, un trajet quotidien.</p>
    <p>
      <b>2. Définis un trajet fixe</b> avec des endroits précis et distincts (les loci), toujours dans le même ordre. 10 à 20
      loci par palais, c'est un bon début.
    </p>
    <p>
      <b>3. Dépose une image par locus</b> : exagérée, absurde, en mouvement, avec des sons ou des odeurs. Plus c'est bizarre,
      mieux ça colle.
    </p>
    <p><b>4. Repasse le trajet dans ta tête</b> : quelques minutes après, puis le lendemain, puis la semaine suivante.</p>
    <p>
      <b>5. Réutilise tes palais</b> : un même trajet peut servir à plusieurs contenus. Laisse passer un peu de temps entre
      deux contenus pour éviter qu'ils se mélangent.
    </p>
  </div>

  <p class="muted small footer">Logidex {APP_VERSION} · données stockées localement</p>
</div>

<Confirm
  bind:open={confirmImport}
  title="Remplacer tes données ?"
  message="L'import remplace tous tes palais, contenus et nombres actuels par ceux du fichier. Exporte d'abord si tu veux garder une copie."
  confirmLabel="Importer"
  onconfirm={doImport}
/>

<style>
  .box {
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .update {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px;
    border-radius: 12px;
    background: var(--accent-soft);
  }

  .notes {
    white-space: pre-wrap;
    max-height: 160px;
    overflow: auto;
  }

  .guide p {
    font-size: 0.95rem;
  }

  .footer {
    text-align: center;
    margin-top: 24px;
  }
</style>

<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import EmojiPicker from '../components/EmojiPicker.svelte';
  import { contentsOf, createPalace, createSample, db } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { lociCount, plural, relativeDays } from '../util';
  import { app } from '../app.svelte';

  let creating = $state(false);
  let name = $state('');
  let emoji = $state('🏠');

  const palaces = $derived([...db.palaces].sort((a, b) => b.updatedAt - a.updatedAt));

  const needsBackup = $derived(
    db.palaces.length > 0 && (!db.settings.lastExportAt || Date.now() - db.settings.lastExportAt > 14 * 86_400_000),
  );

  function create() {
    const p = createPalace(name, emoji);
    creating = false;
    name = '';
    nav.go({ name: 'palace', id: p.id });
  }

  function sample() {
    const p = createSample();
    nav.go({ name: 'palace', id: p.id });
  }
</script>

<TopBar title="Logidex" subtitle={plural(db.palaces.length, 'palais mental', 'palais mentaux')} />

<div class="page">
  {#if app.update}
    <button class="banner update" onclick={() => nav.switchTab('settings')}>
      🎉 <b>Version {app.update.version} disponible</b> — touche pour l'installer
    </button>
  {/if}

  {#if needsBackup}
    <button class="banner" onclick={() => nav.switchTab('settings')}>
      💾 Pense à faire une sauvegarde de tes palais (Réglages → Exporter).
    </button>
  {/if}

  {#if palaces.length === 0}
    <div class="empty card">
      <div class="big">🏛️</div>
      <h2>Bienvenue dans ton Logidex</h2>
      <p class="muted" style="margin: 10px 0 20px">
        Un <b>palais mental</b>, c'est un trajet que tu connais par cœur (ta maison, ton chemin pour aller au travail…).
        Chaque endroit précis sur ce trajet est un <b>locus</b>. Tu y déposes des images pour retenir des choses, dans
        l'ordre.
      </p>
      <div class="stack">
        <button class="btn primary block" onclick={() => (creating = true)}>Créer mon premier palais</button>
        <button class="btn block" onclick={sample}>Voir un exemple</button>
      </div>
    </div>
  {:else}
    <div class="stack">
      {#each palaces as p (p.id)}
        {@const nLoci = lociCount(p)}
        {@const nContents = contentsOf(p.id).length}
        <button class="card palace" onclick={() => nav.go({ name: 'palace', id: p.id })}>
          <span class="emoji">{p.emoji}</span>
          <span class="grow info">
            <span class="name ellipsis">{p.name}</span>
            <span class="muted small">
              {plural(nLoci, 'locus', 'loci')}
              · {plural(p.rooms.filter((r) => r.name).length, 'pièce', 'pièces')}
              · {plural(nContents, 'contenu', 'contenus')}
            </span>
            {#if p.lastQuiz}
              <span class="muted small">Testé {relativeDays(p.lastQuiz.at)} · {p.lastQuiz.score}/{p.lastQuiz.total}</span>
            {/if}
          </span>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="muted"><path d="M9 6l6 6-6 6" /></svg>
        </button>
      {/each}
    </div>
  {/if}
</div>

{#if palaces.length > 0}
  <button class="fab" onclick={() => (creating = true)}>
    <span style="font-size:1.4rem;line-height:1">＋</span> Palais
  </button>
{/if}

<Sheet bind:open={creating} title="Nouveau palais">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      create();
    }}
  >
    <label class="field">
      <span>Nom du lieu</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input class="input" bind:value={name} placeholder="Ex : Maison de mes parents" autofocus enterkeyhint="done" />
    </label>
    <div class="field">
      <span>Icône</span>
      <EmojiPicker bind:value={emoji} />
    </div>
    <button class="btn primary block" type="submit">Créer</button>
  </form>
</Sheet>

<style>
  .palace {
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 14px 14px 14px 16px;
    text-align: left;
    width: 100%;
  }

  .palace:active {
    transform: scale(0.99);
  }

  .emoji {
    font-size: 2rem;
    width: 52px;
    height: 52px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--surface-2);
    border-radius: 14px;
    flex-shrink: 0;
  }

  .info {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .name {
    font-weight: 700;
    font-size: 1.05rem;
  }

  .banner {
    display: block;
    width: 100%;
    text-align: left;
  }

  .banner.update {
    background: var(--accent-soft);
  }
</style>

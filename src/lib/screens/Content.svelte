<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Confirm from '../components/Confirm.svelte';
  import QuizStart from '../components/QuizStart.svelte';
  import { deleteContent, filledCount, getContent, getPalace, pasteList, setItem, touch } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { flatLoci } from '../util';
  import { toast } from '../app.svelte';

  let { id }: { id: string } = $props();

  const content = $derived(getContent(id));
  const palace = $derived(content ? getPalace(content.palaceId) : undefined);
  const flat = $derived(palace ? flatLoci(palace) : []);
  const showRooms = $derived(!!palace && (palace.rooms.length > 1 || !!palace.rooms[0]?.name));

  let hide = $state(false);
  let revealed = $state<Record<string, boolean>>({});

  let editInfo = $state(false);
  let confirmDelete = $state(false);
  let quizOpen = $state(false);

  // Édition d'un élément
  let editIndex = $state(-1);
  let editOpen = $state(false);
  let draftText = $state('');
  let draftImage = $state('');
  const editing = $derived(flat[editIndex]);

  // Coller une liste
  let pasteOpen = $state(false);
  let pasteText = $state('');
  let pasteStart = $state(1);
  const pasteLines = $derived(
    pasteText
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\d+[.)-]\s*/, '').trim())
      .filter(Boolean),
  );

  function openItem(i: number) {
    const f = flat[i];
    if (!f || !content) return;
    editIndex = i;
    draftText = content.items[f.locus.id]?.text ?? '';
    draftImage = content.items[f.locus.id]?.image ?? '';
    editOpen = true;
  }

  function commit() {
    const f = flat[editIndex];
    if (f && content) {
      const prev = content.items[f.locus.id];
      if ((prev?.text ?? '') !== draftText.trim() || (prev?.image ?? '') !== draftImage.trim()) {
        setItem(content, f.locus.id, { text: draftText, image: draftImage });
      }
    }
  }

  function go(delta: number) {
    commit();
    const next = editIndex + delta;
    if (next < 0 || next >= flat.length) {
      editOpen = false;
      return;
    }
    openItem(next);
  }

  function tapRow(i: number, locusId: string) {
    if (hide && !revealed[locusId]) {
      revealed[locusId] = true;
      return;
    }
    openItem(i);
  }

  function doPaste() {
    if (!content || !palace) return;
    const overflow = pasteList(content, palace, pasteLines, pasteStart);
    pasteOpen = false;
    pasteText = '';
    toast(
      overflow > 0
        ? `${pasteLines.length - overflow} placés · ${overflow} sans locus (ajoute des loci)`
        : `${pasteLines.length} éléments placés`,
    );
  }

  function firstEmpty(): number {
    if (!content) return 1;
    const i = flat.findIndex((f) => !content.items[f.locus.id]?.text);
    return i < 0 ? 1 : i + 1;
  }
</script>

{#if content && palace}
  <TopBar back title={content.title} subtitle={`${palace.emoji} ${palace.name} · ${filledCount(content, palace)}/${flat.length}`}>
    {#snippet actions()}
      <button class="icon-btn" onclick={() => (editInfo = true)} aria-label="Modifier le contenu">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
      </button>
    {/snippet}
  </TopBar>

  <div class="page no-nav">
    {#if content.notes}
      <p class="muted notes">{content.notes}</p>
    {/if}

    {#if flat.length === 0}
      <div class="empty card">
        <div class="big">🚪</div>
        <p class="muted" style="margin-bottom: 16px">Ce palais n'a pas encore de loci. Ajoute d'abord des endroits au trajet.</p>
        <button class="btn primary" onclick={() => nav.replace({ name: 'palace', id: palace.id, tab: 'trajet' })}>
          Aller au trajet
        </button>
      </div>
    {:else}
      <div class="row tools">
        <button class="btn ghost" onclick={() => ((hide = !hide), (revealed = {}))}>
          {hide ? '👁 Tout montrer' : '🙈 Cacher'}
        </button>
        <button
          class="btn ghost"
          onclick={() => {
            pasteStart = firstEmpty();
            pasteOpen = true;
          }}>📋 Coller</button
        >
        <span class="grow"></span>
        <button class="btn ghost" onclick={() => (quizOpen = true)} disabled={filledCount(content, palace) === 0}>▶ Tester</button>
      </div>

      {#if hide}
        <p class="muted small hint">Touche une ligne pour révéler ce qui y est déposé.</p>
      {/if}

      <div class="card list">
        {#each flat as f, i (f.locus.id)}
          {@const item = content.items[f.locus.id]}
          {#if showRooms && (i === 0 || flat[i - 1]?.room.id !== f.room.id)}
            <div class="room">{f.room.name || 'Pièce sans nom'}</div>
          {/if}
          <button class="item" onclick={() => tapRow(i, f.locus.id)}>
            <span class="badge">{f.n}</span>
            <span class="grow text">
              <span class="muted small ellipsis">{f.locus.name}</span>
              {#if item?.text}
                {#if hide && !revealed[f.locus.id]}
                  <span class="hidden">• • •</span>
                {:else}
                  <span class="value">{item.text}</span>
                  {#if item.image}<span class="image small">🖼️ {item.image}</span>{/if}
                {/if}
              {:else}
                <span class="muted empty-slot">Vide — touche pour ajouter</span>
              {/if}
            </span>
          </button>
        {/each}
      </div>
    {/if}
  </div>

  <!-- Élément -->
  <Sheet bind:open={editOpen} title={editing ? `n° ${editing.n} · ${editing.locus.name}` : ''} onclose={commit}>
    {#if editing}
      {#if editing.locus.description}
        <p class="muted small" style="margin-bottom: 12px">📍 {editing.locus.description}</p>
      {/if}
      <label class="field">
        <span>À retenir</span>
        <textarea class="input" bind:value={draftText} placeholder="Ex : Lait" rows="2"></textarea>
      </label>
      <label class="field">
        <span>Image mentale (facultatif)</span>
        <textarea class="input" bind:value={draftImage} placeholder="Ex : une vache défonce la porte" rows="2"></textarea>
      </label>
    {/if}
    {#snippet footer()}
      <button class="btn" disabled={editIndex <= 0} onclick={() => go(-1)} aria-label="Précédent">←</button>
      <button class="btn primary grow" onclick={() => go(1)}>
        {editIndex >= flat.length - 1 ? 'Terminer' : 'Suivant →'}
      </button>
    {/snippet}
  </Sheet>

  <!-- Coller une liste -->
  <Sheet bind:open={pasteOpen} title="Coller une liste">
    <p class="muted small" style="margin-bottom: 12px">
      Une ligne = un élément. Chaque ligne est placée sur le locus suivant. Les numéros au début des lignes (« 1. », « 2) »)
      sont retirés.
    </p>
    <label class="field">
      <span>Liste</span>
      <textarea class="input" bind:value={pasteText} rows="7" placeholder={'Lait\nBananes\nŒufs'}></textarea>
    </label>
    <label class="field">
      <span>Commencer au locus n°</span>
      <input class="input" type="number" min="1" max={flat.length} bind:value={pasteStart} />
    </label>
    {#if pasteLines.length > 0}
      <p class="small muted">
        {pasteLines.length} ligne(s) → loci {pasteStart} à {pasteStart + pasteLines.length - 1}
        {#if pasteStart + pasteLines.length - 1 > flat.length}
          <br /><b style="color: var(--bad)">Il manque {pasteStart + pasteLines.length - 1 - flat.length} loci dans ce palais.</b>
        {/if}
      </p>
    {/if}
    {#snippet footer()}
      <button class="btn primary grow" disabled={pasteLines.length === 0} onclick={doPaste}>Placer</button>
    {/snippet}
  </Sheet>

  <!-- Infos -->
  <Sheet bind:open={editInfo} title="Modifier le contenu" onclose={() => touch(content)}>
    <label class="field">
      <span>Titre</span>
      <input class="input" bind:value={content.title} />
    </label>
    <label class="field">
      <span>Notes (facultatif)</span>
      <textarea class="input" bind:value={content.notes} placeholder="Ex : source, contexte, date d'apprentissage…"></textarea>
    </label>
    {#snippet footer()}
      <button class="btn danger" onclick={() => (confirmDelete = true)}>Supprimer</button>
      <button class="btn primary grow" onclick={() => (editInfo = false)}>OK</button>
    {/snippet}
  </Sheet>

  <Confirm
    bind:open={confirmDelete}
    title="Supprimer ce contenu ?"
    message={`« ${content.title} » sera retiré du palais. Le trajet (les loci) ne change pas.`}
    onconfirm={() => {
      editInfo = false;
      deleteContent(content.id);
      nav.back();
    }}
  />

  <QuizStart
    bind:open={quizOpen}
    kind="content"
    id={content.id}
    explain="On te montre le locus, tu essaies de retrouver ce que tu y as déposé, puis tu révèles la réponse."
  />
{/if}

<style>
  .notes {
    margin: 0 4px 8px;
  }

  .tools {
    margin: 4px 0 8px;
    gap: 0;
    flex-wrap: wrap;
  }

  .tools .btn {
    padding: 0 12px;
  }

  .hint {
    margin: 0 4px 8px;
  }

  .list {
    overflow: hidden;
  }

  .room {
    padding: 10px 14px 6px;
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
    background: var(--surface-2);
  }

  .item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px;
    width: 100%;
    text-align: left;
    border-bottom: 1px solid var(--border);
  }

  .item:active {
    background: var(--surface-2);
  }

  .text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .value {
    font-weight: 600;
    font-size: 1.05rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .image {
    font-style: italic;
    color: var(--muted);
    white-space: pre-wrap;
  }

  .hidden {
    color: var(--accent);
    font-weight: 700;
    letter-spacing: 0.2em;
  }

  .empty-slot {
    font-style: italic;
  }
</style>

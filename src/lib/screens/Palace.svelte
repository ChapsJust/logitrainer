<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Confirm from '../components/Confirm.svelte';
  import EmojiPicker from '../components/EmojiPicker.svelte';
  import QuizStart from '../components/QuizStart.svelte';
  import {
    addLocus,
    addRoom,
    contentsOf,
    createContent,
    deleteLocus,
    deletePalace,
    deleteRoom,
    filledCount,
    getPalace,
    moveLocus,
    moveLocusToRoom,
    moveRoom,
    touch,
  } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { flatLoci, lociCount, plural, relativeDays } from '../util';
  import { toast } from '../app.svelte';
  import type { Locus, Room } from '../types';

  let { id, tab: initialTab = 'trajet' }: { id: string; tab?: 'trajet' | 'contents' } = $props();

  const palace = $derived(getPalace(id));
  // svelte-ignore state_referenced_locally
  let tab = $state(initialTab);
  let reorder = $state(false);

  function setTab(t: 'trajet' | 'contents') {
    tab = t;
    // Mémorise l'onglet dans la route pour le retrouver en revenant en arrière.
    const r = nav.current;
    if (r.name === 'palace') r.tab = t;
  }

  // Feuilles
  let editPalace = $state(false);
  let confirmDeletePalace = $state(false);
  let quizOpen = $state(false);
  let newContentOpen = $state(false);
  let newContentTitle = $state('');
  let roomSheet = $state<Room | null>(null);
  let roomSheetOpen = $state(false);
  let confirmDeleteRoom = $state(false);
  let locusSheet = $state<Locus | null>(null);
  let locusSheetOpen = $state(false);
  let confirmDeleteLocus = $state(false);
  let newRoomOpen = $state(false);
  let newRoomName = $state('');

  // Saisie rapide d'un locus par pièce
  let drafts = $state<Record<string, string>>({});

  const flat = $derived(palace ? flatLoci(palace) : []);
  const numberOf = $derived(new Map(flat.map((f) => [f.locus.id, f.n])));
  const contents = $derived(palace ? contentsOf(palace.id) : []);
  const showRoomHeaders = $derived(!!palace && (palace.rooms.length > 1 || !!palace.rooms[0]?.name));

  function quickAdd(room: Room) {
    if (!palace) return;
    const text = (drafts[room.id] ?? '').trim();
    if (!text) return;
    addLocus(palace, room, text);
    drafts[room.id] = '';
  }

  function onPaste(e: ClipboardEvent, room: Room) {
    if (!palace) return;
    const text = e.clipboardData?.getData('text') ?? '';
    const lines = text
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    for (const l of lines) addLocus(palace, room, l);
    toast(`${lines.length} loci ajoutés`);
  }

  function openLocus(l: Locus) {
    locusSheet = l;
    locusSheetOpen = true;
  }

  function openRoom(r: Room) {
    roomSheet = r;
    roomSheetOpen = true;
  }

  function roomOf(locusId: string): Room | undefined {
    return palace?.rooms.find((r) => r.loci.some((l) => l.id === locusId));
  }

  function createNewContent() {
    if (!palace) return;
    const c = createContent(palace.id, newContentTitle);
    newContentOpen = false;
    newContentTitle = '';
    nav.go({ name: 'content', id: c.id });
  }

  function addNewRoom() {
    if (!palace) return;
    // Si le palais n'a qu'une pièce vide sans nom, on la renomme plutôt.
    const only = palace.rooms[0];
    if (palace.rooms.length === 1 && only && !only.name && only.loci.length === 0) {
      only.name = newRoomName.trim() || 'Pièce 1';
    } else {
      if (palace.rooms.length === 1 && only && !only.name) only.name = 'Pièce 1';
      addRoom(palace, newRoomName.trim() || `Pièce ${palace.rooms.length + 1}`);
    }
    newRoomOpen = false;
    newRoomName = '';
  }
</script>

{#if palace}
  <TopBar back title={`${palace.emoji} ${palace.name}`} subtitle={plural(lociCount(palace), 'locus', 'loci')}>
    {#snippet actions()}
      <button class="icon-btn" onclick={() => (editPalace = true)} aria-label="Modifier le palais">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" /></svg>
      </button>
    {/snippet}
  </TopBar>

  <div class="page no-nav">
    {#if palace.description}
      <p class="muted desc">{palace.description}</p>
    {/if}

    <div class="seg" role="tablist">
      <button role="tab" class:on={tab === 'trajet'} aria-selected={tab === 'trajet'} onclick={() => setTab('trajet')}>
        Trajet
      </button>
      <button role="tab" class:on={tab === 'contents'} aria-selected={tab === 'contents'} onclick={() => setTab('contents')}>
        Contenus ({contents.length})
      </button>
    </div>

    {#if tab === 'trajet'}
      <div class="row tools">
        <button class="btn ghost" onclick={() => (reorder = !reorder)}>
          {reorder ? '✓ Terminé' : '↕ Réorganiser'}
        </button>
        <span class="grow"></span>
        <button class="btn ghost" onclick={() => (quizOpen = true)} disabled={flat.length === 0}>▶ Tester</button>
      </div>

      {#each palace.rooms as room, ri (room.id)}
        <section class="room">
          {#if showRoomHeaders}
            <div class="room-head">
              <button class="grow room-name" onclick={() => openRoom(room)}>
                <span class="ellipsis">{room.name || 'Pièce sans nom'}</span>
                <span class="muted small">{room.loci.length}</span>
              </button>
              {#if reorder}
                <button class="icon-btn" disabled={ri === 0} onclick={() => moveRoom(palace, room.id, -1)} aria-label="Monter la pièce">↑</button>
                <button class="icon-btn" disabled={ri === palace.rooms.length - 1} onclick={() => moveRoom(palace, room.id, 1)} aria-label="Descendre la pièce">↓</button>
              {/if}
            </div>
          {/if}

          <div class="card list">
            {#each room.loci as locus (locus.id)}
              {@const n = numberOf.get(locus.id) ?? 0}
              <div class="locus">
                <button class="grow locus-main" onclick={() => openLocus(locus)}>
                  <span class="badge">{n}</span>
                  <span class="grow locus-text">
                    <span class="ellipsis">{locus.name || 'Sans nom'}</span>
                    {#if locus.description}<span class="muted small ellipsis">{locus.description}</span>{/if}
                  </span>
                </button>
                {#if reorder}
                  <button class="icon-btn" disabled={n === 1} onclick={() => moveLocus(palace, locus.id, -1)} aria-label="Monter">↑</button>
                  <button class="icon-btn" disabled={n === flat.length} onclick={() => moveLocus(palace, locus.id, 1)} aria-label="Descendre">↓</button>
                {/if}
              </div>
            {/each}

            {#if !reorder}
              <form
                class="add"
                onsubmit={(e) => {
                  e.preventDefault();
                  quickAdd(room);
                }}
              >
                <span class="badge add-badge">+</span>
                <input
                  class="grow add-input"
                  placeholder="Ajouter un locus…"
                  bind:value={drafts[room.id]}
                  onpaste={(e) => onPaste(e, room)}
                  enterkeyhint="next"
                />
                {#if drafts[room.id]?.trim()}
                  <button class="btn primary small-btn" type="submit">OK</button>
                {/if}
              </form>
            {/if}
          </div>
        </section>
      {/each}

      <button class="btn block add-room" onclick={() => (newRoomOpen = true)}>＋ Ajouter une pièce</button>

      {#if flat.length === 0}
        <p class="muted small hint">
          💡 Astuce : écris le nom d'un endroit et appuie sur Entrée pour enchaîner. Tu peux aussi coller une liste (une
          ligne = un locus).
        </p>
      {/if}
    {:else}
      <div class="row tools">
        <p class="muted small grow">Ce que tu as déposé dans ce palais.</p>
      </div>
      <div class="stack">
        {#each contents as c (c.id)}
          {@const filled = filledCount(c, palace)}
          <button class="card content" onclick={() => nav.go({ name: 'content', id: c.id })}>
            <span class="row">
              <b class="grow ellipsis">{c.title}</b>
              <span class="muted small">{filled}/{flat.length}</span>
            </span>
            <span class="bar"><span style:width={`${flat.length ? (filled / flat.length) * 100 : 0}%`}></span></span>
            {#if c.lastQuiz}
              <span class="muted small">Testé {relativeDays(c.lastQuiz.at)} · {c.lastQuiz.score}/{c.lastQuiz.total}</span>
            {/if}
          </button>
        {:else}
          <div class="empty card">
            <div class="big">📦</div>
            <p class="muted">
              Un contenu, c'est ce que tu retiens grâce à ce palais : une liste, un discours, des dates… Chaque élément est
              placé sur un locus.
            </p>
          </div>
        {/each}
        <button class="btn primary block" onclick={() => (newContentOpen = true)}>＋ Nouveau contenu</button>
      </div>
    {/if}
  </div>

  <!-- Modifier le palais -->
  <Sheet bind:open={editPalace} title="Modifier le palais" onclose={() => touch(palace)}>
    <label class="field">
      <span>Nom</span>
      <input class="input" bind:value={palace.name} />
    </label>
    <label class="field">
      <span>Description (facultatif)</span>
      <textarea class="input" bind:value={palace.description} placeholder="Ex : l'appart de la rue Saint-Denis, 2015-2019"></textarea>
    </label>
    <div class="field">
      <span>Icône</span>
      <EmojiPicker bind:value={palace.emoji} />
    </div>
    {#snippet footer()}
      <button class="btn danger" onclick={() => (confirmDeletePalace = true)}>Supprimer</button>
      <button class="btn primary grow" onclick={() => (editPalace = false)}>OK</button>
    {/snippet}
  </Sheet>

  <Confirm
    bind:open={confirmDeletePalace}
    title="Supprimer ce palais ?"
    message={`« ${palace.name} » et ses ${contents.length} contenu(s) seront supprimés définitivement.`}
    onconfirm={() => {
      editPalace = false;
      deletePalace(palace.id);
      nav.back();
    }}
  />

  <!-- Pièce -->
  <Sheet bind:open={roomSheetOpen} title="Pièce" onclose={() => touch(palace)}>
    {#if roomSheet}
      {@const ri = palace.rooms.indexOf(roomSheet)}
      <label class="field">
        <span>Nom de la pièce</span>
        <input class="input" bind:value={roomSheet.name} placeholder="Ex : Cuisine" />
      </label>
      <div class="row">
        <button class="btn grow" disabled={ri <= 0} onclick={() => roomSheet && moveRoom(palace, roomSheet.id, -1)}>↑ Monter</button>
        <button class="btn grow" disabled={ri >= palace.rooms.length - 1} onclick={() => roomSheet && moveRoom(palace, roomSheet.id, 1)}>↓ Descendre</button>
      </div>
    {/if}
    {#snippet footer()}
      <button class="btn danger" onclick={() => (confirmDeleteRoom = true)}>Supprimer</button>
      <button class="btn primary grow" onclick={() => (roomSheetOpen = false)}>OK</button>
    {/snippet}
  </Sheet>

  <Confirm
    bind:open={confirmDeleteRoom}
    title="Supprimer cette pièce ?"
    message={`La pièce et ses ${roomSheet?.loci.length ?? 0} loci seront supprimés, ainsi que ce qui y est déposé.`}
    onconfirm={() => {
      if (roomSheet) deleteRoom(palace, roomSheet.id);
      roomSheetOpen = false;
    }}
  />

  <!-- Locus -->
  <Sheet bind:open={locusSheetOpen} title={`Locus n° ${locusSheet ? numberOf.get(locusSheet.id) : ''}`} onclose={() => touch(palace)}>
    {#if locusSheet}
      {@const ls = locusSheet}
      {@const n = numberOf.get(ls.id) ?? 0}
      <label class="field">
        <span>Nom de l'endroit</span>
        <input class="input" bind:value={ls.name} placeholder="Ex : Frigo" />
      </label>
      <label class="field">
        <span>Description (pour bien le visualiser)</span>
        <textarea class="input" bind:value={ls.description} placeholder="Ex : gros frigo blanc couvert d'aimants"></textarea>
      </label>
      {#if palace.rooms.length > 1}
        <label class="field">
          <span>Pièce</span>
          <select class="input" value={roomOf(ls.id)?.id} onchange={(e) => moveLocusToRoom(palace, ls.id, e.currentTarget.value)}>
            {#each palace.rooms as r (r.id)}
              <option value={r.id}>{r.name || 'Pièce sans nom'}</option>
            {/each}
          </select>
        </label>
      {/if}
      <div class="row">
        <button class="btn grow" disabled={n <= 1} onclick={() => moveLocus(palace, ls.id, -1)}>↑ Avant</button>
        <button class="btn grow" disabled={n >= flat.length} onclick={() => moveLocus(palace, ls.id, 1)}>↓ Après</button>
      </div>
      {@const placed = contents.filter((c) => c.items[ls.id]?.text)}
      {#if placed.length}
        <p class="section-title">Déposé ici</p>
        <div class="stack">
          {#each placed as c (c.id)}
            <div class="placed">
              <span class="muted small">{c.title}</span>
              <span>{c.items[ls.id]?.text}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
    {#snippet footer()}
      <button class="btn danger" onclick={() => (confirmDeleteLocus = true)}>Supprimer</button>
      <button class="btn primary grow" onclick={() => (locusSheetOpen = false)}>OK</button>
    {/snippet}
  </Sheet>

  <Confirm
    bind:open={confirmDeleteLocus}
    title="Supprimer ce locus ?"
    message="Ce qui est déposé sur ce locus dans tes contenus sera aussi supprimé. Les numéros suivants seront décalés."
    onconfirm={() => {
      if (locusSheet) deleteLocus(palace, locusSheet.id);
      locusSheetOpen = false;
    }}
  />

  <!-- Nouvelle pièce -->
  <Sheet bind:open={newRoomOpen} title="Nouvelle pièce">
    <form
      onsubmit={(e) => {
        e.preventDefault();
        addNewRoom();
      }}
    >
      <label class="field">
        <span>Nom de la pièce</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" bind:value={newRoomName} placeholder="Ex : Cuisine" autofocus enterkeyhint="done" />
      </label>
      <p class="muted small" style="margin-bottom: 14px">
        Les pièces regroupent tes loci (Entrée, Cuisine, Salon…). La numérotation continue d'une pièce à l'autre.
      </p>
      <button class="btn primary block" type="submit">Ajouter</button>
    </form>
  </Sheet>

  <!-- Nouveau contenu -->
  <Sheet bind:open={newContentOpen} title="Nouveau contenu">
    <form
      onsubmit={(e) => {
        e.preventDefault();
        createNewContent();
      }}
    >
      <label class="field">
        <span>Titre</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input class="input" bind:value={newContentTitle} placeholder="Ex : Les 20 premiers éléments du tableau périodique" autofocus enterkeyhint="done" />
      </label>
      <button class="btn primary block" type="submit">Créer</button>
    </form>
  </Sheet>

  <QuizStart
    bind:open={quizOpen}
    kind="trajet"
    id={palace.id}
    explain="On te montre un numéro (et la pièce), tu essaies de retrouver le locus, puis tu révèles la réponse."
  />
{/if}

<style>
  .desc {
    margin: 0 4px 12px;
  }

  .tools {
    margin: 10px 0 4px;
  }

  .room {
    margin-bottom: 14px;
  }

  .room-head {
    display: flex;
    align-items: center;
    margin: 12px 0 6px;
  }

  .room-name {
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: left;
    padding: 6px 4px;
    font-weight: 700;
    font-size: 1.02rem;
    min-width: 0;
  }

  .list {
    overflow: hidden;
  }

  .locus {
    display: flex;
    align-items: center;
    border-bottom: 1px solid var(--border);
    padding-right: 4px;
  }

  .locus-main {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 12px;
    text-align: left;
    min-height: 56px;
    min-width: 0;
  }

  .locus-main:active {
    background: var(--surface-2);
  }

  .locus-text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .add {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 6px 8px 6px 12px;
  }

  .add-badge {
    background: transparent;
    border: 1.5px dashed var(--border);
    color: var(--muted);
  }

  .add-input {
    border: none;
    outline: none;
    background: transparent;
    min-height: 44px;
    min-width: 0;
  }

  .small-btn {
    min-height: 36px;
    padding: 0 14px;
  }

  .add-room {
    margin-top: 4px;
  }

  .hint {
    margin: 14px 4px;
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 16px;
    text-align: left;
    width: 100%;
  }

  .bar {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
  }

  .bar span {
    display: block;
    height: 100%;
    background: var(--accent);
    border-radius: 3px;
  }

  .placed {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    border-radius: 12px;
    background: var(--surface-2);
  }

  .icon-btn:disabled {
    opacity: 0.3;
  }
</style>

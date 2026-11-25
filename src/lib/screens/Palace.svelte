<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Dialog from '../components/Dialog.svelte';
  import Icon from '../components/Icon.svelte';
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
    moveLocusTo,
    moveLocusToRoom,
    moveRoom,
    touch,
  } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { flatLoci, lociCount, plural } from '../util';
  import { toast, withUndo } from '../app.svelte';
  import { contentDue, dueLabel, palaceDue } from '../review';
  import { haptic } from '../haptics';
  import type { Locus, Room } from '../types';
  import Avatar from '../components/Avatar.svelte';
  import { OCCUPANCY_LABEL, freePalaces, overlaps, palaceUse } from '../interference';
  import { db, getPlace } from '../store.svelte';
  import PlaceIconView from '../components/PlaceIconView.svelte';
  import { tick } from 'svelte';

  let {
    id,
    tab: initialTab = 'trajet',
    focus,
  }: { id: string; tab?: 'trajet' | 'contents'; focus?: string } = $props();

  const palace = $derived(getPalace(id));
  // svelte-ignore state_referenced_locally
  let tab = $state(focus ? 'trajet' : initialTab);
  const place = $derived(getPlace(palace?.placeId));

  /* ---------- Arrivée depuis la recherche : défiler jusqu'au locus et le surligner ---------- */
  let flash = $state<string | null>(null);
  $effect(() => {
    if (!focus) return;
    const f = focus;
    void tick().then(() => {
      const el = document.querySelector(`[data-id="${f}"]`);
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      flash = f;
      const hit = flat.find((x) => x.locus.id === f);
      if (hit) toast(`Trouvé : locus ${hit.n}, ${hit.locus.name}${hit.room.name ? ` (${hit.room.name})` : ''}`);
      setTimeout(() => (flash = null), 2600);
      const r = nav.current;
      if (r.name === 'palace') r.focus = undefined;
    });
  });

  function setTab(t: 'trajet' | 'contents') {
    tab = t;
    haptic.tick();
    const r = nav.current;
    if (r.name === 'palace') r.tab = t;
  }

  // Feuilles et dialogues
  let editPalace = $state(false);
  let confirmDeletePalace = $state(false);
  let quizOpen = $state(false);
  let newContentOpen = $state(false);
  let newContentTitle = $state('');
  let roomSheet = $state<Room | null>(null);
  let roomSheetOpen = $state(false);
  let locusSheet = $state<Locus | null>(null);
  let locusSheetOpen = $state(false);
  let newRoomOpen = $state(false);
  let newRoomName = $state('');

  let drafts = $state<Record<string, string>>({});

  const flat = $derived(palace ? flatLoci(palace) : []);
  const numberOf = $derived(new Map(flat.map((f) => [f.locus.id, f.n])));
  const contents = $derived(palace ? contentsOf(palace.id) : []);
  const showRoomHeaders = $derived(!!palace && (palace.rooms.length > 1 || !!palace.rooms[0]?.name));
  const namedRooms = $derived(palace ? palace.rooms.filter((r) => r.name).length : 0);
  const due = $derived(palace ? palaceDue(palace) : null);
  const use = $derived(palace ? palaceUse(palace) : null);
  const activeContents = $derived(contents.filter((c) => !c.archived));
  const archivedContents = $derived(contents.filter((c) => c.archived));

  // Choix du palais pour un nouveau contenu
  // svelte-ignore state_referenced_locally
  let targetPalaceId = $state(id);
  const chosen = $derived(getPalace(targetPalaceId));
  const chosenUse = $derived(chosen ? palaceUse(chosen) : null);
  const suggestions = $derived(freePalaces(targetPalaceId).slice(0, 2));

  /* ---------- Ajout rapide ---------- */

  function quickAdd(room: Room) {
    if (!palace) return;
    const text = (drafts[room.id] ?? '').trim();
    if (!text) return;
    addLocus(palace, room, text);
    drafts[room.id] = '';
    haptic.tap();
  }

  function onPaste(e: ClipboardEvent, room: Room) {
    if (!palace) return;
    const lines = (e.clipboardData?.getData('text') ?? '')
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\d+[.)-]\s*/, '').trim())
      .filter(Boolean);
    if (lines.length < 2) return;
    e.preventDefault();
    for (const l of lines) addLocus(palace, room, l);
    toast(`${lines.length} loci ajoutés`);
  }

  /* ---------- Glisser-déposer ---------- */

  interface Slot {
    kind: 'room' | 'locus';
    roomId: string;
    id: string;
    top: number;
    bottom: number;
  }

  let listEl: HTMLElement | undefined = $state();
  let drag = $state<{ id: string; startY: number; dy: number } | null>(null);
  let indicatorY = $state<number | null>(null);
  let slots: Slot[] = [];
  let listTop = 0;
  let clientY = 0;
  let target: { roomId: string; index: number } | null = null;
  let raf = 0;

  function dragStart(e: PointerEvent, locusId: string) {
    if (!listEl) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const sy = window.scrollY;
    listTop = listEl.getBoundingClientRect().top + sy;
    slots = [...listEl.querySelectorAll<HTMLElement>('[data-slot]')].map((el) => {
      const r = el.getBoundingClientRect();
      return {
        kind: el.dataset.slot as 'room' | 'locus',
        roomId: el.dataset.room!,
        id: el.dataset.id ?? '',
        top: r.top + sy,
        bottom: r.bottom + sy,
      };
    });
    clientY = e.clientY;
    drag = { id: locusId, startY: e.clientY + sy, dy: 0 };
    target = null;
    haptic.medium();
    raf = requestAnimationFrame(loop);
  }

  function dragMove(e: PointerEvent) {
    if (!drag) return;
    clientY = e.clientY;
    update();
  }

  function update() {
    if (!drag) return;
    const pageY = clientY + window.scrollY;
    drag.dy = pageY - drag.startY;
    let room = slots[0]?.roomId ?? '';
    let index = 0;
    let line = slots[0]?.bottom ?? 0;
    let first = true;
    for (const s of slots) {
      if (s.kind === 'room') {
        if (first || s.top <= pageY) {
          room = s.roomId;
          index = 0;
          line = s.bottom;
          first = false;
        } else break;
      } else if (s.id !== drag.id && s.roomId === room && (s.top + s.bottom) / 2 < pageY) {
        index++;
        line = s.bottom;
      }
    }
    if (!target || target.roomId !== room || target.index !== index) {
      if (target) haptic.tick();
      target = { roomId: room, index };
    }
    indicatorY = line - listTop;
  }

  function loop() {
    if (!drag) return;
    const edge = 120;
    if (clientY < edge + 40) window.scrollBy(0, -Math.ceil((edge + 40 - clientY) / 8));
    else if (clientY > window.innerHeight - edge) window.scrollBy(0, Math.ceil((clientY - window.innerHeight + edge) / 8));
    update();
    raf = requestAnimationFrame(loop);
  }

  function dragEnd() {
    cancelAnimationFrame(raf);
    if (drag && target && palace) {
      moveLocusTo(palace, drag.id, target.roomId, target.index);
      haptic.tap();
    }
    drag = null;
    indicatorY = null;
    target = null;
  }

  /* ---------- Actions ---------- */

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
    const c = createContent(targetPalaceId, newContentTitle);
    newContentOpen = false;
    newContentTitle = '';
    // On ouvre le contenu puis on lance directement le remplissage pas à pas.
    nav.go({ name: 'content', id: c.id });
    if (flatLoci(getPalace(targetPalaceId)!).length) nav.go({ name: 'fill', id: c.id });
  }

  function addNewRoom() {
    if (!palace) return;
    const only = palace.rooms[0];
    if (palace.rooms.length === 1 && only && !only.name && only.loci.length === 0) {
      only.name = newRoomName.trim() || 'Zone 1';
    } else {
      if (palace.rooms.length === 1 && only && !only.name) only.name = 'Zone 1';
      addRoom(palace, newRoomName.trim() || `Zone ${palace.rooms.length + 1}`);
    }
    newRoomOpen = false;
    newRoomName = '';
  }
</script>

{#if palace}
  <TopBar back>
    {#snippet actions()}
      <button class="icon-btn" onclick={() => (editPalace = true)} aria-label="Modifier le palais">
        <Icon name="pencil" size={22} />
      </button>
    {/snippet}
  </TopBar>

  <div class="page no-nav">
    {#if place}
      <button class="crumb label-l primary" onclick={() => nav.go({ name: 'place', id: place.id })}>
        <PlaceIconView icon={place.icon} size={22} />{place.name} ›
      </button>
    {/if}
    <h1 class="headline-m page-title" class:tight={!!place}>{palace.name}</h1>
    <p class="body-m page-sub">
      {#if palace.subject}<span class="subj">{palace.subject}</span> · {/if}{plural(lociCount(palace), 'locus', 'loci')}{namedRooms
        ? ' · ' + plural(namedRooms, 'zone', 'zones')
        : ''}{due !== null ? ' · révision ' + dueLabel(due) : ''}
    </p>
    {#if palace.description}
      <p class="body-m page-sub desc">{palace.description}</p>
    {/if}

    {#if use && flat.length}
      {#if use.state === 'mixed'}
        {@const names = use.active.filter((c) => [...use.sharedLoci].some((l) => c.items[l]?.text)).map((c) => c.title)}
        <button class="occ card-warn" onclick={() => setTab('contents')}>
          <Icon name="alert" />
          <span class="grow">
            <span class="title-m">Mélange possible</span>
            <span class="body-m">
              « {names.join(' » et « ')} » partagent {plural(use.sharedLoci.size, 'locus', 'loci')}. Archive l'ancien ou déplace-en un
              dans un palais libre.
            </span>
          </span>
          <Icon name="next" size={20} />
        </button>
      {:else if use.state === 'used'}
        <div class="occ card-filled compact">
          <Icon name="book" size={20} class="onv" />
          <span class="body-m grow">
            Occupé par {use.active.length === 1 ? `« ${use.active[0]?.title} »` : plural(use.active.length, 'contenu', 'contenus')}
          </span>
          <span class="spill used">{OCCUPANCY_LABEL.used}</span>
        </div>
      {:else}
        <div class="occ card-ok compact">
          <Icon name="check2" size={20} />
          <span class="body-m grow">Prêt à recevoir un nouveau contenu</span>
          <span class="spill free">{OCCUPANCY_LABEL.free}</span>
        </div>
      {/if}
    {/if}

    <div class="segmented" role="tablist">
      <button role="tab" class:on={tab === 'trajet'} aria-selected={tab === 'trajet'} onclick={() => setTab('trajet')}>
        {#if tab === 'trajet'}<Icon name="check" />{/if}Trajet
      </button>
      <button role="tab" class:on={tab === 'contents'} aria-selected={tab === 'contents'} onclick={() => setTab('contents')}>
        {#if tab === 'contents'}<Icon name="check" />{/if}Contenus ({contents.length})
      </button>
    </div>

    {#if tab === 'trajet'}
      <div class="chips">
        <button class="chip" disabled={flat.length === 0} onclick={() => nav.go({ name: 'walk', palaceId: palace.id })}>
          <Icon name="walk" />Promenade
        </button>
        <button class="chip" disabled={flat.length === 0} onclick={() => (quizOpen = true)}>
          <Icon name="play" />Tester
        </button>
        <button class="chip" onclick={() => (newRoomOpen = true)}><Icon name="plus" />Zone</button>
      </div>

      {#if flat.length === 0 && !showRoomHeaders && palace.rooms[0]}
        {@const first = palace.rooms[0]}
        <div class="start">
          <div class="art"><Icon name="walk" size={32} /></div>
          <p class="title-m">Fais le trajet dans ta tête</p>
          <p class="body-m onv">Note chaque endroit que tu croises, dans l'ordre : la porte, un meuble, un coin…</p>
        </div>
        <form
          class="first"
          onsubmit={(e) => {
            e.preventDefault();
            quickAdd(first);
          }}
        >
          <span class="num dashed">1</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="grow body-l"
            placeholder="Premier endroit, ex. la porte d'entrée"
            bind:value={drafts[first.id]}
            onpaste={(e) => onPaste(e, first)}
            enterkeyhint="next"
            autofocus
          />
        </form>
        <p class="body-m onv hint">Entrée = locus suivant. Tu peux aussi coller une liste (une ligne = un locus). Les zones sont facultatives.</p>
      {:else}
      <div class="list" class:dragging={!!drag} bind:this={listEl}>
        {#each palace.rooms as room (room.id)}
          {#if showRoomHeaders}
            <button class="subheader room-head" data-slot="room" data-room={room.id} onclick={() => openRoom(room)}>
              <span class="grow ellipsis">{room.name || 'Zone sans nom'}</span>
              <span class="label-m onv">{room.loci.length}</span>
            </button>
          {:else}
            <div data-slot="room" data-room={room.id} style="height: 8px"></div>
          {/if}

          {#each room.loci as locus, li (locus.id)}
            {@const lifted = drag?.id === locus.id}
            <div
              class="locus"
              class:flash={flash === locus.id}
              class:lifted
              data-slot="locus"
              data-room={room.id}
              data-id={locus.id}
              style:transform={lifted ? `translateY(${drag?.dy ?? 0}px)` : undefined}
            >
              <button class="list-item grow" onclick={() => openLocus(locus)}>
                <span class="num" class:shared={use?.sharedLoci.has(locus.id)} title={use?.sharedLoci.has(locus.id) ? 'Locus partagé par plusieurs contenus' : undefined}>{numberOf.get(locus.id)}</span>
                <span class="li-text">
                  <span class="li-head ellipsis">{locus.name || 'Sans nom'}</span>
                  {#if locus.description}<span class="li-sup ellipsis">{locus.description}</span>{/if}
                </span>
              </button>
              <span
                class="grip"
                role="button"
                tabindex="-1"
                aria-label="Déplacer"
                onpointerdown={(e) => dragStart(e, locus.id)}
                onpointermove={dragMove}
                onpointerup={dragEnd}
                onpointercancel={dragEnd}
              >
                <Icon name="grip" size={22} />
              </span>
            </div>
            {#if li < room.loci.length - 1}<div class="divider"></div>{/if}
          {/each}

          <form
            class="add"
            onsubmit={(e) => {
              e.preventDefault();
              quickAdd(room);
            }}
          >
            <span class="num dashed"><Icon name="plus" size={18} /></span>
            <input
              class="grow body-l"
              placeholder="Ajouter un locus"
              bind:value={drafts[room.id]}
              onpaste={(e) => onPaste(e, room)}
              enterkeyhint="next"
            />
            {#if drafts[room.id]?.trim()}
              <button class="icon-btn on" type="submit" aria-label="Ajouter"><Icon name="check" /></button>
            {/if}
          </form>
        {/each}

        {#if indicatorY !== null}
          <div class="indicator" style:top="{indicatorY}px"></div>
        {/if}
      </div>

      {#if flat.length === 0}
        <p class="body-m onv hint">
          Écris le nom d'un endroit et appuie sur Entrée pour enchaîner. Tu peux aussi coller une liste : une ligne = un locus.
        </p>
      {:else}
        <p class="body-m onv hint">Maintiens la poignée à droite pour déplacer un locus, même vers une autre zone.</p>
      {/if}
      {/if}
    {:else}
      <div style="height: 8px"></div>
      {#each activeContents as c, i (c.id)}
        {@const filled = filledCount(c, palace)}
        {@const cd = contentDue(c, palace)}
        {@const ov = overlaps(c)}
        <button class="list-item two" onclick={() => nav.go({ name: 'content', id: c.id })}>
          <span class="ring" class:warn={ov.length > 0} style:--pct={flat.length ? filled / flat.length : 0}>
            <Icon name={ov.length ? 'alert' : 'book'} size={20} />
          </span>
          <span class="li-text">
            <span class="li-head ellipsis">{c.title}</span>
            {#if ov.length}
              <span class="li-sup ellipsis warn-text">
                Partage {plural(ov[0]?.count ?? 0, 'locus', 'loci')} avec « {ov[0]?.content.title} »
              </span>
            {:else}
              <span class="li-sup ellipsis">{filled}/{flat.length} placés{cd !== null ? ' · révision ' + dueLabel(cd) : ''}</span>
            {/if}
          </span>
          <Icon name="next" size={20} class="onv" />
        </button>
        {#if i < activeContents.length - 1}<div class="divider"></div>{/if}
      {:else}
        <div class="empty">
          <div class="art"><Icon name="book" size={32} /></div>
          <p class="title-m" style="color: var(--on)">Aucun contenu</p>
          <p class="body-m" style="margin-top: 6px">
            Un contenu, c'est ce que tu retiens grâce à ce palais : une liste, un discours, des dates… Chaque élément est placé
            sur un locus.
          </p>
        </div>
      {/each}

      {#if archivedContents.length}
        <h2 class="subheader">Archivés · ne comptent plus</h2>
        {#each archivedContents as c (c.id)}
          <button class="list-item two archived" onclick={() => nav.go({ name: 'content', id: c.id })}>
            <span class="num"><Icon name="archive" size={20} /></span>
            <span class="li-text">
              <span class="li-head ellipsis">{c.title}</span>
              <span class="li-sup ellipsis">{filledCount(c, palace)} éléments · plus de révisions</span>
            </span>
            <Icon name="next" size={20} class="onv" />
          </button>
        {/each}
      {/if}
      <button
        class="fab no-nav"
        onclick={() => {
          targetPalaceId = palace.id;
          newContentOpen = true;
        }}><Icon name="plus" />Contenu</button
      >
    {/if}
  </div>

  <!-- Modifier le palais -->
  <Sheet bind:open={editPalace} title="Modifier le palais" onclose={() => touch(palace)}>
    <label class="tf">
      <span>Nom</span>
      <input bind:value={palace.name} />
    </label>
    <label class="tf">
      <span>Matière ou sujet (facultatif)</span>
      <input
        value={palace.subject ?? ''}
        oninput={(e) => (palace.subject = e.currentTarget.value.trim() ? e.currentTarget.value : undefined)}
        placeholder="Ex. Mathématiques"
      />
    </label>
    <label class="tf">
      <span>Lieu</span>
      <select value={palace.placeId ?? ''} onchange={(e) => (palace.placeId = e.currentTarget.value || undefined)}>
        <option value="">Aucun lieu</option>
        {#each db.places as l (l.id)}<option value={l.id}>{l.name}</option>{/each}
      </select>
    </label>
    <label class="tf">
      <span>Description (facultatif)</span>
      <textarea bind:value={palace.description} rows="2" placeholder="Ex. l'appart de la rue Saint-Denis, 2015-2019"></textarea>
    </label>
    {#snippet footer()}
      <button class="btn text danger-text" onclick={() => (confirmDeletePalace = true)}>Supprimer</button>
      <span class="grow"></span>
      <button class="btn filled" onclick={() => (editPalace = false)}>OK</button>
    {/snippet}
  </Sheet>

  <Dialog
    bind:open={confirmDeletePalace}
    icon="trash"
    danger
    title="Supprimer ce palais ?"
    message={`« ${palace.name} » et ses ${contents.length} contenu(s) seront supprimés.`}
    confirmLabel="Supprimer"
    onconfirm={() => {
      editPalace = false;
      const pid = palace.id;
      nav.back();
      withUndo('Palais supprimé', () => deletePalace(pid));
    }}
  />

  <!-- Pièce -->
  <Sheet bind:open={roomSheetOpen} title="Zone" onclose={() => touch(palace)}>
    {#if roomSheet}
      {@const ri = palace.rooms.indexOf(roomSheet)}
      <label class="tf">
        <span>Nom de la zone</span>
        <input bind:value={roomSheet.name} placeholder="Ex. Cuisine" />
      </label>
      <div class="row">
        <button class="btn outlined has-icon grow" disabled={ri <= 0} onclick={() => roomSheet && moveRoom(palace, roomSheet.id, -1)}>
          <Icon name="up" size={18} />Monter
        </button>
        <button
          class="btn outlined has-icon grow"
          disabled={ri >= palace.rooms.length - 1}
          onclick={() => roomSheet && moveRoom(palace, roomSheet.id, 1)}
        >
          <Icon name="down" size={18} />Descendre
        </button>
      </div>
    {/if}
    {#snippet footer()}
      <button
        class="btn text danger-text"
        onclick={() => {
          const r = roomSheet;
          roomSheetOpen = false;
          if (r) withUndo(`Zone « ${r.name || 'sans nom'} » supprimée`, () => deleteRoom(palace, r.id));
        }}>Supprimer</button
      >
      <span class="grow"></span>
      <button class="btn filled" onclick={() => (roomSheetOpen = false)}>OK</button>
    {/snippet}
  </Sheet>

  <!-- Locus -->
  <Sheet bind:open={locusSheetOpen} title={`Locus ${locusSheet ? numberOf.get(locusSheet.id) : ''}`} onclose={() => touch(palace)}>
    {#if locusSheet}
      {@const ls = locusSheet}
      <label class="tf">
        <span>Nom de l'endroit</span>
        <input bind:value={ls.name} placeholder="Ex. Frigo" />
      </label>
      <label class="tf">
        <span>Description</span>
        <textarea bind:value={ls.description} rows="2" placeholder="Ex. gros frigo blanc couvert d'aimants"></textarea>
      </label>
      <p class="helper">Des détails concrets (couleur, matière, odeur) rendent le locus plus facile à visualiser.</p>
      {#if palace.rooms.length > 1}
        <label class="tf">
          <span>Zone</span>
          <select value={roomOf(ls.id)?.id} onchange={(e) => moveLocusToRoom(palace, ls.id, e.currentTarget.value)}>
            {#each palace.rooms as r (r.id)}
              <option value={r.id}>{r.name || 'Zone sans nom'}</option>
            {/each}
          </select>
        </label>
      {/if}
      {@const placed = contents.filter((c) => c.items[ls.id]?.text)}
      {#if placed.length}
        <p class="label-l primary" style="margin: 4px 0 8px">Déposé ici</p>
        <div class="stack">
          {#each placed as c (c.id)}
            <div class="card-filled placed">
              <span class="label-m onv">{c.title}</span>
              <span class="body-l">{c.items[ls.id]?.text}</span>
            </div>
          {/each}
        </div>
      {/if}
    {/if}
    {#snippet footer()}
      <button
        class="btn text danger-text"
        onclick={() => {
          const l = locusSheet;
          locusSheetOpen = false;
          if (l) withUndo(`« ${l.name || 'Locus'} » supprimé`, () => deleteLocus(palace, l.id));
        }}>Supprimer</button
      >
      <span class="grow"></span>
      <button class="btn filled" onclick={() => (locusSheetOpen = false)}>OK</button>
    {/snippet}
  </Sheet>

  <!-- Nouvelle pièce -->
  <Sheet bind:open={newRoomOpen} title="Nouvelle zone">
    <form
      onsubmit={(e) => {
        e.preventDefault();
        addNewRoom();
      }}
    >
      <label class="tf">
        <span>Nom de la zone</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={newRoomName} placeholder="Ex. Cuisine" autofocus enterkeyhint="done" />
      </label>
      <p class="helper">Une zone regroupe des loci (une pièce, « avant de la classe », un étage…). La numérotation continue d'une zone à l'autre.</p>
      <div class="row" style="justify-content: flex-end">
        <button class="btn text" type="button" onclick={() => (newRoomOpen = false)}>Annuler</button>
        <button class="btn filled" type="submit">Ajouter</button>
      </div>
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
      <label class="tf">
        <span>Titre</span>
        <!-- svelte-ignore a11y_autofocus -->
        <input bind:value={newContentTitle} placeholder="Ex. Tableau périodique 1 à 20" autofocus enterkeyhint="done" />
      </label>

      <p class="label-l primary" style="margin: 4px 0 4px">Dans quel palais ?</p>
      <div class="picker">
        {#each db.palaces as p (p.id)}
          {@const u = palaceUse(p)}
          <button type="button" class="pick" class:on={targetPalaceId === p.id} onclick={() => (targetPalaceId = p.id)}>
            <Avatar id={p.id} name={p.name} size={36} />
            <span class="li-text">
              <span class="body-l ellipsis">{p.name}</span>
              <span class="body-m onv">{plural(lociCount(p), 'locus', 'loci')}</span>
            </span>
            <span class="spill {u.state}">{OCCUPANCY_LABEL[u.state]}</span>
          </button>
        {/each}
      </div>

      {#if chosen && chosenUse && chosenUse.state !== 'free'}
        <div class="card-warn advice">
          <p class="body-m">
            <b>Ce palais porte déjà {chosenUse.active.length === 1 ? `« ${chosenUse.active[0]?.title} »` : plural(chosenUse.active.length, 'contenu', 'contenus')}.</b>
            Deux contenus sur les mêmes loci finissent souvent par se mélanger.
          </p>
          {#if suggestions.length}
            <div class="row" style="flex-wrap: wrap; margin-top: 8px">
              {#each suggestions as sp (sp.id)}
                <button type="button" class="btn filled has-icon" onclick={() => (targetPalaceId = sp.id)}>
                  <Icon name="check" size={18} />{sp.name} (libre)
                </button>
              {/each}
            </div>
          {:else}
            <p class="body-m" style="margin-top: 6px">Astuce : archive l'ancien contenu si tu n'as plus besoin de le retenir.</p>
          {/if}
        </div>
      {/if}

      <div class="row" style="justify-content: flex-end; margin-top: 16px">
        <button class="btn text" type="button" onclick={() => (newContentOpen = false)}>Annuler</button>
        <button class="btn filled" type="submit">Créer</button>
      </div>
    </form>
  </Sheet>

  <QuizStart
    bind:open={quizOpen}
    kind="trajet"
    id={palace.id}
    explain="On te montre un numéro, tu retrouves le locus, puis tu révèles la réponse."
  />
{/if}

<style>
  .desc {
    margin-top: 8px;
  }

  .list {
    position: relative;
    margin-top: 4px;
  }

  .room-head {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
  }

  .locus {
    display: flex;
    align-items: center;
    background: var(--surface);
    position: relative;
  }

  .locus.lifted {
    z-index: 5;
    background: var(--surface-high);
    box-shadow: var(--elev3);
    border-radius: 12px;
  }

  .list.dragging .locus:not(.lifted) {
    transition: none;
  }

  .grip {
    width: 48px;
    height: 56px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--outline);
    touch-action: none;
    cursor: grab;
    margin-right: 4px;
    flex-shrink: 0;
  }

  .indicator {
    position: absolute;
    left: 16px;
    right: 16px;
    height: 3px;
    margin-top: -1.5px;
    border-radius: 2px;
    background: var(--p);
    pointer-events: none;
    z-index: 4;
  }

  .indicator::before {
    content: '';
    position: absolute;
    left: -4px;
    top: -3.5px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    border: 2px solid var(--p);
    background: var(--surface);
  }

  .add {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 4px 4px 4px 16px;
    min-height: 56px;
  }

  .add input {
    border: none;
    outline: none;
    background: transparent;
    height: 48px;
    min-width: 0;
  }

  .add input::placeholder {
    color: var(--onv);
  }

  .hint {
    padding: 16px;
  }

  .ring {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--p);
    flex-shrink: 0;
    background:
      radial-gradient(closest-side, var(--surface) 82%, transparent 83%),
      conic-gradient(var(--p) calc(var(--pct) * 360deg), var(--surface-highest) 0);
  }

  .crumb {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 2px 16px 0;
  }

  .page-title.tight {
    padding-top: 2px;
  }

  .subj {
    display: inline-flex;
    align-items: center;
    height: 22px;
    padding: 0 8px;
    border-radius: 6px;
    background: var(--sc);
    color: var(--onsc);
    font-size: 12.5px;
    font-weight: 600;
  }

  .start {
    text-align: center;
    padding: 28px 32px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .start .art {
    width: 72px;
    height: 72px;
    margin: 0 auto 8px;
    border-radius: 24px;
    background: var(--sc);
    color: var(--onsc);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .first {
    display: flex;
    align-items: center;
    gap: 16px;
    margin: 20px 16px 0;
    padding: 6px 16px;
    background: var(--surface-highest);
    border-radius: 4px 4px 0 0;
    border-bottom: 2px solid var(--p);
  }

  .first input {
    border: none;
    outline: none;
    background: transparent;
    height: 48px;
    min-width: 0;
  }

  .locus.flash {
    background: var(--pc);
    border-radius: 16px;
    box-shadow: 0 0 0 2px var(--p);
    transition: background 0.4s;
  }

  .occ {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 12px 16px 0;
    width: calc(100% - 32px);
    text-align: left;
  }

  .occ .grow {
    display: flex;
    flex-direction: column;
  }

  .occ.compact {
    padding: 10px 12px 10px 16px;
  }

  .num.shared {
    background: var(--warn-c);
    color: var(--onwarn-c);
    box-shadow: 0 0 0 2px var(--warn);
  }

  .ring.warn {
    color: var(--warn);
  }

  .warn-text {
    color: var(--warn);
  }

  .archived {
    opacity: 0.7;
  }

  .picker {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0 -8px;
  }

  .pick {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    border-radius: 16px;
    border: 2px solid transparent;
    text-align: left;
    width: 100%;
  }

  .pick.on {
    border-color: var(--p);
    background: var(--surface-high);
  }

  .advice {
    margin-top: 12px;
  }

  .placed {
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
  }

  :global(.danger-text) {
    color: var(--error) !important;
  }
</style>

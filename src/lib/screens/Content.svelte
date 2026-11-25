<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import QuizStart from '../components/QuizStart.svelte';
  import ImageWorkshop from '../components/ImageWorkshop.svelte';
  import Avatar from '../components/Avatar.svelte';
  import {
    db,
    deleteContent,
    filledCount,
    getContent,
    getPalace,
    moveContentToPalace,
    pasteList,
    setArchived,
    setItem,
    touch,
  } from '../store.svelte';
  import { OCCUPANCY_LABEL, neighbours, overlaps, palaceUse } from '../interference';
  import { lociCount, plural } from '../util';
  import { nav } from '../nav.svelte';
  import { flatLoci } from '../util';
  import { toast, withUndo } from '../app.svelte';
  import { contentDue, dueLabel } from '../review';
  import { haptic } from '../haptics';

  let { id }: { id: string } = $props();

  const content = $derived(getContent(id));
  const palace = $derived(content ? getPalace(content.palaceId) : undefined);
  const flat = $derived(palace ? flatLoci(palace) : []);
  const showRooms = $derived(!!palace && (palace.rooms.length > 1 || !!palace.rooms[0]?.name));
  const filled = $derived(content && palace ? filledCount(content, palace) : 0);
  const due = $derived(content ? contentDue(content, palace) : null);
  const ov = $derived(content ? overlaps(content) : []);

  let moveOpen = $state(false);
  /** Position du dernier locus rempli (1 = premier). */
  const lastFilled = $derived(
    content ? flat.reduce((acc, f, i) => (content.items[f.locus.id]?.text ? i + 1 : acc), 0) : 0,
  );

  function move(targetId: string) {
    const target = getPalace(targetId);
    if (!content || !target) return;
    moveOpen = false;
    editInfo = false;
    withUndo(`Déplacé dans « ${target.name} »`, () => {
      const lost = moveContentToPalace(content, target);
      if (lost) setTimeout(() => toast(`${lost} élément(s) sans locus : ajoute des loci à « ${target.name} »`), 5200);
    });
  }

  function archiveOther(otherId: string) {
    const other = getContent(otherId);
    if (!other) return;
    withUndo(`« ${other.title} » archivé`, () => setArchived(other, true));
  }

  let hide = $state(false);
  let revealed = $state<Record<string, boolean>>({});

  let editInfo = $state(false);
  let quizOpen = $state(false);

  let editIndex = $state(-1);
  let editOpen = $state(false);
  let draftText = $state('');
  let draftImage = $state('');
  const editing = $derived(flat[editIndex]);

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
    haptic.tick();
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
      haptic.tap();
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
        ? `${pasteLines.length - overflow} placés, ${overflow} sans locus : ajoute des loci`
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
  <TopBar back>
    {#snippet actions()}
      {#if flat.length}
        <button
          class="icon-btn"
          class:on={hide}
          onclick={() => {
            hide = !hide;
            revealed = {};
          }}
          aria-label={hide ? 'Tout montrer' : 'Cacher les réponses'}
        >
          <Icon name={hide ? 'eyeOff' : 'eye'} size={22} />
        </button>
      {/if}
      <button class="icon-btn" onclick={() => (editInfo = true)} aria-label="Modifier le contenu">
        <Icon name="pencil" size={22} />
      </button>
    {/snippet}
  </TopBar>

  <div class="page no-nav">
    <h1 class="headline-m page-title">{content.title}</h1>
    <p class="body-m page-sub">
      {palace.name} · {filled}/{flat.length} placés{due !== null ? ' · révision ' + dueLabel(due) : ''}
    </p>
    {#if content.notes}<p class="body-m page-sub notes">{content.notes}</p>{/if}

    {#if content.archived}
      <div class="banner card-filled">
        <Icon name="archive" class="onv" />
        <span class="body-m grow">Archivé : ne compte plus dans l'occupation du palais ni dans les révisions.</span>
        <button class="btn text" onclick={() => setArchived(content, false)}>Réactiver</button>
      </div>
    {:else if ov.length}
      <div class="banner card-warn col">
        <div class="row" style="align-items: flex-start; gap: 12px">
          <Icon name="alert" />
          <span class="grow">
            <span class="title-m">Mélange possible</span>
            <span class="body-m">
              {#each ov as o, i (o.content.id)}{i ? ' et ' : ''}Partage {plural(o.count, 'locus', 'loci')} avec « {o.content.title} »{/each}.
              Les loci concernés sont marqués en orange.
            </span>
          </span>
        </div>
        <div class="row actions-warn">
          <button class="btn filled has-icon" onclick={() => (moveOpen = true)}><Icon name="move" size={18} />Déplacer celui-ci</button>
          {#if ov.length === 1 && ov[0]}
            {@const other = ov[0].content}
            <button class="btn text" onclick={() => archiveOther(other.id)}>Archiver « {other.title} »</button>
          {/if}
        </div>
      </div>
    {/if}

    {#if flat.length === 0}
      <div class="empty">
        <div class="art"><Icon name="door" size={32} /></div>
        <p class="title-m" style="color: var(--on)">Ce palais n'a pas encore de loci</p>
        <p class="body-m" style="margin: 6px 0 20px">Ajoute d'abord des endroits au trajet.</p>
        <button class="btn filled" onclick={() => nav.replace({ name: 'palace', id: palace.id, tab: 'trajet' })}>Aller au trajet</button>
      </div>
    {:else}
      <div class="px" style="margin-top: 16px">
        <div class="progress"><span style:width="{(filled / flat.length) * 100}%"></span></div>
      </div>

      <div class="chips">
        <button class="chip" disabled={filled === 0} onclick={() => (quizOpen = true)}><Icon name="play" />Tester</button>
        <button class="chip" onclick={() => nav.go({ name: 'walk', palaceId: palace.id, contentId: content.id })}>
          <Icon name="walk" />Promenade
        </button>
        <button
          class="chip"
          onclick={() => {
            pasteStart = firstEmpty();
            pasteOpen = true;
          }}><Icon name="list" />Coller une liste</button
        >
      </div>

      {#if hide}
        <p class="body-m onv px" style="margin-top: 12px">Touche une ligne pour révéler ce qui y est déposé.</p>
      {/if}

      {#each flat as f, i (f.locus.id)}
        {@const item = content.items[f.locus.id]}
        {@const newRoom = i === 0 || flat[i - 1]?.room.id !== f.room.id}
        {#if showRooms && newRoom}
          <h2 class="subheader">{f.room.name || 'Pièce sans nom'}</h2>
        {:else if i > 0}
          <div class="divider"></div>
        {:else}
          <div style="height: 8px"></div>
        {/if}
        {@const others = item?.text && !content.archived ? neighbours(content, f.locus.id) : []}
        <button class="list-item two" onclick={() => tapRow(i, f.locus.id)}>
          <span class="num" class:dashed={!item?.text} class:shared={others.length > 0}>{f.n}</span>
          <span class="li-text">
            <span class="li-over ellipsis">{f.locus.name}</span>
            {#if item?.text}
              {#if hide && !revealed[f.locus.id]}
                <span class="masked"></span>
              {:else}
                <span class="value">{item.text}</span>
                {#if item.image}<span class="li-sup">{item.image}</span>{/if}
                {#if others.length}
                  <span class="also"><Icon name="layers" size={14} />Aussi ici : {others.map((o) => o.text).join(', ')}</span>
                {/if}
              {/if}
            {:else}
              <span class="li-sup">Toucher pour ajouter</span>
            {/if}
          </span>
        </button>
      {/each}
    {/if}
  </div>

  <!-- Élément -->
  <Sheet bind:open={editOpen} title={editing ? `${editing.n}. ${editing.locus.name}` : ''} onclose={commit}>
    {#if editing}
      {#if editing.locus.description}
        <p class="body-m onv" style="margin: -4px 0 16px">{editing.locus.description}</p>
      {/if}
      <label class="tf">
        <span>À retenir</span>
        <textarea bind:value={draftText} rows="1" placeholder="Ex. Hydrogène"></textarea>
      </label>
      <label class="tf">
        <span>Image mentale (facultatif)</span>
        <textarea bind:value={draftImage} rows="2" placeholder="Ex. un dirigeable explose contre la porte"></textarea>
      </label>
      <p class="helper">Fais interagir l'élément avec le lieu : mouvement, son, exagération.</p>
      <ImageWorkshop
        element={draftText}
        bind:image={draftImage}
        locusId={editing.locus.id}
        locus={editing.locus.name}
        locusDescription={editing.locus.description}
        room={editing.room.name}
        contentTitle={content.title}
      />
    {/if}
    {#snippet footer()}
      <button class="btn outlined has-icon" disabled={editIndex <= 0} onclick={() => go(-1)}>
        <Icon name="back" size={18} />Préc.
      </button>
      <span class="grow"></span>
      <button class="btn filled" onclick={() => go(1)}>
        {editIndex >= flat.length - 1 ? 'Terminer' : 'Suivant'}
      </button>
    {/snippet}
  </Sheet>

  <!-- Coller une liste -->
  <Sheet bind:open={pasteOpen} title="Coller une liste">
    <p class="body-m onv" style="margin-bottom: 16px">
      Une ligne = un élément, placé sur le locus suivant. Les numéros en début de ligne sont retirés.
    </p>
    <label class="tf">
      <span>Liste</span>
      <textarea bind:value={pasteText} rows="6" placeholder={'Hydrogène\nHélium\nLithium'}></textarea>
    </label>
    <label class="tf">
      <span>Commencer au locus</span>
      <input type="number" min="1" max={flat.length} bind:value={pasteStart} />
    </label>
    {#if pasteLines.length > 0}
      <p class="body-m onv">
        {pasteLines.length} ligne(s) → loci {pasteStart} à {pasteStart + pasteLines.length - 1}
      </p>
      {#if pasteStart + pasteLines.length - 1 > flat.length}
        <p class="body-m" style="color: var(--error)">
          Il manque {pasteStart + pasteLines.length - 1 - flat.length} loci dans ce palais.
        </p>
      {/if}
    {/if}
    {#snippet footer()}
      <button class="btn text" onclick={() => (pasteOpen = false)}>Annuler</button>
      <button class="btn filled" disabled={pasteLines.length === 0} onclick={doPaste}>Placer</button>
    {/snippet}
  </Sheet>

  <!-- Infos -->
  <Sheet bind:open={editInfo} title="Modifier le contenu" onclose={() => touch(content)}>
    <label class="tf">
      <span>Titre</span>
      <input bind:value={content.title} />
    </label>
    <label class="tf">
      <span>Notes (facultatif)</span>
      <textarea bind:value={content.notes} rows="2" placeholder="Source, contexte, date d'apprentissage…"></textarea>
    </label>
    <div class="menu">
      <button class="list-item" onclick={() => (moveOpen = true)}>
        <span class="num"><Icon name="move" size={20} /></span>
        <span class="li-text">
          <span class="li-head">Déplacer vers un autre palais</span>
          <span class="li-sup">Chaque élément garde sa position</span>
        </span>
      </button>
      <button
        class="list-item"
        onclick={() => {
          editInfo = false;
          if (content.archived) setArchived(content, false);
          else withUndo('Contenu archivé', () => setArchived(content, true));
        }}
      >
        <span class="num"><Icon name="archive" size={20} /></span>
        <span class="li-text">
          <span class="li-head">{content.archived ? 'Réactiver' : 'Archiver'}</span>
          <span class="li-sup">{content.archived ? 'Il compte à nouveau dans le palais' : "Tu n'as plus besoin de le retenir : il libère le palais"}</span>
        </span>
      </button>
    </div>
    {#snippet footer()}
      <button
        class="btn text danger-text"
        onclick={() => {
          editInfo = false;
          const cid = content.id;
          nav.back();
          withUndo('Contenu supprimé', () => deleteContent(cid));
        }}>Supprimer</button
      >
      <span class="grow"></span>
      <button class="btn filled" onclick={() => (editInfo = false)}>OK</button>
    {/snippet}
  </Sheet>

  <!-- Déplacer -->
  <Sheet bind:open={moveOpen} title="Déplacer vers…">
    <p class="body-m onv" style="margin-bottom: 8px">
      L'élément du locus 1 va sur le locus 1 du nouveau palais, et ainsi de suite. Choisis de préférence un palais libre.
    </p>
    <div class="moves">
      {#each db.palaces.filter((p) => p.id !== palace.id) as p (p.id)}
        {@const u = palaceUse(p)}
        {@const missing = Math.max(0, lastFilled - lociCount(p))}
        <button class="list-item two" onclick={() => move(p.id)}>
          <Avatar id={p.id} name={p.name} size={40} />
          <span class="li-text">
            <span class="li-head ellipsis">{p.name}</span>
            <span class="li-sup" class:warn-text={missing > 0}>
              {plural(lociCount(p), 'locus', 'loci')}{missing ? ` · il en manque ${missing}` : ''}
            </span>
          </span>
          <span class="spill {u.state}">{OCCUPANCY_LABEL[u.state]}</span>
        </button>
      {:else}
        <p class="body-m onv">Crée d'abord un autre palais.</p>
      {/each}
    </div>
  </Sheet>

  <QuizStart
    bind:open={quizOpen}
    kind="content"
    id={content.id}
    explain="On te montre le locus, tu retrouves ce que tu y as déposé, puis tu révèles la réponse."
  />
{/if}

<style>
  .notes {
    margin-top: 8px;
  }

  .value {
    font-size: 18px;
    line-height: 26px;
    font-weight: 500;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .banner {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 12px 16px 0;
  }

  .banner.col {
    flex-direction: column;
    align-items: stretch;
  }

  .banner .grow {
    display: flex;
    flex-direction: column;
  }

  .actions-warn {
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 10px;
    padding-left: 36px;
  }

  .actions-warn .btn.text {
    color: var(--onwarn-c);
  }

  .num.shared {
    background: var(--warn-c);
    color: var(--onwarn-c);
    box-shadow: 0 0 0 2px var(--warn);
  }

  .also {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--warn);
    margin-top: 2px;
  }

  .warn-text {
    color: var(--warn);
  }

  .menu,
  .moves {
    margin: 0 -24px;
  }

  .menu .list-item,
  .moves .list-item {
    padding-left: 24px;
    padding-right: 24px;
  }

  .masked {
    display: block;
    height: 18px;
    width: 55%;
    margin: 4px 0;
    border-radius: 9px;
    background: var(--surface-highest);
  }
</style>

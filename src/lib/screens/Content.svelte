<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import QuizStart from '../components/QuizStart.svelte';
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
    touch,
    addLocus,
    itemParts,
    weakKeys,
  } from '../store.svelte';
  import { OCCUPANCY_LABEL, neighbours, overlaps, palaceUse } from '../interference';
  import { lociCount, plural } from '../util';
  import { nav } from '../nav.svelte';
  import { flatLoci } from '../util';
  import { toast, withUndo } from '../app.svelte';
  import { contentDue, dueLabel } from '../review';
  import { haptic } from '../haptics';

  import { tick } from 'svelte';
  import History from '../components/History.svelte';

  let { id, focus }: { id: string; focus?: string } = $props();

  const content = $derived(getContent(id));
  const palace = $derived(content ? getPalace(content.palaceId) : undefined);
  const flat = $derived(palace ? flatLoci(palace) : []);
  const showRooms = $derived(!!palace && (palace.rooms.length > 1 || !!palace.rooms[0]?.name));
  const filled = $derived(content && palace ? filledCount(content, palace) : 0);
  const due = $derived(content ? contentDue(content, palace) : null);
  const ov = $derived(content ? overlaps(content) : []);
  const weak = $derived(content ? new Set(weakKeys(content)) : new Set<string>());

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

  let pasteOpen = $state(false);
  let pasteText = $state('');
  let pasteStart = $state(1);
  const pasteLines = $derived(
    pasteText
      .split(/\r?\n/)
      .map((l) => l.replace(/^\s*\d+[.)-]\s*/, '').trim())
      .filter(Boolean),
  );

  function tapRow(i: number, locusId: string) {
    if (hide && !revealed[locusId]) {
      revealed[locusId] = true;
      haptic.tap();
      return;
    }
    nav.go({ name: 'fill', id, start: i });
  }

  /** Locus où reprendre le remplissage (0 = premier). */
  const resumeAt = $derived(content ? Math.max(0, flat.findIndex((f) => !content.items[f.locus.id]?.text)) : 0);
  const complete = $derived(flat.length > 0 && filled === flat.length);

  /* Arrivée depuis la recherche : défiler jusqu'à l'élément et le surligner. */
  let flash = $state<string | null>(null);
  $effect(() => {
    if (!focus) return;
    const f = focus;
    void tick().then(() => {
      document.querySelector(`[data-locus="${f}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      flash = f;
      setTimeout(() => (flash = null), 2600);
      const r = nav.current;
      if (r.name === 'content') r.focus = undefined;
    });
  });

  /* Collage : aperçu complet avant de placer. */
  const pastePreview = $derived(
    pasteLines.map((text, i) => ({ text, n: pasteStart + i, f: flat[pasteStart - 1 + i] })),
  );
  const missing = $derived(Math.max(0, pasteStart - 1 + pasteLines.length - flat.length));

  function createMissing() {
    if (!palace || missing <= 0) return;
    const room = palace.rooms[palace.rooms.length - 1];
    if (!room) return;
    // On fige les valeurs : `missing` et `flat` changent à chaque locus ajouté.
    const count = missing;
    const from = flat.length + 1;
    for (let k = 0; k < count; k++) addLocus(palace, room, `Locus ${from + k}`);
    toast(`${count} loci ajoutés au bout du trajet : renomme-les quand tu veux`);
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
              Partage des loci avec {#each ov as o, i (o.content.id)}{i ? (i === ov.length - 1 ? ' et ' : ', ') : ''}« {o.content.title} » ({o.count}){/each}.
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

      <History history={content.history} weak={weak.size} />

      <div class="cta px">
        <button class="btn filled lg block has-icon" onclick={() => nav.go({ name: 'fill', id, start: complete ? 0 : resumeAt })}>
          <Icon name="pencil" size={20} />{complete
            ? 'Revoir et modifier'
            : filled === 0
              ? 'Remplir'
              : `Remplir · reprendre au locus ${resumeAt + 1}`}
        </button>
      </div>
      <div class="chips">
        <button
          class="chip"
          onclick={() => {
            pasteStart = firstEmpty();
            pasteOpen = true;
          }}><Icon name="list" />Coller une liste</button
        >
        <button class="chip" disabled={filled === 0} onclick={() => (quizOpen = true)}><Icon name="play" />Tester</button>
        <button class="chip" onclick={() => nav.go({ name: 'walk', palaceId: palace.id, contentId: content.id })}>
          <Icon name="walk" />Promenade
        </button>
      </div>

      {#if hide}
        <p class="body-m onv px" style="margin-top: 12px">Touche une ligne pour révéler ce qui y est déposé.</p>
      {/if}

      {#each flat as f, i (f.locus.id)}
        {@const item = content.items[f.locus.id]}
        {@const newRoom = i === 0 || flat[i - 1]?.room.id !== f.room.id}
        {#if showRooms && newRoom}
          <h2 class="subheader">{f.room.name || 'Zone sans nom'}</h2>
        {:else if i > 0}
          <div class="divider"></div>
        {:else}
          <div style="height: 8px"></div>
        {/if}
        {@const others = item?.text && !content.archived ? neighbours(content, f.locus.id) : []}
        <button class="list-item two" class:flash={flash === f.locus.id} data-locus={f.locus.id} onclick={() => tapRow(i, f.locus.id)}>
          <span class="num" class:dashed={!item?.text} class:shared={others.length > 0} class:weakn={weak.has(f.locus.id)}>{f.n}</span>
          <span class="li-text">
            <span class="li-over ellipsis">{f.locus.name}</span>
            {#if item?.text}
              {#if hide && !revealed[f.locus.id]}
                <span class="masked"></span>
              {:else}
                {#if item.question}<span class="li-sup q">Q : {item.question}</span>{/if}
                <span class="value">{itemParts(item).join(' · ')}</span>
                {#if item.image}<span class="li-sup">{item.image}</span>{/if}
                {#if others.length}
                  <span class="also"><Icon name="layers" size={14} />Aussi ici : {others.map((o) => o.text).join(', ')}</span>
                {/if}
              {/if}
            {:else}
              <span class="li-sup">À remplir</span>
            {/if}
          </span>
        </button>
      {/each}
    {/if}
  </div>

  <!-- Coller une liste -->
  <Sheet bind:open={pasteOpen} title="Coller une liste">
    <label class="tf">
      <span>Ta liste (une ligne = un élément)</span>
      <textarea bind:value={pasteText} rows="4" placeholder={'Hydrogène\nHélium\nLithium'}></textarea>
    </label>
    {#if pasteLines.length > 0}
      <div class="row" style="justify-content: space-between; margin: -4px 0 6px">
        <span class="label-l primary">Aperçu</span>
        <span class="row" style="gap: 6px">
          <span class="body-m onv">Commencer au locus</span>
          <button class="step" disabled={pasteStart <= 1} onclick={() => (pasteStart = Math.max(1, pasteStart - 1))} aria-label="Moins"><Icon name="minus" size={16} /></button>
          <b class="stepv">{pasteStart}</b>
          <button class="step" disabled={pasteStart >= flat.length} onclick={() => (pasteStart = Math.min(flat.length, pasteStart + 1))} aria-label="Plus"><Icon name="plus" size={16} /></button>
        </span>
      </div>
      <div class="preview">
        {#each pastePreview.slice(0, 4) as r (r.n)}
          {@const replaced = r.f && content.items[r.f.locus.id]?.text}
          <div class="pv" class:warn={!r.f}>
            <span class="num">{r.n}</span>
            <span class="loc ellipsis">{r.f ? r.f.locus.name : 'pas de locus'}</span>
            <span class="onv">→</span>
            <b class="ellipsis">{r.text}</b>
            {#if replaced}<span class="label-m onv">remplace</span>{/if}
          </div>
        {/each}
        {#if pastePreview.length > 6}
          <div class="pv more body-m onv">⋮ {pastePreview.length - 6} autres</div>
        {/if}
        {#each pastePreview.slice(Math.max(4, pastePreview.length - 2)) as r (r.n)}
          <div class="pv" class:warn={!r.f}>
            <span class="num">{r.n}</span>
            <span class="loc ellipsis">{r.f ? r.f.locus.name : 'pas de locus'}</span>
            <span class="onv">→</span>
            <b class="ellipsis">{r.text}</b>
          </div>
        {/each}
      </div>
      {#if missing > 0}
        <div class="card-warn missing">
          <Icon name="alert" />
          <span class="body-m grow">Il manque {plural(missing, 'locus', 'loci')} dans ce palais</span>
          <button class="btn filled warn-fill" onclick={createMissing}>Créer {missing}</button>
        </div>
      {/if}
    {:else}
      <p class="body-m onv">Colle ou écris ta liste : tu verras exactement où chaque élément sera placé avant de valider.</p>
    {/if}
    {#snippet footer()}
      <button class="btn text" onclick={() => (pasteOpen = false)}>Annuler</button>
      <button class="btn filled" disabled={pasteLines.length === 0} onclick={doPaste}>
        Placer {pasteLines.length - missing > 0 ? pasteLines.length - missing : ''} élément{pasteLines.length - missing > 1 ? 's' : ''}
      </button>
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
    weak={weak.size}
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

  .num.weakn {
    box-shadow: 0 0 0 2px var(--error);
  }

  .q {
    font-style: italic;
  }

  .cta {
    margin-top: 16px;
  }

  .list-item.flash {
    background: var(--pc);
    border-radius: 16px;
    box-shadow: inset 0 0 0 2px var(--p);
  }

  .preview {
    display: flex;
    flex-direction: column;
  }

  .pv {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--divider);
    min-width: 0;
  }

  .pv .num {
    width: 30px;
    height: 30px;
    font-size: 13px;
  }

  .pv .loc {
    width: 120px;
    flex-shrink: 0;
    color: var(--onv);
    font-size: 14px;
  }

  .pv b {
    font-weight: 500;
    min-width: 0;
    flex: 1;
  }

  .pv.warn .num {
    background: var(--warn-c);
    color: var(--onwarn-c);
  }

  .pv.warn .loc {
    color: var(--warn);
  }

  .pv.more {
    justify-content: center;
    border: none;
  }

  .missing {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 12px;
    padding: 10px 10px 10px 14px;
  }

  .warn-fill {
    background: var(--warn);
    color: var(--warn-c);
    height: 36px;
    padding: 0 14px;
  }

  .step {
    width: 34px;
    height: 34px;
    border-radius: 50%;
    border: 1px solid var(--outline);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .step:disabled {
    opacity: 0.35;
  }

  .stepv {
    min-width: 22px;
    text-align: center;
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

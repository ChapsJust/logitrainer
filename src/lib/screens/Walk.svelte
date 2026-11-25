<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { contentsOf, getPalace, setItem, touch } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { flatLoci } from '../util';
  import { haptic } from '../haptics';

  let { palaceId, contentId }: { palaceId: string; contentId?: string } = $props();

  const palace = $derived(getPalace(palaceId));
  const flat = $derived(palace ? flatLoci(palace) : []);
  const contents = $derived(palace ? contentsOf(palace.id) : []);

  // svelte-ignore state_referenced_locally
  let selected = $state<string | undefined>(contentId);
  let index = $state(0);
  let revealed = $state(false);
  let autoReveal = $state(false);
  let dir = $state<1 | -1>(1);

  const content = $derived(contents.find((c) => c.id === selected));
  const step = $derived(flat[index]);
  const item = $derived(step && content ? content.items[step.locus.id] : undefined);
  const finished = $derived(index >= flat.length);
  const showAnswer = $derived(autoReveal || revealed);

  /* ---------- Corriger sur place ---------- */
  let editing = $state(false);
  let edA = $state('');
  let edB = $state('');

  function startEdit(e: Event) {
    e.stopPropagation();
    if (!step) return;
    if (content) {
      edA = item?.text ?? '';
      edB = item?.image ?? '';
    } else {
      edA = step.locus.name;
      edB = step.locus.description;
    }
    editing = true;
    revealed = true;
  }

  function saveEdit(e?: Event) {
    e?.stopPropagation();
    if (!step || !palace) return;
    if (content) setItem(content, step.locus.id, { text: edA, image: edB });
    else {
      step.locus.name = edA.trim() || step.locus.name;
      step.locus.description = edB.trim();
      touch(palace);
    }
    editing = false;
    haptic.tap();
  }

  function goTo(i: number) {
    if (i < 0 || i > flat.length) return;
    if (editing) saveEdit();
    dir = i > index ? 1 : -1;
    index = i;
    revealed = false;
    haptic.tick();
  }

  /* ---------- Glisser ---------- */
  let dx = $state(0);
  let dragging = $state(false);
  let startX = 0;
  let startY = 0;
  let moved = false;

  function down(e: PointerEvent) {
    if (editing) return;
    dragging = true;
    moved = false;
    startX = e.clientX;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }

  function move(e: PointerEvent) {
    if (!dragging) return;
    const x = e.clientX - startX;
    if (!moved && Math.abs(e.clientY - startY) > Math.abs(x) + 6) return;
    if (Math.abs(x) > 6) moved = true;
    // Résistance aux extrémités.
    const atEdge = (x > 0 && index === 0) || (x < 0 && index >= flat.length);
    dx = atEdge ? x / 3 : x;
  }

  function up() {
    if (!dragging) return;
    dragging = false;
    if (dx < -70) goTo(index + 1);
    else if (dx > 70) goTo(index - 1);
    dx = 0;
  }

  function tap() {
    if (moved || editing) return;
    if (content && item?.text && !showAnswer) {
      revealed = true;
      haptic.tap();
    } else {
      goTo(index + 1);
    }
  }

  function onKey(e: KeyboardEvent) {
    if (editing || (e.target as HTMLElement | null)?.closest('input, textarea')) return;
    if (e.key === 'ArrowRight') goTo(index + 1);
    else if (e.key === 'ArrowLeft') goTo(index - 1);
    else if (e.key === ' ') tap();
  }
</script>

<svelte:window onkeydown={onKey} />

{#if palace}
  <TopBar back navIcon="x" title="Promenade">
    {#snippet actions()}
      {#if content}
        <button
          class="icon-btn"
          class:on={autoReveal}
          onclick={() => (autoReveal = !autoReveal)}
          aria-label={autoReveal ? 'Cacher les réponses' : 'Tout afficher'}
        >
          <Icon name={autoReveal ? 'eye' : 'eyeOff'} size={22} />
        </button>
      {/if}
    {/snippet}
  </TopBar>

  <div class="page no-nav walk">
    {#if contents.length}
      <div class="chips" style="padding-top: 0">
        <button class="chip plain" class:selected={!selected} onclick={() => ((selected = undefined), (revealed = false))}>
          Trajet seul
        </button>
        {#each contents as c (c.id)}
          <button class="chip plain" class:selected={selected === c.id} onclick={() => ((selected = c.id), (revealed = false))}>
            {c.title}
          </button>
        {/each}
      </div>
    {/if}

    <div class="px" style="margin-top: 16px">
      <div class="progress"><span style:width="{(Math.min(index, flat.length) / flat.length) * 100}%"></span></div>
    </div>

    <div class="stage">
      {#key index}
        <div
          class="card"
          class:dragging
          class:from-left={dir === -1}
          role="button"
          tabindex="0"
          style:transform={dx ? `translateX(${dx}px)` : undefined}
          onpointerdown={down}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
          onclick={tap}
          onkeydown={() => {}}
        >
          {#if finished}
            <div class="end">
              <div class="medal"><Icon name="check" size={36} /></div>
              <p class="headline-s">Fin du parcours</p>
              <p class="body-l onv">{flat.length} loci parcourus dans {palace.name}.</p>
            </div>
          {:else if step}
            <div class="row">
              <span class="chip plain selected">Locus {step.n}</span>
              {#if step.room.name}<span class="chip plain">{step.room.name}</span>{/if}
              <span class="grow"></span>
              <span class="label-l onv">{step.n} / {flat.length}</span>
              {#if !editing}
                <button class="icon-btn edit" onclick={startEdit} onpointerdown={(e) => e.stopPropagation()} aria-label="Modifier">
                  <Icon name="pencil" size={20} />
                </button>
              {/if}
            </div>
            <p class="place">{step.locus.name || 'Sans nom'}</p>
            {#if step.locus.description}<p class="body-l onv">{step.locus.description}</p>{/if}

            {#if editing}
              <div class="answer" role="presentation" onclick={(e) => e.stopPropagation()} onpointerdown={(e) => e.stopPropagation()}>
                <label class="tf" style="margin-bottom: 10px">
                  <span>{content ? 'À retenir' : "Nom de l'endroit"}</span>
                  <!-- svelte-ignore a11y_autofocus -->
                  <input bind:value={edA} autofocus enterkeyhint="done" onkeydown={(e) => e.key === 'Enter' && saveEdit(e)} />
                </label>
                <label class="tf" style="margin-bottom: 10px">
                  <span>{content ? 'Image mentale' : 'Description'}</span>
                  <textarea bind:value={edB} rows="2"></textarea>
                </label>
                <div class="row" style="justify-content: flex-end">
                  <button class="btn text" onclick={(e) => ((editing = false), e.stopPropagation())}>Annuler</button>
                  <button class="btn filled has-icon" onclick={saveEdit}><Icon name="check" size={18} />OK</button>
                </div>
              </div>
            {:else if content}
              {#if item?.text}
                {#if showAnswer}
                  <div class="answer">
                    <p class="label-m primary">{content.title.toUpperCase()}</p>
                    <p class="answer-text">{item.text}</p>
                    {#if item.image}<p class="body-m onv">{item.image}</p>{/if}
                  </div>
                {:else}
                  <p class="hint label-l onv"><Icon name="eye" size={18} />Que vois-tu ici ? Touche pour révéler</p>
                {/if}
              {:else}
                <p class="hint label-l onv">
                  Rien de déposé ici
                  <button class="btn text" onclick={startEdit} onpointerdown={(e) => e.stopPropagation()}>Ajouter</button>
                </p>
              {/if}
            {:else}
              <p class="hint label-l onv">Visualise l'endroit, puis glisse vers la gauche</p>
            {/if}
          {/if}
        </div>
      {/key}
    </div>

    {#if finished}
      <div class="stack px">
        {#if content}
          <button class="btn filled lg block" onclick={() => nav.replace({ name: 'quiz', kind: 'content', id: content.id, order: 'forward' })}>
            Tester ce contenu
          </button>
        {/if}
        <button class="btn outlined lg block" onclick={() => goTo(0)}>Recommencer</button>
        <button class="btn text lg block" onclick={() => nav.back()}>Fermer</button>
      </div>
    {:else}
      <div class="nav-row px">
        <button class="btn tonal lg has-icon" disabled={index === 0} onclick={() => goTo(index - 1)} aria-label="Précédent">
          <Icon name="back" size={20} />
        </button>
        <button class="btn filled lg grow" onclick={() => goTo(index + 1)}>
          {index === flat.length - 1 ? 'Terminer' : 'Suivant'}
        </button>
      </div>
    {/if}
  </div>
{/if}

<style>
  .edit {
    width: 40px;
    height: 40px;
    margin: -8px -10px -8px 0;
  }

  .stage {
    padding: 16px;
  }

  .card {
    background: var(--surface-low);
    border-radius: 28px;
    padding: 24px;
    min-height: min(58dvh, 500px);
    display: flex;
    flex-direction: column;
    gap: 6px;
    touch-action: pan-y;
    transition: transform 0.25s var(--ease);
    animation: in-right 0.28s var(--ease);
    cursor: pointer;
  }

  .card.from-left {
    animation-name: in-left;
  }

  .card.dragging {
    transition: none;
  }

  @keyframes in-right {
    from {
      opacity: 0;
      transform: translateX(40px);
    }
  }

  @keyframes in-left {
    from {
      opacity: 0;
      transform: translateX(-40px);
    }
  }

  .place {
    font-size: 40px;
    line-height: 48px;
    letter-spacing: -0.01em;
    margin-top: 24px;
    overflow-wrap: anywhere;
  }

  .answer {
    margin-top: auto;
    background: var(--surface);
    border-radius: 20px;
    padding: 16px 20px;
    animation: in-right 0.2s var(--ease);
  }

  .answer-text {
    font-size: 30px;
    line-height: 38px;
    font-weight: 500;
    color: var(--p);
    overflow-wrap: anywhere;
  }

  .hint {
    margin-top: auto;
    align-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
    text-align: center;
  }

  .end {
    margin: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }

  .medal {
    width: 80px;
    height: 80px;
    border-radius: 28px;
    background: var(--pc);
    color: var(--onpc);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .nav-row {
    display: flex;
    gap: 12px;
  }

  .nav-row .btn:first-child {
    width: 72px;
    padding: 0;
  }
</style>

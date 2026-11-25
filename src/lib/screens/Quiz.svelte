<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { db, getContent, getPalace, recordQuiz } from '../store.svelte';
  import { nav, type QuizKind, type QuizOrder } from '../nav.svelte';
  import { flatLoci, shuffle } from '../util';
  import { majorHint } from '../major';
  import { dueLabel } from '../review';
  import { haptic } from '../haptics';

  interface Card {
    key: string;
    chips: string[];
    prompt: string;
    sub?: string;
    answer: string;
    extra?: string;
  }

  let { kind, id, order }: { kind: QuizKind; id?: string; order: QuizOrder } = $props();

  function buildCards(): { title: string; cards: Card[] } {
    if (kind === 'numbers') {
      const keys = Object.keys(db.numbers)
        .filter((k) => db.numbers[k]?.trim())
        .sort();
      return {
        title: 'Nombres',
        cards: keys.map((k) => ({ key: k, chips: ['Nombre'], prompt: k, sub: majorHint(k), answer: db.numbers[k] ?? '' })),
      };
    }
    if (kind === 'content') {
      const c = id ? getContent(id) : undefined;
      const p = c ? getPalace(c.palaceId) : undefined;
      if (!c || !p) return { title: '', cards: [] };
      const cards = flatLoci(p)
        .filter((f) => c.items[f.locus.id]?.text)
        .map((f) => ({
          key: f.locus.id,
          chips: [`Locus ${f.n}`, ...(f.room.name ? [f.room.name] : [])],
          prompt: f.locus.name || `Locus ${f.n}`,
          sub: f.locus.description,
          answer: c.items[f.locus.id]?.text ?? '',
          extra: c.items[f.locus.id]?.image,
        }));
      return { title: c.title, cards };
    }
    const p = id ? getPalace(id) : undefined;
    if (!p) return { title: '', cards: [] };
    const cards = flatLoci(p).map((f) => ({
      key: f.locus.id,
      chips: f.room.name ? [f.room.name] : ['Trajet'],
      prompt: `Locus ${f.n}`,
      sub: 'Quel est cet endroit ?',
      answer: f.locus.name,
      extra: f.locus.description,
    }));
    return { title: p.name, cards };
  }

  function ordered(cards: Card[], o: QuizOrder): Card[] {
    if (o === 'backward') return [...cards].reverse();
    if (o === 'random') return shuffle(cards);
    return cards;
  }

  // svelte-ignore state_referenced_locally
  const built = buildCards();
  // svelte-ignore state_referenced_locally
  let deck = $state(ordered(built.cards, order));
  let index = $state(0);
  let shown = $state(false);
  let missed = $state<Card[]>([]);
  let isRetry = $state(false);
  let nextDue = $state<number | null>(null);
  const done = $derived(index >= deck.length);
  const card = $derived(deck[index]);

  /* ---------- Glisser la carte ---------- */
  let dx = $state(0);
  let dragging = $state(false);
  let flying = $state<0 | 1 | -1>(0);
  let startX = 0;
  let startY = 0;
  let moved = false;
  const THRESHOLD = 90;

  function down(e: PointerEvent) {
    if (!shown || flying) return;
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
    const crossed = Math.abs(dx) >= THRESHOLD;
    dx = x;
    if (crossed !== Math.abs(dx) >= THRESHOLD) haptic.tick();
  }

  function up() {
    if (!dragging) return;
    dragging = false;
    if (dx >= THRESHOLD) fly(1);
    else if (dx <= -THRESHOLD) fly(-1);
    else dx = 0;
  }

  function fly(dir: 1 | -1) {
    flying = dir;
    moved = false;
    setTimeout(() => {
      answer(dir === 1);
      flying = 0;
      dx = 0;
    }, 180);
  }

  function reveal() {
    if (shown) return;
    shown = true;
    haptic.tap();
  }

  function tapCard() {
    if (moved) return;
    reveal();
  }

  function answer(knew: boolean) {
    if (!knew && card) missed.push(card);
    haptic.tap();
    shown = false;
    index++;
    if (index >= deck.length) finish();
  }

  function finish() {
    haptic.success();
    if (isRetry) return;
    const result = { at: Date.now(), score: deck.length - missed.length, total: deck.length };
    const target = kind === 'content' && id ? getContent(id) : kind === 'trajet' && id ? getPalace(id) : undefined;
    if (target) {
      recordQuiz(target, result);
      nextDue = target.review?.due ?? null;
    }
  }

  function retryMissed() {
    deck = ordered(missed, order === 'random' ? 'random' : 'forward');
    missed = [];
    index = 0;
    shown = false;
    isRetry = true;
  }

  function restart() {
    deck = ordered(built.cards, order);
    missed = [];
    index = 0;
    shown = false;
    isRetry = false;
  }

  function onKey(e: KeyboardEvent) {
    if (done) return;
    if (!shown && (e.key === ' ' || e.key === 'Enter')) reveal();
    else if (shown && e.key === 'ArrowRight') answer(true);
    else if (shown && e.key === 'ArrowLeft') answer(false);
  }
</script>

<svelte:window onkeydown={onKey} />

<TopBar back navIcon="x" title={built.title}>
  {#snippet actions()}
    {#if !done && deck.length}<span class="label-l onv count">{index + 1} / {deck.length}</span>{/if}
  {/snippet}
</TopBar>

<div class="page no-nav quiz">
  {#if deck.length === 0}
    <div class="empty">
      <div class="art"><Icon name="info" size={32} /></div>
      <p class="title-m" style="color: var(--on)">Rien à tester pour l'instant</p>
    </div>
  {:else if done}
    {@const score = deck.length - missed.length}
    {@const perfect = score === deck.length}
    <div class="result">
      <div class="medal" class:perfect><Icon name={perfect ? 'trophy' : 'refresh'} size={36} /></div>
      <p class="headline-l">{score} / {deck.length}</p>
      <p class="body-l onv">
        {perfect ? 'Parfait, ce palais est solide.' : score / deck.length >= 0.6 ? 'Pas mal. Revois les ratés.' : 'À retravailler, revois les ratés.'}
      </p>
      {#if nextDue !== null}
        <p class="chip plain next"><Icon name="calendar" size={18} />Prochaine révision {dueLabel(nextDue)}</p>
      {/if}
    </div>

    {#if missed.length}
      <h2 class="subheader">À revoir</h2>
      {#each missed as m, i (m.key)}
        {#if i > 0}<div class="divider" style="margin-left: 16px"></div>{/if}
        <div class="list-item two">
          <span class="li-text">
            <span class="li-over">{m.chips.join(' · ')} · {m.prompt}</span>
            <span class="li-head" style="font-weight: 500">{m.answer}</span>
            {#if m.extra}<span class="li-sup">{m.extra}</span>{/if}
          </span>
        </div>
      {/each}
    {/if}

    <div class="stack px" style="margin-top: 24px">
      {#if missed.length}
        <button class="btn filled lg block" onclick={retryMissed}>Refaire les {missed.length} ratés</button>
      {/if}
      <button class="btn outlined lg block" onclick={restart}>Recommencer</button>
      <button class="btn text lg block" onclick={() => nav.back()}>Fermer</button>
    </div>
  {:else if card}
    <div class="px"><div class="progress"><span style:width="{(index / deck.length) * 100}%"></span></div></div>

    <div class="stage">
      {#key card.key}
        <div
          class="card"
          class:dragging
          class:flying={flying !== 0}
          role="button"
          tabindex="0"
          style:transform={flying
            ? `translateX(${flying * 120}%) rotate(${flying * 12}deg)`
            : dx
              ? `translateX(${dx}px) rotate(${dx / 22}deg)`
              : undefined}
          onpointerdown={down}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
          onclick={tapCard}
          onkeydown={() => {}}
        >
          <div aria-hidden="true" class="tint good" style:opacity={dx > 0 ? Math.min(dx / THRESHOLD, 1) : 0}>
            <Icon name="check" />Je savais
          </div>
          <div aria-hidden="true" class="tint bad" style:opacity={dx < 0 ? Math.min(-dx / THRESHOLD, 1) : 0}>
            <Icon name="x" />Raté
          </div>

          <div class="row" style="flex-wrap: wrap">
            {#each card.chips as c, ci (ci)}
              <span class="chip plain" class:selected={ci === 0}>{c}</span>
            {/each}
          </div>
          <p class="prompt">{card.prompt}</p>
          {#if card.sub}<p class="body-l onv">{card.sub}</p>{/if}

          {#if shown}
            <div class="answer">
              <p class="label-m primary">RÉPONSE</p>
              <p class="answer-text">{card.answer}</p>
              {#if card.extra}<p class="body-m onv">{card.extra}</p>{/if}
            </div>
          {:else}
            <p class="reveal label-l onv"><Icon name="eye" size={18} />Toucher pour révéler</p>
          {/if}
        </div>
      {/key}
    </div>

    <div class="actions px">
      {#if shown}
        <button class="btn danger lg grow has-icon" onclick={() => fly(-1)}><Icon name="x" size={20} />Raté</button>
        <button class="btn filled lg grow has-icon" onclick={() => fly(1)}><Icon name="check" size={20} />Je savais</button>
      {:else}
        <button class="btn tonal lg grow" onclick={reveal}>Révéler</button>
      {/if}
    </div>
    {#if shown}<p class="label-m onv swipe-hint">Ou glisse la carte : → je savais, ← raté</p>{/if}
  {/if}
</div>

<style>
  .count {
    padding-right: 16px;
  }

  .stage {
    padding: 16px;
  }

  .card {
    position: relative;
    background: var(--surface-low);
    border-radius: 28px;
    padding: 24px;
    min-height: min(56dvh, 480px);
    display: flex;
    flex-direction: column;
    gap: 6px;
    touch-action: pan-y;
    transition: transform 0.25s var(--ease);
    animation: deal 0.3s var(--ease);
    cursor: pointer;
    overflow: hidden;
  }

  .card.dragging {
    transition: none;
  }

  .card.flying {
    transition: transform 0.18s ease-in;
  }

  @keyframes deal {
    from {
      opacity: 0;
      transform: translateY(16px) scale(0.98);
    }
  }

  .tint {
    position: absolute;
    top: 20px;
    padding: 6px 14px 6px 10px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
    pointer-events: none;
    z-index: 2;
  }

  .tint.good {
    right: 20px;
    background: var(--p);
    color: var(--onp);
  }

  .tint.bad {
    left: 20px;
    background: var(--ec);
    color: var(--onec);
  }

  .prompt {
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
    animation: deal 0.25s var(--ease);
  }

  .answer-text {
    font-size: 30px;
    line-height: 38px;
    font-weight: 500;
    color: var(--p);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .reveal {
    margin-top: auto;
    align-self: center;
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .actions {
    display: flex;
    gap: 12px;
  }

  .swipe-hint {
    text-align: center;
    margin-top: 12px;
  }

  .result {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 32px 24px 8px;
  }

  .medal {
    width: 80px;
    height: 80px;
    border-radius: 28px;
    background: var(--sc);
    color: var(--onsc);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 8px;
  }

  .medal.perfect {
    background: var(--pc);
    color: var(--onpc);
  }

  .next {
    margin-top: 8px;
    padding-left: 12px;
  }
</style>

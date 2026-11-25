<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import { db, getContent, getPalace, recordQuiz } from '../store.svelte';
  import { nav, type QuizKind, type QuizOrder } from '../nav.svelte';
  import { flatLoci, shuffle } from '../util';
  import { majorHint } from '../major';

  interface Card {
    key: string;
    tag: string;
    prompt: string;
    sub?: string;
    answer: string;
    extra?: string;
  }

  let { kind, id, order }: { kind: QuizKind; id?: string; order: QuizOrder } = $props();

  function buildCards(): { title: string; cards: Card[] } {
    if (kind === 'numbers') {
      const keys = Object.keys(db.numbers).filter((k) => db.numbers[k]?.trim()).sort();
      return {
        title: 'Système de nombres',
        cards: keys.map((k) => ({ key: k, tag: 'Nombre', prompt: k, sub: majorHint(k), answer: db.numbers[k] ?? '' })),
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
          tag: `Locus n° ${f.n}${f.room.name ? ' · ' + f.room.name : ''}`,
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
      tag: f.room.name || 'Trajet',
      prompt: `n° ${f.n}`,
      sub: 'Quel est ce locus ?',
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
  const done = $derived(index >= deck.length);
  const card = $derived(deck[index]);

  function answer(knew: boolean) {
    if (!knew && card) missed.push(card);
    shown = false;
    index++;
    if (index >= deck.length && !isRetry) save();
  }

  function save() {
    const result = { at: Date.now(), score: deck.length - missed.length, total: deck.length };
    if (kind === 'content' && id) {
      const c = getContent(id);
      if (c) recordQuiz(c, result);
    } else if (kind === 'trajet' && id) {
      const p = getPalace(id);
      if (p) recordQuiz(p, result);
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
</script>

<TopBar back title={built.title} subtitle={done ? 'Terminé' : `${index + 1} / ${deck.length}`} />

<div class="page no-nav quiz">
  {#if deck.length === 0}
    <div class="empty card">
      <div class="big">🤷</div>
      <p class="muted">Rien à tester pour l'instant.</p>
    </div>
  {:else if done}
    {@const score = deck.length - missed.length}
    <div class="card result">
      <div class="big">{score === deck.length ? '🏆' : score / deck.length >= 0.7 ? '💪' : '🧠'}</div>
      <h2>{score} / {deck.length}</h2>
      <p class="muted">
        {score === deck.length ? 'Parfait ! Ton palais est solide.' : 'Revois les ratés, puis reteste-toi plus tard.'}
      </p>
    </div>

    {#if missed.length}
      <p class="section-title">À revoir</p>
      <div class="card">
        {#each missed as m (m.key)}
          <div class="miss">
            <span class="muted small">{m.tag} · {m.prompt}</span>
            <b>{m.answer}</b>
            {#if m.extra}<span class="muted small">{m.extra}</span>{/if}
          </div>
        {/each}
      </div>
    {/if}

    <div class="stack" style="margin-top: 16px">
      {#if missed.length}
        <button class="btn primary block" onclick={retryMissed}>Refaire les {missed.length} ratés</button>
      {/if}
      <button class="btn block" onclick={restart}>Recommencer</button>
      <button class="btn ghost block" onclick={() => nav.back()}>Fermer</button>
    </div>
  {:else if card}
    <div class="progress"><span style:width={`${(index / deck.length) * 100}%`}></span></div>

    <button class="card flash" onclick={() => (shown = true)}>
      <span class="tag">{card.tag}</span>
      <span class="prompt">{card.prompt}</span>
      {#if card.sub}<span class="muted sub">{card.sub}</span>{/if}

      <span class="divider"></span>

      {#if shown}
        <span class="answer">{card.answer}</span>
        {#if card.extra}<span class="muted extra">{card.extra}</span>{/if}
      {:else}
        <span class="reveal">Touche pour révéler</span>
      {/if}
    </button>

    <div class="actions">
      {#if shown}
        <button class="btn danger grow big-btn" onclick={() => answer(false)}>✗ Raté</button>
        <button class="btn good grow big-btn" onclick={() => answer(true)}>✓ Je savais</button>
      {:else}
        <button class="btn primary grow big-btn" onclick={() => (shown = true)}>Révéler</button>
      {/if}
    </div>
  {/if}
</div>

<style>
  .quiz {
    display: flex;
    flex-direction: column;
  }

  .progress {
    height: 6px;
    border-radius: 3px;
    background: var(--surface-2);
    overflow: hidden;
    margin: 4px 0 16px;
  }

  .progress span {
    display: block;
    height: 100%;
    background: var(--accent);
    transition: width 0.2s;
  }

  .flash {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 28px 20px;
    min-height: 46dvh;
    justify-content: center;
    width: 100%;
  }

  .tag {
    font-size: 0.8rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--accent);
  }

  .prompt {
    font-size: 2rem;
    font-weight: 800;
    overflow-wrap: anywhere;
  }

  .sub {
    font-size: 0.95rem;
  }

  .divider {
    width: 60px;
    height: 2px;
    background: var(--border);
    margin: 14px 0;
  }

  .answer {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--accent);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .extra {
    font-style: italic;
  }

  .reveal {
    color: var(--muted);
    font-weight: 600;
  }

  .actions {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }

  .big-btn {
    min-height: 60px;
    font-size: 1.1rem;
  }

  .result {
    text-align: center;
    padding: 28px 20px;
  }

  .result .big {
    font-size: 3rem;
  }

  .result h2 {
    font-size: 2rem;
    margin: 6px 0;
  }

  .miss {
    display: flex;
    flex-direction: column;
    padding: 12px 14px;
    border-bottom: 1px solid var(--border);
  }
</style>

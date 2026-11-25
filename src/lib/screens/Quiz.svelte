<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { db, getContent, getPalace, recordQuiz } from '../store.svelte';
  import { nav, type QuizKind, type QuizOrder } from '../nav.svelte';
  import { flatLoci, isNative, shuffle } from '../util';
  import { majorHint } from '../major';
  import { dueLabel } from '../review';
  import { haptic } from '../haptics';
  import { compare, type MatchResult } from '../match';
  import { ensureMicPermission, listen, speechAvailable, type Listening } from '../speech';
  import { neighbours } from '../interference';
  import { askNotificationPermission, DEFAULT_TIME, syncReminders } from '../reminders';
  import { toast } from '../app.svelte';

  type Grade = 'known' | 'partial' | 'missed';

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
  const content = kind === 'content' && id ? getContent(id) : undefined;
  // svelte-ignore state_referenced_locally
  let deck = $state(ordered(built.cards, order));
  let index = $state(0);
  let results = $state<{ card: Card; grade: Grade }[]>([]);
  let isRetry = $state(false);
  let nextDue = $state<number | null>(null);
  const done = $derived(index >= deck.length);
  const card = $derived(deck[index]);

  /* ---------- Réciter ---------- */
  const recite = db.settings.recite ?? true;
  let canSpeak = $state(false);
  void speechAvailable().then((v) => (canSpeak = v));

  let phase = $state<'ask' | 'listening' | 'typing' | 'shown'>('ask');
  let transcript = $state('');
  let typed = $state('');
  let match = $state<MatchResult | null>(null);
  let said = $state('');
  let session: Listening | null = null;
  let typeInput: HTMLInputElement | undefined = $state();

  async function startListening() {
    if (!(await ensureMicPermission())) {
      toast('Micro non autorisé : tu peux écrire ta réponse.');
      startTyping();
      return;
    }
    haptic.medium();
    transcript = '';
    phase = 'listening';
    session = listen((t) => (transcript = t));
    const alternatives = await session.done;
    session = null;
    if (phase !== 'listening') return;
    finishAttempt(alternatives.length ? alternatives : transcript ? [transcript] : []);
  }

  function stopListening() {
    session?.stop();
  }

  function startTyping() {
    typed = '';
    phase = 'typing';
    setTimeout(() => typeInput?.focus(), 50);
  }

  function finishAttempt(attempts: string[]) {
    if (!card) return;
    said = attempts[0] ?? '';
    match = attempts.length && said.trim() ? compare(card.answer, attempts) : null;
    phase = 'shown';
    haptic.tap();
  }

  function reveal() {
    if (phase === 'shown') return;
    session?.stop();
    match = null;
    said = '';
    phase = 'shown';
    haptic.tap();
  }

  /* ---------- Glisser la carte ---------- */
  let dx = $state(0);
  let dragging = $state(false);
  let flying = $state<0 | 1 | -1>(0);
  let startX = 0;
  let startY = 0;
  let moved = false;
  const THRESHOLD = 90;

  function down(e: PointerEvent) {
    if (phase !== 'shown' || flying) return;
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
    if (dx >= THRESHOLD) grade('known');
    else if (dx <= -THRESHOLD) grade('missed');
    else dx = 0;
  }

  function tapCard() {
    if (moved) return;
    if (phase === 'ask' && !(recite && kind !== 'numbers')) reveal();
  }

  function grade(g: Grade) {
    if (!card || flying) return;
    flying = g === 'missed' ? -1 : 1;
    moved = false;
    haptic.tap();
    const c = card;
    setTimeout(() => {
      results.push({ card: c, grade: g });
      flying = 0;
      dx = 0;
      phase = 'ask';
      match = null;
      said = '';
      index++;
      if (index >= deck.length) finish();
    }, 180);
  }

  const points = (r: { grade: Grade }[]) => r.reduce((s, x) => s + (x.grade === 'known' ? 1 : x.grade === 'partial' ? 0.5 : 0), 0);
  const fmt = (n: number) => String(n).replace('.', ',');

  function finish() {
    haptic.success();
    if (isRetry) return;
    const result = { at: Date.now(), score: points(results), total: deck.length };
    const target = kind === 'content' && id ? getContent(id) : kind === 'trajet' && id ? getPalace(id) : undefined;
    if (target) {
      recordQuiz(target, result);
      nextDue = target.review?.due ?? null;
      void syncReminders();
    }
  }

  const toReview = $derived(results.filter((r) => r.grade !== 'known'));
  const sharedMisses = $derived(
    content ? toReview.map((r) => ({ ...r, others: neighbours(content, r.card.key) })).filter((r) => r.others.length) : [],
  );

  function retry() {
    deck = ordered(
      toReview.map((r) => r.card),
      order === 'random' ? 'random' : 'forward',
    );
    results = [];
    index = 0;
    phase = 'ask';
    isRetry = true;
  }

  function restart() {
    deck = ordered(built.cards, order);
    results = [];
    index = 0;
    phase = 'ask';
    isRetry = false;
  }

  /* ---------- Proposer le rappel ---------- */
  // svelte-ignore state_referenced_locally
  let showReminderOffer = $state(
    isNative() && kind !== 'numbers' && !db.settings.reminder?.enabled && !db.settings.reminderAsked,
  );

  async function enableReminder() {
    db.settings.reminderAsked = true;
    showReminderOffer = false;
    if (await askNotificationPermission()) {
      db.settings.reminder = { enabled: true, time: db.settings.reminder?.time ?? DEFAULT_TIME };
      await syncReminders();
      toast('Rappel activé à 19 h les jours de révision');
    } else {
      toast('Notifications refusées : tu pourras les activer dans Réglages.');
    }
  }

  function onKey(e: KeyboardEvent) {
    if (done || phase === 'typing') return;
    if (phase === 'ask' && (e.key === ' ' || e.key === 'Enter')) reveal();
    else if (phase === 'shown' && e.key === 'ArrowRight') grade('known');
    else if (phase === 'shown' && e.key === 'ArrowLeft') grade('missed');
  }

  $effect(() => () => session?.stop());
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
    {@const score = points(results)}
    {@const perfect = score === deck.length}
    <div class="result">
      <div class="medal" class:perfect><Icon name={perfect ? 'trophy' : 'refresh'} size={36} /></div>
      <p class="headline-l">{fmt(score)} / {deck.length}</p>
      <p class="body-l onv">
        {perfect ? 'Parfait, ce palais est solide.' : score / deck.length >= 0.6 ? 'Pas mal. Revois ceux qui ont coincé.' : 'À retravailler. Revois ceux qui ont coincé.'}
      </p>
      {#if nextDue !== null}
        <p class="chip plain next"><Icon name="calendar" size={18} />Prochaine révision {dueLabel(nextDue)}</p>
      {/if}
    </div>

    {#if showReminderOffer && !isRetry}
      <div class="card-tonal offer">
        <p class="title-m">Un rappel le jour où réviser ?</p>
        <p class="body-m" style="opacity: 0.85">
          Une notification à 19 h, seulement les jours où un palais est à revoir. Rien les autres jours.
        </p>
        <div class="row" style="margin-top: 10px; gap: 4px">
          <button class="btn filled" onclick={enableReminder}>Activer</button>
          <button
            class="btn text"
            onclick={() => {
              db.settings.reminderAsked = true;
              showReminderOffer = false;
            }}>Non merci</button
          >
        </div>
      </div>
    {/if}

    {#if sharedMisses.length}
      {@const names = [...new Set(sharedMisses.flatMap((r) => r.others.map((o) => o.content.title)))]}
      <div class="card-warn warn">
        <Icon name="layers" />
        <div class="grow">
          <p class="title-m">Possible mélange avec « {names.join(' », « ')} »</p>
          <p class="body-m">
            {sharedMisses.length} des loci qui ont coincé portent aussi un autre contenu. Archive l'ancien ou déplace celui-ci
            dans un palais libre.
          </p>
          {#if content}
            <button class="btn text warn-btn" onclick={() => nav.replace({ name: 'content', id: content.id })}>Régler ça</button>
          {/if}
        </div>
      </div>
    {/if}

    {#if toReview.length}
      <h2 class="subheader">À revoir</h2>
      {#each toReview as r, i (r.card.key)}
        {@const others = content ? neighbours(content, r.card.key) : []}
        {#if i > 0}<div class="divider" style="margin-left: 16px"></div>{/if}
        <div class="list-item two">
          <span class="li-text">
            <span class="li-over">{r.card.chips.join(' · ')} · {r.card.prompt}{r.grade === 'partial' ? ' · à moitié' : ''}</span>
            <span class="li-head" style="font-weight: 500">{r.card.answer}</span>
            {#if r.card.extra}<span class="li-sup">{r.card.extra}</span>{/if}
            {#if others.length}
              <span class="also"><Icon name="layers" size={14} />Aussi ici : {others.map((o) => `${o.text} (${o.content.title})`).join(', ')}</span>
            {/if}
          </span>
        </div>
      {/each}
    {/if}

    <div class="stack px" style="margin-top: 24px">
      {#if toReview.length}
        <button class="btn filled lg block" onclick={retry}>Refaire les {toReview.length} à revoir</button>
      {/if}
      <button class="btn outlined lg block" onclick={restart}>Recommencer</button>
      <button class="btn text lg block" onclick={() => nav.back()}>Fermer</button>
    </div>
  {:else if card}
    {@const speaking = recite && kind !== 'numbers'}
    <div class="px"><div class="progress"><span style:width="{(index / deck.length) * 100}%"></span></div></div>

    <div class="stage">
      {#key card.key + index}
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
            <Icon name="check" />Su
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

          {#if phase === 'shown'}
            <div class="answer">
              {#if said}
                <p class="label-m onv">TU AS DIT</p>
                <p class="body-l said">« {said} »</p>
              {/if}
              <p class="label-m primary">RÉPONSE</p>
              <p class="answer-text">
                {#if match}
                  {#each match.words as w, wi (wi)}<span class:hit={w.key && w.found} class:miss={w.key && !w.found}>{w.text}</span>{' '}{/each}
                {:else}
                  {card.answer}
                {/if}
              </p>
              {#if card.extra}<p class="body-m onv">{card.extra}</p>{/if}
              {#if match}
                <p class="label-l score" class:good={match.grade === 'known'}>
                  {match.found} mot{match.found > 1 ? 's' : ''} clé{match.found > 1 ? 's' : ''} sur {match.total} retrouvé{match.found > 1 ? 's' : ''}
                </p>
              {/if}
            </div>
          {:else if phase === 'listening'}
            <div class="listening">
              <span class="mic-pulse"><Icon name="mic" size={28} /></span>
              <p class="body-l live">{transcript || 'Je t’écoute…'}</p>
            </div>
          {:else if phase === 'typing'}
            <form
              class="typing"
              onsubmit={(e) => {
                e.preventDefault();
                finishAttempt(typed.trim() ? [typed] : []);
              }}
            >
              <label class="tf" style="margin: 0">
                <span>Ta réponse</span>
                <input bind:this={typeInput} bind:value={typed} enterkeyhint="done" autocomplete="off" />
              </label>
            </form>
          {:else if !speaking}
            <p class="reveal label-l onv"><Icon name="eye" size={18} />Toucher pour révéler</p>
          {:else}
            <p class="reveal label-l onv">
              <Icon name={canSpeak ? 'mic' : 'pencil'} size={18} />{canSpeak ? 'Dis ta réponse à voix haute' : 'Écris ta réponse avant de regarder'}
            </p>
          {/if}
        </div>
      {/key}
    </div>

    <div class="actions px">
      {#if phase === 'shown'}
        {@const suggested = match?.grade}
        <button class="btn lg grow" class:danger={suggested === 'missed' || !suggested} class:outlined={suggested && suggested !== 'missed'} onclick={() => grade('missed')}>
          Raté
        </button>
        <button class="btn lg grow" class:filled={suggested === 'partial'} class:tonal={suggested !== 'partial'} onclick={() => grade('partial')}>
          À moitié
        </button>
        <button class="btn lg grow" class:filled={suggested === 'known' || !suggested} class:outlined={suggested && suggested !== 'known'} onclick={() => grade('known')}>
          Su
        </button>
      {:else if phase === 'listening'}
        <button class="btn filled lg grow has-icon" onclick={stopListening}><Icon name="check" size={20} />J'ai fini</button>
      {:else if phase === 'typing'}
        <button class="btn text lg" onclick={reveal}>Je ne sais pas</button>
        <button class="btn filled lg grow" onclick={() => finishAttempt(typed.trim() ? [typed] : [])}>Valider</button>
      {:else if speaking && canSpeak}
        <button class="btn tonal lg has-icon" onclick={startTyping} aria-label="Écrire"><Icon name="pencil" size={20} /></button>
        <button class="btn filled lg grow has-icon mic-btn" onclick={startListening}><Icon name="mic" size={22} />Réciter</button>
        <button class="btn tonal lg" onclick={reveal}>Révéler</button>
      {:else if speaking}
        <button class="btn tonal lg" onclick={reveal}>Révéler</button>
        <button class="btn filled lg grow has-icon" onclick={startTyping}><Icon name="pencil" size={20} />Écrire ma réponse</button>
      {:else}
        <button class="btn tonal lg grow" onclick={reveal}>Révéler</button>
      {/if}
    </div>
    {#if phase === 'shown'}
      <p class="label-m onv hint">{match ? 'Note suggérée selon ta réponse. ' : ''}Ou glisse la carte : → su, ← raté</p>
    {/if}
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
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .said {
    font-style: italic;
    margin-bottom: 10px;
    overflow-wrap: anywhere;
  }

  .answer-text {
    font-size: 30px;
    line-height: 40px;
    font-weight: 500;
    color: var(--p);
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }

  .answer-text .hit {
    background: var(--pc);
    color: var(--onpc);
    border-radius: 8px;
    padding: 0 4px;
  }

  .answer-text .miss {
    text-decoration: underline wavy var(--error);
    text-underline-offset: 6px;
    text-decoration-thickness: 2px;
  }

  .score {
    margin-top: 8px;
    color: var(--warn);
  }

  .score.good {
    color: var(--p);
  }

  .listening {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }

  .mic-pulse {
    width: 72px;
    height: 72px;
    border-radius: 50%;
    background: var(--p);
    color: var(--onp);
    display: flex;
    align-items: center;
    justify-content: center;
    animation: pulse 1.4s ease-in-out infinite;
  }

  @keyframes pulse {
    0%,
    100% {
      box-shadow: 0 0 0 0 color-mix(in srgb, var(--p) 45%, transparent);
    }
    50% {
      box-shadow: 0 0 0 18px color-mix(in srgb, var(--p) 0%, transparent);
    }
  }

  .live {
    min-height: 48px;
    color: var(--onv);
    font-style: italic;
  }

  .typing {
    margin-top: auto;
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
    gap: 8px;
  }

  .actions .btn {
    padding: 0 16px;
  }

  .mic-btn {
    font-size: 17px;
  }

  .hint {
    text-align: center;
    margin-top: 12px;
    padding: 0 16px;
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

  .offer {
    margin: 16px 16px 0;
  }

  .warn {
    margin: 16px 16px 0;
    display: flex;
    gap: 12px;
    align-items: flex-start;
  }

  .warn-btn {
    color: var(--onwarn-c);
    margin: 6px 0 -8px -12px;
    font-weight: 600;
  }

  .also {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--warn);
    margin-top: 2px;
  }
</style>

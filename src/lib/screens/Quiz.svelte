<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { db, getContent, getPalace, itemParts, recordQuiz } from '../store.svelte';
  import { nav, sessionRoute, type QuizKind, type QuizOrder } from '../nav.svelte';
  import { flatLoci, isNative, shuffle } from '../util';
  import { majorHint } from '../major';
  import { dueLabel } from '../review';
  import { haptic } from '../haptics';
  import { compareParts, type MatchResult } from '../match';
  import { ensureMicPermission, listenLong, speechAvailable, type Listening } from '../speech';
  import { neighbours } from '../interference';
  import { askNotificationPermission, DEFAULT_TIME, syncReminders } from '../reminders';
  import { toast } from '../app.svelte';

  type Grade = 'known' | 'partial' | 'missed';

  interface Card {
    key: string;
    chips: string[];
    prompt: string;
    sub?: string;
    /** Éléments attendus (1 à 4). */
    parts: string[];
    extra?: string;
  }

  let {
    kind,
    id,
    order,
    weakOnly = false,
    session = [],
  }: { kind: QuizKind; id?: string; order: QuizOrder; weakOnly?: boolean; session?: string[] } = $props();

  function buildCards(): { title: string; cards: Card[] } {
    if (kind === 'numbers') {
      const keys = Object.keys(db.numbers)
        .filter((k) => db.numbers[k]?.trim())
        .sort();
      return {
        title: 'Nombres',
        cards: keys.map((k) => ({ key: k, chips: ['Nombre'], prompt: k, sub: `sons ${majorHint(k)}`, parts: [db.numbers[k] ?? ''] })),
      };
    }
    if (kind === 'content') {
      const c = id ? getContent(id) : undefined;
      const p = c ? getPalace(c.palaceId) : undefined;
      if (!c || !p) return { title: '', cards: [] };
      const weak = new Set(Object.entries(c.weak ?? {}).filter(([, n]) => n >= 2).map(([k]) => k));
      const cards = flatLoci(p)
        .filter((f) => itemParts(c.items[f.locus.id]).length && (!weakOnly || weak.has(f.locus.id)))
        .map((f) => {
          const item = c.items[f.locus.id]!;
          return {
            key: f.locus.id,
            chips: [`Locus ${f.n}`, ...(f.room.name ? [f.room.name] : [])],
            prompt: item.question || f.locus.name || `Locus ${f.n}`,
            sub: item.question ? `sur « ${f.locus.name} »` : f.locus.description,
            parts: itemParts(item),
            extra: item.image,
          };
        });
      return { title: c.title, cards };
    }
    const p = id ? getPalace(id) : undefined;
    if (!p) return { title: '', cards: [] };
    const weak = new Set(Object.entries(p.weak ?? {}).filter(([, n]) => n >= 2).map(([k]) => k));
    const cards = flatLoci(p)
      .filter((f) => !weakOnly || weak.has(f.locus.id))
      .map((f) => ({
        key: f.locus.id,
        chips: f.room.name ? [f.room.name] : ['Trajet'],
        prompt: `Locus ${f.n}`,
        sub: 'Quel est cet endroit ?',
        parts: [f.locus.name],
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
  let wasPractice = $state(false);
  const done = $derived(index >= deck.length);
  const card = $derived(deck[index]);

  /* ---------- Réciter ---------- */
  const recite = db.settings.recite ?? true;
  let canSpeak = $state(false);
  void speechAvailable().then((v) => (canSpeak = v));

  let phase = $state<'ask' | 'listening' | 'review' | 'typing' | 'shown'>('ask');
  let said = $state('');
  let match = $state<{ results: MatchResult[]; found: number; grade: Grade } | null>(null);
  let session_: Listening | null = null;
  let typeInput: HTMLTextAreaElement | undefined = $state();

  async function startListening() {
    if (!(await ensureMicPermission())) {
      toast('Micro non autorisé : tu peux écrire ta réponse.');
      startTyping();
      return;
    }
    haptic.medium();
    said = '';
    phase = 'listening';
    session_ = listenLong((t) => (said = t));
    const alts = await session_.done;
    session_ = null;
    if (phase !== 'listening') return;
    said = alts[0] ?? said;
    // Relecture : tu vérifies et corriges ce qui a été capté avant de valider.
    phase = 'review';
  }

  function stopListening() {
    session_?.stop();
  }

  function startTyping() {
    said = '';
    phase = 'typing';
    setTimeout(() => typeInput?.focus(), 50);
  }

  function validate() {
    if (!card) return;
    const text = said.trim();
    match = text ? compareParts(card.parts, [text]) : null;
    phase = 'shown';
    haptic.tap();
  }

  function reveal() {
    if (phase === 'shown') return;
    session_?.stop();
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
    const result = { at: Date.now(), score: points(results), total: deck.length, mode: 'quiz' as const };
    const target = kind === 'content' && id ? getContent(id) : kind === 'trajet' && id ? getPalace(id) : undefined;
    if (target) {
      recordQuiz(
        target,
        result,
        results.map((r) => ({ key: r.card.key, grade: r.grade })),
      );
      nextDue = target.review?.due ?? null;
      wasPractice = !!target.lastQuiz?.practice;
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

  /* ---------- Session « Tout réviser » ---------- */
  const nextInSession = $derived(session[0]);
  const nextTitle = $derived.by(() => {
    if (!nextInSession) return '';
    const sid = nextInSession.slice(2);
    return nextInSession.startsWith('c:') ? (getContent(sid)?.title ?? '') : `Trajet · ${getPalace(sid)?.name ?? ''}`;
  });

  /* ---------- Proposer le rappel ---------- */
  // svelte-ignore state_referenced_locally
  let showReminderOffer = $state(isNative() && kind !== 'numbers' && !db.settings.reminder?.enabled && !db.settings.reminderAsked);

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
    if (done || phase === 'typing' || phase === 'review') return;
    if (phase === 'ask' && (e.key === ' ' || e.key === 'Enter')) reveal();
    else if (phase === 'shown' && e.key === 'ArrowRight') grade('known');
    else if (phase === 'shown' && e.key === 'ArrowLeft') grade('missed');
  }

  $effect(() => () => session_?.stop());
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
      <p class="title-m" style="color: var(--on)">{weakOnly ? 'Aucun point faible : bravo !' : "Rien à tester pour l'instant"}</p>
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
      {#if wasPractice}
        <p class="body-m onv practice">Entraînement : la révision n'était pas encore due, son intervalle ne change donc pas.</p>
      {/if}
    </div>

    {#if nextInSession}
      <div class="card-tonal session">
        <p class="label-m caps">Session du jour · encore {session.length}</p>
        <p class="title-m">Ensuite : {nextTitle}</p>
        <div class="row" style="margin-top: 10px; gap: 4px">
          <button class="btn filled has-icon" onclick={() => nav.replace(sessionRoute(nextInSession, session.slice(1)))}>
            <Icon name="play" size={18} />Continuer
          </button>
          <button class="btn text" onclick={() => nav.back()}>Arrêter là</button>
        </div>
      </div>
    {/if}

    {#if showReminderOffer && !isRetry}
      <div class="card-tonal offer">
        <p class="title-m">Un rappel le jour où réviser ?</p>
        <p class="body-m" style="opacity: 0.85">Une notification à 19 h, seulement les jours où un palais est à revoir.</p>
        <div class="row" style="margin-top: 10px; gap: 4px">
          <button class="btn filled" onclick={enableReminder}>Activer</button>
          <button class="btn text" onclick={() => ((db.settings.reminderAsked = true), (showReminderOffer = false))}>Non merci</button>
        </div>
      </div>
    {/if}

    {#if sharedMisses.length}
      {@const names = [...new Set(sharedMisses.flatMap((r) => r.others.map((o) => o.content.title)))]}
      <div class="card-warn warn">
        <Icon name="layers" />
        <div class="grow">
          <p class="title-m">Possible mélange avec « {names.join(' », « ')} »</p>
          <p class="body-m">{sharedMisses.length} des loci qui ont coincé portent aussi un autre contenu.</p>
          {#if content}
            <button class="btn text warn-btn" onclick={() => nav.replace({ name: 'content', id: content.id })}>Régler ça</button>
          {/if}
        </div>
      </div>
    {/if}

    {#if toReview.length}
      <h2 class="subheader">À revoir</h2>
      {#each toReview as r, i (r.card.key)}
        {#if i > 0}<div class="divider" style="margin-left: 16px"></div>{/if}
        <div class="list-item two">
          <span class="li-text">
            <span class="li-over">{r.card.chips.join(' · ')} · {r.card.prompt}{r.grade === 'partial' ? ' · à moitié' : ''}</span>
            <span class="li-head" style="font-weight: 500">{r.card.parts.join(' · ')}</span>
            {#if r.card.extra}<span class="li-sup">{r.card.extra}</span>{/if}
          </span>
        </div>
      {/each}
    {/if}

    <div class="stack px" style="margin-top: 24px">
      {#if toReview.length}
        <button class="btn {nextInSession ? 'tonal' : 'filled'} lg block" onclick={retry}>Refaire les {toReview.length} à revoir</button>
      {/if}
      {#if !nextInSession}
        <button class="btn outlined lg block" onclick={restart}>Recommencer</button>
        <button class="btn text lg block" onclick={() => nav.back()}>Fermer</button>
      {/if}
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
          style:transform={flying ? `translateX(${flying * 120}%) rotate(${flying * 12}deg)` : dx ? `translateX(${dx}px) rotate(${dx / 22}deg)` : undefined}
          onpointerdown={down}
          onpointermove={move}
          onpointerup={up}
          onpointercancel={up}
          onclick={tapCard}
          onkeydown={() => {}}
        >
          <div aria-hidden="true" class="tint good" style:opacity={dx > 0 ? Math.min(dx / THRESHOLD, 1) : 0}><Icon name="check" />Su</div>
          <div aria-hidden="true" class="tint bad" style:opacity={dx < 0 ? Math.min(-dx / THRESHOLD, 1) : 0}><Icon name="x" />Raté</div>

          <div class="row" style="flex-wrap: wrap">
            {#each card.chips as c, ci (ci)}
              <span class="chip plain" class:selected={ci === 0}>{c}</span>
            {/each}
            {#if card.parts.length > 1}<span class="chip plain">{card.parts.length} éléments</span>{/if}
          </div>
          <p class="prompt" class:question={card.prompt.length > 22}>{card.prompt}</p>
          {#if card.sub}<p class="body-l onv">{card.sub}</p>{/if}

          {#if phase === 'shown'}
            <div class="answer">
              {#if said}
                <p class="label-m onv">TA RÉPONSE</p>
                <p class="body-l said">« {said} »</p>
              {/if}
              <p class="label-m primary">RÉPONSE</p>
              {#each card.parts as part, pi (pi)}
                {@const m = match?.results[pi]}
                <p class="answer-text" class:multi={card.parts.length > 1}>
                  {#if card.parts.length > 1}
                    <span class="mark {m ? m.grade : ''}">{m ? (m.grade === 'known' ? '✓' : m.grade === 'partial' ? '~' : '✗') : pi + 1}</span>
                  {/if}
                  {#if m}
                    {#each m.words as w, wi (wi)}<span class:hit={w.key && w.found} class:miss={w.key && !w.found}>{w.text}</span>{' '}{/each}
                  {:else}
                    {part}
                  {/if}
                </p>
              {/each}
              {#if card.extra}<p class="body-m onv">{card.extra}</p>{/if}
              {#if match}
                {#if match.results.some((r) => r.negation)}
                  <p class="label-l negation"><Icon name="alert" size={16} />Attention : le sens semble inversé (négation)</p>
                {/if}
                <p class="label-l score" class:good={match.grade === 'known'}>
                  {card.parts.length > 1
                    ? `${match.found} élément${match.found > 1 ? 's' : ''} sur ${card.parts.length} retrouvé${match.found > 1 ? 's' : ''}`
                    : `${match.results[0]?.found ?? 0} mot(s) clé(s) sur ${match.results[0]?.total ?? 0}`}
                </p>
              {/if}
            </div>
          {:else if phase === 'listening'}
            <div class="listening">
              <span class="mic-pulse"><Icon name="mic" size={28} /></span>
              <p class="body-l live">{said || 'Je t’écoute… prends ton temps, les pauses ne coupent pas.'}</p>
            </div>
          {:else if phase === 'review' || phase === 'typing'}
            <div class="typing">
              <label class="tf" style="margin: 0">
                <span>{phase === 'review' ? 'Ce que j’ai compris (corrige si besoin)' : 'Ta réponse'}</span>
                <textarea bind:this={typeInput} bind:value={said} rows="2"></textarea>
              </label>
            </div>
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
        <button class="btn lg grow" class:danger={suggested === 'missed' || !suggested} class:outlined={suggested && suggested !== 'missed'} onclick={() => grade('missed')}>Raté</button>
        <button class="btn lg grow" class:filled={suggested === 'partial'} class:tonal={suggested !== 'partial'} onclick={() => grade('partial')}>À moitié</button>
        <button class="btn lg grow" class:filled={suggested === 'known' || !suggested} class:outlined={suggested && suggested !== 'known'} onclick={() => grade('known')}>Su</button>
      {:else if phase === 'listening'}
        <button class="btn filled lg grow has-icon" onclick={stopListening}><Icon name="check" size={20} />J'ai fini</button>
      {:else if phase === 'review'}
        <button class="btn tonal lg has-icon" onclick={startListening}><Icon name="mic" size={20} />Redire</button>
        <button class="btn filled lg grow" onclick={validate}>Valider</button>
      {:else if phase === 'typing'}
        <button class="btn text lg" onclick={reveal}>Je ne sais pas</button>
        <button class="btn filled lg grow" onclick={validate}>Valider</button>
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
    {:else if phase === 'review'}
      <p class="label-m onv hint">Vérifie que le texte correspond à ce que tu as dit, puis valide.</p>
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
  .prompt.question {
    font-size: 28px;
    line-height: 36px;
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
  .answer-text.multi {
    font-size: 22px;
    line-height: 32px;
    display: flex;
    gap: 10px;
    align-items: baseline;
  }
  .mark {
    font-size: 14px;
    font-weight: 700;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--surface-high);
    color: var(--onv);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .mark.known {
    background: var(--p);
    color: var(--onp);
  }
  .mark.partial {
    background: var(--warn-c);
    color: var(--onwarn-c);
  }
  .mark.missed {
    background: var(--ec);
    color: var(--onec);
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
  .negation {
    margin-top: 8px;
    color: var(--warn);
    display: flex;
    gap: 6px;
    align-items: center;
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
  .practice {
    max-width: 320px;
  }
  .session,
  .offer {
    margin: 16px 16px 0;
  }
  .caps {
    text-transform: uppercase;
    letter-spacing: 0.06em;
    opacity: 0.8;
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
</style>

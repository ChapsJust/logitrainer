<script lang="ts">
  /** Séance du Laboratoire : encodage chronométré de mots au hasard, puis rappel (immédiat ou à 24 h). */
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { addLabSession, getLabSession, getPalace } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { flatLoci, shuffle } from '../util';
  import { LAB_WORDS } from '../lab-words';
  import { compareParts } from '../match';
  import { haptic } from '../haptics';
  import type { FlatLocus } from '../types';

  let {
    palaceId,
    perLocus = 1,
    seconds = 3,
    recallOf,
    delayed = false,
  }: { palaceId?: string; perLocus?: number; seconds?: number; recallOf?: string; delayed?: boolean } = $props();

  // svelte-ignore state_referenced_locally
  const existing = recallOf ? getLabSession(recallOf) : undefined;
  // svelte-ignore state_referenced_locally
  const palace = getPalace(existing?.palaceId ?? palaceId ?? '');
  // svelte-ignore state_referenced_locally
  const per = existing?.perLocus ?? perLocus;
  const loci: FlatLocus[] = palace ? flatLoci(palace) : [];
  // svelte-ignore state_referenced_locally
  const words: string[] = existing?.words ?? shuffle(LAB_WORDS).slice(0, loci.length * per);
  const groups = loci.map((f, i) => ({ f, words: words.slice(i * per, i * per + per) })).filter((g) => g.words.length);

  let phase = $state<'ready' | 'encode' | 'recall' | 'result'>(existing ? 'recall' : 'ready');
  let countdown = $state(3);
  let index = $state(0);
  let left = $state(1);
  let encodeStart = 0;
  let encodeMs = $state(0);
  let answers = $state<string[]>(groups.map(() => ''));
  let found = $state<number[]>([]);
  let tick: ReturnType<typeof setInterval> | undefined;

  // svelte-ignore state_referenced_locally
  const stepMs = seconds * per * 1000;
  const group = $derived(groups[index]);
  const total = groups.reduce((s, g) => s + g.words.length, 0);
  const correct = $derived(found.reduce((s, n) => s + n, 0));
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

  function begin() {
    haptic.medium();
    const t = setInterval(() => {
      countdown--;
      haptic.tick();
      if (countdown <= 0) {
        clearInterval(t);
        phase = 'encode';
        encodeStart = Date.now();
        startStep();
      }
    }, 800);
  }

  function startStep() {
    clearInterval(tick);
    if (!seconds) return;
    const t0 = Date.now();
    left = 1;
    tick = setInterval(() => {
      left = Math.max(0, 1 - (Date.now() - t0) / stepMs);
      if (left <= 0) next();
    }, 50);
  }

  function next() {
    haptic.tick();
    if (index >= groups.length - 1) {
      clearInterval(tick);
      encodeMs = Date.now() - encodeStart;
      phase = 'recall';
      return;
    }
    index++;
    startStep();
  }

  function score() {
    found = groups.map((g, i) => {
      const said = answers[i]?.trim();
      if (!said) return 0;
      return compareParts(g.words, [said]).results.filter((r) => r.grade === 'known').length;
    });
    phase = 'result';
    haptic.success();
    if (existing) {
      existing.recall24 = { at: Date.now(), correct };
    } else if (palace) {
      addLabSession({
        at: Date.now(),
        palaceId: palace.id,
        palaceName: palace.name,
        perLocus: per,
        words,
        encodeMs,
        correct,
      });
    }
  }

  $effect(() => () => clearInterval(tick));
</script>

<TopBar back navIcon="x" title={existing ? 'Rappel à 24 h' : 'Séance'}>
  {#snippet actions()}
    {#if phase === 'encode'}<span class="label-l onv count">{index + 1} / {groups.length}</span>{/if}
  {/snippet}
</TopBar>

<div class="page no-nav">
  {#if !palace || groups.length === 0}
    <div class="empty"><p class="body-m">Ce palais n'a pas de loci.</p></div>
  {:else if phase === 'ready'}
    <div class="center">
      <p class="headline-m">{total} mots</p>
      <p class="body-l onv">
        {groups.length} loci de « {palace.name} » · {per} mot{per > 1 ? 's' : ''} par locus · {seconds ? `${seconds} s par mot` : 'à ton rythme'}
      </p>
      {#if countdown < 3}<p class="countdown">{countdown}</p>{/if}
      <button class="btn filled lg" onclick={begin} disabled={countdown < 3}>Je suis prêt</button>
    </div>
  {:else if phase === 'encode' && group}
    {#if seconds}<div class="px"><div class="progress timer"><span style:width="{left * 100}%"></span></div></div>{/if}
    {#key index}
      <div class="card">
        <div class="row">
          <span class="chip plain selected">Locus {group.f.n}</span>
          {#if group.f.room.name}<span class="chip plain">{group.f.room.name}</span>{/if}
        </div>
        <p class="place">{group.f.locus.name}</p>
        <div class="words">
          {#each group.words as w (w)}<span class="word">{w}</span>{/each}
        </div>
      </div>
    {/key}
    <div class="px" style="margin-top: 16px">
      <button class="btn filled lg block" onclick={next}>{index >= groups.length - 1 ? 'Terminer' : 'Suivant'}</button>
    </div>
  {:else if phase === 'recall'}
    <p class="body-m onv px intro">
      {existing ? 'Sans regarder : retrouve les mots de ta séance d’hier.' : `Encodé en ${fmt(encodeMs / 1000)} s. Retrouve les mots, locus par locus.`}
      L'ordre des mots dans un locus ne compte pas.
    </p>
    {#each groups as g, i (i)}
      <label class="tf row-in">
        <span>{g.f.n}. {g.f.locus.name}</span>
        <input bind:value={answers[i]} placeholder={per > 1 ? `${per} mots` : '1 mot'} autocomplete="off" enterkeyhint="next" />
      </label>
    {/each}
    <div class="px"><button class="btn filled lg block" onclick={score}>Corriger</button></div>
  {:else if phase === 'result'}
    <div class="center">
      <div class="medal"><Icon name="trophy" size={36} /></div>
      <p class="headline-l">{correct} / {total}</p>
      {#if !existing}
        <p class="body-l onv">{fmt(encodeMs / 1000 / total)} s par mot à l'encodage</p>
        <p class="body-m onv">Reviens demain : on mesurera ce qu'il en reste à 24 h.</p>
      {:else}
        <p class="body-l onv">Rétention à 24 h : {Math.round((correct / total) * 100)} %</p>
      {/if}
    </div>
    {#each groups as g, i (i)}
      <div class="list-item">
        <span class="num" class:okn={found[i] === g.words.length} class:kon={!found[i]}>{found[i]}/{g.words.length}</span>
        <span class="li-text">
          <span class="li-over">{g.f.n}. {g.f.locus.name}</span>
          <span class="li-head">{g.words.join(' · ')}</span>
        </span>
      </div>
    {/each}
    <div class="px" style="margin-top: 16px"><button class="btn filled lg block" onclick={() => nav.back()}>Terminer</button></div>
  {/if}
</div>

<style>
  .count {
    padding-right: 16px;
  }

  .center {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 40px 24px 16px;
  }

  .countdown {
    font-size: 72px;
    line-height: 1;
    color: var(--p);
  }

  .timer > span {
    transition: none;
  }

  .card {
    margin: 16px;
    background: var(--surface-low);
    border-radius: 28px;
    padding: 24px;
    min-height: min(52dvh, 440px);
    display: flex;
    flex-direction: column;
    animation: in 0.2s var(--ease);
  }

  @keyframes in {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }

  .place {
    font-size: 34px;
    line-height: 42px;
    margin-top: 18px;
  }

  .words {
    margin-top: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .word {
    font-size: 30px;
    line-height: 38px;
    font-weight: 500;
    color: var(--p);
    background: var(--surface);
    border-radius: 16px;
    padding: 12px 18px;
  }

  .intro {
    margin: 4px 0 12px;
  }

  .row-in {
    margin: 0 16px 10px;
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
  }

  .num.okn {
    background: var(--pc);
    color: var(--onpc);
  }

  .num.kon {
    background: var(--ec);
    color: var(--onec);
  }
</style>

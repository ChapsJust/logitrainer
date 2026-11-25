<script lang="ts">
  /**
   * Laboratoire : mesurer et améliorer ta mémoire (vitesse d'encodage, capacité, rétention),
   * avec des mots au hasard, dans des palais réservés à l'entraînement.
   */
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import { db, setTraining } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { flatLoci, lociCount, plural, relativeDays } from '../util';
  import { palaceUse } from '../interference';
  import { haptic } from '../haptics';

  const sessions = $derived(db.lab.sessions);
  const best = $derived(sessions.reduce((m, s) => Math.max(m, s.correct), 0));
  const speeds = $derived(sessions.filter((s) => s.words.length && s.encodeMs).map((s) => s.encodeMs / 1000 / s.words.length));
  const bestSpeed = $derived(speeds.length ? Math.min(...speeds) : null);
  const lastRetention = $derived.by(() => {
    const s = [...sessions].reverse().find((x) => x.recall24);
    return s ? Math.round(((s.recall24?.correct ?? 0) / Math.max(1, s.words.length)) * 100) : null;
  });
  const pending24 = $derived(
    [...sessions].reverse().find((s) => !s.recall24 && Date.now() - s.at > 20 * 3_600_000 && Date.now() - s.at < 4 * 86_400_000),
  );

  // Palais : ceux réservés à l'entraînement d'abord.
  const candidates = $derived(
    [...db.palaces].filter((p) => lociCount(p) > 0).sort((a, b) => Number(!!b.training) - Number(!!a.training)),
  );
  // svelte-ignore state_referenced_locally
  let palaceId = $state(db.palaces.find((p) => p.training && lociCount(p) > 0)?.id ?? '');
  const palace = $derived(db.palaces.find((p) => p.id === palaceId));
  const busy = $derived(palace ? palaceUse(palace).active.length > 0 : false);
  let perLocus = $state(1);
  let seconds = $state(3);
  const count = $derived(palace ? flatLoci(palace).length * perLocus : 0);
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');

  // Courbe : mots retrouvés par séance.
  const last = $derived(sessions.slice(-20));
  const W = 320;
  const H = 110;
  const maxY = $derived(Math.max(10, ...last.map((s) => s.words.length)));
  const pts = $derived(
    last.map((s, i) => ({
      x: 28 + (last.length === 1 ? (W - 36) / 2 : (i * (W - 40)) / (last.length - 1)),
      y: 8 + (1 - s.correct / maxY) * (H - 24),
    })),
  );

  function start() {
    if (!palace) return;
    haptic.medium();
    nav.go({ name: 'lab-run', palaceId: palace.id, perLocus, seconds });
  }
</script>

<TopBar title="Laboratoire" />

<div class="page">
  {#if pending24}
    <button class="card-tonal due" onclick={() => nav.go({ name: 'lab-recall', sessionId: pending24.id, delayed: true })}>
      <Icon name="timer" />
      <span class="grow">
        <span class="title-m">Rappel à 24 h</span>
        <span class="body-m">Les {pending24.words.length} mots de ta séance d'hier : que reste-t-il ?</span>
      </span>
      <Icon name="next" size={20} />
    </button>
  {/if}

  <div class="tiles">
    <div class="tile"><span class="label-m onv">Record</span><b>{best}</b><span class="body-m onv">mots</span></div>
    <div class="tile">
      <span class="label-m onv">Vitesse</span><b>{bestSpeed ? fmt(bestSpeed) : '–'}</b><span class="body-m onv">s par mot</span>
    </div>
    <div class="tile"><span class="label-m onv">Rétention 24 h</span><b>{lastRetention ?? '–'}{lastRetention !== null ? ' %' : ''}</b></div>
    <div class="tile"><span class="label-m onv">Séances</span><b>{sessions.length}</b></div>
  </div>

  {#if last.length > 1}
    <div class="chart">
      <p class="label-m onv">MOTS RETROUVÉS PAR SÉANCE</p>
      <svg width="100%" viewBox="0 0 {W} {H}" aria-label="Progression">
        {#each [0, 0.5, 1] as g (g)}
          <line x1="24" x2={W} y1={8 + g * (H - 24)} y2={8 + g * (H - 24)} class="grid" />
          <text x="0" y={12 + g * (H - 24)} class="ax">{Math.round(maxY * (1 - g))}</text>
        {/each}
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} class="line" />
        {#each pts as p, i (i)}<circle cx={p.x} cy={p.y} r="3.5" />{/each}
      </svg>
    </div>
  {:else if sessions.length === 0}
    <div class="card-filled intro">
      <p class="title-m">Entraîne ta mémoire, mesure tes progrès</p>
      <p class="body-m onv">
        Des mots au hasard à placer dans un palais, chronométrés, puis à retrouver. Tu vois ta vitesse, ton record et ce qu'il
        reste 24 h plus tard. Compare par exemple 1 et 2 objets par locus pour savoir ce qui marche pour toi.
      </p>
    </div>
  {/if}

  <h2 class="subheader">Nouvelle séance</h2>
  <div class="px">
    <p class="label-l" style="margin-bottom: 6px">Palais</p>
    {#if candidates.length === 0}
      <p class="body-m onv">Crée d'abord un palais avec quelques loci : idéalement un palais réservé à l'entraînement.</p>
    {:else}
      <div class="pals">
        {#each candidates as p (p.id)}
          <button class="chip plain" class:selected={palaceId === p.id} onclick={() => (palaceId = p.id)}>
            {#if p.training}<Icon name="flask" size={16} />{/if}{p.name} · {lociCount(p)}
          </button>
        {/each}
      </div>
    {/if}

    {#if palace && !palace.training}
      {#if busy}
        <div class="card-warn note">
          <p class="body-m">
            <b>Ce palais porte des contenus d'études.</b> Des mots au hasard risquent de s'y mélanger. Utilise plutôt un palais réservé
            à l'entraînement (un trajet que tu n'utilises pas pour étudier).
          </p>
        </div>
      {:else}
        <button class="btn text has-icon reserve" onclick={() => palace && setTraining(palace, true)}>
          <Icon name="flask" size={18} />Réserver « {palace.name} » au Laboratoire
        </button>
      {/if}
    {/if}

    <p class="label-l" style="margin: 16px 0 6px">Objets par locus</p>
    <div class="segmented" style="margin: 0">
      {#each [1, 2, 3, 4] as n (n)}
        <button class:on={perLocus === n} onclick={() => (perLocus = n)}>{n}</button>
      {/each}
    </div>

    <p class="label-l" style="margin: 16px 0 6px">Temps par mot</p>
    <div class="segmented" style="margin: 0">
      {#each [2, 3, 5, 0] as t (t)}
        <button class:on={seconds === t} onclick={() => (seconds = t)}>{t ? `${t} s` : 'Libre'}</button>
      {/each}
    </div>

    {#if palace}
      <p class="body-m onv summary">
        {plural(count, 'mot', 'mots')} · {seconds ? `encodage en ${Math.floor((count * seconds) / 60)} min ${(count * seconds) % 60} s` : 'à ton rythme, chronométré'}
      </p>
    {/if}
    <button class="btn filled lg block has-icon" disabled={!palace || busy} onclick={start}><Icon name="play" size={20} />Commencer</button>
  </div>

  {#if sessions.length}
    <h2 class="subheader">Séances récentes</h2>
    {#each [...sessions].reverse().slice(0, 8) as s (s.id)}
      <div class="list-item two">
        <span class="num">{s.perLocus}×</span>
        <span class="li-text">
          <span class="li-head">{s.correct} / {s.words.length} mots{s.recall24 ? ` · ${s.recall24.correct} à 24 h` : ''}</span>
          <span class="li-sup">
            {s.palaceName} · {s.words.length ? fmt(s.encodeMs / 1000 / s.words.length) : '–'} s/mot · {relativeDays(s.at)}
          </span>
        </span>
      </div>
    {/each}
  {/if}
</div>

<style>
  .due {
    display: flex;
    align-items: center;
    gap: 14px;
    margin: 4px 16px 0;
    width: calc(100% - 32px);
    text-align: left;
  }

  .due .grow {
    display: flex;
    flex-direction: column;
  }

  .tiles {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin: 12px 16px 0;
  }

  .tile {
    background: var(--surface-low);
    border-radius: 16px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
  }

  .tile b {
    font-size: 28px;
    line-height: 34px;
    font-weight: 500;
  }

  .chart {
    margin: 12px 16px 0;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--surface-low);
  }

  .grid {
    stroke: var(--divider);
  }

  .ax {
    font-size: 10px;
    fill: var(--onv);
  }

  .line {
    fill: none;
    stroke: var(--p);
    stroke-width: 2.5;
    stroke-linejoin: round;
  }

  circle {
    fill: var(--p);
  }

  .intro {
    margin: 12px 16px 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .pals {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .note {
    margin-top: 10px;
  }

  .reserve {
    margin: 6px 0 0 -12px;
  }

  .summary {
    margin: 16px 0 10px;
  }
</style>

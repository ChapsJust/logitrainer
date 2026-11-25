<script lang="ts">
  /** Petite courbe de progression : les dernières séances (plein = révision, creux = entraînement). */
  import type { QuizResult } from '../types';
  import { relativeDays } from '../util';

  let { history = [], weak = 0 }: { history?: QuizResult[]; weak?: number } = $props();

  const last = $derived(history.slice(-14));
  const W = 160;
  const H = 40;
  const pts = $derived(
    last.map((r, i) => ({
      x: last.length === 1 ? W / 2 : 6 + (i * (W - 12)) / (last.length - 1),
      y: 4 + (1 - (r.total ? r.score / r.total : 0)) * (H - 8),
      practice: !!r.practice,
    })),
  );
  const lastR = $derived(history[history.length - 1]);
  const fmt = (n: number) => String(Math.round(n * 10) / 10).replace('.', ',');
</script>

{#if history.length}
  <div class="hist">
    <div class="grow">
      <p class="label-m onv">PROGRESSION · {history.length} séance{history.length > 1 ? 's' : ''}</p>
      {#if lastR}
        <p class="body-m">Dernière : <b>{fmt(lastR.score)}/{lastR.total}</b> {relativeDays(lastR.at)}</p>
      {/if}
      {#if weak}<p class="body-m weak">{weak} point{weak > 1 ? 's' : ''} faible{weak > 1 ? 's' : ''}</p>{/if}
    </div>
    <svg width={W} height={H} viewBox="0 0 {W} {H}" aria-hidden="true">
      <line x1="0" x2={W} y1="4" y2="4" class="grid" />
      <line x1="0" x2={W} y1={H - 4} y2={H - 4} class="grid" />
      {#if pts.length > 1}
        <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} class="line" />
      {/if}
      {#each pts as p, i (i)}
        <circle cx={p.x} cy={p.y} r="3.5" class:hollow={p.practice} />
      {/each}
    </svg>
  </div>
{/if}

<style>
  .hist {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 12px 16px 0;
    padding: 12px 16px;
    border-radius: 16px;
    background: var(--surface-low);
  }

  .weak {
    color: var(--warn);
  }

  .grid {
    stroke: var(--divider);
    stroke-width: 1;
  }

  .line {
    fill: none;
    stroke: var(--p);
    stroke-width: 2;
    stroke-linejoin: round;
  }

  circle {
    fill: var(--p);
  }

  circle.hollow {
    fill: var(--surface-low);
    stroke: var(--p);
    stroke-width: 1.5;
  }
</style>

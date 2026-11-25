<script lang="ts">
  /**
   * Aide à créer l'image mentale, directement sous le champ :
   * - les nombres de l'élément sont découpés et reliés à tes images 00–99 (hors-ligne) ;
   * - en option, Claude propose 3 scènes qui font interagir l'élément avec le locus.
   */
  import Icon from './Icon.svelte';
  import AiKeySheet from './AiKeySheet.svelte';
  import { db } from '../store.svelte';
  import { majorHint, numberPairs } from '../major';
  import { aiState } from '../ai-key.svelte';
  import type { Suggestion } from '../ai';
  import { haptic } from '../haptics';

  interface Props {
    element: string;
    image: string;
    locusId: string;
    locus: string;
    locusDescription?: string;
    room?: string;
    contentTitle?: string;
  }

  let { element, image = $bindable(), locusId, locus, locusDescription, room, contentTitle }: Props = $props();

  /* ---------- Nombres ---------- */
  const groups = $derived(numberPairs(element));
  let defining = $state<string | null>(null);
  let defDraft = $state('');

  function useNumbers(pairs: string[]) {
    const imgs = pairs.map((p) => db.numbers[p] ?? p);
    const prefix = imgs.join(' + ');
    image = image.trim() ? `${prefix} : ${image.trim()}` : `${prefix} : `;
    haptic.tap();
  }

  function saveNumber() {
    if (defining && defDraft.trim()) db.numbers[defining] = defDraft.trim();
    defining = null;
    defDraft = '';
  }

  /* ---------- IA ---------- */
  const cache = new Map<string, Suggestion[]>();
  let ideas = $state<Suggestion[] | null>(null);
  let loading = $state(false);
  let error = $state('');
  let picked = $state(-1);
  let keyOpen = $state(false);

  $effect(() => {
    // Nouvel élément ou nouveau locus : on repart de zéro (ou du cache).
    const k = `${locusId}|${element.trim()}`;
    ideas = cache.get(k) ?? null;
    picked = -1;
    error = '';
  });

  async function suggest(again = false) {
    if (!element.trim()) {
      error = 'Écris d’abord ce que tu veux retenir.';
      return;
    }
    if (!aiState.hasKey) {
      keyOpen = true;
      return;
    }
    loading = true;
    error = '';
    const k = `${locusId}|${element.trim()}`;
    try {
      const { suggestImages } = await import('../ai');
      const numberImages = groups.flatMap((g) => g.pairs.filter((p) => db.numbers[p]).map((p) => `${p} = ${db.numbers[p]}`));
      const out = await suggestImages({
        element: element.trim(),
        locus,
        locusDescription,
        room,
        contentTitle,
        numberImages,
        // « Autres idées » : on évite de reproposer les précédentes.
        current: again ? (ideas ?? []).map((i) => i.image).join(' | ') || undefined : undefined,
      });
      cache.set(k, out);
      ideas = out;
      picked = -1;
      haptic.tap();
    } catch (e) {
      error = (e as Error).message;
    } finally {
      loading = false;
    }
  }

  function pick(i: number) {
    const s = ideas?.[i];
    if (!s) return;
    image = s.image;
    picked = i;
    haptic.tick();
  }
</script>

<div class="ws">
  {#each groups as g (g.raw)}
    <div class="numbers">
      <span class="label-m onv">{g.raw} →</span>
      {#each g.pairs as p, pi (pi)}
        {#if db.numbers[p]}
          <span class="chip plain selected">{p} · {db.numbers[p]}</span>
        {:else}
          <button type="button" class="chip plain dashed" onclick={() => ((defining = p), (defDraft = ''))}>{p} · ?</button>
        {/if}
      {/each}
      {#if g.pairs.every((p) => db.numbers[p])}
        <button type="button" class="btn text use" onclick={() => useNumbers(g.pairs)}>Utiliser</button>
      {/if}
    </div>
    {#if defining && g.pairs.includes(defining)}
      <form
        class="define"
        onsubmit={(e) => {
          e.preventDefault();
          saveNumber();
        }}
      >
        <label class="tf grow" style="margin: 0">
          <span>Ton image pour {defining} (sons : {majorHint(defining)})</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:value={defDraft} autofocus enterkeyhint="done" placeholder="Un objet concret" />
        </label>
        <button class="icon-btn on" type="submit" aria-label="Enregistrer"><Icon name="check" /></button>
      </form>
    {/if}
  {/each}

  {#if ideas && !loading}
    <div class="ideas">
      {#each ideas as s, i (i)}
        <button type="button" class="idea" class:on={picked === i} onclick={() => pick(i)}>
          <span class="body-m">{s.image}</span>
          {#if s.lien}<span class="label-m onv">{s.lien}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}

  {#if loading}
    <div class="ideas">
      {#each [0, 1, 2] as i (i)}<div class="idea skeleton" style:animation-delay="{i * 120}ms"></div>{/each}
    </div>
  {/if}

  {#if error}<p class="body-m err">{error}</p>{/if}

  <button type="button" class="chip ai" disabled={loading} onclick={() => suggest(!!ideas)}>
    <Icon name="sparkle" />{loading ? 'Recherche d’idées…' : ideas ? 'Autres idées' : 'Idées d’images'}
  </button>
</div>

<AiKeySheet bind:open={keyOpen} onsaved={() => suggest()} />

<style>
  .ws {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: -6px 0 16px;
  }

  .numbers {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }

  .dashed {
    border-style: dashed;
    border-color: var(--outline);
  }

  .use {
    height: 32px;
    padding: 0 10px;
  }

  .define {
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .ideas {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .idea {
    display: flex;
    flex-direction: column;
    gap: 4px;
    text-align: left;
    padding: 12px 14px;
    border-radius: 16px;
    background: var(--surface-high);
    border: 2px solid transparent;
    animation: in 0.25s var(--ease) both;
  }

  .idea.on {
    border-color: var(--p);
    background: var(--sc);
    color: var(--onsc);
  }

  .skeleton {
    height: 56px;
    background: linear-gradient(90deg, var(--surface-high), var(--surface-highest), var(--surface-high));
    background-size: 200% 100%;
    animation: shimmer 1.2s linear infinite;
  }

  @keyframes shimmer {
    to {
      background-position: -200% 0;
    }
  }

  @keyframes in {
    from {
      opacity: 0;
      transform: translateY(6px);
    }
  }

  .ai {
    align-self: flex-start;
  }

  .err {
    color: var(--error);
  }
</style>

<script lang="ts">
  /** Créer ses images de nombres une par une, avec les sons et des suggestions de mots. */
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import SoundsSheet from '../components/SoundsSheet.svelte';
  import { db } from '../store.svelte';
  import { MAJOR_WORDS, NUMBER_KEYS, soundOf } from '../major';
  import { nav } from '../nav.svelte';
  import { haptic } from '../haptics';

  let { start }: { start: string } = $props();

  // svelte-ignore state_referenced_locally
  let index = $state(Math.max(0, NUMBER_KEYS.indexOf(start)));
  const key = $derived(NUMBER_KEYS[index] ?? '00');
  let draft = $state('');
  let input: HTMLInputElement | undefined = $state();
  let soundsOpen = $state(false);
  const filled = $derived(NUMBER_KEYS.filter((k) => db.numbers[k]?.trim()).length);
  const words = $derived(MAJOR_WORDS[key] ?? []);
  const a = $derived(soundOf(key[0] ?? '0'));
  const b = $derived(soundOf(key[1] ?? '0'));

  function load() {
    draft = db.numbers[key] ?? '';
  }
  load();

  function save() {
    const v = draft.trim();
    if (v) db.numbers[key] = v;
    else delete db.numbers[key];
  }

  function go(delta: number) {
    save();
    const next = index + delta;
    if (next < 0) return;
    if (next >= NUMBER_KEYS.length) {
      nav.back();
      return;
    }
    index = next;
    load();
    haptic.tick();
    setTimeout(() => input?.focus(), 50);
  }

  $effect(() => () => save());
</script>

<TopBar back navIcon="x" title="Créer mes images">
  {#snippet actions()}
    <span class="label-l onv count">{filled} / 100</span>
  {/snippet}
</TopBar>

<div class="page no-nav">
  {#key key}
    <div class="body">
      <p class="big">{key}</p>
      <div class="split">
        <div><span class="dg">{key[0]}</span><span class="s">{a}</span></div>
        <span class="plus">+</span>
        <div><span class="dg">{key[1]}</span><span class="s">{b}</span></div>
      </div>
      <p class="formula body-l">Ajoute des voyelles : <b>{a}_{b}</b></p>
      {#if words.length}
        <div class="words">
          {#each words as w (w)}
            <button class="chip plain" class:selected={draft.trim().toLowerCase() === w.toLowerCase()} onclick={() => ((draft = w), haptic.tick())}>
              {w}
            </button>
          {/each}
        </div>
      {/if}
      <form
        onsubmit={(e) => {
          e.preventDefault();
          go(1);
        }}
      >
        <label class="tf" style="margin: 18px 0 8px">
          <span>Ton image pour {key}</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:this={input} bind:value={draft} placeholder="Un objet ou un personnage concret" enterkeyhint="next" autofocus />
        </label>
      </form>
      <p class="body-m onv">
        Choisis quelque chose que tu vois tout de suite. Seuls les <b>sons</b> comptent.
        <button class="link" onclick={() => (soundsOpen = true)}>Revoir les 10 sons</button>
      </p>
    </div>
  {/key}

  <div class="actions px">
    <button class="btn tonal lg" disabled={index === 0} onclick={() => go(-1)} aria-label="Précédent"><Icon name="back" size={20} /></button>
    <button class="btn filled lg grow" onclick={() => go(1)}>
      {index >= NUMBER_KEYS.length - 1 ? 'Terminer' : draft.trim() ? `Suivant : ${NUMBER_KEYS[index + 1]}` : `Passer à ${NUMBER_KEYS[index + 1]}`}
    </button>
  </div>
</div>

<SoundsSheet bind:open={soundsOpen} />

<style>
  .count {
    padding-right: 16px;
  }

  .body {
    padding: 0 16px;
    animation: in 0.25s var(--ease);
  }

  @keyframes in {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }

  .big {
    font-size: 84px;
    line-height: 1;
    text-align: center;
    margin-top: 12px;
    letter-spacing: -0.02em;
  }

  .split {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 18px;
    margin-top: 14px;
  }

  .split div {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }

  .dg {
    font-size: 28px;
    font-weight: 500;
  }

  .s {
    font-size: 17px;
    font-weight: 700;
    color: var(--onp);
    background: var(--p);
    border-radius: 10px;
    padding: 4px 12px;
  }

  .plus {
    font-size: 26px;
    color: var(--onv);
  }

  .formula {
    text-align: center;
    margin-top: 16px;
  }

  .formula b {
    color: var(--p);
    font-size: 22px;
    letter-spacing: 0.15em;
  }

  .words {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 12px;
  }

  .link {
    color: var(--p);
    text-decoration: underline;
  }

  .actions {
    display: flex;
    gap: 12px;
    margin-top: 24px;
  }

  .actions .btn:first-child {
    width: 72px;
    padding: 0;
  }
</style>

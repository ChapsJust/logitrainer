<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Icon from '../components/Icon.svelte';
  import QuizStart from '../components/QuizStart.svelte';
  import SoundsSheet from '../components/SoundsSheet.svelte';
  import { db } from '../store.svelte';
  import { MAJOR_WORDS, NUMBER_KEYS, majorHint, numberPairs } from '../major';
  import { nav } from '../nav.svelte';

  let soundsOpen = $state(false);
  let quizOpen = $state(false);
  let convert = $state('');

  const filled = $derived(NUMBER_KEYS.filter((k) => db.numbers[k]?.trim()).length);
  const firstEmpty = $derived(NUMBER_KEYS.find((k) => !db.numbers[k]?.trim()) ?? '00');
  // svelte-ignore state_referenced_locally
  let ten = $state(firstEmpty.slice(0, 1));
  const shown = $derived(NUMBER_KEYS.filter((k) => k.startsWith(ten)));
  const converted = $derived(numberPairs(convert));

  const open = (k: string) => nav.go({ name: 'numbers-create', start: k });
</script>

<TopBar title="Nombres">
  {#snippet actions()}
    <button class="btn text has-icon" onclick={() => (quizOpen = true)} disabled={filled === 0}><Icon name="play" size={18} />Tester</button>
  {/snippet}
</TopBar>

<div class="page">
  <div class="card-tonal explain">
    <p class="title-m">Chaque chiffre = un son. Tu ajoutes des voyelles pour faire un mot.</p>
    <div class="eq">
      <span class="d">3</span>= <b class="so">M</b>
      <span class="d" style="margin-left: 8px">4</span>= <b class="so">R</b>
      <span class="grow"></span>
      <span>34 → <b>M</b>u<b>R</b> = « mur »</span>
    </div>
    <button class="link body-m" onclick={() => (soundsOpen = true)}>Voir les 10 sons et leurs astuces</button>
  </div>

  <label class="conv card-outlined">
    <span class="label-m onv">Convertir un nombre</span>
    <span class="row" style="flex-wrap: wrap; gap: 6px 10px">
      <input bind:value={convert} inputmode="numeric" placeholder="Ex. 1789" class="title-l" />
      {#each converted as g (g.raw)}
        {#each g.pairs as p, i (i)}
          <button class="chip plain" class:selected={!!db.numbers[p]} onclick={() => open(p)}>
            {p} · {db.numbers[p] ?? '?'}
          </button>
        {/each}
      {/each}
    </span>
  </label>

  <div class="row prog">
    <div class="progress grow"><span style:width="{filled}%"></span></div>
    <span class="label-m onv">{filled} / 100</span>
    {#if filled < 100}
      <button class="btn filled" onclick={() => open(firstEmpty)}>{filled ? 'Créer les suivantes' : 'Commencer'}</button>
    {/if}
  </div>

  <div class="chips tens">
    {#each ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as t (t)}
      <button class="chip plain" class:selected={ten === t} onclick={() => (ten = t)}>{t}0</button>
    {/each}
  </div>

  <div style="height: 6px"></div>
  {#each shown as k (k)}
    {@const v = db.numbers[k]}
    <button class="list-item two nr" onclick={() => open(k)}>
      <span class="nb" class:todo={!v}>{k}</span>
      <span class="li-text">
        {#if v}
          <span class="li-head">{v}</span>
          <span class="li-sup">sons <b class="primary">{majorHint(k)}</b></span>
        {:else}
          <span class="li-sup">À créer · sons <b class="primary">{majorHint(k)}</b></span>
          <span class="sug">
            {#each (MAJOR_WORDS[k] ?? []).slice(0, 3) as w (w)}<span>{w}</span>{/each}
          </span>
        {/if}
      </span>
    </button>
  {/each}
</div>

<SoundsSheet bind:open={soundsOpen} />
<QuizStart bind:open={quizOpen} kind="numbers" explain="On te montre un nombre, tu retrouves ton image." />

<style>
  .explain {
    margin: 4px 16px 0;
  }

  .eq {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-top: 10px;
    flex-wrap: wrap;
  }

  .eq .d {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    background: var(--surface);
    color: var(--on);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: 17px;
  }

  .so {
    color: var(--p);
  }

  .link {
    text-decoration: underline;
    margin-top: 10px;
    color: inherit;
  }

  .conv {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 12px 16px 0;
    padding: 10px 14px;
  }

  .conv input {
    border: none;
    outline: none;
    background: transparent;
    width: 110px;
    padding: 0;
  }

  .prog {
    padding: 16px 16px 0;
    gap: 12px;
  }

  .tens {
    padding-top: 14px;
  }

  .nr {
    min-height: 68px;
  }

  .nb {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    background: var(--pc);
    color: var(--onpc);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 19px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .nb.todo {
    background: transparent;
    border: 1.5px dashed var(--outline-v);
    color: var(--onv);
  }

  .sug {
    display: flex;
    gap: 6px;
    margin-top: 4px;
    flex-wrap: wrap;
  }

  .sug span {
    font-size: 12.5px;
    padding: 2px 8px;
    border-radius: 8px;
    background: var(--surface-high);
  }
</style>

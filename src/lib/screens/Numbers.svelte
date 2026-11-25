<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import QuizStart from '../components/QuizStart.svelte';
  import { db } from '../store.svelte';
  import { MAJOR, MAJOR_EXAMPLES, NUMBER_KEYS, majorHint } from '../major';
  import { haptic } from '../haptics';

  let explainOpen = $state(false);
  let quizOpen = $state(false);
  let editKey = $state<string | null>(null);
  let editOpen = $state(false);
  let draft = $state('');

  const filled = $derived(NUMBER_KEYS.filter((k) => db.numbers[k]?.trim()).length);
  const editIdx = $derived(editKey ? NUMBER_KEYS.indexOf(editKey) : -1);

  function open(k: string) {
    editKey = k;
    draft = db.numbers[k] ?? '';
    editOpen = true;
  }

  function commit() {
    if (!editKey) return;
    const v = draft.trim();
    if (v) db.numbers[editKey] = v;
    else delete db.numbers[editKey];
  }

  function go(delta: number) {
    commit();
    haptic.tick();
    const next = NUMBER_KEYS[editIdx + delta];
    if (!next) {
      editOpen = false;
      return;
    }
    open(next);
  }
</script>

<TopBar title="Nombres">
  {#snippet actions()}
    <button class="btn text has-icon" onclick={() => (quizOpen = true)} disabled={filled === 0}>
      <Icon name="play" size={18} />Tester
    </button>
  {/snippet}
</TopBar>

<div class="page">
  <p class="body-m page-sub">{filled} / 100 images</p>
  <div class="px" style="margin-top: 12px">
    <div class="progress"><span style:width="{filled}%"></span></div>
  </div>

  <button class="intro card-outlined" onclick={() => (explainOpen = true)}>
    <Icon name="info" class="primary" />
    <span class="grow">
      <span class="title-m">C'est quoi, un système de nombres ?</span>
      <span class="body-m onv">
        On associe à chaque nombre de 00 à 99 une image concrète. Les chiffres deviennent faciles à placer dans un palais.
      </span>
    </span>
  </button>

  <div class="grid">
    {#each NUMBER_KEYS as k (k)}
      {@const v = db.numbers[k]}
      <button class="cell st" class:filled={!!v} onclick={() => open(k)}>
        <span class="n">{k}</span>
        <span class="v ellipsis">{v || majorHint(k)}</span>
      </button>
    {/each}
  </div>
</div>

<Sheet bind:open={editOpen} title={editKey ? `Nombre ${editKey}` : ''} onclose={commit}>
  {#if editKey}
    <p class="body-m onv" style="margin: -4px 0 16px">
      Sons du système majeur : <b>{majorHint(editKey)}</b>{#if MAJOR_EXAMPLES[editKey]}, par ex. « {MAJOR_EXAMPLES[editKey]} »{/if}
    </p>
    <label class="tf">
      <span>Ton image pour {editKey}</span>
      <input
        bind:value={draft}
        placeholder="Un objet ou un personnage concret"
        enterkeyhint="next"
        onkeydown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            go(1);
          }
        }}
      />
    </label>
  {/if}
  {#snippet footer()}
    <button class="btn outlined has-icon" disabled={editIdx <= 0} onclick={() => go(-1)}><Icon name="back" size={18} />Préc.</button>
    <span class="grow"></span>
    <button class="btn filled" onclick={() => go(1)}>{editIdx >= 99 ? 'Terminer' : 'Suivant'}</button>
  {/snippet}
</Sheet>

<Sheet bind:open={explainOpen} title="Systèmes de nombres">
  <div class="explain body-m">
    <p>
      Pour retenir des nombres (codes, dates, téléphones, π…), on transforme chaque paire de chiffres en une <b>image</b>, qu'on
      dépose ensuite sur un locus. Ex. 1789 → « 17 » + « 89 » → deux images sur deux loci.
    </p>
    <p class="title-m">Le système majeur</p>
    <p>Chaque chiffre = un son de consonne. Les voyelles sont libres, tu les ajoutes pour former un mot.</p>
    <div class="major">
      {#each Object.entries(MAJOR) as [d, s] (d)}
        <span><b>{d}</b>&nbsp;&nbsp;{s}</span>
      {/each}
    </div>
    <p>
      Ex. <b>31</b> = m + t → « mot », <b>42</b> = r + n → « reine », <b>91</b> = p + t → « patte ». On compte les
      <i>sons</i>, pas les lettres muettes.
    </p>
    <p class="title-m">Variantes avancées</p>
    <p>
      <b>PAO</b> (Personne-Action-Objet) : chaque nombre a une personne, une action et un objet. 6 chiffres tiennent dans une
      seule scène. C'est la méthode des champions de mémoire.
    </p>
    <p><b>Dominic</b> : chaque chiffre = une lettre, chaque paire = les initiales d'une personne connue.</p>
    <p class="title-m">Pour commencer</p>
    <p>Remplis tes images une fois pour toutes (touche un nombre, puis Suivant), puis teste-toi jusqu'à ce que ce soit automatique.</p>
  </div>
</Sheet>

<QuizStart bind:open={quizOpen} kind="numbers" explain="On te montre un nombre, tu retrouves ton image." />

<style>
  .intro {
    display: flex;
    gap: 16px;
    margin: 16px;
    width: calc(100% - 32px);
    text-align: left;
  }

  .intro .grow {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 8px;
    padding: 0 16px;
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 12px;
    border-radius: 12px;
    background: var(--surface-low);
    text-align: left;
    min-width: 0;
    color: var(--onv);
  }

  .cell.filled {
    background: var(--sc);
    color: var(--onsc);
  }

  .n {
    font-size: 20px;
    line-height: 28px;
    font-weight: 500;
    color: var(--on);
  }

  .cell.filled .n {
    color: var(--onsc);
  }

  .v {
    font-size: 13px;
    width: 100%;
  }

  .cell.filled .v {
    font-weight: 500;
  }

  .explain {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .explain .title-m {
    margin-top: 8px;
  }

  .major {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    padding: 16px;
    border-radius: 16px;
    background: var(--surface-high);
  }
</style>

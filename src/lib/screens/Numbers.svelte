<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import QuizStart from '../components/QuizStart.svelte';
  import { db } from '../store.svelte';
  import { MAJOR, MAJOR_EXAMPLES, NUMBER_KEYS, majorHint } from '../major';

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
    const next = NUMBER_KEYS[editIdx + delta];
    if (!next) {
      editOpen = false;
      return;
    }
    open(next);
  }
</script>

<TopBar title="Nombres" subtitle={`${filled} / 100 images`}>
  {#snippet actions()}
    <button class="btn ghost" onclick={() => (quizOpen = true)} disabled={filled === 0}>▶ Tester</button>
  {/snippet}
</TopBar>

<div class="page">
  <button class="card intro" onclick={() => (explainOpen = true)}>
    <b>🔢 C'est quoi, un système de nombres ?</b>
    <span class="muted small">
      Les chiffres sont abstraits et difficiles à retenir. On associe donc à chaque nombre de 00 à 99 une image concrète
      (un objet, un personnage). Touche ici pour en savoir plus.
    </span>
  </button>

  <div class="grid">
    {#each NUMBER_KEYS as k (k)}
      {@const v = db.numbers[k]}
      <button class="cell" class:filled={!!v} onclick={() => open(k)}>
        <span class="num">{k}</span>
        <span class="val ellipsis">{v || majorHint(k)}</span>
      </button>
    {/each}
  </div>
</div>

<Sheet bind:open={editOpen} title={editKey ? `Nombre ${editKey}` : ''} onclose={commit}>
  {#if editKey}
    <p class="muted small" style="margin-bottom: 12px">
      Sons du système majeur : <b>{majorHint(editKey)}</b>
      {#if MAJOR_EXAMPLES[editKey]}· ex. « {MAJOR_EXAMPLES[editKey]} »{/if}
    </p>
    <label class="field">
      <span>Ton image pour {editKey}</span>
      <input
        class="input"
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
    <button class="btn" disabled={editIdx <= 0} onclick={() => go(-1)} aria-label="Précédent">←</button>
    <button class="btn primary grow" onclick={() => go(1)}>{editIdx >= 99 ? 'Terminer' : 'Suivant →'}</button>
  {/snippet}
</Sheet>

<Sheet bind:open={explainOpen} title="Systèmes de nombres">
  <div class="explain">
    <p>
      Pour retenir des nombres (codes, dates, numéros de téléphone, π…), on transforme chaque paire de chiffres en une
      <b>image</b> qu'on dépose ensuite sur un locus de ton palais.
    </p>
    <p>Ex : 1789 → « 17 » et « 89 » → deux images sur deux loci.</p>

    <h3>Le système majeur (le plus simple pour commencer)</h3>
    <p>Chaque chiffre = un son de consonne. Les voyelles sont libres, tu les ajoutes pour former un mot :</p>
    <div class="major">
      {#each Object.entries(MAJOR) as [d, s] (d)}
        <span><b>{d}</b> {s}</span>
      {/each}
    </div>
    <p>
      Ex : <b>31</b> = m + t → « <b>mot</b> », <b>42</b> = r + n → « <b>reine</b> », <b>91</b> = p + t →
      « <b>patte</b> ». On compte les <i>sons</i>, pas les lettres muettes.
    </p>

    <h3>Les variantes avancées</h3>
    <p>
      <b>PAO</b> (Personne-Action-Objet) : chaque nombre a une personne, une action et un objet. 6 chiffres = une seule
      scène (« Einstein » + « jongle » + « avec une banane »). C'est ce qu'utilisent les champions de mémoire.
    </p>
    <p><b>Dominic</b> : chaque chiffre = une lettre, chaque paire = les initiales d'une personne connue.</p>

    <h3>Comment commencer</h3>
    <p>
      Remplis les images ici une fois pour toutes (touche un nombre, puis « Suivant »). Teste-toi avec ▶ jusqu'à ce que ce
      soit automatique. Ensuite, utilise-les dans tes contenus.
    </p>
  </div>
</Sheet>

<QuizStart bind:open={quizOpen} kind="numbers" explain="On te montre un nombre, tu retrouves ton image." />

<style>
  .intro {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 14px 16px;
    text-align: left;
    width: 100%;
    margin-bottom: 14px;
  }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(96px, 1fr));
    gap: 8px;
  }

  .cell {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 10px;
    border-radius: 12px;
    background: var(--surface);
    border: 1px dashed var(--border);
    text-align: left;
    min-width: 0;
  }

  .cell.filled {
    border-style: solid;
    background: var(--accent-soft);
  }

  .num {
    font-weight: 800;
    font-size: 1.15rem;
    font-variant-numeric: tabular-nums;
  }

  .val {
    font-size: 0.8rem;
    color: var(--muted);
    width: 100%;
  }

  .cell.filled .val {
    color: var(--text);
    font-weight: 600;
  }

  .explain {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .explain h3 {
    margin-top: 10px;
    font-size: 1rem;
  }

  .major {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    padding: 12px;
    border-radius: 12px;
    background: var(--surface-2);
  }
</style>

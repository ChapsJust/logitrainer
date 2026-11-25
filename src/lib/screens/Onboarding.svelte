<script lang="ts">
  import Icon, { type IconName } from '../components/Icon.svelte';
  import { createPalaceWithLoci, createSample, db } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { haptic } from '../haptics';

  let step = $state(0);
  let name = $state('');
  let lociText = $state('');

  const suggestions = ['Ma maison', 'Mon appartement', 'Chemin du travail', 'Mon école', 'Maison de mes parents'];
  const loci = $derived(
    lociText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean),
  );

  const intro: { icon: IconName; title: string; text: string }[] = [
    { icon: 'home', title: 'Un lieu que tu connais par cœur', text: 'Ta maison, ton école, ton trajet du matin : c’est ton palais.' },
    { icon: 'list', title: 'Un trajet dans un ordre fixe', text: 'Chaque endroit précis sur ce trajet est un locus, numéroté.' },
    { icon: 'sparkle', title: 'Une image par locus', text: 'Tu y déposes une image frappante pour retenir une info, dans l’ordre.' },
  ];

  function finish(open?: string) {
    db.settings.onboarded = true;
    haptic.success();
    if (open) nav.go({ name: 'palace', id: open });
  }

  function next() {
    haptic.tap();
    step++;
  }
</script>

<div class="ob">
  <div class="top">
    {#if step > 0}
      <button class="icon-btn" onclick={() => step--} aria-label="Retour"><Icon name="back" /></button>
    {:else}
      <span></span>
    {/if}
    <div class="dots">
      {#each [0, 1, 2] as i (i)}<span class:on={i === step}></span>{/each}
    </div>
    <button class="btn text" onclick={() => finish()}>Passer</button>
  </div>

  {#key step}
    <div class="body">
      {#if step === 0}
        <div class="hero"><Icon name="door" size={44} /></div>
        <h1 class="headline-m">Bienvenue dans Logidex</h1>
        <p class="body-l onv lead">Ton carnet de palais mentaux : tous tes trajets, leurs loci et ce que tu y as rangé.</p>
        <div class="steps">
          {#each intro as s, i (i)}
            <div class="step">
              <span class="num"><Icon name={s.icon} size={20} /></span>
              <span class="li-text">
                <span class="title-m">{s.title}</span>
                <span class="body-m onv">{s.text}</span>
              </span>
            </div>
          {/each}
        </div>
      {:else if step === 1}
        <h1 class="headline-m">Choisis ton premier lieu</h1>
        <p class="body-l onv lead">Un endroit que tu peux parcourir les yeux fermés.</p>
        <label class="tf">
          <span>Nom du lieu</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:value={name} placeholder="Ex. Maison de mes parents" autofocus enterkeyhint="next" />
        </label>
        <div class="sugg">
          {#each suggestions as s (s)}
            <button class="chip plain" class:selected={name === s} onclick={() => (name = s)}>{s}</button>
          {/each}
        </div>
      {:else}
        <h1 class="headline-m">Note les endroits, dans l'ordre</h1>
        <p class="body-l onv lead">Un endroit par ligne, en suivant ton trajet. Tu pourras tout réorganiser plus tard.</p>
        <label class="tf">
          <span>Loci de « {name.trim() || 'ton palais'} »</span>
          <!-- svelte-ignore a11y_autofocus -->
          <textarea bind:value={lociText} rows="8" placeholder={'Porte d’entrée\nBanc à chaussures\nMiroir\nFrigo\nÉvier'} autofocus></textarea>
        </label>
        <p class="helper">
          {loci.length
            ? `${loci.length} loci. Choisis des endroits bien distincts : un meuble, un objet, un coin.`
            : '10 à 20 endroits bien distincts, c’est idéal pour commencer.'}
        </p>
      {/if}
    </div>
  {/key}

  <div class="foot">
    {#if step === 0}
      <button class="btn filled lg block" onclick={next}>Créer mon premier palais</button>
      <button class="btn text lg block" onclick={() => finish(createSample().id)}>Voir un exemple d'abord</button>
    {:else if step === 1}
      <button class="btn filled lg block" disabled={!name.trim()} onclick={next}>Continuer</button>
    {:else}
      <button
        class="btn filled lg block"
        disabled={loci.length === 0}
        onclick={() => finish(createPalaceWithLoci(name.trim(), loci).id)}
      >
        Créer le palais
      </button>
    {/if}
  </div>
</div>

<style>
  .ob {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: var(--safe-top) 0 var(--safe-bottom);
    max-width: 560px;
    margin: 0 auto;
  }

  .top {
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 8px;
  }

  .top > span {
    width: 48px;
  }

  .dots {
    display: flex;
    gap: 6px;
  }

  .dots span {
    width: 8px;
    height: 8px;
    border-radius: 4px;
    background: var(--outline-v);
    transition: width 0.25s var(--ease);
  }

  .dots span.on {
    width: 24px;
    background: var(--p);
  }

  .body {
    flex: 1;
    padding: 16px 24px;
    animation: in 0.3s var(--ease);
  }

  @keyframes in {
    from {
      opacity: 0;
      transform: translateX(24px);
    }
  }

  .hero {
    width: 88px;
    height: 88px;
    border-radius: 28px;
    background: var(--pc);
    color: var(--onpc);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 24px 0 28px;
  }

  .lead {
    margin: 8px 0 28px;
  }

  .steps {
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .step {
    display: flex;
    gap: 16px;
    align-items: flex-start;
  }

  .sugg {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .foot {
    padding: 16px 24px 24px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>

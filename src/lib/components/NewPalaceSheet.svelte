<script lang="ts">
  /** Créer un palais : nom, matière (facultatif) et lieu (facultatif, ou nouveau lieu sur place). */
  import Sheet from './Sheet.svelte';
  import Icon from './Icon.svelte';
  import PlaceIconView from './PlaceIconView.svelte';
  import { createPalace, createPlace, db } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import type { PlaceIcon } from '../types';

  let { open = $bindable(), placeId }: { open: boolean; placeId?: string } = $props();

  let name = $state('');
  let subject = $state('');
  let chosen = $state<string | undefined>(undefined);
  let newPlace = $state(false);
  let newPlaceName = $state('');
  let newPlaceIcon = $state<PlaceIcon>('building');

  const ICONS: { id: PlaceIcon; label: string }[] = [
    { id: 'building', label: 'École / immeuble' },
    { id: 'home', label: 'Maison' },
    { id: 'briefcase', label: 'Travail' },
    { id: 'tree', label: 'Extérieur' },
    { id: 'map', label: 'Ville / trajet' },
    { id: 'star', label: 'Autre' },
  ];

  $effect(() => {
    if (open) {
      chosen = placeId;
      newPlace = false;
    }
  });

  function create() {
    let pid = chosen;
    if (newPlace && newPlaceName.trim()) pid = createPlace(newPlaceName, newPlaceIcon).id;
    const p = createPalace(name, '', pid, subject);
    open = false;
    name = '';
    subject = '';
    newPlaceName = '';
    nav.go({ name: 'palace', id: p.id });
  }
</script>

<Sheet bind:open title="Nouveau palais">
  <form
    onsubmit={(e) => {
      e.preventDefault();
      create();
    }}
  >
    <label class="tf">
      <span>Nom du palais</span>
      <!-- svelte-ignore a11y_autofocus -->
      <input bind:value={name} placeholder="Ex. Classe de maths, Rez-de-chaussée" autofocus enterkeyhint="next" />
    </label>
    <label class="tf">
      <span>Matière ou sujet (facultatif)</span>
      <input bind:value={subject} placeholder="Ex. Mathématiques" enterkeyhint="done" />
    </label>

    <p class="label-l primary" style="margin: 4px 0 6px">Dans quel lieu ?</p>
    <div class="opts">
      <button type="button" class="opt" class:on={!chosen && !newPlace} onclick={() => ((chosen = undefined), (newPlace = false))}>
        <span class="none"><Icon name="x" size={18} /></span>
        <span class="grow body-l">Aucun lieu</span>
        {#if !chosen && !newPlace}<Icon name="check" class="primary" />{/if}
      </button>
      {#each db.places as l (l.id)}
        <button type="button" class="opt" class:on={chosen === l.id && !newPlace} onclick={() => ((chosen = l.id), (newPlace = false))}>
          <PlaceIconView icon={l.icon} size={36} />
          <span class="grow body-l ellipsis">{l.name}</span>
          {#if chosen === l.id && !newPlace}<Icon name="check" class="primary" />{/if}
        </button>
      {/each}
      <button type="button" class="opt" class:on={newPlace} onclick={() => (newPlace = true)}>
        <span class="none"><Icon name="plus" size={18} /></span>
        <span class="grow body-l primary">Nouveau lieu…</span>
      </button>
    </div>

    {#if newPlace}
      <div class="newplace">
        <label class="tf" style="margin-bottom: 10px">
          <span>Nom du lieu</span>
          <!-- svelte-ignore a11y_autofocus -->
          <input bind:value={newPlaceName} placeholder="Ex. École secondaire" autofocus />
        </label>
        <div class="icons">
          {#each ICONS as ic (ic.id)}
            <button type="button" class="icn" class:on={newPlaceIcon === ic.id} onclick={() => (newPlaceIcon = ic.id)} aria-label={ic.label}>
              <PlaceIconView icon={ic.id} size={40} />
            </button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="row" style="justify-content: flex-end; margin-top: 16px">
      <button class="btn text" type="button" onclick={() => (open = false)}>Annuler</button>
      <button class="btn filled" type="submit" disabled={newPlace && !newPlaceName.trim()}>Créer</button>
    </div>
  </form>
</Sheet>

<style>
  .opts {
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin: 0 -8px;
  }

  .opt {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px;
    border-radius: 16px;
    border: 2px solid transparent;
    text-align: left;
    width: 100%;
  }

  .opt.on {
    border-color: var(--p);
    background: var(--surface-high);
  }

  .none {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    background: var(--surface-high);
    color: var(--onv);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .newplace {
    margin-top: 12px;
  }

  .icons {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .icn {
    border-radius: 16px;
    padding: 3px;
    border: 2px solid transparent;
  }

  .icn.on {
    border-color: var(--p);
  }
</style>

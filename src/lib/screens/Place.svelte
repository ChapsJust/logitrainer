<script lang="ts">
  import TopBar from '../components/TopBar.svelte';
  import Sheet from '../components/Sheet.svelte';
  import Icon from '../components/Icon.svelte';
  import PalaceRow from '../components/PalaceRow.svelte';
  import PlaceIconView from '../components/PlaceIconView.svelte';
  import NewPalaceSheet from '../components/NewPalaceSheet.svelte';
  import { deletePlace, getPlace, palacesOf } from '../store.svelte';
  import { nav } from '../nav.svelte';
  import { lociCount, plural } from '../util';
  import { withUndo } from '../app.svelte';
  import type { PlaceIcon } from '../types';

  let { id }: { id: string } = $props();

  const place = $derived(getPlace(id));
  const list = $derived(palacesOf(id));
  const loci = $derived(list.reduce((s, p) => s + lociCount(p), 0));
  const subjects = $derived(new Set(list.map((p) => p.subject).filter(Boolean)).size);
  const loose = $derived(palacesOf(undefined));

  let newOpen = $state(false);
  let editOpen = $state(false);
  let addExistingOpen = $state(false);

  const ICONS: PlaceIcon[] = ['building', 'home', 'briefcase', 'tree', 'map', 'star'];
</script>

{#if place}
  <TopBar back>
    {#snippet actions()}
      <button class="icon-btn" onclick={() => (editOpen = true)} aria-label="Modifier le lieu"><Icon name="pencil" size={22} /></button>
    {/snippet}
  </TopBar>

  <div class="page no-nav">
    <div class="head px">
      <PlaceIconView icon={place.icon} size={56} />
      <div class="grow">
        <h1 class="headline-m ellipsis">{place.name}</h1>
        <p class="body-m onv">{plural(list.length, 'palais', 'palais')} · {plural(loci, 'locus', 'loci')}</p>
      </div>
    </div>
    {#if list.length > 1}
      <p class="body-m onv px" style="margin-top: 12px">
        {subjects > 1
          ? 'Chaque palais a sa matière : elles ne se mélangent pas.'
          : 'Chaque palais est un trajet séparé dans ce lieu.'}
      </p>
    {/if}

    <h2 class="subheader">Palais de ce lieu</h2>
    {#each list as p (p.id)}
      <PalaceRow palace={p} />
    {:else}
      <div class="empty" style="padding-top: 24px">
        <p class="body-m">
          Ajoute un palais par trajet : une classe, un étage, une pièce… Ex. pour une école : « Classe de maths », « Labo de
          chimie ».
        </p>
      </div>
    {/each}

    <div class="chips" style="padding-top: 16px; flex-wrap: wrap">
      <button class="chip" onclick={() => (newOpen = true)}><Icon name="plus" />Nouveau palais ici</button>
      {#if loose.length}
        <button class="chip" onclick={() => (addExistingOpen = true)}><Icon name="move" />Ranger un palais existant</button>
      {/if}
    </div>
  </div>

  <NewPalaceSheet bind:open={newOpen} placeId={place.id} />

  <Sheet bind:open={addExistingOpen} title="Ranger dans {place.name}">
    <p class="body-m onv" style="margin-bottom: 8px">Palais sans lieu :</p>
    <div class="pick">
      {#each loose as p (p.id)}
        <button
          class="list-item"
          onclick={() => {
            p.placeId = place.id;
            if (palacesOf(undefined).length === 0) addExistingOpen = false;
          }}
        >
          <span class="num"><Icon name="plus" size={18} /></span>
          <span class="li-text"><span class="li-head ellipsis">{p.name}</span><span class="li-sup">{plural(lociCount(p), 'locus', 'loci')}</span></span>
        </button>
      {/each}
    </div>
  </Sheet>

  <Sheet bind:open={editOpen} title="Modifier le lieu">
    <label class="tf">
      <span>Nom</span>
      <input bind:value={place.name} />
    </label>
    <div class="icons">
      {#each ICONS as ic (ic)}
        <button class="icn" class:on={place.icon === ic} onclick={() => (place.icon = ic)} aria-label={ic}>
          <PlaceIconView icon={ic} size={40} />
        </button>
      {/each}
    </div>
    {#snippet footer()}
      <button
        class="btn text danger-text"
        onclick={() => {
          editOpen = false;
          const pid = place.id;
          nav.back();
          withUndo('Lieu supprimé (ses palais sont gardés)', () => deletePlace(pid));
        }}>Supprimer le lieu</button
      >
      <span class="grow"></span>
      <button class="btn filled" onclick={() => (editOpen = false)}>OK</button>
    {/snippet}
  </Sheet>
{/if}

<style>
  .head {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-top: 4px;
  }

  .pick {
    margin: 0 -24px;
  }

  .pick .list-item {
    padding-left: 24px;
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

  :global(.danger-text) {
    color: var(--error) !important;
  }
</style>

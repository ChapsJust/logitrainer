<script lang="ts">
  import Icon from './Icon.svelte';
  import Avatar from './Avatar.svelte';
  import { nav } from '../nav.svelte';
  import { lociCount, plural } from '../util';
  import { OCCUPANCY_LABEL, palaceUse } from '../interference';
  import type { Palace } from '../types';

  /** `nested` : affiché dans la carte d'un lieu (sans avatar, en retrait). */
  let { palace, nested = false }: { palace: Palace; nested?: boolean } = $props();
  const use = $derived(palaceUse(palace));
  const zones = $derived(palace.rooms.filter((r) => r.name).length);
</script>

<button class="list-item two row-p" class:nested onclick={() => nav.go({ name: 'palace', id: palace.id })}>
  {#if !nested}<Avatar id={palace.id} name={palace.name} />{/if}
  <span class="li-text">
    <span class="li-head ellipsis">{palace.name}</span>
    <span class="li-sup ellipsis">
      {#if palace.subject}<span class="subj">{palace.subject}</span> · {/if}{plural(lociCount(palace), 'locus', 'loci')}{zones
        ? ' · ' + plural(zones, 'zone', 'zones')
        : ''}
    </span>
  </span>
  {#if palace.training}
    <span class="spill used"><Icon name="flask" size={14} />Labo</span>
  {:else}
    <span class="spill {use.state}">
      {#if use.state === 'mixed'}<Icon name="alert" size={14} stroke={2.2} />{/if}{OCCUPANCY_LABEL[use.state]}
    </span>
  {/if}
</button>

<style>
  .nested {
    padding-left: 24px;
    min-height: 64px;
  }

  .subj {
    display: inline-flex;
    align-items: center;
    height: 20px;
    padding: 0 8px;
    border-radius: 6px;
    background: var(--sc);
    color: var(--onsc);
    font-size: 12px;
    font-weight: 600;
  }
</style>

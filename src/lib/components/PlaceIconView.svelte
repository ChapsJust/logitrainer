<script lang="ts">
  import Icon from './Icon.svelte';
  import type { PlaceIcon } from '../types';

  let { icon, size = 44 }: { icon: PlaceIcon; size?: number } = $props();
  const tone: Record<PlaceIcon, number> = { home: 1, building: 2, briefcase: 3, tree: 1, map: 4, star: 3 };
</script>

<span
  class="pi"
  style:width="{size}px"
  style:height="{size}px"
  style:border-radius="{Math.round(size * 0.32)}px"
  style:background="var(--av{tone[icon]})"
  style:color="var(--onav{tone[icon]})"><Icon name={icon} size={Math.round(size * 0.5)} /></span
>

<style>
  .pi {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
</style>

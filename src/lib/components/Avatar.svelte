<script lang="ts">
  import { avatarTone, initials } from '../util';

  let { id, name, size = 48 }: { id: string; name: string; size?: number } = $props();
  const tone = $derived(avatarTone(id));
</script>

<span
  class="avatar"
  style:width="{size}px"
  style:height="{size}px"
  style:border-radius="{Math.round(size * 0.3)}px"
  style:font-size="{Math.round(size * 0.34)}px"
  style:background="var(--av{tone})"
  style:color="var(--onav{tone})">{initials(name)}</span
>

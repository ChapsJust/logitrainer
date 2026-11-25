<script lang="ts">
  import type { Snippet } from 'svelte';
  import { pushOverlay } from '../nav.svelte';

  interface Props {
    open: boolean;
    title?: string;
    onclose?: () => void;
    children: Snippet;
    footer?: Snippet;
  }

  let { open = $bindable(), title = '', onclose, children, footer }: Props = $props();

  let dragY = $state(0);
  let startY = 0;
  let dragging = $state(false);

  function close() {
    open = false;
    onclose?.();
  }

  $effect(() => {
    if (!open) return;
    const release = pushOverlay(close);
    document.body.style.overflow = 'hidden';
    return () => {
      release();
      document.body.style.overflow = '';
    };
  });

  // Glisser la poignée vers le bas pour fermer.
  function down(e: PointerEvent) {
    dragging = true;
    startY = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }
  function moveHandle(e: PointerEvent) {
    if (dragging) dragY = Math.max(0, e.clientY - startY);
  }
  function up() {
    dragging = false;
    if (dragY > 90) close();
    dragY = 0;
  }
</script>

{#if open}
  <div class="scrim" role="presentation" onclick={close}></div>
  <div
    class="sheet"
    class:dragging
    role="dialog"
    aria-modal="true"
    aria-label={title}
    style:transform={dragY ? `translateY(${dragY}px)` : undefined}
  >
    <div class="handle-zone" role="presentation" onpointerdown={down} onpointermove={moveHandle} onpointerup={up} onpointercancel={up}>
      <div class="handle"></div>
      {#if title}<h2 class="title-l">{title}</h2>{/if}
    </div>
    <div class="body">
      {@render children()}
    </div>
    {#if footer}
      <div class="foot">{@render footer()}</div>
    {/if}
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    z-index: 50;
    animation: fade 0.2s var(--ease);
  }

  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 92dvh;
    display: flex;
    flex-direction: column;
    background: var(--surface-low);
    border-radius: 28px 28px 0 0;
    z-index: 51;
    padding-bottom: var(--safe-bottom);
    animation: up 0.32s var(--ease);
    max-width: 640px;
    margin: 0 auto;
    transition: transform 0.2s var(--ease);
  }

  .sheet.dragging {
    transition: none;
  }

  .handle-zone {
    padding: 0 24px 4px;
    touch-action: none;
    flex-shrink: 0;
  }

  .handle {
    width: 32px;
    height: 4px;
    border-radius: 2px;
    background: var(--onv);
    opacity: 0.4;
    margin: 22px auto 18px;
  }

  .body {
    padding: 12px 24px 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .foot {
    padding: 8px 24px 16px;
    display: flex;
    gap: 8px;
    justify-content: flex-end;
    flex-shrink: 0;
  }

  @keyframes up {
    from {
      transform: translateY(100%);
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>

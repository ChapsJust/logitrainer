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
</script>

{#if open}
  <div class="backdrop" role="presentation" onclick={close}></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={title}>
    <div class="handle"></div>
    {#if title}
      <div class="head">
        <h2>{title}</h2>
        <button class="icon-btn" onclick={close} aria-label="Fermer">✕</button>
      </div>
    {/if}
    <div class="body">
      {@render children()}
    </div>
    {#if footer}
      <div class="foot">{@render footer()}</div>
    {/if}
  </div>
{/if}

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    background: rgb(0 0 0 / 0.45);
    z-index: 50;
    animation: fade 0.15s ease-out;
  }

  .sheet {
    position: fixed;
    left: 0;
    right: 0;
    bottom: 0;
    max-height: 92dvh;
    display: flex;
    flex-direction: column;
    background: var(--surface);
    border-radius: 22px 22px 0 0;
    z-index: 51;
    padding-bottom: var(--safe-bottom);
    animation: up 0.2s cubic-bezier(0.2, 0.9, 0.3, 1);
    max-width: 720px;
    margin: 0 auto;
  }

  .handle {
    width: 40px;
    height: 5px;
    border-radius: 3px;
    background: var(--border);
    margin: 8px auto 0;
    flex-shrink: 0;
  }

  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px 8px 0 20px;
    flex-shrink: 0;
  }

  .head h2 {
    font-size: 1.15rem;
  }

  .body {
    padding: 12px 20px 16px;
    overflow-y: auto;
    overscroll-behavior: contain;
  }

  .foot {
    padding: 10px 20px 14px;
    border-top: 1px solid var(--border);
    display: flex;
    gap: 10px;
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

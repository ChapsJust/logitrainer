<script lang="ts">
  import type { Snippet } from 'svelte';
  import { nav } from '../nav.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  interface Props {
    /** Titre affiché dans la barre (petite barre). Laisser vide si la page affiche un grand titre. */
    title?: string;
    back?: boolean;
    /** Icône de gauche (par défaut : flèche retour). */
    navIcon?: IconName;
    onnav?: () => void;
    actions?: Snippet;
  }

  let { title = '', back = false, navIcon = 'back', onnav, actions }: Props = $props();

  let scrolled = $state(false);
  $effect(() => {
    const on = () => (scrolled = window.scrollY > 4);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  });
</script>

<header class:scrolled>
  <div class="inner">
    {#if back}
      <button class="icon-btn nav" onclick={() => (onnav ? onnav() : nav.back())} aria-label="Retour">
        <Icon name={navIcon} />
      </button>
    {/if}
    <span class="title title-l ellipsis grow" class:pad={!back}>{title}</span>
    {#if actions}{@render actions()}{/if}
  </div>
</header>

<style>
  header {
    position: sticky;
    top: 0;
    z-index: 30;
    background: var(--surface);
    padding-top: var(--safe-top);
    transition: background 0.2s;
  }

  header.scrolled {
    background: var(--surface-c);
  }

  .inner {
    height: 64px;
    display: flex;
    align-items: center;
    gap: 0;
    padding: 0 4px;
    max-width: 720px;
    margin: 0 auto;
  }

  .nav {
    color: var(--on);
  }

  .title {
    padding-left: 4px;
  }

  .title.pad {
    padding-left: 12px;
  }
</style>

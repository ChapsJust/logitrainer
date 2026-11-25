<script lang="ts">
  import { pushOverlay } from '../nav.svelte';
  import Icon, { type IconName } from './Icon.svelte';

  interface Props {
    open: boolean;
    title: string;
    message: string;
    icon?: IconName;
    confirmLabel?: string;
    danger?: boolean;
    onconfirm: () => void;
  }

  let { open = $bindable(), title, message, icon, confirmLabel = 'Confirmer', danger = false, onconfirm }: Props = $props();

  $effect(() => {
    if (!open) return;
    return pushOverlay(() => (open = false));
  });
</script>

{#if open}
  <div class="scrim" role="presentation" onclick={() => (open = false)}></div>
  <div class="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
    {#if icon}<div class="icon" class:danger><Icon name={icon} /></div>{/if}
    <h2 class="headline-s" class:center={!!icon}>{title}</h2>
    <p class="body-m onv">{message}</p>
    <div class="actions">
      <button class="btn text" onclick={() => (open = false)}>Annuler</button>
      <button
        class="btn text"
        class:danger-text={danger}
        onclick={() => {
          open = false;
          onconfirm();
        }}>{confirmLabel}</button
      >
    </div>
  </div>
{/if}

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: var(--scrim);
    z-index: 60;
    animation: fade 0.2s var(--ease);
  }

  .dialog {
    position: fixed;
    z-index: 61;
    left: 50%;
    top: 50%;
    transform: translate(-50%, -50%);
    width: min(calc(100vw - 48px), 380px);
    background: var(--surface-high);
    border-radius: 28px;
    padding: 24px 24px 18px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    animation: pop 0.25s var(--ease);
  }

  .icon {
    align-self: center;
    color: var(--p);
  }

  .icon.danger,
  .danger-text {
    color: var(--error);
  }

  .center {
    text-align: center;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 4px;
    margin-top: 8px;
  }

  @keyframes pop {
    from {
      opacity: 0;
      transform: translate(-50%, -50%) scale(0.92);
    }
  }

  @keyframes fade {
    from {
      opacity: 0;
    }
  }
</style>

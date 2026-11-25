<script lang="ts">
  import Sheet from './Sheet.svelte';

  interface Props {
    open: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    onconfirm: () => void;
  }

  let { open = $bindable(), title, message, confirmLabel = 'Supprimer', onconfirm }: Props = $props();
</script>

<Sheet bind:open {title}>
  <p class="muted">{message}</p>
  {#snippet footer()}
    <button class="btn grow" onclick={() => (open = false)}>Annuler</button>
    <button
      class="btn danger grow"
      onclick={() => {
        open = false;
        onconfirm();
      }}>{confirmLabel}</button
    >
  {/snippet}
</Sheet>

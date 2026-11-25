<script lang="ts">
  import Sheet from './Sheet.svelte';
  import { nav, type QuizKind, type QuizOrder } from '../nav.svelte';

  interface Props {
    open: boolean;
    kind: QuizKind;
    id?: string;
    explain: string;
  }

  let { open = $bindable(), kind, id, explain }: Props = $props();

  const orders: { id: QuizOrder; label: string; desc: string }[] = [
    { id: 'forward', label: "Dans l'ordre", desc: 'Du début à la fin, comme une promenade.' },
    { id: 'backward', label: 'À rebours', desc: 'De la fin au début. Plus dur !' },
    { id: 'random', label: 'Au hasard', desc: 'Positions mélangées : vérifie que tu connais chaque numéro.' },
  ];

  function start(order: QuizOrder) {
    open = false;
    nav.go({ name: 'quiz', kind, id, order });
  }
</script>

<Sheet bind:open title="Tester">
  <p class="muted" style="margin-bottom: 14px">{explain}</p>
  <div class="stack">
    {#each orders as o (o.id)}
      <button class="card choice" onclick={() => start(o.id)}>
        <b>{o.label}</b>
        <span class="muted small">{o.desc}</span>
      </button>
    {/each}
  </div>
</Sheet>

<style>
  .choice {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 14px 16px;
    text-align: left;
    width: 100%;
    box-shadow: none;
  }

  .choice:active {
    background: var(--surface-2);
  }
</style>

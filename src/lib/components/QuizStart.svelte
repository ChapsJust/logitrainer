<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import { nav, type QuizKind, type QuizOrder } from '../nav.svelte';

  interface Props {
    open: boolean;
    kind: QuizKind;
    id?: string;
    explain: string;
  }

  let { open = $bindable(), kind, id, explain }: Props = $props();

  const orders: { id: QuizOrder; label: string; desc: string; icon: IconName }[] = [
    { id: 'forward', label: "Dans l'ordre", desc: 'Du début à la fin, comme une promenade', icon: 'forward' },
    { id: 'backward', label: 'À rebours', desc: 'De la fin au début, plus exigeant', icon: 'rewind' },
    { id: 'random', label: 'Au hasard', desc: 'Vérifie que tu connais chaque position', icon: 'shuffle' },
  ];

  function start(order: QuizOrder) {
    open = false;
    nav.go({ name: 'quiz', kind, id, order });
  }
</script>

<Sheet bind:open title="Tester">
  <p class="body-m onv" style="margin-bottom: 8px">{explain}</p>
  <div class="list">
    {#each orders as o (o.id)}
      <button class="list-item two" onclick={() => start(o.id)}>
        <span class="num"><Icon name={o.icon} size={20} /></span>
        <span class="li-text">
          <span class="li-head">{o.label}</span>
          <span class="li-sup">{o.desc}</span>
        </span>
        <Icon name="next" size={20} class="onv" />
      </button>
    {/each}
  </div>
</Sheet>

<style>
  .list {
    margin: 0 -24px;
  }

  .list .list-item {
    padding-left: 24px;
    padding-right: 24px;
  }
</style>

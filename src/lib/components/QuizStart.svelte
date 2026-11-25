<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Icon, { type IconName } from './Icon.svelte';
  import Switch from './Switch.svelte';
  import { nav, type QuizKind, type QuizOrder } from '../nav.svelte';
  import { db } from '../store.svelte';
  import { speechAvailable } from '../speech';

  let canSpeak = $state(false);
  void speechAvailable().then((v) => (canSpeak = v));
  let recite = $state(db.settings.recite ?? true);

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
  {#if kind !== 'numbers'}
    <div class="recite card-filled">
      <span class="num"><Icon name="mic" size={20} /></span>
      <span class="li-text">
        <span class="title-m">Réciter à voix haute</span>
        <span class="body-m onv">
          {canSpeak ? 'Dis ta réponse avant de la voir : la note est suggérée selon ce que tu as dit.' : 'Écris ta réponse avant de la voir (micro indisponible ici).'}
        </span>
      </span>
      <Switch bind:checked={recite} label="Réciter à voix haute" onchange={(v) => (db.settings.recite = v)} />
    </div>
  {/if}
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

  .recite {
    display: flex;
    align-items: center;
    gap: 12px;
    margin: 8px 0 12px;
    padding: 12px 16px;
  }

  .list .list-item {
    padding-left: 24px;
    padding-right: 24px;
  }
</style>

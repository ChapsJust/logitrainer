<script lang="ts" module>
  /** Icônes au trait (style Lucide/Material Symbols Outlined). */
  export const ICONS = {
    home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-3.6-3.6',
    hash: 'M4 9h16M4 15h16M10 3 8 21M16 3l-2 18',
    settings: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
    back: 'M15 18l-6-6 6-6',
    next: 'M9 18l6-6-6-6',
    plus: 'M12 5v14M5 12h14',
    pencil: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z',
    play: 'M7 4.5v15l12-7.5z',
    grip: 'M9 6h.01M9 12h.01M9 18h.01M15 6h.01M15 12h.01M15 18h.01',
    x: 'M18 6 6 18M6 6l12 12',
    check: 'M20 6 9 17l-5-5',
    more: 'M12 6h.01M12 12h.01M12 18h.01',
    walk: 'M13 4a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3M8 12l3-4 3 2 3 1M11 8l-1 6',
    eye: 'M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
    eyeOff: 'M3 3l18 18M10.6 5.1A10.6 10.6 0 0 1 12 5c6.5 0 10 7 10 7a17 17 0 0 1-2.4 3.3M6.6 6.6C3.8 8.4 2 12 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M9.9 9.9a3 3 0 0 0 4.2 4.2',
    list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7v5l3 2',
    trash: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14',
    up: 'M18 15l-6-6-6 6',
    down: 'M6 9l6 6 6-6',
    shuffle: 'M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5',
    rewind: 'M11 19 2 12l9-7zM22 19l-9-7 9-7z',
    forward: 'M5 12h14M13 6l6 6-6 6',
    download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
    upload: 'M12 21V9M7 14l5-5 5 5M5 3h14',
    refresh: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
    palette: 'M12 21a9 9 0 1 1 9-9c0 2-1.5 3-3.5 3H15a2 2 0 0 0-1.5 3.3A1.6 1.6 0 0 1 12 21zM7.5 11h.01M10 7h.01M14.5 7h.01M17 11h.01',
    shield: 'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
    info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 16v-5M12 8h.01',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
    door: 'M4 21h16M6 21V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v17M14 12h.01',
    layers: 'M12 2 2 7l10 5 10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
    sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.8 2.2L22 20l-2.2.8L19 23l-.8-2.2L16 20l2.2-.8z',
    trophy: 'M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3',
    folder: 'M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z',
    calendar: 'M4 6h16v15H4zM4 10h16M8 3v4M16 3v4',
    mic: 'M12 15a3 3 0 0 0 3-3V6a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zM19 11a7 7 0 0 1-14 0M12 18v3',
    bell: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0',
    archive: 'M3 4h18v4H3zM5 8v12h14V8M10 12h4',
    move: 'M8 3 4 7l4 4M4 7h16M16 21l4-4-4-4M20 17H4',
    key: 'M2.5 21.5l8.3-8.3M15 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM6 17l2 2M8 15l2 2',
    alert: 'M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01',
    check2: 'M22 11.1V12a10 10 0 1 1-5.9-9.1M22 4 12 14l-3-3',
  } as const;

  export type IconName = keyof typeof ICONS;
</script>

<script lang="ts">
  interface Props {
    name: IconName;
    size?: number;
    stroke?: number;
    class?: string;
    style?: string;
  }

  let { name, size = 24, stroke, class: cls = '', style }: Props = $props();
  const thick = $derived(name === 'grip' || name === 'more' ? 2.6 : (stroke ?? 1.8));
</script>

<svg
  class="i {cls}"
  {style}
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width={thick}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"><path d={ICONS[name]} /></svg
>

<style>
  svg {
    flex-shrink: 0;
    display: block;
  }
</style>

import { SpeechRecognition } from '@capacitor-community/speech-recognition';
import { isNative } from './util';

const LANG = 'fr-CA';

interface WebRecognition {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  continuous: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: ((e: { error: string }) => void) | null;
}

function webCtor(): (new () => WebRecognition) | undefined {
  const w = globalThis as unknown as { SpeechRecognition?: new () => WebRecognition; webkitSpeechRecognition?: new () => WebRecognition };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition;
}

let availability: Promise<boolean> | null = null;

/** La reconnaissance vocale est-elle utilisable sur cet appareil ? */
export function speechAvailable(): Promise<boolean> {
  availability ??= (async () => {
    if (isNative()) {
      try {
        return (await SpeechRecognition.available()).available;
      } catch {
        return false;
      }
    }
    return !!webCtor();
  })();
  return availability;
}

export async function ensureMicPermission(): Promise<boolean> {
  if (!isNative()) return true;
  try {
    const cur = await SpeechRecognition.checkPermissions();
    if (cur.speechRecognition === 'granted') return true;
    const req = await SpeechRecognition.requestPermissions();
    return req.speechRecognition === 'granted';
  } catch {
    return false;
  }
}

export interface Listening {
  /** Arrête l'écoute ; `done` se résout avec les dernières hypothèses. */
  stop(): void;
  /** Hypothèses de transcription (la meilleure en premier). */
  done: Promise<string[]>;
}

/**
 * Écoute une réponse parlée. `onPartial` reçoit la transcription en cours.
 * La fin est détectée automatiquement (silence), ou via `stop()`.
 */
export function listen(onPartial: (text: string) => void): Listening {
  return isNative() ? listenNative(onPartial) : listenWeb(onPartial);
}

function listenNative(onPartial: (text: string) => void): Listening {
  let latest: string[] = [];
  let finished = false;
  let resolveDone: (v: string[]) => void = () => {};
  const done = new Promise<string[]>((r) => (resolveDone = r));
  const handles: { remove: () => Promise<void> }[] = [];
  let poll: ReturnType<typeof setInterval> | undefined;
  let watchdog: ReturnType<typeof setTimeout> | undefined;

  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(poll);
    clearTimeout(watchdog);
    // Laisse le temps aux derniers résultats d'arriver.
    setTimeout(() => {
      for (const h of handles) void h.remove();
      resolveDone(latest);
    }, 700);
  };

  void (async () => {
    handles.push(
      await SpeechRecognition.addListener('partialResults', (d) => {
        if (d.matches?.length) {
          latest = d.matches;
          onPartial(d.matches[0] ?? '');
        }
      }),
    );
    try {
      await SpeechRecognition.start({ language: LANG, maxResults: 5, partialResults: true, popup: false });
    } catch {
      finish();
      return;
    }
    // Le plugin ne signale pas toujours la fin (ex. silence total) : on surveille son état.
    let wasListening = false;
    poll = setInterval(async () => {
      try {
        const { listening } = await SpeechRecognition.isListening();
        if (listening) wasListening = true;
        else if (wasListening) finish();
      } catch {
        finish();
      }
    }, 400);
    watchdog = setTimeout(() => {
      void SpeechRecognition.stop().catch(() => {});
      finish();
    }, 15000);
  })();

  return {
    stop() {
      void SpeechRecognition.stop().catch(() => {});
      finish();
    },
    done,
  };
}

function listenWeb(onPartial: (text: string) => void): Listening {
  const Ctor = webCtor();
  let latest: string[] = [];
  let resolveDone: (v: string[]) => void = () => {};
  const done = new Promise<string[]>((r) => (resolveDone = r));
  if (!Ctor) {
    resolveDone([]);
    return { stop() {}, done };
  }
  const rec = new Ctor();
  rec.lang = LANG;
  rec.interimResults = true;
  rec.maxAlternatives = 5;
  rec.continuous = false;
  rec.onresult = (e) => {
    const last = e.results[e.results.length - 1];
    if (!last) return;
    latest = Array.from({ length: last.length }, (_, i) => last[i]!.transcript);
    onPartial(latest[0] ?? '');
  };
  rec.onend = () => resolveDone(latest);
  rec.onerror = () => resolveDone(latest);
  rec.start();
  return { stop: () => rec.stop(), done };
}

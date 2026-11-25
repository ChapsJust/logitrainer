/** Un endroit précis du trajet (ex. « Frigo »). */
export interface Locus {
  id: string;
  name: string;
  description: string;
}

/** Un regroupement de loci (ex. « Cuisine »). */
export interface Room {
  id: string;
  name: string;
  loci: Locus[];
}

/** État de révision espacée. */
export interface Review {
  /** Intervalle actuel en jours. */
  interval: number;
  /** Prochaine révision (timestamp, début de journée). */
  due: number;
}

export interface QuizResult {
  at: number;
  score: number;
  total: number;
}

/** Un palais mental = un trajet ordonné de pièces et de loci. */
export interface Palace {
  id: string;
  name: string;
  emoji: string;
  description: string;
  rooms: Room[];
  createdAt: number;
  updatedAt: number;
  lastQuiz?: QuizResult;
  review?: Review;
}

/** Ce qui est déposé sur un locus pour un contenu donné. */
export interface ContentItem {
  /** L'info à retenir. */
  text: string;
  /** L'image mentale utilisée (facultatif). */
  image: string;
}

/** Un contenu (liste, discours, etc.) déposé dans un palais. */
export interface Content {
  id: string;
  palaceId: string;
  title: string;
  notes: string;
  /** Clé = id du locus. Le contenu suit le locus si on réorganise le trajet. */
  items: Record<string, ContentItem>;
  /** Archivé = plus besoin de le retenir : ne compte plus dans l'occupation ni les révisions. */
  archived?: boolean;
  createdAt: number;
  updatedAt: number;
  lastQuiz?: QuizResult;
  review?: Review;
}

export type Theme = 'auto' | 'light' | 'dark';

export interface Settings {
  theme: Theme;
  lastExportAt?: number;
  lastUpdateCheckAt?: number;
  lastAutoBackupAt?: number;
  autoBackupError?: string;
  onboarded?: boolean;
  /** Quiz : réciter à voix haute (ou écrire) avant de révéler. */
  recite?: boolean;
  /** Rappel quotidien des révisions. */
  reminder?: { enabled: boolean; time: string };
  /** Déjà proposé d'activer le rappel. */
  reminderAsked?: boolean;
}

export interface Data {
  schema: 1;
  palaces: Palace[];
  contents: Content[];
  /** Système de nombres : clé « 00 » à « 99 » → image. */
  numbers: Record<string, string>;
  settings: Settings;
}

export interface FlatLocus {
  locus: Locus;
  room: Room;
  /** Position globale, commence à 1. */
  n: number;
}

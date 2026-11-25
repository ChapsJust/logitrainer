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
  /** Test fait avant la date de révision : entraînement, ne fait pas avancer l'intervalle. */
  practice?: boolean;
  /** Type de test. */
  mode?: 'quiz' | 'recall';
}

/** Nombre d'échecs récents par locus (« points faibles »). */
export type WeakMap = Record<string, number>;

export type PlaceIcon = 'home' | 'building' | 'briefcase' | 'tree' | 'map' | 'star';

/** Un lieu réel (École, Maison) qui regroupe plusieurs palais. */
export interface Place {
  id: string;
  name: string;
  icon: PlaceIcon;
  createdAt: number;
}

/** Un palais mental = un trajet ordonné de zones (facultatives) et de loci. */
export interface Palace {
  id: string;
  name: string;
  /** Lieu auquel appartient ce palais (facultatif). */
  placeId?: string;
  /** Matière ou sujet (facultatif), ex. « Mathématiques ». */
  subject?: string;
  emoji: string;
  description: string;
  rooms: Room[];
  createdAt: number;
  updatedAt: number;
  lastQuiz?: QuizResult;
  review?: Review;
  history?: QuizResult[];
  weak?: WeakMap;
  /** Palais réservé au Laboratoire (mots au hasard) : jamais de contenus d'études dessus. */
  training?: boolean;
}

/** Ce qui est déposé sur un locus pour un contenu donné. */
export interface ContentItem {
  /** L'info à retenir (premier élément). */
  text: string;
  /** L'image mentale utilisée (facultatif). */
  image: string;
  /** Éléments supplémentaires sur le même locus (2 à 4 au total), notés séparément. */
  more?: string[];
  /** Question facultative : le test la montre à la place du seul nom du locus. */
  question?: string;
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
  history?: QuizResult[];
  weak?: WeakMap;
}

/** Une séance du Laboratoire. */
export interface LabSession {
  id: string;
  at: number;
  palaceId: string;
  palaceName: string;
  perLocus: number;
  /** Mots, dans l'ordre (gardés seulement pour le rappel à 24 h). */
  words: string[];
  encodeMs: number;
  correct: number;
  /** Rappel différé (24 h). */
  recall24?: { at: number; correct: number };
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
  /** Lieux repliés sur l'accueil. */
  collapsedPlaces?: string[];
  /** Palais pour lesquels on a répondu « c'est un seul trajet » à la proposition de les transformer en lieu. */
  keepAsPalace?: string[];
}

export interface Data {
  schema: number;
  places: Place[];
  palaces: Palace[];
  contents: Content[];
  /** Système de nombres : clé « 00 » à « 99 » → image. */
  numbers: Record<string, string>;
  settings: Settings;
  lab: { sessions: LabSession[] };
}

export interface FlatLocus {
  locus: Locus;
  room: Room;
  /** Position globale, commence à 1. */
  n: number;
}

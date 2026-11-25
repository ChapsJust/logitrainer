/**
 * Suggestions d'images mentales par Claude (facultatif, avec la clé API de l'utilisateur).
 * Seuls l'élément, le locus et les images de nombres concernées sont envoyés.
 */
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { getAiKey } from './ai-key.svelte';
import { z } from 'zod';

const MODEL = 'claude-opus-5-5';

async function client(): Promise<Anthropic> {
  const value = await getAiKey();
  if (!value) throw new AiError('Ajoute ta clé API pour activer les suggestions.');
  // L'appel part directement du téléphone : la clé n'existe que sur cet appareil.
  return new Anthropic({ apiKey: value, dangerouslyAllowBrowser: true, maxRetries: 1, timeout: 45_000 });
}

export class AiError extends Error {}

const Suggestions = z.object({
  suggestions: z
    .array(
      z.object({
        image: z.string().describe("La scène, au présent, 25 mots maximum"),
        lien: z.string().describe("Comment l'image rappelle l'élément, si ce n'est pas évident ; sinon chaîne vide"),
      }),
    )
    .describe('Exactement 3 propositions différentes'),
});

export type Suggestion = z.infer<typeof Suggestions>['suggestions'][number];

const SYSTEM = `Tu aides une personne francophone (Québec) qui pratique la méthode des loci (palais de mémoire).
On te donne un élément à retenir et le locus (un endroit précis de son palais) où elle veut le déposer.
Propose 3 images mentales différentes qui l'aideront à retrouver l'élément en revisitant ce locus.

Ce qui rend une image efficace :
- L'élément interagit physiquement avec le locus (il le frappe, le remplit, s'y coince, le transforme), pas seulement posé à côté.
- Concrète et visualisable en une seconde : action, mouvement, exagération, et au moins un autre sens (son, odeur, toucher).
- Si l'élément est abstrait (concept, nom propre, mot technique, date), transforme-le en quelque chose de concret par la sonorité (jeu de mots, mot qui sonne pareil) ou par un symbole évident, et explique le lien.
- Si des images de nombres personnelles sont fournies, utilise-les telles quelles pour les chiffres.
- Varie les 3 approches (par exemple : une absurde, une sensorielle, une par la sonorité).
- Mémorable mais pas gore. Pas d'emoji.

Écris en français, phrases courtes, au présent.`;

export interface SuggestInput {
  element: string;
  locus: string;
  locusDescription?: string;
  room?: string;
  contentTitle?: string;
  numberImages?: string[];
  current?: string;
}

export async function suggestImages(input: SuggestInput): Promise<Suggestion[]> {
  const anthropic = await client();
  const lines = [
    `Élément à retenir : ${input.element}`,
    `Locus : ${input.locus}${input.locusDescription ? ` (${input.locusDescription})` : ''}`,
    input.room ? `Pièce : ${input.room}` : '',
    input.contentTitle ? `Ce que la personne mémorise : ${input.contentTitle}` : '',
    input.numberImages?.length ? `Ses images de nombres : ${input.numberImages.join(', ')}` : '',
    input.current ? `Idées déjà proposées, à ne pas répéter : ${input.current}` : '',
  ].filter(Boolean);

  try {
    const response = await anthropic.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: 'low', format: betaZodOutputFormat(Suggestions) },
      system: SYSTEM,
      messages: [{ role: 'user', content: lines.join('\n') }],
    });
    if (response.stop_reason === 'refusal') {
      throw new AiError("L'assistant n'a pas pu répondre pour cet élément.");
    }
    const out = response.parsed_output?.suggestions ?? [];
    if (out.length === 0) throw new AiError('Réponse vide, réessaie.');
    return out.slice(0, 3);
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (e instanceof Anthropic.AuthenticationError) throw new AiError('Clé API refusée. Vérifie-la dans Réglages.');
    if (e instanceof Anthropic.PermissionDeniedError) throw new AiError("Cette clé n'a pas accès au modèle.");
    if (e instanceof Anthropic.RateLimitError) throw new AiError('Trop de demandes, réessaie dans un instant.');
    if (e instanceof Anthropic.APIConnectionError) throw new AiError('Pas de connexion Internet.');
    if (e instanceof Anthropic.APIError) throw new AiError(`Erreur du service (${e.status ?? '?'}). Réessaie plus tard.`);
    throw new AiError('Suggestions indisponibles pour le moment.');
  }
}

// Mensajes tipados entre content script, background y offscreen (type discriminado).
// Ver .claude/rules/mv3.md (mensajería).
import type { LyricsDoc, TrackQuery } from './model';
import type { KToken } from './tokenizer/furigana';

export interface GetLyricsMessage {
  type: 'GET_LYRICS';
  query: TrackQuery;
  /** Ignora y borra la caché de este videoId (re-buscar). */
  force?: boolean;
}

export interface TokenizeMessage {
  type: 'TOKENIZE';
  text: string;
}

/** Mensajes que el content script envía al background. */
export type ExtMessage = GetLyricsMessage | TokenizeMessage;

export interface GetLyricsResponse {
  doc: LyricsDoc | null;
  cached: boolean;
  /** id del proveedor que respondió, o null si ninguno encontró letra. */
  source: string | null;
  /** Registro paso a paso de la búsqueda (para el panel de debug del overlay). */
  debug?: string[];
}

export interface TokenizeResponse {
  tokens: KToken[] | null;
  error?: string;
}

/** Mensaje dirigido SOLO al offscreen document (lo ignoran los demás contextos). */
export interface OffscreenTokenizeMessage {
  target: 'offscreen';
  type: 'TOKENIZE';
  text: string;
}

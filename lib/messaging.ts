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

/** Búsqueda manual de letra (texto libre): devuelve candidatos para elegir. */
export interface SearchManualMessage {
  type: 'SEARCH_MANUAL';
  query: string;
}

/** Trae la letra de un candidato concreto ya elegido por el usuario. */
export interface GetByIdMessage {
  type: 'GET_BY_ID';
  source: string;
  id: string | number;
  durationSec?: number;
  /** Si se indica, la letra se cachea por este videoId (revisitas instantáneas). */
  videoId?: string;
}

/** Mensajes que el content script envía al background. */
export type ExtMessage = GetLyricsMessage | TokenizeMessage | SearchManualMessage | GetByIdMessage;

/** Candidato mostrado en el popup de selección manual. */
export interface ManualCandidate {
  source: string;
  id: string | number;
  artist: string;
  title: string;
  durationSec?: number;
  hasSynced: boolean;
}

export interface SearchManualResponse {
  candidates: ManualCandidate[];
}

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

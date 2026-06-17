// Mensajes tipados entre content script y background (type discriminado).
// Ver .claude/rules/mv3.md (mensajería).
import type { LyricsDoc, TrackQuery } from './model';

export interface GetLyricsMessage {
  type: 'GET_LYRICS';
  query: TrackQuery;
}

export type ExtMessage = GetLyricsMessage;

export interface GetLyricsResponse {
  doc: LyricsDoc | null;
  cached: boolean;
  /** id del proveedor que respondió, o null si ninguno encontró letra. */
  source: string | null;
}

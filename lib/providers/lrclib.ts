// Proveedor LRCLIB (lrclib.net, gratis, sin API key, MIT). Letra sincronizada por línea.
// Casa por título + artista + duración (±2 s). Ver .claude/rules/lyrics-providers.md.
import type { LyricsDoc, LyricsProvider, TrackQuery } from '../model';
import { lrcToDoc, parseLrc } from './lrc';

const BASE = 'https://lrclib.net';
const DURATION_TOLERANCE_S = 2;

/** Forma (parcial, no confiable) de un resultado de /api/search. */
export interface LrclibCandidate {
  id?: number;
  trackName?: string;
  artistName?: string;
  duration?: number; // segundos
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

function buildSearchUrl(q: TrackQuery): string {
  const p = new URLSearchParams();
  p.set('track_name', q.title);
  if (q.artist) p.set('artist_name', q.artist);
  return `${BASE}/api/search?${p.toString()}`;
}

/**
 * Elige el mejor candidato con letra sincronizada. Si se conoce la duración,
 * exige coincidencia dentro de ±2 s (rechaza si ninguno encaja, para no mostrar
 * la canción equivocada). Sin duración, toma el primero con letra sincronizada.
 */
export function pickCandidate(
  candidates: unknown,
  durationSec?: number,
): LrclibCandidate | null {
  if (!Array.isArray(candidates)) return null;
  const synced = candidates.filter(
    (c): c is LrclibCandidate =>
      !!c &&
      typeof (c as LrclibCandidate).syncedLyrics === 'string' &&
      (c as LrclibCandidate).syncedLyrics!.trim().length > 0 &&
      !(c as LrclibCandidate).instrumental,
  );
  if (synced.length === 0) return null;
  if (durationSec == null) return synced[0]!;

  const within = synced.filter(
    (c) => typeof c.duration === 'number' && Math.abs(c.duration - durationSec) <= DURATION_TOLERANCE_S,
  );
  if (within.length === 0) return null;
  within.sort(
    (a, b) => Math.abs(a.duration! - durationSec) - Math.abs(b.duration! - durationSec),
  );
  return within[0]!;
}

/** Normaliza un candidato ya elegido al modelo interno (o null si no parsea). */
export function candidateToDoc(cand: LrclibCandidate, durationSec?: number): LyricsDoc | null {
  if (typeof cand.syncedLyrics !== 'string') return null;
  const entries = parseLrc(cand.syncedLyrics);
  if (entries.length === 0) return null;
  return lrcToDoc(entries, 'lrclib', durationSec ?? cand.duration);
}

export const lrclibProvider: LyricsProvider = {
  id: 'lrclib',
  enabledByDefault: true,
  async fetch(query: TrackQuery): Promise<LyricsDoc | null> {
    let res: Response;
    try {
      res = await fetch(buildSearchUrl(query), { headers: { Accept: 'application/json' } });
    } catch {
      return null; // red caída / sin conexión → degradación elegante
    }
    if (!res.ok) return null;

    let data: unknown;
    try {
      data = await res.json();
    } catch {
      return null;
    }
    const cand = pickCandidate(data, query.durationSec);
    if (!cand) return null;
    return candidateToDoc(cand, query.durationSec);
  },
};

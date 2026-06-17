// Proveedores LRCLIB (lrclib.net, gratis, sin API key, MIT).
// - lrclibProvider: letra SINCRONIZADA por línea (preferida).
// - lrclibPlainProvider: TEXTO PLANO interpolado (último recurso) cuando no hay sincronizada.
// Casan por título + artista + duración (±2 s). Ver .claude/rules/lyrics-providers.md.
import type { LyricsDoc, LyricsProvider, TrackQuery } from '../model';
import { lrcToDoc, parseLrc } from './lrc';
import { interpolatePlainLines } from '../normalizer/interpolate';
import { isRelevant, namesOverlap } from '../normalizer/match';
import { fetchJson } from './http';

const BASE = 'https://lrclib.net';
// Duración APROXIMADA (no exacta): los MV suelen diferir unos segundos del audio.
// El filtro de relevancia (artista/título) ya evita canciones equivocadas.
const DURATION_TOLERANCE_S = 10;
const MEMO_TTL_MS = 60_000;
const TIMEOUT_MS = 5000;

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

/**
 * Dos URLs de búsqueda que se combinan para maximizar la cobertura:
 * 1) por campos (preciso cuando título/artista están en latino),
 * 2) general `q=` (más recall; LRCLIB indexa por tokens latinos, así que el artista
 *    latino —YOASOBI…— recupera el catálogo y luego desempatamos por duración).
 */
function buildSearchUrls(q: TrackQuery): string[] {
  const field = new URLSearchParams();
  field.set('track_name', q.title);
  if (q.artist) field.set('artist_name', q.artist);

  const general = new URLSearchParams();
  general.set('q', [q.artist, q.title].filter(Boolean).join(' '));

  return [`${BASE}/api/search?${field.toString()}`, `${BASE}/api/search?${general.toString()}`];
}

function toCandidates(data: unknown): LrclibCandidate[] {
  return Array.isArray(data) ? (data.filter((c) => c && typeof c === 'object') as LrclibCandidate[]) : [];
}

// Memo compartido entre los dos proveedores para no pegar dos veces a LRCLIB por canción.
const memo = new Map<string, { ts: number; data: LrclibCandidate[] }>();

/**
 * Busca en 2 PASOS para minimizar peticiones (latencia/rate-limiting):
 * 1) por campos (preciso); si no devuelve nada,
 * 2) general `q=` (recall para japonés/romaji). El filtro por duración desempata.
 */
async function searchLrclib(query: TrackQuery): Promise<LrclibCandidate[]> {
  const [fieldUrl, queryUrl] = buildSearchUrls(query);
  const key = fieldUrl;
  const cached = memo.get(key);
  if (cached && Date.now() - cached.ts < MEMO_TTL_MS) return cached.data;

  const headers = { Accept: 'application/json' };
  let list = toCandidates(await fetchJson(fieldUrl!, { headers }, TIMEOUT_MS));
  if (list.length === 0) {
    list = toCandidates(await fetchJson(queryUrl!, { headers }, TIMEOUT_MS));
  }
  if (list.length > 0) memo.set(key, { ts: Date.now(), data: list });
  return list;
}

function pickBy(
  candidates: unknown,
  query: TrackQuery,
  hasLyrics: (c: LrclibCandidate) => boolean,
): LrclibCandidate | null {
  if (!Array.isArray(candidates)) return null;
  // Filtra por: tiene letra, no instrumental y RELEVANTE (artista/título coinciden).
  const matches = candidates.filter(
    (c): c is LrclibCandidate =>
      !!c &&
      !(c as LrclibCandidate).instrumental &&
      hasLyrics(c as LrclibCandidate) &&
      isRelevant((c as LrclibCandidate).trackName, (c as LrclibCandidate).artistName, query.title, query.artist),
  );
  if (matches.length === 0) return null;

  const dur = query.durationSec;
  // Si hay duración, exige estar dentro de la ventana APROXIMADA (±10 s).
  const pool =
    dur == null
      ? matches
      : matches.filter((c) => typeof c.duration === 'number' && Math.abs(c.duration - dur) <= DURATION_TOLERANCE_S);
  if (pool.length === 0) return null;

  // Prefiere coincidencia de TÍTULO; luego, duración más cercana.
  pool.sort((a, b) => {
    const ta = namesOverlap(a.trackName, query.title) ? 0 : 1;
    const tb = namesOverlap(b.trackName, query.title) ? 0 : 1;
    if (ta !== tb) return ta - tb;
    if (dur == null) return 0;
    return Math.abs((a.duration ?? Infinity) - dur) - Math.abs((b.duration ?? Infinity) - dur);
  });
  return pool[0]!;
}

/** Elige el mejor candidato con letra SINCRONIZADA (relevante + ±2 s). */
export function pickCandidate(candidates: unknown, query: TrackQuery): LrclibCandidate | null {
  return pickBy(candidates, query, (c) => typeof c.syncedLyrics === 'string' && c.syncedLyrics.trim().length > 0);
}

/** Elige el mejor candidato con TEXTO PLANO (cuando no hay sincronizada). */
export function pickPlain(candidates: unknown, query: TrackQuery): LrclibCandidate | null {
  return pickBy(candidates, query, (c) => typeof c.plainLyrics === 'string' && c.plainLyrics.trim().length > 0);
}

/** Normaliza un candidato sincronizado al modelo interno (o null si no parsea). */
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
    const data = await searchLrclib(query);
    const cand = pickCandidate(data, query);
    if (!cand) return null;
    return candidateToDoc(cand, query.durationSec);
  },
};

export const lrclibPlainProvider: LyricsProvider = {
  id: 'lrclib-plain',
  enabledByDefault: true,
  async fetch(query: TrackQuery): Promise<LyricsDoc | null> {
    const durationSec = query.durationSec ?? undefined;
    const data = await searchLrclib(query);
    const cand = pickPlain(data, query);
    if (!cand || typeof cand.plainLyrics !== 'string') return null;
    // Sin duración no podemos interpolar bien: usamos la del candidato si la hay.
    const dur = durationSec ?? cand.duration;
    if (!dur) return null;
    const doc = interpolatePlainLines(cand.plainLyrics.split(/\r?\n/), dur, 'lrclib-plain');
    return doc.lines.length > 0 ? doc : null;
  },
};

// Proveedores LRCLIB (lrclib.net, gratis, sin API key, MIT).
// - lrclibProvider: letra SINCRONIZADA por línea (preferida).
// - lrclibPlainProvider: TEXTO PLANO interpolado (último recurso) cuando no hay sincronizada.
// Casan por título + artista + duración (±2 s). Ver .claude/rules/lyrics-providers.md.
import type { LyricsDoc, LyricsProvider, TrackQuery } from '../model';
import { lrcToDoc, parseLrc } from './lrc';
import { interpolatePlainLines } from '../normalizer/interpolate';
import { fetchJson } from './http';

const BASE = 'https://lrclib.net';
const DURATION_TOLERANCE_S = 2;
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

function withinDuration(c: LrclibCandidate, durationSec: number): boolean {
  return typeof c.duration === 'number' && Math.abs(c.duration - durationSec) <= DURATION_TOLERANCE_S;
}

function pickBy(
  candidates: unknown,
  durationSec: number | undefined,
  hasLyrics: (c: LrclibCandidate) => boolean,
): LrclibCandidate | null {
  if (!Array.isArray(candidates)) return null;
  const matches = candidates.filter(
    (c): c is LrclibCandidate => !!c && !(c as LrclibCandidate).instrumental && hasLyrics(c as LrclibCandidate),
  );
  if (matches.length === 0) return null;
  if (durationSec == null) return matches[0]!;
  const within = matches.filter((c) => withinDuration(c, durationSec));
  if (within.length === 0) return null;
  within.sort((a, b) => Math.abs(a.duration! - durationSec) - Math.abs(b.duration! - durationSec));
  return within[0]!;
}

/** Elige el mejor candidato con letra SINCRONIZADA (±2 s; rechaza si no encaja). */
export function pickCandidate(candidates: unknown, durationSec?: number): LrclibCandidate | null {
  return pickBy(
    candidates,
    durationSec,
    (c) => typeof c.syncedLyrics === 'string' && c.syncedLyrics.trim().length > 0,
  );
}

/** Elige el mejor candidato con TEXTO PLANO (cuando no hay sincronizada). */
export function pickPlain(candidates: unknown, durationSec?: number): LrclibCandidate | null {
  return pickBy(
    candidates,
    durationSec,
    (c) => typeof c.plainLyrics === 'string' && c.plainLyrics.trim().length > 0,
  );
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
    const cand = pickCandidate(data, query.durationSec);
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
    const cand = pickPlain(data, durationSec);
    if (!cand || typeof cand.plainLyrics !== 'string') return null;
    // Sin duración no podemos interpolar bien: usamos la del candidato si la hay.
    const dur = durationSec ?? cand.duration;
    if (!dur) return null;
    const doc = interpolatePlainLines(cand.plainLyrics.split(/\r?\n/), dur, 'lrclib-plain');
    return doc.lines.length > 0 ? doc : null;
  },
};

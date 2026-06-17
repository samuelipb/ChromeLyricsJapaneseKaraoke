// Proveedores LRCLIB (lrclib.net, gratis, sin API key, MIT).
// - lrclibProvider: letra SINCRONIZADA por línea (preferida).
// - lrclibPlainProvider: TEXTO PLANO interpolado (último recurso) cuando no hay sincronizada.
// Casan por título + artista + duración (±2 s). Ver .claude/rules/lyrics-providers.md.
import type { LyricsDoc, LyricsProvider, TrackQuery } from '../model';
import type { ManualCandidate } from '../messaging';
import { lrcToDoc, parseLrc } from './lrc';
import { interpolatePlainLines } from '../normalizer/interpolate';
import { isRelevant, relevanceScore } from '../normalizer/match';
import { fetchJson } from './http';

const BASE = 'https://lrclib.net';
// Duración APROXIMADA (no exacta): los MV suelen diferir unos segundos del audio.
// El filtro de relevancia (artista/título) ya evita canciones equivocadas.
const DURATION_TOLERANCE_S = 10;
const MEMO_TTL_MS = 60_000;
// lrclib.net puede ir lento (a veces ~10 s); timeout generoso para no abortar antes.
const TIMEOUT_MS = 15_000;

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
  const text = q.rawTitle ?? q.title;
  const urls: string[] = [];

  // A) por campos (preciso para casos limpios "Artista - Título").
  const field = new URLSearchParams();
  field.set('track_name', q.title);
  if (q.artist) field.set('artist_name', q.artist);
  urls.push(`${BASE}/api/search?${field.toString()}`);

  // B) q= con el TÍTULO COMPLETO limpio (cubre títulos con tokens latinos, ej. "Black Catcher").
  urls.push(`${BASE}/api/search?${new URLSearchParams({ q: text }).toString()}`);

  // C) q= con CANAL + título (cubre títulos en kanji cuando el artista es latino, ej. YOASOBI:
  //    LRCLIB indexa por tokens latinos, así el nombre del canal recupera el catálogo).
  if (q.channel) urls.push(`${BASE}/api/search?${new URLSearchParams({ q: `${q.channel} ${text}` }).toString()}`);

  return [...new Set(urls)];
}

function toCandidates(data: unknown): LrclibCandidate[] {
  return Array.isArray(data) ? (data.filter((c) => c && typeof c === 'object') as LrclibCandidate[]) : [];
}

function candKey(c: LrclibCandidate): string {
  return c.id != null ? `id:${c.id}` : `${c.artistName}|${c.trackName}|${c.duration}`;
}

// Memo compartido entre los dos proveedores para no pegar dos veces a LRCLIB por canción.
const memo = new Map<string, { ts: number; data: LrclibCandidate[] }>();

/**
 * Busca por campos y por `q=` EN PARALELO y une los candidatos únicos. Paralelo (no
 * secuencial) para no sumar latencias cuando lrclib va lento. El filtro de relevancia
 * (artista/título) + duración desempatan después.
 */
async function searchLrclib(query: TrackQuery): Promise<LrclibCandidate[]> {
  const urls = buildSearchUrls(query);
  const key = urls.join('|');
  const cached = memo.get(key);
  if (cached && Date.now() - cached.ts < MEMO_TTL_MS) return cached.data;

  const headers = { Accept: 'application/json' };
  const lists = await Promise.all(urls.map((u) => fetchJson(u, { headers }, TIMEOUT_MS)));

  const merged: LrclibCandidate[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    for (const c of toCandidates(list)) {
      const k = candKey(c);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(c);
    }
  }
  if (merged.length > 0) memo.set(key, { ts: Date.now(), data: merged });
  return merged;
}

function pickBy(
  candidates: unknown,
  query: TrackQuery,
  hasLyrics: (c: LrclibCandidate) => boolean,
): LrclibCandidate | null {
  if (!Array.isArray(candidates)) return null;
  const videoText = query.rawTitle ?? query.title;
  const channel = query.channel ?? query.artist;
  // Filtra por: tiene letra, no instrumental y RELEVANTE (el título/artista canónicos
  // del candidato aparecen en el título del video o el canal).
  const matches = candidates.filter(
    (c): c is LrclibCandidate =>
      !!c &&
      !(c as LrclibCandidate).instrumental &&
      hasLyrics(c as LrclibCandidate) &&
      isRelevant((c as LrclibCandidate).trackName, (c as LrclibCandidate).artistName, videoText, channel),
  );
  if (matches.length === 0) return null;

  const dur = query.durationSec;
  // Si hay duración, exige estar dentro de la ventana APROXIMADA (±10 s).
  const pool =
    dur == null
      ? matches
      : matches.filter((c) => typeof c.duration === 'number' && Math.abs(c.duration - dur) <= DURATION_TOLERANCE_S);
  if (pool.length === 0) return null;

  // Prefiere más señales coincidentes (artista+título); luego, duración más cercana.
  pool.sort((a, b) => {
    const sa = relevanceScore(a.trackName, a.artistName, videoText, channel);
    const sb = relevanceScore(b.trackName, b.artistName, videoText, channel);
    if (sa !== sb) return sb - sa;
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

// --- Búsqueda manual + traer por id (fallback con selección) ---------------
export async function lrclibManualSearch(text: string): Promise<ManualCandidate[]> {
  const url = `${BASE}/api/search?${new URLSearchParams({ q: text }).toString()}`;
  const cands = toCandidates(await fetchJson(url, { headers: { Accept: 'application/json' } }, TIMEOUT_MS));
  return cands
    .filter((c) => c.id != null && !c.instrumental && (c.syncedLyrics || c.plainLyrics))
    .map((c) => ({
      source: 'lrclib',
      id: c.id!,
      artist: c.artistName ?? '',
      title: c.trackName ?? '',
      durationSec: c.duration,
      hasSynced: !!c.syncedLyrics,
    }));
}

export async function lrclibGetById(id: string | number, durationSec?: number): Promise<LyricsDoc | null> {
  const data = (await fetchJson(
    `${BASE}/api/get/${id}`,
    { headers: { Accept: 'application/json' } },
    TIMEOUT_MS,
  )) as LrclibCandidate | null;
  if (!data) return null;
  const doc = candidateToDoc(data, durationSec);
  if (doc) return doc;
  if (typeof data.plainLyrics === 'string' && (durationSec ?? data.duration)) {
    const dur = durationSec ?? data.duration!;
    const plain = interpolatePlainLines(data.plainLyrics.split(/\r?\n/), dur, 'lrclib-plain');
    return plain.lines.length > 0 ? plain : null;
  }
  return null;
}

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

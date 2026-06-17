// Proveedor NetEase Cloud Music (music.163.com) — OPT-IN (fuente "de riesgo", ToS).
// Gran cobertura japonesa, incluido artistas en kanji. Letra sincronizada por línea (LRC).
// Off por defecto; el usuario la activa. Ver .claude/rules/lyrics-providers.md y security.md.
import type { LyricsDoc, LyricsProvider, TrackQuery } from '../model';
import { lrcToDoc, parseLrc } from './lrc';
import { isRelevant, relevanceScore } from '../normalizer/match';
import { fetchJson } from './http';

const BASE = 'https://music.163.com';
// Duración APROXIMADA (no exacta); el filtro de relevancia evita canciones equivocadas.
const DURATION_TOLERANCE_S = 10;
const TIMEOUT_MS = 6000; // NetEase (China) puede ser lento desde fuera

interface NeteaseSong {
  id: number;
  name?: string;
  duration?: number; // milisegundos
  artists?: Array<{ name?: string }>;
}

function buildQuery(q: TrackQuery): string {
  return [q.artist, q.title].filter(Boolean).join(' ');
}

function songArtist(s: NeteaseSong): string {
  return (s.artists ?? []).map((a) => a.name ?? '').join(' ');
}

/**
 * Elige la canción RELEVANTE (artista/título coinciden con la consulta) cuya duración
 * (ms→s) casa ±2 s. El filtro de relevancia evita matches falsos (p. ej. una canción
 * china a la misma duración). Sin duración, la primera relevante.
 */
export function pickSong(songs: unknown, query: TrackQuery): NeteaseSong | null {
  if (!Array.isArray(songs)) return null;
  const valid = songs.filter(
    (s): s is NeteaseSong =>
      !!s &&
      typeof (s as NeteaseSong).id === 'number' &&
      isRelevant((s as NeteaseSong).name, songArtist(s as NeteaseSong), query.title, query.artist),
  );
  if (valid.length === 0) return null;
  const dur = query.durationSec;
  const pool =
    dur == null
      ? valid
      : valid.filter((s) => typeof s.duration === 'number' && Math.abs(s.duration / 1000 - dur) <= DURATION_TOLERANCE_S);
  if (pool.length === 0) return null;

  // Prefiere más señales coincidentes (artista+título); luego, duración más cercana.
  pool.sort((a, b) => {
    const sa = relevanceScore(a.name, songArtist(a), query.title, query.artist);
    const sb = relevanceScore(b.name, songArtist(b), query.title, query.artist);
    if (sa !== sb) return sb - sa;
    if (dur == null) return 0;
    return Math.abs((a.duration ?? Infinity) / 1000 - dur) - Math.abs((b.duration ?? Infinity) / 1000 - dur);
  });
  return pool[0]!;
}

// Líneas de créditos que NetEase mete con timestamp al inicio (no son letra).
const CREDIT = /作[词詞]|作曲|编曲|編曲|制作|製作|出品|监制|混音|母带|Lyrics\s*by|Composed|Arranged|Producer/i;

/** Convierte el LRC de NetEase al modelo interno, descartando créditos. */
export function neteaseLrcToDoc(lrc: string, durationSec?: number): LyricsDoc | null {
  const entries = parseLrc(lrc).filter((e) => e.text.length > 0 && !CREDIT.test(e.text));
  if (entries.length === 0) return null;
  return lrcToDoc(entries, 'netease', durationSec);
}

export const neteaseProvider: LyricsProvider = {
  id: 'netease',
  enabledByDefault: false, // fuente opt-in (ToS): desactivada por defecto
  async fetch(query: TrackQuery): Promise<LyricsDoc | null> {
    const body = new URLSearchParams({ s: buildQuery(query), type: '1', limit: '10', offset: '0' }).toString();
    const search = (await fetchJson(
      `${BASE}/api/search/get`,
      { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body },
      TIMEOUT_MS,
    )) as { result?: { songs?: unknown } } | null;

    const song = pickSong(search?.result?.songs, query);
    if (!song) return null;

    const lyr = (await fetchJson(
      `${BASE}/api/song/lyric?os=pc&lv=-1&kv=-1&tv=-1&id=${song.id}`,
      undefined,
      TIMEOUT_MS,
    )) as { lrc?: { lyric?: unknown } } | null;
    const lrc = lyr?.lrc?.lyric;
    if (typeof lrc !== 'string') return null;

    const dur = query.durationSec ?? (typeof song.duration === 'number' ? song.duration / 1000 : undefined);
    return neteaseLrcToDoc(lrc, dur);
  },
};

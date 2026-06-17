// Proveedor NetEase Cloud Music (music.163.com) — OPT-IN (fuente "de riesgo", ToS).
// Gran cobertura japonesa, incluido artistas en kanji. Letra sincronizada por línea (LRC).
// Off por defecto; el usuario la activa. Ver .claude/rules/lyrics-providers.md y security.md.
import type { LyricsDoc, LyricsProvider, TrackQuery } from '../model';
import { lrcToDoc, parseLrc } from './lrc';

const BASE = 'https://music.163.com';
const DURATION_TOLERANCE_S = 2;

interface NeteaseSong {
  id: number;
  name?: string;
  duration?: number; // milisegundos
  artists?: Array<{ name?: string }>;
}

function buildQuery(q: TrackQuery): string {
  return [q.artist, q.title].filter(Boolean).join(' ');
}

/** Elige la canción cuya duración (ms→s) casa ±2 s; sin duración, la primera (mejor rankeada). */
export function pickSong(songs: unknown, durationSec?: number): NeteaseSong | null {
  if (!Array.isArray(songs)) return null;
  const valid = songs.filter(
    (s): s is NeteaseSong => !!s && typeof (s as NeteaseSong).id === 'number',
  );
  if (valid.length === 0) return null;
  if (durationSec == null) return valid[0]!;
  const within = valid.filter(
    (s) => typeof s.duration === 'number' && Math.abs(s.duration / 1000 - durationSec) <= DURATION_TOLERANCE_S,
  );
  if (within.length === 0) return null;
  within.sort((a, b) => Math.abs(a.duration! / 1000 - durationSec) - Math.abs(b.duration! / 1000 - durationSec));
  return within[0]!;
}

// Líneas de créditos que NetEase mete con timestamp al inicio (no son letra).
const CREDIT = /作[词詞]|作曲|编曲|編曲|制作|製作|出品|监制|混音|母带|Lyrics\s*by|Composed|Arranged|Producer/i;

/** Convierte el LRC de NetEase al modelo interno, descartando créditos. */
export function neteaseLrcToDoc(lrc: string, durationSec?: number): LyricsDoc | null {
  const entries = parseLrc(lrc).filter((e) => e.text.length > 0 && !CREDIT.test(e.text));
  if (entries.length === 0) return null;
  return lrcToDoc(entries, 'netease', durationSec);
}

async function fetchJson(url: string, init?: RequestInit): Promise<unknown> {
  try {
    const res = await fetch(url, init);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export const neteaseProvider: LyricsProvider = {
  id: 'netease',
  enabledByDefault: false, // fuente opt-in (ToS): desactivada por defecto
  async fetch(query: TrackQuery): Promise<LyricsDoc | null> {
    const body = new URLSearchParams({ s: buildQuery(query), type: '1', limit: '10', offset: '0' }).toString();
    const search = (await fetchJson(`${BASE}/api/search/get`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    })) as { result?: { songs?: unknown } } | null;

    const song = pickSong(search?.result?.songs, query.durationSec);
    if (!song) return null;

    const lyr = (await fetchJson(
      `${BASE}/api/song/lyric?os=pc&lv=-1&kv=-1&tv=-1&id=${song.id}`,
    )) as { lrc?: { lyric?: unknown } } | null;
    const lrc = lyr?.lrc?.lyric;
    if (typeof lrc !== 'string') return null;

    const dur = query.durationSec ?? (typeof song.duration === 'number' ? song.duration / 1000 : undefined);
    return neteaseLrcToDoc(lrc, dur);
  },
};

// Limpieza del título de YouTube → {artist?, title} para consultar a los proveedores.
// Ver .claude/rules/testing.md (tabla de casos) y .claude/rules/lyrics-providers.md.

// Etiquetas de ruido típicas dentro de (), [], 【】, «» … (case-insensitive).
const NOISE_WORDS = [
  'official video',
  'official music video',
  'official audio',
  'official lyric video',
  'lyric video',
  'lyrics',
  'mv',
  'm/v',
  'pv',
  'music video',
  'audio',
  'hd',
  'hq',
  '4k',
  'full version',
  'full',
  'live',
  'cover',
  'remix',
  'visualizer',
  'video oficial',
  'audio oficial',
  'letra',
  'con letra',
  '歌詞付き',
  '歌詞',
];

// Pares de paréntesis/corchetes a inspeccionar (incluye CJK 【】「」『』 y comillas).
const BRACKET_PAIRS: Array<[string, string]> = [
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
  ['「', '」'],
  ['『', '』'],
  ['〈', '〉'],
  ['《', '》'],
];

// Corchetes que en YouTube japonés son SIEMPRE anotaciones (programa, sello, "MV",
// 歌唱曲, 第75回NHK紅白…), no el título → se quitan sin condición. (El título va en 「」『』.)
const ALWAYS_STRIP_PAIRS: Array<[string, string]> = [
  ['【', '】'],
  ['［', '］'],
];

// feat./ft./featuring … hasta el final del fragmento.
const FEAT = /\s*[\(\[]?\s*(?:feat|ft|featuring)\.?\s+[^)\]]*[\)\]]?/gi;

// Rango de emojis frecuentes (símbolos, pictogramas, dingbats, banderas).
const EMOJI =
  /[←-⇿⌀-➿⬀-⯿️\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}]/gu;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Quita SIEMPRE el contenido de 【…】 / ［…］ (anotaciones, no título). */
function stripAnnotations(input: string): string {
  let out = input;
  for (const [open, close] of ALWAYS_STRIP_PAIRS) {
    const re = new RegExp(`${escapeRe(open)}[^${escapeRe(close)}]*${escapeRe(close)}`, 'g');
    out = out.replace(re, ' ');
  }
  return out;
}

/** Quita los segmentos entre delimitadores cuyo interior sea "ruido editorial". */
function stripBracketed(input: string): string {
  let out = input;
  for (const [open, close] of BRACKET_PAIRS) {
    // Empareja open ... close sin anidar el mismo cierre dentro.
    const re = new RegExp(`${escapeRe(open)}([^${escapeRe(close)}]*)${escapeRe(close)}`, 'g');
    out = out.replace(re, (whole, inside: string) => {
      const lower = inside.toLowerCase();
      return NOISE_WORDS.some((w) => lower.includes(w)) ? ' ' : whole;
    });
  }
  return out;
}

function collapse(s: string): string {
  return s.replace(/\s{2,}/g, ' ').replace(/^[\s\-–—|·•:]+|[\s\-–—|·•:]+$/g, '').trim();
}

// Sufijos sueltos (sin corchetes) de alta confianza al final del título. Acepta un
// separador previo opcional incluyendo ：/: (p. ej. "踊り子 / Vaundy：MUSIC VIDEO").
const BARE_SUFFIX =
  /\s*[-–—|/:：]?\s*(official\s+music\s+video|official\s+lyric\s+video|official\s+video|official\s+audio|music\s+video|lyric\s+video)\s*$/i;

/** Quita ruido editorial de un texto (sin separar artista/título). */
export function cleanTitle(raw: string): string {
  let s = raw.normalize('NFC');
  s = stripAnnotations(s); // 【…】／［…］ siempre
  s = stripBracketed(s);
  s = s.replace(FEAT, ' ');
  s = s.replace(EMOJI, ' ');
  s = s.replace(/[　]/g, ' '); // espacio ideográfico
  s = s.replace(BARE_SUFFIX, ' ');
  return collapse(s);
}

// Título japonés entre 『』 o 「」 (heurística: el artista va antes del corchete).
const JP_TITLE_QUOTE = /^(.*?)[『「]([^』」]+)[』」]/;

export interface ParsedTrack {
  title: string;
  artist?: string;
}

// Separadores "Artista - Canción" (guion con espacios, en-dash, em-dash, full-width).
const ARTIST_SEP = /\s+[-–—―]\s+|\s*[－]\s*/;

/**
 * Separa "Artista - Canción" si hay un separador claro; si no, devuelve solo título.
 * Limpia ruido en ambas partes. `channelHint` sirve de respaldo para el artista.
 */
export function parseTrack(rawTitle: string, channelHint?: string): ParsedTrack {
  const cleaned = cleanTitle(rawTitle);
  const parts = cleaned.split(ARTIST_SEP);
  if (parts.length >= 2) {
    const artist = collapse(parts[0]!);
    const title = collapse(parts.slice(1).join(' - '));
    if (artist && title) return { artist, title };
  }
  // Heurística japonesa: "Artista『Título』" sin guion separador.
  const quote = JP_TITLE_QUOTE.exec(cleaned);
  if (quote) {
    const artist = collapse(quote[1]!);
    const title = collapse(quote[2]!);
    if (title) return artist ? { artist, title } : { title };
  }
  const artist = channelHint ? cleanChannel(channelHint) : undefined;
  return artist ? { title: cleaned, artist } : { title: cleaned };
}

/** Normaliza el nombre del canal como artista (quita "- Topic", "VEVO", "Official"). */
export function cleanChannel(channel: string): string {
  let s = channel.normalize('NFC');
  s = s.replace(/\s*-\s*topic\s*$/i, '');
  s = s.replace(/vevo$/i, '');
  s = s.replace(/\s*official\s*$/i, '');
  return collapse(s);
}

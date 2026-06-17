// Lógica PURA de furigana: de tokens (kuromoji) → segmentos <ruby> respetando okurigana,
// y romaji. No toca el DOM (eso lo hace el render, por nodos). Ver .claude/rules/furigana.md.
import { isKana, isKanji, toHiragana, toRomaji } from 'wanakana';

/** Token morfológico ya normalizado: lectura en hiragana. `pos` opcional (parte de la oración). */
export interface KToken {
  surface: string;
  reading?: string; // hiragana
  pos?: string;
}

/** Segmento de render: si lleva `rt`, va como <ruby>text<rt>rt</rt></ruby>; si no, texto plano. */
export interface RubySegment {
  text: string;
  rt?: string;
}

function hasKanji(s: string): boolean {
  for (const ch of s) if (isKanji(ch)) return true;
  return false;
}

/**
 * Construye los segmentos de ruby de UN token. Solo pone lectura sobre la parte en
 * kanji: pela el okurigana (kana) común al inicio y al final entre superficie y lectura.
 * Si no hay kanji, o no hay lectura, devuelve el texto sin ruby.
 */
export function buildRuby(surface: string, reading?: string): RubySegment[] {
  if (!reading || !hasKanji(surface)) return [{ text: surface }];

  const s = [...surface];
  const r = [...toHiragana(reading)];

  // Pela kana coincidente al final (okurigana de cola: 食べる → べる).
  let suffix = '';
  while (s.length && r.length) {
    const sc = s[s.length - 1]!;
    if (isKana(sc) && toHiragana(sc) === r[r.length - 1]) {
      suffix = sc + suffix;
      s.pop();
      r.pop();
    } else break;
  }

  // Pela kana coincidente al inicio (prefijos como お正月 → お).
  let prefix = '';
  while (s.length && r.length) {
    const sc = s[0]!;
    if (isKana(sc) && toHiragana(sc) === r[0]) {
      prefix += sc;
      s.shift();
      r.shift();
    } else break;
  }

  const coreSurface = s.join('');
  const coreReading = r.join('');
  const segs: RubySegment[] = [];
  if (prefix) segs.push({ text: prefix });
  if (coreSurface) {
    // Solo anota si el núcleo tiene kanji y queda lectura (evita ruby vacío/ambiguo).
    if (coreReading && hasKanji(coreSurface)) segs.push({ text: coreSurface, rt: coreReading });
    else segs.push({ text: coreSurface });
  }
  if (suffix) segs.push({ text: suffix });
  return segs.length ? segs : [{ text: surface }];
}

/** Segmentos de ruby de una línea entera (concatena los de cada token). */
export function tokensToRuby(tokens: KToken[]): RubySegment[] {
  const out: RubySegment[] = [];
  for (const t of tokens) out.push(...buildRuby(t.surface, t.reading));
  return out;
}

/**
 * Ajusta la lectura de partículas para el romaji (は→wa, へ→e) usando el POS de kuromoji.
 * kuromoji devuelve la lectura literal (は→ha), así que corregimos según la gramática.
 */
function readingForRomaji(t: KToken): string {
  const base = t.reading ?? t.surface;
  if (t.pos === '助詞') {
    if (t.surface === 'は') return 'わ';
    if (t.surface === 'へ') return 'え';
  }
  return base;
}

/** Romaji de una línea: por token, separado por espacios (ayuda a leer). */
export function tokensToRomaji(tokens: KToken[]): string {
  return tokens
    .map((t) => toRomaji(readingForRomaji(t)))
    .join(' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

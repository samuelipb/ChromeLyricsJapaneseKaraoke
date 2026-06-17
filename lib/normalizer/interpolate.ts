// Interpolación de tiempos para letra SIN sincronía (texto plano, último recurso).
// Reparte la duración total entre las líneas proporcional a su nº de mora/caracteres.
// Ver .claude/rules/{lyrics-providers,karaoke-sync}.md.
import type { Line, LyricsDoc } from '../model';

// Kana pequeño que NO añade mora (se combina con el anterior): ゃゅょ, ぁぃ… y katakana.
// OJO: っ/ッ (sokuon) y ー (chōonpu) SÍ cuentan como mora.
const SMALL_COMBINING = /[ぁぃぅぇぉゃゅょゎゕゖァィゥェォャュョヮ]/;

/** Cuenta mora de forma aproximada (heurística "suficientemente buena"). */
export function moraCount(text: string): number {
  let n = 0;
  for (const ch of text) {
    if (/\s/.test(ch)) continue; // espacios no cuentan
    if (SMALL_COMBINING.test(ch)) continue; // kana pequeño combinante: 0 mora
    n++;
  }
  return n;
}

/**
 * Convierte líneas de texto plano en un LyricsDoc con tiempos interpolados a lo largo
 * de `durationSec`, proporcional a la mora de cada línea. hasWordTiming = false.
 * Las líneas vacías se descartan. Si no hay duración o líneas, devuelve doc vacío.
 */
export function interpolatePlainLines(
  rawLines: string[],
  durationSec: number,
  source: string,
): LyricsDoc {
  const texts = rawLines.map((l) => l.trim()).filter((l) => l.length > 0);
  if (texts.length === 0 || !(durationSec > 0)) {
    return { source, hasWordTiming: false, lines: [] };
  }

  const weights = texts.map((t) => Math.max(1, moraCount(t)));
  const total = weights.reduce((a, b) => a + b, 0);

  const lines: Line[] = [];
  let cum = 0;
  for (let i = 0; i < texts.length; i++) {
    const tStart = (durationSec * cum) / total;
    cum += weights[i]!;
    const tEnd = (durationSec * cum) / total;
    lines.push({ tStart, tEnd, words: [{ tStart, tEnd, surface: texts[i]! }] });
  }
  return { source, hasWordTiming: false, lines };
}

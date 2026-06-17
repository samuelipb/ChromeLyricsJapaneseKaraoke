// Parser de LRC sincronizado por LÍNEA. (El Enhanced LRC por palabra es Fase 5.)
// Ver skill lrc-elrc-parsing y .claude/rules/karaoke-sync.md.
import type { Line, LyricsDoc } from '../model';

export interface LrcEntry {
  tStart: number; // segundos
  text: string;
}

// [mm:ss.xx] o [mm:ss.xxx] o [mm:ss]. Puede haber varios al inicio de una línea.
const TIMESTAMP = /\[(\d{1,2}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
// Etiquetas de metadatos: [ar:...], [ti:...], [length:...], etc. (sin dígitos de tiempo).
const META_TAG = /^\[[a-zA-Z]+:.*\]$/;

function toSeconds(min: string, sec: string, frac?: string): number {
  const m = Number(min);
  const s = Number(sec);
  let f = 0;
  if (frac) {
    // Normaliza centésimas/milésimas: "5" → .5, "50" → .50, "500" → .500
    f = Number(frac) / 10 ** frac.length;
  }
  return m * 60 + s + f;
}

/**
 * Parsea texto LRC a entradas {tStart, text} ordenadas por tiempo.
 * - Soporta múltiples timestamps por línea ([t1][t2]texto → dos entradas).
 * - Ignora líneas de metadatos y líneas sin timestamp.
 * - Conserva líneas con texto vacío (silencios/interludios) si llevan timestamp.
 */
export function parseLrc(raw: string): LrcEntry[] {
  const entries: LrcEntry[] = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (META_TAG.test(line.trim())) continue;

    TIMESTAMP.lastIndex = 0;
    const stamps: number[] = [];
    let lastEnd = 0;
    let match: RegExpExecArray | null;
    while ((match = TIMESTAMP.exec(line)) !== null) {
      // Solo cuentan los timestamps al PRINCIPIO (prefijo contiguo).
      if (match.index !== lastEnd) break;
      stamps.push(toSeconds(match[1]!, match[2]!, match[3]));
      lastEnd = TIMESTAMP.lastIndex;
    }
    if (stamps.length === 0) continue;

    const text = line.slice(lastEnd).trim();
    for (const tStart of stamps) entries.push({ tStart, text });
  }
  entries.sort((a, b) => a.tStart - b.tStart);
  return entries;
}

/**
 * Convierte entradas LRC al modelo interno. tEnd de cada línea = tStart de la
 * siguiente; la última usa `durationSec` si se conoce, o un colchón fijo.
 * Las líneas vacías se descartan del documento final (no se muestran).
 */
export function lrcToDoc(
  entries: LrcEntry[],
  source: string,
  durationSec?: number,
): LyricsDoc {
  const lines: Line[] = [];
  for (let i = 0; i < entries.length; i++) {
    const cur = entries[i]!;
    const next = entries[i + 1];
    const tEnd = next ? next.tStart : durationSec ?? cur.tStart + 5;
    if (cur.text.length === 0) continue; // silencio: marca el fin de la previa, no se pinta
    lines.push({
      tStart: cur.tStart,
      tEnd,
      words: [{ tStart: cur.tStart, tEnd, surface: cur.text }],
    });
  }
  return { source, hasWordTiming: false, lines };
}

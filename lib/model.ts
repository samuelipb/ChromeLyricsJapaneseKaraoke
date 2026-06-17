// Modelo interno único al que se normaliza TODA fuente de letras.
// Ver .claude/rules/lyrics-providers.md. Tiempos en segundos (number), no strings.

/** Token morfológico (se rellena en Fase 3 con kuromoji). En Fase 2 va vacío. */
export interface Token {
  surface: string;
  reading?: string;
}

/** Palabra con sus tiempos. En letras "por línea" una Word cubre la línea entera. */
export interface Word {
  tStart: number;
  tEnd: number;
  surface: string;
  reading?: string;
  tokens?: Token[];
}

export interface Line {
  tStart: number;
  tEnd: number;
  words: Word[];
}

export interface LyricsDoc {
  /** id del proveedor que la produjo: "lrclib", "yt-timedtext", "plain"… */
  source: string;
  /** true solo si hay tiempos por palabra (Enhanced LRC). Fase 2 = false. */
  hasWordTiming: boolean;
  lines: Line[];
}

/** Consulta de pista que el content script arma desde el DOM de YouTube. */
export interface TrackQuery {
  title: string;
  artist?: string;
  durationSec?: number;
  videoId: string;
  lang?: string;
}

/** Contrato común de cada fuente de letras. */
export interface LyricsProvider {
  id: string;
  enabledByDefault: boolean;
  fetch(query: TrackQuery): Promise<LyricsDoc | null>;
}

/** Texto completo de una línea (concatena sus palabras). */
export function lineText(line: Line): string {
  return line.words.map((w) => w.surface).join('');
}

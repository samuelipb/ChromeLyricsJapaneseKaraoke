// Núcleo del resaltado "wipe" del karaoke: progreso 0..1 de la línea activa según el
// tiempo del video. Ver .claude/rules/karaoke-sync.md.

/** Progreso (clamp 0..1) del barrido dentro de [tStart, tEnd] en el instante t. */
export function wipeProgress(t: number, tStart: number, tEnd: number): number {
  if (!(tEnd > tStart)) return t >= tEnd ? 1 : 0;
  const p = (t - tStart) / (tEnd - tStart);
  return p < 0 ? 0 : p > 1 ? 1 : p;
}

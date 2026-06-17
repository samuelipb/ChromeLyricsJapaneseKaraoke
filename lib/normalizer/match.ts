// Verificación de RELEVANCIA de un candidato de letra frente a la consulta.
// Evita matches falsos por coincidencia de duración (p. ej. una canción china con la
// misma duración que una japonesa). Ver .claude/rules/lyrics-providers.md.

/** Normaliza un nombre para comparar: NFKC, minúsculas, sin espacios ni puntuación. */
export function normName(s: string | undefined): string {
  return (s ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s　]+/g, '')
    .replace(/[・･,，.。!！?？'"`~\-–—_/\\()[\]{}『』「」【】〈〉《》、:：;；]/g, '');
}

/** True si dos nombres "se solapan" (uno contiene al otro tras normalizar). */
export function namesOverlap(a: string | undefined, b: string | undefined): boolean {
  const x = normName(a);
  const y = normName(b);
  if (!x || !y) return false;
  return x.includes(y) || y.includes(x);
}

/**
 * Cuántas señales del candidato CANÓNICO aparecen en el texto del video (0, 1 o 2):
 * - su título aparece en el texto del video, y/o
 * - su artista aparece en el texto del video O en el nombre del canal.
 * Comparamos los nombres canónicos de la fuente contra el título limpio del video
 * (no al revés), así no hace falta partir bien el título de YouTube. Como artista y
 * título pueden estar en scripts distintos (katakana/kanji/romaji), basta con UNO.
 */
export function relevanceScore(
  candTitle: string | undefined,
  candArtist: string | undefined,
  videoText: string,
  channel?: string,
): number {
  let n = 0;
  if (namesOverlap(videoText, candTitle)) n++;
  if (namesOverlap(videoText, candArtist) || (channel ? namesOverlap(channel, candArtist) : false)) n++;
  return n;
}

/** Relevante si aparece el título O el artista (al menos una señal). */
export function isRelevant(
  candTitle: string | undefined,
  candArtist: string | undefined,
  videoText: string,
  channel?: string,
): boolean {
  return relevanceScore(candTitle, candArtist, videoText, channel) > 0;
}

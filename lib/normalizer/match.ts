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
 * Cuántas señales coinciden (0, 1 o 2): artista y/o título.
 * Sirve para rankear candidatos (2 = muy fiable; 1 = aceptable).
 * Nota: artista y título pueden estar en scripts distintos entre YouTube y la fuente
 * (katakana vs romaji, kanji vs romaji), por eso basta con que coincida UNO.
 */
export function relevanceScore(
  candTitle: string | undefined,
  candArtist: string | undefined,
  queryTitle: string,
  queryArtist?: string,
): number {
  let n = 0;
  if (queryArtist && queryArtist.trim() && namesOverlap(candArtist, queryArtist)) n++;
  if (namesOverlap(candTitle, queryTitle)) n++;
  return n;
}

/** Relevante si coincide el artista O el título (al menos una señal). */
export function isRelevant(
  candTitle: string | undefined,
  candArtist: string | undefined,
  queryTitle: string,
  queryArtist?: string,
): boolean {
  return relevanceScore(candTitle, candArtist, queryTitle, queryArtist) > 0;
}

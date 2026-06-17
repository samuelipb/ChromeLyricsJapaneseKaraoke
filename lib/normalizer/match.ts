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
 * ¿El candidato corresponde a la consulta?
 * - Si conocemos el artista → exigimos que el artista coincida (filtro fuerte y fiable
 *   aunque el título esté en romaji/kanji distinto).
 * - Si no hay artista → exigimos que el título coincida.
 */
export function isRelevant(
  candTitle: string | undefined,
  candArtist: string | undefined,
  queryTitle: string,
  queryArtist?: string,
): boolean {
  if (queryArtist && queryArtist.trim()) return namesOverlap(candArtist, queryArtist);
  return namesOverlap(candTitle, queryTitle);
}

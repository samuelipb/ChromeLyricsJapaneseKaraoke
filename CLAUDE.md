# CLAUDE.md — Extensión Chrome: letras JP con furigana + karaoke sobre YouTube

Extensión **Manifest V3** que detecta la canción de un video de YouTube normal
(`youtube.com/watch`, NO YouTube Music), obtiene su letra (歌詞), añade **furigana** sobre los
kanji y la sincroniza tipo **karaoke** con `video.currentTime`. Orientada a aprender japonés.
La especificación maestra es **`Plan.md`** (raíz). Trabaja por fases verificables; **detente al
final de cada fase** para revisión humana.

## Mapa del proyecto
- `Plan.md` — especificación maestra (visión, fases, decisiones).
- `PROGRESS.md` — **memoria de handoff**. Léelo al iniciar; actualízalo al cerrar cada tarea.
- `.claude/rules/*` — detalle por dominio (carga según el archivo que tocas; ver punteros abajo).
- `.claude/agents/*` — subagentes por dominio (investigación pesada, review).
- `.claude/skills/*` — conocimiento reutilizable (MV3, furigana, LRC/ELRC, normalización, render).
- `.claude/commands/*` — slash commands (`/setup`, `/test`, `/review`, `/ship`, `/save`, `/resume`…).
- `.claude/hooks/*` — automatización determinista en **Node** (Windows-safe).
- _(Desde Fase 1)_ `src/` o `entrypoints/` — código de la extensión (WXT): `background`,
  content script de `/watch`, worker del tokenizador, `popup`, `options`, y `lib/`
  (`providers/`, `normalizer/`, `tokenizer/`, `sync/`, `render/`, `cache/`).

## Comandos clave
> Aún **no** instalados (Fase 0 es solo andamiaje). Se crean en Fase 1 con WXT:
- `npm run dev` — build + HMR, carga descomprimida desde `.output/chrome-mv3`.
- `npm run build` — build de producción.
- `npm test` — Vitest (unitario). `npm run test:e2e` — Playwright.
- `npm run lint` · `npm run typecheck` (`tsc --noEmit`).

## Convenciones (mínimas)
- **TypeScript estricto.** Sin `any` salvo justificación; tipos en el modelo interno `LyricsDoc`.
- **Tests primero (TDD)** cuando sea razonable; no romper builds.
- **Conventional Commits** (`feat:`, `fix:`, `chore:`, `docs:`…). Commits pequeños.
- **UI en español.** Comentarios consistentes.
- **Pregunta antes** de añadir permisos al manifest o nuevas dependencias.

## Seguridad — SIEMPRE / NUNCA (resumen; detalle en `.claude/rules/security.md`)
- **NUNCA** código remoto (`eval`, `new Function`, `<script src=http…>`, `fetch().then(eval)`),
  ni `innerHTML` con datos externos, ni secretos/API keys en el repo, ni telemetría.
- **SIEMPRE** permisos mínimos (nada de `<all_urls>`), DOM por nodos + texto escapado,
  caché/letras **solo locales** (`chrome.storage`/IndexedDB), dependencias fijadas (pin).
- Fuentes "de riesgo" (scraping/word-timing) **desactivadas por defecto (opt-in)**.

## Política de `/compact` (qué preservar SIEMPRE)
1. El **contenido completo de `PROGRESS.md`**. 2. Archivos modificados en la sesión.
3. Decisiones de arquitectura y su porqué. 4. Comandos de test/build vigentes. 5. Fase y próxima tarea.

## Memoria / anti-pérdida de avance (rutina OBLIGATORIA — `Plan.md` §2.7)
- **Al INICIAR una tarea:** lee `PROGRESS.md` + último commit; anota la tarea que empiezas.
- **Al CERRAR una tarea:** actualiza `PROGRESS.md` (qué se hizo, decisiones, **próximo paso**),
  corre tests y haz **commit**. Al cerrar una fase, crea el **tag** (`fase-1`, `fase-2`, …).
- Usa `/save` para el checkpoint y `/resume` para retomar en frío.

## Punteros a reglas (lee la que corresponda al archivo que tocas)
manifest/permisos/CSP → `rules/mv3.md` · proveedores → `rules/lyrics-providers.md` ·
furigana → `rules/furigana.md` · sync karaoke → `rules/karaoke-sync.md` ·
seguridad → `rules/security.md` · tests → `rules/testing.md` · git → `rules/git.md`.

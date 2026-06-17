# PROGRESS.md — Memoria de handoff

> Archivo para **retomar en frío** sin perder avance (Plan.md §2.7). Se actualiza al **iniciar**
> y al **cerrar cada tarea**. Si me quedo sin tokens, este archivo + el último commit deben bastar.
> Léelo siempre al empezar una sesión (lo hace también el hook `SessionStart`).

---

## 📍 Estado actual
- **Fase:** 4 — Cadena multi-fuente + normalización + caché → **CÓDIGO COMPLETO** en rama
  `feat/fase-4-multisource` (typecheck, 56 tests y build verdes). **Pendiente tu prueba manual**;
  luego merge + tag `fase-4`.
- **Mejora de cobertura (Fase 4):** LRCLIB indexa por tokens **latinos**, así que la búsqueda por
  campos en kanji fallaba (p. ej. `track_name=あの夢をなぞって` → 0). Ahora `searchLrclib` combina
  **2 búsquedas** (por campos + general `q=<artista> <título>`) y une candidatos únicos; el filtro
  por duración ±2 s desempata. Caso demo: `sAuEeM_6zpk` (YOASOBI あの夢をなぞって, MV 239 s) antes
  no devolvía nada y ahora casa con la sincronizada de LRCLIB (241 s). +1 test (57).
- **Hecho en Fase 4:** cadena de proveedores POR PRIORIDAD en background
  (`lrclibProvider` sincronizada → `lrclibPlainProvider` texto plano interpolado). Nueva
  interpolación por mora (`lib/normalizer/interpolate.ts`, tested): reparte la duración entre
  líneas de texto plano. LRCLIB refactorizado con `searchLrclib` memoizado (no pega 2× por
  canción), `pickPlain`. El overlay indica "texto plano (aprox.)" cuando la letra es interpolada.
  +11 tests (56 total). Caché por `videoId` y modelo interno único ya existían (Fase 2).
- **timedtext de YouTube (prioridad #1 del plan) DESCARTADO en la práctica:** el endpoint
  ya no responde sin el contexto de la página, y casi ningún MV musical tiene captions (verificado
  con curl: Lemon de 米津玄師 no tiene `captionTracks`). Implementarlo bien exigiría leer
  `ytInitialPlayerResponse` desde un content script en MAIN world; bajo retorno para música.
  Queda como opcional documentado.
- **Fase 3** COMPLETADA Y VERIFICADA, mergeada a `main` + **tag `fase-3`**.
- **Arquitectura final del tokenizador (tras 3 obstáculos resueltos):**
  1. El **Worker** desde content script lo bloquea el **CSP de YouTube** (`worker-src`) →
     pivote a **offscreen document** (`entrypoints/offscreen/`), origen de la extensión, sin CSP.
     El **background** gestiona su ciclo de vida (`chrome.offscreen`) y hace de **relé**
     (con reintentos hasta que el offscreen registra su listener); el content pide tokens por
     mensaje (`lib/tokenizer/client.ts`). Permiso nuevo **`offscreen`**.
  2. **zlibjs** (descompresión del kuromoji clásico) revienta en ESM ("'zlib' in undefined") →
     cambio a la fork **`@sglkc/kuromoji`** (fetch + **fflate**, ESM, sin node `path`).
  3. El loader de la fork **colapsa todas las barras** y rompía `chrome-extension://` →
     se carga con **ruta de origen `/dict`** (resuelve relativa al offscreen).
- **Hecho en Fase 3:** `lib/tokenizer/furigana.ts` (ruby okurigana-aware + romaji, 11 tests).
  Diccionario vendorizado en `public/dict/` (~17 MB). Render de `<ruby>` por NODOS del DOM;
  botones **ふりがな** / **ローマ字** persistidos en storage. Deps fijadas: `@sglkc/kuromoji`,
  `wanakana`. NO se necesitan `web_accessible_resources`.
- **Fase 2** COMPLETADA Y VERIFICADA, mergeada a `main` + **tag `fase-2`** (solo LRCLIB;
  timedtext diferido a Fase 4).
- **Aprendizaje de cobertura:** el video de あいみょん `IL35V9wYr-U` no mostró letra porque
  (a) LRCLIB no tiene NADA de あいみょん/Aimyon, y (b) ese lyric video no tiene captions de YouTube.
  No fue bug: la detección parseó bien (`あいみょん` / `貴方解剖純愛歌 〜死ね〜`) y la extensión degradó
  con elegancia ("sin letra"). Más fuentes = Fase 4.
- **Hecho en Fase 2:** modelo interno (`lib/model.ts`), parser LRC (`lib/providers/lrc.ts`),
  proveedor LRCLIB con matching por duración ±2 s (`lib/providers/lrclib.ts`), limpieza de
  título/artista con heurística japonesa `『』` (`lib/normalizer/title.ts`), mensajería tipada
  (`lib/messaging.ts`), background que orquesta y cachea por `videoId` en `storage.local`, y
  content script que detecta la pista desde el DOM y muestra prev/actual/siguiente sincronizado
  por línea (bucle rAF + búsqueda binaria; pausa/seek manejados). Vitest añadido (pin `4.1.9`).
  Manifest: `+storage`, `+https://lrclib.net/*`.
- **Fase 1** quedó COMPLETADA Y VERIFICADA (tag `fase-1`); content script inyecta en todo
  `*://www.youtube.com/*` para sobrevivir a la SPA.
- **Última tarea hecha:** scaffold WXT (`wxt.config.ts`, `tsconfig.json`), `entrypoints/background.ts`
  (SW que loguea al arrancar) y `entrypoints/content.ts` (overlay visible en `/watch`, reinicio en
  navegación SPA `yt-navigate-finish`, detecta `video.html5-main-video`, limpia listeners). WXT 0.20.26
  y TypeScript 6.0.3 instalados con **pin exacto**. `npm run build` genera `.output/chrome-mv3`
  (manifest mínimo: solo `*://www.youtube.com/*`, content script solo en `/watch`).
- **▶️ PRÓXIMA TAREA:** **Fase 2 — Detección y limpieza de pista + LRCLIB + letra sincronizada por
  línea.** Antes: que el usuario cargue la extensión y confirme que ve el overlay en un `/watch`.
  Para la Fase 2 habrá que **pedir permiso** para añadir `host_permissions`/`connect-src` de
  `https://lrclib.net/*` y el permiso `storage` para la caché por `videoId`.
  *(Aprobado y ya implementado — ver Estado actual.)*

- **▶️ PRÓXIMA TAREA:** verificar Fase 4; luego **Fase 5 — karaoke por palabra** (Enhanced LRC
  cuando exista + interpolación por mora DENTRO de la línea; resaltado "wipe").
- **Diferido / opcional:** proveedor timedtext de YouTube (MAIN world, bajo retorno para música);
  mejora de detección con el panel "Música" de YouTube (Song/Artist estructurado).
- **Pedido del usuario (Fase 6):** control para **aumentar/reducir el tamaño de fuente de la
  letra en tiempo real** (+/− en overlay o atajos), persistido en storage. Anotado en `Plan.md`.
- **Pedido del usuario (Fase 6):** **ajuste de offset de sincronización por canción**
  (adelantar/atrasar la letra ±pasos, persistido por `videoId`) para cuando los tiempos de la
  fuente no casan con el audio (ej. video `SII-S-zCg-c`). Anotado en `Plan.md` y `karaoke-sync.md`.

## 🧭 Cómo probar la Fase 1 (manual, lo hace el usuario)
1. `npm run build` (ya corrido) → genera `.output/chrome-mv3`.
2. En Chrome: `chrome://extensions` → activar **Modo desarrollador** → **Cargar descomprimida**
   → seleccionar la carpeta `.output/chrome-mv3`.
3. Abrir cualquier `https://www.youtube.com/watch?v=...` → debe verse el overlay
   "🎤 Letras JP — overlay activo (Fase 1)" abajo-centro; cambia a ▶️/⏸️ al reproducir/pausar.
4. Navegar a otro video sin recargar (SPA) → el overlay se reinicia solo.
5. Alternativa con HMR: `npm run dev` (carga y recarga en caliente).

---

## 🏛️ Decisiones de arquitectura (y su porqué)
- **Framework: WXT** (Plan.md §1.5). Genera `manifest.json`, HMR, multi-navegador, TS de fábrica,
  funciona en Windows. Alternativa solo si hay bloqueo serio: Vite + CRXJS.
- **Sync: empezar simple.** Núcleo = **LRCLIB (por línea) + interpolación por mora**. La
  **alineación forzada offline** (precisión palabra-a-palabra) es **Fase 7 opcional**.
- **Persistencia desde día 1:** Git + `PROGRESS.md` actualizado por tarea; **tag por fase**.
- **Modelo interno único** al que se normaliza toda fuente:
  `Word{tStart,tEnd,surface,reading?,tokens?}` → `Line{tStart,tEnd,words[]}` →
  `LyricsDoc{source,hasWordTiming,lines[]}`.
- **Hooks en Node**, no bash (Windows-safe, Plan.md §2.6/§10).
- **Componente de alineación forzada (Python/WhisperX/aeneas)** corre FUERA del navegador (WSL o
  script aparte); la extensión solo consume el Enhanced LRC cacheado. No es "entrenamiento".

## 🗂️ Mapa de archivos y estado
| Ruta | Estado | Nota |
|---|---|---|
| `Plan.md` | ✅ fijo | Especificación maestra (no editar salvo que el usuario lo pida). |
| `CLAUDE.md` | ✅ creado | Espina dorsal delgada. |
| `PROGRESS.md` | ✅ creado | Este archivo. |
| `.gitignore` | ✅ creado | Ignora node_modules, build, .env, settings.local.json. |
| `.claude/rules/*` (7) | ✅ creado | Detalle por dominio. |
| `.claude/agents/*` (8) | ✅ creado | Subagentes por dominio. |
| `.claude/skills/*` (5) | ✅ creado | Conocimiento reutilizable. |
| `.claude/commands/*` (8) | ✅ creado | Slash commands. |
| `.claude/hooks/*` (4) | ✅ creado | Node, defensivos (no-op si no hay tooling). |
| `.claude/settings.json` | ✅ creado | Registra los hooks. |
| `package.json` | ✅ creado | Scripts WXT + devDeps `wxt 0.20.26`, `typescript 6.0.3` (pin). |
| `wxt.config.ts` | ✅ creado | Manifest mínimo: `host_permissions` solo YouTube. |
| `tsconfig.json` | ✅ creado | Extiende `.wxt/tsconfig.json`; `strict` + reglas extra. |
| `entrypoints/background.ts` | ✅ creado | SW efímero; solo loguea al arrancar (Fase 1). |
| `entrypoints/content.ts` | ✅ creado | Overlay en `/watch`, SPA-aware, limpia listeners. |
| `.wxt/`, `.output/` | 🛠️ generados | Ignorados por git (build/types). |

## ▶️ Cómo correr y probar AHORA MISMO
- `npm run build` → `.output/chrome-mv3` (cargar descomprimida en `chrome://extensions`).
- `npm run dev` → build + HMR. `npm run typecheck` → `tsc --noEmit` (verde).
- Si `.wxt/` falta tras un `npm install`, regenéralo con `npx wxt prepare` (el `postinstall`
  puede no correr en el primer install). `git log --oneline` / `git tag` para el estado de fases.

## 🚧 Bloqueos / dudas abiertas / TODOs
- **`gh` no instalado** → repo **solo local**. TODO: cuando haya `gh` + credenciales, crear remoto
  en GitHub y `git push -u`. No bloquea el avance (Plan.md §2.7).
- **Identidad git** puesta local como `Samuel <xamurtx@gmail.com>` — cámbiala si prefieres otra.
- **npm audit:** 8 vulnerabilidades, **todas en devDeps transitivas de WXT** (esbuild dev-server,
  web-ext-run, fx-runner de Firefox, node-notifier). **No** entran en el bundle de la extensión
  (`.output/` = `background.js` + `content.js` + `manifest.json`). `npm audit fix --force` subiría
  WXT de major y rompería; se deja como está. Revisar al actualizar WXT.
- Las fuentes de letras "de riesgo" (word-timing/scraping) van **opt-in**; decidir cuáles activar
  más adelante (Fase 4/5).
- **TODO "side approach" (a revisar con el usuario):** casos como el lyric video de あいみょん
  `IL35V9wYr-U` donde NO hay letra en LRCLIB NI captions en YouTube (letra incrustada en la
  imagen). Opciones a evaluar: (1) más bases de letras / proveedores opt-in; (2) texto plano de
  otra fuente + interpolación por mora (degradación sin sincronía exacta); (3) OCR de los
  fotogramas del lyric video; (4) alineación forzada offline (Fase 7, WhisperX/aeneas) →
  Enhanced LRC cacheado. Discutir alcance/legalidad/coste antes de implementar.

## 📒 Bitácora (log breve por tarea)
- **[Fase 4]** Cadena multi-fuente: `lrclibProvider` (synced) → `lrclibPlainProvider` (texto
  plano interpolado por mora). `lib/normalizer/interpolate.ts` (moraCount + interpolatePlainLines).
  LRCLIB refactor: `searchLrclib` memoizado + `pickPlain`. Overlay marca "texto plano (aprox.)".
  timedtext descartado (sin captions en MVs). +11 tests (56). Rama `feat/fase-4-multisource`.
  → **Detenido para prueba manual antes de merge + tag `fase-4`.**
- **[Fase 3]** Furigana: lógica pura `furigana.ts` (ruby okurigana-aware + romaji con corrección
  de partículas は/へ; 11 tests). Tokenizador en **offscreen document** (kuromoji fuera del CSP de
  YouTube), background como relé, caché por línea. Diccionario vendorizado `public/dict/` (~17 MB).
  Render `<ruby>` por nodos + toggles ふりがな/ローマ字 persistidos. Tras resolver 3 obstáculos
  (CSP worker→offscreen; zlibjs→`@sglkc/kuromoji`+fflate; URL del dict→`/dict`). Deps
  `@sglkc/kuromoji`+`wanakana` (pin). **Verificado por el usuario.** Merge a `main` + tag `fase-3`.
- **[Fase 2]** Detección de pista + LRCLIB + letra por línea. `lib/`: model, lrc parser,
  lrclib provider (matching ±2 s), title normalizer (heurística `『』`), messaging. Background
  orquesta + cachea por videoId (storage.local). Content script: detect desde DOM + render
  prev/actual/siguiente con rAF y búsqueda binaria; pausa/seek/ended manejados. 34 tests
  (Vitest, red mockeada). Manifest: +storage, +lrclib.net. Rama `feat/fase-2-lrclib`.
  → **Detenido para prueba manual del usuario antes de merge + tag `fase-2`.**
- **[Fase 1]** Esqueleto MV3 con WXT: `wxt.config.ts` (manifest mínimo YouTube), `tsconfig.json`
  estricto, `background.ts` (SW) y `content.ts` (overlay en `/watch`, SPA-aware, cleanup).
  WXT 0.20.26 + TS 6.0.3 (pin exacto). typecheck + build verdes; `.output/chrome-mv3` generado.
  → **Detenido para prueba manual del usuario antes de la Fase 2.**
- **[Fase 0]** Andamiaje agéntico completo: Git init (`main`), `.gitignore`, `CLAUDE.md`,
  `PROGRESS.md`, 7 rules + 8 agents + 5 skills + 8 commands + 4 hooks + `settings.json`.
  Commit inicial + tag `fase-0`. → **Detenido para revisión humana antes de Fase 1.**

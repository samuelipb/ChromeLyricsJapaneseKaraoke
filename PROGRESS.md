# PROGRESS.md — Memoria de handoff

> Archivo para **retomar en frío** sin perder avance (Plan.md §2.7). Se actualiza al **iniciar**
> y al **cerrar cada tarea**. Si me quedo sin tokens, este archivo + el último commit deben bastar.
> Léelo siempre al empezar una sesión (lo hace también el hook `SessionStart`).

---

## 📍 Estado actual
- **Fase:** 1 — Esqueleto MV3 con WXT + overlay "hola mundo" → **COMPLETADA Y VERIFICADA**
  (el usuario cargó la extensión y confirmó que el overlay aparece y reacciona a play/pausa en
  un `/watch`). **Tag `fase-1` creado.** Nota: el content script ahora se inyecta en todo
  `*://www.youtube.com/*` para sobrevivir a la navegación SPA (fix `d00bdc3`).
- **Última tarea hecha:** scaffold WXT (`wxt.config.ts`, `tsconfig.json`), `entrypoints/background.ts`
  (SW que loguea al arrancar) y `entrypoints/content.ts` (overlay visible en `/watch`, reinicio en
  navegación SPA `yt-navigate-finish`, detecta `video.html5-main-video`, limpia listeners). WXT 0.20.26
  y TypeScript 6.0.3 instalados con **pin exacto**. `npm run build` genera `.output/chrome-mv3`
  (manifest mínimo: solo `*://www.youtube.com/*`, content script solo en `/watch`).
- **▶️ PRÓXIMA TAREA:** **Fase 2 — Detección y limpieza de pista + LRCLIB + letra sincronizada por
  línea.** Antes: que el usuario cargue la extensión y confirme que ve el overlay en un `/watch`.
  Para la Fase 2 habrá que **pedir permiso** para añadir `host_permissions`/`connect-src` de
  `https://lrclib.net/*` y el permiso `storage` para la caché por `videoId`.

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

## 📒 Bitácora (log breve por tarea)
- **[Fase 1]** Esqueleto MV3 con WXT: `wxt.config.ts` (manifest mínimo YouTube), `tsconfig.json`
  estricto, `background.ts` (SW) y `content.ts` (overlay en `/watch`, SPA-aware, cleanup).
  WXT 0.20.26 + TS 6.0.3 (pin exacto). typecheck + build verdes; `.output/chrome-mv3` generado.
  → **Detenido para prueba manual del usuario antes de la Fase 2.**
- **[Fase 0]** Andamiaje agéntico completo: Git init (`main`), `.gitignore`, `CLAUDE.md`,
  `PROGRESS.md`, 7 rules + 8 agents + 5 skills + 8 commands + 4 hooks + `settings.json`.
  Commit inicial + tag `fase-0`. → **Detenido para revisión humana antes de Fase 1.**

# PROGRESS.md — Memoria de handoff

> Archivo para **retomar en frío** sin perder avance (Plan.md §2.7). Se actualiza al **iniciar**
> y al **cerrar cada tarea**. Si me quedo sin tokens, este archivo + el último commit deben bastar.
> Léelo siempre al empezar una sesión (lo hace también el hook `SessionStart`).

---

## 📍 Estado actual
- **Fase:** 0 — Andamiaje agéntico → **COMPLETADA** (pendiente tu revisión).
- **Última tarea hecha:** montar repo Git + `CLAUDE.md` + `PROGRESS.md` + árbol `.claude/`
  completo (rules, agents, skills, commands, hooks, settings.json), adaptado a Windows 11.
- **▶️ PRÓXIMA TAREA:** **Fase 1 — Esqueleto MV3 con WXT + overlay "hola mundo"** inyectado en
  una página `youtube.com/watch`. *(Requiere tu OK; instala WXT y dependencias → preguntar antes.)*

## 🧭 Cómo arrancar la Fase 1 (cuando se apruebe)
1. `npm create wxt@latest` (o init en el dir actual) — confirmar plantilla TS.
2. Definir `manifest` mínimo: `host_permissions` solo `*://www.youtube.com/*`; sin `<all_urls>`.
3. Content script en `/watch` que inyecta un overlay visible (sin lógica de letras todavía).
4. Manejar navegación SPA (`yt-navigate-finish`) y `document.querySelector('video.html5-main-video')`.
5. Cargar descomprimida desde `.output/chrome-mv3` en `chrome://extensions`. Probar y commitear.

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
| `src/` / `entrypoints/` | ⏳ Fase 1 | Código de la extensión (aún no existe). |

## ▶️ Cómo correr y probar AHORA MISMO
- **Fase 0 no produce build ejecutable** (es solo andamiaje). Verificación disponible:
  - `git log --oneline` → commit inicial; `git tag` → `fase-0`.
  - `node .claude/hooks/guard.mjs` con JSON por stdin → bloquea `.env`/código remoto.
  - `node .claude/hooks/session-start.mjs` → imprime este PROGRESS.
- El `npm run dev/test/...` empieza a funcionar **desde la Fase 1** (cuando exista `package.json`).

## 🚧 Bloqueos / dudas abiertas / TODOs
- **`gh` no instalado** → repo **solo local**. TODO: cuando haya `gh` + credenciales, crear remoto
  en GitHub y `git push -u`. No bloquea el avance (Plan.md §2.7).
- **Identidad git** puesta local como `Samuel <xamurtx@gmail.com>` — cámbiala si prefieres otra.
- **Pendiente de aprobación:** arrancar Fase 1 (instala WXT + deps → preguntar antes, Plan.md §12).
- Las fuentes de letras "de riesgo" (word-timing/scraping) van **opt-in**; decidir cuáles activar
  más adelante (Fase 4/5).

## 📒 Bitácora (log breve por tarea)
- **[Fase 0]** Andamiaje agéntico completo: Git init (`main`), `.gitignore`, `CLAUDE.md`,
  `PROGRESS.md`, 7 rules + 8 agents + 5 skills + 8 commands + 4 hooks + `settings.json`.
  Commit inicial + tag `fase-0`. → **Detenido para revisión humana antes de Fase 1.**

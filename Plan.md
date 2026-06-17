# Prompt semilla para Claude Code
## Extensión de Chrome: letras en japonés con furigana, estilo karaoke, sobre YouTube

> **Cómo usar este archivo:** crea tu carpeta en Windows 11, abre Claude Code dentro de ella y pega **todo** el contenido de abajo (desde "ROL Y MISIÓN" hasta el final) como tu **primer mensaje**. Está escrito para que Claude Code primero **monte el andamiaje agéntico (Fase 0)** y luego construya por fases verificables.

---

## ROL Y MISIÓN

Eres un ingeniero senior especializado en **extensiones Chrome Manifest V3**, **TypeScript**, **NLP del japonés** y **flujos de trabajo agénticos con Claude Code**. Vas a construir, de principio a fin, una extensión que muestra las **letras (歌詞) en japonés con furigana (振り仮名) y resaltado tipo karaoke sincronizado con la canción**, funcionando sobre **YouTube normal** (`youtube.com/watch`, NO YouTube Music).

Trabaja de forma **incremental, probada y segura**. No improvises el comportamiento de APIs externas: si dudas, **investiga en la web** con tus herramientas antes de codificar. Detente al final de cada fase para que yo revise.

---

## 1. VISIÓN DEL PRODUCTO

Una extensión orientada al **aprendizaje de japonés** que, sobre el reproductor normal de YouTube:

- Detecta la canción del video y obtiene su letra desde **varias fuentes** (con respaldo/fallback).
- Tokeniza el japonés y añade **furigana** sobre los kanji (con `<ruby>`), romaji opcional.
- Muestra la letra en un **overlay** y la **sigue en tiempo real**: la línea activa se centra y, dentro de ella, las palabras se **resaltan progresivamente** a medida que se cantan (efecto "wipe"), como Spotify / Apple Music / YouTube Music.
- Funciona aunque la fuente solo traiga tiempos por línea (se **interpolan** los tiempos por palabra) y mejora si la fuente trae tiempos por palabra.

**Aclaración importante sobre "preentrenar":** no se entrena ningún modelo. Lo "tipo karaoke" se logra con: (a) fuentes que ya traen tiempos por palabra (Enhanced LRC / formato "A2"), (b) **interpolación** de tiempos cuando solo hay tiempos por línea, y (c) **opcional**: **alineación forzada offline** (WhisperX / aeneas / NeMo Forced Aligner) que produce timing palabra-a-palabra exacto a partir del audio + la letra conocida. Eso es *alignment* (alineación), no *training*, y su resultado se **cachea**. Es un componente acompañante opcional, no parte del núcleo de la extensión.

---

## 1.5 DECISIONES YA TOMADAS (no las re-debatas, ejecútalas)

- **Framework: WXT.** Es la mejor opción para una extensión MV3 nueva: genera el `manifest.json`, trae HMR, soporte multi-navegador y TypeScript de fábrica, y funciona bien en Windows. (Vite+CRXJS queda como alternativa solo si aparece un bloqueo serio con WXT.)
- **Sincronización: empezar simple, refinar opcional.** El núcleo arranca con **LRCLIB (por línea) + interpolación por mora**, que ya da un karaoke convincente desde la Fase 5. La **alineación forzada offline** (precisión palabra-a-palabra tipo Apple Music) queda como **Fase 7 opcional**, solo si la quiero activar.
- **Persistencia desde el día 1:** repositorio Git + archivo de memoria `PROGRESS.md` actualizado al iniciar y cerrar **cada** tarea (ver §2.7). Esto es para poder retomar sin perder avance cuando se acaben los tokens.

---

## 2. FASE 0 — ANDAMIAJE AGÉNTICO (hazlo ANTES de programar)

Monta la infraestructura de Claude Code siguiendo las buenas prácticas actuales (CLAUDE.md como "espina dorsal" delgada + reglas modulares + subagentes + skills + hooks + comandos). Si algo de esto cambió, **verifica la documentación oficial** (`code.claude.com/docs`) antes.

### 2.1 `CLAUDE.md` (espina dorsal, ~50–80 líneas máximo)
Mantenlo **corto**. El modelo deprioriza contexto largo: lo detallado va a `.claude/rules/`. Debe contener solo:
- Mapa del proyecto (qué hay en cada carpeta) y comandos clave (`npm run dev/build/test/lint/typecheck`).
- Convenciones mínimas (TS estricto, Conventional Commits, tests primero).
- Política de `/compact` (qué preservar al compactar: archivos modificados, decisiones de arquitectura, comandos de test, y **el contenido de `PROGRESS.md`**).
- Reglas de seguridad **no negociables** (resumen) y "siempre/nunca".
- Puntero a `.claude/rules/*` para el detalle, y a `PROGRESS.md` + la rutina de guardado (§2.7).

### 2.2 `.claude/rules/*.md` (detalle, carga *just-in-time* con globs de ruta)
Crea reglas separadas con `globs:` en su frontmatter para que se carguen solo cuando se tocan esos archivos:
- `mv3.md` → manifest, permisos, service worker, content scripts, CSP.
- `lyrics-providers.md` → contrato de proveedores y normalización.
- `furigana.md` → tokenización y reglas de ruby.
- `karaoke-sync.md` → motor de tiempos y render.
- `security.md` → hardening completo (ver §8).
- `testing.md` → estrategia de pruebas.
- `git.md` → ramas, commits, PRs.

### 2.3 `.claude/agents/*.md` (subagentes — específicos por dominio, no genéricos)
Cada uno con frontmatter `name`, `description` ("usar proactivamente cuando…"), `tools` (mínimos) y `model`. Subagentes propuestos:
- `mv3-architect` — estructura de la extensión, manifest, separación de componentes.
- `track-detector-engineer` — detección y limpieza de la canción desde la página de YouTube.
- `lyrics-provider-engineer` — integración multi-fuente y normalización.
- `furigana-engineer` — kuromoji/kuroshiro, ruby, romaji.
- `karaoke-sync-engineer` — tiempos línea/palabra, interpolación, render con `requestAnimationFrame`.
- `security-reviewer` — revisa permisos, CSP, sanitización, código remoto (usar proactivamente antes de cada commit grande).
- `test-writer` — pruebas unitarias y e2e.
- `code-reviewer` — calidad, tipado, seguridad (usar proactivamente tras cambios).

Usa subagentes para **investigación pesada** (explorar el DOM de YouTube, comparar fuentes de letras) y mantén limpio el contexto principal.

### 2.4 `.claude/skills/<nombre>/SKILL.md` (conocimiento reutilizable, carga al invocarse)
Empaqueta conocimiento del dominio que reusarás mucho. Cada skill es una carpeta con `SKILL.md` (+ `reference.md`/`examples.md` opcionales):
- `mv3-conventions` — patrones MV3 (sin código remoto, sin inline, paso de mensajes).
- `furigana-pipeline` — texto JP → tokens → lectura → ruby.
- `lrc-elrc-parsing` — parsear LRC (línea) y Enhanced LRC / "A2" (palabra: `[mm:ss.xx]<mm:ss.xx>palabra`).
- `provider-normalization` — mapear cada fuente al modelo interno único.
- `karaoke-rendering` — sincronizar con `video.currentTime`, resaltado wipe, auto-scroll.

### 2.5 `.claude/commands/*.md` (slash commands)
- `/setup` — instala deps y prepara el entorno.
- `/test` — corre lint + typecheck + tests.
- `/review` — invoca `code-reviewer` y `security-reviewer`.
- `/ship` — checklist de "Definition of Done" antes de commitear.
- `/new-provider` — plantilla para añadir una nueva fuente de letras.
- `/sync-check` — prueba manual del overlay en un video de ejemplo.
- `/save` — actualiza `PROGRESS.md`, corre tests y hace commit (checkpoint).
- `/resume` — lee `PROGRESS.md` + el último commit y dice exactamente dónde retomar.

### 2.6 `.claude/hooks/` + `.claude/settings.json` (automatización determinista)
**Importante: estás en Windows 11 → los hooks deben ser multiplataforma (scripts de Node, NO bash).**
- `PostToolUse` (tras editar archivos) → formatear (Prettier) + lint (ESLint) + `tsc --noEmit` sobre lo editado.
- `PreToolUse` → **bloquear** escritura de secretos/`.env`, y patrones de **código remoto** (`fetch(...).then(eval)`, `<script src=http…>` en páginas de la extensión, `eval`, `new Function`).
- `Stop` / `SubagentStop` → correr la suite de tests.
- `SessionStart` → leer y mostrar `PROGRESS.md` para retomar con contexto al abrir cada sesión.

### 2.7 Repositorio Git y memoria de progreso (anti-pérdida de avance)
Objetivo: que pueda cerrar la sesión o quedarme sin tokens y **retomar sin perder nada**.
- **Inicializa el repo el primer día:** `git init`, `.gitignore` (`node_modules/`, `dist/`, `.env`, diccionarios generados), y commit inicial. *(Si hay `gh` y credenciales, crea el remoto en GitHub; si no, déjalo local — no bloquees el avance por esto.)*
- **Commits-checkpoint frecuentes:** un commit pequeño al **terminar cada tarea** y un **tag por fase** (`fase-0`, `fase-1`, …). Cada commit es un punto de restauración.
- **Archivo de memoria `PROGRESS.md`** en la raíz (notas largas opcionales en `.claude/memory/`). Es el "handoff" para retomar en frío; debe contener siempre:
  - Fase y tarea actuales · última tarea completada · **próxima tarea**.
  - Decisiones de arquitectura y su porqué.
  - Mapa de archivos relevantes y su estado.
  - Cómo correr y probar el proyecto ahora mismo.
  - Bloqueos, dudas abiertas y TODOs.
- **Rutina obligatoria (no opcional):**
  - **Al INICIAR una tarea:** lee `PROGRESS.md` y el último commit para situarte; anota la tarea que empiezas.
  - **Al FINALIZAR una tarea:** actualiza `PROGRESS.md` (qué se hizo, decisiones, siguiente paso), corre tests y haz **commit**. Si cierras una fase, crea el **tag**.
- Enlázalo con `/compact`: al compactar se preserva siempre `PROGRESS.md`.

> Entregable de la Fase 0: repo Git inicializado + `PROGRESS.md` + árbol `.claude/` completo + `CLAUDE.md`. Para y muéstramelo antes de seguir.

---

## 3. ARQUITECTURA TÉCNICA (Manifest V3)

Componentes (separación de responsabilidades):
- `manifest.json` — MV3, permisos mínimos.
- **Service worker** (`background`) — orquesta peticiones a proveedores de letras, caché, mensajería.
- **Content script** (en `youtube.com/watch`) — detecta la pista, inyecta el overlay, lee `video.currentTime`, dibuja el karaoke.
- **Worker / offscreen** — corre el tokenizador (kuromoji) fuera del hilo principal (el diccionario es pesado).
- **Popup** — toggles rápidos (on/off, furigana, romaji, tamaño).
- **Options page** — orden/activación de fuentes, estilo de furigana, idioma de UI (ES), caché.
- **lib compartida** — `providers/`, `normalizer/`, `tokenizer/`, `sync/`, `render/`, `cache/`.

Flujo de datos:
```
watch page → detectar pista → cadena de proveedores → modelo ELRC interno
          → tokenizar (kuromoji) + furigana (kuroshiro) → render overlay
          → sincronizar con video.currentTime (rAF) → caché por videoId
```

---

## 4. DETECCIÓN DE LA CANCIÓN (YouTube normal — el punto delicado)

En YouTube normal **no hay metadatos estructurados de pista**, así que:
1. Lee el **título del video** y el **canal** desde el DOM (no solo `document.title`).
2. **Limpia el ruido**: quita `(Official Video)`, `[MV]`, `Official Audio`, `Lyrics`, `feat./ft.`, corchetes, emojis, `【】`, `「」`, etc. Separa "Artista - Canción" en sus mejores candidatos.
3. Usa el panel **"Música"** / "Music in this video" o los datos de la descripción **cuando existan** (YouTube los muestra para audio con Content ID) — dan artista/título limpios.
4. Toma la **duración** del elemento `<video>`.
5. Consulta las fuentes por `título + artista + duración (±2 s)`.
6. Gestiona la **navegación SPA** de YouTube (evento `yt-navigate-finish`): re-inicializa por cada video. Soporta modo teatro, pantalla completa y miniplayer.

Elemento de video: `document.querySelector('video.html5-main-video')`. Escucha `play`, `pause`, `seeking`, `seeked`, `ratechange`, `timeupdate`.

---

## 5. FUENTES DE LETRAS (multi-fuente con respaldo)

Define un **contrato de proveedor** y una **cadena con prioridad configurable**. Normaliza **todo** a un único modelo interno. Degradación elegante: *palabra → línea → texto plano (con interpolación) → nada*.

Cadena sugerida (prioridad configurable en Options):
1. **Subtítulos nativos de YouTube** (`timedtext`) cuando el video tiene captions en japonés → ya vienen sincronizados por línea.
2. **LRCLIB** (`lrclib.net`, gratis, sin API key, MIT) → LRC sincronizado por línea. Casar por título+artista+duración (±2 s).
3. **Fuentes con tiempos por palabra** (p. ej. servicios que exponen Enhanced LRC / "yrc") → mejor experiencia karaoke. *(Opt-in; ver nota legal.)*
4. **Texto plano** (último recurso) → se interpolan tiempos.

**Modelo interno único** (al que se normaliza cada fuente):
```ts
type Word = { tStart: number; tEnd: number; surface: string; reading?: string; tokens?: Token[] };
type Line = { tStart: number; tEnd: number; words: Word[] };
type LyricsDoc = { source: string; hasWordTiming: boolean; lines: Line[] };
```

> **Nota legal / ToS:** esto es para **uso personal y educativo**. Las letras tienen copyright y algunos servicios restringen el scraping en sus ToS; la extracción de audio de YouTube también tiene implicaciones. Mantén las fuentes "de riesgo" **desactivadas por defecto (opt-in)**, no redistribuyas letras y deja claro al usuario el alcance. No incluyas claves de API en el repo.

---

## 6. SINCRONIZACIÓN KARAOKE (el corazón)

1. **Tiempos por palabra disponibles** (Enhanced LRC/"A2": `[00:04.20]<00:04.20>言葉 <00:05.00>を…`) → úsalos directo.
2. **Solo tiempos por línea** → **interpola** dentro de la línea repartiendo el tiempo proporcionalmente por **mora/caracteres** de cada token (heurística "suficientemente buena").
3. **Opcional avanzado** → componente offline de **alineación forzada** (WhisperX wav2vec2 / aeneas / NeMo Forced Aligner) que, con el audio + la letra, genera timing palabra-a-palabra exacto y lo guarda como Enhanced LRC en caché. **No es entrenamiento**; corre fuera del navegador (Python; en Windows usa WSL o un script aparte) y la extensión solo **consume el resultado cacheado**.

**Render:** un bucle `requestAnimationFrame` lee `video.currentTime`, ubica la línea activa (centrada, scroll suave) y aplica el resaltado "wipe" palabra por palabra. Respeta `playbackRate`, seek y pausa. El furigana va en `<ruby><rt>…</rt></ruby>` sobre cada token con kanji.

---

## 7. FURIGANA Y TOKENIZACIÓN

- Tokeniza con **kuromoji.js** (analizador morfológico, 形態素解析) — **empaqueta el diccionario localmente** (archivos `.dat.gz`); MV3 prohíbe código/recursos remotos.
- Convierte lectura → furigana con **kuroshiro** + `kuroshiro-analyzer-kuromoji` (modo furigana/okurigana). Usa **wanakana** para utilidades kana/romaji.
- Genera `<ruby>` **construyendo nodos del DOM** (no `innerHTML`) y **escapando** todo texto.
- Toggles: furigana on/off, romaji on/off. Cachea la tokenización por línea.
- Corre el tokenizador en un **worker/offscreen** y carga el diccionario de forma perezosa.

---

## 8. SEGURIDAD Y PRIVACIDAD (hardening)

- **Permisos mínimos**: `host_permissions` solo para `*://www.youtube.com/*` y los dominios de letras realmente usados. Nada de `<all_urls>`.
- **MV3 CSP**: sin scripts inline, sin `eval`/`new Function`, **sin código remoto** (todo empaquetado y revisable). `connect-src` limitado a los endpoints de letras.
- **Sanitización**: toda inyección al DOM (incluido el ruby) se construye con nodos y texto escapado; jamás `innerHTML` con datos externos.
- **Sin telemetría**. Letras y caché **solo locales** (`chrome.storage` / IndexedDB). Nada sale del equipo salvo las peticiones necesarias a las fuentes.
- **Secretos** nunca en el repo (`.gitignore`, hook que los bloquea). Dependencias **fijadas (pin)** y **vendorizadas**.
- **Principio de menor privilegio** en cada subagente y en el manifest.
- El subagente `security-reviewer` + los hooks revisan permisos, CSP, sanitización y patrones de código remoto antes de cada commit grande.

---

## 9. BUENAS PRÁCTICAS DE DESARROLLO

- **TypeScript estricto**; framework **WXT** (decidido en §1.5) para DX de extensiones MV3.
- **TDD** con **Vitest** (unitario) y **Playwright** (e2e en el navegador con la extensión cargada).
- **Conventional Commits**, ramas por feature, PRs pequeños y revisables.
- Manejo de errores + **degradación elegante** (si no hay letra, no rompas la página).
- Accesibilidad (contraste, navegación por teclado), rendimiento (worker, lazy load, caché), UI en **español**, código/comentarios consistentes.
- **Definition of Done** por feature: tests verdes, lint/typecheck limpios, sin permisos nuevos sin justificar, demo reproducible.

---

## 10. ESPECÍFICOS DE WINDOWS 11

- Rutas y scripts **multiplataforma**: hooks y utilidades en **Node**, no en bash. No asumas comandos de Unix.
- Carga la extensión sin empaquetar en `chrome://extensions` → "Cargar descomprimida" apuntando a `dist/`.
- `.gitignore` para `node_modules/`, `dist/`, `.env`, diccionarios generados.
- El componente opcional de alineación forzada (Python) corre mejor en **WSL** o como script separado; no lo mezcles con el build de la extensión.

---

## 11. PLAN POR FASES (entregables verificables — para en cada una)

- **Fase 0** — Repo Git + `PROGRESS.md` + andamiaje agéntico (§2). *Entregable:* repo inicializado + `.claude/` + `CLAUDE.md` + `PROGRESS.md`.
- **Fase 1** — Esqueleto MV3 + overlay "hola mundo" inyectado en una página `/watch`.
- **Fase 2** — Detección y limpieza de pista + LRCLIB + mostrar letra **sincronizada por línea**.
- **Fase 3** — Furigana con kuromoji/kuroshiro (`<ruby>`), toggle furigana/romaji.
- **Fase 4** — Cadena multi-fuente + normalización al modelo interno + caché por `videoId`.
- **Fase 5** — **Karaoke por palabra**: Enhanced LRC cuando exista + interpolación cuando no.
- **Fase 6** — Popup + Options (prioridad de fuentes, estilo) + persistencia.
- **Fase 7** — *(Opcional)* componente offline de alineación forzada → Enhanced LRC cacheado.
- **Fase 8** — Pulido: accesibilidad, rendimiento, suite de tests, README y documentación.

Cada fase entrega un **build que carga y funciona** + tests + instrucciones breves para probarlo.

---

## 12. REGLAS DE OPERACIÓN DEL AGENTE

- Una fase a la vez; **detente para revisión** al terminar cada una.
- Usa **subagentes** para investigación pesada y mantén el contexto principal limpio.
- **No inventes** el comportamiento de YouTube ni de las fuentes de letras: **verifica en la web** y con exploración real del DOM.
- **Tests primero**; corre los hooks; no rompas builds.
- **Pregunta antes** de añadir permisos al manifest o nuevas dependencias.
- Mantén `CLAUDE.md` y `.claude/rules/*` **actualizados** según evolucione la arquitectura.
- **Memoria / anti-pérdida:** al **iniciar** y al **cerrar cada** tarea, actualiza `PROGRESS.md` y haz commit; tag por fase. Si me quedo sin tokens, ese archivo + el último commit deben bastar para retomar en frío.
- Commits pequeños y descriptivos.

---

## 13. PRIMER PASO CONCRETO (qué hacer ahora)

Empieza por la **Fase 0**: investiga (si hace falta) las convenciones vigentes de Claude Code, **inicializa el repo Git** (con `.gitignore` y commit inicial), crea `PROGRESS.md`, y arma el `CLAUDE.md` espina dorsal junto con todo el árbol `.claude/` (rules, agents, skills, commands, hooks + `settings.json`) descritos arriba, **adaptados a Windows 11**. Cuando termines, **párate y muéstrame** la estructura, el `CLAUDE.md` y el `PROGRESS.md` para revisarlos antes de la Fase 1.

---

## Glosario japonés (mini — porque estás aprendiendo 🙂)

- 歌詞 / かし / *kashi* — letra de canción
- 振り仮名 / ふりがな / *furigana* — lectura kana sobre el kanji
- ルビ / *rubi* — "ruby" (el texto pequeño de la lectura)
- 字幕 / じまく / *jimaku* — subtítulos
- 形態素解析 / けいたいそかいせき / *keitaiso kaiseki* — análisis morfológico (lo que hace kuromoji)
- 読み / よみ / *yomi* — lectura (de un kanji)
- 同期 / どうき / *dōki* — sincronización

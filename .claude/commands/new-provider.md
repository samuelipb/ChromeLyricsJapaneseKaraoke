---
description: Plantilla para añadir una nueva fuente de letras al sistema multi-fuente.
argument-hint: <id-del-proveedor> (p. ej. "musixmatch", "genius")
allowed-tools: Read, Write, Edit, Glob, Grep, WebFetch, Agent
---

Añade un proveedor de letras nuevo llamado **$1** siguiendo el contrato y la normalización.

Pasos:
1. **Investiga la API real** con WebFetch antes de codificar (endpoint, formato, si trae word-timing,
   ToS). No inventes el comportamiento.
2. Crea `lib/providers/$1.ts` implementando `LyricsProvider` (ver `.claude/rules/lyrics-providers.md`):
   `id`, `enabledByDefault` (**false** si es fuente de riesgo/word-timing → opt-in), `fetch(query)`.
3. **Normaliza** la salida a `LyricsDoc` con la skill `provider-normalization` (tiempos en segundos,
   matching por duración ±2 s, valida el esquema, devuelve `null` si no aplica).
4. Regístralo en la cadena y en la configuración de prioridad de Options.
5. Si necesita un dominio nuevo: **pídeme permiso** para añadirlo a `host_permissions`/`connect-src`.
6. Escribe **tests** con fixtures locales (red mockeada). Considera lanzar `lyrics-provider-engineer`.
7. Sin API keys en el repo. Actualiza `PROGRESS.md`.

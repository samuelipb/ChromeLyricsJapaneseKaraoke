---
description: Estrategia de pruebas — Vitest (unitario) y Playwright (e2e con la extensión cargada).
globs:
  - "**/*.test.ts"
  - "**/*.spec.ts"
  - "**/tests/**"
  - "**/e2e/**"
  - "**/vitest.config.*"
  - "**/playwright.config.*"
alwaysApply: false
---

# Regla: Testing

## Herramientas
- **Vitest** para unitario (parsers, normalizadores, interpolación de tiempos, limpieza de título).
- **Playwright** para e2e con la extensión **cargada descomprimida** (persistent context con
  `--load-extension` apuntando a `.output/chrome-mv3`).

## Qué probar primero (TDD donde aporte)
- **Parsers LRC / Enhanced LRC**: casos por línea y por palabra, timestamps raros, líneas vacías.
- **Limpieza de título**: quitar `(Official Video)`, `[MV]`, `feat./ft.`, 【】「」, emojis; separar
  "Artista - Canción". Tabla de casos reales.
- **Normalización de proveedores**: cada fuente → `LyricsDoc` válido; degradación a null.
- **Interpolación por mora**: reparto proporcional correcto; suma de duraciones = duración de línea.
- **Matching por duración (±2 s)**: aceptar/rechazar candidatos.

## Convenciones
- Tests deterministas: **mockea red** (no pegues a LRCLIB en unitario). Fixtures locales de letras.
- Cada bug corregido entra con un test que lo reproduce. No bajes cobertura de los parsers.
- `npm test` debe quedar **verde** antes de cada commit (parte del Definition of Done).
- e2e mínimos por fase: que el overlay aparezca y siga la línea en un video de ejemplo.

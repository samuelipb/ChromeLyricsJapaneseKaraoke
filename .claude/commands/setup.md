---
description: Instala dependencias y prepara el entorno de desarrollo de la extensión.
allowed-tools: Bash(npm install), Bash(npm ci), Bash(node --version), Bash(npm --version), Read, Glob
---

Prepara el entorno de desarrollo:

1. Verifica `node --version` (≥ 18) y `npm --version`.
2. Si **no** existe `package.json`, estamos antes de la Fase 1: avísame y **pregunta** antes de
   inicializar WXT / instalar nada (Plan.md §12: pedir permiso para dependencias).
3. Si existe `package.json`: instala con `npm install` (o `npm ci` si hay lockfile).
4. Recuerda al usuario cómo cargar la extensión: `npm run dev` y luego en `chrome://extensions`
   activar "Modo desarrollador" → "Cargar descomprimida" → carpeta `.output/chrome-mv3`.
5. Reporta versiones y estado. No añadas dependencias nuevas sin confirmación.

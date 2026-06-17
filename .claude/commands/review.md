---
description: Revisión de calidad + seguridad del diff actual (invoca code-reviewer y security-reviewer).
allowed-tools: Bash(git status), Bash(git diff), Bash(git diff --staged), Read, Glob, Grep, Agent
---

Revisa los cambios pendientes:

1. Muestra el alcance: `git status` y `git diff` (y `git diff --staged`).
2. Lanza el subagente **code-reviewer** sobre el diff (calidad, tipado, correctitud, rendimiento).
3. Lanza el subagente **security-reviewer** (permisos, CSP, sanitización, código remoto, secretos).
4. Consolida los hallazgos en una lista priorizada (severidad → archivo:línea → arreglo sugerido).

No apliques cambios automáticamente: primero preséntame los hallazgos. Enfócate en lo que toca
`$ARGUMENTS` si te paso una ruta o tema.

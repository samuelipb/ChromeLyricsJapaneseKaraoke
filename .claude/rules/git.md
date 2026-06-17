---
description: Flujo Git — ramas por feature, Conventional Commits, checkpoints, tags por fase, PRs pequeños.
globs:
  - "**/*"
alwaysApply: false
---

# Regla: Git y control de versiones

## Commits
- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`, `build:`.
  Asunto en imperativo y conciso. Cuerpo opcional con el porqué.
- **Commits pequeños** y frecuentes: uno al **terminar cada tarea** (es un punto de restauración).
- Co-autoría al final del mensaje cuando aplique:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.

## Checkpoints y memoria (anti-pérdida — Plan.md §2.7)
- Al **cerrar cada tarea**: actualiza `PROGRESS.md` → corre tests → **commit**. Usa `/save`.
- Al **cerrar una fase**: crea **tag** `fase-N` (`git tag fase-1`, …).
- Nunca dejes trabajo sin commitear al terminar una tarea: el repo + `PROGRESS.md` deben permitir
  retomar en frío.

## Ramas y PRs
- Rama por feature: `feat/<algo>`, `fix/<algo>`. Evita commitear directo en `main` para cambios grandes.
- PRs pequeños y revisables. Pasa `/review` (code-reviewer + security-reviewer) antes de mergear.

## Higiene
- No commitees `node_modules/`, `dist/`, `.output/`, `.env`, ni `settings.local.json` (ver `.gitignore`).
- No fuerces push ni reescribas historia compartida sin pedirlo. No `--no-verify` salvo orden explícita.
- `gh` no está instalado aún → remoto pendiente; trabaja local y crea el remoto cuando esté disponible.

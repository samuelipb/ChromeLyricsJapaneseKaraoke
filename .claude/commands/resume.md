---
description: Retomar en frío — lee PROGRESS.md + el último commit y di exactamente dónde continuar.
allowed-tools: Bash(git log:*), Bash(git status), Bash(git tag), Read
---

Sitúate para continuar el trabajo sin perder contexto (Plan.md §2.7).

Estado del repo:
- Últimos commits: !`git log --oneline -8`
- Cambios sin commitear: !`git status -s`
- Tags (fases cerradas): !`git tag`

Memoria de handoff: @PROGRESS.md

Con todo lo anterior, dime de forma concreta:
1. En qué **fase y tarea** estamos y cuál es la **PRÓXIMA TAREA** exacta.
2. Qué archivos están a medias y qué falta para cerrarlos.
3. Cómo correr/probar el proyecto ahora mismo.
4. Bloqueos o dudas abiertas que debamos resolver primero.

No empieces a programar todavía: primero confirma el plan de retoma conmigo.

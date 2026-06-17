---
description: Checkpoint — actualiza PROGRESS.md, corre tests y hace commit (anti-pérdida de avance).
allowed-tools: Bash(git add:*), Bash(git commit:*), Bash(git status), Bash(git diff), Bash(git tag:*), Bash(npm test), Read, Edit, Write
---

Crea un **checkpoint** para poder retomar en frío (Plan.md §2.7):

1. Revisa `git status` y `git diff` para resumir lo realmente cambiado.
2. **Actualiza `PROGRESS.md`**: fase/tarea actual, **última tarea hecha**, **PRÓXIMA TAREA**,
   decisiones nuevas y su porqué, estado de archivos, y bloqueos/TODOs. Añade una línea a la bitácora.
3. Si existe tooling, corre `npm test` (y typecheck) y deja constancia del resultado. No commitees roto
   salvo que yo lo pida explícitamente (en ese caso, dílo en el mensaje).
4. `git add -A` y **commit** Conventional describiendo el avance
   (`Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`).
5. Si con esto se **cierra una fase**, crea el **tag**: `git tag fase-N`.
6. Reporta el hash del commit y el próximo paso. (Remoto: `gh` no instalado aún → queda local.)

Toma `$ARGUMENTS` como nota/mensaje extra para el commit si te lo paso.

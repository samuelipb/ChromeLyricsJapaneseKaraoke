---
description: Checklist "Definition of Done" antes de commitear/cerrar una feature o fase.
allowed-tools: Bash(npm run lint), Bash(npm run typecheck), Bash(npm test), Bash(git status), Read, Grep
---

Verifica el **Definition of Done** (Plan.md §9) y reporta cada punto como ✅/❌:

1. **Tests verdes** (`npm test`) y, si aplica, e2e mínimo reproducible.
2. **Lint y typecheck limpios** (`npm run lint`, `npm run typecheck`).
3. **Sin permisos nuevos** en el manifest sin justificar (si los hay, explícalos).
4. **Seguridad**: sin código remoto/`eval`/`innerHTML` con datos externos, sin secretos. (Sugiere `/review`.)
5. **Degradación elegante**: si no hay letra, la página no se rompe.
6. **`PROGRESS.md` actualizado** (qué se hizo, decisiones, próximo paso) y demo reproducible descrita.
7. **Commit** Conventional preparado; si cierras fase, recuerda el **tag** `fase-N`.

Si algún punto falla, NO declares "listo": enumera lo que falta. Termina sugiriendo `/save`.

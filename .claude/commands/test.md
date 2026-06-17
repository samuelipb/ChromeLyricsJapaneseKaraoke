---
description: Corre lint + typecheck + tests (la verificación estándar antes de commitear).
allowed-tools: Bash(npm run lint), Bash(npm run typecheck), Bash(npm test), Bash(npm run test:e2e), Read
---

Ejecuta la verificación estándar y reporta resultados:

1. `npm run lint`
2. `npm run typecheck` (`tsc --noEmit`)
3. `npm test` (Vitest)
4. (Opcional, si lo pido) `npm run test:e2e` (Playwright)

Si algún paso falla, **muestra la salida relevante** y propón el arreglo. No marques como verde nada
que no lo esté. Si aún no existe `package.json` (pre-Fase 1), indícalo y no inventes resultados.

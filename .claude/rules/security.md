---
description: Hardening de seguridad y privacidad (Plan.md §8) — permisos, CSP, sanitización, sin código remoto.
globs:
  - "**/*"
alwaysApply: false
---

# Regla: Seguridad y privacidad (hardening — Plan.md §8)

> Aplica a TODO el código de la extensión. El subagente `security-reviewer` y el hook `guard.mjs`
> verifican estos puntos antes de cada commit grande.

## No negociable — NUNCA
- **Código remoto:** prohibido `eval`, `new Function`, `<script src="http…">`, `import()` de URL
  remota, `fetch(...).then(<ejecutar>)`. Todo el código va empaquetado y es revisable.
- **`innerHTML` / `outerHTML` / `document.write` con datos externos.** Construye el DOM por nodos
  y usa `textContent`. El `<ruby>` se arma con `createElement`.
- **Secretos en el repo:** sin API keys, tokens ni `.env` versionado (`.gitignore` + `guard.mjs`).
- **Telemetría:** ninguna. Nada de analítica ni "phone home".

## Siempre
- **Permisos mínimos** en el manifest: `*://www.youtube.com/*` + dominios de letras usados. Nunca `<all_urls>`.
- **CSP MV3** estricta: sin inline, sin eval; `connect-src` solo a los endpoints de letras.
- **Datos locales:** letras y caché solo en `chrome.storage`/IndexedDB. Lo único que sale del equipo
  son las peticiones necesarias a las fuentes de letras.
- **Dependencias fijadas (pin)** y, donde aplique, **vendorizadas**. Revisa lo que entra.
- **Fuentes "de riesgo"** (word-timing/scraping) **desactivadas por defecto (opt-in)**; no
  redistribuir letras; deja claro el alcance (uso personal/educativo).
- **Menor privilegio** en cada subagente y en cada entrypoint.

## Sanitización de entrada
- Trata título/artista/letra del DOM y de las APIs como **no confiables**: normaliza, recorta,
  escapa. Valida la forma de las respuestas (no asumas el esquema).

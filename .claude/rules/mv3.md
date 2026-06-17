---
description: Manifest V3 — manifest, permisos mínimos, service worker, content scripts, CSP, mensajería.
globs:
  - "**/wxt.config.*"
  - "**/manifest*.{json,ts}"
  - "**/entrypoints/**"
  - "**/background*"
  - "**/*.content.*"
  - "**/*content-script*"
alwaysApply: false
---

# Regla: Manifest V3

## Permisos (menor privilegio)
- `host_permissions` SOLO `*://www.youtube.com/*` + los dominios de letras realmente usados
  (p. ej. `https://lrclib.net/*`). **Nunca `<all_urls>`.**
- Pide `storage` para caché local. Evita `tabs`, `scripting` global, `webRequest` salvo
  justificación explícita (y pregunta al usuario antes de añadir cualquier permiso nuevo).
- `connect-src` (CSP) limitado a los endpoints de letras usados.

## Service worker (background)
- Efímero: no guardes estado en variables de módulo asumiendo persistencia; usa `chrome.storage`/IndexedDB.
- Orquesta: peticiones a proveedores, caché por `videoId`, mensajería con el content script.
- Sin `fetch` a scripts para ejecutarlos; sin `importScripts` remoto. Todo empaquetado.

## Content script (`youtube.com/watch`)
- Mundo aislado. No dependas de variables de la página; lee el DOM y `video.currentTime`.
- Reinicializa en navegación SPA: escucha `yt-navigate-finish`. Soporta teatro/fullscreen/miniplayer.
- Elemento de video: `document.querySelector('video.html5-main-video')`. Escucha `play`,
  `pause`, `seeking`, `seeked`, `ratechange`, `timeupdate`.
- Limpia listeners y rAF al re-inicializar (evita fugas entre videos).

## CSP / código (no negociable)
- Sin scripts inline, sin `eval`/`new Function`, **sin código remoto**. Todo el JS/WASM va empaquetado.
- El diccionario de kuromoji se **vendoriza** localmente (no se descarga en runtime).
- Inyección al DOM SIEMPRE por nodos + texto escapado; jamás `innerHTML` con datos externos.

## Mensajería
- Tipa los mensajes (`type` discriminado). Background ↔ content ↔ worker/offscreen vía
  `chrome.runtime`/`chrome.tabs.sendMessage`. Maneja errores y respuestas async correctamente.

## WXT
- WXT genera el `manifest.json`; configura permisos en `wxt.config.ts`. Entrypoints en
  `entrypoints/` (`background.ts`, `*.content.ts`, `popup/`, `options/`).

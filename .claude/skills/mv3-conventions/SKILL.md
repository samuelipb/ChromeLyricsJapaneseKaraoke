---
name: mv3-conventions
description: >
  Patrones de extensiones Chrome Manifest V3 (sin código remoto, sin inline, paso de mensajes,
  service worker efímero, permisos mínimos). Úsala al estructurar la extensión, configurar el
  manifest/WXT, o diseñar la comunicación entre background, content script y worker/offscreen.
---

# MV3 — convenciones

## Reglas duras
- **Sin código remoto** ni inline; sin `eval`/`new Function`. Todo empaquetado (CSP MV3).
- **Permisos mínimos**: `host_permissions` solo a los dominios usados; nunca `<all_urls>`.
- Recursos pesados (diccionario kuromoji) **vendorizados** en `public/`, nunca descargados en runtime.

## Componentes y responsabilidades
- **background (service worker)**: efímero, sin estado en memoria persistente → usa `chrome.storage`.
  Orquesta proveedores, caché y mensajería.
- **content script** (`/watch`): mundo aislado; lee DOM y `video.currentTime`; dibuja el overlay.
- **worker/offscreen**: tokenizador kuromoji fuera del hilo principal.
- **popup/options**: toggles y configuración.

## Paso de mensajes (tipado)
```ts
type Msg =
  | { type: 'GET_LYRICS'; query: TrackQuery }
  | { type: 'LYRICS_RESULT'; doc: LyricsDoc | null }
  | { type: 'TOKENIZE'; line: string }
  | { type: 'TOKENS'; tokens: Token[] };
// content → background:
const res: Extract<Msg, { type: 'LYRICS_RESULT' }> =
  await chrome.runtime.sendMessage({ type: 'GET_LYRICS', query });
```
- Maneja respuestas async (devuelve `true` en `onMessage` si responderás luego, o usa promesas).
- Valida `sender`/origen cuando importe. Limpia listeners al re-inicializar en navegación SPA.

## WXT
- `entrypoints/background.ts`, `entrypoints/*.content.ts`, `entrypoints/popup/`, `entrypoints/options/`.
- Permisos y `matches` en `wxt.config.ts`. Build a `.output/chrome-mv3` (carga descomprimida).

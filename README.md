# Letras JP — furigana + karaoke sobre YouTube

Extensión de Chrome (**Manifest V3**) para **aprender japonés** con la música de YouTube.
Detecta la canción de un video normal de YouTube (`youtube.com/watch`, **no** YouTube Music),
busca su letra (歌詞), le añade **furigana** sobre los kanji y la **sincroniza tipo karaoke**
con el video (resaltado "wipe" línea a línea).

> Uso **personal y educativo**. Las letras tienen copyright de sus autores; esta extensión solo
> las muestra localmente mientras ves el video, no las redistribuye.

![icono](public/icon/128.png)

## ✨ Qué hace

- **Overlay de letra** sincronizada por línea sobre el video, con resaltado **karaoke "wipe"**.
- **Furigana** sobre los kanji (análisis morfológico con kuromoji) y **romaji** opcional.
- **Búsqueda de letra robusta**: compara el título canónico de la canción contra el título del
  video (no parte "a lo bruto" el título de YouTube) y lanza varias búsquedas en paralelo.
- **Fuentes**: [LRCLIB](https://lrclib.net) (gratis, sin clave) por defecto; **NetEase**
  (music.163.com) **opt-in** para más cobertura japonesa; texto plano **interpolado** como último
  recurso.
- **Controles en el overlay**: furigana / romaji, tamaño de letra, **líneas visibles (1–3)**,
  **opacidad del fondo**, **desfase (offset) por canción**, **búsqueda manual con selección**,
  re-buscar, panel de debug.
- **Encendido/apagado** rápido desde el icono de la barra (insignia `OFF`).
- **Privacidad**: sin telemetría; la caché y las preferencias viven solo en `chrome.storage`.

## 🎛️ Controles del overlay

| Botón | Acción |
|---|---|
| **ふりがな** | Furigana on/off |
| **ローマ字** | Romaji on/off |
| **NetEase** | Activa la fuente opt-in NetEase y re-busca |
| **🔄** | Re-buscar (ignora la caché de este video) |
| **🐞** | Panel de debug (qué detecta y cómo busca) |
| **A− / A+** | Tamaño de la letra |
| **≡1/≡2/≡3** | Líneas de karaoke a la vez (activa + próximas) |
| **🌓** | Opacidad del fondo (25 → 50 → 75 → 90 %) — súbela si el video no deja leer la letra |
| **⏪ / ⏩** | Adelantar/atrasar la letra (offset por canción) |
| **✏️** | Búsqueda manual: escribe un término (o pega una URL de `lrclib.net/search/…`) y elige de la lista |
| **icono de la barra** | Encender/apagar la extensión |

## 🚀 Instalar (desarrollo)

Requiere **Node 20+**.

```bash
npm install
npm run build          # genera .output/chrome-mv3
```

Luego en Chrome: `chrome://extensions` → activa **Modo desarrollador** → **Cargar descomprimida**
→ selecciona la carpeta `.output/chrome-mv3`. Abre un `https://www.youtube.com/watch?v=…`.

Para desarrollo con recarga en caliente: `npm run dev`.

## 🧑‍💻 Desarrollo

```bash
npm run dev         # build + HMR
npm run build       # build de producción
npm test            # tests unitarios (Vitest)
npm run typecheck   # tsc --noEmit
node scripts/gen-icons.cjs   # regenera los iconos
```

- **Framework**: [WXT](https://wxt.dev) (genera el `manifest.json`, multi-navegador).
- **Tokenizador**: [`@sglkc/kuromoji`](https://github.com/sglkc/kuromoji.js) + `wanakana`, en un
  **offscreen document** (fuera del CSP de YouTube). El diccionario va **vendorizado** en
  `public/dict/`.
- **Estructura**: `entrypoints/` (background, content, offscreen) · `lib/` (`providers/`,
  `normalizer/`, `tokenizer/`, `sync/`, `model.ts`, `messaging.ts`).

## 🔒 Permisos y privacidad

- `host_permissions`: `www.youtube.com`, `lrclib.net` y `music.163.com` (esta última solo se usa
  si activas NetEase). Nunca `<all_urls>`.
- `storage` (caché de letras + preferencias) y `offscreen` (tokenizador). Sin código remoto, sin
  `innerHTML` con datos externos, sin telemetría.

## 📋 Estado

Fases 0–8 completas (ver `Plan.md` y `PROGRESS.md`): andamiaje, esqueleto MV3, detección + LRCLIB,
furigana, multi-fuente, karaoke wipe, controles (tamaño/offset/búsqueda manual/líneas/opacidad),
icono y README. Pendiente (opcional): alineación forzada offline para timing exacto por palabra
y una página de Opciones.

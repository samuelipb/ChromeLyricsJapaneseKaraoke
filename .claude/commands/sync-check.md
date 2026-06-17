---
description: Guía de prueba manual del overlay karaoke en un video de YouTube de ejemplo.
argument-hint: [url de youtube/watch opcional]
allowed-tools: Bash(npm run dev), Read
---

Prueba manual del overlay en un video real ($ARGUMENTS si me pasas una URL):

1. Asegura un build de desarrollo: `npm run dev` (genera `.output/chrome-mv3` con HMR).
2. En Chrome: `chrome://extensions` → Modo desarrollador → "Cargar descomprimida" → `.output/chrome-mv3`.
3. Abre un video `youtube.com/watch` con una canción japonesa conocida (idealmente con letra en LRCLIB).
4. Verifica el checklist y repórtame qué falla:
   - [ ] El overlay aparece y NO rompe la página.
   - [ ] Se detecta bien título/artista (limpieza de ruido correcta).
   - [ ] La **línea activa** se centra y avanza con la canción.
   - [ ] El **wipe** palabra por palabra sigue el audio (interpolado si no hay word-timing).
   - [ ] Furigana sobre los kanji; toggles furigana/romaji funcionan.
   - [ ] Seek, pausa, cambio de velocidad y navegación SPA (otro video) se comportan bien.
   - [ ] Teatro / pantalla completa / miniplayer no rompen el overlay.

Anota desajustes de tiempo y casos de detección fallida para iterar. Esto es prueba manual: no
sustituye los tests e2e.

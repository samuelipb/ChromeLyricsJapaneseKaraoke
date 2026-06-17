---
description: Motor de sincronización karaoke — tiempos línea/palabra, interpolación, render con rAF.
globs:
  - "**/sync/**"
  - "**/render/**"
  - "**/*karaoke*"
  - "**/*overlay*"
alwaysApply: false
---

# Regla: Sincronización karaoke (el corazón)

## Fuentes de timing (de mejor a peor)
1. **Tiempos por palabra** (Enhanced LRC / "A2": `[00:04.20]<00:04.20>言葉 <00:05.00>を…`) → úsalos directo.
2. **Solo por línea** → **interpola** dentro de la línea repartiendo el tiempo proporcional al
   **número de mora/caracteres** de cada token (heurística "suficientemente buena").
3. **Opcional (Fase 7)** → alineación forzada offline (WhisperX/aeneas/NeMo) genera Enhanced LRC
   exacto; la extensión solo **consume el resultado cacheado**. No es entrenamiento.

## Bucle de render
- Un único `requestAnimationFrame` lee `video.currentTime` cada frame.
- Localiza la **línea activa** (búsqueda por timestamp; centra y haz scroll suave).
- Aplica el resaltado **"wipe"** palabra por palabra (progreso = (t − wStart)/(wEnd − wStart), clamp 0..1).
- El wipe se hace con CSS (p. ej. `background-clip:text` + gradiente o `clip-path`/máscara), no recreando nodos.

## Estados del reproductor
- Respeta `playbackRate` (no asumas 1×), `seeking`/`seeked` (reposiciona inmediato), `pause` (congela),
  `ended`. Cancela el rAF al pausar/ocultar y reanúdalo al volver (ahorra CPU).
- Usa búsqueda O(log n) o índice incremental para la línea/palabra activa; no recorras todo cada frame.

## Robustez
- Si faltan tiempos, degrada a interpolación; si no hay nada, oculta el overlay sin romper la página.
- Tolera desfases pequeños; ofrece (más adelante) un ajuste de offset global por canción.

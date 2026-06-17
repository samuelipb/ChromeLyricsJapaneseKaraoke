---
name: provider-normalization
description: >
  Mapear cada fuente de letras (timedtext de YouTube, LRCLIB, word-timing, texto plano) al modelo
  interno único LyricsDoc/Line/Word. Úsala al añadir o normalizar un proveedor y al decidir el nivel
  de degradación de timing.
---

# Normalización de proveedores → modelo interno

## Modelo destino (único)
```ts
type Word = { tStart: number; tEnd: number; surface: string; reading?: string; tokens?: Token[] };
type Line = { tStart: number; tEnd: number; words: Word[] };
type LyricsDoc = { source: string; hasWordTiming: boolean; lines: Line[] };
```
Reglas comunes: tiempos en **segundos**; ordena líneas por `tStart`; `tEnd` de línea = `tStart` de la
siguiente si la fuente no lo da; recorta espacios; descarta líneas vacías.

## Por fuente
- **YouTube `timedtext`** (captions JP): cada cue → una `Line` con su `tStart/tEnd`; `words` = la línea
  completa (sin word-timing). `hasWordTiming:false`, `source:"yt-timedtext"`.
- **LRCLIB**: campo `syncedLyrics` (LRC) → parsea con `lrc-elrc-parsing`. `hasWordTiming:false`,
  `source:"lrclib"`. (Tiene `plainLyrics` como fallback.)
- **Word-timing (Enhanced LRC / "yrc")**: parsea marcas `<..>` → `words` reales.
  `hasWordTiming:true`, `source:"<id>"`. **Opt-in.**
- **Texto plano**: una `Line` por renglón, sin tiempos → se interpola todo después.
  `hasWordTiming:false`, `source:"plain"`.

## Degradación y selección
- Orden de preferencia: word-timing > línea > plano. El primero que devuelva algo válido gana, según la
  prioridad configurada en Options.
- Si `hasWordTiming:false`, el motor de sync interpolará por mora (ver skill `karaoke-rendering`).
- Valida la forma de cada respuesta antes de mapear; si no cumple, devuelve `null` (no rompas la cadena).

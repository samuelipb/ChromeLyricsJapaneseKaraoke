---
description: Contrato de proveedores de letras, cadena con prioridad y normalización al modelo interno.
globs:
  - "**/providers/**"
  - "**/normalizer/**"
  - "**/lib/providers*"
alwaysApply: false
---

# Regla: Proveedores de letras

## Contrato de proveedor
Cada fuente implementa la MISMA interfaz y normaliza su salida al modelo interno único:
```ts
interface LyricsProvider {
  id: string;                 // "lrclib", "yt-timedtext", "plain", …
  enabledByDefault: boolean;  // fuentes "de riesgo" → false (opt-in)
  fetch(query: TrackQuery): Promise<LyricsDoc | null>;  // null = no encontró
}
type TrackQuery = { title: string; artist?: string; durationSec?: number; videoId: string; lang?: string };
```

## Modelo interno único (normaliza TODO a esto)
```ts
type Word = { tStart: number; tEnd: number; surface: string; reading?: string; tokens?: Token[] };
type Line = { tStart: number; tEnd: number; words: Word[] };
type LyricsDoc = { source: string; hasWordTiming: boolean; lines: Line[] };
```

## Cadena con prioridad (configurable en Options)
1. **Subtítulos nativos de YouTube** (`timedtext`) si hay captions JP → sincronizados por línea.
2. **LRCLIB** (`lrclib.net`, gratis, sin API key, MIT) → LRC por línea. Casar por
   título + artista + **duración (±2 s)**.
3. **Fuentes con tiempos por palabra** (Enhanced LRC / "yrc") → mejor karaoke. **Opt-in** (ver nota legal).
4. **Texto plano** (último recurso) → se interpolan tiempos.

## Degradación elegante
`palabra → línea → texto plano (interpolado) → nada`. Si no hay letra, **no rompas la página**.

## Reglas
- Tiempos en **segundos** (number), no strings. Normaliza unidades al parsear.
- Caché por `videoId` (+ hash de la query) en `chrome.storage`/IndexedDB. No re-pegar por video.
- `connect-src` y `host_permissions` deben incluir cada endpoint que uses (coordinar con `mv3.md`).
- **Nota legal/ToS:** uso personal/educativo; letras con copyright. Fuentes de riesgo **off por
  defecto**, no redistribuir letras, sin API keys en el repo. Deja claro al usuario el alcance.

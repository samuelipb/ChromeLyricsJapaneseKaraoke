---
name: karaoke-rendering
description: >
  Sincronizar el overlay con video.currentTime: bucle requestAnimationFrame, línea activa centrada,
  resaltado "wipe" palabra por palabra, auto-scroll e interpolación de tiempos por mora. Úsala al
  construir o pulir el render del karaoke y al manejar seek/pausa/playbackRate.
---

# Render karaoke

## Interpolación por mora (cuando solo hay tiempo por línea)
Reparte la duración de la línea entre sus palabras según su "peso" (mora ≈ longitud de la lectura kana;
si no hay lectura, usa caracteres):
```ts
function interpolate(line: Line): Line {
  const total = line.tEnd - line.tStart;
  const weights = line.words.map((w) => Math.max(1, moraCount(w.reading ?? w.surface)));
  const sum = weights.reduce((a, b) => a + b, 0);
  let t = line.tStart;
  const words = line.words.map((w, i) => {
    const dur = (total * weights[i]) / sum;
    const out = { ...w, tStart: t, tEnd: t + dur };
    t += dur;
    return out;
  });
  return { ...line, words };
}
```
`moraCount` cuenta moras (cuida sokuon っ y yōon ゃゅょ pequeñas; aproxima por kana si hace falta).

## Bucle de render (rAF)
```ts
function frame() {
  const t = video.currentTime;
  const li = findActiveLine(t);     // O(log n) o índice incremental
  centerLine(li);                   // scroll suave
  for (const w of lines[li].words) {
    const p = clamp01((t - w.tStart) / (w.tEnd - w.tStart));
    setWipe(wordEl(w), p);          // 0..1
  }
  raf = requestAnimationFrame(frame);
}
```
- **Wipe por CSS** (no recrear nodos): `--p` como variable y `background: linear-gradient(...)` con
  `background-clip:text`, o `clip-path: inset(0 calc((1 - var(--p))*100%) 0 0)` sobre una capa "cantada".

## Estados del reproductor
- `play`→arranca rAF; `pause`/`ended`→`cancelAnimationFrame` y congela; `seeked`→reposiciona ya;
  `ratechange`→nada extra (se usa `currentTime`, que ya refleja la tasa).
- Cancela el rAF cuando la pestaña/overlay no es visible (Page Visibility) para ahorrar CPU.

## Auto-scroll y accesibilidad
- Centra la línea activa con desplazamiento suave; no robes el scroll del usuario si interactúa.
- Buen contraste; respeta `prefers-reduced-motion` (reduce animaciones del wipe/scroll).

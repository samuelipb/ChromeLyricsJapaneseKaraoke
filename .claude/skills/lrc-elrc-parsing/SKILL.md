---
name: lrc-elrc-parsing
description: >
  Parsear LRC (sincronizado por línea) y Enhanced LRC / formato "A2" (sincronizado por palabra,
  [mm:ss.xx]<mm:ss.xx>palabra). Úsala al implementar o depurar parsers de letras y al convertir
  timestamps a segundos para el modelo interno.
---

# Parsing de LRC y Enhanced LRC ("A2")

## LRC por línea
Formato: `[mm:ss.xx] texto de la línea`. Puede haber **múltiples timestamps** para la misma línea.
Tags de metadatos: `[ti:]`, `[ar:]`, `[al:]`, `[length:]`, `[offset:]` (ms; ajusta todos los tiempos).
```
[00:12.34]最初の行
[00:15.00]次の行
```
Parseo: por línea, extrae todos los `[mm:ss.xx]`, convierte a segundos, asocia el texto restante.

## Enhanced LRC / "A2" (por palabra)
La línea empieza con su timestamp y lleva marcas `<mm:ss.xx>` **antes de cada palabra**:
```
[00:04.20]<00:04.20>言葉 <00:05.00>を <00:05.60>探して
```
- El `[..]` inicial = inicio de línea. Cada `<..>` = inicio de esa palabra.
- `tEnd` de una palabra = `tStart` de la siguiente; la última hereda el fin de línea (o el inicio de la
  línea siguiente).

## Conversión de timestamp → segundos
```ts
// "mm:ss.xx" o "mm:ss.xxx" → number (segundos)
function toSec(ts: string): number {
  const m = ts.match(/(\d+):(\d+)(?:[.:](\d+))?/);
  if (!m) return NaN;
  const min = +m[1], sec = +m[2], frac = m[3] ? +`0.${m[3]}` : 0;
  return min * 60 + sec + frac;
}
```

## Salida → modelo interno
- LRC por línea → `Line{tStart, tEnd, words:[{tStart,tEnd,surface}]}` con `hasWordTiming:false`
  (una "word" = la línea entera, o se interpola después).
- Enhanced LRC → `words[]` con tiempos reales y `hasWordTiming:true`.
- Aplica `[offset:]` a todos los tiempos. Ignora líneas vacías; ordena por `tStart`.

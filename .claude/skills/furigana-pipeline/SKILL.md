---
name: furigana-pipeline
description: >
  Pipeline de texto japonés → tokens (kuromoji) → lectura → furigana con <ruby> y romaji opcional.
  Úsala al implementar tokenización, generar furigana de forma segura (nodos del DOM, no innerHTML),
  cargar el diccionario perezosamente o cachear lecturas por línea.
---

# Pipeline de furigana

## Flujo
`texto` → **kuromoji** (tokens + `reading` en katakana) → convertir lectura a hiragana →
construir `<ruby>` solo sobre tokens con kanji → (opcional) romaji con wanakana.

## Tokenización (kuromoji)
- Cada token trae `surface_form`, `reading` (katakana), `pos`, etc. Lectura ausente → trátala como sin furigana.
- Vendoriza el diccionario (`*.dat.gz`) en `public/dict/`; inicializa una sola vez (perezoso) en el worker.

## Construir <ruby> de forma SEGURA (sin innerHTML)
```ts
function rubyNode(surface: string, reading?: string): Node {
  if (!reading || !hasKanji(surface)) return document.createTextNode(surface);
  const ruby = document.createElement('ruby');
  ruby.appendChild(document.createTextNode(surface));
  const rt = document.createElement('rt');
  rt.textContent = toHiragana(reading); // wanakana
  ruby.appendChild(rt);
  return ruby;
}
const hasKanji = (s: string) => /[一-龯㐀-䶿]/.test(s);
```
- `hasKanji` detecta CJK; kana puro y latino → sin `<rt>`.
- Para okurigana, idealmente la lectura cubre solo la parte kanji (kuroshiro modo okurigana).

## Romaji (opcional)
- `wanakana.toRomaji(hiragana)`. Cuida partículas は→wa, へ→e, を→o si conviertes lectura cruda.

## Caché y rendimiento
- Cachea por **línea** (clave = texto). Tokeniza en worker/offscreen; nunca bloquees el hilo principal.
- Toggles furigana/romaji independientes; recalcula el render, no la tokenización (reusa caché).

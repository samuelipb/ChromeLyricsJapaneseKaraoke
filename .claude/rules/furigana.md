---
description: Tokenización japonesa (kuromoji), lecturas y construcción de furigana con <ruby>.
globs:
  - "**/tokenizer/**"
  - "**/furigana/**"
  - "**/*ruby*"
  - "**/*kuromoji*"
  - "**/*kuroshiro*"
alwaysApply: false
---

# Regla: Furigana y tokenización

## Librerías
- **kuromoji.js** para análisis morfológico (形態素解析). **Vendoriza el diccionario** (`*.dat.gz`)
  bajo `public/`; MV3 prohíbe recursos remotos. Carga el diccionario de forma **perezosa**.
- **kuroshiro** + `kuroshiro-analyzer-kuromoji` para lectura → furigana (modo furigana/okurigana).
- **wanakana** para utilidades kana ↔ romaji.

## Dónde corre
- El tokenizador va en un **worker / offscreen document**, NO en el hilo principal (el diccionario
  es pesado). El content script pide tokenización por mensaje y recibe el resultado.

## Construcción de <ruby> (seguridad)
- Genera `<ruby>漢字<rt>かんじ</rt></ruby>` **creando nodos del DOM** (`document.createElement`,
  `textContent`). **Nunca `innerHTML`** con datos externos.
- Escapa/normaliza todo texto. Solo pon `<rt>` sobre tokens que contienen kanji; kana queda sin ruby.
- Respeta okurigana: la lectura cubre solo la parte en kanji cuando aplica.

## Toggles y caché
- Furigana on/off y romaji on/off (independientes).
- **Cachea la tokenización por línea** (clave: texto de la línea) para no re-tokenizar en cada seek.

## Calidad
- Maneja lecturas ambiguas con la salida de kuromoji; no inventes lecturas.
- Números, latín y símbolos: sin furigana. Cuida partículas (は→wa, へ→e) si generas romaji.

import { describe, it, expect } from 'vitest';
import { normName, namesOverlap, isRelevant } from '../lib/normalizer/match';

describe('normName', () => {
  it('normaliza espacios, puntuación y mayúsculas', () => {
    expect(normName('  YOASOBI  ')).toBe('yoasobi');
    expect(normName('米津玄師 - Lemon')).toBe('米津玄師lemon');
  });
});

describe('namesOverlap', () => {
  it('coincide por inclusión en cualquier dirección', () => {
    expect(namesOverlap('YOASOBI', 'yoasobi')).toBe(true);
    expect(namesOverlap('Ayase / YOASOBI', 'YOASOBI')).toBe(true);
    expect(namesOverlap('YOASOBI feat. X', 'YOASOBI')).toBe(true);
  });
  it('no coincide entre artistas distintos', () => {
    expect(namesOverlap('米津玄師', '某中文歌手')).toBe(false);
    expect(namesOverlap('', 'x')).toBe(false);
  });
});

describe('isRelevant (artista O título)', () => {
  it('relevante si coincide el artista (aunque el título no)', () => {
    expect(isRelevant('Ano yume wo nazotte', 'YOASOBI', 'あの夢をなぞって', 'YOASOBI')).toBe(true);
  });
  it('relevante si coincide el título (aunque el artista esté en otro script)', () => {
    expect(isRelevant('Black Catcher', 'Vickeblanka', 'Black Catcher', 'ビッケブランカ')).toBe(true);
  });
  it('NO relevante si no coincide ni artista ni título (canción equivocada)', () => {
    expect(isRelevant('某中文歌', '某歌手', 'Black Catcher', 'ビッケブランカ')).toBe(false);
  });
});

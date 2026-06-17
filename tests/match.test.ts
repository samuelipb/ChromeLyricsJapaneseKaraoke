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

describe('isRelevant', () => {
  it('con artista conocido, filtra por artista', () => {
    expect(isRelevant('cualquier título', 'YOASOBI', 'tema', 'YOASOBI')).toBe(true);
    expect(isRelevant('cualquier título', 'Otro', 'tema', 'YOASOBI')).toBe(false);
  });
  it('sin artista, filtra por título', () => {
    expect(isRelevant('群青', undefined, '群青')).toBe(true);
    expect(isRelevant('OtraCanción', undefined, '群青')).toBe(false);
  });
});

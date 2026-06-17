import { describe, it, expect } from 'vitest';
import { moraCount, interpolatePlainLines } from '../lib/normalizer/interpolate';

describe('moraCount', () => {
  it('cuenta kana plenos', () => {
    expect(moraCount('ことば')).toBe(3);
  });
  it('kana pequeño combinante no añade mora (きょう = 2)', () => {
    expect(moraCount('きょう')).toBe(2);
  });
  it('sokuon っ y chōonpu ー sí cuentan', () => {
    expect(moraCount('きって')).toBe(3); // き っ て
    expect(moraCount('カー')).toBe(2); // カ ー
  });
  it('ignora espacios', () => {
    expect(moraCount('あ あ')).toBe(2);
  });
});

describe('interpolatePlainLines', () => {
  it('reparte la duración proporcional a la mora y cubre [0, duration]', () => {
    const doc = interpolatePlainLines(['あ', 'あああ'], 8, 'lrclib-plain');
    expect(doc.hasWordTiming).toBe(false);
    expect(doc.lines).toHaveLength(2);
    // pesos 1 y 3 → total 4 → líneas en [0,2] y [2,8]
    expect(doc.lines[0]).toMatchObject({ tStart: 0, tEnd: 2 });
    expect(doc.lines[1]).toMatchObject({ tStart: 2, tEnd: 8 });
    expect(doc.lines[1]!.words[0]!.surface).toBe('あああ');
  });

  it('descarta líneas vacías', () => {
    const doc = interpolatePlainLines(['a', '', '  ', 'b'], 10, 's');
    expect(doc.lines).toHaveLength(2);
  });

  it('sin duración válida → doc vacío', () => {
    expect(interpolatePlainLines(['a'], 0, 's').lines).toHaveLength(0);
    expect(interpolatePlainLines([], 10, 's').lines).toHaveLength(0);
  });

  it('la última línea termina exactamente en la duración', () => {
    const doc = interpolatePlainLines(['aa', 'bbbb', 'c'], 30, 's');
    expect(doc.lines.at(-1)!.tEnd).toBeCloseTo(30, 6);
    expect(doc.lines[0]!.tStart).toBe(0);
  });
});

import { describe, it, expect } from 'vitest';
import { parseLrc, lrcToDoc } from '../lib/providers/lrc';
import { lineText } from '../lib/model';

describe('parseLrc', () => {
  it('parsea timestamps básicos a segundos', () => {
    const e = parseLrc('[00:04.20]言葉を\n[00:05.00]歌う');
    expect(e).toEqual([
      { tStart: 4.2, text: '言葉を' },
      { tStart: 5.0, text: '歌う' },
    ]);
  });

  it('normaliza centésimas y milésimas', () => {
    expect(parseLrc('[01:02.5]a')[0]!.tStart).toBeCloseTo(62.5, 5);
    expect(parseLrc('[01:02.50]a')[0]!.tStart).toBeCloseTo(62.5, 5);
    expect(parseLrc('[01:02.500]a')[0]!.tStart).toBeCloseTo(62.5, 5);
    expect(parseLrc('[00:10]a')[0]!.tStart).toBe(10);
  });

  it('soporta múltiples timestamps en una línea (estribillo)', () => {
    const e = parseLrc('[00:10.00][00:20.00]サビ');
    expect(e).toEqual([
      { tStart: 10, text: 'サビ' },
      { tStart: 20, text: 'サビ' },
    ]);
  });

  it('ignora metadatos y líneas sin timestamp', () => {
    const e = parseLrc('[ar:Artista]\n[ti:Título]\ntexto suelto\n[00:01.00]ok');
    expect(e).toEqual([{ tStart: 1, text: 'ok' }]);
  });

  it('ordena por tiempo aunque vengan desordenadas', () => {
    const e = parseLrc('[00:05.00]b\n[00:01.00]a');
    expect(e.map((x) => x.text)).toEqual(['a', 'b']);
  });

  it('conserva líneas vacías con timestamp (silencios)', () => {
    const e = parseLrc('[00:01.00]a\n[00:03.00]\n[00:04.00]b');
    expect(e).toEqual([
      { tStart: 1, text: 'a' },
      { tStart: 3, text: '' },
      { tStart: 4, text: 'b' },
    ]);
  });
});

describe('lrcToDoc', () => {
  it('asigna tEnd = inicio de la siguiente y descarta silencios', () => {
    const doc = lrcToDoc(parseLrc('[00:01.00]a\n[00:03.00]\n[00:04.00]b'), 'lrclib', 10);
    expect(doc.hasWordTiming).toBe(false);
    expect(doc.lines).toHaveLength(2);
    expect(doc.lines[0]).toMatchObject({ tStart: 1, tEnd: 3 });
    // 'a' termina cuando empieza el silencio (3), no en 'b' (4).
    expect(doc.lines[1]).toMatchObject({ tStart: 4, tEnd: 10 });
    expect(lineText(doc.lines[0]!)).toBe('a');
  });

  it('usa durationSec para el tEnd de la última línea', () => {
    const doc = lrcToDoc(parseLrc('[00:01.00]solo'), 'lrclib', 42);
    expect(doc.lines[0]!.tEnd).toBe(42);
  });
});

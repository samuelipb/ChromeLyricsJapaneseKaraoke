import { describe, it, expect } from 'vitest';
import { cleanTitle, parseTrack, cleanChannel } from '../lib/normalizer/title';

describe('cleanTitle', () => {
  const cases: Array<[string, string]> = [
    ['YOASOBI - 群青 (Official Music Video)', 'YOASOBI - 群青'],
    ['Lisa『紅蓮華』Music Video', 'Lisa『紅蓮華』'],
    ['米津玄師 - Lemon [MV]', '米津玄師 - Lemon'],
    ['Ado / 新時代 (ウタ from ONE PIECE FILM RED)', 'Ado / 新時代 (ウタ from ONE PIECE FILM RED)'],
    ['King Gnu - 白日【Official Video】', 'King Gnu - 白日'],
    // 【…】 anotaciones (programa/歌唱曲) siempre fuera + sufijo ：MUSIC VIDEO
    ['【第75回NHK紅白歌合戦 歌唱曲】踊り子 / Vaundy：MUSIC VIDEO', '踊り子 / Vaundy'],
    ['Song feat. Someone', 'Song'],
    ['Song ft. Other Artist', 'Song'],
    ['歌手 - 曲名 (歌詞付き)', '歌手 - 曲名'],
  ];
  for (const [input, expected] of cases) {
    it(`limpia: ${input}`, () => {
      expect(cleanTitle(input)).toBe(expected);
    });
  }

  it('no destruye paréntesis que no son ruido', () => {
    expect(cleanTitle('Title (Acoustic)')).toBe('Title (Acoustic)');
  });
});

describe('parseTrack', () => {
  it('separa "Artista - Canción"', () => {
    expect(parseTrack('YOASOBI - 群青 (Official Music Video)')).toEqual({
      artist: 'YOASOBI',
      title: '群青',
    });
  });

  it('usa el canal como artista si no hay separador', () => {
    expect(parseTrack('群青', 'YOASOBI - Topic')).toEqual({
      artist: 'YOASOBI',
      title: '群青',
    });
  });

  it('devuelve solo título cuando no hay artista ni canal', () => {
    expect(parseTrack('群青')).toEqual({ title: '群青' });
  });

  it('soporta en-dash y em-dash como separador', () => {
    expect(parseTrack('Artist – Song')).toEqual({ artist: 'Artist', title: 'Song' });
    expect(parseTrack('Artist — Song')).toEqual({ artist: 'Artist', title: 'Song' });
  });

  it('extrae título japonés entre 『』 (artista delante)', () => {
    expect(parseTrack('Lisa『紅蓮華』Music Video')).toEqual({ artist: 'Lisa', title: '紅蓮華' });
  });
});

describe('cleanChannel', () => {
  it('quita "- Topic"', () => {
    expect(cleanChannel('YOASOBI - Topic')).toBe('YOASOBI');
  });
  it('quita VEVO', () => {
    expect(cleanChannel('LadyGagaVEVO')).toBe('LadyGaga');
  });
});

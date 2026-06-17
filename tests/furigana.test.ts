import { describe, it, expect } from 'vitest';
import { buildRuby, tokensToRuby, tokensToRomaji, type KToken } from '../lib/tokenizer/furigana';

describe('buildRuby (okurigana-aware)', () => {
  it('kanji puro: lectura completa', () => {
    expect(buildRuby('言葉', 'ことば')).toEqual([{ text: '言葉', rt: 'ことば' }]);
  });

  it('pela okurigana de cola: 食べる → 食 + べる', () => {
    expect(buildRuby('食べる', 'たべる')).toEqual([
      { text: '食', rt: 'た' },
      { text: 'べる' },
    ]);
  });

  it('pela prefijo kana: お正月 → お + 正月', () => {
    expect(buildRuby('お正月', 'おしょうがつ')).toEqual([
      { text: 'お' },
      { text: '正月', rt: 'しょうがつ' },
    ]);
  });

  it('kana puro: sin ruby', () => {
    expect(buildRuby('から', 'から')).toEqual([{ text: 'から' }]);
  });

  it('sin lectura: sin ruby', () => {
    expect(buildRuby('Lemon')).toEqual([{ text: 'Lemon' }]);
  });

  it('acepta lectura en katakana (la normaliza a hiragana)', () => {
    expect(buildRuby('歌', 'ウタ')).toEqual([{ text: '歌', rt: 'うた' }]);
  });

  it('cola e inicio kana a la vez', () => {
    expect(buildRuby('御見送り', 'おみおくり')).toEqual([
      { text: '御見送', rt: 'おみおく' },
      { text: 'り' },
    ]);
  });
});

describe('tokensToRuby', () => {
  it('concatena segmentos de varios tokens', () => {
    const tokens: KToken[] = [
      { surface: '君', reading: 'きみ' },
      { surface: 'と', reading: 'と' },
      { surface: '歩く', reading: 'あるく' },
    ];
    expect(tokensToRuby(tokens)).toEqual([
      { text: '君', rt: 'きみ' },
      { text: 'と' },
      { text: '歩', rt: 'ある' },
      { text: 'く' },
    ]);
  });
});

describe('tokensToRomaji', () => {
  it('convierte por token con espacios', () => {
    const tokens: KToken[] = [
      { surface: '言葉', reading: 'ことば' },
      { surface: 'を', reading: 'を', pos: '助詞' },
    ];
    expect(tokensToRomaji(tokens)).toBe('kotoba wo');
  });

  it('corrige partículas は→wa y へ→e', () => {
    expect(tokensToRomaji([{ surface: 'は', reading: 'は', pos: '助詞' }])).toBe('wa');
    expect(tokensToRomaji([{ surface: 'へ', reading: 'へ', pos: '助詞' }])).toBe('e');
  });

  it('は como NO partícula no se corrige', () => {
    // は dentro de una palabra mantiene "ha"
    expect(tokensToRomaji([{ surface: 'はな', reading: 'はな' }])).toBe('hana');
  });
});

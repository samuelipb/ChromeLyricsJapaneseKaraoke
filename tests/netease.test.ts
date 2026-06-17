import { describe, it, expect, vi, afterEach } from 'vitest';
import { pickSong, neteaseLrcToDoc, neteaseProvider } from '../lib/providers/netease';

describe('pickSong', () => {
  it('elige por duración ms→s dentro de ±2 s y la más cercana', () => {
    const songs = [
      { id: 1, duration: 100_000 }, // 100 s (fuera)
      { id: 2, duration: 241_000 }, // 241 s
      { id: 3, duration: 239_500 }, // 239.5 s (más cercana a 239)
    ];
    expect(pickSong(songs, 239)?.id).toBe(3);
  });
  it('rechaza si ninguna duración encaja', () => {
    expect(pickSong([{ id: 1, duration: 300_000 }], 239)).toBeNull();
  });
  it('sin duración, la primera (mejor rankeada)', () => {
    expect(pickSong([{ id: 7 }, { id: 8 }])?.id).toBe(7);
  });
});

describe('neteaseLrcToDoc', () => {
  it('descarta líneas de créditos y parsea la letra', () => {
    const lrc = [
      '[00:00.000] 作词 : 米津玄師',
      '[00:00.212] 作曲 : 米津玄師',
      '[00:00.851]夢ならばどれほどよかったでしょう',
      '[00:06.650]未だにあなたのことを夢にみる',
    ].join('\n');
    const doc = neteaseLrcToDoc(lrc, 200);
    expect(doc?.source).toBe('netease');
    expect(doc?.lines).toHaveLength(2);
    expect(doc?.lines[0]!.words[0]!.surface).toBe('夢ならばどれほどよかったでしょう');
  });
  it('null si solo hay créditos', () => {
    expect(neteaseLrcToDoc('[00:00.00] 作曲 : X', 100)).toBeNull();
  });
});

describe('neteaseProvider.fetch', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('busca, casa por duración y devuelve la letra', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/search/get')) {
          return new Response(JSON.stringify({ result: { songs: [{ id: 42, duration: 241_000 }] } }), { status: 200 });
        }
        return new Response(JSON.stringify({ lrc: { lyric: '[00:01.00]あ\n[00:03.00]い' } }), { status: 200 });
      }),
    );
    const doc = await neteaseProvider.fetch({ title: 'x', artist: 'y', durationSec: 241, videoId: 'v' });
    expect(doc?.source).toBe('netease');
    expect(doc?.lines).toHaveLength(2);
  });
  it('es opt-in (enabledByDefault=false)', () => {
    expect(neteaseProvider.enabledByDefault).toBe(false);
  });
});

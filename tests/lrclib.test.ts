import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  pickCandidate,
  pickPlain,
  candidateToDoc,
  lrclibProvider,
  lrclibPlainProvider,
  type LrclibCandidate,
} from '../lib/providers/lrclib';

const synced = '[00:01.00]a\n[00:03.00]b';

function cand(over: Partial<LrclibCandidate>): LrclibCandidate {
  return { trackName: 't', artistName: 'a', duration: 100, syncedLyrics: synced, ...over };
}

describe('pickCandidate', () => {
  it('rechaza si no es un array', () => {
    expect(pickCandidate(null)).toBeNull();
    expect(pickCandidate({})).toBeNull();
  });

  it('ignora candidatos sin letra sincronizada o instrumentales', () => {
    const list = [cand({ syncedLyrics: null }), cand({ instrumental: true }), cand({ id: 7 })];
    expect(pickCandidate(list)?.id).toBe(7);
  });

  it('exige duración dentro de ±2 s y elige la más cercana', () => {
    const list = [cand({ id: 1, duration: 90 }), cand({ id: 2, duration: 101 }), cand({ id: 3, duration: 103 })];
    expect(pickCandidate(list, 100)?.id).toBe(2);
  });

  it('rechaza todo si ninguna duración encaja (no mostrar canción equivocada)', () => {
    const list = [cand({ duration: 80 }), cand({ duration: 120 })];
    expect(pickCandidate(list, 100)).toBeNull();
  });

  it('sin duración, toma el primero con letra sincronizada', () => {
    expect(pickCandidate([cand({ id: 5 })])?.id).toBe(5);
  });
});

describe('pickPlain', () => {
  it('elige candidato con texto plano dentro de ±2 s', () => {
    const list = [
      cand({ id: 1, syncedLyrics: null, plainLyrics: 'a\nb', duration: 101 }),
      cand({ id: 2, syncedLyrics: null, plainLyrics: null, duration: 100 }),
    ];
    expect(pickPlain(list, 100)?.id).toBe(1);
  });
  it('ignora instrumentales y rechaza si la duración no encaja', () => {
    expect(pickPlain([cand({ syncedLyrics: null, plainLyrics: 'x', duration: 130 })], 100)).toBeNull();
    expect(pickPlain([cand({ instrumental: true, plainLyrics: 'x' })])).toBeNull();
  });
});

describe('lrclibPlainProvider.fetch', () => {
  afterEach(() => vi.unstubAllGlobals());
  it('interpola el texto plano cuando no hay sincronizada', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([cand({ syncedLyrics: null, plainLyrics: 'いち\nに\nさん', duration: 30 })]), { status: 200 })),
    );
    const doc = await lrclibPlainProvider.fetch({ title: 'a', durationSec: 30, videoId: 'p1' });
    expect(doc?.source).toBe('lrclib-plain');
    expect(doc?.hasWordTiming).toBe(false);
    expect(doc?.lines).toHaveLength(3);
    expect(doc?.lines.at(-1)!.tEnd).toBeCloseTo(30, 6);
  });
});

describe('candidateToDoc', () => {
  it('normaliza al modelo interno', () => {
    const doc = candidateToDoc(cand({ duration: 50 }));
    expect(doc?.source).toBe('lrclib');
    expect(doc?.hasWordTiming).toBe(false);
    expect(doc?.lines).toHaveLength(2);
  });

  it('null si la letra no parsea', () => {
    expect(candidateToDoc(cand({ syncedLyrics: 'sin timestamps' }))).toBeNull();
  });
});

describe('lrclibProvider.fetch', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('devuelve un LyricsDoc cuando hay coincidencia', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([cand({ duration: 100 })]), { status: 200 })),
    );
    const doc = await lrclibProvider.fetch({ title: 'a', artist: 'b', durationSec: 100, videoId: 'x' });
    expect(doc?.lines).toHaveLength(2);
  });

  it('null en 404', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    const doc = await lrclibProvider.fetch({ title: 'a', videoId: 'x' });
    expect(doc).toBeNull();
  });

  it('null si la red falla (degradación elegante)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const doc = await lrclibProvider.fetch({ title: 'a', videoId: 'x' });
    expect(doc).toBeNull();
  });
});

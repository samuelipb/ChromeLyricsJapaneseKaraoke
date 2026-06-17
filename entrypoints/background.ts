// Service worker (efímero): orquesta proveedores de letras y cachea por videoId.
// Ver .claude/rules/mv3.md y lyrics-providers.md. No guardar estado en variables de
// módulo asumiendo persistencia: la caché vive en chrome.storage.local.
import type { LyricsProvider, TrackQuery } from '../lib/model';
import type { ExtMessage, GetLyricsResponse } from '../lib/messaging';
import { lrclibProvider } from '../lib/providers/lrclib';

// Cadena de proveedores por prioridad (Fase 2: solo LRCLIB por línea).
const PROVIDERS: LyricsProvider[] = [lrclibProvider];

const CACHE_PREFIX = 'lyrics:';

interface CacheEntry {
  doc: GetLyricsResponse['doc'];
  source: string | null;
  ts: number;
}

async function handleGetLyrics(query: TrackQuery): Promise<GetLyricsResponse> {
  const key = CACHE_PREFIX + query.videoId;

  const stored = await browser.storage.local.get(key);
  const hit = stored[key] as CacheEntry | undefined;
  if (hit) return { doc: hit.doc, source: hit.source, cached: true };

  let doc: GetLyricsResponse['doc'] = null;
  let source: string | null = null;
  for (const provider of PROVIDERS) {
    if (!provider.enabledByDefault) continue; // fuentes de riesgo: opt-in
    try {
      const result = await provider.fetch(query);
      if (result) {
        doc = result;
        source = provider.id;
        break;
      }
    } catch {
      // Un proveedor que falla no debe tumbar la cadena.
    }
  }

  // Cachea también el "no encontrado" (doc=null) para no repegar cada vez.
  const entry: CacheEntry = { doc, source, ts: Date.now() };
  await browser.storage.local.set({ [key]: entry });
  return { doc, source, cached: false };
}

export default defineBackground(() => {
  console.log('[letras-jp] service worker listo');

  // El polyfill `browser` envía la respuesta cuando el listener devuelve una Promise.
  browser.runtime.onMessage.addListener((msg: ExtMessage): Promise<GetLyricsResponse> | undefined => {
    if (msg?.type === 'GET_LYRICS') {
      return handleGetLyrics(msg.query).catch(
        () => ({ doc: null, source: null, cached: false } satisfies GetLyricsResponse),
      );
    }
    return undefined;
  });
});

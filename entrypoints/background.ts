// Service worker (efímero): orquesta proveedores de letras, cachea por videoId y hace de
// relé hacia el offscreen document para la tokenización (kuromoji). Ver rules/mv3.md.
import type { LyricsProvider, TrackQuery } from '../lib/model';
import type {
  ExtMessage,
  GetLyricsResponse,
  OffscreenTokenizeMessage,
  TokenizeResponse,
} from '../lib/messaging';
import { lrclibProvider } from '../lib/providers/lrclib';

// Cadena de proveedores por prioridad (Fase 2: solo LRCLIB por línea).
const PROVIDERS: LyricsProvider[] = [lrclibProvider];

const CACHE_PREFIX = 'lyrics:';
const OFFSCREEN_URL = 'offscreen.html';

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

  const entry: CacheEntry = { doc, source, ts: Date.now() };
  await browser.storage.local.set({ [key]: entry });
  return { doc, source, cached: false };
}

// --- Offscreen (tokenizador kuromoji) -------------------------------------
let creatingOffscreen: Promise<void> | null = null;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  if (creatingOffscreen) return creatingOffscreen;
  console.log('[letras-jp] background: creando offscreen document');
  creatingOffscreen = chrome.offscreen
    .createDocument({
      url: OFFSCREEN_URL,
      reasons: ['DOM_PARSER'],
      justification: 'Análisis morfológico japonés (kuromoji) para generar furigana.',
    })
    .catch(() => {
      // Si ya existía por una carrera, no es error.
    })
    .finally(() => {
      creatingOffscreen = null;
    });
  return creatingOffscreen;
}

function isNoReceiver(msg: string): boolean {
  return /Receiving end does not exist|Could not establish connection/i.test(msg);
}

async function handleTokenize(text: string): Promise<TokenizeResponse> {
  try {
    await ensureOffscreen();
    const relay: OffscreenTokenizeMessage = { target: 'offscreen', type: 'TOKENIZE', text };
    // El offscreen puede tardar en registrar su listener tras createDocument:
    // reintentamos el relé mientras "no hay receptor".
    let lastErr = '';
    for (let i = 0; i < 40; i++) {
      try {
        const res = (await browser.runtime.sendMessage(relay)) as TokenizeResponse | undefined;
        return res ?? { tokens: null, error: 'sin respuesta del offscreen' };
      } catch (e) {
        lastErr = e instanceof Error ? e.message : String(e);
        if (!isNoReceiver(lastErr)) throw e;
        await delay(150); // espera a que el offscreen esté escuchando
      }
    }
    return { tokens: null, error: lastErr || 'el offscreen no respondió' };
  } catch (e) {
    return { tokens: null, error: e instanceof Error ? e.message : String(e) };
  }
}

export default defineBackground(() => {
  console.log('[letras-jp] service worker listo');

  browser.runtime.onMessage.addListener(
    (message: ExtMessage): Promise<GetLyricsResponse | TokenizeResponse> | undefined => {
      if (message?.type === 'GET_LYRICS') {
        return handleGetLyrics(message.query).catch(
          () => ({ doc: null, source: null, cached: false }) satisfies GetLyricsResponse,
        );
      }
      if (message?.type === 'TOKENIZE') {
        return handleTokenize(message.text);
      }
      return undefined;
    },
  );
});

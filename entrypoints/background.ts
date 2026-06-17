// Service worker (efímero): orquesta proveedores de letras, cachea por videoId y hace de
// relé hacia el offscreen document para la tokenización (kuromoji). Ver rules/mv3.md.
import type { LyricsProvider, TrackQuery } from '../lib/model';
import type {
  ExtMessage,
  GetLyricsResponse,
  OffscreenTokenizeMessage,
  TokenizeResponse,
} from '../lib/messaging';
import type { ManualCandidate, SearchManualResponse } from '../lib/messaging';
import { lrclibGetById, lrclibManualSearch, lrclibPlainProvider, lrclibProvider } from '../lib/providers/lrclib';
import { neteaseGetById, neteaseManualSearch, neteaseProvider } from '../lib/providers/netease';

// Cadena de proveedores POR PRIORIDAD. NetEase (opt-in) se intercala entre la
// sincronizada de LRCLIB y el texto plano, solo si el usuario lo activó en ajustes.
async function getProviders(): Promise<LyricsProvider[]> {
  const chain: LyricsProvider[] = [lrclibProvider];
  let extraSources = false;
  try {
    const got = await browser.storage.local.get('settings');
    extraSources = (got.settings as { extraSources?: boolean } | undefined)?.extraSources === true;
  } catch {
    /* usa por defecto */
  }
  if (extraSources) chain.push(neteaseProvider);
  chain.push(lrclibPlainProvider);
  return chain;
}

// v2: invalida cachés viejas (antes se guardaban "no encontrado" que enmascaraban
// mejoras del matching). Súbelo si cambia el esquema o la lógica de proveedores.
const CACHE_PREFIX = 'lyrics:v2:';
const OFFSCREEN_URL = 'offscreen.html';
const ENABLED_KEY = 'enabled';

// --- Encendido/apagado por el icono de la barra --------------------------
async function isEnabled(): Promise<boolean> {
  const got = await browser.storage.local.get(ENABLED_KEY);
  return got[ENABLED_KEY] !== false; // por defecto: activado
}

async function reflectBadge(enabled: boolean): Promise<void> {
  try {
    await browser.action.setBadgeText({ text: enabled ? '' : 'OFF' });
    await browser.action.setBadgeBackgroundColor({ color: '#888888' });
    await browser.action.setTitle({ title: enabled ? 'Letras JP: activado (clic para desactivar)' : 'Letras JP: desactivado (clic para activar)' });
  } catch {
    /* el icono puede no estar listo en algunos contextos */
  }
}

interface CacheEntry {
  doc: GetLyricsResponse['doc'];
  source: string | null;
  ts: number;
}

async function handleGetLyrics(query: TrackQuery, force = false): Promise<GetLyricsResponse> {
  const key = CACHE_PREFIX + query.videoId;
  const debug: string[] = [];
  const t0 = Date.now();
  debug.push(
    `query: "${query.title}"${query.artist ? ` — ${query.artist}` : ' (sin artista)'}` +
      `${query.durationSec ? ` · ${Math.round(query.durationSec)}s` : ''}`,
  );

  if (force) {
    await browser.storage.local.remove(key); // "borrar caché de esta canción"
    debug.push('caché: borrada (re-buscar)');
  } else {
    const stored = await browser.storage.local.get(key);
    const hit = stored[key] as CacheEntry | undefined;
    // Solo usamos la caché POSITIVA: un "no encontrado" nunca se cachea ni se reutiliza.
    if (hit && hit.doc) {
      debug.push(`caché: HIT (${hit.source}, ${hit.doc.lines.length} líneas)`);
      return { doc: hit.doc, source: hit.source, cached: true, debug };
    }
    debug.push('caché: miss');
  }

  let doc: GetLyricsResponse['doc'] = null;
  let source: string | null = null;
  const providers = await getProviders();
  debug.push(`cadena: ${providers.map((p) => p.id).join(' → ')}`);
  for (const provider of providers) {
    const ts = Date.now();
    try {
      const result = await provider.fetch(query);
      if (result) {
        debug.push(`${provider.id}: ✓ ${result.lines.length} líneas (${Date.now() - ts}ms)`);
        doc = result;
        source = provider.id;
        break;
      }
      debug.push(`${provider.id}: sin resultado (${Date.now() - ts}ms)`);
    } catch (e) {
      debug.push(`${provider.id}: error ${e instanceof Error ? e.message : e} (${Date.now() - ts}ms)`);
    }
  }

  // Solo cacheamos resultados POSITIVOS (no enmascarar mejoras futuras del matching).
  if (doc) {
    const entry: CacheEntry = { doc, source, ts: Date.now() };
    await browser.storage.local.set({ [key]: entry });
  }
  debug.push(`total: ${Date.now() - t0}ms → ${source ?? 'SIN LETRA'}`);
  return { doc, source, cached: false, debug };
}

// --- Offscreen (tokenizador kuromoji) -------------------------------------
let creatingOffscreen: Promise<void> | null = null;

const delay = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return;
  if (!creatingOffscreen) {
    console.log('[letras-jp] background: creando offscreen document');
    creatingOffscreen = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_URL,
        reasons: ['DOM_PARSER'],
        justification: 'Análisis morfológico japonés (kuromoji) para generar furigana.',
      })
      .then(() => console.log('[letras-jp] background: offscreen creado'))
      .catch((e: unknown) => {
        const m = e instanceof Error ? e.message : String(e);
        if (/single offscreen document/i.test(m)) return; // ya existía (carrera): OK
        console.error('[letras-jp] background: createDocument falló:', m);
        throw new Error('createDocument: ' + m); // NO tragar: el content lo verá
      })
      .finally(() => {
        creatingOffscreen = null;
      });
  }
  return creatingOffscreen;
}

function isNoReceiver(msg: string): boolean {
  return /Receiving end does not exist|Could not establish connection/i.test(msg);
}

async function extraSourcesEnabled(): Promise<boolean> {
  try {
    const got = await browser.storage.local.get('settings');
    return (got.settings as { extraSources?: boolean } | undefined)?.extraSources === true;
  } catch {
    return false;
  }
}

async function handleSearchManual(text: string): Promise<SearchManualResponse> {
  const candidates: ManualCandidate[] = [];
  try {
    candidates.push(...(await lrclibManualSearch(text)));
  } catch {
    /* sigue con lo que haya */
  }
  if (await extraSourcesEnabled()) {
    try {
      candidates.push(...(await neteaseManualSearch(text)));
    } catch {
      /* idem */
    }
  }
  return { candidates };
}

async function handleGetById(source: string, id: string | number, durationSec?: number): Promise<GetLyricsResponse> {
  let doc: GetLyricsResponse['doc'] = null;
  try {
    doc = source === 'netease' ? await neteaseGetById(id, durationSec) : await lrclibGetById(id, durationSec);
  } catch {
    doc = null;
  }
  return { doc, source: doc ? source : null, cached: false };
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

  // IMPORTANTE: registrar el listener de mensajes PRIMERO, para que la búsqueda de
  // letra funcione aunque algo del icono/insignia falle.
  browser.runtime.onMessage.addListener(
    (
      message: ExtMessage,
    ): Promise<GetLyricsResponse | TokenizeResponse | SearchManualResponse> | undefined => {
      if (message?.type === 'GET_LYRICS') {
        return handleGetLyrics(message.query, message.force).catch(
          () => ({ doc: null, source: null, cached: false }) satisfies GetLyricsResponse,
        );
      }
      if (message?.type === 'TOKENIZE') {
        return handleTokenize(message.text);
      }
      if (message?.type === 'SEARCH_MANUAL') {
        return handleSearchManual(message.query).catch(() => ({ candidates: [] }) satisfies SearchManualResponse);
      }
      if (message?.type === 'GET_BY_ID') {
        return handleGetById(message.source, message.id, message.durationSec).catch(
          () => ({ doc: null, source: null, cached: false }) satisfies GetLyricsResponse,
        );
      }
      return undefined;
    },
  );

  // Encendido/apagado por el icono. Defensivo: si la API no está, no rompe lo demás.
  try {
    void isEnabled().then(reflectBadge);
    browser.action?.onClicked.addListener(async () => {
      const next = !(await isEnabled());
      await browser.storage.local.set({ [ENABLED_KEY]: next });
      await reflectBadge(next);
    });
  } catch (e) {
    console.error('[letras-jp] no se pudo configurar el icono:', e);
  }
});

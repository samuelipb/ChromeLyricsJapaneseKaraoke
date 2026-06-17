// Offscreen document: corre kuromoji en el origen de la extensión (chrome-extension://),
// fuera del CSP de YouTube. REGISTRA el listener de inmediato y carga kuromoji de forma
// PEREZOSA (import dinámico) para que, si kuromoji fallara, el error se reporte en vez de
// dejar el documento mudo. Responde a {target:'offscreen', type:'TOKENIZE'}.
import { browser } from 'wxt/browser';
import { toHiragana } from 'wanakana';
import type { IpadicFeatures, Tokenizer } from '@sglkc/kuromoji';
import type { KToken } from '../../lib/tokenizer/furigana';
import type { OffscreenTokenizeMessage, TokenizeResponse } from '../../lib/messaging';

type JpTokenizer = Tokenizer<IpadicFeatures>;
let tokenizerPromise: Promise<JpTokenizer> | null = null;

async function buildTokenizer(): Promise<JpTokenizer> {
  // Fork @sglkc/kuromoji: usa fetch + fflate (sin zlibjs ni node 'path'), apto para
  // navegador/ESM. Carga perezosa para reportar errores en vez de quedar mudo.
  const { builder } = await import('@sglkc/kuromoji');
  const getURL = browser.runtime.getURL as (path: string) => string;
  const dicPath = getURL('dict/');
  console.log('[letras-jp] offscreen: cargando diccionario kuromoji desde', dicPath);
  return new Promise<JpTokenizer>((resolve, reject) => {
    builder({ dicPath }).build((err, tokenizer) => {
      if (err) reject(err);
      else {
        console.log('[letras-jp] offscreen: diccionario listo');
        resolve(tokenizer);
      }
    });
  });
}

function getTokenizer(): Promise<JpTokenizer> {
  if (!tokenizerPromise) tokenizerPromise = buildTokenizer();
  return tokenizerPromise;
}

console.log('[letras-jp] offscreen: listener registrado');
browser.runtime.onMessage.addListener((message): Promise<TokenizeResponse> | undefined => {
  const msg = message as Partial<OffscreenTokenizeMessage>;
  if (msg?.target !== 'offscreen' || msg.type !== 'TOKENIZE' || typeof msg.text !== 'string') {
    return undefined; // no es para nosotros
  }
  const text = msg.text;
  return getTokenizer()
    .then((tokenizer) => {
      const tokens: KToken[] = tokenizer.tokenize(text).map((t) => ({
        surface: t.surface_form,
        reading: t.reading && t.reading !== '*' ? toHiragana(t.reading) : undefined,
        pos: t.pos,
      }));
      return { tokens } satisfies TokenizeResponse;
    })
    .catch((e) => ({ tokens: null, error: e instanceof Error ? e.message : String(e) }) satisfies TokenizeResponse);
});

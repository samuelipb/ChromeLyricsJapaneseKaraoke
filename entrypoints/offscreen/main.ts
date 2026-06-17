// Offscreen document: corre kuromoji en el origen de la extensión (chrome-extension://),
// fuera del CSP de YouTube. Construye el tokenizador de forma perezosa y responde a los
// mensajes {target:'offscreen', type:'TOKENIZE'} que le reenvía el background.
import { browser } from 'wxt/browser';
import kuromoji, { type Tokenizer } from 'kuromoji';
import { toHiragana } from 'wanakana';
import type { KToken } from '../../lib/tokenizer/furigana';
import type { OffscreenTokenizeMessage, TokenizeResponse } from '../../lib/messaging';

let tokenizerPromise: Promise<Tokenizer> | null = null;

function getTokenizer(): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    // getURL está tipado con rutas conocidas de public/; cargamos por DIRECTORIO.
    const getURL = browser.runtime.getURL as (path: string) => string;
    const dicPath = getURL('dict/');
    console.log('[letras-jp] offscreen: cargando diccionario kuromoji desde', dicPath);
    tokenizerPromise = new Promise<Tokenizer>((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) reject(err);
        else {
          console.log('[letras-jp] offscreen: diccionario listo');
          resolve(tokenizer);
        }
      });
    });
  }
  return tokenizerPromise;
}

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

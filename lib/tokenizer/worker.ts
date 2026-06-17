// Worker del tokenizador: corre kuromoji FUERA del hilo principal (el diccionario es
// pesado). Construye el tokenizador de forma perezosa la primera vez. Ver rules/furigana.md.
import kuromoji, { type Tokenizer } from 'kuromoji';
import { toHiragana } from 'wanakana';
import type { KToken } from './furigana';
import type { TokenizeRequest, TokenizeResponse } from './protocol';

let tokenizerPromise: Promise<Tokenizer> | null = null;

function getTokenizer(dicPath: string): Promise<Tokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = new Promise<Tokenizer>((resolve, reject) => {
      kuromoji.builder({ dicPath }).build((err, tokenizer) => {
        if (err) reject(err);
        else resolve(tokenizer);
      });
    });
  }
  return tokenizerPromise;
}

// El worker corre con lib DOM en tsc; tipamos postMessage de forma mínima para no
// depender de la lib "WebWorker".
const workerScope = self as unknown as { postMessage(message: unknown): void };

self.onmessage = async (e: MessageEvent<TokenizeRequest>) => {
  const msg = e.data;
  if (msg?.type !== 'TOKENIZE') return;
  const post = (r: TokenizeResponse) => workerScope.postMessage(r);
  try {
    const tokenizer = await getTokenizer(msg.dicPath);
    const tokens: KToken[] = tokenizer.tokenize(msg.text).map((t) => ({
      surface: t.surface_form,
      reading: t.reading && t.reading !== '*' ? toHiragana(t.reading) : undefined,
      pos: t.pos,
    }));
    post({ id: msg.id, tokens });
  } catch (err) {
    post({ id: msg.id, error: err instanceof Error ? err.message : String(err) });
  }
};

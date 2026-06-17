// Cliente de tokenización para el content script: pide tokens al background (que los
// obtiene del offscreen document, donde corre kuromoji). Cachea por texto de línea.
import { browser } from 'wxt/browser';
import type { KToken } from './furigana';
import type { TokenizeMessage, TokenizeResponse } from '../messaging';

export class Tokenizer {
  private cache = new Map<string, KToken[]>();
  /** Notificación de errores (para mostrarlos en el overlay). */
  onError?: (msg: string) => void;

  async tokenize(text: string): Promise<KToken[]> {
    const hit = this.cache.get(text);
    if (hit) return hit;

    const msg: TokenizeMessage = { type: 'TOKENIZE', text };
    let res: TokenizeResponse | undefined;
    try {
      res = (await browser.runtime.sendMessage(msg)) as TokenizeResponse | undefined;
    } catch (e) {
      const m = 'content→bg: ' + (e instanceof Error ? e.message : String(e));
      console.error('[letras-jp] content: sendMessage al background falló:', m);
      this.onError?.(m);
      throw new Error(m);
    }
    if (!res || res.error || !res.tokens) {
      const m = res?.error ?? 'sin respuesta del tokenizador';
      console.warn('[letras-jp] content: respuesta sin tokens:', res);
      this.onError?.(m);
      throw new Error(m);
    }
    this.cache.set(text, res.tokens);
    return res.tokens;
  }

  terminate(): void {
    this.cache.clear();
  }
}

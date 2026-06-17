// Cliente del Worker del tokenizador, usado por el content script.
// Cachea la tokenización por texto de línea (clave = texto) para no re-tokenizar en cada seek.
import type { KToken } from './furigana';
import type { TokenizeRequest, TokenizeResponse } from './protocol';

export class Tokenizer {
  private worker: Worker;
  private seq = 0;
  private pending = new Map<number, { resolve: (t: KToken[]) => void; reject: (e: Error) => void }>();
  private cache = new Map<string, KToken[]>();

  constructor(private dicPath: string) {
    this.worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<TokenizeResponse>) => {
      const r = e.data;
      const p = this.pending.get(r.id);
      if (!p) return;
      this.pending.delete(r.id);
      if ('error' in r) p.reject(new Error(r.error));
      else p.resolve(r.tokens);
    };
  }

  async tokenize(text: string): Promise<KToken[]> {
    const hit = this.cache.get(text);
    if (hit) return hit;
    const id = ++this.seq;
    const req: TokenizeRequest = { id, type: 'TOKENIZE', text, dicPath: this.dicPath };
    const tokens = await new Promise<KToken[]>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker.postMessage(req);
    });
    this.cache.set(text, tokens);
    return tokens;
  }

  terminate(): void {
    this.worker.terminate();
    this.pending.clear();
    this.cache.clear();
  }
}

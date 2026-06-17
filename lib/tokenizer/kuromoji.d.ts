// Tipos mínimos para kuromoji (el paquete no trae declaraciones).
declare module 'kuromoji' {
  export interface IpadicToken {
    surface_form: string;
    pos: string;
    reading: string; // katakana, o "*" si desconocida
    pronunciation: string;
    basic_form: string;
  }
  export interface Tokenizer {
    tokenize(text: string): IpadicToken[];
  }
  export interface Builder {
    build(callback: (err: Error | null, tokenizer: Tokenizer) => void): void;
  }
  export function builder(option: { dicPath: string }): Builder;
  const kuromoji: { builder: typeof builder };
  export default kuromoji;
}

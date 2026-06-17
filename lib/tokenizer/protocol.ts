// Protocolo de mensajes entre el content script y el Worker del tokenizador.
import type { KToken } from './furigana';

export interface TokenizeRequest {
  id: number;
  type: 'TOKENIZE';
  text: string;
  /** URL base del diccionario vendorizado (chrome-extension://…/dict/). */
  dicPath: string;
}

export interface TokenizeOk {
  id: number;
  tokens: KToken[];
}

export interface TokenizeErr {
  id: number;
  error: string;
}

export type TokenizeResponse = TokenizeOk | TokenizeErr;

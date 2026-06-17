// Tipos mínimos de chrome.offscreen (no usamos @types/chrome). Solo lo que invocamos.
// El objeto `chrome` existe en runtime; aquí solo describimos su forma parcial.
declare const chrome: {
  offscreen: {
    createDocument(parameters: {
      url: string;
      reasons: string[];
      justification: string;
    }): Promise<void>;
    closeDocument(): Promise<void>;
    hasDocument(): Promise<boolean>;
  };
};

import { defineConfig } from 'wxt';

// Config de WXT — genera el manifest MV3. Permisos mínimos (ver .claude/rules/mv3.md):
// solo host_permissions de YouTube; nada de <all_urls>. Los dominios de letras se
// añadirán cuando se integren los proveedores (Fase 2+), preguntando antes.
export default defineConfig({
  manifest: {
    name: 'Letras JP — furigana + karaoke (YouTube)',
    description:
      'Letras japonesas con furigana y karaoke sincronizado sobre videos de YouTube (uso personal/educativo).',
    // Sin permisos de runtime todavía: el overlay "hola mundo" no necesita storage.
    // `storage` se añadirá al introducir la caché por videoId (Fase 2/4).
    host_permissions: ['*://www.youtube.com/*'],
  },
});

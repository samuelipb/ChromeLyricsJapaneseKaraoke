import { fileURLToPath } from 'node:url';
import { defineConfig } from 'wxt';

// Shim de 'path' (URL-safe) para que kuromoji cargue el diccionario en el Worker.
const pathShim = fileURLToPath(new URL('./lib/shims/path.ts', import.meta.url));

// Config de WXT — genera el manifest MV3. Permisos mínimos (ver .claude/rules/mv3.md):
// solo host_permissions de YouTube; nada de <all_urls>. Los dominios de letras se
// añadirán cuando se integren los proveedores (Fase 2+), preguntando antes.
export default defineConfig({
  manifest: {
    name: 'Letras JP — furigana + karaoke (YouTube)',
    description:
      'Letras japonesas con furigana y karaoke sincronizado sobre videos de YouTube (uso personal/educativo).',
    // Permisos mínimos: storage para la caché de letras por videoId.
    permissions: ['storage'],
    // YouTube (página) + LRCLIB (única fuente de letras en Fase 2). Nunca <all_urls>.
    host_permissions: ['*://www.youtube.com/*', 'https://lrclib.net/*'],
    // Accesibles para el content script y su Worker (origen de la página). Solo a YouTube:
    // - dict/* : diccionario vendorizado de kuromoji.
    // - assets/* : chunk del Worker del tokenizador (nombre con hash).
    web_accessible_resources: [
      { resources: ['dict/*', 'assets/*'], matches: ['*://www.youtube.com/*'] },
    ],
  },
  // kuromoji hace require('path'); lo redirigimos a un shim URL-safe (preserva "://").
  vite: () => ({
    resolve: { alias: { path: pathShim } },
  }),
});

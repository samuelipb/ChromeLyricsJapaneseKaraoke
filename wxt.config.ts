import { defineConfig } from 'wxt';

// Config de WXT — genera el manifest MV3. Permisos mínimos (ver .claude/rules/mv3.md):
// solo host_permissions de YouTube; nada de <all_urls>. Los dominios de letras se
// añadirán cuando se integren los proveedores (Fase 2+), preguntando antes.
export default defineConfig({
  manifest: {
    name: 'Letras JP — furigana + karaoke (YouTube)',
    description:
      'Letras japonesas con furigana y karaoke sincronizado sobre videos de YouTube (uso personal/educativo).',
    // Botón de la barra: clic = activar/desactivar el overlay (sin popup).
    action: { default_title: 'Letras JP: activar/desactivar' },
    // Permisos mínimos: storage (caché de letras) + offscreen (corre kuromoji fuera
    // del CSP de YouTube). El offscreen es del origen de la extensión, así que el
    // diccionario NO necesita web_accessible_resources.
    permissions: ['storage', 'offscreen'],
    // YouTube (página) + fuentes de letras. NetEase es opt-in pero el permiso debe estar
    // declarado para poder pedirla cuando el usuario la active. Nunca <all_urls>.
    host_permissions: ['*://www.youtube.com/*', 'https://lrclib.net/*', 'https://music.163.com/*'],
  },
});

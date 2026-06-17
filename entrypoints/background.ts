// Service worker (efímero). En Fase 1 solo confirma que el SW arranca.
// A futuro: orquesta proveedores de letras, caché por videoId y mensajería
// con el content script (ver .claude/rules/mv3.md). No guardar estado en
// variables de módulo asumiendo persistencia.
export default defineBackground(() => {
  console.log('[letras-jp] service worker listo');
});

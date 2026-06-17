// Content script para youtube.com/watch (NO YouTube Music).
// Fase 1: inyecta un overlay "hola mundo" visible, se reinicializa en la
// navegación SPA de YouTube y localiza el elemento <video>. Sin lógica de letras.
// Reglas: mundo aislado, DOM por nodos + textContent (jamás innerHTML con datos
// externos), limpia listeners al re-inicializar. Ver .claude/rules/mv3.md.

const OVERLAY_ID = 'letras-jp-overlay';

export default defineContentScript({
  matches: ['*://www.youtube.com/watch*'],
  runAt: 'document_idle',

  main(ctx) {
    // Estado vivo de la instancia actual (se descarta en cada reinicialización).
    let overlay: HTMLElement | null = null;
    let video: HTMLVideoElement | null = null;
    const videoListeners: Array<[keyof HTMLMediaElementEventMap, EventListener]> = [];

    // --- Overlay -------------------------------------------------------------
    function ensureOverlay(): HTMLElement {
      const existing = document.getElementById(OVERLAY_ID);
      if (existing) return existing;

      const el = document.createElement('div');
      el.id = OVERLAY_ID;
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '88px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        padding: '8px 14px',
        background: 'rgba(0, 0, 0, 0.78)',
        color: '#fff',
        font: '600 14px/1.4 system-ui, sans-serif',
        borderRadius: '10px',
        pointerEvents: 'none',
        userSelect: 'none',
      } satisfies Partial<CSSStyleDeclaration>);
      // Texto por nodos (sin innerHTML): seguro aunque luego venga de fuentes externas.
      el.textContent = '🎤 Letras JP — overlay activo (Fase 1)';
      document.body.appendChild(el);
      return el;
    }

    function setStatus(text: string): void {
      if (overlay) overlay.textContent = text;
    }

    // --- Video ---------------------------------------------------------------
    function attachVideo(): void {
      const v = document.querySelector<HTMLVideoElement>('video.html5-main-video');
      if (!v || v === video) return;
      detachVideo();
      video = v;

      const onPlay = () => setStatus('▶️ reproduciendo — overlay activo (Fase 1)');
      const onPause = () => setStatus('⏸️ pausa — overlay activo (Fase 1)');
      const add = (type: keyof HTMLMediaElementEventMap, fn: EventListener) => {
        v.addEventListener(type, fn);
        videoListeners.push([type, fn]);
      };
      add('play', onPlay);
      add('pause', onPause);

      setStatus(v.paused ? '🎤 Letras JP — overlay activo (Fase 1)' : '▶️ reproduciendo — overlay activo (Fase 1)');
    }

    function detachVideo(): void {
      if (video) {
        for (const [type, fn] of videoListeners) video.removeEventListener(type, fn);
      }
      videoListeners.length = 0;
      video = null;
    }

    // --- Ciclo de vida -------------------------------------------------------
    function init(): void {
      if (!location.pathname.startsWith('/watch')) return;
      overlay = ensureOverlay();
      attachVideo();
    }

    function teardown(): void {
      detachVideo();
      document.getElementById(OVERLAY_ID)?.remove();
      overlay = null;
    }

    // Reinicio en navegación SPA de YouTube (teatro/fullscreen/miniplayer incluidos).
    const onNavigate = () => {
      teardown();
      init();
    };
    document.addEventListener('yt-navigate-finish', onNavigate);

    // Limpieza total cuando WXT invalida el content script (recarga/HMR/cierre).
    ctx.onInvalidated(() => {
      document.removeEventListener('yt-navigate-finish', onNavigate);
      teardown();
    });

    init();
  },
});

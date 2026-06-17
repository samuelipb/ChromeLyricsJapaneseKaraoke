// Content script para youtube.com/watch (NO YouTube Music).
// Fase 2: detecta la canción desde el DOM, pide la letra al background (LRCLIB) y
// la muestra sincronizada por LÍNEA siguiendo video.currentTime.
// Reglas: mundo aislado, DOM por nodos + textContent (jamás innerHTML con datos
// externos), limpia listeners/rAF al re-inicializar. Ver .claude/rules/mv3.md.
import type { LyricsDoc, Line, TrackQuery } from '../lib/model';
import { lineText } from '../lib/model';
import type { GetLyricsMessage, GetLyricsResponse } from '../lib/messaging';
import { parseTrack } from '../lib/normalizer/title';

const OVERLAY_ID = 'letras-jp-overlay';

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  runAt: 'document_idle',

  main(ctx) {
    console.log('[letras-jp] content script cargado en', location.href);

    // Estado vivo de la instancia (se descarta en cada reinicialización SPA).
    let overlay: HTMLElement | null = null;
    let statusEl: HTMLElement | null = null;
    let prevEl: HTMLElement | null = null;
    let curEl: HTMLElement | null = null;
    let nextEl: HTMLElement | null = null;
    let video: HTMLVideoElement | null = null;
    const videoListeners: Array<[keyof HTMLMediaElementEventMap, EventListener]> = [];

    let doc: LyricsDoc | null = null;
    let rafId = 0;
    let lastIndex = -2; // fuerza el primer pintado
    let gen = 0; // token para descartar respuestas de videos anteriores

    // --- Overlay (estructura por nodos) -------------------------------------
    function buildOverlay(): void {
      const el = document.createElement('div');
      el.id = OVERLAY_ID;
      Object.assign(el.style, {
        position: 'fixed',
        bottom: '90px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '2147483647',
        maxWidth: 'min(80vw, 900px)',
        padding: '10px 16px',
        background: 'rgba(0, 0, 0, 0.74)',
        color: '#fff',
        textAlign: 'center',
        borderRadius: '12px',
        pointerEvents: 'none',
        userSelect: 'none',
        font: '14px/1.5 system-ui, sans-serif',
      } satisfies Partial<CSSStyleDeclaration>);

      statusEl = document.createElement('div');
      Object.assign(statusEl.style, { fontSize: '11px', opacity: '0.7', marginBottom: '2px' });

      prevEl = document.createElement('div');
      curEl = document.createElement('div');
      nextEl = document.createElement('div');
      Object.assign(prevEl.style, { fontSize: '15px', opacity: '0.45' });
      Object.assign(curEl.style, { fontSize: '22px', fontWeight: '700', margin: '2px 0' });
      Object.assign(nextEl.style, { fontSize: '15px', opacity: '0.45' });

      el.append(statusEl, prevEl, curEl, nextEl);
      document.body.appendChild(el);
      overlay = el;
    }

    function setStatus(text: string): void {
      if (statusEl) statusEl.textContent = text;
    }

    function setLines(prev: string, cur: string, next: string): void {
      if (prevEl) prevEl.textContent = prev;
      if (curEl) curEl.textContent = cur;
      if (nextEl) nextEl.textContent = next;
    }

    // --- Detección de pista --------------------------------------------------
    function detectTrack(): TrackQuery | null {
      const videoId = new URLSearchParams(location.search).get('v');
      if (!videoId) return null;

      // document.title = "(2) <título> - YouTube"; quitamos prefijo y sufijo.
      const rawTitle = document.title
        .replace(/^\(\d+\)\s*/, '')
        .replace(/\s*-\s*YouTube\s*$/i, '')
        .trim();
      if (!rawTitle) return null;

      const channel =
        document.querySelector<HTMLElement>(
          'ytd-watch-metadata #owner #channel-name a, #upload-info #channel-name a, ytd-channel-name a',
        )?.textContent?.trim() ?? undefined;

      const { title, artist } = parseTrack(rawTitle, channel);
      const durationSec = video && Number.isFinite(video.duration) ? video.duration : undefined;
      return { title, artist, durationSec, videoId };
    }

    // --- Petición de letra ---------------------------------------------------
    async function requestLyrics(query: TrackQuery): Promise<void> {
      const myGen = gen;
      setStatus(`🔎 buscando letra: ${query.artist ? query.artist + ' — ' : ''}${query.title}`);
      const msg: GetLyricsMessage = { type: 'GET_LYRICS', query };
      let res: GetLyricsResponse;
      try {
        res = (await browser.runtime.sendMessage(msg)) as GetLyricsResponse;
      } catch {
        if (myGen === gen) setStatus('⚠️ no se pudo contactar al background');
        return;
      }
      if (myGen !== gen) return; // el usuario ya cambió de video

      if (res?.doc && res.doc.lines.length > 0) {
        doc = res.doc;
        lastIndex = -2;
        setStatus(`🎤 ${res.source ?? 'letra'}${res.cached ? ' (caché)' : ''}`);
        startLoop();
      } else {
        doc = null;
        setStatus('🙈 sin letra sincronizada para este video');
        setLines('', '', '');
      }
    }

    // --- Sincronización por línea -------------------------------------------
    function activeIndex(lines: Line[], t: number): number {
      let lo = 0;
      let hi = lines.length - 1;
      let ans = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        if (lines[mid]!.tStart <= t) {
          ans = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      return ans;
    }

    function renderAt(t: number): void {
      if (!doc) return;
      const lines = doc.lines;
      const i = activeIndex(lines, t);
      if (i === lastIndex) return;
      lastIndex = i;

      const cur = i >= 0 && t < lines[i]!.tEnd ? lineText(lines[i]!) : '';
      const prev = i > 0 ? lineText(lines[i - 1]!) : '';
      const next = i + 1 < lines.length ? lineText(lines[i + 1]!) : '';
      setLines(prev, cur, next);
    }

    function loop(): void {
      if (video) renderAt(video.currentTime);
      rafId = requestAnimationFrame(loop);
    }

    function startLoop(): void {
      stopLoop();
      lastIndex = -2;
      rafId = requestAnimationFrame(loop);
    }

    function stopLoop(): void {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    // --- Video ---------------------------------------------------------------
    function attachVideo(): void {
      const v = document.querySelector<HTMLVideoElement>('video.html5-main-video');
      if (!v || v === video) return;
      detachVideo();
      video = v;

      const add = (type: keyof HTMLMediaElementEventMap, fn: EventListener) => {
        v.addEventListener(type, fn);
        videoListeners.push([type, fn]);
      };
      // Ahorra CPU: corre el rAF solo mientras reproduce; reposiciona al hacer seek.
      add('play', () => doc && startLoop());
      add('pause', stopLoop);
      add('ended', stopLoop);
      add('seeked', () => video && renderAt(video.currentTime));
      // La duración llega con los metadatos: ahí podemos detectar y pedir la letra.
      add('loadedmetadata', () => kickoff());
    }

    function detachVideo(): void {
      if (video) for (const [type, fn] of videoListeners) video.removeEventListener(type, fn);
      videoListeners.length = 0;
      video = null;
    }

    // --- Ciclo de vida -------------------------------------------------------
    function kickoff(): void {
      const query = detectTrack();
      if (!query) {
        setStatus('… esperando metadatos del video');
        return;
      }
      void requestLyrics(query);
    }

    function init(): void {
      if (!location.pathname.startsWith('/watch')) return;
      if (!overlay) buildOverlay();
      setStatus('🎤 Letras JP — iniciando…');
      attachVideo();
      // Si los metadatos ya están listos (navegación SPA), arranca de una vez.
      if (video && Number.isFinite(video.duration)) kickoff();
    }

    function teardown(): void {
      gen++; // invalida respuestas en vuelo
      stopLoop();
      detachVideo();
      doc = null;
      lastIndex = -2;
      document.getElementById(OVERLAY_ID)?.remove();
      overlay = statusEl = prevEl = curEl = nextEl = null;
    }

    // Reinicio en navegación SPA de YouTube.
    const onNavigate = () => {
      teardown();
      init();
    };
    document.addEventListener('yt-navigate-finish', onNavigate);

    ctx.onInvalidated(() => {
      document.removeEventListener('yt-navigate-finish', onNavigate);
      teardown();
    });

    init();
  },
});

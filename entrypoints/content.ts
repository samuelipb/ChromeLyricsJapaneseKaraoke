// Content script para youtube.com/watch (NO YouTube Music).
// Fase 3: además de la letra sincronizada por línea (Fase 2), añade FURIGANA sobre los
// kanji (kuromoji en un Worker) y toggles de furigana/romaji. <ruby> construido por
// NODOS del DOM (jamás innerHTML). Ver .claude/rules/{mv3,furigana,karaoke-sync}.md.
import type { LyricsDoc, Line } from '../lib/model';
import { lineText } from '../lib/model';
import type { GetLyricsMessage, GetLyricsResponse } from '../lib/messaging';
import type { TrackQuery } from '../lib/model';
import { parseTrack } from '../lib/normalizer/title';
import { Tokenizer } from '../lib/tokenizer/client';
import { tokensToRomaji, tokensToRuby, type RubySegment } from '../lib/tokenizer/furigana';
import { wipeProgress } from '../lib/sync/wipe';

const OVERLAY_ID = 'letras-jp-overlay';
const SETTINGS_KEY = 'settings';

interface Settings {
  furigana: boolean;
  romaji: boolean;
  /** Activa fuentes de letras opt-in (NetEase). Off por defecto (ToS). */
  extraSources: boolean;
  /** Muestra el panel de debug en el overlay. */
  debug: boolean;
}

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  runAt: 'document_idle',

  main(ctx) {
    console.log('[letras-jp] content script cargado en', location.href);

    // Tokenizador: vive toda la sesión del content script (no recarga el diccionario por video).
    let tokenizer: Tokenizer | null = null;
    const settings: Settings = { furigana: true, romaji: false, extraSources: false, debug: false };
    const debugLines: string[] = [];
    let enabled = true; // encendido/apagado global (icono de la extensión)

    // Estado vivo por video (se descarta en cada reinicialización SPA).
    let overlay: HTMLElement | null = null;
    let statusEl: HTMLElement | null = null;
    let prevEl: HTMLElement | null = null;
    let curEl: HTMLElement | null = null;
    let romajiEl: HTMLElement | null = null;
    let nextEl: HTMLElement | null = null;
    let furiBtn: HTMLButtonElement | null = null;
    let romaBtn: HTMLButtonElement | null = null;
    let neteaseBtn: HTMLButtonElement | null = null;
    let reloadBtn: HTMLButtonElement | null = null;
    let debugBtn: HTMLButtonElement | null = null;
    let debugEl: HTMLElement | null = null;
    let video: HTMLVideoElement | null = null;
    const videoListeners: Array<[keyof HTMLMediaElementEventMap, EventListener]> = [];

    let doc: LyricsDoc | null = null;
    let activeLine: Line | null = null;
    let currentText = ''; // texto de la línea actual (guarda contra carreras de tokenización)
    let rafId = 0;
    let lastIndex = -2;
    let gen = 0;

    function ensureTokenizer(): Tokenizer {
      if (!tokenizer) {
        tokenizer = new Tokenizer();
        tokenizer.onError = (msg) => {
          setStatus('⚠️ furigana: ' + msg);
          dbg('furigana/tokenizer error: ' + msg);
        };
      }
      return tokenizer;
    }

    // --- Overlay (estructura por nodos) -------------------------------------
    function makeBtn(label: string, on: boolean): HTMLButtonElement {
      const b = document.createElement('button');
      b.textContent = label;
      Object.assign(b.style, {
        pointerEvents: 'auto',
        cursor: 'pointer',
        border: 'none',
        borderRadius: '6px',
        padding: '2px 8px',
        marginLeft: '6px',
        fontSize: '11px',
        background: on ? '#2d7ff9' : 'rgba(255,255,255,0.18)',
        color: '#fff',
      } satisfies Partial<CSSStyleDeclaration>);
      return b;
    }

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
        font: '14px/1.6 system-ui, sans-serif',
      } satisfies Partial<CSSStyleDeclaration>);

      const bar = document.createElement('div');
      Object.assign(bar.style, { display: 'flex', justifyContent: 'center', alignItems: 'center', marginBottom: '4px' });
      statusEl = document.createElement('span');
      Object.assign(statusEl.style, { fontSize: '11px', opacity: '0.7' });
      furiBtn = makeBtn('ふりがな', settings.furigana);
      romaBtn = makeBtn('ローマ字', settings.romaji);
      neteaseBtn = makeBtn('NetEase', settings.extraSources);
      neteaseBtn.title = 'Fuente extra opt-in (más cobertura japonesa). Re-busca al activar.';
      reloadBtn = makeBtn('🔄', false);
      reloadBtn.title = 'Re-buscar letra (ignora la caché de este video)';
      debugBtn = makeBtn('🐞', settings.debug);
      debugBtn.title = 'Panel de debug: muestra qué detecta y cómo busca la letra';
      furiBtn.addEventListener('click', () => toggle('furigana'));
      romaBtn.addEventListener('click', () => toggle('romaji'));
      neteaseBtn.addEventListener('click', () => toggleExtraSources());
      reloadBtn.addEventListener('click', () => kickoff(true));
      debugBtn.addEventListener('click', () => toggleDebug());
      bar.append(statusEl, furiBtn, romaBtn, neteaseBtn, reloadBtn, debugBtn);

      prevEl = document.createElement('div');
      curEl = document.createElement('div');
      romajiEl = document.createElement('div');
      nextEl = document.createElement('div');
      Object.assign(prevEl.style, { fontSize: '15px', opacity: '0.45' });
      // width:fit-content + margin auto → la caja se ajusta al texto y queda centrada,
      // así el gradiente del "wipe" (0–100%) coincide con el ancho real del texto.
      Object.assign(curEl.style, {
        fontSize: '24px',
        fontWeight: '700',
        margin: '2px auto',
        width: 'fit-content',
        maxWidth: '100%',
      });
      Object.assign(romajiEl.style, { fontSize: '13px', opacity: '0.8', display: 'none' });
      Object.assign(nextEl.style, { fontSize: '15px', opacity: '0.45' });

      debugEl = document.createElement('div');
      Object.assign(debugEl.style, {
        display: settings.debug ? 'block' : 'none',
        marginTop: '6px',
        paddingTop: '4px',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        font: '11px/1.4 ui-monospace, Consolas, monospace',
        textAlign: 'left',
        whiteSpace: 'pre-wrap',
        color: '#9fe',
        maxHeight: '140px',
        overflowY: 'auto',
      } satisfies Partial<CSSStyleDeclaration>);

      el.append(bar, prevEl, curEl, romajiEl, nextEl, debugEl);
      document.body.appendChild(el);
      overlay = el;
      renderDebug();
    }

    function setStatus(text: string): void {
      if (statusEl) statusEl.textContent = text;
    }

    const ON = '#2d7ff9';
    const OFF = 'rgba(255,255,255,0.18)';

    function toggle(key: 'furigana' | 'romaji'): void {
      settings[key] = !settings[key];
      if (furiBtn) furiBtn.style.background = settings.furigana ? ON : OFF;
      if (romaBtn) romaBtn.style.background = settings.romaji ? ON : OFF;
      void browser.storage.local.set({ [SETTINGS_KEY]: settings });
      if (activeLine) renderCurrent(activeLine);
    }

    function toggleExtraSources(): void {
      settings.extraSources = !settings.extraSources;
      if (neteaseBtn) neteaseBtn.style.background = settings.extraSources ? ON : OFF;
      // Persiste y RE-BUSCA (el background lee este ajuste para armar la cadena).
      void browser.storage.local.set({ [SETTINGS_KEY]: settings }).then(() => kickoff(true));
    }

    // --- Debug ---------------------------------------------------------------
    function renderDebug(): void {
      if (!debugEl) return;
      debugEl.style.display = settings.debug ? 'block' : 'none';
      if (settings.debug) {
        debugEl.textContent = debugLines.join('\n');
        debugEl.scrollTop = debugEl.scrollHeight;
      }
    }

    function dbg(line: string): void {
      const ts = new Date().toLocaleTimeString();
      debugLines.push(`${ts}  ${line}`);
      if (debugLines.length > 60) debugLines.shift();
      renderDebug();
    }

    function toggleDebug(): void {
      settings.debug = !settings.debug;
      if (debugBtn) debugBtn.style.background = settings.debug ? ON : OFF;
      void browser.storage.local.set({ [SETTINGS_KEY]: settings });
      renderDebug();
    }

    async function loadSettings(): Promise<void> {
      try {
        const got = await browser.storage.local.get(SETTINGS_KEY);
        const s = got[SETTINGS_KEY] as Partial<Settings> | undefined;
        if (s) {
          if (typeof s.furigana === 'boolean') settings.furigana = s.furigana;
          if (typeof s.romaji === 'boolean') settings.romaji = s.romaji;
          if (typeof s.extraSources === 'boolean') settings.extraSources = s.extraSources;
          if (typeof s.debug === 'boolean') settings.debug = s.debug;
        }
      } catch {
        /* usa los valores por defecto */
      }
    }

    // --- Render de la letra --------------------------------------------------
    function renderRubyInto(el: HTMLElement, segs: RubySegment[]): void {
      el.textContent = '';
      for (const s of segs) {
        if (s.rt) {
          const ruby = document.createElement('ruby');
          ruby.appendChild(document.createTextNode(s.text));
          const rt = document.createElement('rt');
          rt.textContent = s.rt;
          ruby.appendChild(rt);
          el.appendChild(ruby);
        } else {
          el.appendChild(document.createTextNode(s.text));
        }
      }
    }

    function showRomaji(text: string): void {
      if (!romajiEl) return;
      romajiEl.textContent = text;
      romajiEl.style.display = text ? '' : 'none';
    }

    // --- Resaltado "wipe" (karaoke) -----------------------------------------
    const WIPE_BRIGHT = '#ffffff';
    const WIPE_DIM = 'rgba(255,255,255,0.4)';

    function applyWipeBase(): void {
      if (!curEl) return;
      // El texto se pinta con el gradiente de fondo recortado a las letras.
      curEl.style.color = 'transparent';
      curEl.style.backgroundClip = 'text';
      curEl.style.setProperty('-webkit-text-fill-color', 'transparent');
      curEl.style.setProperty('-webkit-background-clip', 'text');
    }

    function clearWipe(): void {
      if (!curEl) return;
      curEl.style.color = WIPE_BRIGHT;
      curEl.style.backgroundImage = 'none';
      curEl.style.removeProperty('-webkit-text-fill-color');
    }

    function updateWipe(t: number): void {
      if (!curEl || !activeLine) return;
      const p = (wipeProgress(t, activeLine.tStart, activeLine.tEnd) * 100).toFixed(2);
      curEl.style.backgroundImage = `linear-gradient(90deg, ${WIPE_BRIGHT} ${p}%, ${WIPE_DIM} ${p}%)`;
    }

    function renderCurrent(line: Line | null): void {
      if (!curEl) return;
      const text = line ? lineText(line) : '';
      currentText = text;
      if (!text) {
        curEl.textContent = '';
        clearWipe();
        showRomaji('');
        return;
      }
      applyWipeBase();
      if (video) updateWipe(video.currentTime); // pinta el gradiente ya (evita texto invisible)
      if (!settings.furigana && !settings.romaji) {
        curEl.textContent = text;
        showRomaji('');
        return;
      }
      const tk = ensureTokenizer();
      // Pinta texto plano ya; si está cacheado, lo mejora de inmediato; si no, al volver.
      curEl.textContent = text;
      showRomaji('');
      tk.tokenize(text)
        .then((tokens) => {
          if (currentText !== text || !curEl) return; // el usuario ya cambió de línea/video
          if (settings.furigana) renderRubyInto(curEl, tokensToRuby(tokens));
          else curEl.textContent = text;
          showRomaji(settings.romaji ? tokensToRomaji(tokens) : '');
        })
        .catch(() => {
          /* si el tokenizador falla, se queda el texto plano */
        });
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

      const within = i >= 0 && t < lines[i]!.tEnd;
      activeLine = within ? lines[i]! : null;
      if (prevEl) prevEl.textContent = i > 0 ? lineText(lines[i - 1]!) : '';
      if (nextEl) nextEl.textContent = i + 1 < lines.length ? lineText(lines[i + 1]!) : '';
      renderCurrent(activeLine);

      // Pre-tokeniza la siguiente línea (suaviza la transición).
      if ((settings.furigana || settings.romaji) && i + 1 < lines.length) {
        void ensureTokenizer().tokenize(lineText(lines[i + 1]!)).catch(() => {});
      }
    }

    function loop(): void {
      if (video) {
        const t = video.currentTime;
        renderAt(t); // cambia de línea solo cuando toca
        updateWipe(t); // barre la línea activa cada frame
      }
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

    // --- Detección de pista y petición de letra -----------------------------
    function detectTrack(): TrackQuery | null {
      const videoId = new URLSearchParams(location.search).get('v');
      if (!videoId) return null;
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

    async function requestLyrics(query: TrackQuery, force = false): Promise<void> {
      const myGen = gen;
      setStatus(`🔎 ${query.artist ? query.artist + ' — ' : ''}${query.title}`);
      dbg(`detecté: "${query.title}"${query.artist ? ` — ${query.artist}` : ' (sin artista)'}` +
        `${query.durationSec ? ` · ${Math.round(query.durationSec)}s` : ' · sin duración'}`);
      dbg(`buscando${force ? ' (re-buscar)' : ''}…`);
      const t0 = performance.now();
      const msg: GetLyricsMessage = { type: 'GET_LYRICS', query, force };
      let res: GetLyricsResponse;
      try {
        res = (await browser.runtime.sendMessage(msg)) as GetLyricsResponse;
      } catch {
        if (myGen === gen) {
          setStatus('⚠️ no se pudo contactar al background');
          dbg('✗ sin respuesta del background');
        }
        return;
      }
      if (myGen !== gen) return;

      for (const line of res?.debug ?? []) dbg(`  · ${line}`);

      if (res?.doc && res.doc.lines.length > 0) {
        doc = res.doc;
        lastIndex = -2;
        const label = res.source === 'lrclib-plain' ? 'texto plano (aprox.)' : (res.source ?? 'letra');
        setStatus(`🎤 ${label}${res.cached ? ' (caché)' : ''}`);
        dbg(`✓ ${res.source} · ${res.doc.lines.length} líneas · ${Math.round(performance.now() - t0)}ms`);
        startLoop();
      } else {
        doc = null;
        setStatus('🙈 sin letra para este video');
        dbg(`✗ sin letra · ${Math.round(performance.now() - t0)}ms (prueba NetEase 🔄 o revisa el título)`);
        activeLine = null;
        if (prevEl) prevEl.textContent = '';
        if (nextEl) nextEl.textContent = '';
        renderCurrent(null);
      }
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
      add('play', () => doc && startLoop());
      add('pause', stopLoop);
      add('ended', stopLoop);
      add('seeked', () => {
        if (video) {
          renderAt(video.currentTime);
          updateWipe(video.currentTime);
        }
      });
      add('loadedmetadata', () => kickoff());
    }

    function detachVideo(): void {
      if (video) for (const [type, fn] of videoListeners) video.removeEventListener(type, fn);
      videoListeners.length = 0;
      video = null;
    }

    // --- Ciclo de vida -------------------------------------------------------
    function kickoff(force = false): void {
      const query = detectTrack();
      if (!query) {
        setStatus('… esperando metadatos del video');
        dbg('esperando metadatos del video (sin videoId/título/duración aún)');
        return;
      }
      void requestLyrics(query, force);
    }

    function init(): void {
      if (!enabled) return; // apagado desde el icono de la extensión
      if (!location.pathname.startsWith('/watch')) return;
      if (!overlay) buildOverlay();
      setStatus('🎤 Letras JP — iniciando…');
      attachVideo();
      if (video && Number.isFinite(video.duration)) kickoff();
    }

    function teardown(): void {
      gen++;
      stopLoop();
      detachVideo();
      doc = null;
      activeLine = null;
      currentText = '';
      lastIndex = -2;
      document.getElementById(OVERLAY_ID)?.remove();
      overlay = statusEl = prevEl = curEl = romajiEl = nextEl = debugEl = null;
      furiBtn = romaBtn = neteaseBtn = reloadBtn = debugBtn = null;
      debugLines.length = 0;
    }

    const onNavigate = () => {
      teardown();
      init();
    };
    document.addEventListener('yt-navigate-finish', onNavigate);

    // Reacciona al encendido/apagado desde el icono de la extensión (cambia `enabled`
    // en storage.local; vale para todas las pestañas de YouTube a la vez).
    const onStorage = (
      changes: Record<string, { newValue?: unknown }>,
      area: string,
    ) => {
      if (area !== 'local' || !changes.enabled) return;
      enabled = changes.enabled.newValue !== false;
      if (enabled) init();
      else teardown();
    };
    browser.storage.onChanged.addListener(onStorage);

    ctx.onInvalidated(() => {
      document.removeEventListener('yt-navigate-finish', onNavigate);
      browser.storage.onChanged.removeListener(onStorage);
      teardown();
      tokenizer?.terminate();
      tokenizer = null;
    });

    async function loadEnabled(): Promise<void> {
      try {
        const got = await browser.storage.local.get('enabled');
        enabled = got.enabled !== false; // por defecto: activado
      } catch {
        /* por defecto activado */
      }
    }

    // Carga preferencias + estado on/off y arranca.
    void Promise.all([loadSettings(), loadEnabled()]).then(init);
  },
});

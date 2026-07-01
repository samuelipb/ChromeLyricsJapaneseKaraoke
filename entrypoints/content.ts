// Content script para youtube.com/watch (NO YouTube Music).
// Fase 3: además de la letra sincronizada por línea (Fase 2), añade FURIGANA sobre los
// kanji (kuromoji en un Worker) y toggles de furigana/romaji. <ruby> construido por
// NODOS del DOM (jamás innerHTML). Ver .claude/rules/{mv3,furigana,karaoke-sync}.md.
import type { LyricsDoc, Line } from '../lib/model';
import { lineText } from '../lib/model';
import type {
  GetByIdMessage,
  GetLyricsMessage,
  GetLyricsResponse,
  ManualCandidate,
  SearchManualMessage,
  SearchManualResponse,
} from '../lib/messaging';
import type { TrackQuery } from '../lib/model';
import { cleanChannel, cleanTitle, parseTrack } from '../lib/normalizer/title';
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
  /** Escala del tamaño de la letra (1 = base). */
  fontScale: number;
  /** Cuántas líneas de karaoke mostrar a la vez (activa + próximas), 1–3. */
  karaokeLines: number;
  /** Opacidad del fondo del overlay (0–1); subir cuando el video no deja leer la letra. */
  bgOpacity: number;
}

export default defineContentScript({
  matches: ['*://www.youtube.com/*'],
  runAt: 'document_idle',

  main(ctx) {
    console.log('[letras-jp] content script cargado en', location.href);

    // Tokenizador: vive toda la sesión del content script (no recarga el diccionario por video).
    let tokenizer: Tokenizer | null = null;
    const settings: Settings = {
      furigana: true,
      romaji: false,
      extraSources: false,
      debug: false,
      fontScale: 1,
      karaokeLines: 2,
      bgOpacity: 0.74,
    };
    const debugLines: string[] = [];
    let enabled = true; // encendido/apagado global (icono de la extensión)
    let offset = 0; // desfase de sincronización por canción (segundos)
    let currentVideoId = '';
    let manualQuery = ''; // búsqueda manual opcional por canción (fallback)

    // Estado vivo por video (se descarta en cada reinicialización SPA).
    let overlay: HTMLElement | null = null;
    let statusEl: HTMLElement | null = null;
    let prevEl: HTMLElement | null = null;
    const kEls: HTMLElement[] = []; // bloque de karaoke (activa + próximas), con furigana
    let romajiEl: HTMLElement | null = null;
    let nextEl: HTMLElement | null = null;
    let furiBtn: HTMLButtonElement | null = null;
    let romaBtn: HTMLButtonElement | null = null;
    let neteaseBtn: HTMLButtonElement | null = null;
    let reloadBtn: HTMLButtonElement | null = null;
    let debugBtn: HTMLButtonElement | null = null;
    let debugEl: HTMLElement | null = null;
    let fontDownBtn: HTMLButtonElement | null = null;
    let fontUpBtn: HTMLButtonElement | null = null;
    let offDownBtn: HTMLButtonElement | null = null;
    let offUpBtn: HTMLButtonElement | null = null;
    let offsetEl: HTMLElement | null = null;
    let linesBtn: HTMLButtonElement | null = null;
    let bgBtn: HTMLButtonElement | null = null;
    let editBtn: HTMLButtonElement | null = null;
    let pickEl: HTMLElement | null = null;
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
        background: `rgba(0, 0, 0, ${settings.bgOpacity})`,
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
      fontDownBtn = makeBtn('A−', false);
      fontDownBtn.title = 'Letra más pequeña';
      fontUpBtn = makeBtn('A+', false);
      fontUpBtn.title = 'Letra más grande';
      offDownBtn = makeBtn('⏪', false);
      offDownBtn.title = 'Atrasar la letra (−0,2 s)';
      offUpBtn = makeBtn('⏩', false);
      offUpBtn.title = 'Adelantar la letra (+0,2 s)';
      offsetEl = document.createElement('span');
      Object.assign(offsetEl.style, { fontSize: '11px', opacity: '0.8', margin: '0 2px', minWidth: '34px', textAlign: 'center' });
      editBtn = makeBtn('✏️', false);
      editBtn.title = 'Búsqueda manual de letra (elige de una lista)';
      linesBtn = makeBtn(`≡${settings.karaokeLines}`, false);
      linesBtn.title = 'Líneas de karaoke a la vez (1–3)';
      bgBtn = makeBtn('🌓', false);
      bgBtn.title = 'Opacidad del fondo (25 → 50 → 75 → 90 %)';

      furiBtn.addEventListener('click', () => toggle('furigana'));
      romaBtn.addEventListener('click', () => toggle('romaji'));
      neteaseBtn.addEventListener('click', () => toggleExtraSources());
      reloadBtn.addEventListener('click', () => kickoff(true));
      debugBtn.addEventListener('click', () => toggleDebug());
      fontDownBtn.addEventListener('click', () => changeFont(-0.1));
      fontUpBtn.addEventListener('click', () => changeFont(+0.1));
      offDownBtn.addEventListener('click', () => changeOffset(-0.2));
      offUpBtn.addEventListener('click', () => changeOffset(+0.2));
      editBtn.addEventListener('click', () => void manualSearch());
      linesBtn.addEventListener('click', () => changeLines());
      bgBtn.addEventListener('click', () => changeBgOpacity());
      bar.append(
        statusEl, furiBtn, romaBtn, neteaseBtn, reloadBtn, debugBtn,
        fontDownBtn, fontUpBtn, linesBtn, bgBtn, offDownBtn, offsetEl, offUpBtn, editBtn,
      );

      prevEl = document.createElement('div');
      romajiEl = document.createElement('div');
      nextEl = document.createElement('div');
      Object.assign(prevEl.style, { fontSize: '15px', opacity: '0.45', textShadow: TEXT_SHADOW });
      Object.assign(romajiEl.style, { fontSize: '13px', opacity: '0.8', display: 'none', textShadow: TEXT_SHADOW });
      Object.assign(nextEl.style, { fontSize: '15px', opacity: '0.45', textShadow: TEXT_SHADOW });

      // Bloque de karaoke: kEls[0] = línea activa (con wipe); kEls[1..] = próximas.
      // width:fit-content + margin auto → la caja se ajusta al texto y queda centrada,
      // así el gradiente del "wipe" coincide con el ancho real del texto.
      kEls.length = 0;
      for (let k = 0; k < 3; k++) {
        const el = document.createElement('div');
        Object.assign(el.style, {
          margin: '2px auto',
          width: 'fit-content',
          maxWidth: '100%',
          fontWeight: k === 0 ? '700' : '400',
          opacity: k === 0 ? '1' : '0.55',
          display: 'none',
        } satisfies Partial<CSSStyleDeclaration>);
        kEls.push(el);
      }

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

      pickEl = document.createElement('div');
      Object.assign(pickEl.style, {
        display: 'none',
        marginTop: '6px',
        paddingTop: '4px',
        borderTop: '1px solid rgba(255,255,255,0.2)',
        textAlign: 'left',
        maxHeight: '160px',
        overflowY: 'auto',
        pointerEvents: 'auto',
      } satisfies Partial<CSSStyleDeclaration>);

      el.append(bar, prevEl, kEls[0]!, romajiEl, kEls[1]!, kEls[2]!, nextEl, pickEl, debugEl);
      document.body.appendChild(el);
      overlay = el;
      applyFontScale();
      updateOffsetDisplay();
      renderDebug();
    }

    // --- Tamaño de fuente y desfase (offset) --------------------------------
    function applyFontScale(): void {
      const s = settings.fontScale;
      if (prevEl) prevEl.style.fontSize = `${15 * s}px`;
      if (kEls[0]) kEls[0].style.fontSize = `${24 * s}px`; // activa, grande
      if (kEls[1]) kEls[1].style.fontSize = `${18 * s}px`; // próximas, medianas
      if (kEls[2]) kEls[2].style.fontSize = `${18 * s}px`;
      if (romajiEl) romajiEl.style.fontSize = `${13 * s}px`;
      if (nextEl) nextEl.style.fontSize = `${15 * s}px`;
    }

    function changeBgOpacity(): void {
      const steps = [0.25, 0.5, 0.74, 0.9];
      const i = steps.findIndex((v) => v > settings.bgOpacity + 0.01);
      settings.bgOpacity = steps[i >= 0 ? i : 0]!; // 25 → 50 → 75 → 90 → 25
      if (overlay) overlay.style.background = `rgba(0, 0, 0, ${settings.bgOpacity})`;
      void browser.storage.local.set({ [SETTINGS_KEY]: settings });
    }

    function changeLines(): void {
      settings.karaokeLines = (settings.karaokeLines % 3) + 1; // 1 → 2 → 3 → 1
      if (linesBtn) linesBtn.textContent = `≡${settings.karaokeLines}`;
      void browser.storage.local.set({ [SETTINGS_KEY]: settings });
      lastIndex = -2;
      if (video) {
        renderAt(nowT());
        updateWipe(nowT());
      }
    }

    function changeFont(delta: number): void {
      settings.fontScale = Math.min(2.5, Math.max(0.6, Math.round((settings.fontScale + delta) * 10) / 10));
      applyFontScale();
      void browser.storage.local.set({ [SETTINGS_KEY]: settings });
    }

    function updateOffsetDisplay(): void {
      if (offsetEl) offsetEl.textContent = `${offset >= 0 ? '+' : ''}${offset.toFixed(1)}s`;
    }

    /** Tiempo efectivo del video con el desfase aplicado. */
    function nowT(): number {
      return video ? video.currentTime + offset : 0;
    }

    function changeOffset(delta: number): void {
      offset = Math.round((offset + delta) * 10) / 10;
      updateOffsetDisplay();
      if (currentVideoId) void browser.storage.local.set({ [`offset:${currentVideoId}`]: offset });
      // Repinta de inmediato con el nuevo desfase.
      lastIndex = -2;
      if (video) {
        renderAt(nowT());
        updateWipe(nowT());
      }
    }

    async function loadOffset(videoId: string): Promise<void> {
      offset = 0;
      try {
        const key = `offset:${videoId}`;
        const got = await browser.storage.local.get(key);
        if (typeof got[key] === 'number') offset = got[key] as number;
      } catch {
        /* sin desfase guardado */
      }
      updateOffsetDisplay();
    }

    // --- Búsqueda manual de letra (fallback con selección) ------------------
    function applyDoc(d: LyricsDoc, label: string): void {
      doc = d;
      lastIndex = -2;
      activeLine = null;
      setStatus(`🎤 ${label}`);
      startLoop();
    }

    /** Si pegan una URL de lrclib.net/search/… extrae el término; si no, el texto tal cual. */
    function extractQuery(input: string): string {
      const m = input.match(/lrclib\.net\/search\/([^?#]+)/i);
      if (m) {
        try {
          return decodeURIComponent(m[1]!).trim();
        } catch {
          return m[1]!.trim();
        }
      }
      return input;
    }

    function durationOrUndef(): number | undefined {
      return video && Number.isFinite(video.duration) ? video.duration : undefined;
    }

    function hidePicker(): void {
      if (pickEl) {
        pickEl.textContent = '';
        pickEl.style.display = 'none';
      }
    }

    async function manualSearch(): Promise<void> {
      if (!currentVideoId) return;
      const input = window.prompt(
        'Búsqueda manual de letra (texto, o pega una URL de lrclib.net/search/…).\nVacío = volver a la búsqueda automática:',
        manualQuery,
      );
      if (input == null) return;
      const q = extractQuery(input.trim());
      if (!q) {
        manualQuery = '';
        await browser.storage.local.remove(`manualPick:${currentVideoId}`);
        hidePicker();
        setStatus('búsqueda manual borrada — re-buscando…');
        void kickoff(true);
        return;
      }
      manualQuery = q;
      hidePicker();
      setStatus('🔎 buscando: ' + q);
      const msg: SearchManualMessage = { type: 'SEARCH_MANUAL', query: q };
      let res: SearchManualResponse;
      try {
        res = (await browser.runtime.sendMessage(msg)) as SearchManualResponse;
      } catch {
        setStatus('⚠️ error en la búsqueda manual');
        return;
      }
      const cands = res?.candidates ?? [];
      dbg(`búsqueda manual "${q}": ${cands.length} resultados`);
      if (cands.length === 0) {
        setStatus('🙈 sin resultados para esa búsqueda');
        return;
      }
      if (cands.length === 1) {
        void pickManual(cands[0]!);
        return;
      }
      renderPicker(cands);
    }

    function renderPicker(cands: ManualCandidate[]): void {
      if (!pickEl) return;
      pickEl.textContent = '';
      const hint = document.createElement('div');
      Object.assign(hint.style, { fontSize: '11px', opacity: '0.7', marginBottom: '4px' });
      hint.textContent = `Elige una versión (${cands.length}):`;
      pickEl.appendChild(hint);
      for (const c of cands.slice(0, 12)) {
        const b = document.createElement('button');
        Object.assign(b.style, {
          display: 'block',
          width: '100%',
          textAlign: 'left',
          cursor: 'pointer',
          pointerEvents: 'auto',
          border: 'none',
          borderRadius: '6px',
          padding: '4px 8px',
          margin: '2px 0',
          background: 'rgba(255,255,255,0.12)',
          color: '#fff',
          font: '12px/1.3 system-ui, sans-serif',
        } satisfies Partial<CSSStyleDeclaration>);
        const dur = c.durationSec ? ` · ${Math.round(c.durationSec)}s` : '';
        b.textContent = `[${c.source}] ${c.artist} — ${c.title}${dur} ${c.hasSynced ? '· sync' : '· texto'}`;
        b.addEventListener('click', () => void pickManual(c));
        pickEl.appendChild(b);
      }
      pickEl.style.display = 'block';
    }

    async function pickManual(c: ManualCandidate): Promise<void> {
      hidePicker();
      setStatus(`🔎 cargando: ${c.artist} — ${c.title}`);
      // Pasamos videoId → el background la cachea; la próxima visita la sirve sin red.
      const msg: GetByIdMessage = {
        type: 'GET_BY_ID',
        source: c.source,
        id: c.id,
        durationSec: durationOrUndef(),
        videoId: currentVideoId || undefined,
      };
      let res: GetLyricsResponse;
      try {
        res = (await browser.runtime.sendMessage(msg)) as GetLyricsResponse;
      } catch {
        setStatus('⚠️ no se pudo cargar esa letra');
        return;
      }
      if (res?.doc && res.doc.lines.length > 0) {
        applyDoc(res.doc, `${res.source} (manual)`);
        dbg(`manual elegido: [${c.source}] ${c.title} · ${res.doc.lines.length} líneas (cacheado)`);
      } else {
        setStatus('🙈 ese resultado no tiene letra usable');
      }
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
      lastIndex = -2; // re-render del bloque con la nueva preferencia
      if (video) {
        renderAt(nowT());
        updateWipe(nowT());
      }
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
          if (typeof s.fontScale === 'number' && s.fontScale > 0) settings.fontScale = s.fontScale;
          if (typeof s.karaokeLines === 'number') settings.karaokeLines = Math.min(3, Math.max(1, Math.round(s.karaokeLines)));
          if (typeof s.bgOpacity === 'number') settings.bgOpacity = Math.min(1, Math.max(0, s.bgOpacity));
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
    // Contorno oscuro para leer sobre fondos claros del video (con el fondo a baja opacidad).
    // NO se aplica a la línea con wipe: su relleno es transparente y la sombra se vería a través.
    const TEXT_SHADOW = '0 1px 2px rgba(0,0,0,0.9), 0 0 6px rgba(0,0,0,0.7)';

    function applyWipeBaseEl(el: HTMLElement): void {
      // El texto se pinta con el gradiente de fondo recortado a las letras.
      el.style.opacity = '1';
      el.style.textShadow = 'none';
      el.style.color = 'transparent';
      el.style.backgroundClip = 'text';
      el.style.setProperty('-webkit-text-fill-color', 'transparent');
      el.style.setProperty('-webkit-background-clip', 'text');
    }

    function clearWipeEl(el: HTMLElement, dim: boolean): void {
      el.style.color = '';
      el.style.backgroundClip = '';
      el.style.backgroundImage = 'none';
      el.style.removeProperty('-webkit-text-fill-color');
      el.style.textShadow = TEXT_SHADOW;
      el.style.opacity = dim ? '0.55' : '1';
    }

    function updateWipe(t: number): void {
      const el = kEls[0];
      if (!el || !activeLine) return;
      const p = (wipeProgress(t, activeLine.tStart, activeLine.tEnd) * 100).toFixed(2);
      el.style.backgroundImage = `linear-gradient(90deg, ${WIPE_BRIGHT} ${p}%, ${WIPE_DIM} ${p}%)`;
    }

    /** Pinta una línea en su elemento; la activa lleva wipe, las próximas van tenues. */
    function renderLineInto(el: HTMLElement, line: Line, isActive: boolean): void {
      const text = lineText(line);
      el.dataset.t = text;
      el.style.display = '';
      if (isActive) {
        applyWipeBaseEl(el);
        if (video) updateWipe(nowT());
      } else {
        clearWipeEl(el, true);
      }
      el.textContent = text; // texto plano ya; mejora con furigana al tokenizar
      if (settings.furigana) {
        ensureTokenizer()
          .tokenize(text)
          .then((tokens) => {
            if (el.dataset.t === text) renderRubyInto(el, tokensToRuby(tokens));
          })
          .catch(() => {});
      }
    }

    function updateRomaji(line: Line): void {
      if (!settings.romaji) {
        showRomaji('');
        return;
      }
      const text = lineText(line);
      ensureTokenizer()
        .tokenize(text)
        .then((tokens) => {
          if (currentText === text) showRomaji(tokensToRomaji(tokens));
        })
        .catch(() => {});
    }

    function clearBlock(): void {
      for (const el of kEls) {
        el.textContent = '';
        el.style.display = 'none';
      }
      activeLine = null;
      currentText = '';
      showRomaji('');
    }

    /** Render del bloque de karaoke a partir de la línea activa `i`. */
    function renderBlock(i: number): void {
      if (!doc) return;
      const lines = doc.lines;
      if (i < 0) {
        clearBlock();
        return;
      }
      const n = Math.min(3, Math.max(1, settings.karaokeLines));
      activeLine = lines[i]!;
      currentText = lineText(lines[i]!);
      for (let k = 0; k < kEls.length; k++) {
        const el = kEls[k]!;
        const line = lines[i + k];
        if (k < n && line) renderLineInto(el, line, k === 0);
        else {
          el.textContent = '';
          el.style.display = 'none';
        }
      }
      updateRomaji(lines[i]!);
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

      const n = Math.min(3, Math.max(1, settings.karaokeLines));
      if (prevEl) prevEl.textContent = i > 0 ? lineText(lines[i - 1]!) : '';
      if (nextEl) nextEl.textContent = i >= 0 && i + n < lines.length ? lineText(lines[i + n]!) : '';
      renderBlock(i);

      // Pre-tokeniza las próximas líneas del bloque + la de después (suaviza transiciones).
      if (settings.furigana || settings.romaji) {
        for (let k = 1; k <= n; k++) {
          const l = lines[i + k];
          if (l) void ensureTokenizer().tokenize(lineText(l)).catch(() => {});
        }
      }
    }

    function loop(): void {
      if (video) {
        const t = nowT(); // tiempo del video + desfase manual
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
      const ytTitle = document.title
        .replace(/^\(\d+\)\s*/, '')
        .replace(/\s*-\s*YouTube\s*$/i, '')
        .trim();
      if (!ytTitle) return null;
      const channelRaw =
        document.querySelector<HTMLElement>(
          'ytd-watch-metadata #owner #channel-name a, #upload-info #channel-name a, ytd-channel-name a',
        )?.textContent?.trim() ?? undefined;
      const channel = channelRaw ? cleanChannel(channelRaw) : undefined;
      // Título completo ya limpio (sin partir) para comparar contra los títulos canónicos.
      const rawTitle = cleanTitle(ytTitle);
      // Partición heurística (artista/título) solo para la búsqueda por campos.
      const { title, artist } = parseTrack(ytTitle, channelRaw);
      const durationSec = video && Number.isFinite(video.duration) ? video.duration : undefined;
      return { title, artist, durationSec, videoId, rawTitle, channel };
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
        if (prevEl) prevEl.textContent = '';
        if (nextEl) nextEl.textContent = '';
        clearBlock();
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
          renderAt(nowT());
          updateWipe(nowT());
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
    async function kickoff(force = false): Promise<void> {
      dbg('título crudo: ' + document.title);
      const query = detectTrack();
      if (!query) {
        setStatus('… esperando metadatos del video');
        dbg('esperando metadatos del video (sin videoId/título/duración aún)');
        return;
      }
      currentVideoId = query.videoId;
      await loadOffset(query.videoId); // desfase guardado para esta canción
      // La elección manual se guarda en la MISMA caché por videoId, así requestLyrics
      // la sirve sin red en la próxima visita.
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
      overlay = statusEl = prevEl = romajiEl = nextEl = debugEl = offsetEl = pickEl = null;
      kEls.length = 0;
      furiBtn = romaBtn = neteaseBtn = reloadBtn = debugBtn = null;
      fontDownBtn = fontUpBtn = offDownBtn = offUpBtn = editBtn = linesBtn = bgBtn = null;
      debugLines.length = 0;
      offset = 0;
      currentVideoId = '';
      manualQuery = '';
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

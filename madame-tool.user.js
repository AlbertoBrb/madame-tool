// ==UserScript==
// @name         Madame Worklist All-in-One (Layout v1 + Engine v5.9) - Refined + Search VIDs
// @namespace    https://tampermonkey.net/
// @version      5.11.1
// @description  Luxury dark dashboard + Worklist engine. Works on /worklist and /search (reads any VID list). Minimal header, worklist title near progress. No-photo highlight refined. Minimized tab draggable + persistent. FULL QC Carousel restored. + Balanced Load All.
// @author       You
// @match        https://madame.ynap.biz/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const GLOBAL_KEY = "__MWL_ALLINONE_LAYOUTV1_ENGINEV59_REFINED_SEARCH__";
  if (window[GLOBAL_KEY]) return;
  window[GLOBAL_KEY] = { version: "5.11.1", startedAt: Date.now() };

  // =========================
  // Routes
  // =========================
  const WORKLIST_RE = /^\/worklist\/\d+/;
  const SEARCH_RE   = /^\/search\b/;

  function isWorklistRoute() { return WORKLIST_RE.test(location.pathname); }
  function isSearchRoute()   { return SEARCH_RE.test(location.pathname); }
  function isSupportedRoute(){ return isWorklistRoute() || isSearchRoute(); }

  // =========================
  // Engine v5.9 constants
  // =========================
  const VID_SELECTOR   = "h4.css-10pdxui";
  const TILE_SELECTOR  = "div.MuiBox-root.css-1dcsz0a";
  const LABEL_SELECTOR = "span[title]";
  const IMG_SELECTOR   = "img.css-1u8qly9";

  const BRAND_IMG_SELECTOR_PRIMARY  = "img.css-18m31dc";
  const BRAND_IMG_SELECTOR_FALLBACK = "img[src*='iris.product.ext.ynapgroup.com/internal/']";

  const REJECTED_BOX_SELECTOR = "div.css-8fpqzo";

  const VID_FALLBACK_SELECTOR = "h4";
  const TILE_FALLBACK_SELECTOR = "div.MuiBox-root";

  const IS_IN = (t) => typeof t === "string" && t.includes("/ IN");
  const IS_OU = (t) => typeof t === "string" && (t.includes("/ OU") || t.includes("/ OUT") || t.includes("/ OUTFIT"));

  const TAGS_OF_INTEREST = ["IN ONLY", "OM ONLY", "MODEL SIZE UNAVAILABLE"];
  const CHIP_LABEL_SELECTOR = "span.MuiChip-label, span[class*='MuiChip-label']";
  const RTW_TAG = "RTW";

  const QC_VIDEO_HEADER_SELECTOR = "div.MuiBox-root.css-45c539";

  // QC
  const QC_WIDTH = 600;
  const QC_VIEW_ORDER = [
    "brand",
    "in","ou","fr","bk","ou2",
    "e1","e2","e3","e4","e5","e6","e7","e8",
    "cu","pr","sw","rw",
    "video"
  ];
  const OVERLAY_VIEWS = new Set(["in","fr","ou","bk","ou2","e1","e2","e3","e4","e5","e6","e7","e8"]);
  const OVERLAY_SP_URL = "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/3x4%20Templates/ACCS.png";

  const REFERENCES = {
    MRP: [
      { name: "CONCRETE 1", url: "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/MP_CONCRETE_408_BACK%205550K.png" },
      { name: "CONCRETE 2", url: "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/MP_CONCRETE_2_358_BACK500K_PRIMOCTO1-4DA%208CM%20SU%20LATO%20SX.png" },
      { name: "TRAVERTINO", url: "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/MP_TRAVERTINO_091.png" },
    ],
    NAP: [
      { name: "MARMO", url: "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_MARMO_337_BACK%205250K%20TINTA%20-0,10_SX%205000K_SECONDO%20SKY%205500K.png" },
      { name: "PARQUET 1", url: "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_PARQUET_1_268_%20SX%204800K%20TINTA%200,15%20-%20BACK%205000K%20TINTA%200.png" },
      { name: "PARQUET 2", url: "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_PARQUET_2_270_FONDO%205000K%20TINTA%200.png" },
      { name: "PARQUET 3", url: "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_PARQUET_3_319_BACK%204000K_SX%204300K%20-0,10_DX%20PRIMO%20SKYP%202%20STRISCE%20UN%20QUARTO%20CTO.png" },
      { name: "PARQUET 4", url: "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_PARQUET_4_303_SX%204850K%20TINTA%20-0,10.png" },
    ],
  };

  const SLOT_CODE_RE = /\/\s*(IN|OU|OU2|BK|FR|CU|PR|SW|RW|E[1-8])\s*$/i;

  // =========================
  // Flags + Telemetry
  // =========================
  const FLAGS_STORE_KEY = "mimo_wl_flags_v1";
  const TELEMETRY_KEY   = "mimo_wl_telemetry_v1";

  const DEFAULT_FLAGS = {
    enableQC: true,
    enableOverlayGuides: true,
    enableReferences: true,
    enableNoPhotoHighlight: true,
    enableRTWVideoKPI: true,
    enableRejectedKPI: true,
    enableShortcuts: true,
    enableHelpOverlay: true,
    enableReportExport: true,
    enableTelemetry: true,
    enableResilienceFallbacks: true,
    enablePerfGating: true
  };

  function loadFlags() {
    try {
      const raw = localStorage.getItem(FLAGS_STORE_KEY);
      if (!raw) return { ...DEFAULT_FLAGS };
      const obj = JSON.parse(raw);
      return { ...DEFAULT_FLAGS, ...(obj && typeof obj === "object" ? obj : {}) };
    } catch {
      return { ...DEFAULT_FLAGS };
    }
  }
  function saveFlags(next) {
    try {
      const cur = loadFlags();
      localStorage.setItem(FLAGS_STORE_KEY, JSON.stringify({ ...cur, ...next }));
    } catch {}
  }
  function loadTelemetry() {
    try {
      const raw = localStorage.getItem(TELEMETRY_KEY);
      const obj = raw ? JSON.parse(raw) : null;
      return (obj && typeof obj === "object") ? obj : { errors: {}, counters: {}, last: null };
    } catch {
      return { errors: {}, counters: {}, last: null };
    }
  }
  function bumpTelemetryError(key) {
    const flags = loadFlags();
    if (!flags.enableTelemetry) return;
    try {
      const t = loadTelemetry();
      t.errors ||= {};
      t.errors[key] = (t.errors[key] || 0) + 1;
      t.last = { type: "error", key, at: Date.now() };
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(t));
    } catch {}
  }
  function bumpTelemetryCounter(key, inc = 1) {
    const flags = loadFlags();
    if (!flags.enableTelemetry) return;
    try {
      const t = loadTelemetry();
      t.counters ||= {};
      t.counters[key] = (t.counters[key] || 0) + inc;
      t.last = { type: "counter", key, at: Date.now() };
      localStorage.setItem(TELEMETRY_KEY, JSON.stringify(t));
    } catch {}
  }
  function safeRun(label, fn, fallbackValue) {
    try { return fn(); } catch { bumpTelemetryError(label); return fallbackValue; }
  }

  // =========================
  // MadameUtils - Balanced Force Load All
  // =========================
  function ensureMadameUtils() {
    window.MadameUtils = window.MadameUtils || {};
    return window.MadameUtils;
  }

  function findScrollableContainer() {
    const specific = document.querySelector('div.MuiBox-root[style*="overflow: auto"]');
    if (specific && specific.clientHeight > 300) return specific;

    let best = document.scrollingElement || document.documentElement;
    let bestScroll = 0;
    const candidates = [
      document.scrollingElement,
      document.documentElement,
      document.body,
      ...document.querySelectorAll("div, main, section")
    ].filter(Boolean);

    for (const el of candidates) {
      const ch = el?.clientHeight || 0;
      const sh = el?.scrollHeight || 0;
      if (sh > ch + 300 && sh > bestScroll) {
        bestScroll = sh;
        best = el;
      }
    }
    return best;
  }

  function isDocScroll(el) {
    return (
      el === document.body ||
      el === document.documentElement ||
      el === document.scrollingElement
    );
  }

  function getScrollTopSafe(scroller) {
    if (isDocScroll(scroller)) return (document.scrollingElement?.scrollTop ?? window.scrollY ?? 0);
    return scroller.scrollTop;
  }

  function setScrollTopSafe(scroller, v) {
    if (isDocScroll(scroller)) document.scrollingElement.scrollTop = v;
    else scroller.scrollTop = v;
  }

  function getClientHSafe(scroller) {
    return isDocScroll(scroller) ? window.innerHeight : (scroller.clientHeight || window.innerHeight);
  }

  function getScrollHSafe(scroller) {
    if (isDocScroll(scroller)) {
      return (document.scrollingElement?.scrollHeight ?? document.documentElement.scrollHeight);
    }
    return scroller.scrollHeight;
  }

  function isPidTextForLoad(t) {
    const s = (t || "").trim();
    return /^\d{10,19}$/.test(s);
  }

  function countUniquePidsMounted() {
    const pidEls = Array.from(document.querySelectorAll("h4")).filter(h => isPidTextForLoad(h.textContent));
    const set = new Set(pidEls.map(h => h.textContent.trim()));
    return set.size;
  }

  async function forceLoadAllBalanced(opts = {}) {
    const scroller = opts.container || findScrollableContainer();

    const pauseA = opts.pauseA ?? 220;
    const pauseB = opts.pauseB ?? 180;
    const maxLoops = opts.maxLoops ?? 600;
    const maxStable = opts.maxStable ?? 5;
    const returnToTop = opts.returnToTop ?? true;

    let cancelled = false;
    const onKeyDown = (e) => { if (e.key === "Escape") cancelled = true; };
    document.addEventListener("keydown", onKeyDown);

    try {
      let lastH = getScrollHSafe(scroller);
      let stableH = 0;

      let lastPidCount = countUniquePidsMounted();
      let stablePid = 0;

      for (let loop = 0; loop < maxLoops; loop++) {
        if (cancelled) break;

        const step = opts.stepPx ?? getClientHSafe(scroller);
        const top = getScrollTopSafe(scroller);
        const h = getScrollHSafe(scroller);
        const ch = getClientHSafe(scroller);
        const maxTop = Math.max(0, h - ch);

        setScrollTopSafe(scroller, Math.min(top + step, maxTop));

        await new Promise(r => setTimeout(r, pauseA));
        await new Promise(r => setTimeout(r, pauseB));

        const top2 = getScrollTopSafe(scroller);
        const h2 = getScrollHSafe(scroller);
        const pct = Math.min(99, Math.round(((top2 + ch) / h2) * 100));
        if (typeof opts.onProgress === "function") opts.onProgress({ loop, percent: pct, height: h2 });

        const nearBottom = top2 >= (h2 - ch - 30);

        if (nearBottom) {
          if (Math.abs(h2 - lastH) < 2) stableH++;
          else stableH = 0;
          lastH = h2;

          const pidCount = countUniquePidsMounted();
          if (pidCount === lastPidCount) stablePid++;
          else stablePid = 0;
          lastPidCount = pidCount;

          if (stableH >= maxStable && stablePid >= maxStable) break;
        }
      }

      if (returnToTop) setScrollTopSafe(scroller, 0);
    } finally {
      document.removeEventListener("keydown", onKeyDown);
    }
  }

  {
    const u = ensureMadameUtils();
    if (!u.forceLoadAllBalanced) u.forceLoadAllBalanced = forceLoadAllBalanced;
    if (!u.findScrollableContainer) u.findScrollableContainer = findScrollableContainer;
  }

  // =========================
  // Layout v1 constants + persistence
  // =========================
  const PANEL_ID = "mwl-status-panel";
  const TAB_ID   = "mwl-status-tab";
  const ATTR_NEXT    = "data-mwl-next";
  const ATTR_NOPHOTO = "data-mwl-nophoto";

  const STORE_KEY = "MWL_PANEL_STATE_LAYOUTV1_ENGINEV59";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const qs = (sel, root = document) => root.querySelector(sel);
  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const pct = (part, total) => total ? Math.round((part / total) * 100) : 0;

  function safeJsonParse(str, fallback) { try { return JSON.parse(str); } catch { return fallback; } }
  function loadPanelState() {
    const raw = localStorage.getItem(STORE_KEY);
    const st = safeJsonParse(raw, null);
    return st && typeof st === "object"
      ? st
      : { x: null, y: null, w: 420, h: 560, minimized: false, tabX: null, tabY: null };
  }
  function savePanelState(partial) {
    const curr = loadPanelState();
    localStorage.setItem(STORE_KEY, JSON.stringify({ ...curr, ...partial }));
  }

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) {
      if (c == null) continue;
      if (typeof c === "string") n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    }
    return n;
  }

  function looksLikeVID(text) { return /^\d{15,}$/.test(String(text || "").trim()); }

  function getTextById(id) {
    const n = document.getElementById(id);
    return n ? String(n.textContent || "").trim() : "";
  }
  function getAriaById(id) {
    const n = document.getElementById(id);
    return n ? String(n.getAttribute("aria-label") || "").trim() : "";
  }

  function copyToClipboard(text) {
    const t = String(text ?? "");
    if (!t) return false;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(t).catch(() => fallbackCopy(t));
      return true;
    }
    return fallbackCopy(t);

    function fallbackCopy(s) {
      const ta = el("textarea", { style: { position: "fixed", left: "-9999px", top: "-9999px" } }, [s]);
      document.body.appendChild(ta);
      ta.select();
      let ok = false;
      try { ok = document.execCommand("copy"); } catch { ok = false; }
      ta.remove();
      return ok;
    }
  }

  function isEditableTarget(elm) {
    if (!elm) return false;
    const tag = (elm.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
    if (elm.isContentEditable) return true;
    return false;
  }

  // =========================
  // Engine state
  // =========================
  let activeMode = "overall";

  let focus = { type: "missing", value: "" };
  let focusList = [];
  let focusPtr = 0;

  let lastHighlightedEl = null;

  let updateScheduled = false;
  let updateTimer = null;
  let observer = null;
  let scrollAttached = false;
  let mounted = false;

  let lastAnalyses = [];
  let lastKPIs = null;
  let lastTagCounts = null;
  let helpOpen = false;
  let settingsOpen = false;

  let lastOverallPercent = 0;
  let lastTrafficText = "In progress";

  let activeUIKey = "focus:missing";

  function setActiveUIKey(key) {
    activeUIKey = String(key || "");
    try { localStorage.setItem("MWL_ACTIVE_UI_KEY_V594", activeUIKey); } catch {}
    applyActiveStyles();
  }
  function loadActiveUIKey() {
    try {
      const raw = localStorage.getItem("MWL_ACTIVE_UI_KEY_V594");
      if (raw) activeUIKey = raw;
    } catch {}
  }

  function applyActiveStyles() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    qsa("[data-ui-key]", panel).forEach(n => n.classList.remove("is-active"));

    const active = panel.querySelector(`[data-ui-key="${CSS.escape(activeUIKey)}"]`);
    if (active) active.classList.add("is-active");
  }

  function updateFocusAlertPills() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    qsa(".mwl-pill[data-focus]", panel).forEach(p => {
      const c = p.querySelector(".mwl-count");
      const v = c ? parseInt((c.textContent || "0").trim(), 10) : NaN;
      const isAlert = Number.isFinite(v) && v > 0;
      p.classList.toggle("is-alert", isAlert);
    });
  }

  // =========================
  // v5.9 analysis helpers
  // =========================
  function findProductRootFromVidNode(vidNode) {
    let node = vidNode;
    for (let i = 0; i < 12 && node; i++) {
      node = node.parentElement;
      if (!node) break;

      const tiles = node.querySelectorAll(TILE_SELECTOR);
      if (!tiles || tiles.length === 0) continue;

      const vidsInside = Array.from(node.querySelectorAll(VID_SELECTOR))
        .map(n => (n.textContent || "").trim())
        .filter(looksLikeVID);

      if (vidsInside.length === 1) return node;
    }
    return null;
  }

  function getVIDsFromSearch() {
    const nodes = Array.from(document.querySelectorAll("h1,h2,h3,h4,h5,h6,div,span,a,td,li,p"));
    const vids = new Map();
    const re = /\b\d{10,}\b/g;

    for (const n of nodes) {
      const txt = (n.textContent || "").trim();
      if (!txt) continue;

      const matches = txt.match(re);
      if (!matches) continue;

      for (const m of matches) {
        if (!/^\d{10,}$/.test(m)) continue;
        if (!vids.has(m)) vids.set(m, n);
      }
    }

    return Array.from(vids.entries()).map(([vid, node]) => ({
      vid,
      root: node.closest("div") || node
    }));
  }

  function getProducts() {
    const flags = loadFlags();

    if (isSearchRoute()) {
      return getVIDsFromSearch();
    }

    const primary = qsa(VID_SELECTOR).filter(n => looksLikeVID(n.textContent));
    let vidNodes = primary;

    if (flags.enableResilienceFallbacks && vidNodes.length === 0) {
      const h4s = qsa(VID_FALLBACK_SELECTOR);
      vidNodes = h4s.filter(n => looksLikeVID((n.textContent || "").trim()));
      if (vidNodes.length) bumpTelemetryCounter("fallback_vid_selector_used", 1);
    }

    const products = [];
    for (const vn of vidNodes) {
      const root = findProductRootFromVidNode(vn) || (vn.closest("div") || vn.parentElement);
      if (!root) continue;
      if (products.some(p => p.root === root)) continue;
      products.push({ vid: (vn.textContent || "").trim(), root });
    }
    return products;
  }

  function analyzeProduct(product) {
    const flags = loadFlags();
    let tiles = qsa(TILE_SELECTOR, product.root);

    if (flags.enableResilienceFallbacks && tiles.length === 0) {
      const all = qsa(TILE_FALLBACK_SELECTOR, product.root);
      tiles = all.filter(t => {
        if (t.querySelector(LABEL_SELECTOR)) return true;
        if (t.querySelector(QC_VIDEO_HEADER_SELECTOR)) return true;
        if (t.querySelector(IMG_SELECTOR)) return true;
        return false;
      });
      if (tiles.length) bumpTelemetryCounter("fallback_tile_selector_used", 1);
    }

    let hasINShot=false, hasOUShot=false, hasINSlot=false, hasOUSlot=false, hasVideo=false, hasRejected=false;

    for (const tile of tiles) {
      const label = qs(LABEL_SELECTOR, tile);
      const title = label ? (label.getAttribute("title") || "") : "";

      if (IS_IN(title)) {
        hasINSlot = true;
        if (tile.querySelector(IMG_SELECTOR)) hasINShot = true;
      } else if (IS_OU(title)) {
        hasOUSlot = true;
        if (tile.querySelector(IMG_SELECTOR)) hasOUShot = true;
      }

      if (!hasVideo) {
        const hdr = tile.querySelector(QC_VIDEO_HEADER_SELECTOR);
        const hdrText = hdr ? (hdr.textContent || "").trim() : "";
        const byHeader = /video/i.test(hdrText);
        const hasPreview = !!tile.querySelector(IMG_SELECTOR);
        if (byHeader && hasPreview) hasVideo = true;
      }

      if (!hasRejected) {
        if (tile.querySelector(REJECTED_BOX_SELECTOR)) hasRejected = true;
      }

      if (hasINShot && hasOUShot && hasVideo && hasRejected) break;
    }

    return { hasINSlot, hasOUSlot, hasINShot, hasOUShot, hasVideo, hasRejected };
  }

  function isMissingInMode(a) {
    const missingIN = a.hasINSlot && !a.hasINShot;
    const missingOU = a.hasOUSlot && !a.hasOUShot;
    return missingIN || missingOU;
  }

  function hasNoPhotosAtAll(a) {
    const inExists = a.hasINSlot;
    const ouExists = a.hasOUSlot;
    const inEmpty = inExists ? !a.hasINShot : true;
    const ouEmpty = ouExists ? !a.hasOUShot : true;
    return inEmpty && ouEmpty;
  }

  function getProductTags(productRoot) {
    const set = new Set();
    const nodes = qsa(CHIP_LABEL_SELECTOR, productRoot);
    for (const n of nodes) {
      const t = (n.textContent || "").trim();
      if (!t) continue;
      set.add(t.toUpperCase());
    }
    return set;
  }

  function getHighlightTarget(root) {
    if (!root || !root.isConnected) return root;
    let n = root;
    for (let i = 0; i < 8 && n; i++) {
      const r = n.getBoundingClientRect();
      if (r.width >= 500 && r.height >= 120) return n;
      n = n.parentElement;
    }
    n = root;
    for (let i = 0; i < 8 && n; i++) {
      const r = n.getBoundingClientRect();
      if (r.width >= 350 && r.height >= 90) return n;
      n = n.parentElement;
    }
    return root;
  }

  // =========================
  // Focus + actions
  // =========================
  function buildFocusList(analyses) {
    const type = focus?.type || "missing";
    const val = (focus?.value || "").toUpperCase();

    if (type === "tag") return analyses.filter(x => x.tags?.has(val));
    if (type === "inToShoot") return analyses.filter(x => x.a.hasINSlot && !x.a.hasINShot);
    if (type === "ouToShoot") return analyses.filter(x => x.a.hasOUSlot && !x.a.hasOUShot);
    if (type === "rtwVideoMissing") return analyses.filter(x => x.tags?.has(RTW_TAG) && !x.a.hasVideo);
    if (type === "rejected") return analyses.filter(x => x.a.hasRejected);

    return analyses.filter(x => isMissingInMode(x.a));
  }

  function listLabel() {
    if (isSearchRoute()) return "VIDs on search";
    if (focus.type === "tag") return `Tag: ${focus.value}`;
    if (focus.type === "inToShoot") return "IN to shoot";
    if (focus.type === "ouToShoot") return "OU to shoot";
    if (focus.type === "rtwVideoMissing") return "RTW VIDEO missing";
    if (focus.type === "rejected") return "Rejected";
    return "Missing";
  }

  function clearLastHighlight() {
    if (lastHighlightedEl && lastHighlightedEl.isConnected) lastHighlightedEl.classList.remove("mwl-focus-highlight");
    if (lastHighlightedEl && lastHighlightedEl.isConnected) lastHighlightedEl.removeAttribute(ATTR_NEXT);
    lastHighlightedEl = null;
  }
  function setNextHighlight(elm) {
    clearLastHighlight();
    if (!elm) return;
    elm.setAttribute(ATTR_NEXT, "1");
    elm.classList.add("mwl-focus-highlight");
    lastHighlightedEl = elm;
  }

  function goNextInFocus(showEmptyAlert = true) {
    updateCounts(false);
    if (!focusList.length) {
      if (showEmptyAlert) alert(`No items found for: ${listLabel()}.`);
      return;
    }
    if (focusPtr >= focusList.length) focusPtr = 0;

    const item = focusList[focusPtr++];
    item.root.scrollIntoView({ behavior: "smooth", block: "center" });
    setNextHighlight(getHighlightTarget(item.root));
    updateHeaderCompact();
  }

  function copyVIDsInFocus() {
    updateCounts(false);
    const vids = focusList.map(x => x.vid).filter(Boolean);
    if (!vids.length) {
      alert(`No VIDs to copy for: ${listLabel()}.`);
      return;
    }
    copyToClipboard(vids.join("\n"));
    toast(`Copied ${vids.length} VID(s) • ${listLabel()}`);
  }

  function copyMissingVIDs() {
    updateCounts(false);

    if (isSearchRoute()) {
      const products = safeRun("copy_missing_search_products", () => getProducts(), []);
      const vids = products.map(p => p.vid).filter(Boolean);
      if (!vids.length) {
        alert("No VIDs detected yet.\nTip: scroll a bit to load items, then retry.");
        return;
      }
      copyToClipboard(vids.join("\n"));
      toast(`Copied ${vids.length} VID(s) • Search VIDs`);
      return;
    }

    const analyses = (lastAnalyses || []);
    const missing = analyses.filter(x => x?.a && isMissingInMode(x.a));
    const vids = missing.map(x => x.vid).filter(Boolean);

    if (!vids.length) {
      alert("No missing VIDs detected yet.\nTip: scroll a bit to load items, then retry.");
      return;
    }

    copyToClipboard(vids.join("\n"));
    toast(`Copied ${vids.length} VID(s) • Missing`);
  }

  function copyAllVIDs() {
    if (!isSupportedRoute()) return;
    const products = getProducts();
    const vids = products.map(p => p.vid).filter(Boolean);
    if (!vids.length) {
      alert("No VIDs detected yet.\nTip: scroll a bit to load items, then retry.");
      return;
    }
    copyToClipboard(vids.join("\n"));
    toast(`Copied ${vids.length} VID(s) • All detected items`);
  }

  function setFocus(nextFocus, doJump = true) {
    focus = { ...nextFocus };
    focusPtr = 0;
    saveEngineState();

    if (focus.type === "tag") setActiveUIKey(`tag:${String(focus.value || "").toUpperCase()}`);
    else setActiveUIKey(`focus:${focus.type}`);

    updateCounts(true);
    if (doJump) goNextInFocus(false);
  }

  function saveEngineState() {
    try {
      localStorage.setItem("MWL_ENGINE_STATE_V59", JSON.stringify({ activeMode, focus }));
    } catch {}
  }
  function loadEngineState() {
    try {
      const raw = localStorage.getItem("MWL_ENGINE_STATE_V59");
      const obj = raw ? JSON.parse(raw) : null;
      if (obj && typeof obj === "object") {
        if (obj.focus && typeof obj.focus === "object") focus = { type: obj.focus.type || "missing", value: obj.focus.value || "" };
      }
    } catch {}
  }

  // =========================
  // Header + loading chip
  // =========================
  function parseVariantsTotal() {
    const s = getAriaById("info-box-1") || getTextById("info-box-1") || "";
    const m = s.match(/Number of variants:\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  const RED_THRESHOLD = 80;

  function updateLoadingChip(loaded, totalVariants) {
    const chip = qs("#mwl-loadchip");
    if (!chip) return;

    if (isSearchRoute()) { chip.style.display = "none"; chip.textContent = ""; return; }

    const showTotal = (typeof totalVariants === "number" && totalVariants >= 0);
    if (!showTotal) { chip.style.display = "none"; chip.textContent = ""; return; }

    const remaining = Math.max(0, totalVariants - loaded);
    if (remaining === 0) { chip.style.display = "none"; chip.textContent = ""; return; }

    chip.style.display = "inline-flex";
    chip.classList.toggle("is-red", remaining > RED_THRESHOLD);
    chip.classList.toggle("is-amber", remaining <= RED_THRESHOLD);
    chip.textContent = `Scroll remaining: −${remaining}`;
    chip.title = `Scroll to load ${remaining} more item(s)`;
  }

  function getChannelName() {
    const ch = (getTextById("tool-channel") || "").trim();
    return ch || "Dashboard";
  }

  function updateHeaderCompact() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;

    const titleEl = panel.querySelector("#mwl-title");
    const wlLine = panel.querySelector("#mwl-wlline");
    const tabTitle = document.getElementById("mwl-tabtitle");
    const tabSub = document.getElementById("mwl-tabsub");

    if (titleEl) titleEl.textContent = getChannelName();

    if (isSearchRoute()) {
      const products = safeRun("hdr_search_count", () => getProducts(), []);
      const label = `${products.length} VIDs`;
      if (wlLine) wlLine.textContent = `Search - ${label}`;
    } else {
      const wlName = (getTextById("info-box-0") || getAriaById("info-box-0") || "").trim();
      const total = parseVariantsTotal();
      const label = (typeof total === "number" && !Number.isNaN(total)) ? `${total} VIDs` : "";
      const essential = [wlName, label].filter(Boolean).join(" - ") || "—";
      if (wlLine) wlLine.textContent = essential;
    }

    if (tabTitle) tabTitle.textContent = "Dashboard";
    if (tabSub) tabSub.textContent = `List in progress`;
  }

  function trafficColor(overallPercent){
    let bg = "#ff5d5d", ring = "rgba(255,93,93,0.16)", text = "Behind";
    if (overallPercent >= 80) { bg = "#67e08a"; ring = "rgba(103,224,138,0.16)"; text = "On track"; }
    else if (overallPercent >= 40) { bg = "#ffcc66"; ring = "rgba(255,204,102,0.16)"; text = "In progress"; }
    return { bg, ring, text };
  }

  function setTrafficAndStatus(overallPercent) {
    lastOverallPercent = overallPercent;
    const t = trafficColor(overallPercent);
    lastTrafficText = t.text;

    const dot = qs(`#${PANEL_ID} .mwl-dot`);
    if (dot) {
      dot.style.background = t.bg;
      dot.style.boxShadow = `0 0 0 3px ${t.ring}`;
    }
    const tabDot = qs(`#${TAB_ID} .mwl-dotmini`);
    if (tabDot) tabDot.style.background = t.bg;

    const statusChip = qs("#mwl-statuschip");
    if (statusChip) {
      statusChip.textContent = `${t.text} · ${overallPercent}%`;
    }
  }

  // =========================
  // NoPhoto highlight
  // =========================
  function applyNoPhotoHighlight(targetEl, shouldHighlight) {
    const flags = loadFlags();
    if (!flags.enableNoPhotoHighlight) return;
    if (!targetEl) return;
    if (shouldHighlight) targetEl.setAttribute(ATTR_NOPHOTO, "1");
    else targetEl.removeAttribute(ATTR_NOPHOTO);
  }

  // =========================
  // Export + QC viewer
  // =========================
  function dlFile(filename, mime, content) {
    try {
      const blob = new Blob([content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      bumpTelemetryError("download_failed");
      alert("Export failed (download).");
    }
  }
  function htmlEscape(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function absUrl(urlLike) {
    if (!urlLike) return "";
    if (urlLike.startsWith("http://") || urlLike.startsWith("https://")) return urlLike;
    if (urlLike.startsWith("/")) return location.origin + urlLike;
    return urlLike;
  }
  function bumpWidth(urlLike, w) {
    try {
      const abs = absUrl(urlLike);
      const u = new URL(abs);
      if (u.searchParams.has("width")) u.searchParams.set("width", String(w));
      else u.searchParams.append("width", String(w));
      return u.toString();
    } catch {
      return urlLike;
    }
  }
  function bumpIrisThumb(urlLike, w) {
    const s = String(urlLike || "");
    return s.replace(/\/w(\d+)\.jpg(\?.*)?$/i, `/w${w}.jpg$2`);
  }

  function exportReportXls() {
    const flags = loadFlags();
    if (!flags.enableReportExport) return;

    updateCounts(false);

    const wlName = (getTextById("info-box-0") || getAriaById("info-box-0") || (isSearchRoute() ? "Search" : "Worklist")).trim();
    const variants = parseVariantsTotal();
    const when = new Date();

    const qc = safeRun("export_extractQC", () => extractQCMap_Surgical(), { vids: [], views: [], map: {}, loadedCount: 0 });

    const k = lastKPIs || {};
    const analyses = (lastAnalyses || []).slice().sort((a,b)=>String(a.vid).localeCompare(String(b.vid)));

    const safeWl = (wlName || "worklist").replace(/[^\w\-]+/g, "_").slice(0, 40);
    const fname = `Madame_Worklist_Report_${safeWl}_${when.toISOString().slice(0,10)}.xls`;

    const SLOT_COLS = [
      { label: "Brand image", view: "brand" },
      { label: "Front Still Life / IN", view: "in" },
      { label: "Outfit 1 / OU", view: "ou" },
      { label: "Front Model / FR", view: "fr" },
      { label: "Back Still Life / BK", view: "bk" },
      { label: "Outfit 2 / OU2", view: "ou2" },
      { label: "Detail 1 / CU", view: "cu" },
      { label: "Detail 2 / E1", view: "e1" },
      { label: "Detail 3 / E2", view: "e2" },
      { label: "Detail 4 / E3", view: "e3" },
      { label: "Extra 1 / E4", view: "e4" },
      { label: "Extra 2 / E5", view: "e5" },
      { label: "Runway / RW", view: "rw" },
      { label: "Swatch / SW", view: "sw" },
      { label: "Press / PR", view: "pr" },
      { label: "Video / VIDEO", view: "video" },
    ];

    const CHECK = "✓";
    const XMARK = "✗";

    const thead = `
      <tr>
        <th>VID</th>
        ${SLOT_COLS.map(c => `<th>${htmlEscape(c.label)}</th>`).join("")}
      </tr>
    `;

    const rowsHtml = analyses.map(x => {
      const vid = String(x.vid || "").trim();
      const perVid = (qc && qc.map && qc.map[vid]) ? qc.map[vid] : {};
      const cells = SLOT_COLS.map(c => {
        const ok = !!(perVid && perVid[c.view] && perVid[c.view].srcQC);
        return `<td class="${ok ? "ok" : "bad"}">${ok ? CHECK : XMARK}</td>`;
      }).join("");

      return `
        <tr>
          <td class="mono vid" style="mso-number-format:'\\@';">${htmlEscape(vid)}</td>
          ${cells}
        </tr>
      `;
    }).join("");

    const html = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>Madame Worklist Report</title>
<style>
  body{font-family: Calibri, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;color:#111827;margin:20px;}
  .title{ font-size:16px; font-weight:800; letter-spacing:.02em; margin-bottom:8px; }
  .sub{ font-size:11px; color:rgba(17,24,39,.68); margin-bottom:14px; }
  table{ border-collapse:collapse; width:100%; }
  th, td{ border:1px solid rgba(15,23,42,.12); padding:6px 8px; font-size:11px; vertical-align:middle; text-align:center; white-space:nowrap; }
  th{ background:#F3F4F6; font-weight:800; letter-spacing:.02em; }
  .meta td{ border:none; padding:2px 0; font-size:11px; text-align:left; white-space:normal; }
  .meta .k{ color:rgba(17,24,39,.62); width:180px; padding-right:10px; }
  .mono{ font-family: Consolas, ui-monospace, SFMono-Regular, Menlo, Monaco, "Liberation Mono", monospace; }
  td.vid{ text-align:left; }
  .ok{ background: rgba(34,197,94,0.08); font-weight:900; }
  .bad{ background: rgba(239,68,68,0.08); font-weight:900; }
  .spacer{ height:10px; }
</style>
</head>
<body>
  <div class="title">Madame Worklist Report</div>
  <div class="sub">Luxury minimal export · per VID slot checklist (✓ done / ✗ missing)</div>

  <table class="meta">
    <tr><td class="k">Source</td><td>${htmlEscape(isSearchRoute() ? "Search" : "Worklist")}</td></tr>
    <tr><td class="k">Worklist/Search</td><td>${htmlEscape(wlName)}</td></tr>
    <tr><td class="k">Variants (header)</td><td>${htmlEscape(variants ?? "n/a")}</td></tr>
    <tr><td class="k">Generated (ISO)</td><td>${htmlEscape(when.toISOString())}</td></tr>
    <tr><td class="k">Loaded (DOM)</td><td>${htmlEscape(k.loaded ?? 0)}</td></tr>
    <tr><td class="k">RTW</td><td>${htmlEscape(String(k.catRTW ?? 0))}</td></tr>
    <tr><td class="k">ACC</td><td>${htmlEscape(String(k.catACC ?? 0))}</td></tr>
    <tr><td class="k">RTW VIDEO</td><td>${htmlEscape(`${k.rtwWithVideo ?? 0}/${k.rtwTotal ?? 0} · missing ${k.rtwMissing ?? 0}`)}</td></tr>
    <tr><td class="k">Rejected</td><td>${htmlEscape(String(k.rejectedLoaded ?? 0))}</td></tr>
  </table>

  <div class="spacer"></div>

  <table>
    <thead>${thead}</thead>
    <tbody>${rowsHtml}</tbody>
  </table>
</body>
</html>`;

    dlFile(fname, "application/vnd.ms-excel;charset=utf-8", "\ufeff" + html);
    bumpTelemetryCounter("export_report_slot_checklist_xls", 1);
  }

  function codeToView(code) { return (code || "").toLowerCase(); }

  function findTightProductContainer(vidEl) {
    let node = vidEl;
    for (let i = 0; i < 14 && node; i++) {
      const parent = node.parentElement;
      if (!parent) break;

      const numericH4s = Array.from(parent.querySelectorAll("h4"))
        .map(h => (h.textContent || "").trim())
        .filter(t => /^\d{10,}$/.test(t));

      const hasThisVid = numericH4s.includes((vidEl.textContent || "").trim());
      const hasOnlyOneVid = numericH4s.length <= 1;

      const hasRealSlot = Array.from(parent.querySelectorAll("span[title]"))
        .some(s => SLOT_CODE_RE.test(s.getAttribute("title") || ""));

      const hasVideoTile = Array.from(parent.querySelectorAll(TILE_SELECTOR))
        .some(tile => {
          const h = tile.querySelector(QC_VIDEO_HEADER_SELECTOR);
          const txt = (h && h.textContent) ? h.textContent.trim() : "";
          return /video/i.test(txt);
        });

      if (hasThisVid && hasOnlyOneVid && (hasRealSlot || hasVideoTile)) return parent;
      node = parent;
    }
    return vidEl.closest("div") || vidEl.parentElement;
  }

  function extractBrandImageSrc(productRoot) {
    const img =
      productRoot.querySelector(BRAND_IMG_SELECTOR_PRIMARY) ||
      productRoot.querySelector(BRAND_IMG_SELECTOR_FALLBACK);
    if (!img) return "";
    return img.getAttribute("src") || "";
  }

  function extractQCMap_Surgical() {
    const map = {};
    const viewsFound = new Set();

    const vidEls = Array.from(document.querySelectorAll("h4"))
      .filter(h => /^\d{10,}$/.test((h.textContent || "").trim()));

    for (const vidEl of vidEls) {
      const vid = (vidEl.textContent || "").trim();
      if (!vid) continue;

      const product = findTightProductContainer(vidEl);
      if (!product) continue;

      map[vid] ||= {};

      const brandSrc = extractBrandImageSrc(product);
      if (brandSrc) {
        const hi = bumpIrisThumb(brandSrc, QC_WIDTH);
        map[vid]["brand"] = { srcQC: absUrl(hi) };
        viewsFound.add("brand");
      }

      const slotLabels = Array.from(product.querySelectorAll("span[title]"))
        .filter(s => SLOT_CODE_RE.test(s.getAttribute("title") || ""));

      for (const label of slotLabels) {
        const title = (label.getAttribute("title") || "").trim();
        const m = title.match(SLOT_CODE_RE);
        if (!m) continue;

        const view = codeToView(m[1]);
        viewsFound.add(view);

        let slot = label.closest("div");
        for (let j = 0; j < 7 && slot; j++) {
          const hasImg = slot.querySelector(IMG_SELECTOR);
          const hasEmpty = slot.querySelector("div.css-12n9byu");
          if (hasImg || hasEmpty) break;
          slot = slot.parentElement;
        }
        if (!slot) continue;

        const img = slot.querySelector(IMG_SELECTOR);
        if (!img) continue;

        const src = img.getAttribute("src") || "";
        if (!src) continue;

        const srcQC = bumpWidth(src, QC_WIDTH);
        if (!map[vid][view] || map[vid][view].srcQC === srcQC) {
          map[vid][view] = { srcQC: absUrl(srcQC) };
        }
      }

      const tiles = Array.from(product.querySelectorAll(TILE_SELECTOR));
      for (const tile of tiles) {
        const hdr = tile.querySelector(QC_VIDEO_HEADER_SELECTOR);
        const hdrText = hdr ? (hdr.textContent || "").trim() : "";
        if (!/video/i.test(hdrText)) continue;

        const img = tile.querySelector(IMG_SELECTOR);
        if (!img) continue;

        const src = img.getAttribute("src") || "";
        if (!src) continue;

        const srcQC = bumpWidth(src, QC_WIDTH);
        viewsFound.add("video");

        if (!map[vid]["video"] || map[vid]["video"].srcQC === srcQC) {
          map[vid]["video"] = { srcQC: absUrl(srcQC) };
        }
      }
    }

    const vids = Object.keys(map).filter(v => Object.keys(map[v] || {}).length > 0);
    const orderedViews = [
      ...QC_VIEW_ORDER.filter(v => viewsFound.has(v)),
      ...Array.from(viewsFound).filter(v => !QC_VIEW_ORDER.includes(v)).sort()
    ];
    const loadedCount = vids.filter(v => Object.values(map[v] || {}).some(x => x?.srcQC)).length;
    return { vids, views: orderedViews, map, loadedCount };
  }

  function resolveBrandKey() {
    const ch = (getTextById("tool-channel") || "").toUpperCase();
    if (ch.includes("MR")) return "MRP";
    return "NAP";
  }

  function openQCViewer() {
    const flags = loadFlags();
    if (!flags.enableQC) return;
    if (!isWorklistRoute()) {
      alert("QC Carousel is available on /worklist pages.");
      return;
    }

    updateCounts(false);

    const data = extractQCMap_Surgical();
    if (!data.vids.length) {
      alert("No products/images detected yet.\nTip: scroll a bit to load items, then try again.");
      return;
    }

    const wlName = htmlEscape(getTextById("info-box-0") || "Worklist");
    const channelRaw = htmlEscape(getTextById("tool-channel") || "NET-A-PORTER");
    const brandKey = resolveBrandKey();

    const total = parseVariantsTotal();
    const loaded = data.loadedCount;
    const t = (typeof total === "number" && total > 0) ? total : null;
    const ratio = t ? (loaded / t) : null;

    let status = "partial";
    if (!t) status = "unknown";
    else if (loaded >= t) status = "ok";
    else if (ratio !== null && ratio < 0.5) status = "low";
    else status = "partial";

    const missing = (t && loaded < t) ? (t - loaded) : 0;
    const showMissing = Boolean(t && status !== "ok");

    const w = window.open("about:blank", "_blank");
    if (!w) {
      alert("Popup blocked. Allow popups for madame.ynap.biz and retry.");
      return;
    }

    const doc = w.document;
    doc.open();
    doc.write(buildQCHtml({ data, wlName, channelRaw, brandKey, status, loaded, t, missing, showMissing }));
    doc.close();
  }

  function buildQCHtml({ data, wlName, channelRaw, brandKey, status, loaded, t, missing, showMissing }) {
    return `<!doctype html><html><head><meta charset="utf-8">
      <title>QC Carousel</title>
      <base href="${location.origin}/">
      <style>
        :root{
          --bg:#ffffff; --text:#0b0c0f; --muted:#6b7280;
          --line:rgba(15,23,42,.12); --black:#07080a;
          --ok:rgb(16,185,129); --am:rgb(245,158,11); --rd:rgb(239,68,68); --un:rgb(148,163,184);
        }
        html,body{margin:0;padding:0;background:var(--bg);color:var(--text);
          font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}

        .topbar{
          position:sticky;top:0;z-index:30;background:var(--black);color:#fff;
          padding:14px 18px 12px;border-bottom:1px solid rgba(255,255,255,.10);
        }
        .row1{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .leftRow{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
        .brand{font-weight:800;letter-spacing:.24em;font-size:12px;text-transform:uppercase;line-height:1;opacity:.96;}

        .pill{
          display:inline-flex;align-items:center;gap:8px;
          padding:7px 10px;border-radius:999px;
          border:1px solid rgba(255,255,255,.18);
          background:rgba(255,255,255,.08);
          backdrop-filter:blur(10px) saturate(140%);
          color:#fff;white-space:nowrap;
        }
        .dot{width:8px;height:8px;border-radius:999px;background:var(--un);opacity:.95;}
        .pill.ok .dot{background:var(--ok);}
        .pill.partial .dot{background:var(--am);}
        .pill.low .dot{background:var(--rd);}
        .pill.unknown .dot{background:var(--un);}
        .pillText{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.92;}
        .pillCount{font-weight:800;font-size:11.5px;letter-spacing:.08em;}
        .pillMiss{margin-left:8px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.72;}

        .actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}
        .btn{
          display:inline-flex;align-items:center;justify-content:center;
          height:30px; padding:0 12px;
          border-radius:999px;
          border:1px solid rgba(255,255,255,.18);
          background:rgba(255,255,255,.06);
          color:#fff;
          font: 800 11px -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
          letter-spacing:.16em;
          text-transform:uppercase;
          cursor:pointer;
          user-select:none;
        }
        .btn:hover{background:rgba(255,255,255,.10);}
        .btn.on{
          background:rgba(255,255,255,.92);
          color:#07080a;
          border-color:rgba(255,255,255,.92);
        }
        .btnX{
          width:30px; padding:0;
          border-radius:999px;
          font-weight:900;
          letter-spacing:0;
          background:rgba(255,255,255,.06);
        }
        .btnX:hover{background:rgba(255,255,255,.10);}

        .row2{margin-top:10px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
        .channel{font-weight:700;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.78;line-height:1.1;white-space:nowrap;}
        .sep{opacity:.35;letter-spacing:.14em;}
        .wlTitle{font-weight:650;font-size:14px;letter-spacing:.01em;line-height:1.2;opacity:.96;}

        .grid{padding:16px 14px 28px;display:flex;flex-direction:column;gap:14px;}
        .block{border-top:1px solid var(--line);padding-top:12px;}
        .vid{font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin:0 0 10px;color:#111827;}
        .row{display:flex;gap:10px;overflow:auto;padding-bottom:6px;}

        .tile{width:220px;border:1px solid var(--line);border-radius:0;background:#fff;flex:0 0 auto;display:flex;flex-direction:column;}
        .imgwrap{position:relative;height:293px;background:#fff;cursor:zoom-in;overflow:hidden;}
        img.photo{width:100%;height:100%;object-fit:cover;border-radius:0 !important;display:block;user-select:none;-webkit-user-drag:none;}
        img.ov{
          position:absolute; inset:0;
          width:100%; height:100%;
          object-fit:contain;
          pointer-events:none;
          opacity:.92;
          transform: translateZ(0);
        }

        .refwrap{position:relative;height:293px;background:#fff;overflow:hidden;}
        img.ref{width:100%;height:100%;object-fit:cover;border-radius:0 !important;display:block;}

        .metaTile{padding:8px 10px;border-top:1px solid var(--line);font-size:10.5px;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;}

        .lb{position:fixed;inset:0;background:rgba(7,8,10,.94);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px;}
        .lb.open{display:flex;}
        .lbInner{position:relative;width:min(1180px, calc(100vw - 48px));height:min(92vh, 980px);display:flex;align-items:center;justify-content:center;}
        .lbImg{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;background:#0b0c0f;border-radius:0 !important;}
        .lbX{position:absolute;top:-10px;right:-10px;width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.22);
          background:rgba(255,255,255,.06);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;}
        .lbNav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.18);
          background:rgba(255,255,255,.06);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;line-height:1;user-select:none;}
        .lbPrev{left:-12px;} .lbNext{right:-12px;}
        .lbFoot{position:fixed;bottom:14px;left:18px;color:rgba(255,255,255,.70);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;z-index:10000;display:none;}
        .lb.open ~ .lbFoot{display:block;}
      </style></head><body>

        <div class="topbar">
          <div class="row1">
            <div class="leftRow">
              <div class="brand">QC Carousel</div>
              <div class="pill ${status}">
                <span class="dot"></span>
                <span class="pillText">Loaded</span>
                <span class="pillCount">${loaded}${t ? ` / ${t}` : ""}</span>
                ${showMissing ? `<span class="pillMiss">Missing: ${missing}</span>` : ``}
              </div>
            </div>

            <div class="actions">
              <button class="btn" id="btnGuides" type="button" title="Toggle guides overlay (Shortcut: G)">Check Guides</button>
              <button class="btn" id="btnBrand" type="button" title="Toggle Brand image slot">Brand image</button>
              <button class="btn" id="btnRefs" type="button" title="Toggle/rotate model references">References</button>
              <button class="btn btnX" id="btnRefsClose" type="button" title="Close references" style="display:none;">×</button>
            </div>
          </div>

          <div class="row2">
            ${channelRaw ? `<div class="channel">${channelRaw}</div>` : ``}
            <div class="sep">·</div>
            <div class="wlTitle">${wlName}</div>
          </div>
        </div>

        <div class="grid" id="grid"></div>

        <div class="lb" id="lb" aria-hidden="true">
          <div class="lbInner">
            <button class="lbNav lbPrev" id="lbPrev" aria-label="Previous">‹</button>
            <button class="lbNav lbNext" id="lbNext" aria-label="Next">›</button>
            <button class="lbX" id="lbX" aria-label="Close">×</button>
            <img class="lbImg" id="lbImg" alt="QC preview" />
          </div>
        </div>
        <div class="lbFoot">Esc to close · ←/→ to navigate · G = Guides</div>

        <script>
          const DATA = ${JSON.stringify(data)};
          const VIEW_ORDER = ${JSON.stringify(QC_VIEW_ORDER)};
          const OVERLAY_VIEWS = new Set(${JSON.stringify(Array.from(OVERLAY_VIEWS))});
          const OVERLAY_URL = ${JSON.stringify(OVERLAY_SP_URL)};
          const BRAND = ${JSON.stringify(brandKey)};
          const REFERENCES = ${JSON.stringify(REFERENCES)};

          const gridEl = document.getElementById("grid");

          let overlayOn = false;
          let brandOn = false;
          let refsOn = false;
          let refIndex = 0;

          const REF_STORE_KEY = "mimo_qc_ref_index_v1";

          function viewSort(a,b){
            const ia = VIEW_ORDER.indexOf(a);
            const ib = VIEW_ORDER.indexOf(b);
            if (ia === -1 && ib === -1) return a.localeCompare(b);
            if (ia === -1) return 1;
            if (ib === -1) return -1;
            return ia - ib;
          }

          function spDirect(u){
            try{
              const url = new URL(u);
              if (!url.searchParams.has("download")) url.searchParams.set("download","1");
              url.searchParams.set("_", String(Date.now()));
              return url.toString();
            }catch{ return u; }
          }

          function clear(el){ while(el.firstChild) el.removeChild(el.firstChild); }

          const NAV = [];
          function rebuildNav(){
            NAV.length = 0;
            for (const vid of DATA.vids) {
              let views = Object.keys(DATA.map[vid] || {}).sort(viewSort);
              if (!brandOn) views = views.filter(v => v !== "brand");
              for (const view of views) {
                const cell = DATA.map[vid][view];
                if (cell && cell.srcQC) NAV.push({ vid, view, src: cell.srcQC });
              }
            }
          }

          const lb = document.getElementById("lb");
          const lbImg = document.getElementById("lbImg");
          const lbX = document.getElementById("lbX");
          const lbPrev = document.getElementById("lbPrev");
          const lbNext = document.getElementById("lbNext");
          let idx = -1;

          function openLBByIndex(i){
            if (!NAV.length) return;
            idx = (i + NAV.length) % NAV.length;
            lbImg.src = NAV[idx].src;
            lb.classList.add("open");
            lb.setAttribute("aria-hidden","false");
            document.body.style.overflow = "hidden";
          }
          function closeLB(){
            lb.classList.remove("open");
            lb.setAttribute("aria-hidden","true");
            lbImg.src = "";
            document.body.style.overflow = "";
            idx = -1;
          }
          function nextLB(){ if (idx !== -1) openLBByIndex(idx + 1); }
          function prevLB(){ if (idx !== -1) openLBByIndex(idx - 1); }

          lbX.addEventListener("click", closeLB);
          lbPrev.addEventListener("click", prevLB);
          lbNext.addEventListener("click", nextLB);
          lb.addEventListener("click", (e) => { if (e.target === lb) closeLB(); });
          lbImg.addEventListener("click", () => nextLB());

          const btnGuides = document.getElementById("btnGuides");
          const btnBrand = document.getElementById("btnBrand");
          const btnRefs = document.getElementById("btnRefs");
          const btnRefsClose = document.getElementById("btnRefsClose");

          function syncButtons(){
            btnGuides.classList.toggle("on", overlayOn);
            btnBrand.classList.toggle("on", brandOn);
            btnRefs.classList.toggle("on", refsOn);
            btnRefsClose.style.display = refsOn ? "inline-flex" : "none";
          }

          function getRefIndex(){
            try{
              const raw = localStorage.getItem(REF_STORE_KEY);
              const obj = raw ? JSON.parse(raw) : {};
              const n = Number(obj?.[BRAND] ?? 0);
              return Number.isFinite(n) ? n : 0;
            }catch{ return 0; }
          }
          function setRefIndex(i){
            try{
              const raw = localStorage.getItem(REF_STORE_KEY);
              const obj = raw ? JSON.parse(raw) : {};
              obj[BRAND] = i;
              localStorage.setItem(REF_STORE_KEY, JSON.stringify(obj));
            }catch{}
          }

          function getActiveRef(){
            const list = REFERENCES[BRAND] || [];
            if (!list.length) return null;
            const i = ((refIndex % list.length) + list.length) % list.length;
            return { ...list[i], idx: i, total: list.length };
          }

          btnGuides.addEventListener("click", () => { overlayOn = !overlayOn; syncButtons(); render(); });
          btnBrand.addEventListener("click", () => { brandOn = !brandOn; syncButtons(); render(); });

          btnRefs.addEventListener("click", () => {
            const list = REFERENCES[BRAND] || [];
            if (!list.length) return;

            if (!refsOn) { refsOn = true; refIndex = getRefIndex(); }
            else { refIndex = (refIndex + 1) % list.length; setRefIndex(refIndex); }

            syncButtons(); render();
          });

          btnRefsClose.addEventListener("click", () => { refsOn = false; syncButtons(); render(); });

          window.addEventListener("keydown", (e) => {
            if (e.key === "g" || e.key === "G") { overlayOn = !overlayOn; syncButtons(); render(); return; }
            if (!lb.classList.contains("open")) return;
            if (e.key === "Escape") closeLB();
            if (e.key === "ArrowRight") nextLB();
            if (e.key === "ArrowLeft") prevLB();
          });

          const overlayPreload = new Image();
          overlayPreload.src = spDirect(OVERLAY_URL);

          function render(){
            clear(gridEl);
            const activeRef = refsOn ? getActiveRef() : null;

            rebuildNav();

            for (const vid of DATA.vids) {
              let views = Object.keys(DATA.map[vid] || {}).sort(viewSort);
              if (!brandOn) views = views.filter(v => v !== "brand");
              if (!views.length) continue;

              const block = document.createElement("div");
              block.className = "block";

              const t = document.createElement("div");
              t.className = "vid";
              t.textContent = vid;
              block.appendChild(t);

              const row = document.createElement("div");
              row.className = "row";
              block.appendChild(row);

              let insertedRef = false;

              for (const view of views) {
                const cell = DATA.map[vid][view];
                if (!cell || !cell.srcQC) continue;

                const tile = document.createElement("div");
                tile.className = "tile";

                const imgwrap = document.createElement("div");
                imgwrap.className = "imgwrap";

                const img = document.createElement("img");
                img.className = "photo";
                img.loading = "lazy";
                img.src = cell.srcQC;
                imgwrap.appendChild(img);

                const thisIndex = NAV.findIndex(x => x.src === cell.srcQC && x.vid === vid && x.view === view);
                imgwrap.addEventListener("click", () => openLBByIndex(thisIndex >= 0 ? thisIndex : 0));

                if (overlayOn && OVERLAY_VIEWS.has(view)) {
                  const ov = document.createElement("img");
                  ov.className = "ov";
                  ov.alt = "Guides overlay";

                  let triedNoDownload = false;
                  ov.onerror = () => {
                    if (triedNoDownload) return;
                    triedNoDownload = true;
                    try{
                      const u = new URL(OVERLAY_URL);
                      u.searchParams.delete("download");
                      u.searchParams.set("_", String(Date.now()));
                      ov.src = u.toString();
                    }catch{}
                  };

                  ov.src = spDirect(OVERLAY_URL);
                  imgwrap.appendChild(ov);
                }

                tile.appendChild(imgwrap);

                const meta = document.createElement("div");
                meta.className = "metaTile";
                meta.textContent = (view === "brand") ? "brand image" : view;
                tile.appendChild(meta);

                row.appendChild(tile);

                if (activeRef && !insertedRef && view === "ou") {
                  insertedRef = true;
                  row.appendChild(makeRefTile(activeRef));
                }
              }

              if (activeRef && !insertedRef) row.appendChild(makeRefTile(activeRef));
              if (row.children.length) gridEl.appendChild(block);
            }
          }

          function makeRefTile(activeRef){
            const tile = document.createElement("div");
            tile.className = "tile";

            const refwrap = document.createElement("div");
            refwrap.className = "refwrap";

            const img = document.createElement("img");
            img.className = "ref";
            img.loading = "lazy";

            const direct = spDirect(activeRef.url);
            let triedNoDownload = false;

            img.onerror = () => {
              if (!triedNoDownload) {
                triedNoDownload = true;
                try{
                  const u = new URL(activeRef.url);
                  u.searchParams.delete("download");
                  u.searchParams.set("_", String(Date.now()));
                  img.src = u.toString();
                  return;
                }catch{}
              }

              refwrap.style.background = "rgba(15,23,42,.04)";
              refwrap.style.display = "flex";
              refwrap.style.alignItems = "center";
              refwrap.style.justifyContent = "center";
              refwrap.style.padding = "14px";
              refwrap.style.color = "rgba(15,23,42,.55)";
              refwrap.style.font = "800 11px -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
              refwrap.style.letterSpacing = ".14em";
              refwrap.style.textTransform = "uppercase";
              refwrap.textContent = "Reference unavailable";
            };

            img.src = direct;

            refwrap.appendChild(img);
            tile.appendChild(refwrap);

            const meta = document.createElement("div");
            meta.className = "metaTile";
            meta.textContent = \`model reference • \${activeRef.name} (\${activeRef.idx + 1}/\${activeRef.total})\`;
            tile.appendChild(meta);

            return tile;
          }

          refIndex = getRefIndex();
          syncButtons();
          render();
        </script>

      </body></html>`;
  }

  // =========================
  // UI styles
  // =========================
  function ensureStyles() {
    GM_addStyle(`
      :root {
        --mwl-bg: rgba(18, 18, 22, 0.92);
        --mwl-bg2: rgba(28, 28, 36, 0.92);
        --mwl-brd: rgba(255,255,255,0.12);
        --mwl-txt: rgba(255,255,255,0.92);
        --mwl-sub: rgba(255,255,255,0.68);
        --mwl-dim: rgba(255,255,255,0.48);
        --mwl-gold: #d8b46a;
        --mwl-gold2: rgba(216,180,106,0.16);
        --mwl-red: #ff5d5d;
        --mwl-amber: #ffcc66;
        --mwl-green: #67e08a;
        --mwl-shadow: 0 16px 50px rgba(0,0,0,0.55);
        --mwl-radius: 16px;
        --mwl-font: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
      }

      #mwl-status-panel {
        position: fixed;
        z-index: 999999;
        top: 90px;
        right: 18px;
        width: 420px;
        height: 560px;
        background: linear-gradient(180deg, var(--mwl-bg), var(--mwl-bg2));
        color: var(--mwl-txt);
        border: 1px solid var(--mwl-brd);
        border-radius: var(--mwl-radius);
        box-shadow: var(--mwl-shadow);
        overflow: hidden;
        backdrop-filter: blur(10px);
        font-family: var(--mwl-font);
        letter-spacing: 0.2px;
      }

      #mwl-status-panel.mwl-minimized { display:none !important; }

      #mwl-status-panel .mwl-head {
        display:flex; align-items:center; justify-content:space-between;
        padding:10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.08);
        cursor:grab; user-select:none;
      }
      #mwl-status-panel .mwl-head:active { cursor:grabbing; }

      #mwl-status-panel .mwl-title {
        font-weight: 820;
        font-size: 12px;
        display:flex; align-items:center; gap:8px;
        min-width: 0;
        letter-spacing: .16em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.90);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 230px;
      }

      #mwl-status-panel .mwl-dot {
        width: 9px; height: 9px; border-radius: 99px;
        background: var(--mwl-amber);
        box-shadow: 0 0 0 3px rgba(255, 204, 102, 0.15);
        flex: 0 0 auto;
      }

      #mwl-status-panel .mwl-actions { display:flex; align-items:center; gap:8px; }

      #mwl-status-panel .mwl-iconbtn {
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.90);
        border-radius: 12px;
        padding: 6px 10px;
        font-size: 11px;
        font-weight: 800;
        letter-spacing: .14em;
        text-transform: uppercase;
        cursor: pointer;
        transition: transform .08s ease, background .12s ease, border-color .12s ease;
      }
      #mwl-status-panel .mwl-iconbtn:hover {
        border-color: rgba(216,180,106,0.28);
        background: rgba(216,180,106,0.08);
      }
      #mwl-status-panel .mwl-iconbtn:active { transform: translateY(0.5px); }

      #mwl-status-panel .mwl-body {
        padding: 10px 12px 12px;
        height: calc(100% - 54px);
        overflow: auto;
      }

      #mwl-status-panel .mwl-wlline{
        margin: 2px 0 10px;
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .02em;
        color: rgba(255,255,255,0.86);
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      #mwl-status-panel .mwl-row {
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin: 8px 0 10px;
      }

      #mwl-status-panel .mwl-statuschip{
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.86);
        font-size: 11px;
        font-weight: 850;
        letter-spacing: .02em;
        user-select:none;
        white-space:nowrap;
      }

      #mwl-status-panel .mwl-loadchip{
        display:none;
        align-items:center;
        justify-content:center;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.86);
        font-size: 11px;
        font-weight: 800;
        letter-spacing: 0.02em;
        user-select: none;
        white-space: nowrap;
      }
      #mwl-status-panel .mwl-loadchip.is-amber{
        border-color: rgba(255,204,102,0.34);
        background: rgba(255,204,102,0.12);
        color: rgba(255,240,210,0.92);
      }
      #mwl-status-panel .mwl-loadchip.is-red{
        border-color: rgba(255,93,93,0.22);
        background: rgba(255,93,93,0.10);
        color: rgba(255,230,230,0.92);
        animation: mwlChipPulse 1.6s ease-in-out infinite;
      }
      @keyframes mwlChipPulse{
        0%, 100%{ transform: translateY(0); }
        50%{ transform: translateY(-0.6px); }
      }

      #mwl-status-panel .mwl-kpis { display:grid; grid-template-columns: 1fr 1fr; gap: 10px; }
      #mwl-status-panel .mwl-card {
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        border-radius: 14px;
        padding: 10px;
      }
      #mwl-status-panel .mwl-card h4 { margin: 0 0 8px 0; font-size: 12px; color: var(--mwl-sub); font-weight: 650; letter-spacing: 0.3px; }

      #mwl-status-panel .mwl-big { font-size: 22px; font-weight: 850; line-height: 1.1; }

      #mwl-status-panel .mwl-mini {
        margin-top: 6px;
        font-size: 11px;
        color: var(--mwl-dim);
        display:flex; justify-content:space-between; gap:10px;
      }

      #mwl-status-panel .mwl-mini strong,
      #mwl-status-panel .mwl-count {
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .02em;
        color: rgba(255,255,255,0.92);
      }

      #mwl-status-panel .mwl-bar { height: 8px; border-radius: 99px; background: rgba(255,255,255,0.08); overflow: hidden; margin-top: 8px; }
      #mwl-status-panel .mwl-bar > i { display:block; height:100%; width:0%; background: linear-gradient(90deg, rgba(216,180,106,0.9), rgba(255,255,255,0.55)); }

      #mwl-status-panel .mwl-card.clickable{ cursor: pointer; }
      #mwl-status-panel .mwl-card.clickable:hover{
        border-color: rgba(216,180,106,0.28);
        background: rgba(216,180,106,0.06);
      }
      #mwl-status-panel .mwl-card.is-active{
        border-color: rgba(216,180,106,0.46);
        background: rgba(216,180,106,0.10);
        box-shadow: 0 0 0 1px rgba(216,180,106,0.10) inset;
      }

      #mwl-status-panel .mwl-sectionTitle {
        margin-top: 10px;
        font-size: 11px;
        color: var(--mwl-sub);
        font-weight: 800;
        letter-spacing: .14em;
        text-transform: uppercase;
      }

      #mwl-status-panel .mwl-focus { display:flex; flex-wrap:wrap; gap:8px; margin-top:10px; }
      #mwl-status-panel .mwl-buttons { display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-top:12px; }
      #mwl-status-panel .mwl-btn {
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: var(--mwl-txt);
        border-radius: 12px;
        padding: 10px 10px;
        font-size: 12px;
        cursor: pointer;
        text-align:center;
        user-select:none;
      }
      #mwl-status-panel .mwl-btn:hover { border-color: rgba(255,255,255,0.24); background: rgba(255,255,255,0.09); }
      #mwl-status-panel .mwl-btn.gold { border-color: rgba(216,180,106,0.42); background: rgba(216,180,106,0.12); }
      #mwl-status-panel .mwl-btn.premiumText{
        color: var(--mwl-gold) !important;
        border-color: rgba(216,180,106,0.32);
      }

      #mwl-status-panel .mwl-pill {
        display:inline-flex;
        align-items:center;
        gap:8px;
        padding: 6px 10px;
        border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.72);
        font-size: 12px;
        cursor: pointer;
        user-select: none;
        white-space: nowrap;
        transition: background .12s ease, border-color .12s ease, transform .08s ease;
      }
      #mwl-status-panel .mwl-pill:hover{
        border-color: rgba(255,255,255,0.22);
        background: rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.90);
      }
      #mwl-status-panel .mwl-pill:active { transform: translateY(0.4px); }

      #mwl-status-panel .mwl-pill.is-active{
        border-color: rgba(216,180,106,0.54);
        background: rgba(216,180,106,0.12);
        color: rgba(255,255,255,0.92);
        box-shadow: 0 0 0 1px rgba(216,180,106,0.12) inset;
      }

      #mwl-status-panel .mwl-pill.is-alert{
        border-color: rgba(216,180,106,0.48);
        background: rgba(216,180,106,0.10);
        color: rgba(255,255,255,0.88);
      }
      #mwl-status-panel .mwl-pill.is-alert .mwl-count{
        color: rgba(255,255,255,0.95);
      }

      #mwl-status-panel .mwl-pill .mwl-count{
        font-weight: 900;
        color: rgba(255,255,255,0.92);
      }

      #mwl-status-panel .mwl-resizer {
        position:absolute; right:2px; bottom:2px;
        width:18px; height:18px; cursor:nwse-resize; opacity:.55;
      }
      #mwl-status-panel .mwl-resizer:before{
        content:""; position:absolute; right:3px; bottom:3px;
        width:12px; height:12px;
        border-right:2px solid rgba(255,255,255,0.25);
        border-bottom:2px solid rgba(255,255,255,0.25);
        border-radius:2px;
      }

      #mwl-status-tab {
        position: fixed;
        z-index: 999999;
        top: 64px;
        right: 18px;
        width: 248px;
        height: 46px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.14);
        background: linear-gradient(180deg, var(--mwl-bg), var(--mwl-bg2));
        color: var(--mwl-txt);
        box-shadow: var(--mwl-shadow);
        display: none;
        align-items: center;
        justify-content: space-between;
        padding: 0 12px;
        font-family: var(--mwl-font);
        user-select: none;
        cursor: grab;
        backdrop-filter: blur(10px);
        transition: transform .10s ease, border-color .12s ease, background .12s ease;
      }
      #mwl-status-tab:active{ cursor: grabbing; }
      #mwl-status-tab:hover{
        border-color: rgba(216,180,106,0.26);
        background: linear-gradient(180deg, rgba(18,18,22,0.96), rgba(28,28,36,0.96));
        transform: translateY(-0.6px);
      }

      #mwl-status-tab .mwl-dotmini{
        width:9px;height:9px;border-radius:999px;
        background:var(--mwl-amber);
        box-shadow: 0 0 0 3px rgba(255,204,102,0.12);
        opacity:.98;
        flex: 0 0 auto;
      }

      #mwl-status-tab .mwl-tabblock{
        display:flex; flex-direction:column; gap:2px; min-width:0;
      }
      #mwl-status-tab .mwl-tabtxt{
        font-size: 12px;
        font-weight: 900;
        letter-spacing: .12em;
        text-transform: uppercase;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.05;
      }
      #mwl-status-tab .mwl-tabsub{
        font-size: 11px;
        color: rgba(255,255,255,0.68);
        font-weight: 750;
        letter-spacing: .01em;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        line-height: 1.15;
      }

      #mwl-status-tab .mwl-chev{
        color: rgba(255,255,255,0.55);
        font-weight: 900;
        letter-spacing: .02em;
        font-size: 14px;
        padding-left: 8px;
      }

         /* Bold solid no-photo highlight */
      [data-mwl-nophoto="1"] {
        outline: none !important;
        border: none !important;
        box-shadow:
          inset 0 0 0 1px rgba(198,22,22,0.18),
          0 0 0 1px rgba(198,22,22,0.10) !important;
        position: relative;
        border-radius: 12px;
        background: rgba(198,22,22,0.18) !important;
        backdrop-filter: none;
      }
      [data-mwl-nophoto="1"]::before{
        content:"";
        position:absolute;
        left: 0;
        top: 8px;
        bottom: 8px;
        width: 5px;
        border-radius: 999px;
        background: rgba(198,22,22,0.98);
        box-shadow:
          0 0 0 1px rgba(198,22,22,0.18),
          0 10px 24px rgba(198,22,22,0.18);
        pointer-events:none;
      }
      [data-mwl-nophoto="1"]::after{
        content:"";
        position:absolute;
        inset: 0;
        border-radius: 12px;
        background: transparent !important;
        pointer-events:none;
      }

      [data-mwl-next="1"] {
  box-shadow:
    inset 0 0 0 1px rgba(216,180,106,0.35),
    0 0 0 3px rgba(216,180,106,0.55),
    0 8px 26px rgba(216,180,106,0.28) !important;
}
      .mwl-focus-highlight { animation: mwlPulse 1.4s ease-in-out 0s 2; }
      @keyframes mwlPulse { 0%{box-shadow:0 0 0 0 rgba(216,180,106,0.0);} 35%{box-shadow:0 0 0 6px rgba(216,180,106,0.24);} 100%{box-shadow:0 0 0 0 rgba(216,180,106,0.0);} }

      .mwl-toast {
        position: fixed; z-index: 999999; left: 18px; bottom: 18px;
        padding: 10px 12px; border-radius: 14px;
        background: rgba(18,18,22,0.92);
        border: 1px solid rgba(255,255,255,0.14);
        color: rgba(255,255,255,0.92);
        font-family: var(--mwl-font);
        font-size: 12px;
        box-shadow: var(--mwl-shadow);
        backdrop-filter: blur(10px);
        transform: translateY(10px);
        opacity: 0;
        transition: opacity .18s ease, transform .18s ease;
      }
      .mwl-toast.show { opacity: 1; transform: translateY(0px); }

      #mwl-status-panel .mwl-overlay{
        position:absolute; inset:0; z-index:20;
        background: rgba(18,18,22,0.94);
        border-top: 1px solid rgba(255,255,255,0.10);
        padding: 12px;
        display:none;
        overflow:auto;
      }
      #mwl-status-panel .mwl-ov-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px;}
      #mwl-status-panel .mwl-ov-title{font-weight:900;letter-spacing:.14em;text-transform:uppercase;font-size:12px;}
      #mwl-status-panel .mwl-ov-box{
        border:1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.04);
        border-radius: 14px;
        padding: 10px;
        margin-bottom: 10px;
      }
      #mwl-status-panel .mwl-ov-row{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 6px;border-bottom:1px solid rgba(255,255,255,0.08);}
      #mwl-status-panel .mwl-ov-row:last-child{border-bottom:none;}
      #mwl-status-panel .mwl-ov-row label{font-size:12px;color:rgba(255,255,255,0.86);font-weight:650;}
    `);
  }

  function toast(msg) {
    const t = el("div", { class: "mwl-toast" }, [String(msg)]);
    document.body.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => {
      t.classList.remove("show");
      setTimeout(() => t.remove(), 200);
    }, 1300);
  }

  // =========================
  // Tab
  // =========================
  function ensureTab() {
    let tab = document.getElementById(TAB_ID);
    if (tab) return tab;

    tab = el("div", { id: TAB_ID, title: "Drag to move • Click to restore" }, [
      el("div", { style: { display: "flex", alignItems: "center", gap: "10px", minWidth: "0" } }, [
        el("span", { class: "mwl-dotmini" }),
        el("div", { class: "mwl-tabblock" }, [
          el("div", { class: "mwl-tabtxt", id: "mwl-tabtitle" }, ["Dashboard"]),
          el("div", { class: "mwl-tabsub", id: "mwl-tabsub" }, ["List in progress"]),
        ]),
      ]),
      el("div", { class: "mwl-chev", "aria-hidden": "true" }, ["↗"])
    ]);

    const st = loadPanelState();
    if (st.tabX != null && st.tabY != null) {
      tab.style.left = `${st.tabX}px`;
      tab.style.top  = `${st.tabY}px`;
      tab.style.right = "auto";
    }

    let drag = null;
    let suppressClick = false;

    tab.addEventListener("mousedown", (e) => {
      drag = { sx: e.clientX, sy: e.clientY, rect: tab.getBoundingClientRect() };
      suppressClick = false;
      e.preventDefault();
    });

    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;

      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressClick = true;

      const w = drag.rect.width;
      const h = drag.rect.height;
      const nx = clamp(drag.rect.left + dx, 0, window.innerWidth - w);
      const ny = clamp(drag.rect.top + dy, 0, window.innerHeight - h);

      tab.style.left = `${nx}px`;
      tab.style.top  = `${ny}px`;
      tab.style.right = "auto";
    });

    window.addEventListener("mouseup", () => {
      if (!drag) return;
      const r = tab.getBoundingClientRect();
      savePanelState({ tabX: Math.round(r.left), tabY: Math.round(r.top) });
      drag = null;
    });

    tab.addEventListener("click", () => {
      if (suppressClick) { suppressClick = false; return; }
      setMinimized(false);
    });

    document.body.appendChild(tab);
    return tab;
  }

  // =========================
  // Panel creation
  // =========================
  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;

    ensureStyles();
    ensureTab();
    loadEngineState();
    loadActiveUIKey();

    panel = el("div", { id: PANEL_ID }, [
      el("div", { class: "mwl-head", id: "mwl-head" }, [
        el("div", { class: "mwl-title" }, [
          el("span", { class: "mwl-dot" }),
          el("span", { id: "mwl-title" }, ["Dashboard"]),
        ]),
        el("div", { class: "mwl-actions" }, [
          el("button", { class: "mwl-iconbtn", "data-action": "loadAll", id: "mwl-loadall-btn", title: "Force load all • Balanced • ESC cancels" }, ["⇣"]),
          el("button", { class: "mwl-iconbtn", "data-action": "help" }, ["?"]),
          el("button", { class: "mwl-iconbtn", "data-action": "settings" }, ["⚙"]),
          el("button", { class: "mwl-iconbtn", "data-action": "min" }, ["—"]),
        ])
      ]),

      el("div", { class: "mwl-body" }, [
        el("div", { class: "mwl-wlline", id: "mwl-wlline" }, ["—"]),

        el("div", { class: "mwl-row" }, [
          el("div", { class: "mwl-statuschip", id: "mwl-statuschip" }, ["In progress · 0%"]),
          el("div", { class: "mwl-loadchip is-amber", id: "mwl-loadchip" }, ["Scroll remaining: −0"])
        ]),

        el("div", { class: "mwl-kpis" }, [
          el("div", { class: "mwl-card clickable", "data-action": "focusIn", "data-ui-key": "focus:inToShoot", title: "Click: Next IN to shoot • Shift+Click: Copy" }, [
            el("h4", {}, ["IN (Still-life)"]),
            el("div", { class: "mwl-big", id: "mwl-in-big" }, ["—"]),
            el("div", { class: "mwl-mini" }, [
              el("span", { id: "mwl-in-mini" }, ["—"]),
              el("span", { id: "mwl-in-pct" }, ["—"])
            ]),
            el("div", { class: "mwl-bar" }, [el("i", { id: "mwl-in-bar" })])
          ]),
          el("div", { class: "mwl-card clickable", "data-action": "focusOu", "data-ui-key": "focus:ouToShoot", title: "Click: Next OU to shoot • Shift+Click: Copy" }, [
            el("h4", {}, ["OU (Model)"]),
            el("div", { class: "mwl-big", id: "mwl-ou-big" }, ["—"]),
            el("div", { class: "mwl-mini" }, [
              el("span", { id: "mwl-ou-mini" }, ["—"]),
              el("span", { id: "mwl-ou-pct" }, ["—"])
            ]),
            el("div", { class: "mwl-bar" }, [el("i", { id: "mwl-ou-bar" })])
          ])
        ]),

        el("div", { class: "mwl-card", style: { marginTop: "10px" } }, [
          el("h4", {}, ["Focus"]),
          el("div", { class: "mwl-focus" }, [
            el("div", { class: "mwl-pill", "data-action": "setfocus", "data-focus": "missing", "data-ui-key":"focus:missing", title: "Missing" }, [
              "Missing", el("span", { class: "mwl-count", id: "mwl-focus-missing" }, ["0"])
            ]),
            el("div", { class: "mwl-pill", "data-action": "setfocus", "data-focus": "rtwVideoMissing", "data-ui-key":"focus:rtwVideoMissing", title: "RTW VIDEO missing" }, [
              "RTW VIDEO", el("span", { class: "mwl-count", id: "mwl-focus-rtwvideo" }, ["0"])
            ]),
            el("div", { class: "mwl-pill", "data-action": "setfocus", "data-focus": "rejected", "data-ui-key":"focus:rejected", title: "Rejected" }, [
              "Rejected", el("span", { class: "mwl-count", id: "mwl-focus-rej" }, ["0"])
            ]),
          ]),
          el("div", { class: "mwl-mini", style: { marginTop: "8px" } }, [
            el("span", { id: "mwl-focus-ptr" }, ["0 / 0"])
          ]),
          el("div", { class: "mwl-buttons" }, [
            el("div", { class: "mwl-btn gold", "data-action": "next" }, ["Next"]),
            el("div", { class: "mwl-btn premiumText", "data-action": "qcOpen", title: "Open QC" }, ["Open QC"])
          ]),
          el("div", { class: "mwl-buttons", style: { marginTop: "8px" } }, [
            el("div", { class: "mwl-btn", "data-action": "copyMissing", title: "Copy only missing VIDs" }, ["Copy Missing VIDs"]),
            el("div", { class: "mwl-btn", "data-action": "copyAll", title: "Copy all detected VIDs" }, ["Copy All VIDs"])
          ]),
        ]),

        el("div", { class: "mwl-sectionTitle" }, ["KPI"]),
        el("div", { class: "mwl-card", style: { marginTop: "8px" } }, [
          el("div", { class: "mwl-mini" }, [
            el("span", {}, ["RTW"]),
            el("span", { id: "mwl-cat-rtw", style:{ fontWeight:"900" } }, ["0"])
          ]),
          el("div", { class: "mwl-mini" }, [
            el("span", {}, ["ACC"]),
            el("span", { id: "mwl-cat-acc", style:{ fontWeight:"900" } }, ["0"])
          ]),
        ]),

        el("div", { class: "mwl-sectionTitle" }, ["Tags"]),
        el("div", { class: "mwl-card", style: { marginTop: "8px" } }, [
          el("div", { class: "mwl-focus" }, [
            el("div", { class: "mwl-pill", "data-action": "tagfocus", "data-tag": "IN ONLY", "data-ui-key":"tag:IN ONLY", title: "Click: Next • Shift+Click: Copy" }, [
              "IN ONLY", el("span", { class: "mwl-count", id: "mwl-tag-inonly" }, ["0"])
            ]),
            el("div", { class: "mwl-pill", "data-action": "tagfocus", "data-tag": "OM ONLY", "data-ui-key":"tag:OM ONLY", title: "Click: Next • Shift+Click: Copy" }, [
              "OM ONLY", el("span", { class: "mwl-count", id: "mwl-tag-omonly" }, ["0"])
            ]),
            el("div", { class: "mwl-pill", "data-action": "tagfocus", "data-tag": "MODEL SIZE UNAVAILABLE", "data-ui-key":"tag:MODEL SIZE UNAVAILABLE", title: "Click: Next • Shift+Click: Copy" }, [
              "MODEL SIZE", el("span", { class: "mwl-count", id: "mwl-tag-modelsize" }, ["0"])
            ]),
          ])
        ]),
      ]),

      el("div", { class: "mwl-overlay", id: "mwl-help" }, [
        el("div", { class: "mwl-ov-head" }, [
          el("div", { class: "mwl-ov-title" }, ["Shortcuts"]),
          el("button", { class: "mwl-iconbtn", "data-action": "closeHelp" }, ["Close"])
        ]),
        el("div", { class: "mwl-ov-box" }, [
          el("div", { style: { color: "rgba(255,255,255,0.84)", fontSize: "12px", lineHeight: "1.55" } }, [
            "N = Next • A = Copy all • Q = QC • H = Help • Load All button = ESC cancels while scrolling",
          ])
        ])
      ]),

      el("div", { class: "mwl-overlay", id: "mwl-settings" }, [
        el("div", { class: "mwl-ov-head" }, [
          el("div", { class: "mwl-ov-title" }, ["Settings"]),
          el("button", { class: "mwl-iconbtn", "data-action": "closeSettings" }, ["Close"])
        ]),
        el("div", { class: "mwl-ov-box", id: "mwl-settings-box" }, []),
        el("div", { style: { display: "flex", gap: "8px", flexWrap: "wrap" } }, [
          el("button", { class: "mwl-iconbtn", style: { padding: "10px 12px", borderRadius: "12px" }, "data-action": "resetFlags" }, ["Reset flags"]),
          el("button", { class: "mwl-iconbtn", style: { padding: "10px 12px", borderRadius: "12px" }, "data-action": "clearTelemetry" }, ["Clear telemetry"]),
        ])
      ]),

      el("div", { class: "mwl-resizer", id: "mwl-resizer" })
    ]);

    const st = loadPanelState();
    panel.style.width = `${clamp(st.w || 420, 260, 820)}px`;
    panel.style.height = `${clamp(st.h || 560, 220, 900)}px`;
    if (st.x != null) { panel.style.left = `${st.x}px`; panel.style.right = "auto"; }
    if (st.y != null) { panel.style.top = `${st.y}px`; }

    document.body.appendChild(panel);

    renderSettingsBody();
    updateHeaderCompact();
    applyActiveStyles();

    const head = panel.querySelector("#mwl-head");
    let drag = null;
    head.addEventListener("mousedown", (e) => {
      if (e.target.closest("button")) return;
      drag = { sx: e.clientX, sy: e.clientY, rect: panel.getBoundingClientRect() };
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      const nx = clamp(drag.rect.left + dx, 0, window.innerWidth - 120);
      const ny = clamp(drag.rect.top + dy, 0, window.innerHeight - 60);
      panel.style.left = `${nx}px`;
      panel.style.top = `${ny}px`;
      panel.style.right = "auto";
    });
    window.addEventListener("mouseup", () => {
      if (!drag) return;
      const r = panel.getBoundingClientRect();
      savePanelState({ x: Math.round(r.left), y: Math.round(r.top) });
      drag = null;
    });

    const res = panel.querySelector("#mwl-resizer");
    let resizing = null;
    res.addEventListener("mousedown", (e) => {
      const r = panel.getBoundingClientRect();
      resizing = { x: e.clientX, y: e.clientY, w: r.width, h: r.height };
      e.preventDefault();
      e.stopPropagation();
    });
    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const nw = clamp(resizing.w + (e.clientX - resizing.x), 260, 820);
      const nh = clamp(resizing.h + (e.clientY - resizing.y), 220, 900);
      panel.style.width = `${nw}px`;
      panel.style.height = `${nh}px`;
    });
    window.addEventListener("mouseup", () => {
      if (!resizing) return;
      const r = panel.getBoundingClientRect();
      savePanelState({ w: Math.round(r.width), h: Math.round(r.height) });
      resizing = null;
    });

    panel.addEventListener("click", async (e) => {
      const t = e.target;
      const actionEl = t.closest("[data-action]");
      if (!actionEl) return;

      const action = actionEl.getAttribute("data-action");

      if (action === "min") { setMinimized(true); return; }

      if (action === "loadAll") {
        const btn = document.getElementById("mwl-loadall-btn");
        if (!btn) return;

        btn.disabled = true;
        const oldTxt = btn.textContent;
        btn.textContent = "…";
        btn.title = "Scrolling… (ESC stop)";

        try {
          toast("Load All: scrolling… (ESC stop)");
          await window.MadameUtils.forceLoadAllBalanced({
            maxLoops: 700,
            onProgress: ({ percent }) => {
              btn.title = `Scrolling… ${percent}% (ESC stop)`;
            }
          });
          toast("Load All: done.");
          updateCounts(false);
        } catch {
          bumpTelemetryError("load_all_failed");
          toast("Load All: failed.");
        } finally {
          btn.textContent = oldTxt;
          btn.disabled = false;
          btn.title = "Force load all • Balanced • ESC cancels";
        }
        return;
      }

      if (action === "qcOpen") { openQCViewer(); return; }

      if (action === "help") { toggleOverlay("help"); return; }
      if (action === "settings") { toggleOverlay("settings"); return; }
      if (action === "closeHelp") { setOverlayVisible("help", false); return; }
      if (action === "closeSettings") { setOverlayVisible("settings", false); return; }

      if (action === "resetFlags") { saveFlags({ ...DEFAULT_FLAGS }); renderSettingsBody(); toast("Flags reset."); updateCounts(true); return; }
      if (action === "clearTelemetry") { localStorage.removeItem(TELEMETRY_KEY); renderSettingsBody(); toast("Telemetry cleared."); return; }

      if (action === "focusIn") {
        const isShift = e.shiftKey;
        setActiveUIKey("focus:inToShoot");
        setFocus({ type: "inToShoot", value: "" }, !isShift);
        if (isShift) copyVIDsInFocus();
        return;
      }
      if (action === "focusOu") {
        const isShift = e.shiftKey;
        setActiveUIKey("focus:ouToShoot");
        setFocus({ type: "ouToShoot", value: "" }, !isShift);
        if (isShift) copyVIDsInFocus();
        return;
      }

      if (action === "setfocus") {
        const f = actionEl.getAttribute("data-focus");
        if (!f) return;

        let nf = { type: "missing", value: "" };
        if (f === "missing") nf = { type: "missing", value: "" };
        else if (f === "inToShoot") nf = { type: "inToShoot", value: "" };
        else if (f === "ouToShoot") nf = { type: "ouToShoot", value: "" };
        else if (f === "rtwVideoMissing") nf = { type: "rtwVideoMissing", value: "" };
        else if (f === "rejected") nf = { type: "rejected", value: "" };

        setActiveUIKey(`focus:${nf.type}`);
        if (e.shiftKey) { focus = nf; saveEngineState(); updateCounts(true); setTimeout(copyVIDsInFocus, 0); }
        else setFocus(nf, true);
        return;
      }

      if (action === "tagfocus") {
        const tag = (actionEl.getAttribute("data-tag") || "").trim();
        if (!tag) return;
        const isShift = e.shiftKey;

        const key = `tag:${tag.toUpperCase()}`;
        setActiveUIKey(key);

        setFocus({ type: "tag", value: tag }, !isShift);
        if (isShift) copyVIDsInFocus();
        return;
      }

      if (action === "next") { goNextInFocus(true); return; }
      if (action === "copyMissing") { copyMissingVIDs(); return; }
      if (action === "copyAll") { copyAllVIDs(); return; }
    });

    if (st.minimized) {
      panel.classList.add("mwl-minimized");
      ensureTab().style.display = "flex";
      updateHeaderCompact();
    }

    return panel;
  }

  function renderSettingsBody() {
    const box = document.getElementById("mwl-settings-box");
    if (!box) return;

    const flags = loadFlags();
    const telemetry = loadTelemetry();
    const errCount = Object.values((telemetry && telemetry.errors) ? telemetry.errors : {}).reduce((a,b)=>a+(b||0),0);

    box.innerHTML = "";
    box.appendChild(el("div", { style: { marginBottom: "8px", color: "rgba(255,255,255,0.72)", fontSize: "11px" } }, [
      `Errors tracked: ${errCount}`
    ]));

    const rows = [
      ["enableQC", "QC Carousel"],
      ["enableOverlayGuides", "QC: Guides overlay"],
      ["enableReferences", "QC: References"],
      ["enableNoPhotoHighlight", "No Photo highlight"],
      ["enableRTWVideoKPI", "RTW VIDEO KPI"],
      ["enableRejectedKPI", "Rejected KPI"],
      ["enableShortcuts", "Keyboard shortcuts"],
      ["enableHelpOverlay", "Help overlay (H)"],
      ["enableTelemetry", "Telemetry (local)"],
      ["enableResilienceFallbacks", "Resilience fallbacks"],
      ["enablePerfGating", "Performance gating"]
    ];

    for (const [k, label] of rows) {
      const row = el("div", { class: "mwl-ov-row" }, [
        el("label", {}, [label]),
        el("input", { type: "checkbox", "data-flag": k }, [])
      ]);
      const cb = row.querySelector(`input[data-flag="${k}"]`);
      cb.checked = !!flags[k];
      cb.addEventListener("change", () => {
        const next = {}; next[k] = !!cb.checked;
        saveFlags(next);
        updateCounts(true);
      });
      box.appendChild(row);
    }
  }

  function setOverlayVisible(which, visible) {
    const flags = loadFlags();
    if (which === "help" && !flags.enableHelpOverlay) return;

    const help = document.getElementById("mwl-help");
    const settings = document.getElementById("mwl-settings");

    if (help) help.style.display = (which === "help" && visible) ? "block" : "none";
    if (settings) settings.style.display = (which === "settings" && visible) ? "block" : "none";

    helpOpen = (which === "help" && visible);
    settingsOpen = (which === "settings" && visible);
  }
  function toggleOverlay(which) {
    if (which === "help") setOverlayVisible("help", !helpOpen);
    if (which === "settings") setOverlayVisible("settings", !settingsOpen);
  }

  function setMinimized(minimized) {
    const panel = document.getElementById(PANEL_ID);
    const tab = ensureTab();
    if (!panel || !tab) return;

    savePanelState({ minimized: !!minimized });

    if (minimized) {
      panel.classList.add("mwl-minimized");
      tab.style.display = "flex";
      updateHeaderCompact();
    } else {
      panel.classList.remove("mwl-minimized");
      tab.style.display = "none";
      updateCounts(false);
    }
  }

  // =========================
  // Core updateCounts
  // =========================
  function updateCounts(forceResetPointer = false) {
    if (!isSupportedRoute()) return;

    ensurePanel();
    updateHeaderCompact();

    const st = loadPanelState();
    const flags = loadFlags();

    if (isSearchRoute()) {
      const products = safeRun("search_getVIDs", () => getProducts(), []);
      const loaded = products.length;

      qs("#mwl-in-big").textContent = `${loaded}`;
      qs("#mwl-in-mini").textContent = `VIDs found on /search`;
      qs("#mwl-in-pct").textContent = `—`;
      qs("#mwl-in-bar").style.width = `0%`;

      qs("#mwl-ou-big").textContent = `—`;
      qs("#mwl-ou-mini").textContent = `—`;
      qs("#mwl-ou-pct").textContent = `—`;
      qs("#mwl-ou-bar").style.width = `0%`;

      qs("#mwl-cat-rtw").textContent = "0";
      qs("#mwl-cat-acc").textContent = "0";

      qs("#mwl-tag-inonly").textContent = "0";
      qs("#mwl-tag-omonly").textContent = "0";
      qs("#mwl-tag-modelsize").textContent = "0";

      qs("#mwl-focus-missing").textContent = String(loaded);
      qs("#mwl-focus-rtwvideo").textContent = "0";
      qs("#mwl-focus-rej").textContent = "0";

      lastAnalyses = products.map(p => ({
        ...p,
        a: { hasINSlot:false, hasOUSlot:false, hasINShot:false, hasOUShot:false, hasVideo:false, hasRejected:false },
        tags: new Set()
      }));

      focusList = lastAnalyses.slice();
      if (forceResetPointer) focusPtr = 0;
      if (focusPtr >= focusList.length) focusPtr = 0;
      if (lastHighlightedEl && !lastHighlightedEl.isConnected) clearLastHighlight();

      qs("#mwl-focus-ptr").textContent = focusList.length ? `${clamp(focusPtr, 0, focusList.length)} / ${focusList.length}` : "0 / 0";

      updateLoadingChip(loaded, null);
      setTrafficAndStatus(loaded ? 40 : 0);
      updateFocusAlertPills();
      applyActiveStyles();
      updateHeaderCompact();
      return;
    }

    if (st.minimized) {
      const products = safeRun("min_getProducts", () => getProducts(), []);

      let totalIN = 0, totalOU = 0, inShot = 0, ouShot = 0;

      for (const p of products) {
        const a = analyzeProduct(p);

        if (flags.enableNoPhotoHighlight) {
          applyNoPhotoHighlight(getHighlightTarget(p.root), hasNoPhotosAtAll(a));
        }

        if (a.hasINSlot) totalIN++;
        if (a.hasOUSlot) totalOU++;
        if (a.hasINSlot && a.hasINShot) inShot++;
        if (a.hasOUSlot && a.hasOUShot) ouShot++;
      }

      const inP = pct(inShot, totalIN);
      const ouP = pct(ouShot, totalOU);
      const overallP = (totalIN && totalOU) ? Math.round((inP + ouP) / 2) : (totalIN ? inP : (totalOU ? ouP : 0));
      setTrafficAndStatus(overallP);
      updateHeaderCompact();
      return;
    }

    const products = safeRun("update_getProducts", () => getProducts(), []);
    bumpTelemetryCounter("updateCounts_calls", 1);

    const analyses = safeRun("update_analyses_map", () => products.map(p => {
      const a = analyzeProduct(p);
      const tags = getProductTags(p.root);
      return { ...p, a, tags };
    }), []);

    lastAnalyses = analyses;

    if (flags.enableNoPhotoHighlight) {
      for (const x of analyses) {
        applyNoPhotoHighlight(getHighlightTarget(x.root), hasNoPhotosAtAll(x.a));
      }
    }

    const tagCounts = Object.fromEntries(TAGS_OF_INTEREST.map(t => [t, 0]));
    for (const x of analyses) for (const t of TAGS_OF_INTEREST) if (x.tags.has(t)) tagCounts[t] += 1;
    lastTagCounts = tagCounts;

    const loaded = products.length;
    const totalVariants = parseVariantsTotal();
    updateLoadingChip(loaded, totalVariants);

    const totalIN = analyses.filter(x => x.a.hasINSlot).length;
    const totalOU = analyses.filter(x => x.a.hasOUSlot).length;
    const inShot = analyses.filter(x => x.a.hasINSlot && x.a.hasINShot).length;
    const ouShot = analyses.filter(x => x.a.hasOUSlot && x.a.hasOUShot).length;

    const inToShoot = Math.max(0, totalIN - inShot);
    const ouToShoot = Math.max(0, totalOU - ouShot);

    const inP = pct(inShot, totalIN);
    const ouP = pct(ouShot, totalOU);
    const overallP = (totalIN && totalOU) ? Math.round((inP + ouP) / 2) : (totalIN ? inP : (totalOU ? ouP : 0));

    const catRTW = analyses.filter(x => x.tags?.has(RTW_TAG)).length;
    const catACC = Math.max(0, loaded - catRTW);

    let rtwTotal = 0, rtwWithVideo = 0, rtwMissing = 0;
    if (flags.enableRTWVideoKPI) {
      rtwTotal = analyses.filter(x => x.tags?.has(RTW_TAG)).length;
      rtwWithVideo = analyses.filter(x => x.tags?.has(RTW_TAG) && x.a.hasVideo).length;
      rtwMissing = Math.max(0, rtwTotal - rtwWithVideo);
    }

    let rejectedLoaded = 0;
    if (flags.enableRejectedKPI) rejectedLoaded = analyses.filter(x => x.a.hasRejected).length;

    qs("#mwl-in-big").textContent = `${inShot} / ${totalIN || 0}`;
    qs("#mwl-in-mini").textContent = `To shoot: ${inToShoot} • Total: ${totalIN}`;
    qs("#mwl-in-pct").textContent = `${inP}%`;
    qs("#mwl-in-bar").style.width = `${inP}%`;

    qs("#mwl-ou-big").textContent = `${ouShot} / ${totalOU || 0}`;
    qs("#mwl-ou-mini").textContent = `To shoot: ${ouToShoot} • Total: ${totalOU}`;
    qs("#mwl-ou-pct").textContent = `${ouP}%`;
    qs("#mwl-ou-bar").style.width = `${ouP}%`;

    qs("#mwl-cat-rtw").textContent = String(catRTW);
    qs("#mwl-cat-acc").textContent = String(catACC);

    qs("#mwl-tag-inonly").textContent = String(tagCounts["IN ONLY"] || 0);
    qs("#mwl-tag-omonly").textContent = String(tagCounts["OM ONLY"] || 0);
    qs("#mwl-tag-modelsize").textContent = String(tagCounts["MODEL SIZE UNAVAILABLE"] || 0);

    const missingCount = analyses.filter(x => isMissingInMode(x.a)).length;
    qs("#mwl-focus-missing").textContent = String(missingCount);
    qs("#mwl-focus-rtwvideo").textContent = flags.enableRTWVideoKPI ? String(rtwMissing) : "0";
    qs("#mwl-focus-rej").textContent = flags.enableRejectedKPI ? String(rejectedLoaded) : "0";

    setTrafficAndStatus(overallP);

    focusList = buildFocusList(analyses);
    if (forceResetPointer) focusPtr = 0;
    if (focusPtr >= focusList.length) focusPtr = 0;
    if (lastHighlightedEl && !lastHighlightedEl.isConnected) clearLastHighlight();

    qs("#mwl-focus-ptr").textContent = focusList.length ? `${clamp(focusPtr, 0, focusList.length)} / ${focusList.length}` : "0 / 0";

    lastKPIs = {
      loaded, totalVariants,
      totalIN, totalOU, inShot, ouShot, inToShoot, ouToShoot, inP, ouP,
      catRTW, catACC,
      rtwTotal, rtwWithVideo, rtwMissing,
      rejectedLoaded
    };

    updateFocusAlertPills();
    applyActiveStyles();
    updateHeaderCompact();
  }

  // =========================
  // Perf scheduling + SPA hooks
  // =========================
  function scheduleUpdate() {
    if (!mounted) return;
    if (!isSupportedRoute()) return;
    if (updateScheduled) return;
    updateScheduled = true;

    const flags = loadFlags();
    const run = () => {
      updateScheduled = false;
      updateCounts(false);
    };

    if (flags.enablePerfGating && document.hidden) { updateScheduled = false; return; }

    clearTimeout(updateTimer);
    if (flags.enablePerfGating && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => run(), { timeout: 600 });
    } else {
      updateTimer = setTimeout(run, 300);
    }
  }

  function hookSpaNavigation(cb) {
    const _push = history.pushState;
    const _replace = history.replaceState;
    function fire() { setTimeout(cb, 0); }
    history.pushState = function () { const ret = _push.apply(this, arguments); fire(); return ret; };
    history.replaceState = function () { const ret = _replace.apply(this, arguments); fire(); return ret; };
    window.addEventListener("popstate", fire);
  }

  function attachListeners() {
    if (observer) return;
    observer = new MutationObserver(() => scheduleUpdate());
    observer.observe(document.body, { childList: true, subtree: true });

    if (!scrollAttached) {
      window.addEventListener("scroll", scheduleUpdate, { passive: true });
      scrollAttached = true;
    }
  }

  function detachListeners() {
    if (observer) { observer.disconnect(); observer = null; }
    if (scrollAttached) { window.removeEventListener("scroll", scheduleUpdate); scrollAttached = false; }
    updateScheduled = false;
    clearTimeout(updateTimer);
  }

  // =========================
  // Shortcuts
  // =========================
  function attachShortcutsOnce() {
    if (window.__mwl_shortcuts_attached_v5111__) return;
    window.__mwl_shortcuts_attached_v5111__ = true;

    window.addEventListener("keydown", (e) => {
      const flags = loadFlags();
      if (!flags.enableShortcuts) return;
      if (!isSupportedRoute()) return;
      if (isEditableTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const k = (e.key || "").toLowerCase();

      if (k === "h") { ensurePanel(); toggleOverlay("help"); e.preventDefault(); return; }
      if (helpOpen || settingsOpen) {
        if (k === "escape") { setOverlayVisible("help", false); setOverlayVisible("settings", false); e.preventDefault(); }
        return;
      }

      if (k === "n") { goNextInFocus(true); e.preventDefault(); return; }
      if (k === "a") { copyAllVIDs(); e.preventDefault(); return; }
      if (k === "q") { openQCViewer(); e.preventDefault(); return; }
    }, true);
  }

  // =========================
  // Mount / unmount
  // =========================
  function mount() {
    if (mounted) return;
    mounted = true;
    ensurePanel();
    attachListeners();
    attachShortcutsOnce();
    scheduleUpdate();
  }

  function unmount() {
    mounted = false;
    detachListeners();
    clearLastHighlight();
    const p = document.getElementById(PANEL_ID);
    const t = document.getElementById(TAB_ID);
    if (p) p.remove();
    if (t) t.remove();
  }

  function mountOrUnmount() {
    if (isSupportedRoute()) mount();
    else unmount();
  }

  hookSpaNavigation(mountOrUnmount);
  mountOrUnmount();

  setTimeout(() => {
    if (!isSupportedRoute()) return;
    if (focus?.type === "tag") setActiveUIKey(`tag:${String(focus.value || "").toUpperCase()}`);
    else setActiveUIKey(`focus:${focus?.type || "missing"}`);
  }, 0);
})();

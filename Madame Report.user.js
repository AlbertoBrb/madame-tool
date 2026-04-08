// ==UserScript==
// @name         Madame Report
// @namespace    https://tampermonkey.net/
// @version      1.2.0
// @description  Export Report in formato Excel XML (SpreadsheetML) con categoria, brand, tag. Bottone flottante con progress ring. Coordinated con Madame Dashboard via MadameUtils.
// @author       AlbertoBrb
// @match        https://madame.ynap.biz/*
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-search.user.js
// @downloadURL  https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-search.user.js
// ==/UserScript==

(() => {
  "use strict";

  const KEY_GLOBAL = "__MWL_REPORT_ONLY__V120__";
  if (window[KEY_GLOBAL]) return;
  window[KEY_GLOBAL] = true;

  const WORKLIST_RE = /^\/worklist\/\d+/;
  const SEARCH_RE   = /^\/search\b/;
  const isToolRoute = () => WORKLIST_RE.test(location.pathname) || SEARCH_RE.test(location.pathname);

  const VID_SELECTOR               = "h4.css-10pdxui";
  const VID_FALLBACK_SELECTOR      = "h4";
  const REPORT_BRAND_NAME_SELECTOR = "h4.css-zr7m9w";
  const REPORT_CATEGORY_SELECTOR   = "span.css-f1o1mh";
  const BRAND_IMG_PRIMARY          = "img.css-18m31dc";
  const BRAND_IMG_FALLBACK         = "img[src*='iris.product.ext.ynapgroup.com/internal/']";
  const CHIP_LABEL_SELECTOR        = "span.MuiChip-label, span[class*='MuiChip-label']";

  const STORE_POS = "MWL_REPORT_BTN_POS_V1";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function loadPos() {
    try {
      const obj = JSON.parse(localStorage.getItem(STORE_POS) || "null");
      if (obj && Number.isFinite(obj.x) && Number.isFinite(obj.y)) return obj;
    } catch {}
    return { x: Math.max(12, window.innerWidth - 170), y: 120 };
  }
  function savePos(x, y) { try { localStorage.setItem(STORE_POS, JSON.stringify({ x, y })); } catch {} }

  const qsa = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style" && typeof v === "object") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  function toast(msg) {
    let t = document.getElementById("mwl-rpt-toast");
    if (!t) { t = el("div", { id: "mwl-rpt-toast" }); document.body.appendChild(t); }
    t.textContent = String(msg);
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.classList.remove("show"), 1400);
  }

  function looksLikeVID(text) { return /^\d{10,}$/.test(String(text || "").trim()); }

  function xmlEscape(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function dlFile(filename, mime, content) {
    const url = URL.createObjectURL(new Blob([content], { type: mime }));
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function excelSheetName(title) {
    let s = String(title || "Report").trim().replace(/[:\\\/\?\*\[\]]/g, " ").replace(/\s+/g, " ").trim() || "Report";
    return s.length > 31 ? s.slice(0, 31) : s;
  }

  function getTextById(id) { const n = document.getElementById(id); return n ? String(n.textContent || "").trim() : ""; }
  function getAriaById(id) { const n = document.getElementById(id); return n ? String(n.getAttribute("aria-label") || "").trim() : ""; }

  // MadameUtils coordination
  function getSharedProducts() {
    const mu = window.MadameUtils;
    return (mu && Array.isArray(mu._lastProducts) && mu._lastProducts.length > 0) ? mu._lastProducts : null;
  }
  function getSharedTotalVariants() {
    const mu = window.MadameUtils;
    return (mu && typeof mu._totalVariants === "number") ? mu._totalVariants : null;
  }
  function parseVariantsTotal() {
    const shared = getSharedTotalVariants();
    if (shared !== null) return shared;
    const s = getAriaById("info-box-1") || getTextById("info-box-1") || "";
    const m = s.match(/Number of variants:\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  // Product detection fallback
  function findAllVidNodes() {
    const nodes = qsa(VID_SELECTOR).filter(n => looksLikeVID(n.textContent));
    return nodes.length ? nodes : qsa(VID_FALLBACK_SELECTOR).filter(n => looksLikeVID((n.textContent || "").trim()));
  }

  function hasAnySlotMarker(root) {
    if (!root) return false;
    const re = /(?:^|[\s\/·|:()\[\]-])\s*(IN|OU|OUT|OUTFIT|OU2|BK|FR|CU|PR|SW|RW|E[1-8])\s*(?:$|[\s\/·|:()\[\]-])/i;
    for (const n of root.querySelectorAll("[title],[aria-label]")) {
      if (re.test(n.getAttribute("title") || n.getAttribute("aria-label") || "")) return true;
    }
    const nodes = root.querySelectorAll("span,div,td,button");
    for (let i = 0; i < Math.min(nodes.length, 60); i++) {
      const t = (nodes[i].textContent || "").trim();
      if (t && t.length <= 40 && re.test(t)) return true;
    }
    return false;
  }

  function findProductRoot(vidNode) {
    const tr = vidNode.closest("tr");
    if (tr && hasAnySlotMarker(tr)) return tr;
    let node = vidNode;
    for (let i = 0; i < 14 && node; i++) {
      node = node.parentElement;
      if (!node) break;
      const seen = new Set();
      for (const n of node.querySelectorAll("h4,span,td,div,a")) {
        const t = (n.textContent || "").trim();
        if (looksLikeVID(t)) seen.add(t);
      }
      if (seen.size === 1 && seen.has((vidNode.textContent || "").trim()) && hasAnySlotMarker(node)) return node;
    }
    return vidNode.closest("div") || vidNode.parentElement;
  }

  function getProductsFallback() {
    const seen = new Set(), products = [];
    for (const vn of findAllVidNodes()) {
      const vid = (vn.textContent || "").trim();
      if (!looksLikeVID(vid)) continue;
      const root = findProductRoot(vn);
      if (!root || seen.has(root)) continue;
      seen.add(root); products.push({ vid, root });
    }
    return products;
  }

  function getProducts() { return getSharedProducts() ?? getProductsFallback(); }

  // Data extraction
  function getProductTags(root) {
    const set = new Set();
    for (const n of qsa(CHIP_LABEL_SELECTOR, root)) {
      const t = (n.textContent || "").trim();
      if (t) set.add(t.toUpperCase());
    }
    return set;
  }

  function extractBrandName(root) {
    if (!root) return "";
    const h = root.querySelector(REPORT_BRAND_NAME_SELECTOR);
    if (h) { const t = (h.textContent || "").trim(); if (t && t.length <= 80 && !looksLikeVID(t)) return t; }
    const img = root.querySelector(BRAND_IMG_PRIMARY) || root.querySelector(BRAND_IMG_FALLBACK) || root.querySelector("img");
    if (img) {
      const alt = (img.getAttribute("alt") || "").trim(); if (alt && alt.length <= 40) return alt;
      const title = (img.getAttribute("title") || "").trim(); if (title && title.length <= 40) return title;
    }
    const txts = Array.from(root.querySelectorAll("h5,h6,strong,b,span,div,a"))
      .map(n => (n.textContent || "").trim())
      .filter(t => t && t.length >= 2 && t.length <= 40 && !looksLikeVID(t))
      .slice(0, 18);
    for (const t of txts) { if (/^[A-Z0-9&\-\s']+$/.test(t) && t.replace(/\s/g, "").length >= 3) return t; }
    return txts[0] || "";
  }

  function extractCategoryTriplet(root) {
    if (!root) return { category: "", subCategory: "", detail: "" };
    const raw = (root.querySelector(REPORT_CATEGORY_SELECTOR)?.textContent || "").trim();
    if (!raw) return { category: "", subCategory: "", detail: "" };
    const [category = "", subCategory = "", detail = ""] = raw.split(">").map(x => x.trim()).filter(Boolean);
    return { category, subCategory, detail };
  }

  // Export
  function exportReportXls() {
    if (!isToolRoute()) { toast("Apri una Worklist o Search per esportare."); return; }
    const products = getProducts();
    if (!products.length) { alert("Nessun prodotto rilevato.\nSuggerimento: scrolla per caricare più righe e riprova."); return; }

    const wlName = (getTextById("info-box-0") || getAriaById("info-box-0") || (SEARCH_RE.test(location.pathname) ? "Search" : "Worklist")).trim();
    const when = new Date();

    const rows = products
      .map(p => {
        const tags = getProductTags(p.root);
        const { category, subCategory, detail } = extractCategoryTriplet(p.root);
        return [p.vid, category, subCategory, detail, extractBrandName(p.root),
          tags.has("REC") ? "REC" : "", tags.has("BWL") ? "BWL" : "",
          tags.has("IN ONLY") ? "TRUE" : "", "", ""];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    const fname = `Madame_Report_${(wlName || "worklist").replace(/[^\w\-]+/g, "_").slice(0, 40)}_${when.toISOString().slice(0, 10)}_V120.xml`;
    const COLS = ["variantId","category","subCategory","detail","brandName","REC","BWL","IN ONLY","MODEL","STATUS"];
    const colWidths = [150, 140, 160, 180, 180, 70, 70, 90, 90, 110];

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Madame Report</Title><Author>AlbertoBrb</Author>
    <Created>${xmlEscape(when.toISOString())}</Created><Version>1.2.0</Version>
  </DocumentProperties>
  <Styles>
    <Style ss:ID="sCell"><Alignment ss:Vertical="Center" ss:WrapText="0"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/></Borders>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
    <Style ss:ID="sHeader"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
      <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
      <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
      <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/></Borders>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0B0C0F" ss:Pattern="Solid"/></Style>
    <Style ss:ID="sVid"><Alignment ss:Vertical="Center"/><NumberFormat ss:Format="@"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#D1D5DB"/></Borders>
      <Font ss:FontName="Consolas" ss:Size="11" ss:Color="#111827"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/></Style>
    <Style ss:ID="sHeaderVid"><Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
      <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
      <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
      <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#6B7280"/></Borders>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0B0C0F" ss:Pattern="Solid"/></Style>
  </Styles>
  <Worksheet ss:Name="${xmlEscape(excelSheetName(wlName))}">
    <Table ss:DefaultRowHeight="15">
      ${colWidths.map(w => `<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`).join("")}
      <Row>${COLS.map((c,i) => `<Cell ss:StyleID="${i===0?"sHeaderVid":"sHeader"}"><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`).join("")}</Row>
      ${rows.map(r => `<Row>${r.map((v,i) => `<Cell ss:StyleID="${i===0?"sVid":"sCell"}"><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`).join("")}</Row>`).join("")}
    </Table>
    <AutoFilter xmlns="urn:schemas-microsoft-com:office:excel" x:Range="R1C1:R1C10"/>
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <Selected/><FreezePanes/><FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal><TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane><Panes><Pane><Number>2</Number></Pane></Panes>
      <ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

    dlFile(fname, "application/vnd.ms-excel;charset=utf-8", xml);
    toast(`Report esportato: ${rows.length} righe`);
  }

  // Progress ring
  function updateProgressUI() {
    const btn = document.getElementById("mwl-rpt-btn");
    if (!btn) return;
    const ring = btn.querySelector(".mwl-rpt-ring");
    const txt  = btn.querySelector(".mwl-rpt-ringText");
    if (!ring || !txt) return;

    const total  = parseVariantsTotal();
    const loaded = getSharedProducts()?.length ?? (() => { try { return getProductsFallback().length; } catch { return 0; } })();

    if (!(typeof total === "number" && total > 0)) {
      btn.classList.remove("is-done");
      ring.style.setProperty("--deg", "0deg");
      txt.textContent = "";
      ring.title = "Total variants not available yet";
      return;
    }

    const p = clamp(loaded / total, 0, 1);
    ring.style.setProperty("--deg", `${Math.round(p * 360)}deg`);
    const done = loaded >= total;
    btn.classList.toggle("is-done", done);
    txt.textContent = done ? "✓" : "";
    ring.title = `Loaded ${loaded} / ${total} (${Math.round(p * 100)}%)`;
  }

  // CSS
  let _stylesInjected = false;
  function ensureStyles() {
    if (_stylesInjected) return; _stylesInjected = true;
    GM_addStyle(`
      #mwl-rpt-btn {
        position:fixed; z-index:999999; width:168px; height:42px;
        border-radius:16px; border:1px solid rgba(216,180,106,0.28);
        background:linear-gradient(180deg,rgba(10,10,12,0.92),rgba(22,22,28,0.92));
        box-shadow:0 16px 50px rgba(0,0,0,0.58); backdrop-filter:blur(10px);
        color:rgba(255,255,255,0.92);
        font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
        user-select:none; display:flex; align-items:center; justify-content:center;
        cursor:grab; overflow:hidden; gap:10px; padding:0 12px 0 10px;
        transition:transform .10s ease,border-color .12s ease,background .12s ease;
        letter-spacing:.14em; text-transform:uppercase; font-weight:900; font-size:12px;
      }
      #mwl-rpt-btn:active { cursor:grabbing; }
      #mwl-rpt-btn:hover {
        border-color:rgba(216,180,106,0.42);
        background:linear-gradient(180deg,rgba(8,8,10,0.96),rgba(20,20,26,0.96));
        transform:translateY(-0.6px);
      }
      #mwl-rpt-btn::before {
        content:""; position:absolute; left:0; top:10px; bottom:10px; width:4px;
        border-radius:999px;
        background:linear-gradient(180deg,rgba(216,180,106,0.95),rgba(216,180,106,0.35));
        opacity:.95;
      }
      #mwl-rpt-btn .mwl-rpt-ring {
        width:18px; height:18px; border-radius:999px; flex:0 0 auto; position:relative;
        background:conic-gradient(rgba(216,180,106,0.92) var(--deg,0deg),rgba(255,255,255,0.10) 0deg);
        box-shadow:0 0 0 1px rgba(255,255,255,0.10) inset;
      }
      #mwl-rpt-btn .mwl-rpt-ring::after {
        content:""; position:absolute; inset:2px; border-radius:999px;
        background:rgba(12,12,16,0.92);
      }
      #mwl-rpt-btn .mwl-rpt-ringText {
        position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
        font-size:12px; font-weight:900; color:rgba(255,255,255,0.92); z-index:2; line-height:1;
      }
      #mwl-rpt-btn.is-done { border-color:rgba(216,180,106,0.46); }
      #mwl-rpt-btn.is-done .mwl-rpt-ring {
        background:conic-gradient(rgba(103,224,138,0.92) 360deg,rgba(103,224,138,0.92) 0deg);
      }
      #mwl-rpt-toast {
        position:fixed; z-index:999999; left:18px; bottom:18px;
        padding:10px 12px; border-radius:14px;
        background:rgba(18,18,22,0.92); border:1px solid rgba(255,255,255,0.14);
        color:rgba(255,255,255,0.92);
        font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
        font-size:12px; box-shadow:0 16px 50px rgba(0,0,0,0.55); backdrop-filter:blur(10px);
        transform:translateY(10px); opacity:0; pointer-events:none;
        transition:opacity .18s ease,transform .18s ease;
      }
      #mwl-rpt-toast.show { opacity:1; transform:translateY(0); }
    `);
  }

  // Listener tracking for cleanup
  let _dragMoveHandler = null;
  let _dragUpHandler   = null;
  let _resizeHandler   = null;
  let _scrollHandler   = null;

  function removeWindowListeners() {
    if (_dragMoveHandler) { window.removeEventListener("mousemove", _dragMoveHandler); _dragMoveHandler = null; }
    if (_dragUpHandler)   { window.removeEventListener("mouseup",   _dragUpHandler);   _dragUpHandler   = null; }
    if (_resizeHandler)   { window.removeEventListener("resize",    _resizeHandler);   _resizeHandler   = null; }
    if (_scrollHandler)   { window.removeEventListener("scroll",    _scrollHandler);   _scrollHandler   = null; }
  }

  function ensureButton() {
    if (document.getElementById("mwl-rpt-btn")) { updateProgressUI(); return; }
    ensureStyles();
    removeWindowListeners();

    const pos  = loadPos();
    const ring = el("div", { class: "mwl-rpt-ring" }, [el("div", { class: "mwl-rpt-ringText" })]);
    const btn  = el("div", { id: "mwl-rpt-btn", title: "Drag per spostare • Click per esportare Report" }, [
      ring, el("span", {}, ["REPORT"])
    ]);

    btn.style.left = `${clamp(pos.x, 0, window.innerWidth  - 180)}px`;
    btn.style.top  = `${clamp(pos.y, 0, window.innerHeight -  60)}px`;

    let drag = null, suppressClick = false;
    btn.addEventListener("mousedown", e => {
      drag = { sx: e.clientX, sy: e.clientY, rect: btn.getBoundingClientRect() };
      suppressClick = false; e.preventDefault();
    });

    _dragMoveHandler = e => {
      if (!drag) return;
      const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressClick = true;
      btn.style.left = `${clamp(drag.rect.left + dx, 0, window.innerWidth  - drag.rect.width)}px`;
      btn.style.top  = `${clamp(drag.rect.top  + dy, 0, window.innerHeight - drag.rect.height)}px`;
    };
    _dragUpHandler = () => {
      if (!drag) return;
      const r = btn.getBoundingClientRect();
      savePos(Math.round(r.left), Math.round(r.top));
      drag = null;
    };
    window.addEventListener("mousemove", _dragMoveHandler);
    window.addEventListener("mouseup",   _dragUpHandler);

    btn.addEventListener("click", () => {
      if (suppressClick) { suppressClick = false; return; }
      exportReportXls();
    });

    document.body.appendChild(btn);
    updateProgressUI();

    _resizeHandler = () => {
      const b = document.getElementById("mwl-rpt-btn"); if (!b) return;
      const r = b.getBoundingClientRect();
      const nx = clamp(r.left, 0, window.innerWidth  - r.width);
      const ny = clamp(r.top,  0, window.innerHeight - r.height);
      b.style.left = `${nx}px`; b.style.top = `${ny}px`;
      savePos(Math.round(nx), Math.round(ny));
    };
    window.addEventListener("resize", _resizeHandler, { passive: true });

    _scrollHandler = () => { if (isToolRoute()) updateProgressUI(); };
    window.addEventListener("scroll", _scrollHandler, { passive: true });
  }

  // Mount / unmount
  let _progressTimer = null;

  function mount() {
    if (!isToolRoute()) return;
    ensureButton();
    if (!_progressTimer) {
      _progressTimer = setInterval(() => { if (isToolRoute()) updateProgressUI(); }, 900);
    }
  }

  function unmount() {
    document.getElementById("mwl-rpt-btn")?.remove();
    removeWindowListeners();
    if (_progressTimer) { clearInterval(_progressTimer); _progressTimer = null; }
  }

  function onRouteChange() { if (isToolRoute()) mount(); else unmount(); }

  // SPA hooks
  const _push    = history.pushState;
  const _replace = history.replaceState;
  const fire     = () => setTimeout(onRouteChange, 0);
  history.pushState    = function() { const r = _push.apply(this, arguments);    fire(); return r; };
  history.replaceState = function() { const r = _replace.apply(this, arguments); fire(); return r; };
  window.addEventListener("popstate", fire);

  onRouteChange();
})();

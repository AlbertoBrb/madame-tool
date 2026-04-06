// ==UserScript==
// @name         Madame Channel
// @namespace    https://github.com/AlbertoBrb
// @version      1.0.1
// @description  Header e favicon per canale MRP/NAP, toggle click-to-switch, fallback automatico ricerca sul canale opposto.
// @author       AlbertoBrb
// @match        https://madame.ynap.biz/*
// @grant        none
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-search.user.js
// @downloadURL  https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-search.user.js
// ==/UserScript==

(() => {
  "use strict";

  const KEY_GLOBAL = "__MWL_REPORT_ONLY__V110__";
  if (window[KEY_GLOBAL]) return;
  window[KEY_GLOBAL] = true;

  // ========= Routes =========
  const WORKLIST_RE = /^\/worklist\/\d+/;
  const SEARCH_RE = /^\/search\b/;
  const isToolRoute = () => WORKLIST_RE.test(location.pathname) || SEARCH_RE.test(location.pathname);

  // ========= Selectors =========
  const VID_SELECTOR = "h4.css-10pdxui";
  const VID_FALLBACK_SELECTOR = "h4";
  const REPORT_BRAND_NAME_SELECTOR = "h4.css-zr7m9w";
  const REPORT_CATEGORY_PATH_SELECTOR = "span.css-f1o1mh";
  const BRAND_IMG_SELECTOR_PRIMARY = "img.css-18m31dc";
  const BRAND_IMG_SELECTOR_FALLBACK = "img[src*='iris.product.ext.ynapgroup.com/internal/']";
  const CHIP_LABEL_SELECTOR = "span.MuiChip-label, span[class*='MuiChip-label']";

  // ========= Persistenza posizione =========
  const STORE_POS = "MWL_REPORT_BTN_POS_V1";
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  function loadPos() {
    try {
      const raw = localStorage.getItem(STORE_POS);
      const obj = raw ? JSON.parse(raw) : null;
      if (obj && typeof obj === "object" && Number.isFinite(obj.x) && Number.isFinite(obj.y)) return obj;
    } catch {}
    return { x: Math.max(12, window.innerWidth - 170), y: 120 };
  }
  function savePos(x, y) {
    try { localStorage.setItem(STORE_POS, JSON.stringify({ x, y })); } catch {}
  }

  // ========= Util =========
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
    if (!t) {
      t = el("div", { id: "mwl-rpt-toast" }, [""]);
      document.body.appendChild(t);
    }
    t.textContent = String(msg);
    t.classList.add("show");
    clearTimeout(toast._tm);
    toast._tm = setTimeout(() => t.classList.remove("show"), 1400);
  }

  function looksLikeVID(text) {
    return /^\d{10,}$/.test(String(text || "").trim());
  }

  function xmlEscape(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");
  }

  function dlFile(filename, mime, content) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function excelSheetNameFromTitle(title) {
    let s = String(title || "").trim() || "Report";
    s = s.replace(/[:\\\/\?\*\[\]]/g, " ");
    s = s.replace(/\s+/g, " ").trim() || "Report";
    if (s.length > 31) s = s.slice(0, 31);
    return s;
  }

  // ========= Worklist/Search header =========
  function getTextById(id) {
    const n = document.getElementById(id);
    return n ? String(n.textContent || "").trim() : "";
  }
  function getAriaById(id) {
    const n = document.getElementById(id);
    return n ? String(n.getAttribute("aria-label") || "").trim() : "";
  }

  // ========= MadameUtils coordination =========
  // Reads data already computed by the main tool (5.12+) to avoid double DOM scan.
  // Falls back to own DOM scan if main tool is not running.
  function getSharedProducts() {
    const mu = window.MadameUtils;
    if (mu && Array.isArray(mu._lastProducts) && mu._lastProducts.length > 0) {
      return mu._lastProducts;
    }
    return null; // trigger fallback
  }

  function getSharedTotalVariants() {
    const mu = window.MadameUtils;
    if (mu && typeof mu._totalVariants === "number") return mu._totalVariants;
    return null; // trigger fallback
  }

  function parseVariantsTotal() {
    // Try shared data first
    const shared = getSharedTotalVariants();
    if (shared !== null) return shared;
    // Own fallback
    const s = getAriaById("info-box-1") || getTextById("info-box-1") || "";
    const m = s.match(/Number of variants:\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : null;
  }

  // ========= Robust VID/products (fallback only) =========
  function findAllVidNodes() {
    let nodes = qsa(VID_SELECTOR).filter(n => looksLikeVID(n.textContent));
    if (nodes.length) return nodes;
    return qsa(VID_FALLBACK_SELECTOR).filter(n => looksLikeVID((n.textContent || "").trim()));
  }

  function hasAnySlotMarker(root) {
    if (!root) return false;
    const slotRe = /(?:^|[\s/·|:()\[\]-])\s*(IN|OU|OUT|OUTFIT|OU2|BK|FR|CU|PR|SW|RW|E[1-8])\s*(?:$|[\s/·|:()\[\]-])/i;
    const titled = root.querySelectorAll("[title],[aria-label]");
    for (const n of titled) {
      const t = (n.getAttribute("title") || n.getAttribute("aria-label") || "").trim();
      if (slotRe.test(t)) return true;
    }
    const textNodes = root.querySelectorAll("span,div,td,button");
    for (let i = 0; i < Math.min(textNodes.length, 60); i++) {
      const t = (textNodes[i].textContent || "").trim();
      if (t && t.length <= 40 && slotRe.test(t)) return true;
    }
    return false;
  }

  function findProductRootFromVidNode(vidNode) {
    const tr = vidNode.closest("tr");
    if (tr && hasAnySlotMarker(tr)) return tr;
    let node = vidNode;
    for (let i = 0; i < 14 && node; i++) {
      node = node.parentElement;
      if (!node) break;
      const vidsInside = Array.from(node.querySelectorAll("h4,span,td,div,a"))
        .map(n => (n.textContent || "").trim())
        .filter(looksLikeVID);
      const unique = Array.from(new Set(vidsInside));
      if (unique.length === 1 && unique[0] === (vidNode.textContent || "").trim() && hasAnySlotMarker(node)) {
        return node;
      }
    }
    return vidNode.closest("div") || vidNode.parentElement;
  }

  function getProductsFallback() {
    const vidNodes = findAllVidNodes();
    const products = [];
    const seen = new Set();
    for (const vn of vidNodes) {
      const vid = (vn.textContent || "").trim();
      if (!looksLikeVID(vid)) continue;
      const root = findProductRootFromVidNode(vn);
      if (!root || seen.has(root)) continue;
      seen.add(root);
      products.push({ vid, root });
    }
    return products;
  }

  function getProducts() {
    // Prefer shared data from main tool — avoids double DOM scan
    return getSharedProducts() ?? getProductsFallback();
  }

  // ========= Estrazioni per report =========
  function getProductTags(productRoot) {
    const set = new Set();
    for (const n of qsa(CHIP_LABEL_SELECTOR, productRoot)) {
      const t = (n.textContent || "").trim();
      if (t) set.add(t.toUpperCase());
    }
    return set;
  }

  function extractBrandName(productRoot) {
    if (!productRoot) return "";
    const h = productRoot.querySelector(REPORT_BRAND_NAME_SELECTOR);
    if (h) {
      const t = (h.textContent || "").trim();
      if (t && t.length <= 80 && !looksLikeVID(t)) return t;
    }
    const brandImg =
      productRoot.querySelector(BRAND_IMG_SELECTOR_PRIMARY) ||
      productRoot.querySelector(BRAND_IMG_SELECTOR_FALLBACK) ||
      productRoot.querySelector("img");
    if (brandImg) {
      const alt = (brandImg.getAttribute("alt") || "").trim();
      if (alt && alt.length <= 40) return alt;
      const title = (brandImg.getAttribute("title") || "").trim();
      if (title && title.length <= 40) return title;
    }
    const txts = Array.from(productRoot.querySelectorAll("h5,h6,strong,b,span,div,a"))
      .map(n => (n.textContent || "").trim())
      .filter(t => t && t.length >= 2 && t.length <= 40 && !looksLikeVID(t))
      .slice(0, 18);
    for (const t of txts) {
      if (/^[A-Z0-9&\-\s']+$/.test(t) && t.replace(/\s/g, "").length >= 3) return t;
    }
    return txts[0] || "";
  }

  function extractCategoryTriplet(productRoot) {
    if (!productRoot) return { category: "", subCategory: "", detail: "" };
    const n = productRoot.querySelector(REPORT_CATEGORY_PATH_SELECTOR);
    const raw = n ? String(n.textContent || "").trim() : "";
    if (!raw) return { category: "", subCategory: "", detail: "" };
    const parts = raw.split(">").map(x => String(x || "").trim()).filter(Boolean);
    return { category: parts[0] || "", subCategory: parts[1] || "", detail: parts[2] || "" };
  }

  // ========= REPORT (SpreadsheetML) =========
  function exportReportXls() {
    if (!isToolRoute()) {
      toast("Apri una Worklist o Search per esportare.");
      return;
    }

    const products = getProducts();
    if (!products.length) {
      alert("Nessun prodotto rilevato.\nSuggerimento: scrolla per caricare più righe e riprova.");
      return;
    }

    const wlName = (getTextById("info-box-0") || getAriaById("info-box-0") || (SEARCH_RE.test(location.pathname) ? "Search" : "Worklist")).trim();
    const when = new Date();

    const rows = products
      .map(p => {
        const tags = getProductTags(p.root);
        const tax = extractCategoryTriplet(p.root);
        const brandName = extractBrandName(p.root);
        return [
          p.vid,
          tax.category || "",
          tax.subCategory || "",
          tax.detail || "",
          brandName || "",
          tags.has("REC") ? "REC" : "",
          tags.has("BWL") ? "BWL" : "",
          tags.has("IN ONLY") ? "TRUE" : "",
          "", // MODEL
          ""  // STATUS
        ];
      })
      .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

    const sheetName = excelSheetNameFromTitle(wlName);
    const safeWl = (wlName || "worklist").replace(/[^\w\-]+/g, "_").slice(0, 40);
    const fname = `Madame_Report_${safeWl}_${when.toISOString().slice(0, 10)}_V110.xml`;

    const COLS = ["variantId", "category", "subCategory", "detail", "brandName", "REC", "BWL", "IN ONLY", "MODEL", "STATUS"];
    const colWidths = [150, 140, 160, 180, 180, 70, 70, 90, 90, 110];
    const autoFilterRange = "R1C1:R1C10";

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
  <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
    <Title>Madame Report</Title>
    <Author>MWL</Author>
    <Created>${xmlEscape(when.toISOString())}</Created>
    <Version>1.1.0</Version>
  </DocumentProperties>

  <Styles>
    <Style ss:ID="sCell">
      <Alignment ss:Vertical="Center" ss:WrapText="0"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Color="#111827"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sHeader">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0B0C0F" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sVid">
      <Alignment ss:Vertical="Center"/>
      <NumberFormat ss:Format="@"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E7EB"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#D1D5DB"/>
      </Borders>
      <Font ss:FontName="Consolas" ss:Size="11" ss:Color="#111827"/>
      <Interior ss:Color="#FFFFFF" ss:Pattern="Solid"/>
    </Style>
    <Style ss:ID="sHeaderVid">
      <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
      <Borders>
        <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
        <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
        <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#222222"/>
        <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="3" ss:Color="#6B7280"/>
      </Borders>
      <Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
      <Interior ss:Color="#0B0C0F" ss:Pattern="Solid"/>
    </Style>
  </Styles>

  <Worksheet ss:Name="${xmlEscape(sheetName)}">
    <Table ss:DefaultRowHeight="15">
      ${colWidths.map(w => `<Column ss:AutoFitWidth="0" ss:Width="${w}"/>`).join("")}
      <Row>
        ${COLS.map((c, i) => {
          const style = (i === 0) ? "sHeaderVid" : "sHeader";
          return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xmlEscape(c)}</Data></Cell>`;
        }).join("")}
      </Row>
      ${rows.map(r => `
      <Row>
        ${r.map((v, i) => {
          const style = (i === 0) ? "sVid" : "sCell";
          return `<Cell ss:StyleID="${style}"><Data ss:Type="String">${xmlEscape(v)}</Data></Cell>`;
        }).join("")}
      </Row>`).join("")}
    </Table>
    <AutoFilter xmlns="urn:schemas-microsoft-com:office:excel" x:Range="${autoFilterRange}" />
    <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
      <Selected/>
      <FreezePanes/>
      <FrozenNoSplit/>
      <SplitHorizontal>1</SplitHorizontal>
      <TopRowBottomPane>1</TopRowBottomPane>
      <ActivePane>2</ActivePane>
      <Panes><Pane><Number>2</Number></Pane></Panes>
      <ProtectObjects>False</ProtectObjects>
      <ProtectScenarios>False</ProtectScenarios>
    </WorksheetOptions>
  </Worksheet>
</Workbook>`;

    dlFile(fname, "application/vnd.ms-excel;charset=utf-8", xml);
    toast(`Report esportato: ${rows.length} righe`);
  }

  // ========= Progress ring =========
  function updateProgressUI() {
    const btn = document.getElementById("mwl-rpt-btn");
    if (!btn) return;
    const ring = btn.querySelector(".mwl-rpt-ring");
    const txt = btn.querySelector(".mwl-rpt-ringText");
    if (!ring || !txt) return;

    // Use shared data if available — no DOM scan needed
    const total = parseVariantsTotal();
    const loaded = (() => {
      const shared = getSharedProducts();
      if (shared) return shared.length;
      try { return getProductsFallback().length; } catch { return 0; }
    })();

    if (!(typeof total === "number" && total > 0)) {
      btn.classList.remove("is-done");
      ring.style.setProperty("--deg", "0deg");
      txt.textContent = "";
      ring.title = "Total variants not available yet";
      return;
    }

    const p = clamp(loaded / total, 0, 1);
    const deg = Math.round(p * 360);
    ring.style.setProperty("--deg", `${deg}deg`);

    const done = loaded >= total;
    btn.classList.toggle("is-done", done);

    if (done) {
      txt.textContent = "✓";
      ring.title = `Loaded ${loaded} / ${total} (100%)`;
    } else {
      txt.textContent = "";
      ring.title = `Loaded ${loaded} / ${total} (${Math.round(p * 100)}%)`;
    }
  }

  // ========= UI: bottone flottante draggabile =========
  function ensureStyles() {
    GM_addStyle(`
      #mwl-rpt-btn{
        position:fixed;z-index:999999;width:168px;height:42px;
        border-radius:16px;border:1px solid rgba(216,180,106,0.28);
        background:linear-gradient(180deg,rgba(10,10,12,0.92),rgba(22,22,28,0.92));
        box-shadow:0 16px 50px rgba(0,0,0,0.58);backdrop-filter:blur(10px);
        color:rgba(255,255,255,0.92);
        font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
        user-select:none;display:flex;align-items:center;justify-content:center;
        cursor:grab;transition:transform .10s ease,border-color .12s ease,background .12s ease;
        letter-spacing:.14em;text-transform:uppercase;font-weight:900;font-size:12px;
        overflow:hidden;gap:10px;padding:0 12px 0 10px;
      }
      #mwl-rpt-btn:active{cursor:grabbing;}
      #mwl-rpt-btn:hover{
        border-color:rgba(216,180,106,0.42);
        background:linear-gradient(180deg,rgba(8,8,10,0.96),rgba(20,20,26,0.96));
        transform:translateY(-0.6px);
      }
      #mwl-rpt-btn::before{
        content:"";position:absolute;left:0;top:10px;bottom:10px;width:4px;
        border-radius:999px;
        background:linear-gradient(180deg,rgba(216,180,106,0.95),rgba(216,180,106,0.35));
        box-shadow:0 0 0 1px rgba(216,180,106,0.10),0 10px 26px rgba(0,0,0,0.25);opacity:.95;
      }
      #mwl-rpt-btn .mwl-rpt-ring{
        width:18px;height:18px;border-radius:999px;flex:0 0 auto;position:relative;
        background:conic-gradient(rgba(216,180,106,0.92) var(--deg,0deg),rgba(255,255,255,0.10) 0deg);
        box-shadow:0 0 0 1px rgba(255,255,255,0.10) inset;
      }
      #mwl-rpt-btn .mwl-rpt-ring::after{
        content:"";position:absolute;inset:2px;border-radius:999px;
        background:rgba(12,12,16,0.92);box-shadow:0 0 0 1px rgba(255,255,255,0.06) inset;
      }
      #mwl-rpt-btn .mwl-rpt-ringText{
        position:absolute;inset:0;display:flex;align-items:center;justify-content:center;
        font-size:12px;font-weight:900;color:rgba(255,255,255,0.92);z-index:2;
        line-height:1;transform:translateY(-0.2px);
      }
      #mwl-rpt-btn.is-done{
        border-color:rgba(216,180,106,0.46);
        box-shadow:0 18px 56px rgba(0,0,0,0.62),0 0 0 1px rgba(216,180,106,0.10) inset;
      }
      #mwl-rpt-btn.is-done .mwl-rpt-ring{
        background:conic-gradient(rgba(103,224,138,0.92) 360deg,rgba(103,224,138,0.92) 0deg);
      }
      #mwl-rpt-toast{
        position:fixed;z-index:999999;left:18px;bottom:18px;
        padding:10px 12px;border-radius:14px;
        background:rgba(18,18,22,0.92);border:1px solid rgba(255,255,255,0.14);
        color:rgba(255,255,255,0.92);
        font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
        font-size:12px;box-shadow:0 16px 50px rgba(0,0,0,0.55);backdrop-filter:blur(10px);
        transform:translateY(10px);opacity:0;
        transition:opacity .18s ease,transform .18s ease;pointer-events:none;
      }
      #mwl-rpt-toast.show{opacity:1;transform:translateY(0px);}
    `);
  }

  function ensureButton() {
    const old = document.getElementById("mwl-rpt-btn");
    if (old) old.remove();

    ensureStyles();

    const pos = loadPos();
    const ring = el("div", { class: "mwl-rpt-ring" }, [
      el("div", { class: "mwl-rpt-ringText" }, [""])
    ]);
    const btn = el("div", { id: "mwl-rpt-btn", title: "Drag per spostare • Click per esportare Report" }, [
      ring,
      el("span", {}, ["REPORT"])
    ]);

    btn.style.left = `${clamp(pos.x, 0, window.innerWidth - 180)}px`;
    btn.style.top = `${clamp(pos.y, 0, window.innerHeight - 60)}px`;

    let drag = null;
    let suppressClick = false;

    btn.addEventListener("mousedown", (e) => {
      drag = { sx: e.clientX, sy: e.clientY, rect: btn.getBoundingClientRect() };
      suppressClick = false;
      e.preventDefault();
    });
    window.addEventListener("mousemove", (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.sx;
      const dy = e.clientY - drag.sy;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) suppressClick = true;
      const w = drag.rect.width, h = drag.rect.height;
      const nx = clamp(drag.rect.left + dx, 0, window.innerWidth - w);
      const ny = clamp(drag.rect.top + dy, 0, window.innerHeight - h);
      btn.style.left = `${nx}px`;
      btn.style.top = `${ny}px`;
    });
    window.addEventListener("mouseup", () => {
      if (!drag) return;
      const r = btn.getBoundingClientRect();
      savePos(Math.round(r.left), Math.round(r.top));
      drag = null;
    });
    btn.addEventListener("click", () => {
      if (suppressClick) { suppressClick = false; return; }
      exportReportXls();
    });

    document.body.appendChild(btn);
    updateProgressUI();
  }

  // ========= SPA: mount/unmount =========
  // Progress ring updates piggyback on MadameUtils._lastProducts written by the
  // main tool after every updateCounts — no need for a separate setInterval DOM scan.
  // We keep a lightweight interval only as fallback when the main tool is absent.
  let progressTimer = null;

  function mount() {
    if (!isToolRoute()) return;
    ensureButton();

    // Only start own interval if main tool's shared data is not available
    if (!progressTimer) {
      progressTimer = setInterval(() => {
        if (!isToolRoute()) return;
        // If main tool is running, _lastProducts is already fresh — just update the UI
        updateProgressUI();
      }, 900);
    }
  }

  function unmount() {
    const b = document.getElementById("mwl-rpt-btn");
    if (b) b.remove();
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
  }

  function onRouteChange() {
    if (isToolRoute()) mount();
    else unmount();
  }

  const _push = history.pushState;
  const _replace = history.replaceState;
  const fire = () => setTimeout(onRouteChange, 0);
  history.pushState = function () { const ret = _push.apply(this, arguments); fire(); return ret; };
  history.replaceState = function () { const ret = _replace.apply(this, arguments); fire(); return ret; };
  window.addEventListener("popstate", fire);

  window.addEventListener("resize", () => {
    const btn = document.getElementById("mwl-rpt-btn");
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const nx = clamp(r.left, 0, window.innerWidth - r.width);
    const ny = clamp(r.top, 0, window.innerHeight - r.height);
    btn.style.left = `${nx}px`;
    btn.style.top = `${ny}px`;
    savePos(Math.round(nx), Math.round(ny));
  });

  // Scroll: update ring UI only — DOM scan avoidato se main tool attivo
  window.addEventListener("scroll", () => {
    if (!isToolRoute()) return;
    updateProgressUI();
  }, { passive: true });

  onRouteChange();
})();

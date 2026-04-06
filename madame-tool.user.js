// ==UserScript==
// @name         Madame Dashboard
// @namespace    https://tampermonkey.net/
// @version      5.12.0
// @description  Dashboard embedded per worklist e search. Contatori Still Life / Model, navigazione VID, QC Carousel, Load All.
// @author       AlbertoBrb
// @match        https://madame.ynap.biz/*
// @grant        GM_addStyle
// @run-at       document-idle
// @updateURL    https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-tool.user.js
// @downloadURL  https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-tool.user.js
// ==/UserScript==

(() => {
  "use strict";

  const GLOBAL_KEY = "__MWL_V512__";
  if (window[GLOBAL_KEY]) return;
  window[GLOBAL_KEY] = { version: "5.12.0", startedAt: Date.now() };

  // ═══════════════════════════════════════
  // Routes
  // ═══════════════════════════════════════
  const WORKLIST_RE = /^\/worklist\/\d+/;
  const SEARCH_RE   = /^\/search\b/;
  function isWorklistRoute() { return WORKLIST_RE.test(location.pathname); }
  function isSearchRoute(){
    if(!SEARCH_RE.test(location.pathname))return false;
    // Exclude ?t=2 (Saved Searches tab — no VID list to work with)
    const t=new URLSearchParams(location.search).get("t");
    return t!=="2";
  }
  function isSupportedRoute(){ return isWorklistRoute() || isSearchRoute(); }

  // ═══════════════════════════════════════
  // Engine constants
  // ═══════════════════════════════════════
  const VID_SELECTOR   = "h4.css-10pdxui";
  const TILE_SELECTOR  = "div.MuiBox-root.css-1dcsz0a";
  const LABEL_SELECTOR = "span[title]";
  const IMG_SELECTOR   = "img.css-1u8qly9";
  const BRAND_IMG_SELECTOR_PRIMARY  = "img.css-18m31dc";
  const BRAND_IMG_SELECTOR_FALLBACK = "img[src*='iris.product.ext.ynapgroup.com/internal/']";
  const REJECTED_BOX_SELECTOR = "div.css-8fpqzo";
  const VID_FALLBACK_SELECTOR  = "h4";
  const TILE_FALLBACK_SELECTOR = "div.MuiBox-root";
  const IS_IN = (t) => typeof t === "string" && t.includes("/ IN");
  const IS_OU = (t) => typeof t === "string" && (t.includes("/ OU") || t.includes("/ OUT") || t.includes("/ OUTFIT"));
  const TAGS_OF_INTEREST    = ["IN ONLY", "OM ONLY", "MODEL SIZE UNAVAILABLE"];
  const CHIP_LABEL_SELECTOR = "span.MuiChip-label, span[class*='MuiChip-label']";
  const RTW_TAG = "RTW";
  const QC_VIDEO_HEADER_SELECTOR = "div.MuiBox-root.css-45c539";

  // ═══════════════════════════════════════
  // QC constants
  // ═══════════════════════════════════════
  const QC_WIDTH = 600;
  const QC_VIEW_ORDER = ["brand","in","ou","fr","bk","ou2","e1","e2","e3","e4","e5","e6","e7","e8","cu","pr","sw","rw","video"];
  const OVERLAY_VIEWS = new Set(["in","fr","ou","bk","ou2","e1","e2","e3","e4","e5","e6","e7","e8"]);
  const OVERLAY_SP_URL = "https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/3x4%20Templates/ACCS.png";
  const REFERENCES = {
    MRP: [
      { name:"CONCRETE 1", url:"https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/MP_CONCRETE_408_BACK%205550K.png" },
      { name:"CONCRETE 2", url:"https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/MP_CONCRETE_2_358_BACK500K_PRIMOCTO1-4DA%208CM%20SU%20LATO%20SX.png" },
      { name:"TRAVERTINO", url:"https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/MP_TRAVERTINO_091.png" },
    ],
    NAP: [
      { name:"MARMO",    url:"https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_MARMO_337_BACK%205250K%20TINTA%20-0,10_SX%205000K_SECONDO%20SKY%205500K.png" },
      { name:"PARQUET 1",url:"https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_PARQUET_1_268_%20SX%204800K%20TINTA%200,15%20-%20BACK%205000K%20TINTA%200.png" },
      { name:"PARQUET 2",url:"https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_PARQUET_2_270_FONDO%205000K%20TINTA%200.png" },
      { name:"PARQUET 3",url:"https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_PARQUET_3_319_BACK%204000K_SX%204300K%20-0,10_DX%20PRIMO%20SKYP%202%20STRISCE%20UN%20QUARTO%20CTO.png" },
      { name:"PARQUET 4",url:"https://ynap.sharepoint.com/sites/O365G-Ecommerce-Studio/Files/Photography/03%20IT%20Photography%20Team/MIMO%20MODEL%20SETTINGS/PNG/NAP_PARQUET_4_303_SX%204850K%20TINTA%20-0,10.png" },
    ],
  };
  const SLOT_CODE_RE = /\/\s*(IN|OU|OU2|BK|FR|CU|PR|SW|RW|E[1-8])\s*$/i;

  // ═══════════════════════════════════════
  // Flags + Telemetry
  // ═══════════════════════════════════════
  const FLAGS_KEY    = "mimo_wl_flags_v1";
  const TELEMETRY_KEY = "mimo_wl_telemetry_v1";
  const DEFAULT_FLAGS = {
    enableQC:true, enableOverlayGuides:true, enableReferences:true,
    enableNoPhotoHighlight:true, enableRTWVideoKPI:true, enableRejectedKPI:true,
    enableShortcuts:true, enableHelpOverlay:true, enableReportExport:true,
    enableTelemetry:true, enableResilienceFallbacks:true, enablePerfGating:true
  };
  function loadFlags(){ try{ const r=localStorage.getItem(FLAGS_KEY); return{...DEFAULT_FLAGS,...(r?JSON.parse(r):{})}; }catch{ return{...DEFAULT_FLAGS}; } }
  function saveFlags(next){ try{ localStorage.setItem(FLAGS_KEY,JSON.stringify({...loadFlags(),...next})); }catch{} }
  function loadTelemetry(){ try{ return JSON.parse(localStorage.getItem(TELEMETRY_KEY)||"null")||{errors:{},counters:{},last:null}; }catch{ return{errors:{},counters:{},last:null}; } }
  function bumpErr(key){ if(!loadFlags().enableTelemetry)return; try{ const t=loadTelemetry(); t.errors[key]=(t.errors[key]||0)+1; localStorage.setItem(TELEMETRY_KEY,JSON.stringify(t)); }catch{} }
  function bumpCnt(key,n=1){ if(!loadFlags().enableTelemetry)return; try{ const t=loadTelemetry(); t.counters[key]=(t.counters[key]||0)+n; localStorage.setItem(TELEMETRY_KEY,JSON.stringify(t)); }catch{} }
  function safe(label,fn,fb){ try{ return fn(); }catch{ bumpErr(label); return fb; } }

  // ═══════════════════════════════════════
  // Scroll helpers (Load All)
  // ═══════════════════════════════════════
  function ensureMadameUtils(){ window.MadameUtils=window.MadameUtils||{}; return window.MadameUtils; }
  function findScrollableContainer(){
    const s=document.querySelector('div.MuiBox-root[style*="overflow: auto"]');
    if(s&&s.clientHeight>300)return s;
    let best=document.scrollingElement||document.documentElement,bs=0;
    for(const e of [document.scrollingElement,document.documentElement,document.body,...document.querySelectorAll("div,main,section")].filter(Boolean)){
      const sh=e?.scrollHeight||0,ch=e?.clientHeight||0;
      if(sh>ch+300&&sh>bs){bs=sh;best=e;}
    }
    return best;
  }
  function isDoc(e){ return e===document.body||e===document.documentElement||e===document.scrollingElement; }
  function gTop(s){ return isDoc(s)?(document.scrollingElement?.scrollTop??window.scrollY??0):s.scrollTop; }
  function sTop(s,v){ if(isDoc(s))document.scrollingElement.scrollTop=v; else s.scrollTop=v; }
  function gCH(s){ return isDoc(s)?window.innerHeight:(s.clientHeight||window.innerHeight); }
  function gSH(s){ return isDoc(s)?(document.scrollingElement?.scrollHeight??document.documentElement.scrollHeight):s.scrollHeight; }
  function isPid(t){ return /^\d{10,19}$/.test((t||"").trim()); }
  function countPids(){ return new Set(Array.from(document.querySelectorAll("h4")).filter(h=>isPid(h.textContent)).map(h=>h.textContent.trim())).size; }

  async function forceLoadAllBalanced(opts={}){
    const sc=opts.container||findScrollableContainer(),pA=opts.pauseA??220,pB=opts.pauseB??180,mL=opts.maxLoops??600,mS=opts.maxStable??5;
    let cancelled=false;
    const kd=(e)=>{if(e.key==="Escape")cancelled=true;}; document.addEventListener("keydown",kd);
    try{
      let lH=gSH(sc),sH=0,lP=countPids(),sP=0;
      for(let i=0;i<mL;i++){
        if(cancelled)break;
        const step=opts.stepPx??gCH(sc),top=gTop(sc),h=gSH(sc),ch=gCH(sc);
        sTop(sc,Math.min(top+step,Math.max(0,h-ch)));
        await new Promise(r=>setTimeout(r,pA)); await new Promise(r=>setTimeout(r,pB));
        const t2=gTop(sc),h2=gSH(sc),ch2=gCH(sc);
        if(typeof opts.onProgress==="function")opts.onProgress({loop:i,percent:Math.min(99,Math.round(((t2+ch2)/h2)*100)),height:h2});
        if(t2>=(h2-ch2-30)){
          if(Math.abs(h2-lH)<2)sH++;else sH=0; lH=h2;
          const p=countPids(); if(p===lP)sP++;else sP=0; lP=p;
          if(sH>=mS&&sP>=mS)break;
        }
      }
      if(opts.returnToTop??true)sTop(sc,0);
    }finally{ document.removeEventListener("keydown",kd); }
  }
  { const u=ensureMadameUtils(); if(!u.forceLoadAllBalanced)u.forceLoadAllBalanced=forceLoadAllBalanced; if(!u.findScrollableContainer)u.findScrollableContainer=findScrollableContainer; }

  // ═══════════════════════════════════════
  // Helpers
  // ═══════════════════════════════════════
  const PANEL_ID  = "mwl-panel";
  const ATTR_NEXT    = "data-mwl-next";
  const ATTR_NOPHOTO = "data-mwl-nophoto";

  const clamp = (v,a,b) => Math.max(a,Math.min(b,v));
  const qs  = (sel,root=document) => root.querySelector(sel);
  const qsa = (sel,root=document) => Array.from(root.querySelectorAll(sel));
  const pct = (part,total) => total ? Math.round((part/total)*100) : 0;

  function el(tag,attrs={},children=[]){
    const n=document.createElement(tag);
    for(const[k,v]of Object.entries(attrs)){
      if(k==="class")n.className=v;
      else if(k==="style"&&typeof v==="object")Object.assign(n.style,v);
      else if(k.startsWith("on")&&typeof v==="function")n.addEventListener(k.slice(2),v);
      else n.setAttribute(k,v);
    }
    for(const c of children){ if(c==null)continue; if(typeof c==="string")n.appendChild(document.createTextNode(c)); else n.appendChild(c); }
    return n;
  }

  function looksLikeVID(t){ return /^\d{15,}$/.test(String(t||"").trim()); }
  function getTextById(id){ const n=document.getElementById(id); return n?String(n.textContent||"").trim():""; }
  function getAriaById(id){ const n=document.getElementById(id); return n?String(n.getAttribute("aria-label")||"").trim():""; }

  function copyToClipboard(text){
    const t=String(text??""); if(!t)return false;
    if(navigator.clipboard?.writeText){ navigator.clipboard.writeText(t).catch(()=>fb(t)); return true; }
    return fb(t);
    function fb(s){ const ta=el("textarea",{style:{position:"fixed",left:"-9999px",top:"-9999px"}},[s]); document.body.appendChild(ta); ta.select(); let ok=false; try{ok=document.execCommand("copy");}catch{} ta.remove(); return ok; }
  }
  function isEditable(elm){ if(!elm)return false; const t=(elm.tagName||"").toUpperCase(); return t==="INPUT"||t==="TEXTAREA"||t==="SELECT"||elm.isContentEditable; }

  function toast(msg){
    const t=el("div",{class:"mwl-toast"},[String(msg)]); document.body.appendChild(t);
    requestAnimationFrame(()=>t.classList.add("show"));
    setTimeout(()=>{ t.classList.remove("show"); setTimeout(()=>t.remove(),200); },1300);
  }

  // ═══════════════════════════════════════
  // Engine state
  // ═══════════════════════════════════════
  let focus = {type:"missing",value:""};
  let focusList=[], focusPtr=0;
  let lastHighlightedEl=null;
  let updateScheduled=false, updateTimer=null, observer=null, scrollAttached=false, mounted=false;
  let _countsDirty=true;  // true = DOM may have changed, updateCounts needed before goNext
  let lastAnalyses=[], lastKPIs=null, lastTagCounts=null;
  let helpOpen=false;
  let bannerExpanded=false;
  let activeUIKey="focus:missing";

  function setActiveUIKey(k){ activeUIKey=String(k||""); try{localStorage.setItem("MWL_ACTIVE_UI_KEY_V512",activeUIKey);}catch{} applyActiveStyles(); }
  function loadActiveUIKey(){ try{ const r=localStorage.getItem("MWL_ACTIVE_UI_KEY_V512"); if(r)activeUIKey=r; }catch{} }

  function applyActiveStyles(){
    const panel=document.getElementById(PANEL_ID); if(!panel)return;
    qsa("[data-ui-key]",panel).forEach(n=>n.classList.remove("is-active"));
    panel.querySelector(`[data-ui-key="${CSS.escape(activeUIKey)}"]`)?.classList.add("is-active");
    // Also mark clickable prog pills in strip
    qsa(".mwl-prog-clickable",panel).forEach(n=>n.classList.remove("is-active"));
    panel.querySelector(`.mwl-prog-clickable[data-ui-key="${CSS.escape(activeUIKey)}"]`)?.classList.add("is-active");
  }

  function saveEngineState(){ try{ localStorage.setItem("MWL_ENGINE_V512",JSON.stringify({focus})); }catch{} }
  function loadEngineState(){ try{ const o=JSON.parse(localStorage.getItem("MWL_ENGINE_V512")||"null"); if(o?.focus)focus={type:o.focus.type||"missing",value:o.focus.value||""}; }catch{} }

  // ═══════════════════════════════════════
  // Product analysis
  // ═══════════════════════════════════════
  function findProductRootFromVidNode(vidNode){
    let node=vidNode;
    for(let i=0;i<12&&node;i++){
      node=node.parentElement; if(!node)break;
      if(!node.querySelectorAll(TILE_SELECTOR).length)continue;
      const vids=Array.from(node.querySelectorAll(VID_SELECTOR)).map(n=>(n.textContent||"").trim()).filter(looksLikeVID);
      if(vids.length===1)return node;
    }
    return null;
  }
  function getVIDsFromSearch(){
    const vids=new Map();

    // Primary: same h4 selector used in worklist
    let nodes=Array.from(document.querySelectorAll(VID_SELECTOR)).filter(n=>looksLikeVID(n.textContent));

    // Fallback: any h4 with a long numeric string
    if(!nodes.length){
      nodes=Array.from(document.querySelectorAll(VID_FALLBACK_SELECTOR))
        .filter(n=>looksLikeVID((n.textContent||"").trim()));
    }

    for(const n of nodes){
      const vid=(n.textContent||"").trim();
      if(!vid||vids.has(vid))continue;
      // Use the same tight root detection as the worklist — falls back to direct parent
      const root=findProductRootFromVidNode(n)||(n.parentElement||n);
      vids.set(vid,root);
    }

    // If no h4 VIDs found, scan broader text but deduplicate by vid string only
    if(!vids.size){
      const re=/\b\d{15,}\b/g;
      for(const n of document.querySelectorAll("h1,h2,h3,h4,h5,h6,span,td,a")){
        const txt=(n.textContent||"").trim(); if(!txt)continue;
        for(const m of(txt.match(re)||[])){
          if(!vids.has(m))vids.set(m, n.parentElement||n);
        }
      }
    }

    return Array.from(vids.entries()).map(([vid,root])=>({vid,root}));
  }
  // Cache: root element → {fingerprint, a, tags}
  // Fingerprint = img count + rejected count + chip text length — cheap proxy for "has this tile changed"
  const _analysisCache = new WeakMap();
  function fingerprintRoot(root){
    // Counts imgs and rejected markers — cheap proxy for tile content changing.
    // Chip tags are fingerprinted separately in _tagsCache.
    const imgs=root.querySelectorAll(IMG_SELECTOR).length;
    const rejected=root.querySelectorAll(REJECTED_BOX_SELECTOR).length;
    return `${imgs}:${rejected}`;
  }

  function getProducts(flags){
    if(isSearchRoute())return getVIDsFromSearch();
    let vidNodes=qsa(VID_SELECTOR).filter(n=>looksLikeVID(n.textContent));
    if(flags.enableResilienceFallbacks&&!vidNodes.length){ vidNodes=qsa(VID_FALLBACK_SELECTOR).filter(n=>looksLikeVID((n.textContent||"").trim())); if(vidNodes.length)bumpCnt("fallback_vid",1); }
    const products=[];
    const seen=new Set();
    for(const vn of vidNodes){
      const root=findProductRootFromVidNode(vn)||(vn.closest("div")||vn.parentElement);
      if(!root||seen.has(root))continue;
      seen.add(root);
      products.push({vid:(vn.textContent||"").trim(),root});
    }
    return products;
  }
  function analyzeProduct(p,flags){
    const fp=fingerprintRoot(p.root);
    const cached=_analysisCache.get(p.root);
    if(cached&&cached.fp===fp)return cached.a;

    let tiles=qsa(TILE_SELECTOR,p.root);
    if(flags.enableResilienceFallbacks&&!tiles.length){ tiles=qsa(TILE_FALLBACK_SELECTOR,p.root).filter(t=>t.querySelector(LABEL_SELECTOR)||t.querySelector(QC_VIDEO_HEADER_SELECTOR)||t.querySelector(IMG_SELECTOR)); }
    let hasINShot=false,hasOUShot=false,hasINSlot=false,hasOUSlot=false,hasVideo=false,hasRejected=false;
    for(const tile of tiles){
      const label=qs(LABEL_SELECTOR,tile), title=label?(label.getAttribute("title")||""):"";
      if(IS_IN(title)){hasINSlot=true;if(tile.querySelector(IMG_SELECTOR))hasINShot=true;}
      else if(IS_OU(title)){hasOUSlot=true;if(tile.querySelector(IMG_SELECTOR))hasOUShot=true;}
      if(!hasVideo){const h=tile.querySelector(QC_VIDEO_HEADER_SELECTOR);if(h&&/video/i.test(h.textContent||"")&&tile.querySelector(IMG_SELECTOR))hasVideo=true;}
      if(!hasRejected&&tile.querySelector(REJECTED_BOX_SELECTOR))hasRejected=true;
      if(hasINShot&&hasOUShot&&hasVideo&&hasRejected)break;
    }
    const a={hasINSlot,hasOUSlot,hasINShot,hasOUShot,hasVideo,hasRejected};
    _analysisCache.set(p.root,{fp,a});
    return a;
  }
  function isMissing(a){ return(a.hasINSlot&&!a.hasINShot)||(a.hasOUSlot&&!a.hasOUShot); }
  function hasNoPhotos(a){ return(a.hasINSlot?!a.hasINShot:true)&&(a.hasOUSlot?!a.hasOUShot:true); }
  const _tagsCache = new WeakMap();
  function getProductTags(root){
    // Fingerprint: concatenated chip label text — changes when tags are added/removed
    const chipText=Array.from(root.querySelectorAll(CHIP_LABEL_SELECTOR)).map(n=>n.textContent||"").join("|");
    const cached=_tagsCache.get(root);
    if(cached&&cached.fp===chipText)return cached.tags;
    const s=new Set();
    chipText.split("|").forEach(t=>{const v=t.trim(); if(v)s.add(v.toUpperCase());});
    _tagsCache.set(root,{fp:chipText,tags:s});
    return s;
  }
  function getHighlightTarget(root){
    if(!root?.isConnected)return root;
    const vw=window.innerWidth, vh=window.innerHeight;
    const minW=vw*0.25, minH=vh*0.12;          // ~25% vw, ~12% vh
    const fallW=vw*0.18, fallH=vh*0.08;
    let n=root; for(let i=0;i<8&&n;i++){const r=n.getBoundingClientRect();if(r.width>=minW&&r.height>=minH)return n;n=n.parentElement;}
    n=root; for(let i=0;i<8&&n;i++){const r=n.getBoundingClientRect();if(r.width>=fallW&&r.height>=fallH)return n;n=n.parentElement;}
    return root;
  }

  // ═══════════════════════════════════════
  // Focus
  // ═══════════════════════════════════════
  function buildFocusList(analyses){
    const type=focus?.type||"missing", val=(focus?.value||"").toUpperCase();
    if(type==="tag")return analyses.filter(x=>x.tags?.has(val));
    if(type==="inToShoot")return analyses.filter(x=>x.a.hasINSlot&&!x.a.hasINShot);
    if(type==="ouToShoot")return analyses.filter(x=>x.a.hasOUSlot&&!x.a.hasOUShot);
    if(type==="rtwVideoMissing")return analyses.filter(x=>x.tags?.has(RTW_TAG)&&!x.a.hasVideo);
    if(type==="rejected")return analyses.filter(x=>x.a.hasRejected);
    return analyses.filter(x=>isMissing(x.a));
  }
  function listLabel(){
    if(isSearchRoute())return"VIDs on search"; if(focus.type==="tag")return`Tag: ${focus.value}`;
    if(focus.type==="inToShoot")return"IN to shoot"; if(focus.type==="ouToShoot")return"OU to shoot";
    if(focus.type==="rtwVideoMissing")return"RTW VIDEO missing"; if(focus.type==="rejected")return"Rejected";
    return"Missing";
  }
  function clearHighlight(){ if(lastHighlightedEl?.isConnected){lastHighlightedEl.classList.remove("mwl-focus-highlight");lastHighlightedEl.removeAttribute(ATTR_NEXT);} lastHighlightedEl=null; }
  function setHighlight(elm){ clearHighlight(); if(!elm)return; elm.setAttribute(ATTR_NEXT,"1"); elm.classList.add("mwl-focus-highlight"); lastHighlightedEl=elm; }
  function goNext(alert_=true){
    // Only ricalculate if DOM has changed since last updateCounts
    if(_countsDirty)updateCounts(false);
    if(!focusList.length){if(alert_)alert(`No items found for: ${listLabel()}.`);return;}
    if(focusPtr>=focusList.length){
      focusPtr=0;
      if(focus.type==="inToShoot"||focus.type==="ouToShoot"){
        clearHighlight();
        focus={type:"missing",value:""}; saveEngineState();
        setActiveUIKey("focus:missing");
        updateCounts(true);
        toast("Cycle complete — focus reset to Missing");
        return;
      }
    }
    const item=focusList[focusPtr++];
    item.root.scrollIntoView({behavior:"smooth",block:"center"});
    setHighlight(getHighlightTarget(item.root));
    updateMissingPill();
  }
  function copyFocusVIDs(){ updateCounts(false); const v=focusList.map(x=>x.vid).filter(Boolean); if(!v.length){alert(`No VIDs to copy for: ${listLabel()}.`);return;} copyToClipboard(v.join("\n")); toast(`Copied ${v.length} VID(s) • ${listLabel()}`); }
  function copyMissingVIDs(){ updateCounts(false); const v=[...new Set(focusList.map(x=>x.vid).filter(Boolean))]; if(!v.length){alert(`No VIDs to copy for: ${listLabel()}.`);return;} copyToClipboard(v.join("\n")); toast(`Copied ${v.length} VID(s) • ${listLabel()}`); }
  function copyAllVIDs(){ if(!isSupportedRoute())return; const v=getProducts(loadFlags()).map(p=>p.vid).filter(Boolean); if(!v.length){alert("No VIDs detected yet. Scroll a bit and retry.");return;} copyToClipboard(v.join("\n")); toast(`Copied ${v.length} VID(s)`); }
  function setFocus(nf,doJump=true){
    focus={...nf}; focusPtr=0; saveEngineState();
    setActiveUIKey(nf.type==="tag"?`tag:${String(nf.value||"").toUpperCase()}`:`focus:${nf.type}`);
    updateCounts(true); if(doJump)goNext(false);
  }

  // ═══════════════════════════════════════
  // Parsing helpers
  // ═══════════════════════════════════════
  function parseVariantsTotal(){ const s=getAriaById("info-box-1")||getTextById("info-box-1")||""; const m=s.match(/Number of variants:\s*(\d+)/i); return m?parseInt(m[1],10):null; }
  function trafficColor(p){ if(p>=80)return{bg:"#67e08a",text:"On track"}; if(p>=40)return{bg:"#ffcc66",text:"In progress"}; return{bg:"#ff5d5d",text:"Behind"}; }
  function absUrl(u){ if(!u)return""; if(u.startsWith("http://")||u.startsWith("https://"))return u; if(u.startsWith("/"))return location.origin+u; return u; }
  function bumpWidth(u,w){ try{ const url=new URL(absUrl(u)); url.searchParams.has("width")?url.searchParams.set("width",String(w)):url.searchParams.append("width",String(w)); return url.toString(); }catch{return u;} }
  function bumpIrisThumb(u,w){ return String(u||"").replace(/\/w(\d+)\.jpg(\?.*)?$/i,`/w${w}.jpg$2`); }
  function htmlEscape(s){ return String(s??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;"); }
  function dlFile(name,mime,content){ try{ const b=new Blob([content],{type:mime}),u=URL.createObjectURL(b),a=document.createElement("a");a.href=u;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),2000); }catch{alert("Export failed.");} }
  function getChannelName(){ return(getTextById("tool-channel")||"").trim()||"Dashboard"; }
  function resolveBrandKey(){ return getChannelName().toUpperCase().includes("MR")?"MRP":"NAP"; }

  function updateProgTooltips(){
    const panel=document.getElementById(PANEL_ID); if(!panel)return;
    const slEl=panel.querySelector("[data-action='focusIn']");
    const moEl=panel.querySelector("[data-action='focusOu']");
    if(slEl)slEl.title=focus.type==="inToShoot"
      ?"Still Life — click to go to next (N), Shift+click to copy"
      :"Still Life — click to activate focus";
    if(moEl)moEl.title=focus.type==="ouToShoot"
      ?"Model — click to go to next (N), Shift+click to copy"
      :"Model — click to activate focus";
  }
  function updateMissingPill(){
    const pill=document.getElementById("mwl-missing-pill");
    if(pill){
      const cnt=focusList.length;
      const cntEl=pill.querySelector(".mwl-mc");
      if(cntEl)cntEl.textContent=String(cnt);
      // Label reflects active focus
      const labelEl=pill.querySelector(".mwl-pill-label");
      if(labelEl){
        if(focus.type==="inToShoot")labelEl.textContent="Still Life ";
        else if(focus.type==="ouToShoot")labelEl.textContent="Model ";
        else labelEl.textContent="Missing ";
      }
      pill.classList.toggle("has-items",cnt>0);
    }
    const nextBtn=document.getElementById("mwl-next-btn");
    if(nextBtn){
      const cnt=focusList.length;
      const ptr=cnt?`${clamp(focusPtr,0,cnt)} / ${cnt}`:"0 / 0";
      const ptrSpan=nextBtn.querySelector(".mwl-next-ptr");
      if(ptrSpan)ptrSpan.textContent=ptr;
      else nextBtn.textContent=`Next ↓  ${ptr}`; // fallback
    }
    const ptrEl=document.getElementById("mwl-focus-ptr");
    if(ptrEl){const cnt=focusList.length;ptrEl.textContent=cnt?`${clamp(focusPtr,0,cnt)} / ${cnt}`:"0 / 0";}
    updateProgTooltips();
  }

  // ═══════════════════════════════════════
  // Export
  // ═══════════════════════════════════════
  function exportReportXls(){
    if(!loadFlags().enableReportExport)return; updateCounts(false);
    const wlName=(getTextById("info-box-0")||getAriaById("info-box-0")||(isSearchRoute()?"Search":"Worklist")).trim();
    const variants=parseVariantsTotal(), when=new Date();
    const qc=safe("export_qc",()=>extractQCMap_Surgical(),{vids:[],views:[],map:{},loadedCount:0});
    const k=lastKPIs||{}, analyses=(lastAnalyses||[]).slice().sort((a,b)=>String(a.vid).localeCompare(String(b.vid)));
    const fname=`Madame_Worklist_Report_${(wlName||"wl").replace(/[^\w\-]+/g,"_").slice(0,40)}_${when.toISOString().slice(0,10)}.xls`;
    const COLS=[{l:"Brand image",v:"brand"},{l:"IN",v:"in"},{l:"OU",v:"ou"},{l:"FR",v:"fr"},{l:"BK",v:"bk"},{l:"OU2",v:"ou2"},{l:"CU",v:"cu"},{l:"E1",v:"e1"},{l:"E2",v:"e2"},{l:"E3",v:"e3"},{l:"E4",v:"e4"},{l:"E5",v:"e5"},{l:"RW",v:"rw"},{l:"SW",v:"sw"},{l:"PR",v:"pr"},{l:"VIDEO",v:"video"}];
    const C="✓",X="✗";
    const thead=`<tr><th>VID</th>${COLS.map(c=>`<th>${htmlEscape(c.l)}</th>`).join("")}</tr>`;
    const rows=analyses.map(x=>{const vid=String(x.vid||"").trim();const pv=qc?.map?.[vid]||{};const cells=COLS.map(c=>{const ok=!!(pv[c.v]?.srcQC);return`<td class="${ok?"ok":"bad"}">${ok?C:X}</td>`;}).join("");return`<tr><td class="mono vid" style="mso-number-format:'\\@';">${htmlEscape(vid)}</td>${cells}</tr>`;}).join("");
    const html=`<!doctype html><html><head><meta charset="utf-8"><title>Madame Worklist Report</title><style>body{font-family:Calibri,sans-serif;color:#111827;margin:20px;}table{border-collapse:collapse;width:100%;}th,td{border:1px solid rgba(15,23,42,.12);padding:5px 7px;font-size:11px;text-align:center;white-space:nowrap;}th{background:#F3F4F6;font-weight:800;}.meta td{border:none;padding:2px 0;font-size:11px;text-align:left;}.meta .k{color:rgba(17,24,39,.62);width:160px;}.mono{font-family:Consolas,monospace;}td.vid{text-align:left;}.ok{background:rgba(34,197,94,0.08);font-weight:900;}.bad{background:rgba(239,68,68,0.08);font-weight:900;}</style></head><body><div style="font-size:15px;font-weight:800;margin-bottom:8px;">Madame Worklist Report</div><table class="meta"><tr><td class="k">Source</td><td>${htmlEscape(isSearchRoute()?"Search":"Worklist")}</td></tr><tr><td class="k">Worklist</td><td>${htmlEscape(wlName)}</td></tr><tr><td class="k">Variants</td><td>${htmlEscape(variants??'n/a')}</td></tr><tr><td class="k">Generated</td><td>${htmlEscape(when.toISOString())}</td></tr><tr><td class="k">Loaded</td><td>${htmlEscape(k.loaded??0)}</td></tr><tr><td class="k">RTW VIDEO</td><td>${htmlEscape(`${k.rtwWithVideo??0}/${k.rtwTotal??0} · missing ${k.rtwMissing??0}`)}</td></tr><tr><td class="k">Rejected</td><td>${htmlEscape(String(k.rejectedLoaded??0))}</td></tr></table><br><table><thead>${thead}</thead><tbody>${rows}</tbody></table></body></html>`;
    dlFile(fname,"application/vnd.ms-excel;charset=utf-8","\ufeff"+html); bumpCnt("export_xls",1);
  }

  // ═══════════════════════════════════════
  // QC extraction
  // ═══════════════════════════════════════
  function codeToView(c){ return(c||"").toLowerCase(); }
  function findTightProductContainer(vidEl){
    let node=vidEl;
    for(let i=0;i<14&&node;i++){
      const p=node.parentElement; if(!p)break;
      const h4s=Array.from(p.querySelectorAll("h4")).map(h=>(h.textContent||"").trim()).filter(t=>/^\d{10,}$/.test(t));
      const hasTile=Array.from(p.querySelectorAll("span[title]")).some(s=>SLOT_CODE_RE.test(s.getAttribute("title")||""))
        ||Array.from(p.querySelectorAll(TILE_SELECTOR)).some(t=>{const h=t.querySelector(QC_VIDEO_HEADER_SELECTOR);return h&&/video/i.test(h.textContent||"");});
      if(h4s.includes((vidEl.textContent||"").trim())&&h4s.length<=1&&hasTile)return p;
      node=p;
    }
    return vidEl.closest("div")||vidEl.parentElement;
  }
  function extractQCMap_Surgical(){
    const map={},vf=new Set();
    for(const vidEl of Array.from(document.querySelectorAll("h4")).filter(h=>/^\d{10,}$/.test((h.textContent||"").trim()))){
      const vid=(vidEl.textContent||"").trim(); if(!vid)continue;
      const product=findTightProductContainer(vidEl); if(!product)continue;
      map[vid]||={};
      const bs=(product.querySelector(BRAND_IMG_SELECTOR_PRIMARY)||product.querySelector(BRAND_IMG_SELECTOR_FALLBACK))?.getAttribute("src")||"";
      if(bs){map[vid]["brand"]={srcQC:absUrl(bumpIrisThumb(bs,QC_WIDTH))};vf.add("brand");}
      for(const lbl of Array.from(product.querySelectorAll("span[title]")).filter(s=>SLOT_CODE_RE.test(s.getAttribute("title")||""))){
        const m=(lbl.getAttribute("title")||"").trim().match(SLOT_CODE_RE); if(!m)continue;
        const view=codeToView(m[1]); vf.add(view);
        let slot=lbl.closest("div"); for(let j=0;j<7&&slot;j++){if(slot.querySelector(IMG_SELECTOR)||slot.querySelector("div.css-12n9byu"))break;slot=slot.parentElement;}
        if(!slot)continue; const img=slot.querySelector(IMG_SELECTOR); if(!img)continue;
        const src=img.getAttribute("src")||""; if(!src)continue;
        const srcQC=bumpWidth(src,QC_WIDTH); if(!map[vid][view]||map[vid][view].srcQC===srcQC)map[vid][view]={srcQC:absUrl(srcQC)};
      }
      for(const tile of Array.from(product.querySelectorAll(TILE_SELECTOR))){
        const h=tile.querySelector(QC_VIDEO_HEADER_SELECTOR); if(!h||!/video/i.test(h.textContent||""))continue;
        const img=tile.querySelector(IMG_SELECTOR); if(!img)continue;
        const src=img.getAttribute("src")||""; if(!src)continue;
        const srcQC=bumpWidth(src,QC_WIDTH); vf.add("video");
        if(!map[vid]["video"]||map[vid]["video"].srcQC===srcQC)map[vid]["video"]={srcQC:absUrl(srcQC)};
      }
    }
    const vids=Object.keys(map).filter(v=>Object.keys(map[v]||{}).length>0);
    const orderedViews=[...QC_VIEW_ORDER.filter(v=>vf.has(v)),...Array.from(vf).filter(v=>!QC_VIEW_ORDER.includes(v)).sort()];
    return{vids,views:orderedViews,map,loadedCount:vids.filter(v=>Object.values(map[v]||{}).some(x=>x?.srcQC)).length};
  }
  function openQCViewer(){
    if(!loadFlags().enableQC)return; if(!isWorklistRoute()){alert("QC Carousel is available on /worklist pages.");return;}
    updateCounts(false); const data=extractQCMap_Surgical();
    if(!data.vids.length){alert("No products/images detected yet. Scroll a bit and retry.");return;}
    const wlName=htmlEscape(getTextById("info-box-0")||"Worklist"),channelRaw=htmlEscape(getTextById("tool-channel")||"NET-A-PORTER"),brandKey=resolveBrandKey();
    const total=parseVariantsTotal(),loaded=data.loadedCount,t=total>0?total:null;
    const ratio=t?(loaded/t):null; let status="partial"; if(!t)status="unknown"; else if(loaded>=t)status="ok"; else if(ratio!==null&&ratio<0.5)status="low";
    const missing=(t&&loaded<t)?(t-loaded):0, showMissing=Boolean(t&&status!=="ok");
    const w=window.open("about:blank","_blank"); if(!w){alert("Popup blocked.");return;}
    w.document.open(); w.document.write(buildQCHtml({data,wlName,channelRaw,brandKey,status,loaded,t,missing,showMissing})); w.document.close();
  }

  function buildQCHtml({data,wlName,channelRaw,brandKey,status,loaded,t,missing,showMissing}){
    return`<!doctype html><html><head><meta charset="utf-8"><title>QC Carousel</title><base href="${location.origin}/"><style>:root{--bg:#fff;--text:#0b0c0f;--muted:#6b7280;--line:rgba(15,23,42,.12);--black:#07080a;--ok:rgb(16,185,129);--am:rgb(245,158,11);--rd:rgb(239,68,68);--un:rgb(148,163,184);}html,body{margin:0;padding:0;background:var(--bg);color:var(--text);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;}.topbar{position:sticky;top:0;z-index:30;background:var(--black);color:#fff;padding:14px 18px 12px;border-bottom:1px solid rgba(255,255,255,.10);}.row1{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}.leftRow{display:flex;align-items:center;gap:12px;}.brand{font-weight:800;letter-spacing:.24em;font-size:12px;text-transform:uppercase;}.pill{display:inline-flex;align-items:center;gap:8px;padding:7px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;white-space:nowrap;}.dot{width:8px;height:8px;border-radius:999px;background:var(--un);}.pill.ok .dot{background:var(--ok);}.pill.partial .dot{background:var(--am);}.pill.low .dot{background:var(--rd);}.pill.unknown .dot{background:var(--un);}.pillText{font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.92;}.pillCount{font-weight:800;font-size:11.5px;}.pillMiss{margin-left:8px;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;opacity:.72;}.actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;}.btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:800 11px sans-serif;letter-spacing:.16em;text-transform:uppercase;cursor:pointer;user-select:none;}.btn:hover{background:rgba(255,255,255,.10);}.btn.on{background:rgba(255,255,255,.92);color:#07080a;border-color:rgba(255,255,255,.92);}.btnX{width:30px;padding:0;border-radius:999px;font-weight:900;}.row2{margin-top:10px;display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}.channel{font-weight:700;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.78;}.sep{opacity:.35;}.wlTitle{font-weight:650;font-size:14px;opacity:.96;}.grid{padding:16px 14px 28px;display:flex;flex-direction:column;gap:14px;}.block{border-top:1px solid var(--line);padding-top:12px;}.vid{font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;margin:0 0 10px;color:#111827;}.row{display:flex;gap:10px;overflow:auto;padding-bottom:6px;}.tile{width:220px;border:1px solid var(--line);background:#fff;flex:0 0 auto;display:flex;flex-direction:column;}.imgwrap{position:relative;height:293px;background:#fff;cursor:zoom-in;overflow:hidden;}img.photo{width:100%;height:100%;object-fit:cover;display:block;user-select:none;-webkit-user-drag:none;}img.ov{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;pointer-events:none;opacity:.92;}.refwrap{position:relative;height:293px;background:#fff;overflow:hidden;}img.ref{width:100%;height:100%;object-fit:cover;display:block;}.metaTile{padding:8px 10px;border-top:1px solid var(--line);font-size:10.5px;color:var(--muted);letter-spacing:.14em;text-transform:uppercase;}.lb{position:fixed;inset:0;background:rgba(7,8,10,.94);z-index:9999;display:none;align-items:center;justify-content:center;padding:24px;}.lb.open{display:flex;}.lbInner{position:relative;width:min(1180px,calc(100vw - 48px));height:min(92vh,980px);display:flex;align-items:center;justify-content:center;}.lbImg{max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain;background:#0b0c0f;}.lbX{position:absolute;top:-10px;right:-10px;width:40px;height:40px;border-radius:999px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;}.lbNav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;user-select:none;}.lbPrev{left:-12px;}.lbNext{right:-12px;}.lbFoot{position:fixed;bottom:14px;left:18px;color:rgba(255,255,255,.70);font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;z-index:10000;display:none;}.lb.open~.lbFoot{display:block;}</style></head><body><div class="topbar"><div class="row1"><div class="leftRow"><div class="brand">QC Carousel</div><div class="pill ${status}"><span class="dot"></span><span class="pillText">Loaded</span><span class="pillCount">${loaded}${t?` / ${t}`:""}</span>${showMissing?`<span class="pillMiss">Missing: ${missing}</span>`:""}</div></div><div class="actions"><button class="btn" id="btnGuides">Check Guides</button><button class="btn" id="btnBrand">Brand image</button><button class="btn" id="btnRefs">References</button><button class="btn btnX" id="btnRefsClose" style="display:none;">×</button></div></div><div class="row2">${channelRaw?`<div class="channel">${channelRaw}</div>`:""}<div class="sep">·</div><div class="wlTitle">${wlName}</div></div></div><div class="grid" id="grid"></div><div class="lb" id="lb" aria-hidden="true"><div class="lbInner"><button class="lbNav lbPrev" id="lbPrev">‹</button><button class="lbNav lbNext" id="lbNext">›</button><button class="lbX" id="lbX">×</button><img class="lbImg" id="lbImg" alt="QC preview"/></div></div><div class="lbFoot">Esc · ←/→ · G=Guides</div><script>const DATA=${JSON.stringify(data)};const VIEW_ORDER=${JSON.stringify(QC_VIEW_ORDER)};const OVERLAY_VIEWS=new Set(${JSON.stringify(Array.from(OVERLAY_VIEWS))});const OVERLAY_URL=${JSON.stringify(OVERLAY_SP_URL)};const BRAND=${JSON.stringify(brandKey)};const REFERENCES=${JSON.stringify(REFERENCES)};const gridEl=document.getElementById("grid");let overlayOn=false,brandOn=false,refsOn=false,refIndex=0;const RSK="mimo_qc_ref_index_v1";function vs(a,b){const ia=VIEW_ORDER.indexOf(a),ib=VIEW_ORDER.indexOf(b);if(ia===-1&&ib===-1)return a.localeCompare(b);if(ia===-1)return 1;if(ib===-1)return -1;return ia-ib;}function spD(u){try{const url=new URL(u);if(!url.searchParams.has("download"))url.searchParams.set("download","1");url.searchParams.set("_",String(Date.now()));return url.toString();}catch{return u;}}function clr(el){while(el.firstChild)el.removeChild(el.firstChild);}const NAV=[];function rebuildNav(){NAV.length=0;for(const vid of DATA.vids){let views=Object.keys(DATA.map[vid]||{}).sort(vs);if(!brandOn)views=views.filter(v=>v!=="brand");for(const view of views){const cell=DATA.map[vid][view];if(cell&&cell.srcQC)NAV.push({vid,view,src:cell.srcQC});}}}const lb=document.getElementById("lb"),lbImg=document.getElementById("lbImg"),lbX=document.getElementById("lbX"),lbPrev=document.getElementById("lbPrev"),lbNext=document.getElementById("lbNext");let idx=-1;function openLB(i){if(!NAV.length)return;idx=(i+NAV.length)%NAV.length;lbImg.src=NAV[idx].src;lb.classList.add("open");lb.setAttribute("aria-hidden","false");document.body.style.overflow="hidden";}function closeLB(){lb.classList.remove("open");lb.setAttribute("aria-hidden","true");lbImg.src="";document.body.style.overflow="";idx=-1;}lbX.addEventListener("click",closeLB);lbPrev.addEventListener("click",()=>{if(idx!==-1)openLB(idx-1);});lbNext.addEventListener("click",()=>{if(idx!==-1)openLB(idx+1);});lb.addEventListener("click",(e)=>{if(e.target===lb)closeLB();});lbImg.addEventListener("click",()=>{if(idx!==-1)openLB(idx+1);});const btnGuides=document.getElementById("btnGuides"),btnBrand=document.getElementById("btnBrand"),btnRefs=document.getElementById("btnRefs"),btnRefsClose=document.getElementById("btnRefsClose");function syncBtns(){btnGuides.classList.toggle("on",overlayOn);btnBrand.classList.toggle("on",brandOn);btnRefs.classList.toggle("on",refsOn);btnRefsClose.style.display=refsOn?"inline-flex":"none";}function getRI(){try{const o=JSON.parse(localStorage.getItem(RSK)||"{}");const n=Number(o?.[BRAND]??0);return Number.isFinite(n)?n:0;}catch{return 0;}}function setRI(i){try{const o=JSON.parse(localStorage.getItem(RSK)||"{}");o[BRAND]=i;localStorage.setItem(RSK,JSON.stringify(o));}catch{}}function getARef(){const l=REFERENCES[BRAND]||[];if(!l.length)return null;const i=((refIndex%l.length)+l.length)%l.length;return{...l[i],idx:i,total:l.length};}btnGuides.addEventListener("click",()=>{overlayOn=!overlayOn;syncBtns();render();});btnBrand.addEventListener("click",()=>{brandOn=!brandOn;syncBtns();render();});btnRefs.addEventListener("click",()=>{const l=REFERENCES[BRAND]||[];if(!l.length)return;if(!refsOn){refsOn=true;refIndex=getRI();}else{refIndex=(refIndex+1)%l.length;setRI(refIndex);}syncBtns();render();});btnRefsClose.addEventListener("click",()=>{refsOn=false;syncBtns();render();});window.addEventListener("keydown",(e)=>{if(e.key==="g"||e.key==="G"){overlayOn=!overlayOn;syncBtns();render();return;}if(!lb.classList.contains("open"))return;if(e.key==="Escape")closeLB();if(e.key==="ArrowRight"&&idx!==-1)openLB(idx+1);if(e.key==="ArrowLeft"&&idx!==-1)openLB(idx-1);});new Image().src=spD(OVERLAY_URL);function render(){clr(gridEl);const aRef=refsOn?getARef():null;rebuildNav();for(const vid of DATA.vids){let views=Object.keys(DATA.map[vid]||{}).sort(vs);if(!brandOn)views=views.filter(v=>v!=="brand");if(!views.length)continue;const block=document.createElement("div");block.className="block";const t=document.createElement("div");t.className="vid";t.textContent=vid;block.appendChild(t);const row=document.createElement("div");row.className="row";block.appendChild(row);let ir=false;for(const view of views){const cell=DATA.map[vid][view];if(!cell||!cell.srcQC)continue;const tile=document.createElement("div");tile.className="tile";const iw=document.createElement("div");iw.className="imgwrap";const img=document.createElement("img");img.className="photo";img.loading="lazy";img.src=cell.srcQC;iw.appendChild(img);const ti=NAV.findIndex(x=>x.src===cell.srcQC&&x.vid===vid&&x.view===view);iw.addEventListener("click",()=>openLB(ti>=0?ti:0));if(overlayOn&&OVERLAY_VIEWS.has(view)){const ov=document.createElement("img");ov.className="ov";ov.alt="";let tried=false;ov.onerror=()=>{if(tried)return;tried=true;try{const u=new URL(OVERLAY_URL);u.searchParams.delete("download");u.searchParams.set("_",String(Date.now()));ov.src=u.toString();}catch{}};ov.src=spD(OVERLAY_URL);iw.appendChild(ov);}tile.appendChild(iw);const meta=document.createElement("div");meta.className="metaTile";meta.textContent=view==="brand"?"brand image":view;tile.appendChild(meta);row.appendChild(tile);if(aRef&&!ir&&view==="ou"){ir=true;row.appendChild(mkRef(aRef));}}if(aRef&&!ir)row.appendChild(mkRef(aRef));if(row.children.length)gridEl.appendChild(block);}}function mkRef(aRef){const tile=document.createElement("div");tile.className="tile";const rw=document.createElement("div");rw.className="refwrap";const img=document.createElement("img");img.className="ref";img.loading="lazy";let tried=false;img.onerror=()=>{if(!tried){tried=true;try{const u=new URL(aRef.url);u.searchParams.delete("download");u.searchParams.set("_",String(Date.now()));img.src=u.toString();return;}catch{}}rw.style.cssText="background:rgba(15,23,42,.04);display:flex;align-items:center;justify-content:center;padding:14px;color:rgba(15,23,42,.55);font:800 11px sans-serif;letter-spacing:.14em;text-transform:uppercase;";rw.textContent="Reference unavailable";};img.src=spD(aRef.url);rw.appendChild(img);tile.appendChild(rw);const meta=document.createElement("div");meta.className="metaTile";meta.textContent=\`model reference • \${aRef.name} (\${aRef.idx+1}/\${aRef.total})\`;tile.appendChild(meta);return tile;}refIndex=getRI();syncBtns();render();<\/script></body></html>`;
  }

  // ═══════════════════════════════════════
  // Styles — injected BEFORE panel creation
  // so no flash of unstyled content
  // ═══════════════════════════════════════
  let stylesInjected=false;
  function ensureStyles(){
    if(stylesInjected)return; stylesInjected=true;
    GM_addStyle(`
      /* ── CSS custom props ── */
      :root {
        --mwl-bg:    rgba(15,15,19,0.98);
        --mwl-bg2:   rgba(21,21,27,0.98);
        --mwl-brd:   rgba(255,255,255,0.09);
        --mwl-brd2:  rgba(255,255,255,0.06);
        --mwl-txt:   rgba(255,255,255,0.90);
        --mwl-sub:   rgba(255,255,255,0.48);
        --mwl-dim:   rgba(255,255,255,0.32);
        --mwl-gold:  #d8b46a;
        --mwl-amber: #ffcc66;
        --mwl-green: #67e08a;
        --mwl-red:   #ff5d5d;
        --mwl-shadow: 0 4px 20px rgba(0,0,0,0.42);
        --mwl-r:     10px;
        --mwl-font:  ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;
      }

      /* ── Panel: hidden by default, shown only when embedded ── */
      #mwl-panel {
        display: none;
        font-family: var(--mwl-font);
        font-size: 12px;
        color: var(--mwl-txt);
        background: linear-gradient(160deg, var(--mwl-bg), var(--mwl-bg2));
        border-radius: var(--mwl-r);
        margin: 6px 0 10px;
        z-index: 200;
      }
      #mwl-panel.mwl-visible { display: block; }
      #mwl-panel.mwl-minimized .mwl-drawer,
      #mwl-panel.mwl-minimized .mwl-strip-bottom { display: none !important; }

      /* ── Floating panel (search mode) ── */
      #mwl-panel.mwl-floating {
        box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.28);
        border: 1px solid rgba(255,255,255,0.10);
        position: fixed !important;  /* overrides any inline reset */
        /* position:relative for the resize handle is set on the element itself */
      }
      #mwl-panel.mwl-floating .mwl-strip { cursor: grab; user-select: none; }
      #mwl-panel.mwl-floating .mwl-strip:active { cursor: grabbing; }

      /* Resize handle — bottom-right corner */
      #mwl-resize-handle {
        position: absolute;
        bottom: 0; right: 0;
        width: 16px; height: 16px;
        cursor: se-resize;
        z-index: 10;
        /* Subtle visual cue */
        background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.15) 50%);
        border-radius: 0 0 var(--mwl-r) 0;
      }
      #mwl-resize-handle:hover {
        background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.30) 50%);
      }

      /* Reset position button — only shown in floating mode */
      #mwl-float-reset {
        display: none;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.40);
        border-radius: 6px; padding: 3px 7px;
        font-size: 9px; font-weight: 800; letter-spacing: .08em; text-transform: uppercase;
        cursor: pointer; white-space: nowrap; line-height: 1.5;
        transition: background .10s, color .10s;
      }
      #mwl-panel.mwl-floating #mwl-float-reset { display: inline-flex; align-items: center; }
      #mwl-float-reset:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.80); }

      /* ════════════════════════════
         STRIP (always-visible top row)
      ════════════════════════════ */
      .mwl-strip {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        flex-wrap: nowrap;
        overflow: hidden;
      }

      /* status dot (per-group, small) */
      .mwl-dot {
        width: 6px; height: 6px; border-radius: 99px; flex: 0 0 6px;
        background: var(--mwl-amber);
        transition: background .3s ease;
      }

      /* ── Progress group (label + bar + pct + num) ── */
      .mwl-prog {
        display: flex;
        align-items: center;
        gap: 4px;
        flex: 0 0 auto;
      }
      .mwl-prog-lbl {
        font-size: 9px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
        color: var(--mwl-sub); flex: 0 0 auto; white-space: nowrap;
      }
      .mwl-prog-bar {
        width: 48px; height: 4px; border-radius: 99px;
        background: rgba(255,255,255,0.08); overflow: hidden; flex: 0 0 48px;
      }
      .mwl-prog-bar > i {
        display: block; height: 100%; width: 0%;
        background: linear-gradient(90deg, rgba(216,180,106,0.85), rgba(255,255,255,0.50));
        border-radius: 99px; transition: width .45s ease;
      }
      /* pct and num — small gap between them, both fixed-width, tabular nums */
      .mwl-prog-pct {
        font-size: 9.5px; font-weight: 800;
        color: rgba(255,255,255,0.46); flex: 0 0 auto; white-space: nowrap;
        width: 4ch; text-align: right;
        font-variant-numeric: tabular-nums;
        display: inline-block;
      }
      .mwl-prog-num {
        font-size: 10px; font-weight: 800;
        color: rgba(255,255,255,0.72); flex: 0 0 auto; white-space: nowrap;
        font-variant-numeric: tabular-nums;
        width: 7ch; text-align: left;
        display: inline-block;
        margin-left: 4px;   /* breathing room between % and shots/total */
      }

      /* Missing pill — wider padding so text never clips */
      #mwl-missing-pill {
        display: inline-flex; align-items: center; gap: 4px;
        padding: 3px 10px; border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.55);
        font-size: 10px; font-weight: 800; letter-spacing: .05em;
        flex: 0 0 auto;
        cursor: pointer; user-select: none;
        transition: background .10s, border-color .10s, color .10s;
        white-space: nowrap;
        font-variant-numeric: tabular-nums;
      }

      /* KPI inline — fixed so RTW/ACC values don't shift neighbours */
      .mwl-kpi-inline {
        display: flex; align-items: center; gap: 4px; flex: 0 0 auto;
        width: 10ch; /* "RTW 999 · ACC 999" shrunk fits */
      }
      .mwl-prog-sep {
        width: 1px; height: 11px; background: rgba(255,255,255,0.10); flex: 0 0 1px;
      }

      /* ── Clickable progress pill (Still Life / Model) ── */
      .mwl-prog-clickable {
        cursor: pointer;
        border-radius: 6px;
        padding: 2px 5px;
        margin: -2px -5px;
        transition: background .10s;
      }
      .mwl-prog-clickable:hover { background: rgba(255,255,255,0.07); }
      .mwl-prog-clickable.is-active { background: rgba(216,180,106,0.09); }
      .mwl-prog-clickable.is-active .mwl-prog-lbl { color: var(--mwl-gold); }

      /* ── Inline KPI (RTW / ACC) labels and values ── */
      .mwl-kpi-lbl {
        font-size: 9px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
        color: var(--mwl-sub);
      }
      .mwl-kpi-val {
        font-size: 10px; font-weight: 900; color: rgba(255,255,255,0.78);
        font-variant-numeric: tabular-nums;
      }
      .mwl-kpi-dot {
        font-size: 9px; color: rgba(255,255,255,0.20); margin: 0 1px;
      }

      /* ── 2-col drawer grid ── */
      .mwl-dcols-2 { grid-template-columns: 1fr 1fr !important; }

      /* ── Horizontal pill row inside drawer ── */
      .mwl-pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 3px;
      }

      /* ── Next button with integrated ptr ── */
      #mwl-next-btn {
        font-variant-numeric: tabular-nums;
        min-width: 0;
        white-space: nowrap;
        letter-spacing: .02em;
      }

      /* ── Next button: two-span stable layout ── */
      #mwl-next-btn { display: flex; align-items: center; justify-content: center; gap: 6px; }
      .mwl-next-label { flex: 0 0 auto; }
      .mwl-next-ptr {
        flex: 0 0 auto;
        font-variant-numeric: tabular-nums;
        opacity: 0.70;
        font-size: 9.5px;
        letter-spacing: .02em;
      }

      /* ── Missing pill label span ── */
      .mwl-pill-label { flex: 0 0 auto; }

      /* ── Strip: prevent any group from shrinking on narrow viewports ── */
      .mwl-prog, .mwl-prog-sep, .mwl-kpi-inline, #mwl-status-chip,
      #mwl-missing-pill, .mwl-strip-actions { flex-shrink: 0; }
      #mwl-missing-pill:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.88); }
      #mwl-missing-pill.has-items {
        border-color: rgba(255,93,93,0.35);
        background: rgba(255,93,93,0.08);
        color: rgba(255,200,200,0.88);
      }
      #mwl-missing-pill.has-items:hover { background: rgba(255,93,93,0.14); }
      #mwl-missing-pill .mwl-mc { font-weight: 900; }

      /* ── Status chip — leftmost ── */
      #mwl-status-chip {
        font-size: 9.5px; font-weight: 800; letter-spacing: .06em;
        white-space: nowrap; flex: 0 0 auto;
        color: var(--mwl-amber);
        transition: color .3s;
        width: 13ch;            /* "In progress · 99%" = worst case ~13ch */
        display: inline-block;
        font-variant-numeric: tabular-nums;
        overflow: hidden;
      }

      /* ── Load chip — sits next to ⇣ inside strip-actions ── */
      #mwl-loadchip {
        display: none;
        align-items: center;
        font-size: 9px; font-weight: 800;
        padding: 2px 6px; border-radius: 999px;
        border: 1px solid rgba(255,255,255,0.12);
        background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.58);
        white-space: nowrap; flex: 0 0 auto;
        font-variant-numeric: tabular-nums;
      }
      #mwl-loadchip.is-amber { border-color: rgba(255,204,102,0.38); background: rgba(255,204,102,0.10); color: rgba(255,240,200,0.88); }
      #mwl-loadchip.is-red   { border-color: rgba(255,93,93,0.28);   background: rgba(255,93,93,0.10);   color: rgba(255,210,210,0.88); }

      /* ── Action buttons ── */
      .mwl-strip-actions {
        display: flex; align-items: center; gap: 3px; flex: 0 0 auto; margin-left: auto;
      }
      .mwl-abtn {
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.58);
        border-radius: 6px; padding: 3px 7px;
        font-size: 10px; font-weight: 800; letter-spacing: .07em; text-transform: uppercase;
        cursor: pointer; white-space: nowrap; line-height: 1.5;
        transition: background .10s, color .10s, border-color .10s;
      }
      .mwl-abtn:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.92); border-color: rgba(255,255,255,0.18); }
      /* load button with fused counter */
      #mwl-loadall-btn { font-variant-numeric: tabular-nums; min-width: 2ch; }
      #mwl-loadall-btn.is-loading-amber { border-color: rgba(255,204,102,0.38); background: rgba(255,204,102,0.10); color: rgba(255,240,200,0.90); }
      #mwl-loadall-btn.is-loading-red   { border-color: rgba(255,93,93,0.30);   background: rgba(255,93,93,0.10);   color: rgba(255,210,210,0.90); }

      /* expand toggle */
      #mwl-expand-btn {
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.45);
        border-radius: 6px; padding: 3px 8px;
        font-size: 11px; font-weight: 900; line-height: 1.5;
        cursor: pointer; user-select: none;
        transition: background .10s, color .10s, border-color .10s;
      }
      #mwl-expand-btn:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.85); }
      #mwl-expand-btn.open {
        border-color: rgba(216,180,106,0.35);
        background: rgba(216,180,106,0.08);
        color: var(--mwl-gold);
      }

      /* minimize button */
      #mwl-min-btn {
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.40);
        border-radius: 6px; padding: 3px 8px;
        font-size: 10px; font-weight: 900; line-height: 1.5;
        cursor: pointer; user-select: none;
        transition: background .10s, color .10s;
      }
      #mwl-min-btn:hover { background: rgba(255,93,93,0.10); color: rgba(255,180,180,0.90); border-color: rgba(255,93,93,0.24); }

      /* restore bar (shown when minimized) */
      #mwl-restore-bar {
        display: none;
        align-items: center;
        justify-content: space-between;
        padding: 6px 10px;
        cursor: pointer;
        user-select: none;
      }
      #mwl-panel.mwl-minimized #mwl-restore-bar { display: flex; }
      #mwl-panel.mwl-minimized .mwl-strip { display: none; }
      .mwl-restore-label {
        font-size: 10px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
        color: rgba(255,255,255,0.50);
      }
      .mwl-restore-chev {
        font-size: 11px; color: rgba(255,255,255,0.35);
      }
      #mwl-restore-bar:hover .mwl-restore-label { color: rgba(255,255,255,0.80); }

      /* ════════════════════════════
         DRAWER (collapsible)
      ════════════════════════════ */
      .mwl-drawer {
        display: none;
        border-top: 1px solid rgba(255,255,255,0.06);
        padding: 9px 10px 10px;
      }
      .mwl-drawer.open { display: block; }

      /* 3-column grid */
      .mwl-dcols {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        gap: 8px;
        margin-bottom: 7px;
      }
      .mwl-dcol { display: flex; flex-direction: column; gap: 4px; }
      .mwl-dcol-title {
        font-size: 9px; font-weight: 800; letter-spacing: .14em; text-transform: uppercase;
        color: var(--mwl-sub); margin-bottom: 2px;
      }

      /* pills */
      .mwl-pill {
        display: inline-flex; align-items: center; gap: 5px;
        padding: 3px 8px; border-radius: 999px;
        border: 1px solid var(--mwl-brd2);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.60);
        font-size: 10px; font-weight: 800;
        cursor: pointer; white-space: nowrap; width: fit-content;
        transition: background .10s, border-color .10s, color .10s;
      }
      .mwl-pill:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.90); }
      .mwl-pill.is-active { border-color: rgba(216,180,106,0.50); background: rgba(216,180,106,0.10); color: rgba(255,255,255,0.92); }
      .mwl-pill.is-alert  { border-color: rgba(255,204,102,0.35); background: rgba(255,204,102,0.07); }
      .mwl-pill .mwl-count { font-weight: 900; color: rgba(255,255,255,0.88); }

      /* KPI rows */
      .mwl-krow {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 10px; color: var(--mwl-sub); padding: 1px 0;
      }
      .mwl-krow strong { font-weight: 900; color: rgba(255,255,255,0.82); }

      /* drawer footer: copy buttons + ptr */
      .mwl-dfooter {
        display: flex; align-items: center; gap: 5px;
        padding-top: 7px;
        border-top: 1px solid rgba(255,255,255,0.06);
      }
      .mwl-dbtn {
        flex: 1; border: 1px solid var(--mwl-brd2);
        background: rgba(255,255,255,0.04);
        color: rgba(255,255,255,0.62);
        border-radius: 6px; padding: 5px 6px;
        font-size: 10px; font-weight: 800; cursor: pointer; text-align: center;
        white-space: nowrap; transition: background .10s, color .10s;
      }
      .mwl-dbtn:hover { background: rgba(255,255,255,0.09); color: rgba(255,255,255,0.92); }
      .mwl-dbtn.gold { border-color: rgba(216,180,106,0.35); background: rgba(216,180,106,0.08); color: var(--mwl-gold); }
      .mwl-dbtn.gold:hover { background: rgba(216,180,106,0.15); }
      #mwl-focus-ptr { font-size: 9.5px; color: var(--mwl-dim); white-space: nowrap; margin-left: auto; padding-left: 4px; }

      /* ════════════════════════════
         OVERLAYS (settings/help)
      ════════════════════════════ */
      .mwl-overlay {
        position: relative;
        border-top: 1px solid rgba(255,255,255,0.07);
        background: rgba(14,14,18,0.98);
        padding: 10px;
        display: none;
      }
      .mwl-overlay.open { display: block; }
      .mwl-ov-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 8px; }
      .mwl-ov-title { font-size: 10px; font-weight: 900; letter-spacing: .14em; text-transform: uppercase; color: rgba(255,255,255,0.70); }
      .mwl-ov-box { border: 1px solid rgba(255,255,255,0.09); background: rgba(255,255,255,0.03); border-radius: 8px; padding: 9px; margin-bottom: 8px; }
      .mwl-obtn {
        border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
        color: rgba(255,255,255,0.72); border-radius: 7px; padding: 5px 10px;
        font-size: 10px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
        cursor: pointer; transition: background .10s;
      }
      .mwl-obtn:hover { background: rgba(255,255,255,0.10); color: rgba(255,255,255,0.95); }

      /* ════════════════════════════
         HIGHLIGHTS + TOAST
      ════════════════════════════ */
      [data-mwl-nophoto="1"] { outline: none !important; border: none !important; position: relative; border-radius: 12px; background: rgba(198,22,22,0.16) !important; box-shadow: inset 0 0 0 1px rgba(198,22,22,0.18) !important; }
      [data-mwl-nophoto="1"]::before { content:""; position:absolute; left:0; top:8px; bottom:8px; width:4px; border-radius:999px; background:rgba(198,22,22,0.95); pointer-events:none; }
      [data-mwl-next="1"] { box-shadow: inset 0 0 0 1px rgba(216,180,106,0.35), 0 0 0 3px rgba(216,180,106,0.50), 0 8px 24px rgba(216,180,106,0.24) !important; }
      .mwl-focus-highlight { animation: mwlPulse 1.4s ease-in-out 0s 2; }
      @keyframes mwlPulse { 0%{box-shadow:0 0 0 0 rgba(216,180,106,0)} 35%{box-shadow:0 0 0 6px rgba(216,180,106,0.22)} 100%{box-shadow:0 0 0 0 rgba(216,180,106,0)} }

      .mwl-toast { position:fixed; z-index:999999; left:18px; bottom:18px; padding:9px 12px; border-radius:12px; background:rgba(15,15,19,0.94); border:1px solid rgba(255,255,255,0.12); color:rgba(255,255,255,0.90); font-family:var(--mwl-font); font-size:12px; box-shadow:0 4px 20px rgba(0,0,0,0.45); transform:translateY(10px); opacity:0; transition:opacity .18s, transform .18s; }
      .mwl-toast.show { opacity:1; transform:translateY(0); }
    `);
  }

  // ═══════════════════════════════════════
  // Embedded anchor
  // ═══════════════════════════════════════
  // ═══════════════════════════════════════
  // Geometry — worklist: fixed+anchor / search: draggable float
  // ═══════════════════════════════════════
  let _fixedPlaceholder=null;
  let _resizeObserver=null;
  let _scrollHandler=null;

  const FLOAT_KEY="mwl_float_pos_v1";
  function loadFloatPos(){ try{ return JSON.parse(localStorage.getItem(FLOAT_KEY)||"null"); }catch{return null;} }
  function saveFloatPos(x,y,w){ try{ localStorage.setItem(FLOAT_KEY,JSON.stringify({x,y,w})); }catch{} }

  // ── Worklist: fixed panel that follows anchor on scroll ──
  function applyFixedGeometry(panel,anchor){
    const r=anchor.getBoundingClientRect();
    const top=Math.max(8,r.bottom+4);
    panel.style.cssText=`
      position:fixed!important;
      top:${top}px!important;
      left:${r.left}px!important;
      width:${r.width}px!important;
      z-index:9000!important;
      margin:0!important;
      cursor:default;
    `;
    if(!_fixedPlaceholder){
      _fixedPlaceholder=document.createElement("div");
      _fixedPlaceholder.id="mwl-placeholder";
      _fixedPlaceholder.style.cssText="pointer-events:none;visibility:hidden;";
    }
    _fixedPlaceholder.style.height=`${panel.offsetHeight+10}px`;
    if(!_fixedPlaceholder.parentNode)anchor.insertAdjacentElement("afterend",_fixedPlaceholder);
  }

  function startGeometrySync(panel,anchor){
    // _scrollHandler is called by the unified _onScroll RAF loop in attachListeners
    _scrollHandler=()=>applyFixedGeometry(panel,anchor);
    if(_resizeObserver)_resizeObserver.disconnect();
    _resizeObserver=new ResizeObserver(()=>applyFixedGeometry(panel,anchor));
    _resizeObserver.observe(anchor);
    _resizeObserver.observe(document.documentElement);
    requestAnimationFrame(()=>applyFixedGeometry(panel,anchor));
  }

  function stopGeometrySync(){
    // _scrollHandler is called by _onScroll, not registered directly on window
    _scrollHandler=null;
    if(_resizeObserver){_resizeObserver.disconnect();_resizeObserver=null;}
    if(_fixedPlaceholder){_fixedPlaceholder.remove();_fixedPlaceholder=null;}
    _floatListeners.forEach(({target,type,fn})=>target.removeEventListener(type,fn));
    _floatListeners=[];
  }

  // ── Search: draggable + resizable floating panel ──
  // Listeners are stored so stopGeometrySync can remove them
  let _floatListeners=[];
  function _addFloatListener(target,type,fn,opts){
    target.addEventListener(type,fn,opts);
    _floatListeners.push({target,type,fn});
  }

  function initFloatingPanel(panel){
    // Clean up any previous float listeners before re-initialising
    _floatListeners.forEach(({target,type,fn})=>target.removeEventListener(type,fn));
    _floatListeners=[];

    const saved=loadFloatPos();
    const W=saved?.w??360;
    const X=saved?.x??Math.max(16,window.innerWidth-W-24);
    const Y=saved?.y??80;

    const clampX=x=>Math.max(0,Math.min(window.innerWidth-60,x));
    const clampY=y=>Math.max(0,Math.min(window.innerHeight-40,y));

    function applyPos(x,y,w){
      panel.style.cssText=`
        position:fixed!important;
        left:${clampX(x)}px!important;
        top:${clampY(y)}px!important;
        width:${Math.max(260,w)}px!important;
        z-index:9000!important;
        margin:0!important;
        min-width:260px;
        max-width:90vw;
      `;
    }

    applyPos(X,Y,W);

    // Drag handle = strip
    const strip=panel.querySelector(".mwl-strip");
    if(strip){
      strip.style.cursor="grab";
      let dragging=false,ox=0,oy=0,px=0,py=0;
      strip.addEventListener("mousedown",e=>{
        if(e.target.closest("button,[data-action]"))return;
        dragging=true; ox=e.clientX; oy=e.clientY;
        const r=panel.getBoundingClientRect(); px=r.left; py=r.top;
        strip.style.cursor="grabbing"; e.preventDefault();
      });
      const onDragMove=e=>{
        if(!dragging)return;
        const nx=px+(e.clientX-ox), ny=py+(e.clientY-oy);
        const w=panel.offsetWidth;
        applyPos(nx,ny,w); saveFloatPos(clampX(nx),clampY(ny),w);
      };
      const onDragUp=()=>{
        if(dragging){dragging=false;strip.style.cursor="grab";}
      };
      _addFloatListener(window,"mousemove",onDragMove);
      _addFloatListener(window,"mouseup",onDragUp);
    }

    // Resize handle — bottom-right corner
    // Remove existing handle if re-initialising
    panel.querySelector("#mwl-resize-handle")?.remove();
    const resizeHandle=document.createElement("div");
    resizeHandle.id="mwl-resize-handle";
    resizeHandle.title="Drag to resize";
    panel.appendChild(resizeHandle);
    let resizing=false,rox=0,rw0=0;
    resizeHandle.addEventListener("mousedown",e=>{
      resizing=true; rox=e.clientX; rw0=panel.offsetWidth; e.preventDefault(); e.stopPropagation();
    });
    const onResizeMove=e=>{
      if(!resizing)return;
      const nw=Math.max(260,rw0+(e.clientX-rox));
      const r=panel.getBoundingClientRect();
      applyPos(r.left,r.top,nw); saveFloatPos(clampX(r.left),clampY(r.top),nw);
    };
    const onResizeUp=()=>{resizing=false;};
    _addFloatListener(window,"mousemove",onResizeMove);
    _addFloatListener(window,"mouseup",onResizeUp);

    // Clamp on window resize
    const onWinResize=()=>{
      const r=panel.getBoundingClientRect();
      applyPos(r.left,r.top,panel.offsetWidth);
    };
    _addFloatListener(window,"resize",onWinResize,{passive:true});
  }

  // ── Anchor finders ──
  function findAnchor(){
    const signals=["Filters (","Select all","Exclude Videos","Variants","Brands","Categories","Tags","Status"];
    for(const c of document.querySelectorAll(".MuiPaper-root")){
      const txt=c.textContent||"";
      if(signals.filter(s=>txt.includes(s)).length>=2)return c.closest(".MuiBox-root")||c;
    }
    if(isSearchRoute()){
      for(const c of document.querySelectorAll("[role='tabpanel']")){
        if(!c.hidden&&c.style.display!=="none"&&c.offsetParent!==null)return c;
      }
      for(const c of document.querySelectorAll("[role='tabpanel']")){
        if(!c.hidden)return c;
      }
    }
    return null;
  }

  function isEmbedded(panel){
    if(!panel?.isConnected)return false;
    if(isSearchRoute())return panel.parentNode===document.body;
    const all=document.querySelectorAll(`#${PANEL_ID}`);
    if(all.length>1){all.forEach(p=>{if(p!==panel)p.remove();});return false;}
    const anchor=findAnchor(); if(!anchor)return false;
    return anchor.nextElementSibling===panel||anchor.nextElementSibling?.id==="mwl-placeholder";
  }

  function mountPanel(panel){
    if(!panel)return;
    document.querySelectorAll(`#${PANEL_ID}`).forEach(p=>{if(p!==panel)p.remove();});
    if(isEmbedded(panel))return;
    stopGeometrySync();

    if(isSearchRoute()){
      if(!document.body.contains(panel))document.body.appendChild(panel);
      panel.classList.add("mwl-visible","mwl-floating");
      initFloatingPanel(panel);
      return;
    }

    const anchor=findAnchor();
    if(!anchor){
      // Anchor not in DOM yet — retry on next frame (handles React deferred renders)
      requestAnimationFrame(()=>{ if(mounted&&isSupportedRoute())mountPanel(panel); });
      return;
    }
    anchor.insertAdjacentElement("afterend",panel);
    panel.classList.add("mwl-visible");
    panel.classList.remove("mwl-floating");
    startGeometrySync(panel,anchor);
  }

  // ═══════════════════════════════════════
  // Panel construction
  // ═══════════════════════════════════════
  function buildPanel(){
    // Inject styles synchronously before inserting any DOM
    ensureStyles();

    const panel=el("div",{id:PANEL_ID});

    // ── Restore bar (visible only when minimized) ──
    const restoreBar=el("div",{id:"mwl-restore-bar",title:"Click to expand"},[
      el("span",{class:"mwl-restore-label"},["Dashboard — click to expand"]),
      el("span",{class:"mwl-restore-chev"},["▾"]),
    ]);
    restoreBar.addEventListener("click",()=>setMinimized(false));

    // ── Strip (always visible when not minimized) ──
    const strip=el("div",{class:"mwl-strip"},[

      // Status chip — leftmost
      el("span",{id:"mwl-status-chip"},["—"]),

      el("div",{class:"mwl-prog-sep"}),

      // Still Life — dot + bar + pct + num, clickable
      el("div",{class:"mwl-prog mwl-prog-clickable","data-action":"focusIn","data-ui-key":"focus:inToShoot",title:"Still Life to shoot — click to jump to next"},[
        el("span",{class:"mwl-dot mwl-dot-sl",id:"mwl-dot-sl"}),
        el("span",{class:"mwl-prog-lbl"},["Still Life"]),
        el("div",{class:"mwl-prog-bar"},[el("i",{id:"mwl-in-bar"})]),
        el("span",{class:"mwl-prog-pct",id:"mwl-in-pct"},["—"]),
        el("span",{class:"mwl-prog-num",id:"mwl-in-num"},["—"]),
      ]),

      el("div",{class:"mwl-prog-sep"}),

      // Model — dot + bar + pct + num, clickable
      el("div",{class:"mwl-prog mwl-prog-clickable","data-action":"focusOu","data-ui-key":"focus:ouToShoot",title:"Model to shoot — click to jump to next"},[
        el("span",{class:"mwl-dot mwl-dot-mo",id:"mwl-dot-mo"}),
        el("span",{class:"mwl-prog-lbl"},["Model"]),
        el("div",{class:"mwl-prog-bar"},[el("i",{id:"mwl-ou-bar"})]),
        el("span",{class:"mwl-prog-pct",id:"mwl-ou-pct"},["—"]),
        el("span",{class:"mwl-prog-num",id:"mwl-ou-num"},["—"]),
      ]),

      el("div",{class:"mwl-prog-sep"}),

      // Missing pill
      el("div",{id:"mwl-missing-pill","data-action":"next",title:"Missing — click to jump to next"},[
        el("span",{class:"mwl-pill-label"},["Missing "]),
        el("span",{class:"mwl-mc",id:"mwl-focus-missing"},["0"])
      ]),

      el("div",{class:"mwl-prog-sep"}),

      // RTW / ACC inline KPI
      el("div",{class:"mwl-kpi-inline"},[
        el("span",{class:"mwl-kpi-lbl"},["RTW"]),
        el("span",{class:"mwl-kpi-val",id:"mwl-cat-rtw"},["0"]),
        el("span",{class:"mwl-kpi-dot"},["·"]),
        el("span",{class:"mwl-kpi-lbl"},["ACC"]),
        el("span",{class:"mwl-kpi-val",id:"mwl-cat-acc"},["0"]),
      ]),

      // Right actions — load count fused into ⇣ button
      el("div",{class:"mwl-strip-actions"},[
        el("button",{class:"mwl-abtn","data-action":"loadAll",id:"mwl-loadall-btn",title:"Force load all (ESC cancels)"},["⇣"]),
        el("button",{class:"mwl-abtn","data-action":"qcOpen",title:"Open QC Carousel"},["QC"]),
        el("button",{id:"mwl-float-reset","data-action":"floatReset",title:"Reset panel position"},["⊹"]),
        el("button",{id:"mwl-expand-btn",title:"More"},["▾"]),
        el("button",{id:"mwl-min-btn",title:"Minimize"},["−"]),
      ]),
    ]);

    // ── Drawer ──
    const drawer=el("div",{class:"mwl-drawer"},[
      el("div",{class:"mwl-dcols mwl-dcols-2"},[
        // Col 1 — Tags (horizontal)
        el("div",{class:"mwl-dcol"},[
          el("div",{class:"mwl-dcol-title"},["Tags"]),
          el("div",{class:"mwl-pill-row"},[
            el("div",{class:"mwl-pill","data-action":"tagfocus","data-tag":"IN ONLY","data-ui-key":"tag:IN ONLY"},["IN ONLY ",el("span",{class:"mwl-count",id:"mwl-tag-inonly"},["0"])]),
            el("div",{class:"mwl-pill","data-action":"tagfocus","data-tag":"OM ONLY","data-ui-key":"tag:OM ONLY"},["OM ONLY ",el("span",{class:"mwl-count",id:"mwl-tag-omonly"},["0"])]),
            el("div",{class:"mwl-pill","data-action":"tagfocus","data-tag":"MODEL SIZE UNAVAILABLE","data-ui-key":"tag:MODEL SIZE UNAVAILABLE"},["MODEL SIZE ",el("span",{class:"mwl-count",id:"mwl-tag-modelsize"},["0"])]),
          ]),
        ]),
        // Col 2 — Focus (horizontal)
        el("div",{class:"mwl-dcol"},[
          el("div",{class:"mwl-dcol-title"},["Focus"]),
          el("div",{class:"mwl-pill-row"},[
            el("div",{class:"mwl-pill","data-action":"setfocus","data-focus":"rtwVideoMissing","data-ui-key":"focus:rtwVideoMissing"},["RTW VIDEO ",el("span",{class:"mwl-count",id:"mwl-focus-rtwvideo"},["0"])]),
            el("div",{class:"mwl-pill","data-action":"setfocus","data-focus":"rejected","data-ui-key":"focus:rejected"},["Rejected ",el("span",{class:"mwl-count",id:"mwl-focus-rej"},["0"])]),
          ]),
        ]),
      ]),
      // Footer — Next integra il ptr
      el("div",{class:"mwl-dfooter"},[
        el("div",{class:"mwl-dbtn gold","data-action":"next",id:"mwl-next-btn"},[
          el("span",{class:"mwl-next-label"},["Next ↓"]),
          el("span",{class:"mwl-next-ptr",id:"mwl-next-ptr"},["0 / 0"]),
        ]),
        el("div",{class:"mwl-dbtn","data-action":"copyMissing"},["Copy Missing"]),
        el("div",{class:"mwl-dbtn","data-action":"copyAll"},["Copy All"]),
      ]),
    ]);

    // ── Help overlay ──
    const helpOv=el("div",{class:"mwl-overlay",id:"mwl-help"},[
      el("div",{class:"mwl-ov-head"},[
        el("span",{class:"mwl-ov-title"},["Shortcuts"]),
        el("button",{class:"mwl-obtn","data-action":"closeHelp"},["Close"]),
      ]),
      el("div",{class:"mwl-ov-box"},[
        el("div",{style:{color:"rgba(255,255,255,0.78)",fontSize:"11px",lineHeight:"1.6"}},
          ["N = Next  •  A = Copy all  •  Q = QC  •  H = Help  •  ESC = stop Load All"])
      ]),
    ]);

    panel.appendChild(restoreBar);
    panel.appendChild(strip);
    panel.appendChild(drawer);
    panel.appendChild(helpOv);

    // ── Expand button ──
    strip.querySelector("#mwl-expand-btn").addEventListener("click",()=>setDrawerOpen(!bannerExpanded));

    // ── Minimize button ──
    strip.querySelector("#mwl-min-btn").addEventListener("click",()=>setMinimized(true));

    // ── Unified click handler ──
    panel.addEventListener("click",async(e)=>{
      const aEl=e.target.closest("[data-action]"); if(!aEl)return;
      const action=aEl.getAttribute("data-action");

      if(action==="loadAll"){
        const btn=aEl; btn.disabled=true;
        btn.textContent="⇣ 0%"; btn.classList.remove("is-loading-red","is-loading-amber");
        try{
          toast("Load All: scrolling… (ESC stop)");
          await window.MadameUtils.forceLoadAllBalanced({maxLoops:700,onProgress:({percent})=>{btn.textContent=`⇣ ${percent}%`;}});
          toast("Load All: done."); updateCounts(false);
        }
        catch{ bumpErr("load_all"); toast("Load All: failed."); }
        finally{
          btn.disabled=false;
          // updateCounts will set correct text via updateLoadChip
          btn.textContent="⇣";
          btn.title="Force load all (ESC cancels)";
          updateCounts(false);
        }
        return;
      }
      if(action==="qcOpen"){ openQCViewer(); return; }
      if(action==="floatReset"){
        try{localStorage.removeItem(FLOAT_KEY);}catch{}
        const panel2=document.getElementById(PANEL_ID); if(panel2){
          const W=360, X=Math.max(16,window.innerWidth-W-24), Y=80;
          panel2.style.left=X+"px"; panel2.style.top=Y+"px"; panel2.style.width=W+"px";
          saveFloatPos(X,Y,W);
        }
        return;
      }
      if(action==="closeHelp"){ setOverlay("help",false); return; }

      if(action==="next"){ goNext(true); return; }
      if(action==="copyMissing"){ copyMissingVIDs(); return; }
      if(action==="copyAll"){ copyAllVIDs(); return; }

      if(action==="focusIn"){
        if(e.shiftKey){ setActiveUIKey("focus:inToShoot"); setFocus({type:"inToShoot",value:""},false); copyFocusVIDs(); return; }
        // If already active → behave as Next (goNext handles auto-deselect at cycle end)
        if(focus.type==="inToShoot"){ goNext(true); return; }
        // First click: activate and jump to first
        setActiveUIKey("focus:inToShoot");
        setFocus({type:"inToShoot",value:""},true);
        return;
      }
      if(action==="focusOu"){
        if(e.shiftKey){ setActiveUIKey("focus:ouToShoot"); setFocus({type:"ouToShoot",value:""},false); copyFocusVIDs(); return; }
        if(focus.type==="ouToShoot"){ goNext(true); return; }
        setActiveUIKey("focus:ouToShoot");
        setFocus({type:"ouToShoot",value:""},true);
        return;
      }

      if(action==="setfocus"){
        const f=aEl.getAttribute("data-focus")||"";
        const nf={missing:{type:"missing",value:""},inToShoot:{type:"inToShoot",value:""},ouToShoot:{type:"ouToShoot",value:""},rtwVideoMissing:{type:"rtwVideoMissing",value:""},rejected:{type:"rejected",value:""}}[f]||{type:"missing",value:""};
        setActiveUIKey(`focus:${nf.type}`);
        if(e.shiftKey){focus=nf;saveEngineState();updateCounts(true);setTimeout(copyMissingVIDs,0);}
        else setFocus(nf,true);
        return;
      }
      if(action==="tagfocus"){
        const tag=(aEl.getAttribute("data-tag")||"").trim(); if(!tag)return;
        setActiveUIKey(`tag:${tag.toUpperCase()}`);
        setFocus({type:"tag",value:tag},!e.shiftKey);
        if(e.shiftKey)copyFocusVIDs();
        return;
      }
    });

    return panel;
  }

  // ═══════════════════════════════════════
  // Drawer / overlay / minimize helpers
  // ═══════════════════════════════════════
  function setDrawerOpen(open){
    bannerExpanded=open;
    const panel=document.getElementById(PANEL_ID); if(!panel)return;
    panel.querySelector(".mwl-drawer")?.classList.toggle("open",open);
    const btn=panel.querySelector("#mwl-expand-btn");
    if(btn){btn.classList.toggle("open",open);btn.textContent=open?"▲":"▾";}
  }
  function setMinimized(v){
    const panel=document.getElementById(PANEL_ID); if(!panel)return;
    panel.classList.toggle("mwl-minimized",v);
    if(!v)updateCounts(false);
  }
  function setOverlay(which,open){
    const panel=document.getElementById(PANEL_ID); if(!panel)return;
    panel.querySelector(`#mwl-${which}`)?.classList.toggle("open",open);
    if(which==="help")helpOpen=open;
    if(open)setDrawerOpen(false);
  }
  function toggleOverlay(which){
    if(which==="help")setOverlay("help",!helpOpen);
  }

  // ═══════════════════════════════════════
  // ensurePanel — single entry point
  // ═══════════════════════════════════════
  function ensurePanel(){
    if(document.getElementById(PANEL_ID))return document.getElementById(PANEL_ID);
    loadEngineState(); loadActiveUIKey();
    const panel=buildPanel();
    // Do NOT append to body — we rely on mountPanel to insert it after anchor
    return panel;
  }

  // ═══════════════════════════════════════
  // updateCounts — core logic
  // ═══════════════════════════════════════
  function setEl(id,v){ document.querySelectorAll(`#${id}`).forEach(n=>{n.textContent=v;}); }
  function setW(id,w){ document.querySelectorAll(`#${id}`).forEach(n=>{n.style.width=w;}); }

  function updateLoadChip(loaded,totalVariants){
    const btn=document.getElementById("mwl-loadall-btn"); if(!btn)return;
    // Also keep legacy chip hidden if it exists
    const chip=document.getElementById("mwl-loadchip"); if(chip){chip.style.display="none";}
    // If scrolling is in progress the button text is managed by the loadAll handler — don't overwrite
    if(btn.disabled)return;
    if(isSearchRoute()||typeof totalVariants!=="number"||totalVariants<=0){
      btn.textContent="⇣"; btn.title="Force load all (ESC cancels)";
      btn.classList.remove("is-loading-red","is-loading-amber"); return;
    }
    const rem=Math.max(0,totalVariants-loaded);
    if(rem===0){
      btn.textContent="⇣"; btn.title="All loaded";
      btn.classList.remove("is-loading-red","is-loading-amber"); return;
    }
    btn.textContent=`⇣ −${rem}`;
    btn.title=`Scroll to load ${rem} more (click to auto-scroll)`;
    btn.classList.toggle("is-loading-red",rem>80);
    btn.classList.toggle("is-loading-amber",rem<=80);
  }

  function updateDot(overallPct){
    // Global dot removed — per-group dots are colored in updateCounts
    const dot=document.getElementById("mwl-dot"); if(dot){const {bg}=trafficColor(overallPct);dot.style.background=bg;}
  }
  function updateProgDot(id,pctVal){
    const d=document.getElementById(id); if(!d)return;
    const {bg}=trafficColor(pctVal); d.style.background=bg;
  }

  function updateCounts(forceResetPointer=false){
    if(!isSupportedRoute())return;
    _countsDirty=false;

    // Ensure panel exists and is mounted
    const panel=ensurePanel();
    mountPanel(panel);
    if(!panel.classList.contains("mwl-visible"))return; // anchor not yet found

    const flags=loadFlags();

    // ── Search route ──
    if(isSearchRoute()){
      const products=safe("search_vids",()=>getProducts(flags),[]);
      const n=products.length;

      const analyses=safe("search_analyses",()=>products.map(p=>{
        const a=analyzeProduct(p,flags);
        const tags=getProductTags(p.root);
        return{...p,a,tags};
      }),[]);
      lastAnalyses=analyses.length?analyses:products.map(p=>({...p,a:{hasINSlot:false,hasOUSlot:false,hasINShot:false,hasOUShot:false,hasVideo:false,hasRejected:false},tags:new Set()}));

      const totalIN=analyses.filter(x=>x.a.hasINSlot).length;
      const totalOU=analyses.filter(x=>x.a.hasOUSlot).length;
      const inShot=analyses.filter(x=>x.a.hasINSlot&&x.a.hasINShot).length;
      const ouShot=analyses.filter(x=>x.a.hasOUSlot&&x.a.hasOUShot).length;
      const inP=pct(inShot,totalIN), ouP=pct(ouShot,totalOU);

      if(totalIN>0||totalOU>0){
        // Full analysis available — show real progress
        setW("mwl-in-bar",`${inP}%`); setW("mwl-ou-bar",`${ouP}%`);
        setEl("mwl-in-pct",`${inP}%`); setEl("mwl-ou-pct",`${ouP}%`);
        setEl("mwl-in-num",`${inShot}/${totalIN}`); setEl("mwl-ou-num",`${ouShot}/${totalOU}`);
        updateProgDot("mwl-dot-sl",inP); updateProgDot("mwl-dot-mo",ouP);
      } else {
        // Only VID list — show count in Still Life slot, hide OU
        setW("mwl-in-bar","0%"); setW("mwl-ou-bar","0%");
        setEl("mwl-in-pct","—"); setEl("mwl-ou-pct","—");
        setEl("mwl-in-num",`${n} VIDs`); setEl("mwl-ou-num","—");
      }

      const missingCount=analyses.filter(x=>isMissing(x.a)).length||n;
      setEl("mwl-focus-missing",String(missingCount));
      setEl("mwl-focus-rtwvideo","0"); setEl("mwl-focus-rej","0");
      setEl("mwl-tag-inonly","0"); setEl("mwl-tag-omonly","0"); setEl("mwl-tag-modelsize","0");
      setEl("mwl-cat-rtw","0"); setEl("mwl-cat-acc","0");
      setEl("mwl-status-chip",`${n} VIDs`);
      const sc=document.getElementById("mwl-status-chip"); if(sc)sc.style.color="rgba(255,255,255,0.55)";
      updateLoadChip(n,null);

      focusList=analyses.filter(x=>isMissing(x.a));
      if(!focusList.length)focusList=lastAnalyses.slice(); // fallback: all VIDs navigable
      if(forceResetPointer)focusPtr=0; if(focusPtr>=focusList.length)focusPtr=0;
      if(lastHighlightedEl&&!lastHighlightedEl.isConnected)clearHighlight();

      // Expose for coordinated scripts (e.g. Report Button)
      ensureMadameUtils()._lastProducts=products;
      ensureMadameUtils()._totalVariants=null; // no variant total on search

      updateMissingPill(); applyActiveStyles(); return;
    }

    // ── Worklist route ──
    const products=safe("update_products",()=>getProducts(flags),[]); bumpCnt("updateCounts",1);
    const analyses=safe("update_analyses",()=>products.map(p=>{const a=analyzeProduct(p,flags);const tags=getProductTags(p.root);return{...p,a,tags};}),[]);
    lastAnalyses=analyses;

    if(flags.enableNoPhotoHighlight)for(const x of analyses)
      safe("nophoto",()=>{ const t=getHighlightTarget(x.root); if(t)hasNoPhotos(x.a)?t.setAttribute(ATTR_NOPHOTO,"1"):t.removeAttribute(ATTR_NOPHOTO); },undefined);

    const tagCounts=Object.fromEntries(TAGS_OF_INTEREST.map(t=>[t,0]));
    for(const x of analyses)for(const t of TAGS_OF_INTEREST)if(x.tags.has(t))tagCounts[t]++;

    const loaded=products.length, totalVariants=parseVariantsTotal();
    updateLoadChip(loaded,totalVariants);

    const totalIN=analyses.filter(x=>x.a.hasINSlot).length, totalOU=analyses.filter(x=>x.a.hasOUSlot).length;
    const inShot=analyses.filter(x=>x.a.hasINSlot&&x.a.hasINShot).length, ouShot=analyses.filter(x=>x.a.hasOUSlot&&x.a.hasOUShot).length;
    const inToShoot=Math.max(0,totalIN-inShot), ouToShoot=Math.max(0,totalOU-ouShot);
    const inP=pct(inShot,totalIN), ouP=pct(ouShot,totalOU);
    const overallP=(totalIN&&totalOU)?Math.round((inP+ouP)/2):(totalIN?inP:(totalOU?ouP:0));
    const catRTW=analyses.filter(x=>x.tags?.has(RTW_TAG)).length, catACC=Math.max(0,loaded-catRTW);
    let rtwTotal=0,rtwWithVideo=0,rtwMissing=0;
    if(flags.enableRTWVideoKPI){rtwTotal=catRTW;rtwWithVideo=analyses.filter(x=>x.tags?.has(RTW_TAG)&&x.a.hasVideo).length;rtwMissing=Math.max(0,rtwTotal-rtwWithVideo);}
    let rejectedLoaded=0; if(flags.enableRejectedKPI)rejectedLoaded=analyses.filter(x=>x.a.hasRejected).length;
    const missingCount=analyses.filter(x=>isMissing(x.a)).length;

    // Progress bars
    setW("mwl-in-bar",`${inP}%`); setW("mwl-ou-bar",`${ouP}%`);
    setEl("mwl-in-pct",`${inP}%`); setEl("mwl-ou-pct",`${ouP}%`);
    setEl("mwl-in-num",`${inShot}/${totalIN||0}`); setEl("mwl-ou-num",`${ouShot}/${totalOU||0}`);

    // Status chip
    const {bg,text}=trafficColor(overallP);
    setEl("mwl-status-chip",`${text} · ${overallP}%`);
    const sc=document.getElementById("mwl-status-chip"); if(sc)sc.style.color=bg;
    updateDot(overallP);
    updateProgDot("mwl-dot-sl", inP);
    updateProgDot("mwl-dot-mo", ouP);

    // Missing
    setEl("mwl-focus-missing",String(missingCount));

    // KPI
    setEl("mwl-cat-rtw",String(catRTW)); setEl("mwl-cat-acc",String(catACC));
    const rtwV=flags.enableRTWVideoKPI?String(rtwMissing):"0", rejV=flags.enableRejectedKPI?String(rejectedLoaded):"0";
    setEl("mwl-focus-rtwvideo",rtwV); setEl("mwl-focus-rej",rejV);

    // Tags
    setEl("mwl-tag-inonly",String(tagCounts["IN ONLY"]||0));
    setEl("mwl-tag-omonly",String(tagCounts["OM ONLY"]||0));
    setEl("mwl-tag-modelsize",String(tagCounts["MODEL SIZE UNAVAILABLE"]||0));

    // Focus list + ptr
    focusList=buildFocusList(analyses);
    if(forceResetPointer)focusPtr=0; if(focusPtr>=focusList.length)focusPtr=0;
    if(lastHighlightedEl&&!lastHighlightedEl.isConnected)clearHighlight();
    updateMissingPill();

    // Alert pills
    const panel2=document.getElementById(PANEL_ID); if(panel2){
      qsa(".mwl-pill[data-focus]",panel2).forEach(p=>{
        const c=p.querySelector(".mwl-count"); const v=c?parseInt((c.textContent||"0"),10):NaN;
        p.classList.toggle("is-alert",Number.isFinite(v)&&v>0);
      });
    }

    applyActiveStyles();

    lastKPIs={loaded,totalVariants,totalIN,totalOU,inShot,ouShot,inToShoot,ouToShoot,inP,ouP,catRTW,catACC,rtwTotal,rtwWithVideo,rtwMissing,rejectedLoaded};

    // Expose for coordinated scripts (e.g. Report Button)
    ensureMadameUtils()._lastProducts=products;
    ensureMadameUtils()._totalVariants=typeof totalVariants==="number"?totalVariants:null;
  }

  // ═══════════════════════════════════════
  // Scheduling + SPA hooks
  // ═══════════════════════════════════════
  function scheduleUpdate(){
    if(!mounted||!isSupportedRoute()||updateScheduled)return;
    updateScheduled=true;
    _countsDirty=true;
    const flags=loadFlags(), run=()=>{ updateScheduled=false; updateCounts(false); };
    if(flags.enablePerfGating&&document.hidden){updateScheduled=false;return;}
    clearTimeout(updateTimer);
    if(flags.enablePerfGating&&"requestIdleCallback"in window)window.requestIdleCallback(()=>run(),{timeout:600});
    else updateTimer=setTimeout(run,300);
  }

  function hookSpa(cb){
    const _p=history.pushState, _r=history.replaceState;
    const fire=()=>setTimeout(cb,0);
    history.pushState=function(){const r=_p.apply(this,arguments);fire();return r;};
    history.replaceState=function(){const r=_r.apply(this,arguments);fire();return r;};
    window.addEventListener("popstate",fire);
  }

  function findProductContainer(){
    // On worklist: the scrollable MuiBox that holds all product cards
    const s=document.querySelector('div.MuiBox-root[style*="overflow: auto"]');
    if(s&&s.clientHeight>200)return s;
    // Fallback: observe body (safe but broad)
    return document.body;
  }

  let _scrollRafId=null;
  function _onScroll(){
    if(_scrollRafId)return;
    _scrollRafId=requestAnimationFrame(()=>{
      _scrollRafId=null;
      // Geometry sync (worklist only — search uses initFloatingPanel's own resize listener)
      if(isWorklistRoute()&&_scrollHandler)_scrollHandler();
      scheduleUpdate();
    });
  }

  function attachListeners(){
    if(observer)return;
    const target=isWorklistRoute()?findProductContainer():document.body;
    observer=new MutationObserver(()=>scheduleUpdate());
    observer.observe(target,{childList:true,subtree:true});
    if(!scrollAttached){
      window.addEventListener("scroll",_onScroll,{passive:true});
      scrollAttached=true;
    }
  }
  function detachListeners(){
    if(observer){observer.disconnect();observer=null;}
    if(scrollAttached){window.removeEventListener("scroll",_onScroll);scrollAttached=false;}
    if(_scrollRafId){cancelAnimationFrame(_scrollRafId);_scrollRafId=null;}
    updateScheduled=false; clearTimeout(updateTimer);
  }

  function attachShortcuts(){
    if(window.__mwl_sc_v512__)return; window.__mwl_sc_v512__=true;
    window.addEventListener("keydown",(e)=>{
      if(!isSupportedRoute()||isEditable(e.target))return;
      if(e.metaKey||e.ctrlKey||e.altKey)return;
      const k=(e.key||"").toLowerCase();
      if(k==="h"){ toggleOverlay("help"); e.preventDefault(); return; }
      if(helpOpen){ if(k==="escape"){setOverlay("help",false);e.preventDefault();} return; }
      if(k==="n"){goNext(true);e.preventDefault();return;}
      if(k==="a"){copyAllVIDs();e.preventDefault();return;}
      if(k==="q"){openQCViewer();e.preventDefault();return;}
    },true);
  }

  // ═══════════════════════════════════════
  // Mount / unmount
  // ═══════════════════════════════════════
  function mount(){
    if(mounted)return; mounted=true;
    // Inject styles immediately (before any DOM is visible)
    ensureStyles();
    const panel=ensurePanel();
    // Try to mount now; MutationObserver will retry on each DOM change
    mountPanel(panel);
    attachListeners(); attachShortcuts(); scheduleUpdate();
  }

  function unmount(){
    mounted=false; detachListeners(); clearHighlight();
    stopGeometrySync();
    document.getElementById(PANEL_ID)?.remove();
  }

  function mountOrUnmount(){ if(isSupportedRoute())mount(); else unmount(); }

  hookSpa(mountOrUnmount);
  mountOrUnmount();

  setTimeout(()=>{
    if(!isSupportedRoute())return;
    if(focus?.type==="tag")setActiveUIKey(`tag:${String(focus.value||"").toUpperCase()}`);
    else setActiveUIKey(`focus:${focus?.type||"missing"}`);
  },0);
})();

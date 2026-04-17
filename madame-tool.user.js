// ==UserScript==
// @name         Madame Dashboard
// @namespace    https://tampermonkey.net/
// @version      5.25.2
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
  window[GLOBAL_KEY] = { version: "5.25.2", startedAt: Date.now() };

  // ═══════════════════════════════════════
  // Routes
  // ═══════════════════════════════════════
  const WORKLIST_RE = /^\/worklist\/\d+/;
  const SEARCH_RE   = /^\/search\b/;
  function isWorklistRoute() { return WORKLIST_RE.test(location.pathname); }
  function isSearchRoute(){
    if(!SEARCH_RE.test(location.pathname))return false;
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
    const sc=opts.container||findScrollableContainer();

    // ── Tunable parameters ──
    const pA          = opts.pauseA    ?? 350;  // base pause after each scroll step (ms)
    const imgTimeout  = opts.imgTimeout?? 3500; // max wait per step for images to load (ms)
    const imgPoll     = opts.imgPoll   ?? 100;  // polling interval while waiting for images (ms)
    const renderWait  = opts.renderWait?? 300;  // extra settle at bottom before stability check (ms)
    const mL          = opts.maxLoops  ?? 900;
    const mS          = opts.maxStable ?? 4;

    // ── Adaptive image wait ──
    // An image is considered "pending" if:
    //   - it is not complete (browser hasn't finished decoding), OR
    //   - it is complete but naturalWidth === 0 (error / not yet painted)
    // We also check that the element is currently in the viewport.
    function pendingImgsInView(){
      const ch=gCH(sc);
      let count=0;
      for(const img of document.querySelectorAll(IMG_SELECTOR)){
        const r=img.getBoundingClientRect();
        if(r.bottom<=0||r.top>=ch)continue; // outside viewport
        if(!img.complete||img.naturalWidth===0)count++;
      }
      return count;
    }

    async function waitForImages(){
      const deadline=Date.now()+imgTimeout;
      while(Date.now()<deadline){
        if(pendingImgsInView()===0)return;
        await new Promise(r=>setTimeout(r,imgPoll));
      }
      // Timeout reached — continue anyway rather than hanging forever
    }

    let cancelled=false;
    const kd=(e)=>{if(e.key==="Escape")cancelled=true;};
    document.addEventListener("keydown",kd);

    try{
      let lH=gSH(sc), sH=0, lP=countPids(), sP=0;

      for(let i=0;i<mL;i++){
        if(cancelled)break;

        // Scroll half a viewport at a time
        const step=opts.stepPx??Math.round(gCH(sc)*0.5);
        const top=gTop(sc), h=gSH(sc), ch=gCH(sc);
        sTop(sc, Math.min(top+step, Math.max(0,h-ch)));

        // 1. Base pause — let React render newly visible components
        await new Promise(r=>setTimeout(r,pA));

        // 2. Short extra frame for React virtual list to commit DOM nodes
        await new Promise(r=>requestAnimationFrame(r));
        await new Promise(r=>requestAnimationFrame(r));

        // 3. Adaptive wait — hold until images in view have loaded (or timeout)
        await waitForImages();

        // Progress callback
        const t2=gTop(sc), h2=gSH(sc), ch2=gCH(sc);
        if(typeof opts.onProgress==="function")
          opts.onProgress({loop:i, percent:Math.min(99,Math.round(((t2+ch2)/h2)*100)), height:h2});

        // Stability check — only at bottom
        if(t2>=(h2-ch2-30)){
          // Extra settle to catch any final lazy-triggered renders
          await new Promise(r=>setTimeout(r,renderWait));
          await waitForImages();

          const h3=gSH(sc);
          if(Math.abs(h3-lH)<2)sH++; else{sH=0; lH=h3;}
          const p=countPids(); if(p===lP)sP++; else{sP=0; lP=p;}
          if(sH>=mS&&sP>=mS)break;
          lH=h3;
        } else {
          sH=0; sP=0;
        }
      }

      if(opts.returnToTop??true)sTop(sc,0);
    }finally{
      document.removeEventListener("keydown",kd);
    }
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
  let _countsDirty=true;
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
    let nodes=Array.from(document.querySelectorAll(VID_SELECTOR)).filter(n=>looksLikeVID(n.textContent));
    if(!nodes.length){
      nodes=Array.from(document.querySelectorAll(VID_FALLBACK_SELECTOR))
        .filter(n=>looksLikeVID((n.textContent||"").trim()));
    }
    for(const n of nodes){
      const vid=(n.textContent||"").trim();
      if(!vid||vids.has(vid))continue;
      const root=findProductRootFromVidNode(n)||(n.parentElement||n);
      vids.set(vid,root);
    }
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
  const _analysisCache = new WeakMap();
  function fingerprintRoot(root){
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
  // [MOD 5] — total absence of shots (no img at all in any slot)
  function hasTotallyNoShots(a){ return !a.hasINShot && !a.hasOUShot && (a.hasINSlot || a.hasOUSlot); }
  const _tagsCache = new WeakMap();
  function getProductTags(root){
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
    const minW=vw*0.25, minH=vh*0.12;
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
    if(type==="noShots")return analyses.filter(x=>hasTotallyNoShots(x.a));
    return analyses.filter(x=>isMissing(x.a));
  }
  function listLabel(){
    if(isSearchRoute())return"VIDs on search"; if(focus.type==="tag")return`Tag: ${focus.value}`;
    if(focus.type==="inToShoot")return"IN to shoot"; if(focus.type==="ouToShoot")return"OU to shoot";
    if(focus.type==="rtwVideoMissing")return"RTW VIDEO missing"; if(focus.type==="rejected")return"Rejected";
    if(focus.type==="noShots")return"VID without shots";
    return"Missing";
  }
  function clearHighlight(){ if(lastHighlightedEl?.isConnected){lastHighlightedEl.classList.remove("mwl-focus-highlight");lastHighlightedEl.removeAttribute(ATTR_NEXT);} lastHighlightedEl=null; }
  function setHighlight(elm){ clearHighlight(); if(!elm)return; elm.setAttribute(ATTR_NEXT,"1"); elm.classList.add("mwl-focus-highlight"); lastHighlightedEl=elm; }
  function goNext(alert_=true){
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
      else nextBtn.textContent=`Next ↓  ${ptr}`;
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
    const map={}, vf=new Set();

    // ── Strategy: iterate all tiles on the page, find the VID they belong to ──
    // This avoids relying on findTightProductContainer which can fail if the
    // h4 VID lives in a different branch from the tiles.
    //
    // For each tile (div.css-1dcsz0a), we walk UP the DOM to find the nearest
    // h4 whose text is a numeric VID. That h4 is the owner of this tile.

    function nearestVID(el){
      let node=el;
      for(let i=0;i<20&&node;i++){
        // Check all h4 descendants of the current ancestor
        const h4s=Array.from(node.querySelectorAll("h4"))
          .filter(h=>/^\d{10,}$/.test((h.textContent||"").trim()));
        if(h4s.length===1)return h4s[0].textContent.trim();
        // If multiple h4s at this level, can't determine — go up
        node=node.parentElement;
      }
      return null;
    }

    for(const tile of Array.from(document.querySelectorAll(TILE_SELECTOR))){
      // ── Video tile ──
      const hdr=tile.querySelector(QC_VIDEO_HEADER_SELECTOR);
      if(hdr&&/video/i.test(hdr.textContent||"")){
        const img=tile.querySelector(IMG_SELECTOR); if(!img)continue;
        const src=img.getAttribute("src")||""; if(!src)continue;
        const vid=nearestVID(tile); if(!vid)continue;
        map[vid]||={};
        const srcQC=bumpWidth(src,QC_WIDTH); vf.add("video");
        if(!map[vid]["video"])map[vid]["video"]={srcQC:absUrl(srcQC)};
        continue;
      }

      // ── Photo tile ──
      const lbl=Array.from(tile.querySelectorAll("span[title]"))
        .find(s=>SLOT_CODE_RE.test(s.getAttribute("title")||""));
      if(!lbl)continue;
      const m=(lbl.getAttribute("title")||"").trim().match(SLOT_CODE_RE); if(!m)continue;
      const view=codeToView(m[1]); vf.add(view);
      const img=tile.querySelector(IMG_SELECTOR);
      if(!img)continue; // slot empty — no image to show
      const src=img.getAttribute("src")||""; if(!src)continue;
      const vid=nearestVID(tile); if(!vid)continue;
      map[vid]||={};
      const srcQC=bumpWidth(src,QC_WIDTH);
      if(!map[vid][view])map[vid][view]={srcQC:absUrl(srcQC)};
    }

    // Brand image: one per VID, found from the product container
    // We already have the VIDs from the tile pass — now find brand img for each
    for(const vid of Object.keys(map)){
      if(map[vid]["brand"])continue; // already set
      // Find the h4 for this VID and walk up to find brand img
      const vidEl=Array.from(document.querySelectorAll("h4"))
        .find(h=>(h.textContent||"").trim()===vid);
      if(!vidEl)continue;
      let node=vidEl;
      for(let i=0;i<16&&node;i++){
        const bs=(node.querySelector(BRAND_IMG_SELECTOR_PRIMARY)||node.querySelector(BRAND_IMG_SELECTOR_FALLBACK))?.getAttribute("src")||"";
        if(bs){map[vid]["brand"]={srcQC:absUrl(bumpIrisThumb(bs,QC_WIDTH))};vf.add("brand");break;}
        node=node.parentElement;
      }
    }
    const vids=Object.keys(map).filter(v=>Object.keys(map[v]||{}).length>0);
    const orderedViews=[...QC_VIEW_ORDER.filter(v=>vf.has(v)),...Array.from(vf).filter(v=>!QC_VIEW_ORDER.includes(v)).sort()];
    // Re-sort each VID's map keys to match VIEW_ORDER so JSON.stringify preserves order
    for(const vid of vids){
      const src=map[vid];
      const sorted={};
      for(const v of orderedViews){if(src[v])sorted[v]=src[v];}
      for(const v of Object.keys(src)){if(!sorted[v])sorted[v]=src[v];}
      map[vid]=sorted;
    }
    return{vids,views:orderedViews,map,loadedCount:vids.filter(v=>Object.values(map[v]||{}).some(x=>x?.srcQC)).length};
  }
  // ── QC Overlay — injected in-page so images load with session cookies ──
  const QC_OVERLAY_ID = "mwl-qc-overlay";

  function closeQCOverlay(){
    document.getElementById(QC_OVERLAY_ID)?.remove();
    document.body.style.overflow="";
  }

  function openQCViewer(){
    if(!loadFlags().enableQC)return;
    if(!isWorklistRoute()){alert("QC Carousel is available on /worklist pages.");return;}
    updateCounts(false);
    const data=extractQCMap_Surgical();
    if(!data.vids.length){alert("No products/images detected yet. Scroll a bit and retry.");return;}

    const wlName=(getTextById("info-box-0")||"Worklist").trim();
    const channelRaw=(getTextById("tool-channel")||"NET-A-PORTER").trim();
    const brandKey=resolveBrandKey();
    const total=parseVariantsTotal(), loaded=data.loadedCount, t=total>0?total:null;
    const ratio=t?(loaded/t):null;
    let status="partial";
    if(!t)status="unknown"; else if(loaded>=t)status="ok"; else if(ratio!==null&&ratio<0.5)status="low";
    const missing=(t&&loaded<t)?(t-loaded):0, showMissing=Boolean(t&&status!=="ok");

    // Remove any existing overlay
    closeQCOverlay();

    // ── Inject overlay CSS once ──
    if(!document.getElementById("mwl-qc-styles")){
      const s=document.createElement("style");
      s.id="mwl-qc-styles";
      s.textContent=`
        #mwl-qc-overlay{position:fixed;inset:0;z-index:99999;display:flex;flex-direction:column;background:#fff;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;color:#0b0c0f;}
        #mwl-qc-overlay *{box-sizing:border-box;}
        .mwl-qc-bar{position:sticky;top:0;z-index:10;background:#07080a;color:#fff;padding:12px 16px 10px;border-bottom:1px solid rgba(255,255,255,.10);display:flex;flex-direction:column;gap:8px;flex-shrink:0;}
        .mwl-qc-row1{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;}
        .mwl-qc-left{display:flex;align-items:center;gap:12px;}
        .mwl-qc-brand{font-weight:800;letter-spacing:.24em;font-size:12px;text-transform:uppercase;}
        .mwl-qc-pill{display:inline-flex;align-items:center;gap:8px;padding:6px 10px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.08);color:#fff;white-space:nowrap;font-size:11px;}
        .mwl-qc-pill-dot{width:8px;height:8px;border-radius:50%;background:#94a3b8;flex:0 0 8px;}
        .mwl-qc-pill.ok .mwl-qc-pill-dot{background:rgb(16,185,129);}
        .mwl-qc-pill.partial .mwl-qc-pill-dot{background:rgb(245,158,11);}
        .mwl-qc-pill.low .mwl-qc-pill-dot{background:rgb(239,68,68);}
        .mwl-qc-pill-count{font-weight:800;font-size:11.5px;}
        .mwl-qc-pill-miss{margin-left:6px;font-size:10px;opacity:.72;letter-spacing:.12em;text-transform:uppercase;}
        .mwl-qc-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .mwl-qc-btn{display:inline-flex;align-items:center;justify-content:center;height:30px;padding:0 12px;border-radius:999px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;font:800 11px sans-serif;letter-spacing:.14em;text-transform:uppercase;cursor:pointer;user-select:none;white-space:nowrap;}
        .mwl-qc-btn:hover{background:rgba(255,255,255,.12);}
        .mwl-qc-btn.on{background:rgba(255,255,255,.92);color:#07080a;border-color:rgba(255,255,255,.92);}
        .mwl-qc-btn-close{width:32px;padding:0;font-size:16px;font-weight:900;}
        .mwl-qc-btn-gold{border-color:#d8b46a;color:#d8b46a;}
        .mwl-qc-btn-gold:hover{background:rgba(216,180,106,.12);}
        .mwl-qc-btn-gold.has-sel{border-color:#d8b46a;color:#d8b46a;opacity:1;}
        .mwl-qc-btn-gold[data-copied] .mwl-qc-sel-label{display:none;}
        .mwl-qc-btn-gold[data-copied]::after{content:"Copied ✓";}
        .mwl-qc-row2{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;}
        .mwl-qc-channel{font-weight:700;font-size:11px;letter-spacing:.18em;text-transform:uppercase;opacity:.78;}
        .mwl-qc-sep{opacity:.35;}
        .mwl-qc-wl{font-size:14px;font-weight:650;opacity:.96;}
        .mwl-qc-body{overflow-y:auto;flex:1;padding:16px 14px 32px;}
        .mwl-qc-block{border-top:1px solid rgba(15,23,42,.12);padding-top:12px;margin-bottom:4px;}
        .mwl-qc-vidrow{display:flex;align-items:center;gap:8px;margin-bottom:10px;}
        .mwl-qc-vidlabel{font-size:12.5px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:#111827;}
        .mwl-qc-vidcb{width:15px;height:15px;cursor:pointer;accent-color:#d8b46a;flex:0 0 auto;}
        .mwl-qc-row{display:flex;gap:10px;overflow-x:auto;padding-bottom:6px;}
        .mwl-qc-tile{width:220px;flex:0 0 220px;border:1px solid rgba(15,23,42,.12);background:#fff;display:flex;flex-direction:column;}
        .mwl-qc-imgwrap{position:relative;height:293px;background:#f8f8f8;cursor:zoom-in;overflow:hidden;}
        .mwl-qc-imgwrap img{width:100%;height:100%;object-fit:cover;display:block;}
        .mwl-qc-imgwrap img.ov{position:absolute;inset:0;object-fit:contain;pointer-events:none;opacity:.92;}
        .mwl-qc-meta{padding:7px 10px;border-top:1px solid rgba(15,23,42,.12);font-size:10.5px;color:#6b7280;letter-spacing:.14em;text-transform:uppercase;}
        .mwl-qc-refwrap{height:293px;background:#f8f8f8;overflow:hidden;}
        .mwl-qc-refwrap img{width:100%;height:100%;object-fit:cover;display:block;}
        .mwl-qc-lb{position:fixed;inset:0;background:rgba(7,8,10,.94);z-index:100010;display:none;align-items:center;justify-content:center;padding:24px;}
        .mwl-qc-lb.open{display:flex;}
        .mwl-qc-lb-inner{position:relative;width:min(1180px,calc(100vw - 48px));height:min(92vh,980px);display:flex;align-items:center;justify-content:center;}
        .mwl-qc-lb-img{max-width:100%;max-height:100%;object-fit:contain;background:#0b0c0f;}
        .mwl-qc-lb-x{position:absolute;top:-10px;right:-10px;width:40px;height:40px;border-radius:50%;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:18px;}
        .mwl-qc-lb-nav{position:absolute;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);color:#fff;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:20px;user-select:none;}
        .mwl-qc-lb-prev{left:-14px;}
        .mwl-qc-lb-next{right:-14px;}
      `;
      document.head.appendChild(s);
    }

    // ── Build overlay DOM ──
    const overlay=document.createElement("div");
    overlay.id=QC_OVERLAY_ID;

    // Topbar
    const bar=document.createElement("div"); bar.className="mwl-qc-bar";
    const row1=document.createElement("div"); row1.className="mwl-qc-row1";

    const leftRow=document.createElement("div"); leftRow.className="mwl-qc-left";
    const brandEl=document.createElement("div"); brandEl.className="mwl-qc-brand"; brandEl.textContent="Quality Check";
    const pillEl=document.createElement("div"); pillEl.className="mwl-qc-pill "+status;
    pillEl.innerHTML='<span class="mwl-qc-pill-dot"></span>'
      +'<span style="font-size:11px;letter-spacing:.14em;text-transform:uppercase;opacity:.92;">Loaded</span>'
      +'<span class="mwl-qc-pill-count">'+loaded+(t?" / "+t:"")+"</span>"
      +(showMissing?'<span class="mwl-qc-pill-miss">Missing: '+missing+"</span>":"");
    leftRow.appendChild(brandEl); leftRow.appendChild(pillEl);

    const actions=document.createElement("div"); actions.className="mwl-qc-actions";

    function mkBtn(id,label,extraClass){
      const b=document.createElement("button");
      b.className="mwl-qc-btn"+(extraClass?" "+extraClass:"");
      b.id=id; b.innerHTML=label; return b;
    }
    const btnGuides=mkBtn("mwl-qc-guides","Check Guides");
    const btnBrand=mkBtn("mwl-qc-brand-btn","Brand image");
    const btnRefs=mkBtn("mwl-qc-refs","References");
    const btnRefsClose=mkBtn("mwl-qc-refs-close","×","mwl-qc-btn-close"); btnRefsClose.style.display="none";
    const btnCopySel=mkBtn("mwl-qc-copysel",'<span class="mwl-qc-sel-label">Copy selected </span><span id="mwl-qc-selcount"></span>',"mwl-qc-btn-gold");
    btnCopySel.style.opacity="0.55";
    const btnClose=mkBtn("mwl-qc-close","×","mwl-qc-btn-close"); btnClose.title="Close QC (Esc)";
    [btnGuides,btnBrand,btnRefs,btnRefsClose,btnCopySel,btnClose].forEach(b=>actions.appendChild(b));

    row1.appendChild(leftRow); row1.appendChild(actions); bar.appendChild(row1);

    const row2=document.createElement("div"); row2.className="mwl-qc-row2";
    if(channelRaw){const c=document.createElement("div");c.className="mwl-qc-channel";c.textContent=channelRaw;row2.appendChild(c);}
    const sepEl=document.createElement("div"); sepEl.className="mwl-qc-sep"; sepEl.textContent="·";
    const wlEl=document.createElement("div"); wlEl.className="mwl-qc-wl"; wlEl.textContent=wlName;
    row2.appendChild(sepEl); row2.appendChild(wlEl); bar.appendChild(row2);
    overlay.appendChild(bar);

    // Body
    const body=document.createElement("div"); body.className="mwl-qc-body"; body.id="mwl-qc-body";
    overlay.appendChild(body);

    // Lightbox
    const lb=document.createElement("div"); lb.className="mwl-qc-lb"; lb.id="mwl-qc-lb";
    const lbInner=document.createElement("div"); lbInner.className="mwl-qc-lb-inner";
    const lbPrev=document.createElement("button"); lbPrev.className="mwl-qc-lb-nav mwl-qc-lb-prev"; lbPrev.innerHTML="‹";
    const lbNext=document.createElement("button"); lbNext.className="mwl-qc-lb-nav mwl-qc-lb-next"; lbNext.innerHTML="›";
    const lbX=document.createElement("button"); lbX.className="mwl-qc-lb-x"; lbX.innerHTML="×";
    const lbImg=document.createElement("img"); lbImg.className="mwl-qc-lb-img"; lbImg.alt="QC preview";
    [lbPrev,lbNext,lbX,lbImg].forEach(n=>lbInner.appendChild(n));
    lb.appendChild(lbInner);
    overlay.appendChild(lb);

    document.body.appendChild(overlay);
    document.body.style.overflow="hidden";

    // ── JS logic (runs in main page context — cookies work) ──
    const selectedVIDs=new Set();
    let overlayOn=false, brandOn=false, refsOn=false, refIndex=0;
    const RSK="mimo_qc_ref_index_v1";
    const refs=REFERENCES[brandKey]||[];

    function getRI(){try{const o=JSON.parse(localStorage.getItem(RSK)||"{}");const n=Number(o?.[brandKey]??0);return Number.isFinite(n)?n:0;}catch{return 0;}}
    function setRI(i){try{const o=JSON.parse(localStorage.getItem(RSK)||"{}");o[brandKey]=i;localStorage.setItem(RSK,JSON.stringify(o));}catch{}}
    function getARef(){if(!refs.length)return null;const i=((refIndex%refs.length)+refs.length)%refs.length;return{...refs[i],idx:i,total:refs.length};}

    function updateSelBtn(){
      const n=selectedVIDs.size;
      btnCopySel.style.opacity=n>0?"1":"0.55";
      btnCopySel.classList.toggle("has-sel",n>0);
      const cnt=document.getElementById("mwl-qc-selcount");
      if(cnt)cnt.textContent=n>0?"("+n+")":"";
      btnCopySel.title=n>0?"Copy "+n+" VID(s)":"Select VIDs to copy";
    }

    // Lightbox
    const NAV=[];
    function buildNav(){
      NAV.length=0;
      for(const vid of data.vids){
        const views=data.views.filter(v=>!(!brandOn&&v==="brand")&&data.map[vid][v]?.srcQC);
        for(const view of views) NAV.push({vid,view,src:data.map[vid][view].srcQC});
      }
    }
    let lbIdx=-1;
    function openLB(i){buildNav();if(!NAV.length)return;lbIdx=(i+NAV.length)%NAV.length;lbImg.src=NAV[lbIdx].src;lb.classList.add("open");lb.setAttribute("aria-hidden","false");}
    function closeLB(){lb.classList.remove("open");lb.setAttribute("aria-hidden","true");lbImg.src="";lbIdx=-1;}
    lbX.addEventListener("click",closeLB);
    lbPrev.addEventListener("click",()=>{if(lbIdx!==-1)openLB(lbIdx-1);});
    lbNext.addEventListener("click",()=>{if(lbIdx!==-1)openLB(lbIdx+1);});
    lb.addEventListener("click",e=>{if(e.target===lb)closeLB();});
    lbImg.addEventListener("click",()=>{if(lbIdx!==-1)openLB(lbIdx+1);});

    // Buttons
    function syncBtns(){
      btnGuides.classList.toggle("on",overlayOn);
      btnBrand.classList.toggle("on",brandOn);
      btnRefs.classList.toggle("on",refsOn);
      btnRefsClose.style.display=refsOn?"inline-flex":"none";
    }
    btnClose.addEventListener("click",()=>{closeQCOverlay();});
    btnGuides.addEventListener("click",()=>{overlayOn=!overlayOn;syncBtns();render();});
    btnBrand.addEventListener("click",()=>{brandOn=!brandOn;syncBtns();render();});
    btnRefs.addEventListener("click",()=>{
      if(!refs.length)return;
      if(!refsOn){refsOn=true;refIndex=getRI();}
      else{refIndex=(refIndex+1)%refs.length;setRI(refIndex);}
      syncBtns();render();
    });
    btnRefsClose.addEventListener("click",()=>{refsOn=false;syncBtns();render();});
    btnCopySel.addEventListener("click",()=>{
      if(!selectedVIDs.size)return;
      const txt=[...selectedVIDs].join("\n");
      try{navigator.clipboard.writeText(txt);}catch{
        const ta=document.createElement("textarea");ta.value=txt;ta.style.cssText="position:fixed;left:-9999px";
        document.body.appendChild(ta);ta.select();document.execCommand("copy");ta.remove();
      }
      btnCopySel.setAttribute("data-copied","1");
      setTimeout(()=>{btnCopySel.removeAttribute("data-copied");updateSelBtn();},1400);
    });

    // Keyboard
    function onKey(e){
      if(e.key==="Escape"){if(lb.classList.contains("open"))closeLB();else closeQCOverlay();e.preventDefault();return;}
      if(lb.classList.contains("open")){
        if(e.key==="ArrowLeft"&&lbIdx!==-1)openLB(lbIdx-1);
        if(e.key==="ArrowRight"&&lbIdx!==-1)openLB(lbIdx+1);
      }
      if(e.key==="g"||e.key==="G"){overlayOn=!overlayOn;syncBtns();render();}
    }
    overlay.addEventListener("keydown",onKey);
    // Also catch keydown on window while overlay is open
    function winKey(e){if(document.getElementById(QC_OVERLAY_ID))onKey(e);}
    window.addEventListener("keydown",winKey);
    // Clean up listener when overlay is removed
    const mo=new MutationObserver(()=>{if(!document.getElementById(QC_OVERLAY_ID)){window.removeEventListener("keydown",winKey);mo.disconnect();}});
    mo.observe(document.body,{childList:true});

    // Render
    function mkRef(aRef){
      const tile=document.createElement("div"); tile.className="mwl-qc-tile";
      const rw=document.createElement("div"); rw.className="mwl-qc-refwrap";
      const img=document.createElement("img"); img.loading="lazy";
      img.onerror=()=>{rw.style.cssText="height:293px;background:rgba(15,23,42,.04);display:flex;align-items:center;justify-content:center;padding:14px;color:rgba(15,23,42,.55);font:800 11px sans-serif;letter-spacing:.14em;text-transform:uppercase;";rw.textContent="Reference unavailable";};
      img.src=aRef.url; rw.appendChild(img); tile.appendChild(rw);
      const meta=document.createElement("div"); meta.className="mwl-qc-meta";
      meta.textContent="model reference · "+aRef.name+" ("+(aRef.idx+1)+"/"+aRef.total+")";
      tile.appendChild(meta); return tile;
    }

    function render(){
      const gridEl=document.getElementById("mwl-qc-body");
      while(gridEl.firstChild)gridEl.removeChild(gridEl.firstChild);
      buildNav();
      const aRef=refsOn?getARef():null;
      for(const vid of data.vids){
        const views=data.views.filter(v=>!(!brandOn&&v==="brand")&&data.map[vid][v]?.srcQC);
        if(!views.length)continue;
        const block=document.createElement("div"); block.className="mwl-qc-block";

        // VID header with checkbox
        const vidRow=document.createElement("div"); vidRow.className="mwl-qc-vidrow";
        const cb=document.createElement("input"); cb.type="checkbox"; cb.className="mwl-qc-vidcb";
        cb.checked=selectedVIDs.has(vid);
        cb.addEventListener("change",()=>{if(cb.checked)selectedVIDs.add(vid);else selectedVIDs.delete(vid);updateSelBtn();});
        const vidLabel=document.createElement("div"); vidLabel.className="mwl-qc-vidlabel"; vidLabel.textContent=vid;
        vidRow.appendChild(cb); vidRow.appendChild(vidLabel); block.appendChild(vidRow);

        const row=document.createElement("div"); row.className="mwl-qc-row";
        let refInserted=false;

        for(const view of views){
          const cell=data.map[vid][view]; if(!cell?.srcQC)continue;
          const tile=document.createElement("div"); tile.className="mwl-qc-tile";
          const iw=document.createElement("div"); iw.className="mwl-qc-imgwrap";
          const img=document.createElement("img"); img.loading="lazy"; img.src=cell.srcQC;
          iw.appendChild(img);

          // Guide overlay
          if(overlayOn&&OVERLAY_VIEWS.has(view)){
            const ov=document.createElement("img"); ov.className="ov"; ov.alt="";
            ov.src=OVERLAY_SP_URL; iw.appendChild(ov);
          }

          // Click to open lightbox
          const navIdx=NAV.findIndex(x=>x.vid===vid&&x.view===view);
          iw.addEventListener("click",()=>openLB(navIdx>=0?navIdx:0));
          tile.appendChild(iw);

          const meta=document.createElement("div"); meta.className="mwl-qc-meta";
          meta.textContent=view==="brand"?"brand image":view;
          tile.appendChild(meta); row.appendChild(tile);

          if(aRef&&!refInserted&&view==="ou"){refInserted=true;row.appendChild(mkRef(aRef));}
        }
        if(aRef&&!refInserted)row.appendChild(mkRef(aRef));
        if(row.children.length){block.appendChild(row);gridEl.appendChild(block);}
      }
    }

    refIndex=getRI(); syncBtns(); updateSelBtn(); render();
  }


  // ═══════════════════════════════════════
  // Styles
  // ═══════════════════════════════════════
  let stylesInjected=false;
  function ensureStyles(){
    if(stylesInjected)return; stylesInjected=true;
    GM_addStyle(`
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

      #mwl-panel {
        display: none;
        font-family: var(--mwl-font);
        font-size: 12px;
        color: var(--mwl-txt);
        background: linear-gradient(160deg, var(--mwl-bg), var(--mwl-bg2));
        border-radius: var(--mwl-r);
        margin: 0;
        /* z-index set inline by applyFixedGeometry / initFloatingPanel */
      }
      .MuiBox-root:has(#mwl-panel),
      .MuiPaper-root:has(#mwl-panel) {
        overflow: visible !important;
      }
      #mwl-panel.mwl-visible { display: block; }
      #mwl-panel.mwl-minimized .mwl-drawer,
      #mwl-panel.mwl-minimized .mwl-strip-bottom { display: none !important; }

      #mwl-panel.mwl-floating {
        box-shadow: 0 8px 32px rgba(0,0,0,0.45), 0 2px 8px rgba(0,0,0,0.28);
        border: 1px solid rgba(255,255,255,0.10);
        position: fixed !important;
      }
      #mwl-panel.mwl-floating .mwl-strip { cursor: grab; user-select: none; }
      #mwl-panel.mwl-floating .mwl-strip:active { cursor: grabbing; }

      #mwl-resize-handle {
        position: absolute;
        bottom: 0; right: 0;
        width: 16px; height: 16px;
        cursor: se-resize;
        z-index: 10;
        background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.15) 50%);
        border-radius: 0 0 var(--mwl-r) 0;
      }
      #mwl-resize-handle:hover {
        background: linear-gradient(135deg, transparent 50%, rgba(255,255,255,0.30) 50%);
      }

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

      .mwl-strip {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px;
        flex-wrap: nowrap;
        overflow-x: auto;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE/Edge */
      }
      .mwl-strip::-webkit-scrollbar { display: none; } /* Chrome/Safari */

      .mwl-dot {
        width: 6px; height: 6px; border-radius: 99px; flex: 0 0 6px;
        background: var(--mwl-amber);
        transition: background .3s ease;
      }

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
        margin-left: 4px;
      }

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
      /* label part — muted */
      #mwl-missing-pill .mwl-pill-label {
        font-weight: 700;
        opacity: 0.65;
        font-size: 9px;
        letter-spacing: .08em;
        text-transform: uppercase;
      }
      /* count part — prominent */
      #mwl-missing-pill .mwl-mc {
        font-weight: 900;
        font-size: 11px;
        color: inherit;
      }

      .mwl-kpi-inline {
        display: flex; align-items: center; gap: 4px; flex: 0 0 auto;
        width: 10ch;
      }
      .mwl-prog-sep {
        width: 1px; height: 11px; background: rgba(255,255,255,0.10); flex: 0 0 1px;
      }

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

      .mwl-dcols-2 { grid-template-columns: 1fr 1fr !important; }

      .mwl-pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 3px;
      }

      #mwl-next-btn {
        font-variant-numeric: tabular-nums;
        min-width: 0;
        white-space: nowrap;
        letter-spacing: .02em;
      }
      #mwl-next-btn { display: flex; align-items: center; justify-content: center; gap: 6px; }
      .mwl-next-label { flex: 0 0 auto; }
      .mwl-next-ptr {
        flex: 0 0 auto;
        font-variant-numeric: tabular-nums;
        opacity: 0.70;
        font-size: 9.5px;
        letter-spacing: .02em;
      }

      .mwl-pill-label { flex: 0 0 auto; }

      .mwl-prog, .mwl-prog-sep, .mwl-kpi-inline, #mwl-status-chip,
      #mwl-missing-pill, .mwl-strip-actions { flex-shrink: 0; }
      #mwl-missing-pill:hover { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.88); }
      #mwl-missing-pill.has-items {
        border-color: rgba(255,93,93,0.35);
        background: rgba(255,93,93,0.08);
        color: rgba(255,200,200,0.88);
      }
      #mwl-missing-pill.has-items:hover { background: rgba(255,93,93,0.14); }

      #mwl-status-chip {
        font-size: 9.5px; font-weight: 800; letter-spacing: .06em;
        white-space: nowrap; flex: 0 0 15ch;
        width: 15ch;
        color: var(--mwl-amber);
        transition: color .3s;
        display: inline-block;
        font-variant-numeric: tabular-nums;
        overflow: hidden;
        text-overflow: ellipsis;
      }

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

      /* [MOD 1] Load button */
      #mwl-loadall-btn { font-variant-numeric: tabular-nums; min-width: 2ch; }
      /* needs-run: shown at mount to prompt the user to click ⇣ first */
      #mwl-loadall-btn.needs-run {
        border-color: rgba(216,180,106,0.65) !important;
        background: rgba(216,180,106,0.14) !important;
        color: var(--mwl-gold) !important;
        box-shadow: 0 0 0 1px rgba(216,180,106,0.18);
      }
      /* is-loading: shown when scroll is in progress or variants still missing */
      #mwl-loadall-btn.is-loading-amber {
        border-color: rgba(255,204,102,0.70) !important;
        background: rgba(255,204,102,0.18) !important;
        color: #ffe066 !important;
        box-shadow: 0 0 0 1px rgba(255,204,102,0.22);
      }
      #mwl-loadall-btn.is-loading-red {
        border-color: rgba(255,80,80,0.80) !important;
        background: rgba(255,80,80,0.18) !important;
        color: #ff7070 !important;
        box-shadow: 0 0 0 1px rgba(255,80,80,0.22);
      }
      #mwl-loadall-btn:disabled { opacity: 0.70; }

      /* [MOD 2] Quality Check button — luxury gold outline */
      .mwl-abtn-qc {
        border-color: rgba(216,180,106,0.45) !important;
        color: var(--mwl-gold) !important;
        letter-spacing: .05em;
        font-size: 9.5px;
      }
      .mwl-abtn-qc:hover {
        background: rgba(216,180,106,0.10) !important;
        border-color: rgba(216,180,106,0.70) !important;
        color: #e8c97a !important;
      }

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

      #mwl-panel.mwl-minimized {
        background: rgba(255,255,255,0.96) !important;
        box-shadow: 0 1px 4px rgba(0,0,0,0.08) !important;
        border-radius: 8px !important;
        width: auto !important;
        margin-left: auto !important;
        display: block;
      }
      #mwl-panel.mwl-minimized #mwl-restore-bar {
        padding: 5px 12px;
        white-space: nowrap;
      }
      #mwl-panel.mwl-minimized .mwl-restore-label { color: rgba(0,0,0,0.38); }
      #mwl-panel.mwl-minimized .mwl-restore-chev  { color: rgba(0,0,0,0.22); }
      #mwl-panel.mwl-minimized:hover { box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important; }
      #mwl-panel.mwl-minimized #mwl-restore-bar:hover .mwl-restore-label { color: rgba(0,0,0,0.65); }

      .mwl-restore-label {
        font-size: 10px; font-weight: 800; letter-spacing: .10em; text-transform: uppercase;
        color: rgba(255,255,255,0.50);
      }
      .mwl-restore-chev { font-size: 11px; color: rgba(255,255,255,0.35); }
      #mwl-restore-bar:hover .mwl-restore-label { color: rgba(255,255,255,0.80); }

      .mwl-drawer {
        display: none;
        border-top: 1px solid rgba(255,255,255,0.06);
        padding: 9px 10px 10px;
      }
      .mwl-drawer.open { display: block; }

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

      .mwl-krow {
        display: flex; align-items: center; justify-content: space-between;
        font-size: 10px; color: var(--mwl-sub); padding: 1px 0;
      }
      .mwl-krow strong { font-weight: 900; color: rgba(255,255,255,0.82); }

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
      /* Copy All is a bulk action — less visual weight than Copy Missing */
      .mwl-dbtn.secondary {
        flex: 0 0 auto;
        font-size: 9px; letter-spacing: .06em;
        color: rgba(255,255,255,0.35);
        border-color: transparent;
        background: transparent;
      }
      .mwl-dbtn.secondary:hover { color: rgba(255,255,255,0.65); background: rgba(255,255,255,0.05); border-color: var(--mwl-brd2); }
      #mwl-focus-ptr { font-size: 9.5px; color: var(--mwl-dim); white-space: nowrap; margin-left: auto; padding-left: 4px; }

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

      /* Shortcut grid: 2-col key → description */
      .mwl-help-grid {
        display: grid;
        grid-template-columns: auto 1fr;
        gap: 5px 10px;
        align-items: center;
      }
      .mwl-help-grid kbd {
        display: inline-flex; align-items: center; justify-content: center;
        min-width: 22px; padding: 1px 5px;
        border: 1px solid rgba(255,255,255,0.20);
        border-bottom-width: 2px;
        border-radius: 4px;
        background: rgba(255,255,255,0.07);
        color: rgba(255,255,255,0.82);
        font: 800 10px var(--mwl-font);
        letter-spacing: .04em;
        font-family: inherit;
      }
      .mwl-help-grid span {
        font-size: 11px;
        color: rgba(255,255,255,0.60);
        line-height: 1.4;
      }

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
  // Geometry
  // ═══════════════════════════════════════
  let _fixedPlaceholder=null;
  let _resizeObserver=null;
  let _scrollHandler=null;

  const FLOAT_KEY="mwl_float_pos_v1";
  function loadFloatPos(){ try{ return JSON.parse(localStorage.getItem(FLOAT_KEY)||"null"); }catch{return null;} }
  function saveFloatPos(x,y,w){ try{ localStorage.setItem(FLOAT_KEY,JSON.stringify({x,y,w})); }catch{} }

  function getAppHeaderBottom(){
    let h=0;
    for(const el of document.querySelectorAll("header.MuiAppBar-root,header[class*='MuiAppBar']")){
      const s=getComputedStyle(el);
      if(s.position==="fixed"||s.position==="sticky") h=Math.max(h,el.getBoundingClientRect().bottom);
    }
    return h||56;
  }

  function applyFixedGeometry(panel,anchor){
    const ar=anchor.getBoundingClientRect();
    const headerBottom=getAppHeaderBottom();
    const top=Math.max(headerBottom+4, ar.bottom+4);
    panel.style.cssText=`
      position:fixed!important;
      top:${top}px!important;
      left:${ar.left}px!important;
      width:${ar.width}px!important;
      z-index:1250!important;
      margin:0!important;
      display:block;
    `;
    if(!_fixedPlaceholder){
      _fixedPlaceholder=document.createElement("div");
      _fixedPlaceholder.id="mwl-placeholder";
      _fixedPlaceholder.style.cssText="pointer-events:none;visibility:hidden;flex-shrink:0;";
    }
    _fixedPlaceholder.style.height=`${panel.offsetHeight+8}px`;
    if(!_fixedPlaceholder.parentNode)anchor.insertAdjacentElement("afterend",_fixedPlaceholder);
  }

  function startGeometrySync(panel,anchor){
    applyFixedGeometry(panel,anchor);
    _scrollHandler=()=>applyFixedGeometry(panel,anchor);
    if(_resizeObserver)_resizeObserver.disconnect();
    _resizeObserver=new ResizeObserver(()=>applyFixedGeometry(panel,anchor));
    _resizeObserver.observe(document.documentElement);
  }

  function stopGeometrySync(){
    _scrollHandler=null;
    if(_resizeObserver){_resizeObserver.disconnect();_resizeObserver=null;}
    if(_fixedPlaceholder){_fixedPlaceholder.remove();_fixedPlaceholder=null;}
    _floatListeners.forEach(({target,type,fn})=>target.removeEventListener(type,fn));
    _floatListeners=[];
  }

  let _floatListeners=[];
  function _addFloatListener(target,type,fn,opts){
    target.addEventListener(type,fn,opts);
    _floatListeners.push({target,type,fn});
  }

  function initFloatingPanel(panel){
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

    const onWinResize=()=>{
      const r=panel.getBoundingClientRect();
      applyPos(r.left,r.top,panel.offsetWidth);
    };
    _addFloatListener(window,"resize",onWinResize,{passive:true});
  }

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
    const all=document.querySelectorAll(`#${PANEL_ID}`);
    if(all.length>1){all.forEach(p=>{if(p!==panel)p.remove();});return false;}
    if(isSearchRoute())return panel.parentNode===document.body&&panel.classList.contains("mwl-floating");
    return panel.parentNode===document.body&&!!findAnchor();
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
      requestAnimationFrame(()=>{ if(mounted&&isSupportedRoute())mountPanel(panel); });
      return;
    }
    if(!document.body.contains(panel))document.body.appendChild(panel);
    panel.classList.remove("mwl-floating");
    applyFixedGeometry(panel,anchor);
    panel.classList.add("mwl-visible");
    startGeometrySync(panel,anchor);
  }

  // ═══════════════════════════════════════
  // Panel construction
  // ═══════════════════════════════════════
  function buildPanel(){
    ensureStyles();
    const panel=el("div",{id:PANEL_ID});

    const restoreBar=el("div",{id:"mwl-restore-bar",title:"Click to expand"},[
      el("span",{class:"mwl-restore-label"},["Dashboard — click to expand"]),
      el("span",{class:"mwl-restore-chev"},["▾"]),
    ]);
    restoreBar.addEventListener("click",()=>setMinimized(false));

    const strip=el("div",{class:"mwl-strip"},[
      el("span",{id:"mwl-status-chip"},["—"]),
      el("div",{class:"mwl-prog-sep"}),

      el("div",{class:"mwl-prog mwl-prog-clickable","data-action":"focusIn","data-ui-key":"focus:inToShoot",title:"Still Life to shoot — click to jump to next"},[
        el("span",{class:"mwl-dot mwl-dot-sl",id:"mwl-dot-sl"}),
        el("span",{class:"mwl-prog-lbl"},["Still Life"]),
        el("div",{class:"mwl-prog-bar"},[el("i",{id:"mwl-in-bar"})]),
        el("span",{class:"mwl-prog-pct",id:"mwl-in-pct"},["—"]),
        el("span",{class:"mwl-prog-num",id:"mwl-in-num"},["—"]),
      ]),

      el("div",{class:"mwl-prog-sep"}),

      el("div",{class:"mwl-prog mwl-prog-clickable","data-action":"focusOu","data-ui-key":"focus:ouToShoot",title:"Model to shoot — click to jump to next"},[
        el("span",{class:"mwl-dot mwl-dot-mo",id:"mwl-dot-mo"}),
        el("span",{class:"mwl-prog-lbl"},["Model"]),
        el("div",{class:"mwl-prog-bar"},[el("i",{id:"mwl-ou-bar"})]),
        el("span",{class:"mwl-prog-pct",id:"mwl-ou-pct"},["—"]),
        el("span",{class:"mwl-prog-num",id:"mwl-ou-num"},["—"]),
      ]),

      el("div",{class:"mwl-prog-sep"}),

      el("div",{id:"mwl-missing-pill","data-action":"next",title:"Missing — click to jump to next"},[
        el("span",{class:"mwl-pill-label"},["Missing "]),
        el("span",{class:"mwl-mc",id:"mwl-focus-missing"},["0"])
      ]),

      el("div",{class:"mwl-prog-sep"}),

      el("div",{class:"mwl-kpi-inline"},[
        el("span",{class:"mwl-kpi-lbl"},["RTW"]),
        el("span",{class:"mwl-kpi-val",id:"mwl-cat-rtw"},["0"]),
        el("span",{class:"mwl-kpi-dot"},["·"]),
        el("span",{class:"mwl-kpi-lbl"},["ACC"]),
        el("span",{class:"mwl-kpi-val",id:"mwl-cat-acc"},["0"]),
      ]),

      el("div",{class:"mwl-strip-actions"},[
        el("button",{class:"mwl-abtn","data-action":"loadAll",id:"mwl-loadall-btn",title:"Force load all — run this first (ESC cancels)"},["⇣"]),
        // [MOD 2] QC button with luxury gold styling and explicit label
        el("button",{class:"mwl-abtn mwl-abtn-qc","data-action":"qcOpen",title:"Open Quality Check Carousel"},["Quality Check"]),
        el("button",{id:"mwl-float-reset","data-action":"floatReset",title:"Reset panel position"},["⊹"]),
        el("button",{id:"mwl-expand-btn",title:"More"},["▾"]),
        el("button",{id:"mwl-min-btn",title:"Minimize"},["−"]),
      ]),
    ]);

    const drawer=el("div",{class:"mwl-drawer"},[
      el("div",{class:"mwl-dcols mwl-dcols-2"},[
        // Col 1 — Tags
        el("div",{class:"mwl-dcol"},[
          el("div",{class:"mwl-dcol-title"},["Tags"]),
          el("div",{class:"mwl-pill-row"},[
            el("div",{class:"mwl-pill","data-action":"tagfocus","data-tag":"IN ONLY","data-ui-key":"tag:IN ONLY"},["IN ONLY ",el("span",{class:"mwl-count",id:"mwl-tag-inonly"},["0"])]),
            el("div",{class:"mwl-pill","data-action":"tagfocus","data-tag":"OM ONLY","data-ui-key":"tag:OM ONLY"},["OM ONLY ",el("span",{class:"mwl-count",id:"mwl-tag-omonly"},["0"])]),
            el("div",{class:"mwl-pill","data-action":"tagfocus","data-tag":"MODEL SIZE UNAVAILABLE","data-ui-key":"tag:MODEL SIZE UNAVAILABLE"},["MODEL SIZE ",el("span",{class:"mwl-count",id:"mwl-tag-modelsize"},["0"])]),
          ]),
        ]),
        // Col 2 — Focus (with [MOD 5] No shots pill)
        el("div",{class:"mwl-dcol"},[
          el("div",{class:"mwl-dcol-title"},["Focus"]),
          el("div",{class:"mwl-pill-row"},[
            el("div",{class:"mwl-pill","data-action":"setfocus","data-focus":"rtwVideoMissing","data-ui-key":"focus:rtwVideoMissing"},["RTW VIDEO ",el("span",{class:"mwl-count",id:"mwl-focus-rtwvideo"},["0"])]),
            el("div",{class:"mwl-pill","data-action":"setfocus","data-focus":"rejected","data-ui-key":"focus:rejected"},["Rejected ",el("span",{class:"mwl-count",id:"mwl-focus-rej"},["0"])]),
            // [MOD 5] No shots uploaded pill — navigable focus
            el("div",{class:"mwl-pill","data-action":"setfocus","data-focus":"noShots","data-ui-key":"focus:noShots",title:"VIDs with slots defined but zero shots uploaded — click to jump, Shift+click to copy"},[
              "VID without shots ",
              el("span",{class:"mwl-count",id:"mwl-focus-noshots"},["0"])
            ]),
          ]),
        ]),
      ]),
      el("div",{class:"mwl-dfooter"},[
        el("div",{class:"mwl-dbtn gold","data-action":"next",id:"mwl-next-btn"},[
          el("span",{class:"mwl-next-label"},["Next ↓"]),
          el("span",{class:"mwl-next-ptr",id:"mwl-next-ptr"},["0 / 0"]),
        ]),
        el("div",{class:"mwl-dbtn","data-action":"copyMissing"},["Copy Missing"]),
        el("div",{class:"mwl-dbtn secondary","data-action":"copyAll"},["Copy All"]),
      ]),
    ]);

    const helpOv=el("div",{class:"mwl-overlay",id:"mwl-help"},[
      el("div",{class:"mwl-ov-head"},[
        el("span",{class:"mwl-ov-title"},["Keyboard shortcuts"]),
        el("button",{class:"mwl-obtn","data-action":"closeHelp"},["Close"]),
      ]),
      el("div",{class:"mwl-ov-box"},[
        el("div",{class:"mwl-help-grid"},[
          el("kbd",{},"N"), el("span",{},"Next item"),
          el("kbd",{},"A"), el("span",{},"Copy all VIDs"),
          el("kbd",{},"Q"), el("span",{},"Open Quality Check"),
          el("kbd",{},"H"), el("span",{},"Toggle this panel"),
          el("kbd",{},"Esc"), el("span",{},"Stop Load All"),
        ]),
      ]),
    ]);

    panel.appendChild(restoreBar);
    panel.appendChild(strip);
    panel.appendChild(drawer);
    panel.appendChild(helpOv);

    strip.querySelector("#mwl-expand-btn").addEventListener("click",()=>setDrawerOpen(!bannerExpanded));
    strip.querySelector("#mwl-min-btn").addEventListener("click",()=>setMinimized(true));

    panel.addEventListener("click",async(e)=>{
      const aEl=e.target.closest("[data-action]"); if(!aEl)return;
      const action=aEl.getAttribute("data-action");

      if(action==="loadAll"){
        const btn=aEl;
        btn.dataset.ran="1";
        btn.disabled=true;
        btn.innerHTML="⇣ 0%";
        btn.style.cssText="";
        try{
          toast("Load All: scrolling… (ESC stop)");
          await window.MadameUtils.forceLoadAllBalanced({maxLoops:900,onProgress:({percent})=>{btn.innerHTML="⇣ "+percent+"%";}});
          toast("Load All: done.");
        }
        catch{ bumpErr("load_all"); toast("Load All: failed."); }
        finally{
          btn.disabled=false;
          btn.innerHTML="⇣";
          btn.style.cssText=""; // neutral — updateLoadChip will keep it neutral since ran=1
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
        if(focus.type==="inToShoot"){ goNext(true); return; }
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
        const nf={missing:{type:"missing",value:""},inToShoot:{type:"inToShoot",value:""},ouToShoot:{type:"ouToShoot",value:""},rtwVideoMissing:{type:"rtwVideoMissing",value:""},rejected:{type:"rejected",value:""},noShots:{type:"noShots",value:""}}[f]||{type:"missing",value:""};
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
  // ensurePanel
  // ═══════════════════════════════════════
  function ensurePanel(){
    if(document.getElementById(PANEL_ID))return document.getElementById(PANEL_ID);
    loadEngineState(); loadActiveUIKey();
    const panel=buildPanel();
    return panel;
  }

  // ═══════════════════════════════════════
  // updateCounts
  // ═══════════════════════════════════════
  function setEl(id,v){ document.querySelectorAll(`#${id}`).forEach(n=>{n.textContent=v;}); }
  function setW(id,w){ document.querySelectorAll(`#${id}`).forEach(n=>{n.style.width=w;}); }

  function updateLoadChip(loaded,totalVariants){
    const btn=document.getElementById("mwl-loadall-btn"); if(!btn)return;
    const chip=document.getElementById("mwl-loadchip"); if(chip)chip.style.display="none";
    if(btn.disabled)return;
    // After first click — always neutral, no color states
    if(btn.dataset.ran){
      btn.innerHTML="⇣";
      btn.style.cssText="";
      btn.title="Force load all (ESC cancels)";
      return;
    }
    // Before first click — luxury gold START
    btn.innerHTML="START ⇣";
    btn.style.cssText="border-radius:6px;padding:3px 10px;font-size:10px;font-weight:800;letter-spacing:.10em;text-transform:uppercase;cursor:pointer;white-space:nowrap;line-height:1.5;border:1px solid;display:inline-flex;align-items:center;gap:5px;border-color:rgba(216,180,106,0.70);background:rgba(216,180,106,0.12);color:#d8b46a;";
    btn.title="Run Load All first to ensure all variants are visible";
  }

  function updateDot(overallPct){
    const dot=document.getElementById("mwl-dot"); if(dot){const {bg}=trafficColor(overallPct);dot.style.background=bg;}
  }
  function updateProgDot(id,pctVal){
    const d=document.getElementById(id); if(!d)return;
    const {bg}=trafficColor(pctVal); d.style.background=bg;
  }

  function updateCounts(forceResetPointer=false){
    if(!isSupportedRoute())return;
    _countsDirty=false;

    const panel=ensurePanel();
    mountPanel(panel);
    if(!panel.classList.contains("mwl-visible"))return;

    const flags=loadFlags();

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
        setW("mwl-in-bar",`${inP}%`); setW("mwl-ou-bar",`${ouP}%`);
        setEl("mwl-in-pct",`${inP}%`); setEl("mwl-ou-pct",`${ouP}%`);
        setEl("mwl-in-num",`${inShot}/${totalIN}`); setEl("mwl-ou-num",`${ouShot}/${totalOU}`);
        updateProgDot("mwl-dot-sl",inP); updateProgDot("mwl-dot-mo",ouP);
      } else {
        setW("mwl-in-bar","0%"); setW("mwl-ou-bar","0%");
        setEl("mwl-in-pct","—"); setEl("mwl-ou-pct","—");
        setEl("mwl-in-num",`${n} VIDs`); setEl("mwl-ou-num","—");
      }

      const missingCount=analyses.filter(x=>isMissing(x.a)).length||n;
      setEl("mwl-focus-missing",String(missingCount));
      setEl("mwl-focus-rtwvideo","0"); setEl("mwl-focus-rej","0");
      setEl("mwl-focus-noshots","0"); // [MOD 5]
      setEl("mwl-tag-inonly","0"); setEl("mwl-tag-omonly","0"); setEl("mwl-tag-modelsize","0");
      setEl("mwl-cat-rtw","0"); setEl("mwl-cat-acc","0");
      setEl("mwl-status-chip",`${n} VIDs`);
      const sc=document.getElementById("mwl-status-chip"); if(sc)sc.style.color="rgba(255,255,255,0.55)";
      updateLoadChip(n,null);

      focusList=analyses.filter(x=>isMissing(x.a));
      if(!focusList.length)focusList=lastAnalyses.slice();
      if(forceResetPointer)focusPtr=0; if(focusPtr>=focusList.length)focusPtr=0;
      if(lastHighlightedEl&&!lastHighlightedEl.isConnected)clearHighlight();

      ensureMadameUtils()._lastProducts=products;
      ensureMadameUtils()._totalVariants=null;

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

    // [MOD 5] Count VIDs with zero shots in any defined slot
    const noShotsCount=analyses.filter(x=>hasTotallyNoShots(x.a)).length;

    setW("mwl-in-bar",`${inP}%`); setW("mwl-ou-bar",`${ouP}%`);
    setEl("mwl-in-pct",`${inP}%`); setEl("mwl-ou-pct",`${ouP}%`);
    setEl("mwl-in-num",`${inShot}/${totalIN||0}`); setEl("mwl-ou-num",`${ouShot}/${totalOU||0}`);

    const {bg,text}=trafficColor(overallP);
    setEl("mwl-status-chip",`${text} · ${overallP}%`);
    const sc=document.getElementById("mwl-status-chip"); if(sc)sc.style.color=bg;
    updateDot(overallP);
    updateProgDot("mwl-dot-sl", inP);
    updateProgDot("mwl-dot-mo", ouP);

    setEl("mwl-focus-missing",String(missingCount));
    setEl("mwl-cat-rtw",String(catRTW)); setEl("mwl-cat-acc",String(catACC));
    const rtwV=flags.enableRTWVideoKPI?String(rtwMissing):"0", rejV=flags.enableRejectedKPI?String(rejectedLoaded):"0";
    setEl("mwl-focus-rtwvideo",rtwV); setEl("mwl-focus-rej",rejV);
    setEl("mwl-focus-noshots",String(noShotsCount)); // [MOD 5]

    setEl("mwl-tag-inonly",String(tagCounts["IN ONLY"]||0));
    setEl("mwl-tag-omonly",String(tagCounts["OM ONLY"]||0));
    setEl("mwl-tag-modelsize",String(tagCounts["MODEL SIZE UNAVAILABLE"]||0));

    focusList=buildFocusList(analyses);
    if(forceResetPointer)focusPtr=0; if(focusPtr>=focusList.length)focusPtr=0;
    if(lastHighlightedEl&&!lastHighlightedEl.isConnected)clearHighlight();
    updateMissingPill();

    const panel2=document.getElementById(PANEL_ID); if(panel2){
      qsa(".mwl-pill[data-focus]",panel2).forEach(p=>{
        const c=p.querySelector(".mwl-count"); const v=c?parseInt((c.textContent||"0"),10):NaN;
        p.classList.toggle("is-alert",Number.isFinite(v)&&v>0);
      });
    }

    applyActiveStyles();

    lastKPIs={loaded,totalVariants,totalIN,totalOU,inShot,ouShot,inToShoot,ouToShoot,inP,ouP,catRTW,catACC,rtwTotal,rtwWithVideo,rtwMissing,rejectedLoaded,noShotsCount};

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
    const s=document.querySelector('div.MuiBox-root[style*="overflow: auto"]');
    if(s&&s.clientHeight>200)return s;
    return document.body;
  }

  let _scrollRafId=null;
  function _onScroll(){
    if(_scrollRafId)return;
    _scrollRafId=requestAnimationFrame(()=>{
      _scrollRafId=null;
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
    ensureStyles();
    const panel=ensurePanel();
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

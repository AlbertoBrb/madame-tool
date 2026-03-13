// ==UserScript==
// @name         Madame Message Center
// @namespace    https://tampermonkey.net/
// @version      1.1.0
// @description  Central message system for Madame Tools
// @author       You
// @match        https://madame.ynap.biz/*
// @grant        GM_addStyle
// @run-at       document-idle
// ==/UserScript==

(() => {
  "use strict";

  const GLOBAL_KEY = "__MADAME_MESSAGE_CENTER__";
  if (window[GLOBAL_KEY]) return;
  window[GLOBAL_KEY] = { startedAt: Date.now(), version: "1.1.0" };

  const MESSAGE_URL = "https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-message.json";
  const SEEN_KEY = "madame_message_center_seen_v1";
  const STYLE_ID = "madame-message-center-style";

  let autoCloseTimer = null;

  function addStyle(cssText) {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = cssText;
    document.head.appendChild(style);
  }

  function safeJsonParse(str, fallback = null) {
    try {
      return JSON.parse(str);
    } catch {
      return fallback;
    }
  }

  async function loadRemoteMessageData() {
    try {
      const res = await fetch(`${MESSAGE_URL}?t=${Date.now()}`, {
        cache: "no-store"
      });

      if (!res.ok) return null;

      const data = await res.json();
      return data && typeof data === "object" ? data : null;
    } catch (err) {
      console.warn("[Madame Message Center] load failed", err);
      return null;
    }
  }

  function normalizeMessages(data) {
    if (!data || typeof data !== "object") return [];

    if (Array.isArray(data.messages)) {
      return data.filter ? data.messages.filter(Boolean) : data.messages;
    }

    if (data.id || data.message || data.title) {
      return [data];
    }

    return [];
  }

  function loadSeenMap() {
    return safeJsonParse(localStorage.getItem(SEEN_KEY), {}) || {};
  }

  function hasSeen(id) {
    try {
      const seen = loadSeenMap();
      return !!seen[id];
    } catch {
      return false;
    }
  }

  function markSeen(id) {
    try {
      const seen = loadSeenMap();
      seen[id] = Date.now();
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    } catch {}
  }

  function pageMatches(pages) {
    if (!Array.isArray(pages) || pages.length === 0) return true;
    if (pages.includes("*")) return true;

    const path = window.location.pathname;

    return pages.some((p) => {
      const rule = String(p || "").trim();
      if (!rule) return false;
      if (rule === path) return true;
      if (rule.endsWith("*")) return path.startsWith(rule.slice(0, -1));
      return false;
    });
  }

  function isWithinDateWindow(msg) {
    const now = Date.now();

    if (msg.start) {
      const start = new Date(msg.start).getTime();
      if (!Number.isNaN(start) && now < start) return false;
    }

    if (msg.end) {
      const end = new Date(msg.end).getTime();
      if (!Number.isNaN(end) && now > end) return false;
    }

    return true;
  }

  function ensureStyles() {
    addStyle(`
      #madame-message-center {
        position: fixed;
        top: 18px;
        right: 18px;
        z-index: 999999;
        width: 360px;
        max-width: calc(100vw - 32px);
        background: rgba(18,18,22,0.96);
        color: rgba(255,255,255,0.94);
        border: 1px solid rgba(255,255,255,0.14);
        border-radius: 14px;
        box-shadow: 0 16px 50px rgba(0,0,0,0.35);
        backdrop-filter: blur(10px);
        font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
        overflow: hidden;
        transform: translateY(-8px);
        opacity: 0;
        transition: opacity .18s ease, transform .18s ease;
      }

      #madame-message-center.show {
        opacity: 1;
        transform: translateY(0);
      }

      #madame-message-center .mmc-head {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 10px;
        padding: 12px 14px 8px;
      }

      #madame-message-center .mmc-title {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: .08em;
        text-transform: uppercase;
      }

      #madame-message-center .mmc-close {
        border: 1px solid rgba(255,255,255,0.14);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.88);
        border-radius: 10px;
        padding: 4px 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 800;
      }

      #madame-message-center .mmc-close:hover {
        background: rgba(255,255,255,0.10);
      }

      #madame-message-center .mmc-body {
        padding: 0 14px 14px;
        font-size: 13px;
        line-height: 1.45;
        color: rgba(255,255,255,0.88);
        white-space: pre-wrap;
      }

      #madame-message-center .mmc-link {
        display: inline-block;
        margin-top: 10px;
        color: #d8b46a;
        text-decoration: none;
        font-weight: 700;
      }

      #madame-message-center .mmc-link:hover {
        text-decoration: underline;
      }

      #madame-message-center[data-type="info"] {
        border-color: rgba(255,255,255,0.14);
      }

      #madame-message-center[data-type="warning"] {
        border-color: rgba(255,204,102,0.32);
        box-shadow: 0 16px 50px rgba(255,204,102,0.10);
      }

      #madame-message-center[data-type="error"] {
        border-color: rgba(255,93,93,0.32);
        box-shadow: 0 16px 50px rgba(255,93,93,0.12);
      }
    `);
  }

  function removeBanner() {
    const old = document.getElementById("madame-message-center");
    if (!old) return;

    if (autoCloseTimer) {
      clearTimeout(autoCloseTimer);
      autoCloseTimer = null;
    }

    old.classList.remove("show");
    setTimeout(() => old.remove(), 180);
  }

  function showBanner(msg) {
    removeBanner();
    ensureStyles();

    const wrap = document.createElement("div");
    wrap.id = "madame-message-center";
    wrap.setAttribute("data-type", String(msg.type || "info").toLowerCase());

    const head = document.createElement("div");
    head.className = "mmc-head";

    const title = document.createElement("div");
    title.className = "mmc-title";
    title.textContent = String(msg.title || "Madame Tools");

    const close = document.createElement("button");
    close.className = "mmc-close";
    close.type = "button";
    close.textContent = "Close";
    close.addEventListener("click", removeBanner);

    head.appendChild(title);
    head.appendChild(close);

    const body = document.createElement("div");
    body.className = "mmc-body";
    body.textContent = String(msg.message || "");

    if (msg.link) {
      const link = document.createElement("a");
      link.className = "mmc-link";
      link.href = String(msg.link);
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open";
      body.appendChild(document.createElement("br"));
      body.appendChild(link);
    }

    wrap.appendChild(head);
    wrap.appendChild(body);

    document.body.appendChild(wrap);
    requestAnimationFrame(() => wrap.classList.add("show"));

    const autoClose = Number(msg.autoClose);
    if (Number.isFinite(autoClose) && autoClose > 0) {
      autoCloseTimer = setTimeout(removeBanner, autoClose);
    }
  }

  async function checkMessages() {
    const data = await loadRemoteMessageData();
    const messages = normalizeMessages(data);
    if (!messages.length) return;

    for (const msg of messages) {
      if (!msg || typeof msg !== "object") continue;
      if (!msg.enabled) continue;

      const id = String(msg.id || "").trim();
      if (!id) continue;

      if (!pageMatches(msg.pages)) continue;
      if (!isWithinDateWindow(msg)) continue;

      const showOnce = !!msg.showOnce;
      if (showOnce && hasSeen(id)) continue;

      showBanner(msg);

      if (showOnce) {
        markSeen(id);
      }

      break;
    }
  }

  function init() {
    if (!document.body) {
      setTimeout(init, 300);
      return;
    }

    checkMessages();
  }

  init();
})();

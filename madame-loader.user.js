// ==UserScript==
// @name         Madame Tool Loader
// @namespace    https://github.com/AlbertoBrb
// @version      1.0.0
// @description  Loader remoto per Madame Tool con aggiornamento centralizzato
// @match        https://madame.ynap.biz/*
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      raw.githubusercontent.com
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-loader.user.js
// @updateURL    https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-loader.user.js
// ==/UserScript==

(function () {
  "use strict";

  const REMOTE_SCRIPT_URL = "https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-app.js";

  function injectCode(code) {
    const s = document.createElement("script");
    s.textContent = code;
    document.documentElement.appendChild(s);
    s.remove();
  }

  GM_xmlhttpRequest({
    method: "GET",
    url: REMOTE_SCRIPT_URL,
    nocache: true,
    onload: function (response) {
      if (response.status >= 200 && response.status < 300 && response.responseText) {
        injectCode(response.responseText);
      } else {
        console.error("Madame Tool Loader: download failed", response.status);
      }
    },
    onerror: function (err) {
      console.error("Madame Tool Loader: request error", err);
    }
  });
})();

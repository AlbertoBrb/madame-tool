// ==UserScript==
// @name         Madame Search Helper
// @namespace    https://github.com/AlbertoBrb
// @version      1.0.0
// @description  Search tools
// @match        https://madame.ynap.biz/search*
// @grant        GM_addStyle
// @run-at       document-idle
// @downloadURL  https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-search.user.js
// @updateURL    https://raw.githubusercontent.com/AlbertoBrb/madame-tool/main/madame-search.user.js
// ==UserScript==
// @name         Madame Channel Helper + Auto Search Fallback
// @namespace    custom-madame
// @version      1.0.0
// @description  Header/favicons per channel, click-to-toggle MRP/NAP e fallback automatico della Search sul channel opposto.
// @match        https://madame.ynap.biz/*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    debug: true,

    selectors: {
      appHeader: 'header.MuiAppBar-root',
      channelIdentifier: '#tool-channel',
      userInitialsButton: 'div.MuiToolbar-root > button:last-of-type',
      channelHiddenInput: 'input[name="channel"]',
      settingsModalConfirmButton: '#settings-confirm-button',

      searchTextarea: '#search-by-id',
      emptyResults: '[data-testid="emptyResultsContainer"]',
      searchButtons: 'button',
      numericHeadings: 'h4',
    },

    channels: {
      MRP: 'Mr Porter',
      NAP: 'Net-A-Porter',
    },

    colors: {
      mrPorter: '#607d8b',
      netAPorter: '#8a8169',
    },

    favicons: {
      mrPorter: 'https://i.ibb.co/NgwChY8C/mrpmadame.png',
      netAPorter: 'https://i.ibb.co/Gv9jyLhy/napmadame.png',
    },

    storage: {
      pendingQuery: 'madame_helper_pending_query',
      retryFlag: 'madame_helper_retry_flag',
    },

    invisibleModalStyle: `
      .MuiDialog-root, .MuiBackdrop-root {
        opacity: 0 !important;
        transition: none !important;
      }
    `,

    timeouts: {
      waitDom: 7000,
      waitSearchOutcome: 5000,
      waitChannelChange: 5000,
      waitTextareaReady: 7000,
      waitSearchButtonReady: 7000,
      waitRouteChange: 7000,
    }
  };

  const STATE = {
    isToggling: false,
    handlingSearch: false,
    suppressNextClick: false,
    lastKnownChannel: '',
    lastRetriedQuery: '',
  };

  function log(...args) {
    if (CONFIG.debug) {
      console.log('[Madame Helper]', ...args);
    }
  }

  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  function simulateClick(element) {
    if (!element) return;
    const init = { bubbles: true, cancelable: true, view: window };
    element.dispatchEvent(new MouseEvent('mousedown', init));
    element.dispatchEvent(new MouseEvent('mouseup', init));
    element.dispatchEvent(new MouseEvent('click', init));
  }

  async function waitForCondition(checkFn, timeout = CONFIG.timeouts.waitDom, interval = 120) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        const result = checkFn();
        if (result) return result;
      } catch (_) {}
      await delay(interval);
    }
    return null;
  }

  async function waitForElement(selector, timeout = CONFIG.timeouts.waitDom) {
    return waitForCondition(() => document.querySelector(selector), timeout);
  }

  const channelManager = {
    getCurrentChannelText() {
      return document.querySelector(CONFIG.selectors.channelIdentifier)?.textContent.trim() || '';
    },

    getOppositeChannelValue() {
      return this.getCurrentChannelText() === CONFIG.channels.MRP ? 'NAP' : 'MRP';
    },

    async waitForChannelTextChange(previousText, timeout = CONFIG.timeouts.waitChannelChange) {
      return waitForCondition(() => {
        const current = this.getCurrentChannelText();
        return current && current !== previousText ? current : null;
      }, timeout, 120);
    },

    async switchChannel(targetValue) {
      if (STATE.isToggling) return false;
      STATE.isToggling = true;

      const previousChannel = this.getCurrentChannelText();
      const tempStyle = document.createElement('style');
      tempStyle.textContent = CONFIG.invisibleModalStyle;
      document.head.appendChild(tempStyle);

      try {
        log('Switching channel from', previousChannel, 'to', targetValue);

        const userButton = await waitForElement(CONFIG.selectors.userInitialsButton);
        if (!userButton) throw new Error('User button not found');
        simulateClick(userButton);

        const hiddenInput = await waitForElement(CONFIG.selectors.channelHiddenInput);
        if (!hiddenInput) throw new Error('Channel hidden input not found');

        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (!setter) throw new Error('Input setter not found');

        setter.call(hiddenInput, targetValue);
        hiddenInput.dispatchEvent(new Event('input', { bubbles: true }));
        hiddenInput.dispatchEvent(new Event('change', { bubbles: true }));

        const confirmButton = await waitForElement(CONFIG.selectors.settingsModalConfirmButton);
        if (!confirmButton) throw new Error('Settings confirm button not found');
        simulateClick(confirmButton);

        const changed = await this.waitForChannelTextChange(previousChannel);
        if (!changed) throw new Error('Channel text did not change');

        log('Channel changed to', changed);
        return true;
      } catch (err) {
        console.error('[Madame Helper] switchChannel failed:', err);
        return false;
      } finally {
        tempStyle.remove();
        STATE.isToggling = false;
      }
    }
  };

  const channelUi = {
    updateHeaderStyle(header, currentChannelText) {
      const isMrPorter = currentChannelText === CONFIG.channels.MRP;
      const targetColor = isMrPorter ? CONFIG.colors.mrPorter : CONFIG.colors.netAPorter;
      header.style.setProperty('background-color', targetColor, 'important');
      header.style.transition = 'background-color 0.5s ease';
    },

    updateFavicon(currentChannelText) {
      const isMrPorter = currentChannelText === CONFIG.channels.MRP;
      const targetFaviconUrl = isMrPorter ? CONFIG.favicons.mrPorter : CONFIG.favicons.netAPorter;

      let link = document.querySelector("link[rel~='icon']");
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }

      if (link.href !== targetFaviconUrl) {
        link.href = targetFaviconUrl;
      }
    },

    initializeChannelToggle(channelDisplay) {
      if (!channelDisplay || channelDisplay.dataset.toggleInitialized) return;

      channelDisplay.dataset.toggleInitialized = 'true';

      Object.assign(channelDisplay.style, {
        cursor: 'pointer',
        transition: 'background-color 0.2s ease-in-out',
        borderRadius: '4px',
        padding: '2px 6px',
        margin: '0 2px',
      });

      channelDisplay.addEventListener('mouseover', () => {
        channelDisplay.style.backgroundColor = 'rgba(255, 255, 255, 0.1)';
      });

      channelDisplay.addEventListener('mouseout', () => {
        channelDisplay.style.backgroundColor = '';
      });

      channelDisplay.addEventListener('click', async (e) => {
        e.preventDefault();
        const currentChannel = channelDisplay.textContent.trim();
        const targetValue = currentChannel === CONFIG.channels.MRP ? 'NAP' : 'MRP';
        await channelManager.switchChannel(targetValue);
      });
    },

    async applyEnhancements() {
      const header = await waitForElement(CONFIG.selectors.appHeader);
      const channelDisplay = await waitForElement(CONFIG.selectors.channelIdentifier);
      if (!header || !channelDisplay) return;

      const currentChannelText = channelDisplay.textContent.trim();
      this.updateHeaderStyle(header, currentChannelText);
      this.updateFavicon(currentChannelText);
      this.initializeChannelToggle(channelDisplay);
    },

    observeChannelChanges() {
      const obs = new MutationObserver(() => {
        const current = channelManager.getCurrentChannelText();
        if (!current) {
          STATE.lastKnownChannel = '';
          return;
        }
        if (current !== STATE.lastKnownChannel) {
          STATE.lastKnownChannel = current;
          this.applyEnhancements();
        }
      });

      obs.observe(document.body, { childList: true, subtree: true });
    },

    start() {
      this.applyEnhancements();
      this.observeChannelChanges();
    }
  };

  const searchFallback = {
    isSearchPage() {
      return location.pathname.startsWith('/search');
    },

    getSearchTextarea() {
      return document.querySelector(CONFIG.selectors.searchTextarea);
    },

    normalizeQuery(value) {
      return (value || '')
        .split(/[\s,;\n\r\t]+/)
        .map(v => v.trim())
        .filter(Boolean)
        .join(' ');
    },

    getCurrentQuery() {
      return this.normalizeQuery(this.getSearchTextarea()?.value || '');
    },

    hasEmptyResults() {
      return !!document.querySelector(CONFIG.selectors.emptyResults);
    },

    hasNumericResults() {
      return [...document.querySelectorAll(CONFIG.selectors.numericHeadings)]
        .some(h => /^\d{10,19}$/.test((h.textContent || '').trim()));
    },

    savePendingQuery(query) {
      sessionStorage.setItem(CONFIG.storage.pendingQuery, query);
    },

    getPendingQuery() {
      return sessionStorage.getItem(CONFIG.storage.pendingQuery) || '';
    },

    clearPendingQuery() {
      sessionStorage.removeItem(CONFIG.storage.pendingQuery);
      sessionStorage.removeItem(CONFIG.storage.retryFlag);
    },

    setRetryFlag() {
      sessionStorage.setItem(CONFIG.storage.retryFlag, '1');
    },

    hasRetryFlag() {
      return sessionStorage.getItem(CONFIG.storage.retryFlag) === '1';
    },

    async waitForSearchOutcome(timeout = CONFIG.timeouts.waitSearchOutcome) {
      return waitForCondition(() => {
        if (this.hasNumericResults()) return 'results';
        if (this.hasEmptyResults()) return 'empty';
        return null;
      }, timeout, 120);
    },

    async ensureSearchRoute() {
      if (this.isSearchPage()) return true;

      log('Redirecting to /search');
      location.assign('/search');

      const ok = await waitForCondition(
        () => location.pathname.startsWith('/search'),
        CONFIG.timeouts.waitRouteChange,
        150
      );

      return !!ok;
    },

    findActiveSearchButton() {
      return [...document.querySelectorAll(CONFIG.selectors.searchButtons)]
        .find(btn => btn.textContent.trim() === 'Search' && !btn.disabled);
    },

    async waitForSearchButtonReady(timeout = CONFIG.timeouts.waitSearchButtonReady) {
      return waitForCondition(() => this.findActiveSearchButton(), timeout, 120);
    },

    restoreQueryIntoTextarea(query) {
      const textarea = this.getSearchTextarea();
      if (!textarea) return false;

      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
      if (setter) setter.call(textarea, query);
      else textarea.value = query;

      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.dispatchEvent(new Event('change', { bubbles: true }));

      return this.normalizeQuery(textarea.value) === this.normalizeQuery(query);
    },

    async waitAndRestoreQuery(query, timeout = CONFIG.timeouts.waitTextareaReady) {
      const restored = await waitForCondition(() => {
        const textarea = this.getSearchTextarea();
        if (!textarea) return false;
        return this.restoreQueryIntoTextarea(query) ? textarea : null;
      }, timeout, 150);

      return !!restored;
    },

    async triggerSearchAgain(query) {
      const searchPageReady = await this.ensureSearchRoute();
      if (!searchPageReady) {
        log('Could not reach /search');
        return false;
      }

      const restored = await this.waitAndRestoreQuery(query);
      if (!restored) {
        log('Could not restore query');
        return false;
      }

      const searchBtn = await this.waitForSearchButtonReady();
      if (!searchBtn) {
        log('Search button not ready');
        return false;
      }

      log('Triggering search again with query:', query);

      STATE.suppressNextClick = true;
      simulateClick(searchBtn);

      setTimeout(() => {
        STATE.suppressNextClick = false;
      }, 500);

      return true;
    },

    async retryPendingSearchIfNeeded() {
      if (!this.hasRetryFlag()) return;

      const pendingQuery = this.getPendingQuery();
      if (!pendingQuery) {
        this.clearPendingQuery();
        return;
      }

      log('Retrying pending query:', pendingQuery);

      const ok = await this.triggerSearchAgain(pendingQuery);
      if (!ok) {
        log('Pending retry failed');
        return;
      }

      const outcome = await this.waitForSearchOutcome();
      log('Pending retry outcome:', outcome || 'unknown');

      this.clearPendingQuery();
    },

    async processSearchResult(initialQuery) {
      if (!initialQuery || STATE.handlingSearch) return;

      STATE.handlingSearch = true;

      try {
        log('Processing search query:', initialQuery);

        const outcome = await this.waitForSearchOutcome();
        log('Initial outcome:', outcome || 'none');

        if (outcome === 'results') {
          this.clearPendingQuery();
          STATE.lastRetriedQuery = '';
          return;
        }

        if (outcome !== 'empty') {
          log('No empty state found');
          return;
        }

        if (STATE.lastRetriedQuery === initialQuery) {
          log('Already retried this query once');
          return;
        }

        STATE.lastRetriedQuery = initialQuery;

        this.savePendingQuery(initialQuery);
        this.setRetryFlag();

        const targetChannel = channelManager.getOppositeChannelValue();
        const switched = await channelManager.switchChannel(targetChannel);

        if (!switched) {
          this.clearPendingQuery();
          return;
        }

        const retriggered = await this.triggerSearchAgain(initialQuery);
        if (!retriggered) {
          log('Could not retrigger search after switch');
          return;
        }

        const retryOutcome = await this.waitForSearchOutcome();
        log('Retry outcome:', retryOutcome || 'none');

        this.clearPendingQuery();
      } finally {
        STATE.handlingSearch = false;
      }
    },

    isSearchButtonClick(target) {
      const btn = target.closest('button');
      if (!btn) return false;
      return btn.textContent.trim() === 'Search';
    },

    installDelegatedListeners() {
      document.addEventListener('click', (e) => {
        if (STATE.suppressNextClick) return;
        if (!this.isSearchButtonClick(e.target)) return;

        const query = this.getCurrentQuery();
        if (!query) {
          log('Search clicked but query empty');
          return;
        }

        this.savePendingQuery(query);

        setTimeout(() => {
          this.processSearchResult(query);
        }, 50);
      }, true);

      document.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' || e.shiftKey) return;

        const textarea = this.getSearchTextarea();
        if (!textarea) return;
        if (document.activeElement !== textarea) return;

        const query = this.getCurrentQuery();
        if (!query) return;

        this.savePendingQuery(query);

        setTimeout(() => {
          this.processSearchResult(query);
        }, 50);
      }, true);
    },

    start() {
      this.installDelegatedListeners();
      this.retryPendingSearchIfNeeded();
    }
  };

  function init() {
    channelUi.start();
    searchFallback.start();
    log('Initialized');
  }

  init();
})();

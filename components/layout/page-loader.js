/**
 * PageLoader — Dynamically loads Scooter page content into a container.
 *
 * Pages declare their dependencies via a `<script type="scooter/page-meta">` JSON block:
 *   {
 *     "scripts": ["components/custom/div-table/query.js"],  // relative to project root
 *     "init": "ScooterPageInit_demoDivTable"                // global init function name
 *   }
 *
 * Usage:
 *   PageLoader.load('demo-patterns.html', containerEl)
 *     .then(result => console.log('loaded', result.title))
 *     .catch(err => console.error(err));
 */
(function () {
  'use strict';

  // Track scripts that have already been loaded to avoid duplicates
  var loadedScripts = {};

  /**
   * Resolve a project-root-relative path to a path relative to the current page.
   * e.g. "components/chart.js" → "../components/chart.js" when host is in demo-pages/
   */
  function resolveScriptPath(scriptPath) {
    // If already absolute or protocol-relative, use as-is
    if (scriptPath.startsWith('/') || scriptPath.startsWith('http') || scriptPath.startsWith('//')) {
      return scriptPath;
    }
    // Determine the base path from the current page to the project root.
    // Look for an existing script tag that references "components/" to infer the prefix.
    var existing = document.querySelector('script[src*="components/"]');
    if (existing) {
      var src = existing.getAttribute('src');
      var idx = src.indexOf('components/');
      if (idx >= 0) {
        return src.substring(0, idx) + scriptPath;
      }
    }
    // Fallback: assume page is one level deep (e.g. demo-pages/)
    return '../' + scriptPath;
  }

  /**
   * Load a single script by URL. Returns a Promise.
   * Deduplicates: if the script is already on the page or was already loaded, resolves immediately.
   */
  function loadScript(src) {
    // Normalize the path for dedup
    var resolved = resolveScriptPath(src);

    // Check if already loaded by us
    if (loadedScripts[src] || loadedScripts[resolved]) {
      return Promise.resolve();
    }

    // Check if already present in the DOM (loaded by the host page)
    var existing = document.querySelector('script[src]');
    var allScripts = document.querySelectorAll('script[src]');
    for (var i = 0; i < allScripts.length; i++) {
      var s = allScripts[i].getAttribute('src') || '';
      // Match if the src ends with the same path segment
      if (s === resolved || s === src || s.endsWith('/' + src) || src.endsWith(s.replace(/^\.\.\//, ''))) {
        loadedScripts[src] = true;
        return Promise.resolve();
      }
    }

    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = resolved;
      script.onload = function () {
        loadedScripts[src] = true;
        resolve();
      };
      script.onerror = function () {
        reject(new Error('Failed to load script: ' + resolved));
      };
      document.head.appendChild(script);
    });
  }

  /**
   * Load multiple scripts sequentially (order matters for dependencies).
   */
  function loadScripts(scriptPaths) {
    var chain = Promise.resolve();
    scriptPaths.forEach(function (path) {
      chain = chain.then(function () { return loadScript(path); });
    });
    return chain;
  }

  /**
   * Execute inline <script> blocks from a parsed document within the current page context.
   * Only executes scripts with no type or type="text/javascript" (skips scooter/page-meta, application/json, etc.)
   * Uses DOM script injection so function declarations become global (new Function() scopes them locally).
   */
  function executeInlineScripts(parsedDoc) {
    var scripts = parsedDoc.querySelectorAll('script');
    scripts.forEach(function (scriptEl) {
      var type = (scriptEl.getAttribute('type') || '').toLowerCase();
      // Skip non-JS script types
      if (type && type !== 'text/javascript' && type !== 'application/javascript') {
        return;
      }
      // Skip external scripts (handled by loadScripts)
      if (scriptEl.src || scriptEl.getAttribute('src')) {
        return;
      }
      // Execute inline script via DOM injection (global scope)
      var code = scriptEl.textContent;
      if (code && code.trim()) {
        try {
          var s = document.createElement('script');
          s.textContent = code;
          document.head.appendChild(s);
          document.head.removeChild(s);
        } catch (e) {
          console.error('[PageLoader] Error executing inline script:', e);
        }
      }
    });
  }

  /**
   * Parse the page-meta JSON from a parsed document.
   * Returns { scripts: string[], init: string|null } or null if not found.
   */
  function parsePageMeta(parsedDoc) {
    var metaScript = parsedDoc.querySelector('script[type="scooter/page-meta"]');
    if (!metaScript) return null;
    try {
      return JSON.parse(metaScript.textContent);
    } catch (e) {
      console.error('[PageLoader] Invalid page-meta JSON:', e);
      return null;
    }
  }

  /**
   * Extract the page title from the loaded content.
   * Looks for <h1> in the main content, then falls back to <title>.
   */
  function extractTitle(mainEl, parsedDoc) {
    var h1 = mainEl.querySelector('h1');
    if (h1) return h1.textContent.trim();
    var titleEl = parsedDoc.querySelector('title');
    if (titleEl) {
      var t = titleEl.textContent.trim();
      // Strip "— Scooter Pages" suffix if present
      return t.replace(/\s*[—–-]\s*Scooter Pages$/i, '');
    }
    return '';
  }

  // ── Public API ──

  var PageLoader = {
    /**
     * Load a page into a container element.
     *
     * @param {string} url - URL of the page to load
     * @param {HTMLElement} container - DOM element to inject content into
     * @param {Object} [options]
     * @param {string} [options.mainSelector] - CSS selector for the main content element
     *                                          (default: 'main.scooter-page, main.demo-page')
     * @returns {Promise<{title: string, meta: Object|null}>}
     */
    load: function (url, container, options) {
      options = options || {};
      var mainSelector = options.mainSelector || 'main.scooter-page, main.demo-page';

      return fetch(url)
        .then(function (response) {
          if (!response.ok) throw new Error('Failed to load ' + url + ' (' + response.status + ')');
          return response.text();
        })
        .then(function (html) {
          var parser = new DOMParser();
          var doc = parser.parseFromString(html, 'text/html');
          var pageMain = doc.querySelector(mainSelector);

          if (!pageMain) {
            container.innerHTML = '<div class="loading-placeholder">No content found.</div>';
            return { title: '', meta: null };
          }

          // 1. Inject the HTML content
          container.innerHTML = pageMain.innerHTML;

          // 2. Parse page-meta for dependencies
          var meta = parsePageMeta(doc);

          // 3. Load declared scripts, then execute inline scripts, then init
          var scriptPromise = meta && meta.scripts && meta.scripts.length
            ? loadScripts(meta.scripts)
            : Promise.resolve();

          var title = extractTitle(pageMain, doc);

          return scriptPromise.then(function () {
            // 4. Execute inline <script> blocks from the page
            executeInlineScripts(doc);

            // 5. Initialize Scooter components in the new content
            if (typeof Scooter !== 'undefined' && Scooter.init) {
              Scooter.init(container);
            }

            // 6. Call the declared init function
            if (meta && meta.init && typeof window[meta.init] === 'function') {
              window[meta.init](container);
            }

            return { title: title, meta: meta };
          });
        });
    }
  };

  // Export
  if (typeof window !== 'undefined') {
    window.PageLoader = PageLoader;
  }
})();

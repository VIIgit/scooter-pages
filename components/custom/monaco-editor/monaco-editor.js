/**
 * Scooter Monaco Editor Component
 * Wrapper around Microsoft Monaco Editor loaded via CDN.
 *
 * Usage (standard editor):
 *   <div data-sc="monaco-editor"
 *        data-language="javascript"
 *        data-theme="vs-dark"
 *        data-readonly="false"
 *        data-minimap="true"
 *        data-line-numbers="on"
 *        data-word-wrap="on"
 *        data-font-size="14">
 *     // Initial code here (text content is used as initial value)
 *   </div>
 *
 * Usage (diff editor):
 *   <div data-sc="monaco-editor"
 *        data-mode="diff"
 *        data-language="javascript"
 *        data-theme="vs-dark">
 *     <pre data-slot="original">original code</pre>
 *     <pre data-slot="modified">modified code</pre>
 *   </div>
 *
 * Options:
 *   data-mode           "editor" | "diff" (default: "editor")
 *   data-language       Language id — "javascript", "typescript", "html", "css", "json", etc.
 *   data-theme          "vs" | "vs-dark" | "hc-black" (default: "vs")
 *   data-readonly       "true" | "false" (default: "false")
 *   data-minimap        "true" | "false" (default: "true")
 *   data-line-numbers   "on" | "off" | "relative" (default: "on")
 *   data-word-wrap      "on" | "off" | "wordWrapColumn" | "bounded" (default: "off")
 *   data-font-size      Number (default: 14)
 *   data-cdn-version    Monaco CDN version (default: "0.55.1")
 *
 * API:
 *   el._monacoEditor.getEditor()        → underlying monaco.editor instance
 *   el._monacoEditor.getValue()         → current editor value (standard mode)
 *   el._monacoEditor.setValue(str)       → set editor value (standard mode)
 *   el._monacoEditor.getOriginalValue()  → original pane value (diff mode)
 *   el._monacoEditor.getModifiedValue()  → modified pane value (diff mode)
 *   el._monacoEditor.setLanguage(lang)  → change language mode
 *   el._monacoEditor.setTheme(theme)    → change theme
 *   el._monacoEditor.layout()           → force re-layout (e.g. after resize)
 *   el._monacoEditor.dispose()          → clean up
 *
 * Events:
 *   sc:ready            Fired when the editor instance is fully initialized
 *   sc:change           { value: string }  Fired on content change (standard mode)
 */
;(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────
  // Singleton CDN Loader — ensures Monaco is loaded exactly once
  // ─────────────────────────────────────────────────────────────────────

  let _monacoPromise = null;

  /**
   * Load Monaco Editor from CDN. Returns a Promise that resolves to the
   * global `monaco` object. Safe to call multiple times — the loader script
   * is injected at most once and every caller shares the same promise.
   */
  function loadMonaco(version) {
    if (_monacoPromise) return _monacoPromise;

    // If Monaco is already on the page (e.g. bundled), resolve immediately
    if (typeof monaco !== 'undefined') {
      _monacoPromise = Promise.resolve(monaco);
      return _monacoPromise;
    }

    _monacoPromise = new Promise(function (resolve, reject) {
      const cdnBase = 'https://cdn.jsdelivr.net/npm/monaco-editor@' + version + '/min';

      // Check if the AMD loader is already present
      if (typeof require !== 'undefined' && typeof require.config === 'function') {
        configureAndLoad(cdnBase, resolve, reject);
        return;
      }

      // Inject the AMD loader script
      var script = document.createElement('script');
      script.src = cdnBase + '/vs/loader.min.js';
      script.async = true;
      script.onload = function () {
        configureAndLoad(cdnBase, resolve, reject);
      };
      script.onerror = function () {
        _monacoPromise = null; // allow retry
        reject(new Error('Failed to load Monaco loader from CDN'));
      };
      document.head.appendChild(script);
    });

    return _monacoPromise;
  }

  function configureAndLoad(cdnBase, resolve, reject) {
    require.config({ paths: { vs: cdnBase + '/vs' } });

    // Monaco needs web workers — configure the worker URL via the environment
    window.MonacoEnvironment = window.MonacoEnvironment || {
      getWorkerUrl: function (_moduleId, label) {
        var workerBase = cdnBase + '/vs';
        if (label === 'json')       return proxy(workerBase + '/language/json/json.worker.js');
        if (label === 'css' || label === 'scss' || label === 'less')
                                    return proxy(workerBase + '/language/css/css.worker.js');
        if (label === 'html' || label === 'handlebars' || label === 'razor')
                                    return proxy(workerBase + '/language/html/html.worker.js');
        if (label === 'typescript' || label === 'javascript')
                                    return proxy(workerBase + '/language/typescript/ts.worker.js');
        return proxy(workerBase + '/editor/editor.worker.js');
      }
    };

    require(['vs/editor/editor.main'], function () {
      resolve(window.monaco);
    }, function (err) {
      _monacoPromise = null;
      reject(err);
    });
  }

  /**
   * Create a blob-URL proxy for a cross-origin worker script.
   * Monaco workers must be same-origin; this thin wrapper lets them
   * load from the CDN.
   */
  function proxy(url) {
    return URL.createObjectURL(new Blob(
      ['importScripts(' + JSON.stringify(url) + ');'],
      { type: 'text/javascript' }
    ));
  }

  // ─────────────────────────────────────────────────────────────────────
  // Component
  // ─────────────────────────────────────────────────────────────────────

  // Expose the singleton loader so other components (e.g. DivTable) can
  // share the same Monaco instance without race conditions.
  Scooter.loadMonaco = loadMonaco;

  Scooter.register('monaco-editor', function (el) {
    var mode       = el.dataset.mode || 'editor';
    var language   = el.dataset.language || 'javascript';
    var theme      = el.dataset.theme || 'vs';
    var readonly   = el.dataset.readonly === 'true';
    var minimap    = el.dataset.minimap !== 'false';
    var lineNumbers = el.dataset.lineNumbers || 'on';
    var wordWrap   = el.dataset.wordWrap || 'off';
    var fontSize   = parseInt(el.dataset.fontSize, 10) || 14;
    var cdnVersion = el.dataset.cdnVersion || '0.55.1';

    var editorInstance = null;

    // Capture initial content before we clear the container
    var initialValue = '';
    var originalValue = '';
    var modifiedValue = '';

    if (mode === 'diff') {
      var originalEl = el.querySelector('[data-slot="original"]');
      var modifiedEl = el.querySelector('[data-slot="modified"]');
      originalValue = originalEl ? originalEl.textContent : '';
      modifiedValue = modifiedEl ? modifiedEl.textContent : '';
    } else {
      initialValue = el.textContent.trim();
    }

    // Clear container and add loading indicator
    el.textContent = '';
    var loader = document.createElement('div');
    loader.setAttribute('data-slot', 'monaco-loading');
    loader.textContent = 'Loading editor…';
    el.appendChild(loader);

    // Load and create the editor
    loadMonaco(cdnVersion).then(function (monacoLib) {
      // Remove loading indicator
      el.textContent = '';

      if (mode === 'diff') {
        editorInstance = monacoLib.editor.createDiffEditor(el, {
          theme: theme,
          readOnly: readonly,
          minimap: { enabled: minimap },
          lineNumbers: lineNumbers,
          wordWrap: wordWrap,
          fontSize: fontSize,
          automaticLayout: true,
          renderSideBySide: true,
          originalEditable: !readonly
        });

        editorInstance.setModel({
          original: monacoLib.editor.createModel(originalValue, language),
          modified: monacoLib.editor.createModel(modifiedValue, language)
        });
      } else {
        editorInstance = monacoLib.editor.create(el, {
          value: initialValue,
          language: language,
          theme: theme,
          readOnly: readonly,
          minimap: { enabled: minimap },
          lineNumbers: lineNumbers,
          wordWrap: wordWrap,
          fontSize: fontSize,
          automaticLayout: true,
          scrollBeyondLastLine: false,
          padding: { top: 12, bottom: 12 }
        });

        // Emit change events
        editorInstance.onDidChangeModelContent(function () {
          el.dispatchEvent(new CustomEvent('sc:change', {
            bubbles: true,
            detail: { value: editorInstance.getValue() }
          }));
        });
      }

      el.dispatchEvent(new CustomEvent('sc:ready', { bubbles: true }));
    }).catch(function (err) {
      el.textContent = '';
      var errEl = document.createElement('div');
      errEl.setAttribute('data-slot', 'monaco-error');
      errEl.textContent = 'Failed to load Monaco Editor: ' + err.message;
      el.appendChild(errEl);
      console.error('[monaco-editor]', err);
    });

    // Expose API
    el._monacoEditor = {
      getEditor: function () { return editorInstance; },
      getValue: function () {
        return editorInstance && typeof editorInstance.getValue === 'function'
          ? editorInstance.getValue() : '';
      },
      setValue: function (val) {
        if (editorInstance && typeof editorInstance.setValue === 'function') {
          editorInstance.setValue(val);
        }
      },
      getOriginalValue: function () {
        if (!editorInstance || mode !== 'diff') return '';
        var m = editorInstance.getModel();
        return m && m.original ? m.original.getValue() : '';
      },
      getModifiedValue: function () {
        if (!editorInstance || mode !== 'diff') return '';
        var m = editorInstance.getModel();
        return m && m.modified ? m.modified.getValue() : '';
      },
      setLanguage: function (lang) {
        if (!editorInstance) return;
        if (mode === 'diff') {
          var m = editorInstance.getModel();
          if (m) {
            window.monaco.editor.setModelLanguage(m.original, lang);
            window.monaco.editor.setModelLanguage(m.modified, lang);
          }
        } else {
          window.monaco.editor.setModelLanguage(editorInstance.getModel(), lang);
        }
      },
      setTheme: function (t) {
        window.monaco && window.monaco.editor.setTheme(t);
      },
      layout: function () {
        editorInstance && editorInstance.layout();
      },
      dispose: function () {
        if (editorInstance) {
          if (mode === 'diff') {
            var m = editorInstance.getModel();
            if (m) {
              m.original && m.original.dispose();
              m.modified && m.modified.dispose();
            }
          }
          editorInstance.dispose();
          editorInstance = null;
        }
      }
    };
  });
})();

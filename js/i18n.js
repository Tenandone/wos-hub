/* =========================================================
   WosHub - js/i18n.js (FULL / FINAL) ✅ FLAT KEYS + MULTI FILE MERGE
   - Loads and merges:
       /i18n/{lang}/common.json
       /i18n/{lang}/buildings.json
       /i18n/{lang}/heroes.json
       /i18n/{lang}/calc.json
       /i18n/{lang}/tips.json
     (missing files are ignored)
   - Supports BOTH:
       1) Nested keys: { buildings:{ list:{ title:"..." } } }
       2) Flat keys:   { "buildings.list.title":"..." }
   - Also supports wrapper:
       { "en": { ... } }  => unwraps automatically
   ========================================================= */

(() => {
  "use strict";

  const STORAGE_KEY = "wos_lang";
  const DEFAULT_LANG = "en";
  const SUPPORTED = ["en", "ko", "ja"];
  const BASE_PATH = "i18n"; // ✅ 상대경로 기본값 (중요)

  let _lang = DEFAULT_LANG;
  let _dict = {};
  let _ready = false;

  let _cfg = {
    defaultLang: DEFAULT_LANG,
    supported: SUPPORTED.slice(),
    basePath: BASE_PATH,
    // ✅ 자동으로 합칠 파일들
    files: ["common.json", "buildings.json", "heroes.json", "calc.json", "tips.json"],
  };

  // ---------- utils ----------
  function normalizeLang(lang) {
    const v = String(lang || "").toLowerCase().trim();
    if (_cfg.supported.includes(v)) return v;
    return _cfg.defaultLang;
  }

  function detectFromPathname() {
    const seg = (location.pathname || "/").split("/").filter(Boolean)[0];
    if (seg && _cfg.supported.includes(seg)) return seg;
    return null;
  }

  function getStoredLang() {
    const v = (localStorage.getItem(STORAGE_KEY) || "").toLowerCase().trim();
    if (_cfg.supported.includes(v)) return v;
    return null;
  }

  function setStoredLang(lang) {
    try { localStorage.setItem(STORAGE_KEY, lang); } catch (_) {}
  }

  function setHtmlLang(lang) {
    try { document.documentElement.setAttribute("lang", lang); } catch (_) {}
  }

  function toAbs(url) {
    try { return new URL(url, location.href).toString(); } catch (_) { return url; }
  }

  async function fetchJSON(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`i18n fetch failed: ${url} (HTTP ${res.status})`);
    return await res.json();
  }

  // { "en": {...} } 같은 래핑 자동 해제
  function unwrapLangObject(json, lang) {
    if (!json || typeof json !== "object") return {};
    const l = String(lang || "").toLowerCase();
    if (json[l] && typeof json[l] === "object") return json[l];
    if (json.en && typeof json.en === "object" && l === "en") return json.en;
    if (json.ko && typeof json.ko === "object" && l === "ko") return json.ko;
    if (json.ja && typeof json.ja === "object" && l === "ja") return json.ja;
    return json;
  }

  function isPlainObject(x) {
    return !!x && typeof x === "object" && !Array.isArray(x);
  }

  // 깊은 merge (객체끼리만)
  function deepMerge(target, src) {
    if (!isPlainObject(target) || !isPlainObject(src)) return target;
    for (const k of Object.keys(src)) {
      const sv = src[k];
      const tv = target[k];
      if (isPlainObject(tv) && isPlainObject(sv)) deepMerge(tv, sv);
      else target[k] = sv;
    }
    return target;
  }

  // ✅ 키 조회: 1) 평면키 먼저, 2) 점 경로 탐색
  function getKey(obj, path) {
    if (!obj || !path) return undefined;

    // (1) flat key direct
    if (Object.prototype.hasOwnProperty.call(obj, path)) return obj[path];

    // (2) nested path
    const parts = String(path).split(".");
    let cur = obj;
    for (const p of parts) {
      if (cur && Object.prototype.hasOwnProperty.call(cur, p)) cur = cur[p];
      else return undefined;
    }
    return cur;
  }

  function template(str, vars) {
    if (!vars) return str;
    return String(str).replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, k) => {
      const v = getKey(vars, k);
      return v === undefined || v === null ? "" : String(v);
    });
  }

  function t(key, vars) {
    const val = getKey(_dict, key);
    if (typeof val === "string") return template(val, vars);
    if (val !== undefined && val !== null) return String(val);
    return String(key); // missing key debug
  }

  function apply(root) {
    const scope = root || document;

    scope.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (!key) return;
      el.textContent = t(key);
    });

    scope.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
      const key = el.getAttribute("data-i18n-placeholder");
      if (!key) return;
      el.setAttribute("placeholder", t(key));
    });

    scope.querySelectorAll("[data-i18n-title]").forEach((el) => {
      const key = el.getAttribute("data-i18n-title");
      if (!key) return;
      el.setAttribute("title", t(key));
    });

    scope.querySelectorAll("[data-i18n-aria-label]").forEach((el) => {
      const key = el.getAttribute("data-i18n-aria-label");
      if (!key) return;
      el.setAttribute("aria-label", t(key));
    });

    // optional brand
    const brandEls = scope.querySelectorAll("[data-i18n-brand]");
    if (brandEls.length) {
      const v = t("site.brand");
      brandEls.forEach((el) => (el.textContent = v));
    }

    // optional language buttons
    scope.querySelectorAll("[data-lang]").forEach((el) => {
      const v = normalizeLang(el.getAttribute("data-lang"));
      el.setAttribute("aria-pressed", v === _lang ? "true" : "false");
      el.classList.toggle("active", v === _lang);
    });

    return true;
  }

  function bindLangControlsOnce() {
    if (window.__WOS_I18N_LANG_BOUND__) return;
    window.__WOS_I18N_LANG_BOUND__ = true;

    document.addEventListener("click", (e) => {
      const el = e.target.closest("[data-lang]");
      if (!el) return;
      const lang = normalizeLang(el.getAttribute("data-lang"));
      if (!lang) return;
      e.preventDefault();
      setLang(lang).catch((err) => console.error(err));
    });
  }

  async function loadLangFiles(lang) {
    const base = String(_cfg.basePath || BASE_PATH).replace(/\/+$/, "");
    const merged = {};

    for (const f of _cfg.files) {
      const url = toAbs(`${base}/${lang}/${f}`);
      try {
        const json = await fetchJSON(url);
        const unwrapped = unwrapLangObject(json, lang);
        deepMerge(merged, unwrapped);
      } catch (_) {
        // 없는 파일은 무시 (common.json만 있어도 작동)
      }
    }

    return merged;
  }

  async function setLang(lang) {
    const next = normalizeLang(lang);

    if (_ready && next === _lang) {
      setHtmlLang(_lang);
      apply(document);
      return _lang;
    }

    _lang = next;
    setStoredLang(_lang);

    _dict = await loadLangFiles(_lang);
    _ready = true;

    setHtmlLang(_lang);
    apply(document);

    try {
      window.dispatchEvent(new CustomEvent("wos:langchange", { detail: { lang: _lang } }));
    } catch (_) {}

    return _lang;
  }

  async function init(opts = {}) {
    const inputSupported =
      Array.isArray(opts.supported) && opts.supported.length ? opts.supported : SUPPORTED;

    const uniq = [];
    for (const x of inputSupported) {
      const v = String(x || "").toLowerCase().trim();
      if (v && !uniq.includes(v)) uniq.push(v);
    }
    const supported = uniq.length ? uniq : SUPPORTED.slice();

    const wantedDefault = String(opts.defaultLang || DEFAULT_LANG).toLowerCase().trim();
    const defaultLang = supported.includes(wantedDefault) ? wantedDefault : DEFAULT_LANG;

    _cfg = {
      defaultLang,
      supported,
      basePath: String(opts.basePath || BASE_PATH).replace(/\/+$/, ""),
      files: Array.isArray(opts.files) && opts.files.length
        ? opts.files.slice()
        : ["common.json", "buildings.json", "heroes.json", "calc.json", "tips.json"],
    };

    bindLangControlsOnce();

    const stored = getStoredLang();
    const pathLang = detectFromPathname();
    const first = normalizeLang(stored || pathLang || _cfg.defaultLang);

    await setLang(first);

    if (!window.__WOS_I18N_OBS__) {
      window.__WOS_I18N_OBS__ = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.type === "childList" && m.addedNodes && m.addedNodes.length) {
            m.addedNodes.forEach((n) => {
              if (n && n.nodeType === 1) apply(n);
            });
          }
        }
      });
      try {
        window.__WOS_I18N_OBS__.observe(document.body, { childList: true, subtree: true });
      } catch (_) {}
    }

    return _lang;
  }

  function getLang() {
    return _lang;
  }

  window.WOS_I18N = { init, setLang, getLang, t, apply };
})();

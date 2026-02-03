/* =========================================================
   WosHub - js/app.core.js (Split Build) - CORE ✅
   - ✅ GitHub Pages repo prefix 계산: WOS_BASE
   - ✅ URL helpers: withBase (SPA), withRes (RES)
   - ✅ fetch() Hook: /data,/assets,/i18n,/sw.js 절대경로 자동 보정
   - ✅ DOM 리소스 보정: img/src, link/href, style url(...)
   - ✅ 외부 링크 보정: scheme 없는 도메인 => https://
   - ✅ i18n helpers + minimal styles + shell + error screen
   - ✅ FIX: 언어 변경 시 SPA 리렌더(popstate) + (옵션) 하드리로드
   ========================================================= */

(() => {
  "use strict";

  // 중복 로드 방지
  if (window.__WOS_CORE_LOADED__) return;
  window.__WOS_CORE_LOADED__ = true;

  // =========================
  // 1) Core Config
  // =========================
  const APP_SEL = "#app";
  const SHELL_MARKER = "data-wos-shell-mounted";

  let SITE_NAME = "WosHub"; // 필요하면 window.WOS_CORE.setSiteName()로 변경 가능

  // =========================
  // 2) GitHub Pages base prefix helper
  //   - DO NOT derive from location.pathname (it changes per route)
  //   - Prefer <meta name="wos-base">, then <base href>, then script src
  // =========================
  const WOS_BASE = (() => {
    // 0) <meta name="wos-base" content="/repo">
    try {
      const meta = document.querySelector('meta[name="wos-base"][content]');
      if (meta) {
        let p = String(meta.getAttribute("content") || "").trim();
        if (!p) return "";
        if (!p.startsWith("/")) p = "/" + p.replace(/^\.?\//, "");
        p = p.replace(/\/+$/, "");
        return p === "/" ? "" : p;
      }
    } catch (_) {}

    // 1) <base href="...">
    try {
      const baseEl = document.querySelector("base[href]");
      if (baseEl) {
        const href = baseEl.getAttribute("href") || "";
        const u = new URL(href, location.href);
        let p = String(u.pathname || "/");
        p = p.replace(/\/index\.html?$/i, "");
        p = p.replace(/\/+$/, "");
        return p === "/" ? "" : p;
      }
    } catch (_) {}

    // 2) currentScript src before "/js/"
    try {
      let src = "";
      const cs = document.currentScript;
      if (cs && cs.src) src = String(cs.src);

      if (!src) {
        const scripts = Array.from(document.scripts || []);
        const preferred =
          scripts.find((s) => s && s.src && /\/js\/app\.core\.js(\?|#|$)/i.test(String(s.src))) ||
          scripts.find((s) => s && s.src && /\/js\/app\.js(\?|#|$)/i.test(String(s.src))) ||
          scripts.find((s) => s && s.src && /app\.js(\?|#|$)/i.test(String(s.src))) ||
          scripts[scripts.length - 1];
        if (preferred && preferred.src) src = String(preferred.src);
      }

      if (src) {
        const u = new URL(src, location.href);
        let p = String(u.pathname || "/"); // "/repo/js/app.core.js"
        p = p.replace(/\/index\.html?$/i, "");

        const idx = p.lastIndexOf("/js/");
        if (idx !== -1) {
          let base = p.slice(0, idx); // "/repo"
          base = base.replace(/\/+$/, "");
          return base === "/" ? "" : base;
        }

        // fallback: directory of script
        p = p.replace(/\/[^\/]*$/, ""); // "/repo/js"
        p = p.replace(/\/+$/, "");
        p = p.replace(/\/js$/i, "");
        return p === "/" ? "" : p;
      }
    } catch (_) {}

    return "";
  })();

  // =========================
  // 2.1) URL helpers
  // =========================
  function isExternalLike(u) {
    const s = String(u ?? "");
    return (
      /^(https?:)?\/\//i.test(s) ||
      s.startsWith("data:") ||
      s.startsWith("blob:") ||
      s.startsWith("mailto:") ||
      s.startsWith("tel:")
    );
  }

  // ✅ withBase(): SPA 라우팅 전용
  function withBase(url) {
    const u = String(url ?? "");
    if (!u) return u;
    if (isExternalLike(u)) return u;

    const norm = u.startsWith("/") ? u : "/" + u.replace(/^\.?\//, "");
    if (WOS_BASE && norm.startsWith(WOS_BASE + "/")) return norm;
    return (WOS_BASE || "") + norm;
  }

  // ✅ withRes(): 정적 리소스 전용 (repo prefix 포함)
  function withRes(url) {
    const u = String(url ?? "");
    if (!u) return u;
    if (isExternalLike(u)) return u;

    const norm = u.startsWith("/") ? u : "/" + u.replace(/^\.?\//, "");
    if (WOS_BASE && norm.startsWith(WOS_BASE + "/")) return norm;
    return (WOS_BASE || "") + norm;
  }

  // 외부 모듈 호환용 전역 노출
  window.WOS_BASE = WOS_BASE;
  window.WOS_URL = withBase; // SPA NAV
  window.WOS_RES = withRes;  // RESOURCES

  // =========================
  // 2.2) ✅ fetch() Hook
  // =========================
  function patchFetchOnce() {
    if (window.__WOS_FETCH_PATCHED__) return;
    window.__WOS_FETCH_PATCHED__ = true;

    const origFetch = window.fetch ? window.fetch.bind(window) : null;
    if (!origFetch) return;

    function shouldRewriteResourcePath(pathname) {
      if (!pathname) return false;
      if (WOS_BASE && pathname.startsWith(WOS_BASE + "/")) return false;

      return (
        pathname === "/sw.js" ||
        pathname.startsWith("/data/") ||
        pathname.startsWith("/assets/") ||
        pathname.startsWith("/i18n/")
      );
    }

    function rewriteUrl(inputUrl) {
      try {
        if (!inputUrl) return inputUrl;

        if (typeof inputUrl === "string" && isExternalLike(inputUrl)) return inputUrl;

        const u = new URL(String(inputUrl), location.href);
        if (u.origin !== location.origin) return inputUrl;

        if (shouldRewriteResourcePath(u.pathname)) {
          u.pathname = withRes(u.pathname);
          return u.toString();
        }
        return inputUrl;
      } catch (_) {
        try {
          const s = String(inputUrl || "");
          if (!s || isExternalLike(s)) return inputUrl;

          if (s.startsWith("/")) {
            if (shouldRewriteResourcePath(s)) return withRes(s);
          } else if (/^(data|assets|i18n)\//i.test(s)) {
            const abs = "/" + s.replace(/^\.?\//, "");
            if (shouldRewriteResourcePath(abs)) return withRes(abs);
          }
        } catch (_) {}
        return inputUrl;
      }
    }

    window.fetch = function patchedFetch(input, init) {
      try {
        if (typeof input === "string") {
          const out = rewriteUrl(input);
          return origFetch(out, init);
        }
        if (input && typeof Request !== "undefined" && input instanceof Request) {
          const out = rewriteUrl(input.url);
          if (out !== input.url) {
            const req = new Request(out, input);
            return origFetch(req, init);
          }
          return origFetch(input, init);
        }
      } catch (_) {}
      return origFetch(input, init);
    };
  }

  // =========================
  // 2.3) Service Worker register
  // =========================
  function registerServiceWorkerOnce() {
    if (!("serviceWorker" in navigator)) return;
    if (window.__WOS_SW_REGISTER_BOUND__) return;
    window.__WOS_SW_REGISTER_BOUND__ = true;

    window.addEventListener("load", () => {
      try {
        navigator.serviceWorker
          .register(withBase("/sw.js"), { scope: withBase("/") })
          .catch(() => {});
      } catch (_) {}
    });
  }

  // =========================
  // 3) Utils
  // =========================
  const $app = () => document.querySelector(APP_SEL);

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function nl2br(s) {
    return esc(s).replace(/\n/g, "<br>");
  }

  function fmtNum(v) {
    if (v === null || v === undefined) return "-";
    const n = Number(v);
    if (!Number.isFinite(n)) return "-";
    return n.toLocaleString();
  }

  function normalizeIndex(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    if (data && Array.isArray(data.heroes)) return data.heroes;
    return [];
  }

  function clampStr(s, max = 80) {
    const tx = String(s ?? "");
    return tx.length > max ? tx.slice(0, max - 1) + "…" : tx;
  }

  function fmtDateLike(v) {
    if (!v) return "";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 16).replace("T", " ");
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${yy}-${mm}-${dd} ${hh}:${mi}`;
    }
    return s;
  }

  // ✅ fetch URL은 "리소스 기준 절대"로 정규화 (repo prefix 포함)
  function toAbsResourceUrl(raw) {
    const s = String(raw ?? "");
    if (!s) return s;
    if (isExternalLike(s)) return s;

    if (s.startsWith("/")) return withRes(s);
    if (/^(data|assets|i18n)\//i.test(s)) return withRes("/" + s.replace(/^\.?\//, ""));
    return withRes("/" + s.replace(/^\.?\//, ""));
  }

  async function fetchJSONTry(urls) {
    let lastErr = null;
    for (const raw of urls) {
      const u = toAbsResourceUrl(raw);
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
      } catch (e) {
        lastErr = new Error(`Fetch failed: ${u} (${e.message})`);
      }
    }
    throw lastErr;
  }

  async function fetchJSONTryWithAttempts(urls) {
    const attempted = [];
    let lastErr = null;

    for (const raw of urls) {
      const u = toAbsResourceUrl(raw);
      attempted.push(u);
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        return { data, usedUrl: u, attempted };
      } catch (e) {
        lastErr = new Error(`Fetch failed: ${u} (${e.message})`);
      }
    }

    if (lastErr) lastErr.attempted = attempted;
    throw lastErr || new Error("Fetch failed");
  }

  async function fetchTextTryWithAttempts(urls) {
    const attempted = [];
    let lastErr = null;

    for (const raw of urls) {
      const u = toAbsResourceUrl(raw);
      attempted.push(u);
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return { text, usedUrl: u, attempted };
      } catch (e) {
        lastErr = new Error(`Fetch failed: ${u} (${e.message})`);
      }
    }

    if (lastErr) lastErr.attempted = attempted;
    throw lastErr || new Error("Fetch failed");
  }

  // =========================
  // 4) SPA Path helpers (NO HASH)
  // =========================
  function toAppPathFromLocation() {
    let p = String(location.pathname || "/");
    p = p.replace(/\/index\.html?$/i, "");
    if (WOS_BASE && p === WOS_BASE) p = "/";
    else if (WOS_BASE && p.startsWith(WOS_BASE + "/")) p = p.slice(WOS_BASE.length) || "/";
    if (!p.startsWith("/")) p = "/" + p;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p || "/";
  }

  function toAppPathFromHref(href) {
    const h = String(href || "").trim();
    if (!h) return "/";
    if (h.startsWith("mailto:") || h.startsWith("tel:") || h.startsWith("data:") || h.startsWith("blob:")) return null;
    if (h.startsWith("#")) return null;

    try {
      const u = new URL(h, location.href);
      if (u.origin !== location.origin) return null;

      let p = u.pathname || "/";
      p = p.replace(/\/index\.html?$/i, "");
      if (WOS_BASE && p === WOS_BASE) p = "/";
      else if (WOS_BASE && p.startsWith(WOS_BASE + "/")) p = p.slice(WOS_BASE.length) || "/";
      if (!p.startsWith("/")) p = "/" + p;
      if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
      return p || "/";
    } catch (_) {
      let p = h;
      if (WOS_BASE && p.startsWith(WOS_BASE + "/")) p = p.slice(WOS_BASE.length) || "/";
      if (!p.startsWith("/")) p = "/" + p;
      if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
      return p || "/";
    }
  }

  // ✅ 라우트 리스트 (필요하면 window.WOS_SPA_EXTRA로 확장 가능)
  function isSpaPath(appPath) {
    const p = String(appPath || "/");
    const baseOk =
      p === "/" ||
      p === "/buildings" ||
      p.startsWith("/buildings/") ||
      p === "/heroes" ||
      p.startsWith("/heroes/") ||
      p === "/tips" ||
      p.startsWith("/tips/") ||
      p === "/tools" ||
      p.startsWith("/tools/") ||
      p === "/lootbar";

    if (baseOk) return true;

    // 추가 확장 (예: window.WOS_SPA_EXTRA = ["/coupons", "/news"])
    try {
      const extra = window.WOS_SPA_EXTRA;
      if (Array.isArray(extra)) {
        for (const pref of extra) {
          const s = String(pref || "").trim();
          if (!s) continue;
          if (p === s) return true;
          if (s.endsWith("/") && p.startsWith(s)) return true;
          if (!s.endsWith("/") && p.startsWith(s + "/")) return true;
        }
      }
    } catch (_) {}

    return false;
  }

  function getPath() {
    return toAppPathFromLocation();
  }

  // ✅ History href helper (NO HASH) — SPA NAV ONLY
  function routeHref(path) {
    let p = String(path ?? "");
    if (!p.startsWith("/")) p = "/" + p;
    return withBase(p);
  }

  // =========================
  // 5) DOM resource rewrite
  // =========================
  function rewriteDomResources(root) {
    try {
      const el = root || document;
      const selector = [
        "img[src]",
        "script[src]",
        "link[href]",
        "source[src]",
        "video[poster]",
        "audio[src]",
        "iframe[src]",
        "a[href]",
        "[style]",
      ].join(",");

      const nodes = el.querySelectorAll(selector);
      nodes.forEach((node) => {
        // style url(/assets/...) 보정
        if (node.hasAttribute("style")) {
          const st = node.getAttribute("style") || "";
          if (st && st.includes("url(")) {
            const fixed = st.replace(
              /url\(\s*(['"]?)(\/(assets|data|i18n)\/[^'")]+)\1\s*\)/gi,
              (m, q, path) => {
                const u = withRes(path);
                return `url(${q || ""}${u}${q || ""})`;
              }
            );
            if (fixed !== st) node.setAttribute("style", fixed);
          }
        }

        const attrs = [];
        if (node.hasAttribute("src")) attrs.push("src");
        if (node.hasAttribute("href")) attrs.push("href");
        if (node.hasAttribute("poster")) attrs.push("poster");

        attrs.forEach((attr) => {
          const v = node.getAttribute(attr) || "";
          if (!v) return;
          if (v.startsWith("#")) return;
          if (isExternalLike(v)) return;

          // a[href]는 SPA 라우트(/buildings 등)면 건드리면 안 됨
          if (node.tagName === "A" && attr === "href") {
            const ap = toAppPathFromHref(v);
            if (ap && isSpaPath(ap)) return;
          }

          // /assets,/data,/i18n 만 보정
          const vv = String(v);
          if (
            vv.startsWith("/assets/") ||
            vv.startsWith("/data/") ||
            vv.startsWith("/i18n/") ||
            vv === "/sw.js"
          ) {
            const out = withRes(vv);
            if (out !== vv) node.setAttribute(attr, out);
            return;
          }

          // "assets/.." 같은 상대도 보정
          if (/^(assets|data|i18n)\//i.test(vv)) {
            const out = withRes("/" + vv.replace(/^\.?\//, ""));
            node.setAttribute(attr, out);
          }
        });
      });
    } catch (_) {}
  }

  // =========================
  // 6) External link normalizer
  // =========================
  function looksLikeDomainNoScheme(href) {
    const h = String(href || "").trim();
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+([\/?#]|$)/i.test(h);
  }

  function normalizeExternalHref(rawHref) {
    let h = String(rawHref || "").trim();
    if (!h) return h;
    if (h.startsWith("#")) return h;

    // already scheme or special scheme
    if (/^(https?:)?\/\//i.test(h)) return h;
    if (/^(mailto:|tel:|data:|blob:|sms:)/i.test(h)) return h;

    // "www.xxx" or "xxx.com/..." => https://
    if (h.startsWith("www.")) return "https://" + h;
    if (looksLikeDomainNoScheme(h)) return "https://" + h;

    // internal paths are returned as-is
    return h;
  }

  function isExternalAbsoluteUrl(href) {
    try {
      const u = new URL(href, location.origin);
      return u.origin !== location.origin;
    } catch (_) {
      return false;
    }
  }

  function ensureExternalTarget(aEl) {
    try {
      const href = String(aEl.getAttribute("href") || "").trim();
      if (!href) return;

      if (!/^(https?:)?\/\//i.test(href)) return;

      if (!aEl.getAttribute("target")) aEl.setAttribute("target", "_blank");

      const rel = String(aEl.getAttribute("rel") || "").trim().toLowerCase();
      const parts = rel ? rel.split(/\s+/).filter(Boolean) : [];
      if (!parts.includes("noopener")) parts.push("noopener");
      if (!parts.includes("noreferrer")) parts.push("noreferrer");
      aEl.setAttribute("rel", parts.join(" ").trim());
    } catch (_) {}
  }

  function rewriteExternalLinks(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;

    // a[href] normalize + external protect
    rootEl.querySelectorAll("a[href]").forEach((a) => {
      const raw = a.getAttribute("href") || "";
      const fixed = normalizeExternalHref(raw);
      if (fixed && fixed !== raw) a.setAttribute("href", fixed);

      // 외부 absolute이면 SPA 가로채기 방지
      if (/^(https?:)?\/\//i.test(fixed) && isExternalAbsoluteUrl(fixed)) {
        a.removeAttribute("data-link");
        a.removeAttribute("data-nav");
        ensureExternalTarget(a);
      }
    });

    // data-href / data-url normalize (optional)
    rootEl.querySelectorAll("[data-href],[data-url]").forEach((el) => {
      const raw = el.getAttribute("data-href") || el.getAttribute("data-url") || "";
      const fixed = normalizeExternalHref(raw);
      if (!fixed || fixed === raw) return;

      if (el.hasAttribute("data-href")) el.setAttribute("data-href", fixed);
      if (el.hasAttribute("data-url")) el.setAttribute("data-url", fixed);
    });
  }

  // =========================
  // 7) wait for global module
  // =========================
  function waitForGlobal(_name, testFn, timeoutMs = 1600, interval = 50) {
    return new Promise((resolve) => {
      const start = Date.now();
      let done = false;

      const ok = () => {
        try {
          return !!(testFn && testFn());
        } catch (_) {
          return false;
        }
      };

      const finish = (v) => {
        if (done) return;
        done = true;
        resolve(!!v);
      };

      if (ok()) return finish(true);

      const tmr = setInterval(() => {
        if (ok()) {
          clearInterval(tmr);
          finish(true);
          return;
        }
        if (Date.now() - start >= timeoutMs) {
          clearInterval(tmr);
          finish(false);
        }
      }, interval);

      setTimeout(() => {
        try {
          clearInterval(tmr);
        } catch (_) {}
        finish(ok());
      }, timeoutMs + 150);
    });
  }

  // =========================
  // 8) i18n helpers
  // =========================
  function detectI18nBasePath() {
    return withRes("/i18n");
  }

  function t(key, vars) {
    try {
      if (window.WOS_I18N && typeof window.WOS_I18N.t === "function") {
        return window.WOS_I18N.t(key, vars);
      }
    } catch (_) {}
    return String(key || "");
  }

  function tOpt(key, fallback = "") {
    const k = String(key || "");
    const v = String(t(k) ?? "");
    if (!k) return String(fallback ?? "");
    if (!v || v === k) return String(fallback ?? "");
    return v;
  }

  function tEnum(prefix, value) {
    const v = String(value ?? "").trim();
    if (!v) return "";
    return tOpt(`${prefix}.${v}`, v);
  }

  function applyI18n(root = document) {
    try {
      if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") {
        window.WOS_I18N.apply(root);
      }
    } catch (_) {}
  }

  // =========================
  // ✅ 언어 변경 (기본: SPA 리렌더 / 옵션: 하드리로드)
  // - 기본값은 "하드리로드 OFF" (tips 같은 깊은 경로 404 방지)
  // - 필요하면 window.WOS_LANG_HARD_RELOAD = true 로 강제 가능
  // =========================
  function getLangSafe() {
    try {
      const v =
        (window.WOS_I18N && typeof window.WOS_I18N.getLang === "function" && window.WOS_I18N.getLang()) ||
        document.documentElement.getAttribute("lang") ||
        "en";
      const l = String(v).toLowerCase();
      return l === "ko" || l === "ja" || l === "en" ? l : "en";
    } catch (_) {
      return "en";
    }
  }

  function fireSpaRefresh() {
    // app.js가 popstate에 router() 묶어둔 전제
    try {
      window.dispatchEvent(new PopStateEvent("popstate", { state: history.state }));
    } catch (_) {
      try { window.dispatchEvent(new Event("popstate")); } catch (_) {}
    }
  }

  function isSafeHardReloadPath() {
    // GitHub Pages에서 깊은 경로 새로고침은 대체로 404 위험.
    // 최소한 홈/인덱스에서만 하드리로드 허용.
    try {
      const ap = toAppPathFromLocation();
      if (ap === "/" || ap === "") return true;

      const pn = String(location.pathname || "");
      if (/\/index\.html?$/i.test(pn)) return true;

      // repo 루트(/repo)일 때
      if (WOS_BASE && pn.replace(/\/+$/, "") === WOS_BASE) return true;
    } catch (_) {}
    return false;
  }

  function hardReloadNow() {
    try {
      location.reload();
    } catch (_) {
      try { location.href = location.href; } catch (_) {}
    }
  }

  async function setLang(lang, opts = {}) {
    const target = String(lang || "").toLowerCase();
    if (!target) return getLangSafe();
    if (!(target === "ko" || target === "en" || target === "ja")) return getLangSafe();

    const current = getLangSafe();
    if (target === current) return current;

    // i18n 모듈 없으면 html lang만 변경 + SPA 리렌더
    if (!window.WOS_I18N || typeof window.WOS_I18N.setLang !== "function") {
      try { document.documentElement.setAttribute("lang", target); } catch (_) {}
      try { applyI18n(document); } catch (_) {}
      try { window.dispatchEvent(new CustomEvent("wos:langchange", { detail: { lang: target } })); } catch (_) {}
      fireSpaRefresh();
      return target;
    }

    // 1) i18n setLang
    try {
      await window.WOS_I18N.setLang(target);
    } catch (_) {
      // 실패해도 아래는 진행
    }

    // 2) html lang sync
    try { document.documentElement.setAttribute("lang", target); } catch (_) {}

    // 3) 즉시 적용 + 이벤트
    try { applyI18n(document); } catch (_) {}
    try { window.dispatchEvent(new CustomEvent("wos:langchange", { detail: { lang: target } })); } catch (_) {}

    // 4) 기본: SPA 내부 리렌더 (tips 포함 현재 라우트 재렌더)
    fireSpaRefresh();

    // 5) 옵션: 하드리로드(원하면만) — 안전한 경로에서만
    const hard =
      (opts && typeof opts.hardReload === "boolean")
        ? opts.hardReload
        : (window.WOS_LANG_HARD_RELOAD === true);

    if (hard && isSafeHardReloadPath()) {
      setTimeout(hardReloadNow, 0);
    }

    return target;
  }

  function bindLangUIOnce() {
    if (window.__WOS_LANG_UI_BOUND__) return;
    window.__WOS_LANG_UI_BOUND__ = true;

    document.addEventListener("change", (e) => {
      const target = e && e.target;
      if (!target || !target.closest) return;

      const sel = target.closest("#langSelect,[data-lang-select='1']");
      if (!sel) return;

      const v = String(sel.value || "").toLowerCase();
      // ✅ 기본은 SPA 리렌더
      setLang(v);
    });

    document.addEventListener("click", (e) => {
      const target = e && e.target;
      if (!target || !target.closest) return;

      const btn = target.closest("[data-lang-link]");
      if (!btn) return;

      if (btn.tagName === "A") {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || btn.target === "_blank") return;
      }

      const v = String(btn.getAttribute("data-lang-link") || "").toLowerCase();
      if (!v) return;

      e.preventDefault();
      setLang(v);
    });
  }

  function getLocalizedField(value, lang, fallback = "") {
    const l = lang === "ko" || lang === "ja" || lang === "en" ? lang : "en";
    if (value == null) return String(fallback ?? "");

    if (typeof value === "string" || typeof value === "number") return String(value);

    if (typeof value === "object") {
      if (value.i18n && typeof value.i18n === "object") {
        return String(value.i18n[l] ?? value.i18n.en ?? fallback ?? "");
      }
      if (value[l] != null) return String(value[l]);
      if (value.en != null) return String(value.en);
    }

    return String(fallback ?? "");
  }

  async function initI18n() {
    if (!window.WOS_I18N || typeof window.WOS_I18N.init !== "function") {
      const lang0 = (document.documentElement.getAttribute("lang") || "en").toLowerCase() || "en";
      return { ok: false, lang: lang0 };
    }

    const basePath = detectI18nBasePath();

    const lang = await window.WOS_I18N.init({
      defaultLang: (document.documentElement.getAttribute("lang") || "en").toLowerCase(),
      supported: ["en", "ko", "ja"],
      basePath,
      files: ["common.json", "buildings.json", "heroes.json", "calc.json"],
    });

    // UI 바인딩
    bindLangUIOnce();

    // 초기 적용
    applyI18n(document);

    // langchange 이벤트에 반응
    if (!window.__WOS_I18N_LANGCHANGE_BOUND__) {
      window.__WOS_I18N_LANGCHANGE_BOUND__ = true;
      window.addEventListener("wos:langchange", () => {
        applyI18n(document);
      });
    }

    const finalLang = String(lang || (window.WOS_I18N.getLang ? window.WOS_I18N.getLang() : "en")).toLowerCase();
    return { ok: true, lang: finalLang };
  }

  // =========================
  // 9) Minimal Styles
  // =========================
  function ensureStyles() {
    if (document.querySelector('style[data-wos-app-style="1"]')) return;

    const st = document.createElement("style");
    st.setAttribute("data-wos-app-style", "1");
    st.textContent = `
:root{
  --w-bg:#ffffff;
  --w-fg:#0f172a;
  --w-muted:rgba(15,23,42,.65);
  --w-card:#ffffff;
  --w-border:rgba(15,23,42,.10);
  --w-shadow:0 10px 30px rgba(2,6,23,.08);
  --w-primary:#2563eb;
  --w-primary-weak:rgba(37,99,235,.12);
  --w-link:#1d4ed8;
}

/* base */
.wos-shell{background:var(--w-bg); color:var(--w-fg); min-height:100vh;}
.wos-wrap{max-width:1000px; margin:0 auto; padding:0 16px;}
.wos-muted{color:var(--w-muted);}
.wos-mono{font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;}
.wos-a{color:var(--w-link); text-decoration:none;}
.wos-a:hover{text-decoration:underline;}

/* home layout */
.wos-home{padding:18px 0 30px;}
.wos-home-grid{display:grid; grid-template-columns: 1fr; gap:16px; align-items:start;}
.wos-panel{
  background:var(--w-card);
  border:1px solid var(--w-border);
  border-radius:16px;
  box-shadow:var(--w-shadow);
  padding:14px;
}
.wos-panel h2{margin:0 0 10px; font-size:18px; letter-spacing:-.2px;}
.wos-row{display:flex; align-items:center; justify-content:space-between; gap:12px;}
.wos-btn{
  display:inline-flex; align-items:center; justify-content:center;
  padding:8px 12px;
  border-radius:12px;
  border:1px solid var(--w-border);
  background:var(--w-card);
  color:var(--w-fg);
  cursor:pointer;
  text-decoration:none;
  font-weight:800;
  font-size:13px;
  white-space:nowrap;
}
.wos-btn:hover{outline:1px solid var(--w-border);}

.wos-btnrow{
  display:flex;
  gap:10px;
  justify-content:flex-end;
  flex-wrap:wrap;
  margin-top:12px;
}
@media (max-width: 520px){
  .wos-btnrow{justify-content:stretch;}
  .wos-btnrow .wos-btn{flex:1;}
}

.wos-badge{
  display:inline-flex; align-items:center;
  font-size:12px; font-weight:900;
  padding:5px 9px;
  border-radius:999px;
  border:1px solid var(--w-border);
  background:rgba(37,99,235,.10);
}
.wos-list{display:flex; flex-direction:column; gap:10px; margin-top:10px;}
.wos-item{
  display:flex; align-items:flex-start; gap:10px;
  padding:10px 10px;
  border-radius:14px;
  border:1px solid var(--w-border);
  background:rgba(2,6,23,.02);
  text-decoration:none;
  color:var(--w-fg);
}
.wos-item:hover{outline:1px solid var(--w-border); background:rgba(37,99,235,.08);}
.wos-item-title{font-weight:900; margin:0; line-height:1.25;}
.wos-item-meta{font-size:12px; color:var(--w-muted); margin-top:4px;}

/* grids */
.wos-grid3{display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px;}
@media (max-width: 980px){ .wos-grid3{grid-template-columns: repeat(2, minmax(0, 1fr));} }
@media (max-width: 640px){ .wos-grid3{grid-template-columns: 1fr;} }

.wos-tiles{display:grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap:12px;}
@media (max-width: 980px){ .wos-tiles{grid-template-columns: repeat(2, minmax(0, 1fr));} }
@media (max-width: 640px){ .wos-tiles{grid-template-columns: 1fr;} }

.wos-tile{
  display:flex; gap:12px; align-items:center;
  padding:12px;
  border-radius:16px;
  border:1px solid var(--w-border);
  background:rgba(2,6,23,.02);
  text-decoration:none;
  color:var(--w-fg);
}
.wos-tile:hover{outline:1px solid var(--w-border); background:rgba(37,99,235,.08);}
.wos-iconbox{
  width:48px; height:48px;
  border-radius:14px;
  border:1px solid var(--w-border);
  background:rgba(37,99,235,.10);
  display:flex; align-items:center; justify-content:center;
}
.wos-iconbox img{width:100%; height:100%; object-fit:cover; border-radius:14px; display:block;}
.wos-tile-title{font-weight:950; margin:0; line-height:1.2;}

/* keep existing modules readable (best-effort) */
.container{max-width:1500px;}
.panel, .card{
  background:var(--w-card) !important;
  border-color:var(--w-border) !important;
  color:var(--w-fg) !important;
}
.muted{color:var(--w-muted) !important;}
.topbar{border-color:var(--w-border) !important;}
.btn{border-color:var(--w-border) !important;}
.btn.primary{
  background:var(--w-primary) !important;
  border-color:rgba(37,99,235,.55) !important;
  color:#fff !important;
}
`;
    document.head.appendChild(st);
  }

  // =========================
  // 10) Shell / Title / Menu / Drawer
  // =========================
  function setDocTitle(pageTitle = "") {
    const tx = String(pageTitle || "").trim();
    document.title = tx ? `${tx} · ${SITE_NAME}` : SITE_NAME;
  }

  function inferTitleFromView(view) {
    if (!view) return "";
    const h1 = view.querySelector("h1");
    if (h1 && h1.textContent) return h1.textContent.trim();
    const h2 = view.querySelector("h2");
    if (h2 && h2.textContent) return h2.textContent.trim();
    const titleEl = view.querySelector("[data-page-title]");
    if (titleEl && titleEl.textContent) return titleEl.textContent.trim();
    return "";
  }

  function setActiveMenu(_path) {
    const links = document.querySelectorAll(".wos-menu a[data-link], a[data-link].wos-menu-link");
    const path = _path || getPath();
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const ap = toAppPathFromHref(href) || "";
      const isHome = ap === "/" && (path === "/" || path === "");
      const isMatch = isHome || (ap !== "/" && (path === ap || path.startsWith(ap + "/")));
      if (isMatch) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
  }

  function ensureShellMounted() {
    const el = $app();
    if (!el) return null;

    if (el.getAttribute(SHELL_MARKER) === "1" && el.querySelector("#view")) {
      return el.querySelector("#view");
    }

    el.innerHTML = `
      <div class="wos-shell">
        <main class="wos-wrap" style="padding: 14px 0 30px;">
          <div id="wosTitle" class="wos-muted" style="font-size:12px;margin:4px 0 10px; display:none;"></div>
          <div id="view"></div>
        </main>
      </div>
    `;

    el.setAttribute(SHELL_MARKER, "1");
    return el.querySelector("#view");
  }

  function getViewEl() {
    return document.querySelector("#view") || $app();
  }

  function initDrawerOnce() {
    if (window.__WOS_DRAWER_BOUND__) return;

    const menuBtn = document.getElementById("menuBtn");
    const drawer = document.getElementById("drawer");
    const backdrop = document.getElementById("drawerBackdrop");
    const closeBtn = document.getElementById("drawerClose");

    if (!menuBtn || !drawer || !backdrop || !closeBtn) return;

    window.__WOS_DRAWER_BOUND__ = true;

    const openDrawer = () => {
      drawer.classList.add("is-open");
      drawer.setAttribute("aria-hidden", "false");
      menuBtn.setAttribute("aria-expanded", "true");
      backdrop.hidden = false;
      document.body.classList.add("drawer-open");
      document.body.style.overflow = "hidden";
    };

    const closeDrawer = () => {
      drawer.classList.remove("is-open");
      drawer.setAttribute("aria-hidden", "true");
      menuBtn.setAttribute("aria-expanded", "false");
      backdrop.hidden = true;
      document.body.classList.remove("drawer-open");
      document.body.style.overflow = "";
    };

    menuBtn.addEventListener("click", openDrawer);
    closeBtn.addEventListener("click", closeDrawer);
    backdrop.addEventListener("click", closeDrawer);

    drawer.addEventListener("click", (e) => {
      const t = e && e.target;
      if (!t || !t.closest) return;
      const a = t.closest("a[data-nav],a[data-link],a");
      if (a) closeDrawer();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });

    window.addEventListener("popstate", closeDrawer);

    const syncActive = () => {
      const path = getPath();
      drawer.querySelectorAll(".wos-drawer-link").forEach((a) => {
        const ap = toAppPathFromHref(a.getAttribute("href") || "") || "";
        a.classList.toggle("active", ap && (path === ap || path.startsWith(ap + "/")));
      });
    };

    window.addEventListener("popstate", syncActive);
    syncActive();
  }

  function renderShell({ path, title = "", contentHTML = "" } = {}) {
    const view = ensureShellMounted();
    if (!view) return null;

    const titleEl = document.querySelector("#wosTitle");
    if (titleEl) {
      const tx = String(title || "");
      if (tx) {
        titleEl.style.display = "";
        titleEl.textContent = tx;
      } else {
        titleEl.style.display = "none";
        titleEl.textContent = "";
      }
    }

    setDocTitle(title || "");

    if (typeof contentHTML === "string" && contentHTML) view.innerHTML = contentHTML;

    setActiveMenu(path || getPath());
    initDrawerOnce();
    applyI18n(document);

    // shell이 만든 DOM도 리소스/외부링크 보정
    rewriteDomResources(view);
    rewriteExternalLinks(view);

    return view;
  }

  // =========================
  // 11) Error screen
  // =========================
  function getState() {
    return (window.WOS_APP_STATE && typeof window.WOS_APP_STATE === "object")
      ? window.WOS_APP_STATE
      : {};
  }

  function showError(err, extra = {}) {
    console.error(err);

    const path = getPath();
    const attempted = Array.isArray(extra.attempted)
      ? extra.attempted
      : Array.isArray(err?.attempted)
      ? err.attempted
      : [];

    const state = getState();
    const DATA_BASE = state.DATA_BASE;
    const DATA_BASE_HEROES = state.DATA_BASE_HEROES;

    const triedLabel = t("error.tried_urls") || "Tried URLs";
    const errTitle = t("error.title") || "Error";

    const attemptedHTML = attempted.length
      ? `
        <div class="wos-panel" style="margin-top:12px">
          <div class="wos-muted" style="margin-bottom:6px">${esc(triedLabel)}</div>
          <div class="wos-mono" style="font-size:12px">
            ${attempted.map((u) => `<div><code>${esc(u)}</code></div>`).join("")}
          </div>
        </div>
      `
      : "";

    const view = renderShell({ path, title: errTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    view.innerHTML = `
      <div class="wos-panel">
        <h2 style="margin:0 0 8px; font-size:20px;" data-i18n="error.title">${esc(errTitle)}</h2>
        <p class="wos-muted" style="margin:0">${esc(err?.message ?? err)}</p>

        <div style="margin-top:12px; display:grid; gap:8px">
          <div><span class="wos-muted">DATA_BASE (buildings)</span> <code class="wos-mono">${esc(
            DATA_BASE ?? "(not set)"
          )}</code></div>
          <div><span class="wos-muted">Index URL</span> <code class="wos-mono">${esc(
            toAbsResourceUrl((DATA_BASE ?? "") + "/index.json")
          )}</code></div>

          <div style="margin-top:6px"><span class="wos-muted">DATA_BASE_HEROES</span> <code class="wos-mono">${esc(
            DATA_BASE_HEROES ?? "(not set)"
          )}</code></div>
          <div><span class="wos-muted">Heroes Index URL</span> <code class="wos-mono">${esc(
            toAbsResourceUrl((DATA_BASE_HEROES ?? "") + "/{r|sr|ssr}/index.json")
          )}</code></div>
        </div>
      </div>
      ${attemptedHTML}
    `;

    setActiveMenu(path);
    applyI18n(view);
    rewriteDomResources(view);
    rewriteExternalLinks(view);
  }

  // =========================
  // 12) Public API
  // =========================
  function setState(partial) {
    if (!window.WOS_APP_STATE || typeof window.WOS_APP_STATE !== "object") {
      window.WOS_APP_STATE = {};
    }
    if (partial && typeof partial === "object") {
      Object.assign(window.WOS_APP_STATE, partial);
    }
    return window.WOS_APP_STATE;
  }

  function setSiteName(name) {
    const n = String(name || "").trim();
    if (n) SITE_NAME = n;
  }

  window.WOS_CORE = {
    APP_SEL,
    SHELL_MARKER,

    WOS_BASE,
    withBase,
    withRes,
    isExternalLike,

    patchFetchOnce,
    registerServiceWorkerOnce,

    esc,
    nl2br,
    fmtNum,
    normalizeIndex,
    clampStr,
    fmtDateLike,

    toAbsResourceUrl,
    fetchJSONTry,
    fetchJSONTryWithAttempts,
    fetchTextTryWithAttempts,

    toAppPathFromLocation,
    toAppPathFromHref,
    isSpaPath,
    getPath,
    routeHref,

    rewriteDomResources,
    normalizeExternalHref,
    rewriteExternalLinks,
    isExternalAbsoluteUrl,
    ensureExternalTarget,

    waitForGlobal,

    detectI18nBasePath,
    t,
    tOpt,
    tEnum,
    applyI18n,
    initI18n,
    bindLangUIOnce,
    getLangSafe,
    getLocalizedField,

    // ✅ 코어에서 언어 변경 (SPA 리렌더 기본)
    setLang,

    ensureStyles,

    ensureShellMounted,
    renderShell,
    getViewEl,
    setDocTitle,
    inferTitleFromView,
    setActiveMenu,
    initDrawerOnce,

    showError,

    setState,
    setSiteName,
  };

  // core 부팅(안전한 것만)
  patchFetchOnce();
  registerServiceWorkerOnce();
})();

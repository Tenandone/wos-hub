/* =========================================================
   WosHub - js/app.js (Split Build) - FULL (FINAL) ✅ i18n
   - ✅ History API Router (NO HASH):
     (/buildings, /buildings/furnace, /heroes, /heroes/charlie,
      /tools, /tools/building-calculator,
      /tips, /tips/xxx)

   - ✅ GitHub Pages repo prefix 지원 (SPA NAV + RESOURCES)
     * SPA 라우팅: withBase()
     * 정적 리소스(/data,/assets,/i18n): withRes()

   - ✅ popstate 기반 뒤로/앞으로가기 지원
   - ✅ a[data-link] 유지 + (외부 모듈 링크 보호 위해) SPA 라우트에 한해 일반 <a>도 인터셉트
   - ✅ heroes.js / buildings.js / tips.js 등 외부 모듈 수정 없음
   ========================================================= */

(() => {
  "use strict";

  // =========================
  // 1) Config
  // =========================
  // ✅ 고정 (자동 탐지 비활성화) — 실제 값은 Boot에서 withRes()로 확정
  let DATA_BASE = "/data/buildings";        // buildings
  let DATA_BASE_HEROES = "/data/heroes";    // heroes
  const APP_SEL = "#app";

  // tools (fallback key for core calculator.js demo)
  const BUILDING_CALC_KEY = "furnace";

  // shell marker
  const SHELL_MARKER = "data-wos-shell-mounted";

  // site title base
  const SITE_NAME = "WosHub";

  // =========================
  // ✅ GitHub Pages base prefix helper (History Router safe)
  //   - DO NOT derive from location.pathname (it changes per route)
  //   - Prefer <base href>, then currentScript src
  // =========================
  const WOS_BASE = (() => {
    // 1) <base href="...">가 있으면 그 경로를 우선 사용
    try {
      const baseEl = document.querySelector("base[href]");
      if (baseEl) {
        const href = baseEl.getAttribute("href") || "";
        const u = new URL(href, location.href);
        let p = String(u.pathname || "/");
        p = p.replace(/\/index\.html?$/i, "");
        if (p.endsWith("/")) p = p.slice(0, -1);
        return p; // "" or "/repo"
      }
    } catch (_) {}

    // 2) currentScript src에서 "/js/" 앞까지를 base로 추정
    try {
      const cs = document.currentScript;
      const src = cs && cs.src ? String(cs.src) : "";
      if (src) {
        const u = new URL(src, location.href);
        let p = String(u.pathname || "/"); // "/repo/js/app.js"
        p = p.replace(/\/index\.html?$/i, "");
        const idx = p.lastIndexOf("/js/");
        if (idx !== -1) {
          let base = p.slice(0, idx); // "/repo"
          if (base.endsWith("/")) base = base.slice(0, -1);
          return base; // "" or "/repo"
        }
        // fallback: directory of script
        p = p.replace(/\/[^\/]*$/, ""); // "/repo/js"
        if (p.endsWith("/")) p = p.slice(0, -1);
        // if endswith "/js" remove it
        p = p.replace(/\/js$/i, "");
        return p;
      }
    } catch (_) {}

    // 3) 최후: 루트로 간주
    return "";
  })();

  // =========================
  // ✅ withBase(): SPA 라우팅 전용 (pushState / href)
  // =========================
  function withBase(url) {
    const u = String(url ?? "");
    if (!u) return u;

    // keep absolute urls / data urls
    if (
      /^(https?:)?\/\//i.test(u) ||
      u.startsWith("data:") ||
      u.startsWith("blob:") ||
      u.startsWith("mailto:") ||
      u.startsWith("tel:")
    ) {
      return u;
    }

    // normalize path-ish strings
    const norm = u.startsWith("/") ? u : ("/" + u.replace(/^\.?\//, ""));

    // already prefixed
    if (WOS_BASE && norm.startsWith(WOS_BASE + "/")) return norm;

    // SPA routes only
    return (WOS_BASE || "") + norm;
  }

  // =========================
  // ✅ withRes(): 정적 리소스(/data,/assets,/i18n) 전용
  //   - GitHub Pages repo prefix에서도 리소스가 깨지지 않게 WOS_BASE를 붙임
  // =========================
  function withRes(url) {
    const u = String(url ?? "");
    if (!u) return u;

    // keep absolute urls / data urls
    if (
      /^(https?:)?\/\//i.test(u) ||
      u.startsWith("data:") ||
      u.startsWith("blob:") ||
      u.startsWith("mailto:") ||
      u.startsWith("tel:")
    ) {
      return u;
    }

    // normalize
    const norm = u.startsWith("/") ? u : ("/" + u.replace(/^\.?\//, ""));

    // already prefixed
    if (WOS_BASE && norm.startsWith(WOS_BASE + "/")) return norm;

    // prefix always (WOS_BASE==""이면 그대로 "/..." 유지)
    return (WOS_BASE || "") + norm;
  }

  // expose for other modules
  window.WOS_BASE = WOS_BASE;
  window.WOS_URL = withBase;   // SPA NAV
  window.WOS_RES = withRes;    // RESOURCES

  // =========================
  // 2) Utils
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

  // ✅ History href helper (NO HASH) — SPA NAV ONLY
  function routeHref(path) {
    let p = String(path ?? "");
    if (!p.startsWith("/")) p = "/" + p;
    return withBase(p);
  }

  // ✅ i18n basePath (resource path => withRes)
  function detectI18nBasePath() {
    return withRes("/i18n");
  }

  // i18n helper: safe translate (works even if i18n not loaded yet)
  function t(key, vars) {
    try {
      if (window.WOS_I18N && typeof window.WOS_I18N.t === "function") {
        return window.WOS_I18N.t(key, vars);
      }
    } catch (_) {}
    return String(key || "");
  }

  // translation-or-fallback (prevents showing raw key when missing)
  function tOpt(key, fallback = "") {
    const k = String(key || "");
    const v = String(t(k) ?? "");
    if (!k) return String(fallback ?? "");
    if (!v || v === k) return String(fallback ?? "");
    return v;
  }

  // enum translate helper (rarity/class/etc)
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

  // ✅ document.title helper (SPA title translation)
  function setDocTitle(pageTitle = "") {
    const tx = String(pageTitle || "").trim();
    document.title = tx ? `${tx} · ${SITE_NAME}` : SITE_NAME;
  }

  // infer title from view (tips detail etc)
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

  // ✅ fetch URL은 "리소스 기준 절대"로 정규화 (repo prefix 포함)
  function toAbsResourceUrl(raw) {
    const s = String(raw ?? "");
    if (!s) return s;

    if (
      /^(https?:)?\/\//i.test(s) ||
      s.startsWith("data:") ||
      s.startsWith("blob:") ||
      s.startsWith("mailto:") ||
      s.startsWith("tel:")
    ) {
      return s;
    }

    // force absolute path, then prefix repo base
    if (s.startsWith("/")) return withRes(s);
    return withRes("/" + s.replace(/^\.?\//, ""));
  }

  // Try multiple URLs, return parsed JSON
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

  // Try multiple URLs, return { data, usedUrl, attempted }
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

  // wait for global module (stabilize race conditions)
  function waitForGlobal(_name, testFn, timeoutMs = 1400, interval = 50) {
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
        try { clearInterval(tmr); } catch (_) {}
        finish(ok());
      }, timeoutMs + 150);
    });
  }

  // Deterministic "daily random" pick:
  function hashStringToInt(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      let x = (seed += 0x6D2B79F5);
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickDailyFixed(items, count = 3) {
    const list = (items || []).slice();
    if (!list.length) return [];

    const d = new Date();
    const key =
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

    const rnd = mulberry32(hashStringToInt(key));

    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    return list.slice(0, Math.min(count, list.length));
  }

  // ✅ 자동 탐지 로직 비활성화 (고정값 반환) — repo prefix 포함
  async function detectDataBaseBuildings() {
    return withRes("/data/buildings");
  }

  async function detectDataBaseHeroes() {
    return withRes("/data/heroes");
  }

  // =========================
  // 2.5) i18n Integration (matches YOUR i18n.js)
  // =========================
  async function initI18n() {
    if (!window.WOS_I18N || typeof window.WOS_I18N.init !== "function") {
      return { ok: false, lang: (document.documentElement.getAttribute("lang") || "en").toLowerCase() || "en" };
    }

    const basePath = detectI18nBasePath();

    const lang = await window.WOS_I18N.init({
      defaultLang: (document.documentElement.getAttribute("lang") || "en").toLowerCase(),
      supported: ["en", "ko", "ja"],
      basePath,
      files: ["common.json", "buildings.json", "heroes.json", "calc.json"],
    });

    bindLangUIOnce();
    applyI18n(document);

    if (!window.__WOS_I18N_LANGCHANGE_BOUND__) {
      window.__WOS_I18N_LANGCHANGE_BOUND__ = true;
      window.addEventListener("wos:langchange", () => {
        applyI18n(document);
        try { router().catch(() => {}); } catch (_) {}
      });
    }

    return { ok: true, lang: lang || (window.WOS_I18N.getLang ? window.WOS_I18N.getLang() : "en") };
  }

  // current language safe
  function getLangSafe() {
    try {
      const v =
        (window.WOS_I18N && typeof window.WOS_I18N.getLang === "function" && window.WOS_I18N.getLang()) ||
        document.documentElement.getAttribute("lang") ||
        "en";
      const l = String(v).toLowerCase();
      return (l === "ko" || l === "ja" || l === "en") ? l : "en";
    } catch (_) {
      return "en";
    }
  }

  // JSON localized field: string | {en,ko,ja} | {i18n:{...}}
  function getLocalizedField(value, lang, fallback = "") {
    const l = (lang === "ko" || lang === "ja" || lang === "en") ? lang : "en";
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

  // Back-compat: #langSelect / [data-lang-link]
  function bindLangUIOnce() {
    if (window.__WOS_LANG_UI_BOUND__) return;
    window.__WOS_LANG_UI_BOUND__ = true;

    document.addEventListener("change", (e) => {
      const sel = e.target && e.target.closest && e.target.closest("#langSelect,[data-lang-select='1']");
      if (!sel) return;

      const v = String(sel.value || "").toLowerCase();
      if (!window.WOS_I18N) return;
      if (typeof window.WOS_I18N.setLang === "function") window.WOS_I18N.setLang(v);
    });

    document.addEventListener("click", (e) => {
      const btn = e.target.closest("[data-lang-link]");
      if (!btn) return;

      if (btn.tagName === "A") {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || btn.target === "_blank") return;
      }

      const v = String(btn.getAttribute("data-lang-link") || "").toLowerCase();
      if (!v) return;

      if (window.WOS_I18N && typeof window.WOS_I18N.setLang === "function") {
        e.preventDefault();
        window.WOS_I18N.setLang(v);
      }
    });
  }

  // =========================
  // 2.6) Minimal Styles (NO THEME)
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
  font-weight:700;
  font-size:13px;
}
.wos-btn:hover{outline:1px solid var(--w-border);}
.wos-badge{
  display:inline-flex; align-items:center;
  font-size:12px; font-weight:800;
  padding:5px 9px;
  border-radius:999px;
  border:1px solid var(--w-border);
  background:color-mix(in srgb, var(--w-primary-weak) 55%, transparent);
}
.wos-list{display:flex; flex-direction:column; gap:10px; margin-top:10px;}
.wos-item{
  display:flex; align-items:flex-start; gap:10px;
  padding:10px 10px;
  border-radius:14px;
  border:1px solid var(--w-border);
  background:color-mix(in srgb, var(--w-card) 92%, transparent);
  text-decoration:none;
  color:var(--w-fg);
}
.wos-item:hover{outline:1px solid var(--w-border); background:color-mix(in srgb, var(--w-primary-weak) 28%, transparent);}
.wos-item-title{font-weight:800; margin:0; line-height:1.25;}
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
  background:color-mix(in srgb, var(--w-card) 92%, transparent);
  text-decoration:none;
  color:var(--w-fg);
}
.wos-tile:hover{outline:1px solid var(--w-border); background:color-mix(in srgb, var(--w-primary-weak) 28%, transparent);}
.wos-iconbox{
  width:48px; height:48px;
  border-radius:14px;
  border:1px solid var(--w-border);
  background:color-mix(in srgb, var(--w-primary-weak) 45%, transparent);
  display:flex; align-items:center; justify-content:center;
}
.wos-iconbox img{width:100%; height:100%; object-fit:cover; border-radius:14px; display:block;}
.wos-tile-title{font-weight:900; margin:0; line-height:1.2;}

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
  border-color:color-mix(in srgb, var(--w-primary) 70%, var(--w-border)) !important;
  color:#fff !important;
}
`;
    document.head.appendChild(st);
  }

  // =========================
  // 3) App Shell (View Root only)
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
    if (h.startsWith("#")) return null; // hash 금지 (혼합 모드 방지)

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
      // relative-like
      let p = h;
      // already base-prefixed?
      if (WOS_BASE && p.startsWith(WOS_BASE + "/")) p = p.slice(WOS_BASE.length) || "/";
      if (!p.startsWith("/")) p = "/" + p;
      if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
      return p || "/";
    }
  }

  function isSpaPath(appPath) {
    const p = String(appPath || "/");
    return (
      p === "/" ||
      p === "/buildings" || p.startsWith("/buildings/") ||
      p === "/heroes" || p.startsWith("/heroes/") ||
      p === "/tips" || p.startsWith("/tips/") ||
      p === "/tools" || p.startsWith("/tools/")
    );
  }

  function setActiveMenu(_path) {
    const links = document.querySelectorAll(".wos-menu a[data-link]");
    const path = _path || getPath();
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const ap = toAppPathFromHref(href) || "";
      const isHome = ap === "/" && (path === "/" || path === "");
      const isMatch =
        isHome ||
        (ap !== "/" && (path === ap || path.startsWith(ap + "/")));
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

    // Render shell ONCE (NO HEADER here)
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

    // ✅ SPA document title
    setDocTitle(title || "");

    if (typeof contentHTML === "string" && contentHTML) view.innerHTML = contentHTML;

    setActiveMenu(path || getPath());
    initDrawerOnce();
    applyI18n(document);

    return view;
  }

  function getViewEl() {
    return document.querySelector("#view") || $app();
  }

  // =========================
  // 4) Error screen
  // =========================
  function showError(err, extra = {}) {
    console.error(err);

    const path = getPath();
    const attempted =
      Array.isArray(extra.attempted) ? extra.attempted :
      Array.isArray(err?.attempted) ? err.attempted :
      [];

    const triedLabel = t("error.tried_urls") || "Tried URLs";
    const errTitle = t("error.title") || "Error";

    const attemptedHTML = attempted.length
      ? `
        <div class="wos-panel" style="margin-top:12px">
          <div class="wos-muted" style="margin-bottom:6px">${esc(triedLabel)}</div>
          <div class="wos-mono" style="font-size:12px">
            ${attempted.map(u => `<div><code>${esc(u)}</code></div>`).join("")}
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
          <div><span class="wos-muted">DATA_BASE (buildings)</span> <code class="wos-mono">${esc(DATA_BASE ?? "(not set)")}</code></div>
          <div><span class="wos-muted">Index URL</span> <code class="wos-mono">${esc(toAbsResourceUrl((DATA_BASE ?? "") + "/index.json"))}</code></div>
          <div style="margin-top:6px"><span class="wos-muted">DATA_BASE_HEROES</span> <code class="wos-mono">${esc(DATA_BASE_HEROES ?? "(not set)")}</code></div>
          <div><span class="wos-muted">Heroes Index URL</span> <code class="wos-mono">${esc(toAbsResourceUrl((DATA_BASE_HEROES ?? "") + "/{r|sr|ssr}/index.json"))}</code></div>
        </div>
      </div>
      ${attemptedHTML}
    `;

    setActiveMenu(path);
    applyI18n(view);
  }

  // =========================
  // 5) History Router (NO HASH)
  // =========================
  function getPath() {
    return toAppPathFromLocation();
  }

  function go(path) {
    let p = String(path ?? "").trim();
    const appPath = toAppPathFromHref(p) || (p.startsWith("/") ? p : (p ? ("/" + p) : "/"));
    if (!isSpaPath(appPath)) return;

    history.pushState({}, "", withBase(appPath));
    router().catch((err) => showError(err));
  }

  function bindLinkInterceptOnce() {
    if (window.__WOS_LINK_INTERCEPT_BOUND__) return;
    window.__WOS_LINK_INTERCEPT_BOUND__ = true;

    document.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;

      // modifiers / new tab / downloads: pass through
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (a.target === "_blank") return;
      if (a.hasAttribute("download")) return;

      const href = a.getAttribute("href") || "";
      if (!href) return;

      // external links -> pass through
      if (/^(https?:)?\/\//i.test(href)) {
        try {
          const u = new URL(href, location.href);
          if (u.origin !== location.origin) return;
        } catch (_) {
          return;
        }
      }

      // Only intercept:
      //  - a[data-link] 유지
      //  - + 외부 모듈이 생성하는 일반 <a href="/heroes/..."> 도 SPA 라우트에 한해 인터셉트
      const isDataLink = a.hasAttribute("data-link");
      const appPath = toAppPathFromHref(href);

      if (!appPath) return;
      if (!isSpaPath(appPath)) return;
      if (!isDataLink && a.closest("#view") == null) return; // data-link 아니면 #view 내부만 인터셉트

      e.preventDefault();
      go(appPath);
    });
  }

  function bindPopStateOnce() {
    if (window.__WOS_POPSTATE_BOUND__) return;
    window.__WOS_POPSTATE_BOUND__ = true;

    window.addEventListener("popstate", () => {
      router().catch((err) => showError(err));
    });
  }

  // =========================
  // 5.5) Drawer (Off-canvas) — unified + guarded
  // =========================
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
      const a = e.target.closest("a[data-nav],a[data-link]");
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

  // =========================
  // 6) Home data (latest uploads)
  // =========================
  async function loadLatestUploads() {
    const candidates = ["/data/home/latest.json"];
    try {
      const r = await fetchJSONTryWithAttempts(candidates);
      const list = normalizeIndex(r.data);
      return list.slice(0, 10);
    } catch (_) {
      return [];
    }
  }

  function normLatestItem(it) {
    const category = it?.category ?? it?.type ?? it?.badge ?? "Update";
    const title = it?.title ?? it?.name ?? it?.label ?? it?.slug ?? "Untitled";
    const date = fmtDateLike(it?.date ?? it?.time ?? it?.updatedAt ?? it?.createdAt ?? "");
    let href = it?.href ?? it?.url ?? it?.link ?? it?.path ?? "";

    const ap = href ? (toAppPathFromHref(href) || (href.startsWith("/") ? href : "")) : "";
    if (ap && isSpaPath(ap)) href = routeHref(ap);
    else href = routeHref("/");

    return { category, title, date, href };
  }

  // =========================
  // 6.3) Tips data (home preview only)
  // =========================
  async function loadTipsIndex() {
    const candidates = ["/data/tips/index.json"];
    const r = await fetchJSONTryWithAttempts(candidates);
    const items = normalizeIndex(r.data);
    return items.filter(it => (it?.status ?? "published") === "published");
  }

  function normTipItem(it) {
    const title = it?.title ?? it?.name ?? it?.slug ?? "Tip";
    const slug = String(it?.slug ?? "");
    const date = fmtDateLike(it?.date ?? it?.updatedAt ?? it?.createdAt ?? "");
    const category = it?.category ?? it?.tag ?? "Tip";
    return { title, slug, date, category };
  }

  // =========================
  // 7) Routing
  // =========================
  async function router() {
    const path = getPath();

    // buildings
    if (path.startsWith("/buildings/") && path.split("/").length >= 3) {
      let slug = path.replace("/buildings/", "");
      try { slug = decodeURIComponent(slug); } catch (_) {}
      return pageBuilding(slug);
    }
    if (path === "/buildings") return pageBuildings();

    // heroes
    if (path.startsWith("/heroes/") && path.split("/").length >= 3) {
      let slug = path.replace("/heroes/", "");
      try { slug = decodeURIComponent(slug); } catch (_) {}
      return pageHero(slug);
    }
    if (path === "/heroes") return pageHeroes();

    // tools
    if (path === "/tools") return pageTools();
    if (path === "/tools/building-calculator") return pageBuildingCalculator();

    // tips
    if (path === "/tips") return pageTips();
    if (path.startsWith("/tips/") && path.split("/").length >= 3) {
      const slug = path.replace("/tips/", "");
      return pageTip(slug);
    }

    // home
    return pageHome();
  }

  // =========================
  // 8) Pages
  // =========================
  async function pageHome() {
    const path = getPath();
    const view = renderShell({ path, title: "", contentHTML: "" }) || getViewEl();
    if (!view) return;

    const lang = getLangSafe();

    // Tips — daily fixed random
    let todaysTips = [];
    try {
      const tipsAll = (await loadTipsIndex()).map(normTipItem);
      todaysTips = pickDailyFixed(tipsAll, 3);
    } catch (_) {
      todaysTips = [];
    }

    // Latest uploads (local only)
    const latestRaw = await loadLatestUploads();
    const latest = latestRaw.map(normLatestItem).slice(0, 10);

    view.innerHTML = `
      <section class="wos-home">
        <div class="wos-home-grid">

          <!-- 1) Quick Cards -->
          <div class="wos-panel">
            <div class="wos-row" style="margin-bottom:10px;">
              <div>
                <h2 style="margin:0 0 6px;" data-i18n="home.quick_access">${esc(t("home.quick_access") || "Quick Access")}</h2>
              </div>
            </div>

            <div class="wos-tiles">
              <a class="wos-tile wos-tile--img" href="${routeHref("/buildings")}" data-link>
                <div class="wos-iconbox">
                  <img src="${esc(withRes("/assets/buildings/furnace/firecrystal_img/furnace.png"))}" alt="Buildings" loading="lazy">
                </div>
                <div style="min-width:0;">
                  <div class="wos-tile-title" data-i18n="nav.buildings">${esc(t("nav.buildings") || "Buildings")}</div>
                </div>
              </a>

              <a class="wos-tile wos-tile--img" href="${routeHref("/heroes")}" data-link>
                <div class="wos-iconbox">
                  <img src="${esc(withRes("/assets/heroes/ssr/s1/jeronimo/img/jeronimo.png"))}" alt="Heroes" loading="lazy">
                </div>
                <div style="min-width:0;">
                  <div class="wos-tile-title" data-i18n="nav.heroes">${esc(t("nav.heroes") || "Heroes")}</div>
                </div>
              </a>

              <a class="wos-tile wos-tile--img" href="${routeHref("/tools/building-calculator")}" data-link>
                <div class="wos-iconbox">
                  <img src="${esc(withRes("/assets/heroes/ssr/s1/zinman/img/zinman.png"))}" alt="Calculator" loading="lazy">
                </div>
                <div style="min-width:0;">
                  <div class="wos-tile-title" data-i18n="nav.calculator">${esc(t("nav.calculator") || "Calculator")}</div>
                </div>
              </a>
            </div>
          </div>

          <!-- 2) Today’s Tips -->
          <div class="wos-panel">
            <div class="wos-row">
              <div>
                <h2 style="margin:0 0 6px;" data-i18n="home.todays_tips">${esc(t("home.todays_tips") || "Today’s Tips")}</h2>
              </div>
              <a class="wos-btn" href="${routeHref("/tips")}" data-link data-i18n="home.see_all_tips">${esc(t("home.see_all_tips") || "See All Tips")}</a>
            </div>

            ${
              todaysTips.length
                ? `<div class="wos-grid3" style="margin-top:12px;">
                    ${todaysTips.map((ti, i) => {
                      const titleTxt = getLocalizedField(ti.title, lang, "Tip");
                      const catTxt = getLocalizedField(ti.category, lang, "Tip");
                      const slugEnc = encodeURIComponent(String(ti.slug || ""));
                      const dateTxt = ti.date ? String(ti.date) : "";

                      return `
                        <a class="wos-item" href="${routeHref(`/tips/${slugEnc}`)}" data-link style="flex-direction:column;">
                          <div style="display:flex; align-items:center; gap:10px; width:100%;">
                            <div class="wos-badge">${esc(String(i + 1))}</div>
                            <div class="wos-item-title" style="margin:0; flex:1; min-width:0;">
                              ${esc(clampStr(titleTxt, 60))}
                            </div>
                          </div>
                          <div class="wos-item-meta" style="margin-top:8px;">
                            ${esc(catTxt)}
                            ${dateTxt ? ` · ${esc(dateTxt)}` : ""}
                          </div>
                        </a>
                      `;
                    }).join("")}
                  </div>`
                : `<div class="wos-muted" style="font-size:13px; line-height:1.65;" data-i18n="home.no_tips">
                    ${esc(t("home.no_tips") || "No tips data yet.")}
                  </div>`
            }
          </div>

          <!-- 3) Latest Uploads -->
          <div class="wos-panel">
            <h2 data-i18n="home.latest_uploads">${esc(t("home.latest_uploads") || "Latest Uploads")}</h2>
            ${
              latest.length
                ? `<div class="wos-list">
                    ${latest.map((it) => {
                      const catTxt = getLocalizedField(it.category, lang, "Update");
                      const titleTxt = getLocalizedField(it.title, lang, "Untitled");
                      const dateTxt = it.date ? String(it.date) : "";

                      return `
                        <a class="wos-item" href="${esc(it.href)}" data-link>
                          <div class="wos-badge">${esc(catTxt)}</div>
                          <div style="flex:1; min-width:0;">
                            <div class="wos-item-title">${esc(clampStr(titleTxt, 70))}</div>
                            <div class="wos-item-meta">${esc(dateTxt)}</div>
                          </div>
                        </a>
                      `;
                    }).join("")}
                  </div>`
                : `<div class="wos-muted" style="font-size:13px; line-height:1.65;" data-i18n="home.no_latest">
                    ${esc(t("home.no_latest") || "No latest uploads data.")}
                  </div>`
            }
          </div>

        </div>
      </section>
    `;

    setActiveMenu(path);
    applyI18n(view);
    setDocTitle("");
  }

  // =========================
  // Tips pages (tips.js delegated)
  // =========================
  async function pageTips() {
    const path = getPath();
    const pageTitle = t("nav.tips") || "Tips";
    const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    const ok = await waitForGlobal(
      "WOS_TIPS",
      () => window.WOS_TIPS && typeof window.WOS_TIPS.renderList === "function"
    );

    if (!ok) {
      return showError(new Error("tips.js not loaded (window.WOS_TIPS.renderList missing)."));
    }

    await window.WOS_TIPS.renderList({
      appEl: view,
      go,
      esc,
      clampStr,
      fetchJSONTryWithAttempts,
      t,
      tOpt,
      routeHref,
      withBase
    });

    setActiveMenu(path);
    applyI18n(view);
    setDocTitle(pageTitle);
  }

  async function pageTip(slug) {
    const path = getPath();
    const pageTitle = t("nav.tips") || "Tip";
    const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    const ok = await waitForGlobal(
      "WOS_TIPS",
      () => window.WOS_TIPS && typeof window.WOS_TIPS.renderDetail === "function"
    );

    if (!ok) {
      return showError(new Error("tips.js not loaded (window.WOS_TIPS.renderDetail missing)."));
    }

    await window.WOS_TIPS.renderDetail({
      appEl: view,
      slug,
      go,
      esc,
      nl2br,
      fetchJSONTryWithAttempts,
      t,
      tOpt,
      routeHref,
      withBase
    });

    setActiveMenu(path);
    applyI18n(view);

    const inferred = inferTitleFromView(view);
    setDocTitle(inferred || pageTitle);
  }

  // =========================
  // Tools
  // =========================
  function pageTools() {
    const path = getPath();
    const pageTitle = t("nav.tools") || "Tools";
    const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    view.innerHTML = `
      <div class="wos-panel">
        <h2 style="margin:0 0 10px;" data-i18n="tools.title">${esc(t("tools.title") || "Tools")}</h2>
        <div class="wos-muted" style="font-size:13px; margin-bottom:12px;" data-i18n="tools.subtitle">
          ${esc(t("tools.subtitle") || "Calculators & utilities")}
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
          <a class="wos-item" href="${routeHref("/tools/building-calculator")}" data-link style="align-items:center;">
            <div class="wos-badge" data-i18n="nav.calculator">${esc(t("nav.calculator") || "Calculator")}</div>
            <div style="flex:1;">
              <div class="wos-item-title" data-i18n="tools.building_calc">${esc(t("tools.building_calc") || "Building Calculator")}</div>
              <div class="wos-item-meta wos-mono">/tools/building-calculator</div>
            </div>
          </a>
        </div>
      </div>
    `;

    setActiveMenu(path);
    applyI18n(view);
    setDocTitle(pageTitle);
  }

  async function pageBuildingCalculator() {
    const path = getPath();
    const pageTitle = t("tools.building_calc") || "Building Calculator";
    const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    view.innerHTML = `<div class="wos-panel" id="calcRoot"></div>`;

    const root = view.querySelector("#calcRoot");
    if (!root) return;

    const okFinal = await waitForGlobal(
      "WOS_BUILDING_CALC",
      () => window.WOS_BUILDING_CALC && typeof window.WOS_BUILDING_CALC.initCalculator === "function"
    );

    if (okFinal) {
      try {
        const ret = await window.WOS_BUILDING_CALC.initCalculator({
          DATA_BASE,
          appEl: root,
          fetchJSONTry,
          t,
          tOpt,
          withBase,
          routeHref
        });
        applyI18n(root);
        setDocTitle(pageTitle);
        return ret;
      } catch (err) {
        return showError(err);
      }
    }

    const okFallback = await waitForGlobal(
      "WOS_CALC",
      () => window.WOS_CALC && typeof window.WOS_CALC.render === "function"
    );

    if (!okFallback) {
      return showError(new Error("Calculator modules not loaded (window.WOS_BUILDING_CALC.initCalculator / window.WOS_CALC.render missing)."));
    }

    const ctx = { go, esc, fmtNum, t, tOpt, withBase, routeHref };
    try {
      window.WOS_CALC.render({ root, key: BUILDING_CALC_KEY, ctx });
      applyI18n(root);
      setDocTitle(pageTitle);
    } catch (err) {
      return showError(err);
    }
  }

  // =========================
  // Buildings ✅ i18n pass-through already included
  // =========================
  async function pageBuildings() {
    const path = getPath();
    const pageTitle = t("nav.buildings") || "Buildings";
    const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    const ok = await waitForGlobal(
      "WOS_BUILDINGS",
      () => window.WOS_BUILDINGS && typeof window.WOS_BUILDINGS.renderList === "function"
    );

    if (!ok) {
      return showError(new Error("buildings.js is not loaded (window.WOS_BUILDINGS.renderList missing)."));
    }

    const ret = await window.WOS_BUILDINGS.renderList({
      DATA_BASE,
      appEl: view,
      showError,
      esc,
      fetchJSONTry,
      t,
      tOpt,
      withBase,
      routeHref
    });

    setActiveMenu(path);
    applyI18n(view);
    setDocTitle(pageTitle);
    return ret;
  }

  async function pageBuilding(slug) {
    const path = getPath();
    const pageTitle = t("nav.buildings") || "Building Detail";
    const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    const ok = await waitForGlobal(
      "WOS_BUILDINGS",
      () => window.WOS_BUILDINGS && typeof window.WOS_BUILDINGS.renderDetail === "function"
    );

    if (!ok) {
      return showError(new Error("buildings.js is not loaded (window.WOS_BUILDINGS.renderDetail missing)."));
    }

    const ret = await window.WOS_BUILDINGS.renderDetail({
      slug,
      DATA_BASE,
      appEl: view,
      go,
      showError,
      esc,
      nl2br,
      fmtNum,
      fetchJSONTry,
      fetchJSONTryWithAttempts,
      normalizeIndex,
      t,
      tOpt,
      withBase,
      routeHref
    });

    setActiveMenu(path);
    applyI18n(view);

    const inferred = inferTitleFromView(view);
    setDocTitle(inferred || pageTitle);

    return ret;
  }

  // =========================
  // Heroes (✅ i18n enabled for fallback + pass-through)
  // =========================
  async function pageHeroes() {
    const path = getPath();
    const pageTitle = t("nav.heroes") || "Heroes";
    const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    if (window.WOS_HEROES && typeof window.WOS_HEROES.renderList === "function") {
      try {
        const ret = await window.WOS_HEROES.renderList(view, {
          t,
          tOpt,
          esc,
          clampStr,
          routeHref,
          go,
          withBase,
          DATA_BASE_HEROES
        });
        applyI18n(view);
        setDocTitle(pageTitle);
        return ret;
      } catch (err) {
        return showError(err);
      }
    }

    const urls = [
      `${DATA_BASE_HEROES}/r/index.json`,
      `${DATA_BASE_HEROES}/sr/index.json`,
      `${DATA_BASE_HEROES}/ssr/index.json`,
    ];

    const attempted = [];
    const combined = [];

    for (const u of urls) {
      try {
        const r = await fetchJSONTryWithAttempts([u]);
        attempted.push(...r.attempted.filter((x) => !attempted.includes(x)));
        combined.push(...normalizeIndex(r.data));
      } catch (err) {
        const at = Array.isArray(err?.attempted) ? err.attempted : [toAbsResourceUrl(u)];
        attempted.push(...at.filter((x) => !attempted.includes(x)));
      }
    }

    if (!combined.length) {
      return showError(new Error("No heroes found in r/sr/ssr index.json"), { attempted });
    }

    view.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        ${combined.map((h) => {
          const slug2 = String(h.slug ?? "");
          const rawTitle = h.title ?? h.name ?? slug2;

          // ✅ FIXED: 문법오류 원인(\` ... \`) 제거 — 정상 템플릿리터럴 사용
          const title = tOpt(`heroes.${slug2}.namename`, rawTitle) || tOpt(`heroes.${slug2}.name`, rawTitle);

          const portrait = h.portrait ?? h.portraitSrc ?? h.image ?? "";
          const rarity = tEnum("hero.rarity", (h.rarity ?? h.tier ?? ""));
          const cls = tEnum("hero.class", (h.class ?? h.heroClass ?? ""));
          const meta = [rarity, cls].filter(Boolean).join(" · ");

          const hrefSlug = encodeURIComponent(slug2);

          return `
            <a class="wos-item"
               href="${routeHref("/heroes/" + hrefSlug)}"
               style="flex-direction:column; align-items:stretch;">
              ${portrait
                ? `<img src="${esc(toAbsResourceUrl(portrait))}" alt="${esc(title)}"
                        style="width:100%;height:auto;border-radius:12px; border:1px solid var(--w-border);"
                        loading="lazy">`
                : ""}

              <div style="display:flex; gap:10px; align-items:flex-start; margin-top:10px;">
                <div class="wos-badge" data-i18n="nav.hero">${esc(t("nav.hero") || "Hero")}</div>
                <div style="flex:1; min-width:0;">
                  <div class="wos-item-title">${esc(clampStr(title, 60))}</div>
                  <div class="wos-item-meta">${esc(meta || "")}</div>
                  <div class="wos-item-meta wos-mono">${esc(slug2)}</div>
                </div>
              </div>
            </a>
          `;
        }).join("")}
      </div>
    `;

    setActiveMenu(path);
    applyI18n(view);
    setDocTitle(pageTitle);
  }

  async function pageHero(slug) {
    const path = getPath();
    const pageTitle = t("nav.heroes") || "Hero Detail";
    const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
    if (!view) return;

    // ✅ DATA_BASE_HEROES is fixed already

    if (window.WOS_HEROES && typeof window.WOS_HEROES.renderDetail === "function") {
      try {
        const ret = await window.WOS_HEROES.renderDetail(view, slug, {
          t,
          tOpt,
          esc,
          nl2br,
          fmtNum,
          routeHref,
          go,
          withBase,
          DATA_BASE_HEROES
        });
        applyI18n(view);
        const inferred = inferTitleFromView(view);
        setDocTitle(inferred || pageTitle);
        return ret;
      } catch (err) {
        return showError(err);
      }
    }

    const idxUrls = [
      `${DATA_BASE_HEROES}/r/index.json`,
      `${DATA_BASE_HEROES}/sr/index.json`,
      `${DATA_BASE_HEROES}/ssr/index.json`,
    ];

    const attempted = [];
    let foundRarityDir = null;

    for (const u of idxUrls) {
      try {
        const r = await fetchJSONTryWithAttempts([u]);
        attempted.push(...r.attempted.filter((x) => !attempted.includes(x)));
        const list = normalizeIndex(r.data);
        if (list.some((it) => String(it?.slug ?? "") === String(slug))) {
          if (u.includes("/r/")) foundRarityDir = "r";
          else if (u.includes("/sr/")) foundRarityDir = "sr";
          else if (u.includes("/ssr/")) foundRarityDir = "ssr";
          break;
        }
      } catch (err) {
        const at = Array.isArray(err?.attempted) ? err.attempted : [toAbsResourceUrl(u)];
        attempted.push(...at.filter((x) => !attempted.includes(x)));
      }
    }

    if (!foundRarityDir) {
      return showError(new Error("Hero not found in any rarity index.json: " + slug), { attempted });
    }

    const urls = [
      `${DATA_BASE_HEROES}/${foundRarityDir}/${slug}.json`,
      `${DATA_BASE_HEROES}/${foundRarityDir}/${encodeURIComponent(slug)}.json`,
    ];

    let hero, attempted2;
    try {
      const r = await fetchJSONTryWithAttempts(urls);
      hero = r.data;
      attempted2 = r.attempted;
    } catch (err) {
      return showError(err, { attempted: attempted.concat(err?.attempted || attempted2 || urls.map(toAbsResourceUrl)) });
    }

    const rawTitle = hero?.title ?? hero?.name ?? slug;
    const title = tOpt(`heroes.${slug}.name`, rawTitle);

    const portrait = hero?.portrait ?? hero?.portraitSrc ?? hero?.image ?? "";
    const rarity = tEnum("hero.rarity", (hero?.rarity ?? ""));
    const cls = tEnum("hero.class", (hero?.class ?? hero?.heroClass ?? ""));
    const sub = tEnum("hero.subclass", (hero?.subClass ?? hero?.subclass ?? ""));

    const storyHtmlFromI18n = tOpt(`heroes.${slug}.story_html`, "");
    const storyTextFromI18n = tOpt(`heroes.${slug}.story`, "");

    const descHtmlFromI18n = tOpt(`heroes.${slug}.description_html`, "");
    const descTextFromI18n = tOpt(`heroes.${slug}.description`, "");

    const storyHtml =
      storyHtmlFromI18n ||
      hero?.story?.html ||
      hero?.storyHtml ||
      (typeof hero?.story === "string" ? hero.story : "");

    const descHtml = descHtmlFromI18n || (hero?.descriptionHtml ?? "");
    const descText =
      !descHtml
        ? (descTextFromI18n || (hero?.description ?? ""))
        : "";

    const skills = Array.isArray(hero?.skills) ? hero.skills : [];
    const skillsHtml = skills.length
      ? `
        <div class="wos-panel" style="margin-top:12px">
          <h2 style="margin:0 0 10px;" data-i18n="hero.skills">${esc(t("hero.skills") || "Skills")}</h2>
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
            ${skills.map((sk, idx) => {
              const rawSt = sk?.title ?? sk?.name ?? "Skill";
              const st = tOpt(`heroes.${slug}.skills.${idx}.name`, rawSt);

              const icon = sk?.icon ?? sk?.iconSrc ?? sk?.image ?? "";

              const sHtmlI18n = tOpt(`heroes.${slug}.skills.${idx}.description_html`, "");
              const sTxtI18n = tOpt(`heroes.${slug}.skills.${idx}.description`, "");

              const sHtml = sHtmlI18n || sk?.descriptionHtml || sk?.descHtml || "";
              const sTxt = !sHtml ? (sTxtI18n || (sk?.description ?? sk?.desc ?? "")) : "";

              return `
                <div class="wos-panel" style="padding:12px;">
                  <div style="display:flex; gap:10px; align-items:center;">
                    ${icon ? `<img src="${esc(toAbsResourceUrl(icon))}" alt="${esc(st)}" style="width:40px;height:40px;border-radius:10px; border:1px solid var(--w-border);" loading="lazy">` : ""}
                    <div style="font-weight:900;">${esc(st)}</div>
                  </div>
                  ${sHtml ? `<div class="wos-muted" style="margin-top:8px; font-size:13px;">${sHtml}</div>` : (sTxt ? `<div class="wos-muted" style="margin-top:8px; font-size:13px;">${nl2br(sTxt)}</div>` : "")}
                </div>
              `;
            }).join("")}
          </div>
        </div>
      `
      : "";

    const storyBlock =
      storyHtml
        ? `<div class="wos-panel" style="margin-top:12px">${storyHtml}</div>`
        : (storyTextFromI18n ? `<div class="wos-panel wos-muted" style="margin-top:12px; font-size:13px;">${nl2br(storyTextFromI18n)}</div>` : "");

    view.innerHTML = `
      <div class="wos-panel">
        <div style="display:flex; gap:14px; align-items:flex-start; flex-wrap:wrap;">
          ${portrait ? `<img src="${esc(toAbsResourceUrl(portrait))}" alt="${esc(title)}" style="width:120px;height:auto;border-radius:14px; border:1px solid var(--w-border);" loading="lazy">` : ""}
          <div style="flex:1; min-width:260px;">
            <h2 style="margin:0 0 6px; font-size:22px; letter-spacing:-.3px;">${esc(title)}</h2>
            <div class="wos-muted" style="font-size:13px;">
              ${[
                rarity && `${esc(t("hero.rarity") || "Rarity")}: ${esc(rarity)}`,
                cls && `${esc(t("hero.class") || "Class")}: ${esc(cls)}`,
                sub && `${esc(t("hero.subclass") || "SubClass")}: ${esc(sub)}`
              ].filter(Boolean).join(" · ")}
            </div>
            <div class="wos-muted wos-mono" style="font-size:12px; margin-top:10px;">${esc(slug)}</div>
          </div>
        </div>

        ${
          descHtml
            ? `<div style="margin-top:12px">${descHtml}</div>`
            : (descText ? `<div class="wos-muted" style="margin-top:12px; font-size:13px;">${nl2br(descText)}</div>` : "")
        }

        ${storyBlock}
      </div>

      ${skillsHtml}
    `;

    setActiveMenu(path);
    applyI18n(view);
    setDocTitle(title || pageTitle);
  }

    // =========================
  // 9) Boot
  // =========================
  (async () => {
    // ✅ 404.html 리다이렉트 복구 (History SPA on GitHub Pages)
    (function restoreSpaPathFrom404() {
      try {
        const sp = new URLSearchParams(location.search || "");
        const p = sp.get("p"); // original app path (e.g. "/buildings/furnace")
        const q = sp.get("q"); // original search (e.g. "?x=1")
        const h = sp.get("h"); // original hash (e.g. "#y")

        if (!p) return;

        // ✅ p는 encodeURIComponent로 들어오므로 decode 해야 함
        const appPath = decodeURIComponent(p || "/");
        const qs = q ? decodeURIComponent(q) : "";
        const hs = h ? decodeURIComponent(h) : "";

        const cleanUrl = withBase(appPath) + qs + hs;

        // query(p,q,h) 제거 + 원래 경로로 복원
        history.replaceState({}, "", cleanUrl);
      } catch (_) {}
    })();

    ensureStyles();

    // i18n first
    await initI18n();

    // core bindings
    bindLinkInterceptOnce();
    bindPopStateOnce();

    // drawer bind (if available now)
    initDrawerOnce();

    // ✅ bases are fixed (no auto-detect, no fetch)
    DATA_BASE = await detectDataBaseBuildings();
    DATA_BASE_HEROES = await detectDataBaseHeroes();

    await router();

    // final apply
    applyI18n(document);

    // debug
    window.__WOS_DEV__ = {
      get DATA_BASE() { return DATA_BASE; },
      get DATA_BASE_HEROES() { return DATA_BASE_HEROES; },
      getPath,
      go,
      router,
      withBase,
      withRes,
      routeHref,
      waitForGlobal,
      i18n: () => window.WOS_I18N,
    };
  })().catch((err) => showError(err));
})();

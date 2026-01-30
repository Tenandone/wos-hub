/* =========================================================
   WosHub - js/app.js (Split Build) - FULL (FINAL) ✅ i18n (BUILDINGS READY + HEROES READY)
   - Hash router:
     (#/buildings, #/buildings/furnace, #/heroes, #/heroes/charlie,
      #/coupons, #/coupons/xxx,
      #/tools, #/tools/building-calculator,
      #/tips, #/tips/xxx)

   - DATA_BASE auto-detect:
     - Buildings: data/buildings OR page/data/buildings (+ absolute variants)
     - Heroes:    data/heroes    OR page/data/heroes    (+ absolute variants)
   - index.json supports: { items:[...] } OR [...]

   - Delegates:
     - Buildings -> buildings.js (window.WOS_BUILDINGS)
     - Heroes    -> heroes.js    (window.WOS_HEROES)
     - Tips      -> tips.js      (window.WOS_TIPS)  (list/detail pages)
     - ✅ Coupons -> coupons.js  (window.WOS_COUPONS)  ✅ "호출만" (+ template loader in app.js)

   - Tools:
     - /tools/building-calculator:
         1) Prefer window.WOS_BUILDING_CALC.initCalculator({...})
         2) Fallback to window.WOS_CALC.render({root,key,ctx})

   - ✅ Portal Home (#/)
   - ✅ NO dummy data for tips/latest uploads (show empty state only)

   - ✅ i18n integrated (matches your i18n.js API):
       window.WOS_I18N.init({ defaultLang, supported, basePath, files? })
       window.WOS_I18N.setLang(lang)
       window.WOS_I18N.t(key, vars?)
       window.WOS_I18N.apply(root?)

   - ✅ IMPORTANT FIX:
       - Delegated async renders are now awaited, then applyI18n(view).
         (So data-i18n actually applies after async HTML is injected.)
       - On language change, rerender current route once (so dynamic strings refresh)

   - ✅ Stability fixes:
       - Shell mounted once; only #view updated
       - Drawer binding unified and guarded (no duplicate listeners)
       - Link intercept guarded
       - Hashchange guarded
       - waitForGlobal for WOS_* modules to reduce race issues
       - Header: keep ONLY external header; app.js shell does NOT create a header

   - ✅ Coupons language-template support:
       - If /coupons/index.{lang}.html exists, fetch & inject into #view (body-only)
       - Then call coupons.js renderList() into injected #couponGrid
       - (Optional) update #lastUpdated using coupons.js _fetchCoupons if available
       - (Optional) bind template chips (.chip[data-filter]) to filter [data-coupon-card]

   - ✅ NEW: document.title update support (SPA title translation)
       - renderShell() updates document.title
       - tips detail updates document.title from rendered h2/h1
   ========================================================= */

(() => {
  "use strict";

  // =========================
  // 1) Config
  // =========================
  let DATA_BASE = null;          // buildings
  let DATA_BASE_HEROES = null;   // heroes
  const APP_SEL = "#app";

  // tools (fallback key for core calculator.js demo)
  const BUILDING_CALC_KEY = "furnace";

  // shell marker
  const SHELL_MARKER = "data-wos-shell-mounted";

  // site title base
  const SITE_NAME = "WosHub";

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
    return [];
  }

  // Hash href helper
  function routeHref(path) {
    let p = String(path ?? "");
    if (!p.startsWith("/")) p = "/" + p;
    return "#" + p;
  }

  // ✅ i18n basePath auto-detect
  function detectI18nBasePath() {
    try {
      const p = String(location.pathname || "/");
      const path = p.startsWith("/") ? p : "/" + p;

      const idx = path.lastIndexOf("/i18n/");
      if (idx !== -1) {
        const prefix = path.slice(0, idx);
        return (prefix || "") + "/i18n";
      }

      const dir = path.endsWith("/")
        ? path
        : path.slice(0, path.lastIndexOf("/") + 1);

      const base = dir.replace(/\/$/, "");
      return (base || "") + "/i18n";
    } catch (_) {
      return "/i18n";
    }
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

  // Try multiple URLs, return parsed JSON
  async function fetchJSONTry(urls) {
    let lastErr = null;
    for (const u of urls) {
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

    for (const u of urls) {
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

  // ✅ Try multiple URLs, return { text, usedUrl, attempted }
  async function fetchTextTryWithAttempts(urls) {
    const attempted = [];
    let lastErr = null;

    for (const u of urls) {
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

  async function detectDataBaseBuildings() {
    const candidates = [
      "data/buildings",
      "page/data/buildings",
      "/data/buildings",
      "/page/data/buildings",
    ];

    for (const base of candidates) {
      try {
        const res = await fetch(`${base}/index.json`, { cache: "no-store" });
        if (!res.ok) continue;
        await res.json();
        return base;
      } catch (_) {}
    }
    return "data/buildings";
  }

  async function detectDataBaseHeroes() {
    const candidates = [
      "data/heroes",
      "page/data/heroes",
      "/data/heroes",
      "/page/data/heroes",
    ];

    const rarities = ["r", "sr", "ssr"];

    for (const base of candidates) {
      for (const rr of rarities) {
        try {
          const res = await fetch(`${base}/${rr}/index.json`, { cache: "no-store" });
          if (!res.ok) continue;
          await res.json();
          return base;
        } catch (_) {}
      }
    }
    return "data/heroes";
  }

  // =========================
  // 2.5) i18n Integration (matches YOUR i18n.js)
  // =========================
  async function initI18n() {
    if (!window.WOS_I18N || typeof window.WOS_I18N.init !== "function") {
      return { ok: false, lang: (document.documentElement.getAttribute("lang") || "en").toLowerCase() || "en" };
    }

    const basePath = detectI18nBasePath();

    // ✅ tips.json removed (avoid 404 loops)
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
  // 2.55) Coupons template helpers (SPA loads /coupons/index.{lang}.html)
  // =========================
  function pickLang3(v) {
    const s = String(v || "").toLowerCase();
    return (s === "ko" || s === "ja" || s === "en") ? s : "en";
  }

  async function loadCouponsTemplateInto(view, lang) {
    const l = pickLang3(lang);
    const candidates = [
      `/coupons/index.${l}.html`,
      `coupons/index.${l}.html`,
      `/page/coupons/index.${l}.html`,
      `page/coupons/index.${l}.html`,
    ];

    const r = await fetchTextTryWithAttempts(candidates);

    const doc = new DOMParser().parseFromString(r.text || "", "text/html");
    const root =
      doc.querySelector("#couponPage") ||
      doc.querySelector("main") ||
      doc.body;

    // avoid injecting scripts (they won't execute anyway; but prevent confusion)
    try { root.querySelectorAll("script").forEach((s) => s.remove()); } catch (_) {}

    view.innerHTML = root ? root.innerHTML : (r.text || "");
    return { usedUrl: r.usedUrl, attempted: r.attempted };
  }

  function bindCouponsTemplateChipsOnce(container, gridEl) {
    if (!container || !gridEl) return;

    // prevent duplicate binding on rerender
    if (container.__wosCouponsChipsBound) return;
    container.__wosCouponsChipsBound = true;

    const chips = Array.from(container.querySelectorAll(".chip[data-filter]"));
    if (!chips.length) return;

    const setPressed = (activeFilter) => {
      chips.forEach((c) => {
        const f = c.getAttribute("data-filter") || "";
        c.setAttribute("aria-pressed", f === activeFilter ? "true" : "false");
      });
    };

    const applyFilter = (filter) => {
      const cards = Array.from(gridEl.querySelectorAll("[data-coupon-card='1']"));
      cards.forEach((card) => {
        const expired = card.getAttribute("data-expired") === "1";
        const show =
          filter === "all" ||
          (filter === "active" && !expired) ||
          (filter === "expired" && expired);
        card.style.display = show ? "" : "none";
      });
      setPressed(filter);
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const f = chip.getAttribute("data-filter") || "all";
        applyFilter(f);
      });
    });

    applyFilter("all");
  }

  function focusCouponCard(gridEl, focusSlug) {
    if (!gridEl || !focusSlug) return;
    const slug = String(focusSlug || "").toLowerCase().trim();
    if (!slug) return;

    const cards = Array.from(gridEl.querySelectorAll("[data-coupon-card='1']"));
    const target = cards.find((el) => {
      const btn = el.querySelector("[data-copy]");
      const code = btn ? String(btn.getAttribute("data-copy") || "") : "";
      return code.toLowerCase() === slug;
    });

    if (target && typeof target.scrollIntoView === "function") {
      try { target.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) { target.scrollIntoView(); }
    }
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
  function setActiveMenu(_path) {
    const links = document.querySelectorAll(".wos-menu a[data-link]");
    links.forEach((a) => {
      const href = a.getAttribute("href") || "";
      const target = href.startsWith("#") ? href.slice(1) : href;
      const path = _path || getPath();
      const isHome = target === "/" && (path === "/" || path === "");
      const isMatch =
        isHome ||
        (target !== "/" && (path === target || path.startsWith(target + "/")));
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
          <div><span class="wos-muted">Index URL</span> <code class="wos-mono">${esc((DATA_BASE ?? "") + "/index.json")}</code></div>
          <div style="margin-top:6px"><span class="wos-muted">DATA_BASE_HEROES</span> <code class="wos-mono">${esc(DATA_BASE_HEROES ?? "(not set)")}</code></div>
          <div><span class="wos-muted">Heroes Index URL</span> <code class="wos-mono">${esc((DATA_BASE_HEROES ?? "") + "/{r|sr|ssr}/index.json")}</code></div>
        </div>
      </div>
      ${attemptedHTML}
    `;

    setActiveMenu(path);
    applyI18n(view);
  }

  // =========================
  // 5) Hash router
  // =========================
  function getPath() {
    const h = location.hash || "#/";
    const p = h.startsWith("#") ? h.slice(1) : h;
    return p || "/";
  }

  function go(path) {
    let p = String(path ?? "");
    if (p.startsWith("#")) {
      location.hash = p;
      return;
    }
    if (!p.startsWith("/")) p = "/" + p;
    location.hash = "#" + p;
  }

  function bindLinkInterceptOnce() {
    if (window.__WOS_LINK_INTERCEPT_BOUND__) return;
    window.__WOS_LINK_INTERCEPT_BOUND__ = true;

    document.addEventListener("click", (e) => {
      const a = e.target.closest("a[data-link]");
      if (!a) return;

      const href = a.getAttribute("href") || "";
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank") return;

      e.preventDefault();
      go(href);
    });
  }

  function bindHashChangeOnce() {
    if (window.__WOS_HASHCHANGE_BOUND__) return;
    window.__WOS_HASHCHANGE_BOUND__ = true;

    window.addEventListener("hashchange", () => {
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
      const a = e.target.closest("a[data-nav]");
      if (a) closeDrawer();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeDrawer();
    });

    window.addEventListener("hashchange", closeDrawer);

    const syncActive = () => {
      const hash = location.hash || "#/";
      drawer.querySelectorAll(".wos-drawer-link").forEach((a) => {
        a.classList.toggle("active", a.getAttribute("href") === hash);
      });
    };
    window.addEventListener("hashchange", syncActive);
    syncActive();
  }

  // =========================
  // 6) Home data (latest uploads) — NO dummy
  // =========================
  async function loadLatestUploads() {
    const candidates = [
      "data/home/latest.json",
      "page/data/home/latest.json",
      "/data/home/latest.json",
      "/page/data/home/latest.json",
      "data/latest.json",
      "page/data/latest.json",
      "/data/latest.json",
      "/page/data/latest.json",
    ];

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
    let href = it?.href ?? it?.url ?? it?.link ?? "";

    const slug = it?.slug ?? "";
    const kind = String(it?.kind ?? it?.type ?? "").toLowerCase();

    if (!href && kind && slug) {
      if (kind.includes("building")) href = routeHref(`/buildings/${slug}`);
      else if (kind.includes("hero")) href = routeHref(`/heroes/${slug}`);
      else if (kind.includes("calc") || kind.includes("tool")) href = routeHref(`/tools/${slug}`);
      else if (kind.includes("tip")) href = routeHref(`/tips/${slug}`);
      else if (kind.includes("coupon")) href = routeHref(`/coupons/${slug}`);
    }

    if (!href && typeof it?.path === "string") href = routeHref(it.path);
    if (!href) href = routeHref("/");

    if (!href.startsWith("#")) href = routeHref(href);

    return { category, title, date, href };
  }

  // =========================
  // 6.3) Tips data (home preview only) — NO dummy
  // =========================
  async function loadTipsIndex() {
    const candidates = [
      "data/tips/index.json",
      "page/data/tips/index.json",
      "/data/tips/index.json",
      "/page/data/tips/index.json",
      "data/tips/items/index.json",
      "page/data/tips/items/index.json",
      "/data/tips/items/index.json",
      "/page/data/tips/items/index.json",
    ];

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
      const slug = path.replace("/buildings/", "");
      return pageBuilding(slug);
    }
    if (path === "/buildings") return pageBuildings();

    // heroes
    if (path.startsWith("/heroes/") && path.split("/").length >= 3) {
      const slug = path.replace("/heroes/", "");
      return pageHero(slug);
    }
    if (path === "/heroes") return pageHeroes();

    // ✅ coupons
    if (path === "/coupons") return pageCoupons();
    if (path.startsWith("/coupons/") && path.split("/").length >= 3) {
      const slug = path.replace("/coupons/", "");
      return pageCoupon(slug);
    }

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
                  <img src="/assets/buildings/furnace/firecrystal_img/furnace.png" alt="Buildings" loading="lazy">
                </div>
                <div style="min-width:0;">
                  <div class="wos-tile-title" data-i18n="nav.buildings">${esc(t("nav.buildings") || "Buildings")}</div>
                </div>
              </a>

              <a class="wos-tile wos-tile--img" href="${routeHref("/heroes")}" data-link>
                <div class="wos-iconbox">
                  <img src="/assets/heroes/ssr/s1/jeronimo/img/jeronimo.png" alt="Heroes" loading="lazy">
                </div>
                <div style="min-width:0;">
                  <div class="wos-tile-title" data-i18n="nav.heroes">${esc(t("nav.heroes") || "Heroes")}</div>
                </div>
              </a>

              <a class="wos-tile wos-tile--img" href="${routeHref("/tools/building-calculator")}" data-link>
                <div class="wos-iconbox">
                  <img src="/assets/heroes/ssr/s1/zinman/img/zinman.png" alt="Calculator" loading="lazy">
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
    // home title = site only
    setDocTitle("");
  }
// =========================
// ✅ Coupon Preview Helpers (standalone, no coupons.js dependency)
// =========================
function safeDecode(s) {
  try { return decodeURIComponent(String(s ?? "")); }
  catch (_) { return String(s ?? ""); }
}

function normalizeCouponsPayload(data) {
  if (!data) return { items: [], updatedAt: "" };

  // allow: { items:[...] }, [...], { coupons:[...] }, { data:[...] }
  const items =
    Array.isArray(data) ? data :
    Array.isArray(data.items) ? data.items :
    Array.isArray(data.coupons) ? data.coupons :
    Array.isArray(data.data) ? data.data :
    [];

  const updatedAt = String(
    data.updatedAt ?? data.lastUpdated ?? data.updated ?? data.time ?? data.date ?? ""
  );

  return { items, updatedAt };
}

function getCouponKey(it) {
  return String(
    it?.code ??
    it?.coupon ??
    it?.slug ??
    it?.id ??
    it?.key ??
    it?.name ??
    ""
  ).trim();
}

function isCouponExpired(it) {
  const raw =
    it?.expiresAt ?? it?.expireAt ?? it?.expiredAt ?? it?.endAt ?? it?.endDate ??
    it?.expiry ?? it?.expires ?? it?.until;

  if (!raw) return false;

  const d = new Date(String(raw));
  if (Number.isNaN(d.getTime())) {
    const n = Number(raw);
    if (Number.isFinite(n)) return n < Date.now();
    return false;
  }
  return d.getTime() < Date.now();
}

function renderCouponPreviewCard(view, coupon, { slug, updatedAt, pageTitle }) {
  const code = getCouponKey(coupon) || slug || "";
  const expired = isCouponExpired(coupon);

  const title =
    String(coupon?.title ?? coupon?.name ?? coupon?.label ?? "") ||
    code ||
    (t("nav.coupons") || "Coupons");

  const desc =
    coupon?.descriptionHtml ??
    coupon?.descHtml ??
    coupon?.html ??
    "";

  const descText =
    !desc ? String(coupon?.description ?? coupon?.desc ?? coupon?.note ?? coupon?.notes ?? "") : "";

  const reward = String(coupon?.reward ?? coupon?.benefit ?? coupon?.value ?? coupon?.bonus ?? "");
  const start = String(coupon?.startAt ?? coupon?.startDate ?? coupon?.startsAt ?? coupon?.from ?? "");
  const end = String(coupon?.expiresAt ?? coupon?.expireAt ?? coupon?.endAt ?? coupon?.endDate ?? coupon?.until ?? "");

  const statusLabel = expired
    ? tOpt("coupons.expired", "Expired")
    : tOpt("coupons.active", "Active");

  view.innerHTML = `
    <div class="wos-panel">
      <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
        <div style="min-width:220px;">
          <div class="wos-muted" style="font-size:12px; margin-bottom:6px;">
            <a class="wos-a" href="${routeHref("/coupons")}" data-link>← ${esc(tOpt("common.back", "Back"))}</a>
          </div>
          <h2 style="margin:0; font-size:20px; letter-spacing:-.2px;">${esc(title)}</h2>
          <div class="wos-muted" style="font-size:13px; margin-top:6px;">
            <span class="wos-badge" style="${expired ? "opacity:.7" : ""}">${esc(statusLabel)}</span>
            ${reward ? ` <span class="wos-muted">· ${esc(reward)}</span>` : ""}
          </div>
        </div>

        <div style="display:flex; gap:8px; align-items:center;">
          <button class="wos-btn" type="button" id="couponCopyBtn" data-copy="${esc(code)}">
            ${esc(tOpt("coupons.copy", "Copy"))}
          </button>
          <span class="wos-mono" style="font-size:13px; padding:8px 10px; border:1px solid var(--w-border); border-radius:12px;">
            ${esc(code || "-")}
          </span>
        </div>
      </div>

      ${(start || end) ? `
        <div class="wos-muted" style="font-size:12px; margin-top:10px;">
          ${start ? `${esc(tOpt("coupons.starts", "Starts"))}: ${esc(fmtDateLike(start))}` : ""}
          ${(start && end) ? " · " : ""}
          ${end ? `${esc(tOpt("coupons.ends", "Ends"))}: ${esc(fmtDateLike(end))}` : ""}
        </div>
      ` : ""}

      ${desc ? `<div style="margin-top:12px;">${desc}</div>` : ""}
      ${(!desc && descText) ? `<div class="wos-muted" style="margin-top:12px; font-size:13px; line-height:1.7;">${nl2br(descText)}</div>` : ""}

      <div class="wos-muted" style="font-size:12px; margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
        ${updatedAt ? `<span>${esc(tOpt("coupons.updated", "Updated"))}: ${esc(fmtDateLike(updatedAt))}</span>` : ""}
        <span>/${esc(pageTitle || "coupons")}</span>
      </div>
    </div>
  `;

  const btn = view.querySelector("#couponCopyBtn");
  if (btn) {
    btn.addEventListener("click", async () => {
      const v = btn.getAttribute("data-copy") || "";
      if (!v) return;

      let ok = false;
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(v);
          ok = true;
        }
      } catch (_) {}

      if (!ok) {
        try {
          const ta = document.createElement("textarea");
          ta.value = v;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          ok = document.execCommand("copy");
          document.body.removeChild(ta);
        } catch (_) {}
      }

      btn.textContent = ok ? tOpt("coupons.copied", "Copied") : tOpt("coupons.copy_failed", "Copy failed");
      setTimeout(() => { btn.textContent = tOpt("coupons.copy", "Copy"); }, 900);
    });
  }

  applyI18n(view);
}

async function fetchCouponsPayloadAny(jsonUrl = "/coupons/coupons.json") {
  // 1) coupons.js helper 우선
  try {
    if (window.WOS_COUPONS && typeof window.WOS_COUPONS._fetchCouponsAny === "function") {
      const r = await window.WOS_COUPONS._fetchCouponsAny(jsonUrl);
      const payload = r?.payload ?? r;
      return normalizeCouponsPayload(payload);
    }
    if (window.WOS_COUPONS && typeof window.WOS_COUPONS._fetchCoupons === "function") {
      const r = await window.WOS_COUPONS._fetchCoupons(jsonUrl);
      const payload = r?.payload ?? r;
      return normalizeCouponsPayload(payload);
    }
  } catch (_) {}

  // 2) direct fetch fallback (여러 후보)
  const candidates = [
    jsonUrl,
    "/coupons/coupons.json",
    "coupons/coupons.json",
    "/coupons.json",
    "coupons.json",
    "/page/data/coupons.json",
    "page/data/coupons.json",
    "/data/coupons.json",
    "data/coupons.json",
  ];

  const r = await fetchJSONTryWithAttempts(candidates);
  return normalizeCouponsPayload(r.data);
}

// =========================
// ✅ Coupons pages (template + coupons.js OR fallback list)
// =========================
async function pageCoupons(focusSlug = "") {
  const path = getPath();
  const pageTitle = t("nav.coupons") || "Coupons";
  const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
  if (!view) return;

  const lang = getLangSafe();
  const jsonUrl = "/coupons/coupons.json";

  // 1) 템플릿(있으면) 먼저 깔기
  let templateLoaded = false;
  try {
    await loadCouponsTemplateInto(view, lang);
    templateLoaded = true;
  } catch (_) {
    templateLoaded = false;
  }

  const grid = (templateLoaded && (view.querySelector("#couponGrid"))) ? view.querySelector("#couponGrid") : view;
  if (grid && grid.id === "couponGrid") {
    grid.setAttribute("data-coupon-grid", grid.getAttribute("data-coupon-grid") || "1");
  }

  // 2) coupons.js 있으면 그대로 사용 (기존 기능 유지)
  const hasCouponsJs = await waitForGlobal(
    "WOS_COUPONS",
    () =>
      window.WOS_COUPONS &&
      (
        typeof window.WOS_COUPONS.renderPage === "function" ||
        typeof window.WOS_COUPONS.renderList === "function" ||
        typeof window.WOS_COUPONS.renderGrid === "function"
      ),
    700 // ✅ 너무 오래 기다리지 말고 빠르게 폴백으로
  );

  // lastUpdated는 fetchCouponsPayloadAny 결과로 통일
  async function trySetLastUpdatedFromPayload() {
    const el = view.querySelector("#lastUpdated");
    if (!el) return;
    try {
      const payload = await fetchCouponsPayloadAny(jsonUrl);
      if (payload.updatedAt) el.textContent = String(payload.updatedAt);
    } catch (_) {}
  }

  if (hasCouponsJs) {
    try {
      if (templateLoaded && typeof window.WOS_COUPONS.renderList === "function") {
        await window.WOS_COUPONS.renderList({ appEl: grid, locale: lang, jsonUrl, max: 999 });
        await trySetLastUpdatedFromPayload();
        bindCouponsTemplateChipsOnce(view, grid);
        focusCouponCard(grid, focusSlug);
        setActiveMenu(path); applyI18n(view); setDocTitle(pageTitle);
        return;
      }

      if (typeof window.WOS_COUPONS.renderPage === "function") {
        await window.WOS_COUPONS.renderPage({
          appEl: view, locale: lang, jsonUrl, max: 999, focusSlug,
          go, esc, nl2br, clampStr, fetchJSONTryWithAttempts, normalizeIndex, fmtDateLike, t, tOpt, getLangSafe,
        });
        await trySetLastUpdatedFromPayload();
        setActiveMenu(path); applyI18n(view); setDocTitle(pageTitle);
        return;
      }

      // renderList/grid fallback
      if (typeof window.WOS_COUPONS.renderList === "function") {
        view.innerHTML = `<div class="wos-panel"><div id="couponGrid" data-coupon-grid="1"></div></div>`;
        const root = view.querySelector("#couponGrid");
        await window.WOS_COUPONS.renderList({ appEl: root, locale: lang, jsonUrl, max: 999, focusSlug });
        await trySetLastUpdatedFromPayload();
        setActiveMenu(path); applyI18n(view); setDocTitle(pageTitle);
        return;
      }
    } catch (_) {
      // coupons.js가 있어도 실패하면 아래 폴백으로 내려감
    }
  }

  // 3) ✅ coupons.js 없어도: 최소 리스트 폴백 렌더
  let payload;
  try {
    payload = await fetchCouponsPayloadAny(jsonUrl);
  } catch (err) {
    return showError(err);
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  const updatedAt = payload.updatedAt || "";

  // 템플릿이 없으면 기본 패널 생성
  if (!templateLoaded) {
    view.innerHTML = `
      <div class="wos-panel">
        <div class="wos-row" style="margin-bottom:10px;">
          <h2 style="margin:0;" data-i18n="nav.coupons">${esc(pageTitle)}</h2>
          <div id="lastUpdated" class="wos-muted" style="font-size:12px;"></div>
        </div>
        <div id="couponGrid" data-coupon-grid="1"></div>
      </div>
    `;
  } else {
    const el = view.querySelector("#lastUpdated");
    if (el && updatedAt) el.textContent = String(updatedAt);
  }

  const root = view.querySelector("#couponGrid") || grid || view;

  const cards = items.map((it) => {
    const code = getCouponKey(it);
    const title = String(it?.title ?? it?.name ?? it?.label ?? code ?? "");
    const expired = isCouponExpired(it);
    const status = expired ? tOpt("coupons.expired", "Expired") : tOpt("coupons.active", "Active");
    const href = routeHref("/coupons/" + encodeURIComponent(code || title || ""));
    const reward = String(it?.reward ?? it?.benefit ?? it?.value ?? it?.bonus ?? "");

    return `
      <a class="wos-item" href="${href}" data-link data-coupon-card="1" data-expired="${expired ? "1" : "0"}">
        <div class="wos-badge" style="${expired ? "opacity:.7" : ""}">${esc(status)}</div>
        <div style="flex:1; min-width:0;">
          <div class="wos-item-title">${esc(clampStr(title || code || "Coupon", 70))}</div>
          <div class="wos-item-meta wos-mono">${esc(code || "")}${reward ? ` · ${esc(reward)}` : ""}</div>
        </div>
      </a>
    `;
  }).join("");

  root.innerHTML = cards || `
    <div class="wos-muted" style="font-size:13px; line-height:1.7;" data-i18n="coupons.empty">
      ${esc(tOpt("coupons.empty", "No coupons available."))}
    </div>
  `;

  // chips가 템플릿에 있으면 그대로 필터 동작
  bindCouponsTemplateChipsOnce(view, root);

  // lastUpdated
  const lastUpdatedEl = view.querySelector("#lastUpdated");
  if (lastUpdatedEl && updatedAt) lastUpdatedEl.textContent = String(updatedAt);

  setActiveMenu(path);
  applyI18n(view);
  setDocTitle(pageTitle);
}

// ✅ Coupon detail route: coupons.js 없어도 "미리보기 카드"로 동작
async function pageCoupon(slug) {
  const path = getPath();
  const pageTitle = t("nav.coupons") || "Coupons";
  const view = renderShell({ path, title: pageTitle, contentHTML: "" }) || getViewEl();
  if (!view) return;

  const focus = safeDecode(slug).trim();
  if (!focus) return pageCoupons();

  let payload;
  try {
    payload = await fetchCouponsPayloadAny("/coupons/coupons.json");
  } catch (err) {
    return showError(err);
  }

  const items = Array.isArray(payload.items) ? payload.items : [];
  const key = focus.toLowerCase();

  const found = items.find((it) => getCouponKey(it).toLowerCase() === key);

  if (!found) {
    view.innerHTML = `
      <div class="wos-panel">
        <div class="wos-muted" style="font-size:12px; margin-bottom:6px;">
          <a class="wos-a" href="${routeHref("/coupons")}" data-link>← ${esc(tOpt("common.back", "Back"))}</a>
        </div>
        <h2 style="margin:0 0 8px;">${esc(tOpt("coupons.not_found", "Coupon not found"))}</h2>
        <div class="wos-muted" style="font-size:13px; line-height:1.7;">
          ${esc(tOpt("coupons.not_found_desc", "This coupon code was not found in the current list."))}<br>
          <span class="wos-mono">${esc(focus)}</span>
        </div>
        <div style="margin-top:12px;">
          <a class="wos-btn" href="${routeHref("/coupons")}" data-link>${esc(tOpt("nav.coupons", "Coupons"))}</a>
        </div>
      </div>
    `;
    setActiveMenu(path);
    applyI18n(view);
    setDocTitle(pageTitle);
    return;
  }

  renderCouponPreviewCard(view, found, {
    slug: focus,
    updatedAt: payload.updatedAt,
    pageTitle: "coupons",
  });

  setActiveMenu(path);
  setDocTitle(getCouponKey(found) || pageTitle);
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
    });

    setActiveMenu(path);
    applyI18n(view);

    // ✅ tips detail title: use rendered h2/h1 if available
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

    const ctx = { go, esc, fmtNum, t, tOpt };
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
    });

    setActiveMenu(path);
    applyI18n(view);

    // optional: infer building title from view if exists
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

    if (!DATA_BASE_HEROES) DATA_BASE_HEROES = await detectDataBaseHeroes();

    if (window.WOS_HEROES && typeof window.WOS_HEROES.renderList === "function") {
      try {
        const ret = await window.WOS_HEROES.renderList(view, { t, tOpt, esc, clampStr, routeHref, go });
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
        const at = Array.isArray(err?.attempted) ? err.attempted : [u];
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
      const title = tOpt(`heroes.${slug2}.name`, rawTitle);

      const portrait = h.portrait ?? h.portraitSrc ?? h.image ?? "";
      const rarity = tEnum("hero.rarity", (h.rarity ?? h.tier ?? ""));
      const cls = tEnum("hero.class", (h.class ?? h.heroClass ?? ""));
      const meta = [rarity, cls].filter(Boolean).join(" · ");

      // ✅ URL은 esc() 쓰지 말고 encodeURIComponent로
      const hrefSlug = encodeURIComponent(slug2);

      return `
        <a class="wos-item"
           href="${routeHref("/heroes/" + hrefSlug)}"
           data-link
           style="flex-direction:column; align-items:stretch;">
          ${portrait
            ? `<img src="${esc(portrait)}" alt="${esc(title)}"
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

    if (!DATA_BASE_HEROES) DATA_BASE_HEROES = await detectDataBaseHeroes();

    if (window.WOS_HEROES && typeof window.WOS_HEROES.renderDetail === "function") {
      try {
        const ret = await window.WOS_HEROES.renderDetail(view, slug, { t, tOpt, esc, nl2br, fmtNum, routeHref, go });
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
        const at = Array.isArray(err?.attempted) ? err.attempted : [u];
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
      return showError(err, { attempted: attempted.concat(err?.attempted || attempted2 || urls) });
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
                    ${icon ? `<img src="${esc(icon)}" alt="${esc(st)}" style="width:40px;height:40px;border-radius:10px; border:1px solid var(--w-border);" loading="lazy">` : ""}
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
          ${portrait ? `<img src="${esc(portrait)}" alt="${esc(title)}" style="width:120px;height:auto;border-radius:14px; border:1px solid var(--w-border);" loading="lazy">` : ""}
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

    // ✅ hero detail title
    setDocTitle(title || pageTitle);
  }

  // =========================
  // 9) Boot
  // =========================
  (async () => {
    ensureStyles();

    // i18n first
    await initI18n();

    // core bindings
    bindLinkInterceptOnce();
    bindHashChangeOnce();

    // drawer bind (if available now)
    initDrawerOnce();

    // bases
    DATA_BASE = await detectDataBaseBuildings();
    DATA_BASE_HEROES = await detectDataBaseHeroes();

    if (!location.hash) location.hash = "#/";
    await router();

    // final apply
    applyI18n(document);

    // debug
    window.__WOS_DEV__ = {
      get DATA_BASE() { return DATA_BASE; },
      get DATA_BASE_HEROES() { return DATA_BASE_HEROES; },
      go,
      router,
      waitForGlobal,
      i18n: () => window.WOS_I18N,
    };
  })().catch((err) => showError(err));
})();

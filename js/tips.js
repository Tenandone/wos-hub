/* =========================================================
   WOS.GG - js/tips.js (MODULE) ✅ FINAL (APP.JS COMPAT)
   - window.WOS_TIPS
   - Works with app.js Split Build (History Router / NO HASH)
   - GitHub Pages repo prefix / custom domain safe:
       * prefers window.WOS_RES / window.WOS_URL from app.js
       * falls back to local withBase() if app.js helpers not present
   - Router paths:
       /tips , /tips/:slug
   - FIX:
       1) back 버튼 이벤트가 본문 링크를 오염시키지 않게 고정 선택자 사용
       2) 팁 본문 외부링크에 data-link가 있으면 제거(라우터 가로채기 방지)
       3) lootbar.gg 처럼 scheme 없는 링크는 https:// 자동 보정
       4) 다국어 블록: [data-lang]/[lang] + .lang-ko/.lang-en/.lang-ja 지원

   - ✅ 변경(요청 반영):
       * AUTO/ALL/KO/EN/JA 토글 UI "완전 제거"
       * 사이트 상단 언어(ko/en/ja)만 따라가서 해당 언어 블록만 노출
       * 단, 현재 언어 블록이 없으면(예: EN인데 KO만 있음) → 전체 노출(빈 화면 방지)
       * /lootbar(앱 렌더) / /tips/xxx(정적 HTML)도 #view 감시로
         링크 보정 + 언어 노출 자동 적용
   ========================================================= */

(() => {
  "use strict";

  if (window.WOS_TIPS) return;

  // =========================================================
  // 0) DEV/PROD debug (필요하면 ?debug=1)
  // =========================================================
  function getDebugFlag() {
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("debug") === "1") return true;
    } catch (_) {}
    try {
      const host = String(location.hostname || "").toLowerCase();
      if (host === "localhost" || host === "127.0.0.1") return true;
    } catch (_) {}
    return false;
  }
  const DEBUG = getDebugFlag();

  // =========================================================
  // 1) Base/prefix helpers
  // =========================================================
  function normalizeBasePrefix(p) {
    let s = String(p || "").trim();
    if (!s || s === "/") return "";
    if (!s.startsWith("/")) s = "/" + s;
    s = s.replace(/\/+$/, "");
    return s === "/" ? "" : s;
  }

  function detectBasePrefixFallback() {
    try {
      const meta = document.querySelector('meta[name="wos-base"]');
      const c = meta && meta.getAttribute("content");
      if (c && String(c).trim()) return normalizeBasePrefix(String(c).trim());
    } catch (_) {}

    try {
      const baseTag = document.querySelector("base[href]");
      const href = baseTag && baseTag.getAttribute("href");
      if (href && String(href).trim()) {
        const u = new URL(href, location.origin);
        return normalizeBasePrefix(u.pathname);
      }
    } catch (_) {}

    try {
      const host = String(location.hostname || "");
      const path = String(location.pathname || "/");
      if (host.endsWith("github.io")) {
        const seg = path.split("/").filter(Boolean)[0];
        if (seg) return normalizeBasePrefix("/" + seg);
      }
    } catch (_) {}

    return "";
  }

  const __BASE_PREFIX_FALLBACK__ = detectBasePrefixFallback();

  function withBaseFallback(path) {
    const raw = String(path || "");
    if (!raw) return raw;

    if (/^(https?:)?\/\//i.test(raw)) return raw;
    if (/^(data:|blob:|mailto:|tel:|sms:)/i.test(raw)) return raw;

    const p = raw.startsWith("/") ? raw : "/" + raw;
    if (!__BASE_PREFIX_FALLBACK__) return p;

    if (p === __BASE_PREFIX_FALLBACK__ || p.startsWith(__BASE_PREFIX_FALLBACK__ + "/")) return p;
    return __BASE_PREFIX_FALLBACK__ + p;
  }

  function resUrl(path) {
    try {
      if (typeof window.WOS_RES === "function") return window.WOS_RES(path);
    } catch (_) {}
    return withBaseFallback(path);
  }

  function spaHref(path) {
    try {
      if (typeof window.WOS_URL === "function") return window.WOS_URL(path);
    } catch (_) {}
    return withBaseFallback(path);
  }

  // =========================================================
  // 1.1) Tip body link fix (먹통 원인 제거)
  // =========================================================
  function looksLikeDomainNoScheme(href) {
    const h = String(href || "").trim();
    return /^[a-z0-9-]+(\.[a-z0-9-]+)+([\/?#]|$)/i.test(h);
  }

  function normalizeTipHref(rawHref) {
    let h = String(rawHref || "").trim();
    if (!h) return h;

    if (h.startsWith("#")) return h;

    // 이미 scheme/특수 scheme면 그대로
    if (/^(https?:)?\/\//i.test(h)) return h;
    if (/^(mailto:|tel:|data:|blob:|sms:)/i.test(h)) return h;

    // "www.xxx" or "xxx.com/..." => https://
    if (h.startsWith("www.")) return "https://" + h;
    if (looksLikeDomainNoScheme(h)) return "https://" + h;

    // 내부 shorthand
    const h0 = h.replace(/^\.\/+/, "");
    if (h0 === "lootbar" || h0 === "lootbar/" || h0 === "lootbar.html") return "/lootbar";
    if (h0 === "tips" || h0 === "tips/" || h0 === "tips.html") return "/tips";
    if (/^tips\/[^\s]+/i.test(h0)) return "/" + h0;

    // 내부 절대 경로
    if (h.startsWith("/")) return h;

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

      const abs = /^(https?:)?\/\//i.test(href);
      if (!abs) return;

      if (!aEl.getAttribute("target")) aEl.setAttribute("target", "_blank");

      const rel = String(aEl.getAttribute("rel") || "").trim().toLowerCase();
      const parts = rel ? rel.split(/\s+/).filter(Boolean) : [];
      if (!parts.includes("noopener")) parts.push("noopener");
      if (!parts.includes("noreferrer")) parts.push("noreferrer");
      aEl.setAttribute("rel", parts.join(" ").trim());
    } catch (_) {}
  }

  function rewriteTipBodyLinks(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;

    // a[href] 보정 + 외부링크면 data-link 제거
    rootEl.querySelectorAll("a[href]").forEach((a) => {
      const raw = a.getAttribute("href") || "";
      const fixed = normalizeTipHref(raw);

      if (fixed && fixed !== raw) a.setAttribute("href", fixed);

      // 외부 absolute이면 SPA 라우터 가로채지 않게 data-link 제거
      if (/^(https?:)?\/\//i.test(fixed) && isExternalAbsoluteUrl(fixed)) {
        a.removeAttribute("data-link");
        a.removeAttribute("data-nav");
        ensureExternalTarget(a);
      }
    });

    // data-href / data-url normalize (optional)
    rootEl.querySelectorAll("[data-href],[data-url]").forEach((el) => {
      if (el.getAttribute("data-wos-bound") === "1") return;

      const raw = el.getAttribute("data-href") || el.getAttribute("data-url") || "";
      const fixed = normalizeTipHref(raw);
      if (!fixed) return;

      el.setAttribute("data-wos-bound", "1");
      el.style.cursor = "pointer";

      const open = () => {
        if (/^(https?:)?\/\//i.test(fixed) && isExternalAbsoluteUrl(fixed)) {
          window.open(fixed, "_blank", "noopener,noreferrer");
        } else {
          location.href = fixed;
        }
      };

      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });
  }

  // =========================================================
  // 2) Index candidates
  // =========================================================
  const INDEX_CANDIDATES = [
    "/data/tips/index.json",
    "/page/data/tips/index.json",
    "data/tips/index.json",
    "page/data/tips/index.json",
  ];

  // -------------------------
  // Language helpers
  // -------------------------
  function pickLang(v) {
    const s = String(v || "").toLowerCase();
    if (s === "en" || s === "ko" || s === "ja") return s;
    if (s.startsWith("en")) return "en";
    if (s.startsWith("ko")) return "ko";
    if (s.startsWith("ja")) return "ja";
    return "en";
  }

  function getLangSafe() {
    try {
      if (window.WOS_I18N && typeof window.WOS_I18N.getLang === "function") {
        return pickLang(window.WOS_I18N.getLang());
      }
    } catch (_) {}
    try {
      const h = document.documentElement.getAttribute("lang");
      if (h) return pickLang(h);
    } catch (_) {}
    try {
      return pickLang(navigator.language || "en");
    } catch (_) {
      return "en";
    }
  }

  function getText(key) {
    const lang = getLangSafe();
    const dict = {
      en: {
        homeTitle: "Today’s Tips",
        homeSub: "Preview (3) · Click to open",
        homeBtn: "View tips",
        pinnedTitle: "Pinned Tips",
        pinnedSub: "Shortcuts to key guides",
        pinnedBtn: "All tips",
        listTips: "Tips",
        listPackages: "Packages",
        items: "items",
        back: "Back to tips",
        empty: "-",
        loadFail: "Failed to load tips index.",
        noTips: "No tips yet.",
        pinnedNotReady: "Pinned tips not ready. Check pinnedSlugs vs index.json slugs.",
        detailEmpty: "No content.",
        tipsTitle: "WOS tips",
      },
      ko: {
        homeTitle: "오늘의 팁",
        homeSub: "미리보기 (3개) · 클릭하면 상세로 이동",
        homeBtn: "팁 보기",
        pinnedTitle: "고정 팁",
        pinnedSub: "핵심 공지/가이드 바로가기",
        pinnedBtn: "팁 전체",
        listTips: "Tips",
        listPackages: "Packages",
        items: "items",
        back: "Back to tips",
        empty: "-",
        loadFail: "팁 인덱스를 불러오지 못했습니다.",
        noTips: "아직 표시할 팁이 없습니다.",
        pinnedNotReady: "고정 팁이 아직 준비되지 않았습니다. pinnedSlugs와 index.json의 slug를 맞춰주세요.",
        detailEmpty: "내용이 없습니다.",
        tipsTitle: "WOS tips",
      },
      ja: {
        homeTitle: "今日のヒント",
        homeSub: "プレビュー(3) · クリックで詳細",
        homeBtn: "ヒントを見る",
        pinnedTitle: "固定ヒント",
        pinnedSub: "重要ガイドへのショートカット",
        pinnedBtn: "すべて",
        listTips: "Tips",
        listPackages: "Packages",
        items: "items",
        back: "Back to tips",
        empty: "-",
        loadFail: "ヒントのインデックスを読み込めませんでした。",
        noTips: "表示できるヒントがありません。",
        pinnedNotReady: "固定ヒントが未準備です。pinnedSlugs と index.json の slug を確認してください。",
        detailEmpty: "内容がありません。",
        tipsTitle: "WOS tips",
      },
    };
    return (dict[lang] && dict[lang][key]) || dict.en[key] || key;
  }

  function getLocalizedField(value, fallback = "") {
    const lang = getLangSafe();
    if (value == null) return String(fallback ?? "");
    if (typeof value === "string" || typeof value === "number") return String(value);

    if (typeof value === "object") {
      if (value.i18n && typeof value.i18n === "object") {
        return String(value.i18n[lang] ?? value.i18n.en ?? fallback ?? "");
      }
      if (value[lang] != null) return String(value[lang]);
      if (value.en != null) return String(value.en);
    }
    return String(fallback ?? "");
  }

  // =========================================================
  // ✅ MULTI-LANG (SITE LANG ONLY) : 토글 UI 제거 버전
  // - tips 콘텐츠 안의 언어 블록만 show/hide
  // - 현재 언어 블록이 없으면 전체 노출(빈 화면 방지)
  // =========================================================
  function getLangFromEl(el) {
    try {
      if (!el) return "";

      // ✅ 사이트 언어 버튼(data-lang + data-lang-link)을 건드리지 않게 제외해야 함
      // tips 본문 블록은 보통 data-lang만 있거나 lang/class로 구분됨.
      if (el.hasAttribute && el.hasAttribute("data-lang")) {
        if (el.hasAttribute("data-lang-link")) return ""; // 사이트 버튼이면 제외
        return pickLang(el.getAttribute("data-lang"));
      }
      if (el.hasAttribute && el.hasAttribute("lang")) return pickLang(el.getAttribute("lang"));
      if (el.classList) {
        if (el.classList.contains("lang-ko")) return "ko";
        if (el.classList.contains("lang-en")) return "en";
        if (el.classList.contains("lang-ja")) return "ja";
      }
    } catch (_) {}
    return "";
  }

  function applySiteLangBlocks(rootEl) {
    if (!rootEl || !rootEl.querySelectorAll) return;

    // ✅ data-lang-link 달린 버튼들 제외
    const sel = "[data-lang]:not([data-lang-link]),[lang],.lang-ko,.lang-en,.lang-ja";
    const nodes = Array.from(rootEl.querySelectorAll(sel));
    if (!nodes.length) return;

    // top-level 블록만(중첩 제외)
    const topBlocks = nodes.filter((el) => {
      let p = el.parentElement;
      while (p && p !== rootEl) {
        if (p.matches && p.matches(sel)) return false;
        p = p.parentElement;
      }
      return true;
    });

    if (!topBlocks.length) return;

    const cur = getLangSafe();
    let matched = 0;

    topBlocks.forEach((el) => {
      const code = getLangFromEl(el);
      if (!code) return; // 언어 판별 실패면 그대로 둠

      const show = (code === cur);
      el.style.display = show ? "" : "none";
      if (show) matched++;
    });

    // 현재 언어 섹션이 아예 없으면 전체 표시(빈 화면 방지)
    if (matched === 0) {
      topBlocks.forEach((el) => {
        const code = getLangFromEl(el);
        if (!code) return;
        el.style.display = "";
      });
    }
  }

  function sanitizeHtmlRemoveScripts(rawHtml) {
    const html = String(rawHtml || "");
    if (!html.trim()) return "";
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      doc.querySelectorAll("script").forEach((s) => s.remove());
      return (doc.body && doc.body.innerHTML) ? doc.body.innerHTML : html;
    } catch (_) {
      return html;
    }
  }

  // -------------------------
  // Index helpers
  // -------------------------
  function normalizeIndex(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function onlyPublished(items) {
    return (items || []).filter((it) => (it?.status ?? "published") === "published");
  }

  function sortByDateDesc(items) {
    return (items || []).slice().sort((a, b) => new Date(b?.date || 0) - new Date(a?.date || 0));
  }

  function seededShuffle(arr, seed) {
    let s = (seed >>> 0) || 1;
    const rand = () => {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17; s >>>= 0;
      s ^= s << 5;  s >>>= 0;
      return (s >>> 0) / 4294967296;
    };
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  function pickDailyRandom(items, count = 3) {
    const pool = (items || []).filter((t) => !t?.home?.pin && !t?.home?.excludeFromRandom);

    const keyDate = "WOS_HOME_TIPS_SEED_DATE";
    const keySeed = "WOS_HOME_TIPS_SEED_VALUE";

    const now = new Date();
    const ymd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    let seedDate = null;
    let seedValue = null;

    try {
      seedDate = localStorage.getItem(keyDate);
      seedValue = localStorage.getItem(keySeed);
    } catch (_) {}

    if (seedDate !== ymd || !seedValue) {
      seedDate = ymd;
      seedValue = String(Math.floor(Math.random() * 1e9));
      try {
        localStorage.setItem(keyDate, seedDate);
        localStorage.setItem(keySeed, seedValue);
      } catch (_) {}
    }

    return seededShuffle(pool.slice(), Number(seedValue)).slice(0, count);
  }

  function normTipCard(it, label, clampStr) {
    const slug = it?.slug ?? "";
    const title = getLocalizedField(it?.title ?? it?.name ?? slug, "Untitled");
    const desc = getLocalizedField(it?.summary ?? it?.desc ?? it?.description ?? "", "");
    return {
      label,
      title: clampStr(title, 60),
      desc: clampStr(desc, 80),
      slug,
    };
  }

  async function loadIndex(fetchJSONTryWithAttempts) {
    const r = await fetchJSONTryWithAttempts(INDEX_CANDIDATES);
    return onlyPublished(normalizeIndex(r.data));
  }

  // =========================
  // Package category helpers
  // =========================
  function toStr(x) { return String(x ?? ""); }
  function toLc(x) { return toStr(x).trim().toLowerCase(); }

  function hasTag(it, tag) {
    const t = (it?.tags || []).map((x) => toLc(x));
    return t.includes(toLc(tag));
  }

  function isPackageItem(it) {
    const cat = toLc(it?.category);
    const slug = toLc(it?.slug);
    if (cat === "package" || cat === "packages") return true;
    if (hasTag(it, "package") || hasTag(it, "packages")) return true;
    if (slug.includes("package")) return true;
    return false;
  }

  function splitByPackage(items) {
    const nonPackages = [];
    const packages = [];
    (items || []).forEach((it) => (isPackageItem(it) ? packages : nonPackages).push(it));
    return { nonPackages, packages };
  }

  function sortNonPackageFirst(items) {
    const arr = (items || []).slice();
    arr.sort((a, b) => (isPackageItem(a) ? 1 : 0) - (isPackageItem(b) ? 1 : 0));
    return arr;
  }

  // =========================
  // HTML/JSON detail loader
  // =========================
  async function tryFetchTextFirstOk(urls) {
    const attempted = [];
    for (const raw of urls) {
      const u = resUrl(raw);
      attempted.push(u);
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (res && res.ok) {
          const txt = await res.text();
          if (typeof txt === "string") return { ok: true, url: u, text: txt, attempted };
        }
      } catch (_) {}
    }
    return { ok: false, url: null, text: "", attempted };
  }

  function buildHtmlCandidates(slug, lang) {
    const s = String(slug ?? "");
    const enc = encodeURIComponent(s);
    const l = pickLang(lang);

    const variants = [
      // 언어별 파일 우선
      `/data/tips/items/${s}.${l}.html`,
      `/data/tips/items/${enc}.${l}.html`,
      `/data/tips/items/${s}-${l}.html`,
      `/data/tips/items/${enc}-${l}.html`,
      `/data/tips/items/${l}/${s}.html`,
      `/data/tips/items/${l}/${enc}.html`,

      // 단일 파일(멀티언어 블록)도 허용
      `/data/tips/items/${s}.html`,
      `/data/tips/items/${enc}.html`,

      `/data/tips/${s}.${l}.html`,
      `/data/tips/${enc}.${l}.html`,
      `/data/tips/${s}-${l}.html`,
      `/data/tips/${enc}-${l}.html`,
      `/data/tips/${l}/${s}.html`,
      `/data/tips/${l}/${enc}.html`,

      `/data/tips/${s}.html`,
      `/data/tips/${enc}.html`,

      `/page/data/tips/items/${s}.${l}.html`,
      `/page/data/tips/items/${enc}.${l}.html`,
      `/page/data/tips/items/${s}.html`,
      `/page/data/tips/items/${enc}.html`,
      `/page/data/tips/${s}.${l}.html`,
      `/page/data/tips/${enc}.${l}.html`,
      `/page/data/tips/${s}.html`,
      `/page/data/tips/${enc}.html`,
    ];

    const seen = new Set();
    return variants.filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }

  async function loadDetail(fetchJSONTryWithAttempts, slug) {
    const s = String(slug ?? "");
    const lang = getLangSafe();

    // 1) HTML 우선
    const htmlCandidates = buildHtmlCandidates(s, lang);
    const htmlRes = await tryFetchTextFirstOk(htmlCandidates);

    if (htmlRes.ok) {
      const safeHtml = sanitizeHtmlRemoveScripts(htmlRes.text);
      return {
        slug: s,
        title: null,
        summary: null,
        bodyHtml: safeHtml || htmlRes.text,
        __source: "html",
        __path: htmlRes.url,
        __attempted: htmlRes.attempted,
      };
    }

    // 2) JSON fallback
    const enc = encodeURIComponent(s);
    const candidates = [
      `/data/tips/items/${s}.json`,
      `/data/tips/items/${enc}.json`,
      `/data/tips/${s}.json`,
      `/data/tips/${enc}.json`,
      `/page/data/tips/items/${s}.json`,
      `/page/data/tips/items/${enc}.json`,
      `/page/data/tips/${s}.json`,
      `/page/data/tips/${enc}.json`,
    ];

    const r = await fetchJSONTryWithAttempts(candidates);
    const tip = r.data || {};
    try {
      if (!tip.__attempted && r.attempted) tip.__attempted = r.attempted;
    } catch (_) {}
    return tip;
  }

  // -------------------------
  // UI helpers
  // -------------------------
  function bindTipCardNav(rootEl, go) {
    rootEl.querySelectorAll("[data-tip]").forEach((el) => {
      const slug = el.getAttribute("data-tip") || "";
      const to = `/tips/${encodeURIComponent(slug)}`;
      const on = () => go(to);

      el.addEventListener("click", on);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          on();
        }
      });
    });
  }

  function renderEmptyCard(container, text, monoPath) {
    container.innerHTML = `
      <div class="wos-muted" style="font-size:13px; line-height:1.65;">
        ${text}<br>
        ${monoPath ? `<span class="wos-mono">${monoPath}</span>` : ""}
      </div>
    `;
  }

  function renderTipsGrid(items, esc, clampStr, routeHref) {
    const href = (p) => (typeof routeHref === "function" ? routeHref(p) : spaHref(p));

    return `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap:12px;">
        ${items.map((it) => {
          const slug = String(it?.slug ?? "");
          const hrefSlug = encodeURIComponent(slug);

          const title = getLocalizedField(it?.title ?? it?.name ?? slug, "Untitled");
          const desc = getLocalizedField(it?.summary ?? it?.desc ?? it?.description ?? "", "");
          const date = getLocalizedField(it?.date ?? "", "");
          const badge = isPackageItem(it) ? "PACKAGE" : "TIP";

          return `
            <a class="wos-item" href="${href(`/tips/${hrefSlug}`)}" data-link style="flex-direction:column; gap:8px;">
              <div class="wos-badge">${esc(badge)}</div>
              <div class="wos-item-title">${esc(clampStr(title, 70))}</div>
              ${desc ? `<div class="wos-muted" style="font-size:13px;">${esc(clampStr(desc, 120))}</div>` : ""}
              ${date ? `<div class="wos-item-meta">${esc(String(date))}</div>` : ""}
            </a>
          `;
        }).join("")}
      </div>
    `;
  }

  // -------------------------
  // Public: Home preview
  // -------------------------
  function renderHomePreview({
    appEl,
    go,
    esc,
    clampStr,
    fetchJSONTryWithAttempts,
    pinnedSlugs = ["immigration-system-guide", "frost-dragon-emperor"],
    routeHref,
  }) {
    if (!appEl) return;

    const href = (p) => (typeof routeHref === "function" ? routeHref(p) : spaHref(p));

    appEl.innerHTML = `
      <div class="wos-panel" id="homeTipsRandom">
        <div class="wos-row">
          <div>
            <h2 style="margin:0 0 6px;">${esc(getText("homeTitle"))}</h2>
            <div class="wos-muted" style="font-size:13px;">${esc(getText("homeSub"))}</div>
          </div>
          <a class="wos-btn" href="${href("/tips")}" data-link>${esc(getText("homeBtn"))}</a>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;" data-area="cards"></div>
      </div>

      <div class="wos-panel" id="homeTipsPinned" style="margin-top:12px;">
        <div class="wos-row">
          <div>
            <h2 style="margin:0 0 6px;">${esc(getText("pinnedTitle"))}</h2>
            <div class="wos-muted" style="font-size:13px;">${esc(getText("pinnedSub"))}</div>
          </div>
          <a class="wos-btn" href="${href("/tips")}" data-link>${esc(getText("pinnedBtn"))}</a>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;" data-area="cards"></div>
      </div>
    `;

    (async () => {
      let items = [];
      try {
        items = await loadIndex(fetchJSONTryWithAttempts);
      } catch (e) {
        const randBox = appEl.querySelector("#homeTipsRandom [data-area='cards']");
        const pinBox = appEl.querySelector("#homeTipsPinned [data-area='cards']");
        if (randBox) renderEmptyCard(randBox, esc(getText("loadFail")), "/data/tips/index.json");
        if (pinBox) renderEmptyCard(pinBox, esc(getText("loadFail")), "/data/tips/index.json");
        console.error(e);
        return;
      }

      const randBox = appEl.querySelector("#homeTipsRandom [data-area='cards']");
      const pinBox = appEl.querySelector("#homeTipsPinned [data-area='cards']");

      const randomPool = items.filter((it) => !isPackageItem(it));
      const random3 = pickDailyRandom(randomPool, 3).map((it, i) => normTipCard(it, `Tip ${i + 1}`, clampStr));

      if (randBox) {
        if (!random3.length) {
          renderEmptyCard(randBox, esc(getText("noTips")), "/data/tips/index.json");
        } else {
          randBox.innerHTML = random3.map((t) => `
            <div class="wos-tip-card" role="button" tabindex="0" data-tip="${esc(t.slug)}">
              <div class="wos-tip-label">${esc(t.label)}</div>
              <div class="wos-tip-title">${esc(t.title)}</div>
              <p class="wos-tip-desc">${esc(t.desc)}</p>
            </div>
          `).join("");
        }
      }

      const pinned = (pinnedSlugs || [])
        .map((slug) => items.find((x) => String(x?.slug ?? "") === String(slug)))
        .filter(Boolean);

      const pinnedCards = pinned.map((it, i) => normTipCard(it, `Pinned ${i + 1}`, clampStr));

      if (pinBox) {
        if (!pinnedCards.length) {
          renderEmptyCard(pinBox, esc(getText("pinnedNotReady")), "PINNED_TIP_SLUGS / /data/tips/index.json");
        } else {
          pinBox.innerHTML = pinnedCards.map((t) => `
            <div class="wos-tip-card" role="button" tabindex="0" data-tip="${esc(t.slug)}">
              <div class="wos-tip-label">${esc(t.label)}</div>
              <div class="wos-tip-title">${esc(t.title)}</div>
              <p class="wos-tip-desc">${esc(t.desc)}</p>
            </div>
          `).join("");
        }
      }

      bindTipCardNav(appEl, go);
    })().catch((e) => console.error(e));
  }

  // -------------------------
  // Public: List
  // -------------------------
  async function renderList({ appEl, go, esc, clampStr, fetchJSONTryWithAttempts, routeHref }) {
    if (!appEl) return;

    let items = [];
    try {
      items = sortNonPackageFirst(sortByDateDesc(await loadIndex(fetchJSONTryWithAttempts)));
    } catch (e) {
      appEl.innerHTML = `
        <div class="wos-panel">
          <h2 style="margin:0 0 10px;">${esc(getText("tipsTitle"))}</h2>
          <div class="wos-muted" style="font-size:13px; line-height:1.65;">
            ${esc(getText("loadFail"))}<br>
            <span class="wos-mono">/data/tips/index.json</span>
          </div>
        </div>
      `;
      console.error(e);
      return;
    }

    const { nonPackages, packages } = splitByPackage(items);

    appEl.innerHTML = `
      <div class="wos-panel">
        ${
          items.length
            ? `
              <div style="margin-top:6px;">
                <div class="wos-row" style="align-items:flex-end; margin-bottom:8px;">
                  <div><div class="wos-muted" style="font-size:12px;">${esc(getText("listTips"))}</div></div>
                  <div class="wos-muted" style="font-size:12px;">${nonPackages.length} ${esc(getText("items"))}</div>
                </div>
                ${nonPackages.length
                  ? renderTipsGrid(nonPackages, esc, clampStr, routeHref)
                  : `<div class="wos-muted" style="font-size:13px; line-height:1.65;">${esc(getText("empty"))}</div>`
                }
              </div>

              <div style="margin-top:18px;">
                <div class="wos-row" style="align-items:flex-end; margin-bottom:8px;">
                  <div><div class="wos-muted" style="font-size:12px;">${esc(getText("listPackages"))}</div></div>
                  <div class="wos-muted" style="font-size:12px;">${packages.length} ${esc(getText("items"))}</div>
                </div>
                ${packages.length
                  ? renderTipsGrid(packages, esc, clampStr, routeHref)
                  : `<div class="wos-muted" style="font-size:13px; line-height:1.65;">${esc(getText("empty"))}</div>`
                }
              </div>
            `
            : `
              <div class="wos-muted" style="font-size:13px; line-height:1.65;">
                ${esc(getText("noTips"))}<br>
                <span class="wos-mono">/data/tips/index.json</span>
              </div>
            `
        }
      </div>
    `;
  }

  // -------------------------
  // Public: Detail
  // -------------------------
  async function renderDetail({ appEl, slug, go, esc, nl2br, fetchJSONTryWithAttempts, routeHref }) {
    if (!appEl) return;

    const href = (p) => (typeof routeHref === "function" ? routeHref(p) : spaHref(p));

    let tip = null;
    let attempted = [];
    try {
      tip = await loadDetail(fetchJSONTryWithAttempts, slug);
      attempted = Array.isArray(tip?.__attempted) ? tip.__attempted : [];
    } catch (e) {
      appEl.innerHTML = `
        <div class="wos-panel">
          <div class="wos-row" style="margin-bottom:10px;">
            <div>
              <h2 style="margin:0;">${esc(getText("tipsTitle"))}</h2>
              <div class="wos-muted" style="font-size:13px; margin-top:6px;">${esc(String(slug))}</div>
            </div>
            <a class="wos-btn" href="${href("/tips")}" data-link data-tips-back="1">${esc(getText("back"))}</a>
          </div>

          <div class="wos-muted" style="font-size:13px; line-height:1.65;">
            ${esc(getText("detailEmpty"))}
          </div>
        </div>
      `;
      console.error(e);
      return;
    }

    const title = getLocalizedField(tip?.title ?? tip?.name ?? slug, "Untitled");
    const summary = getLocalizedField(tip?.summary ?? tip?.desc ?? "", "");
    const bodyHtml = tip?.bodyHtml ?? tip?.html ?? tip?.contentHtml ?? "";
    const bodyText = !bodyHtml ? getLocalizedField(tip?.body ?? tip?.content ?? "", "") : "";

    const debugHtml = (DEBUG && attempted.length)
      ? `
        <div class="wos-panel" style="margin-top:12px; padding:12px;">
          <div class="wos-muted" style="font-size:12px; margin-bottom:6px;">Tried URLs</div>
          <div class="wos-mono" style="font-size:12px;">
            ${attempted.map((u) => `<div><code>${esc(u)}</code></div>`).join("")}
          </div>
        </div>
      `
      : "";

    appEl.innerHTML = `
      <div class="wos-panel">
        <div class="wos-row" style="margin-bottom:10px;">
          <div>
            <h2 style="margin:0;">${esc(title)}</h2>
            ${summary ? `<div class="wos-muted" style="font-size:13px; margin-top:6px;">${esc(summary)}</div>` : ""}
            ${DEBUG ? `
              <div class="wos-muted wos-mono" style="font-size:12px; margin-top:10px;">
                tips/${esc(String(slug))}${tip?.__source ? ` · ${esc(String(tip.__source))}` : ""}
              </div>
            ` : ""}
          </div>

          <!-- ✅ back 버튼은 이것만 -->
          <a class="wos-btn" href="${href("/tips")}" data-link data-tips-back="1">${esc(getText("back"))}</a>
        </div>

        <div data-tips-body="1">
          ${
            bodyHtml
              ? `<div style="margin-top:8px; line-height:1.7;">${bodyHtml}</div>`
              : (bodyText
                ? `<div class="wos-muted" style="margin-top:8px; font-size:14px; line-height:1.7;">${nl2br(bodyText)}</div>`
                : `<div class="wos-muted">${esc(getText("detailEmpty"))}</div>`)
          }
        </div>
      </div>
      ${debugHtml}
    `;

    // ✅ back 버튼만 history router로 이동
    const back = appEl.querySelector('[data-tips-back="1"]');
    if (back) {
      back.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || back.target === "_blank") return;
        e.preventDefault();
        go("/tips");
      });
    }

    // ✅ 본문 링크 보정 + 사이트 언어에 맞게 언어 블록 노출
    const bodyRoot = appEl.querySelector('[data-tips-body="1"]');
    rewriteTipBodyLinks(bodyRoot);
    applySiteLangBlocks(bodyRoot);
  }

  // =========================================================
  // ✅ NEW: /lootbar + /tips/* 에서 자동 보정 (#view 감시)
  // =========================================================
  function getAppPathNoHash() {
    let p = String(location.pathname || "/");
    p = p.replace(/\/index\.html?$/i, "");

    const base = normalizeBasePrefix(
      (typeof window.WOS_BASE === "string" ? window.WOS_BASE : "") || __BASE_PREFIX_FALLBACK__
    );

    if (base && p === base) p = "/";
    else if (base && p.startsWith(base + "/")) p = p.slice(base.length) || "/";

    if (!p.startsWith("/")) p = "/" + p;
    if (p.length > 1 && p.endsWith("/")) p = p.slice(0, -1);
    return p || "/";
  }

  function shouldFixLinksForThisPage() {
    const ap = getAppPathNoHash();
    return ap === "/lootbar" || ap === "/tips" || ap.startsWith("/tips/");
  }

  function globalFixOnce() {
    if (!shouldFixLinksForThisPage()) return;

    // ✅ 대부분은 #app이 안전(헤더의 data-lang 버튼과 충돌 방지)
    const view = document.querySelector("#view") || document.querySelector("#app") || document.body;
    if (!view) return;

    // 1) 링크 보정
    rewriteTipBodyLinks(view);

    // 2) 사이트 언어만 따라가서 언어 블록 노출
    applySiteLangBlocks(view);
  }

  function initGlobalViewObserver() {
    if (window.__WOS_TIPS_GLOBAL_FIX__) return;
    window.__WOS_TIPS_GLOBAL_FIX__ = true;

    const run = () => {
      try { globalFixOnce(); } catch (_) {}
    };

    // 1) 첫 실행
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", run, { once: true });
    } else {
      run();
    }

    // 2) #view가 나중에 생길 수 있어서 짧게 재시도 (최대 2초)
    let tries = 0;
    const tryAttach = () => {
      tries++;
      const target = document.querySelector("#view") || document.querySelector("#app");
      if (!target) {
        if (tries < 20) setTimeout(tryAttach, 100);
        return;
      }

      if (typeof MutationObserver !== "undefined") {
        let scheduled = false;
        const schedule = () => {
          if (scheduled) return;
          scheduled = true;
          (window.requestAnimationFrame || ((fn) => setTimeout(fn, 0)))(() => {
            scheduled = false;
            run();
          });
        };

        const mo = new MutationObserver(schedule);
        mo.observe(target, { childList: true, subtree: true });

        window.addEventListener("popstate", schedule);

        // ✅ 사이트 언어 바뀌면 팁 언어 노출도 즉시 갱신
        if (!window.__WOS_TIPS_LANGCHANGE_BOUND__) {
          window.__WOS_TIPS_LANGCHANGE_BOUND__ = true;
          window.addEventListener("wos:langchange", schedule);
        }

        if (!history.__WOS_TIPS_HISTORY_PATCHED__) {
          history.__WOS_TIPS_HISTORY_PATCHED__ = true;

          const _ps = history.pushState.bind(history);
          const _rs = history.replaceState.bind(history);

          history.pushState = function () {
            const ret = _ps.apply(history, arguments);
            schedule();
            return ret;
          };
          history.replaceState = function () {
            const ret = _rs.apply(history, arguments);
            schedule();
            return ret;
          };
        }

        run();
      }
    };
    tryAttach();
  }

  // =========================================================
  // Export
  // =========================================================
  window.WOS_TIPS = {
    renderHomePreview,
    renderList,
    renderDetail,
    rewriteTipBodyLinks,
  };

  // ✅ 전역 감시 시작
  initGlobalViewObserver();
})();

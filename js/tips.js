/* =========================================================
   WOS.GG - js/tips.js (MODULE) ✅ language-aware + multi-lang HTML
   - window.WOS_TIPS
   - Data:
     - index:  data/tips/index.json   (supports {items:[...]} or [...])
     - detail:
       - HTML priority:
         1) data/tips/items/{slug}.{lang}.html (and variants)
         2) data/tips/items/{slug}.html        (and variants)
         3) data/tips/{slug}.{lang}.html       (and variants)
         4) data/tips/{slug}.html              (and variants)
       - JSON fallback:
         5) data/tips/items/{slug}.json (and variants)
         6) data/tips/{slug}.json       (and variants)

   - Multi-language single HTML support:
     - Put blocks with: [data-lang="en|ko|ja"] OR [lang="en|ko|ja"]
     - Script extracts the best-matching block for current site language.
     - Fallback order: current lang -> en -> first available

   - Category:
     - Package category:
       - it.category === "package" | "packages"
       - OR tags include "package" | "packages"
       - OR slug contains "package"
     - List rule:
       - non-package first (top)
       - package last (bottom)

   - API:
     - renderHomePreview({ appEl, go, esc, clampStr, fetchJSONTryWithAttempts, pinnedSlugs })
     - renderList({ appEl, go, esc, clampStr, fetchJSONTryWithAttempts })
     - renderDetail({ appEl, slug, go, esc, nl2br, fetchJSONTryWithAttempts })
   ========================================================= */

(() => {
  "use strict";

  if (window.WOS_TIPS) return;

  const INDEX_CANDIDATES = [
    "data/tips/index.json",
    "page/data/tips/index.json",
    "/data/tips/index.json",
    "/page/data/tips/index.json",
  ];

  // -------------------------
  // Language helpers
  // -------------------------
  function pickLang(v) {
    const s = String(v || "").toLowerCase();
    if (s === "en" || s === "ko" || s === "ja") return s;
    // handle "en-US", "ko-KR"
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

  // Localized field support: string | number | {en,ko,ja} | {i18n:{...}}
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

  function sortNonPackageFirst(items) {
    const arr = (items || []).slice();
    arr.sort((a, b) => {
      const ap = isPackageItem(a) ? 1 : 0;
      const bp = isPackageItem(b) ? 1 : 0;
      return ap - bp;
    });
    return arr;
  }

  function splitByPackage(items) {
    const nonPackages = [];
    const packages = [];
    (items || []).forEach((it) => (isPackageItem(it) ? packages : nonPackages).push(it));
    return { nonPackages, packages };
  }

  // =========================
  // HTML/JSON detail loader
  // =========================
  async function tryFetchTextFirstOk(urls) {
    for (const url of urls) {
      try {
        const res = await fetch(url, { cache: "no-cache" });
        if (res && res.ok) {
          const txt = await res.text();
          if (typeof txt === "string") return { ok: true, url, text: txt };
        }
      } catch (_) {}
    }
    return { ok: false, url: null, text: "" };
  }

  // Build HTML candidates including lang variants
  function buildHtmlCandidates(slug, lang) {
    const s = String(slug ?? "");
    const enc = encodeURIComponent(s);
    const l = pickLang(lang);

    // Supported patterns:
    // - items/{slug}.{lang}.html
    // - items/{slug}-{lang}.html
    // - items/{lang}/{slug}.html
    // - items/{slug}.html
    // (same set for /data, /page/data, etc)
    const variants = [
      // items preferred
      `data/tips/items/${s}.${l}.html`,
      `page/data/tips/items/${s}.${l}.html`,
      `/data/tips/items/${s}.${l}.html`,
      `/page/data/tips/items/${s}.${l}.html`,
      `data/tips/items/${enc}.${l}.html`,
      `page/data/tips/items/${enc}.${l}.html`,
      `/data/tips/items/${enc}.${l}.html`,
      `/page/data/tips/items/${enc}.${l}.html`,

      `data/tips/items/${s}-${l}.html`,
      `page/data/tips/items/${s}-${l}.html`,
      `/data/tips/items/${s}-${l}.html`,
      `/page/data/tips/items/${s}-${l}.html`,
      `data/tips/items/${enc}-${l}.html`,
      `page/data/tips/items/${enc}-${l}.html`,
      `/data/tips/items/${enc}-${l}.html`,
      `/page/data/tips/items/${enc}-${l}.html`,

      `data/tips/items/${l}/${s}.html`,
      `page/data/tips/items/${l}/${s}.html`,
      `/data/tips/items/${l}/${s}.html`,
      `/page/data/tips/items/${l}/${s}.html`,
      `data/tips/items/${l}/${enc}.html`,
      `page/data/tips/items/${l}/${enc}.html`,
      `/data/tips/items/${l}/${enc}.html`,
      `/page/data/tips/items/${l}/${enc}.html`,

      // base items
      `data/tips/items/${s}.html`,
      `page/data/tips/items/${s}.html`,
      `/data/tips/items/${s}.html`,
      `/page/data/tips/items/${s}.html`,
      `data/tips/items/${enc}.html`,
      `page/data/tips/items/${enc}.html`,
      `/data/tips/items/${enc}.html`,
      `/page/data/tips/items/${enc}.html`,

      // tips root as fallback
      `data/tips/${s}.${l}.html`,
      `page/data/tips/${s}.${l}.html`,
      `/data/tips/${s}.${l}.html`,
      `/page/data/tips/${s}.${l}.html`,
      `data/tips/${enc}.${l}.html`,
      `page/data/tips/${enc}.${l}.html`,
      `/data/tips/${enc}.${l}.html`,
      `/page/data/tips/${enc}.${l}.html`,

      `data/tips/${s}-${l}.html`,
      `page/data/tips/${s}-${l}.html`,
      `/data/tips/${s}-${l}.html`,
      `/page/data/tips/${s}-${l}.html`,
      `data/tips/${enc}-${l}.html`,
      `page/data/tips/${enc}-${l}.html`,
      `/data/tips/${enc}-${l}.html`,
      `/page/data/tips/${enc}-${l}.html`,

      `data/tips/${l}/${s}.html`,
      `page/data/tips/${l}/${s}.html`,
      `/data/tips/${l}/${s}.html`,
      `/page/data/tips/${l}/${s}.html`,
      `data/tips/${l}/${enc}.html`,
      `page/data/tips/${l}/${enc}.html`,
      `/data/tips/${l}/${enc}.html`,
      `/page/data/tips/${l}/${enc}.html`,

      // base tips root
      `data/tips/${s}.html`,
      `page/data/tips/${s}.html`,
      `/data/tips/${s}.html`,
      `/page/data/tips/${s}.html`,
      `data/tips/${enc}.html`,
      `page/data/tips/${enc}.html`,
      `/data/tips/${enc}.html`,
      `/page/data/tips/${enc}.html`,
    ];

    // De-dup
    const seen = new Set();
    return variants.filter((u) => {
      if (seen.has(u)) return false;
      seen.add(u);
      return true;
    });
  }

  // Extract language block from a multi-lang HTML fragment
  function extractLangHtml(rawHtml, lang) {
    const l = pickLang(lang);
    const fallbackOrder = [l, "en", "ko", "ja"].filter((x, i, a) => a.indexOf(x) === i);

    let html = String(rawHtml || "");
    if (!html.trim()) return "";

    // Parse as document; handle both full HTML docs and fragments
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    // prefer <body> content if exists; else wrap fragment
    const container = doc.body || doc.documentElement;

    // If no language blocks exist, return original fragment/body
    const hasLangBlocks = container.querySelector("[data-lang], [lang]");
    if (!hasLangBlocks) {
      // If it was a full doc, return body innerHTML; otherwise return raw
      return (doc.body && doc.body.innerHTML && doc.body.innerHTML.trim()) ? doc.body.innerHTML : html;
    }

    // Find best match
    const pickNodes = (code) => {
      const nodes = Array.from(container.querySelectorAll(`[data-lang="${code}"], [lang="${code}"]`));
      return nodes;
    };

    let chosen = [];
    for (const code of fallbackOrder) {
      const nodes = pickNodes(code);
      if (nodes.length) {
        chosen = nodes;
        break;
      }
    }

    // If still none, choose first available lang block(s)
    if (!chosen.length) {
      const any = Array.from(container.querySelectorAll("[data-lang], [lang]"));
      if (any.length) chosen = [any[0]];
    }

    // Build combined HTML; remove script tags inside chosen blocks (keeps content safe/clean)
    const tmp = doc.createElement("div");
    chosen.forEach((n) => {
      const clone = n.cloneNode(true);
      clone.querySelectorAll("script").forEach((s) => s.remove());
      tmp.appendChild(clone);
    });

    return tmp.innerHTML || "";
  }

  async function loadDetail(fetchJSONTryWithAttempts, slug) {
    const s = String(slug ?? "");
    const enc = encodeURIComponent(s);
    const lang = getLangSafe();

    // 1) HTML first (lang-aware candidates)
    const htmlCandidates = buildHtmlCandidates(s, lang);
    const htmlRes = await tryFetchTextFirstOk(htmlCandidates);

    if (htmlRes.ok) {
      const body = extractLangHtml(htmlRes.text, lang);
      return {
        slug: s,
        title: null,
        summary: null,
        bodyHtml: body || htmlRes.text,
        __source: "html",
        __path: htmlRes.url,
      };
    }

    // 2) JSON fallback (original)
    const candidates = [
      `data/tips/${s}.json`,
      `page/data/tips/${s}.json`,
      `/data/tips/${s}.json`,
      `/page/data/tips/${s}.json`,
      `data/tips/${enc}.json`,
      `page/data/tips/${enc}.json`,
      `/data/tips/${enc}.json`,
      `/page/data/tips/${enc}.json`,

      `data/tips/items/${s}.json`,
      `page/data/tips/items/${s}.json`,
      `/data/tips/items/${s}.json`,
      `/page/data/tips/items/${s}.json`,
      `data/tips/items/${enc}.json`,
      `page/data/tips/items/${enc}.json`,
      `/data/tips/items/${enc}.json`,
      `/page/data/tips/items/${enc}.json`,
    ];

    const r = await fetchJSONTryWithAttempts(candidates);
    return r.data;
  }

  // -------------------------
  // UI helpers
  // -------------------------
  function bindTipCardNav(rootEl, go) {
    rootEl.querySelectorAll("[data-tip]").forEach((el) => {
      const slug = el.getAttribute("data-tip") || "";
      const to = `/tips/${slug}`;
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
  }) {
    if (!appEl) return;

    appEl.innerHTML = `
      <div class="wos-panel" id="homeTipsRandom">
        <div class="wos-row">
          <div>
            <h2 style="margin:0 0 6px;">${esc(getText("homeTitle"))}</h2>
            <div class="wos-muted" style="font-size:13px;">${esc(getText("homeSub"))}</div>
          </div>
          <a class="wos-btn" href="#/tips" data-link>${esc(getText("homeBtn"))}</a>
        </div>
        <div style="display:flex; flex-direction:column; gap:10px; margin-top:12px;" data-area="cards"></div>
      </div>

      <div class="wos-panel" id="homeTipsPinned" style="margin-top:12px;">
        <div class="wos-row">
          <div>
            <h2 style="margin:0 0 6px;">${esc(getText("pinnedTitle"))}</h2>
            <div class="wos-muted" style="font-size:13px;">${esc(getText("pinnedSub"))}</div>
          </div>
          <a class="wos-btn" href="#/tips" data-link>${esc(getText("pinnedBtn"))}</a>
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
        if (randBox) renderEmptyCard(randBox, esc(getText("loadFail")), "data/tips/index.json");
        if (pinBox) renderEmptyCard(pinBox, esc(getText("loadFail")), "data/tips/index.json");
        console.error(e);
        return;
      }

      const randBox = appEl.querySelector("#homeTipsRandom [data-area='cards']");
      const pinBox = appEl.querySelector("#homeTipsPinned [data-area='cards']");

      // Random 3 (exclude packages)
      const randomPool = items.filter((it) => !isPackageItem(it));
      const random3 = pickDailyRandom(randomPool, 3).map((it, i) => normTipCard(it, `Tip ${i + 1}`, clampStr));

      if (randBox) {
        if (!random3.length) {
          renderEmptyCard(randBox, esc(getText("noTips")), "data/tips/index.json");
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

      // Pinned
      const pinned = (pinnedSlugs || [])
        .map((slug) => items.find((x) => String(x?.slug ?? "") === String(slug)))
        .filter(Boolean);

      const pinnedCards = pinned.map((it, i) => normTipCard(it, `Pinned ${i + 1}`, clampStr));

      if (pinBox) {
        if (!pinnedCards.length) {
          renderEmptyCard(
            pinBox,
            esc(getText("pinnedNotReady")),
            "PINNED_TIP_SLUGS / data/tips/index.json"
          );
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

  function renderTipsGrid(items, esc, clampStr) {
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
            <a class="wos-item" href="#/tips/${esc(hrefSlug)}" data-link style="flex-direction:column; gap:8px;">
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
  // Public: List
  // -------------------------
  async function renderList({ appEl, go, esc, clampStr, fetchJSONTryWithAttempts }) {
    if (!appEl) return;

    let items = [];
    try {
      items = sortNonPackageFirst(sortByDateDesc(await loadIndex(fetchJSONTryWithAttempts)));
    } catch (e) {
      appEl.innerHTML = `
        <div class="wos-panel">
          <h2 style="margin:0 0 10px;">${esc(getText("tipsTitle"))}</h2>
          <div class="wos-muted" style="font-size:13px; line-height:1.65;">
            ${esc(getText("empty"))}<br>
            <span class="wos-mono">data/tips/index.json</span>
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
              <!-- non-package -->
              <div style="margin-top:6px;">
                <div class="wos-row" style="align-items:flex-end; margin-bottom:8px;">
                  <div><div class="wos-muted" style="font-size:12px;">${esc(getText("listTips"))}</div></div>
                  <div class="wos-muted" style="font-size:12px;">${nonPackages.length} ${esc(getText("items"))}</div>
                </div>
                ${nonPackages.length
                  ? renderTipsGrid(nonPackages, esc, clampStr)
                  : `<div class="wos-muted" style="font-size:13px; line-height:1.65;">${esc(getText("empty"))}</div>`
                }
              </div>

              <!-- packages -->
              <div style="margin-top:18px;">
                <div class="wos-row" style="align-items:flex-end; margin-bottom:8px;">
                  <div><div class="wos-muted" style="font-size:12px;">${esc(getText("listPackages"))}</div></div>
                  <div class="wos-muted" style="font-size:12px;">${packages.length} ${esc(getText("items"))}</div>
                </div>
                ${packages.length
                  ? renderTipsGrid(packages, esc, clampStr)
                  : `<div class="wos-muted" style="font-size:13px; line-height:1.65;">${esc(getText("empty"))}</div>`
                }
              </div>
            `
            : `
              <div class="wos-muted" style="font-size:13px; line-height:1.65;">
                ${esc(getText("empty"))}<br>
                <span class="wos-mono">data/tips/index.json</span>
              </div>
            `
        }
      </div>
    `;
  }

  // -------------------------
  // Public: Detail
  // -------------------------
  async function renderDetail({ appEl, slug, go, esc, nl2br, fetchJSONTryWithAttempts }) {
    if (!appEl) return;

    let tip = null;
    try {
      tip = await loadDetail(fetchJSONTryWithAttempts, slug);
    } catch (e) {
      appEl.innerHTML = `
        <div class="wos-panel">
          <div class="wos-row" style="margin-bottom:10px;">
            <div>
              <h2 style="margin:0;">${esc(getText("tipsTitle"))}</h2>
              <div class="wos-muted" style="font-size:13px; margin-top:6px;">${esc(String(slug))}</div>
            </div>
            <a class="wos-btn" href="#/tips" data-link>${esc(getText("back"))}</a>
          </div>
          <div class="wos-muted" style="font-size:13px; line-height:1.65;">
            ${esc(getText("empty"))}<br>
            <span class="wos-mono">data/tips/items/${esc(String(slug))}.html</span><br>
            <span class="wos-mono">data/tips/${esc(String(slug))}.json</span>
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

    appEl.innerHTML = `
      <div class="wos-panel">
        <div class="wos-row" style="margin-bottom:10px;">
          <div>
            <h2 style="margin:0;">${esc(title)}</h2>
            ${summary ? `<div class="wos-muted" style="font-size:13px; margin-top:6px;">${esc(summary)}</div>` : ""}
            <div class="wos-muted wos-mono" style="font-size:12px; margin-top:10px;">
              tips/${esc(String(slug))}${tip?.__source ? ` · ${esc(String(tip.__source))}` : ""}
            </div>
          </div>
          <a class="wos-btn" href="#/tips" data-link>${esc(getText("back"))}</a>
        </div>

        ${
          bodyHtml
            ? `<div style="margin-top:8px; line-height:1.7;">${bodyHtml}</div>`
            : (bodyText
                ? `<div class="wos-muted" style="margin-top:8px; font-size:14px; line-height:1.7;">${nl2br(bodyText)}</div>`
                : `<div class="wos-muted">${esc(getText("detailEmpty"))}</div>`)
        }
      </div>
    `;

    const back = appEl.querySelector('a[data-link]');
    if (back) {
      back.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || back.target === "_blank") return;
        e.preventDefault();
        go("/tips");
      });
    }
  }

  window.WOS_TIPS = {
    renderHomePreview,
    renderList,
    renderDetail,
  };
})();

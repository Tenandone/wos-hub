/* =========================================================
   WOS.GG - buildings.js (List + Detail Module) - FULL (FINAL) ✅
   ✅ "객체 인자" 호출 방식 유지 (app.js 호환)
      - renderList({ DATA_BASE, appEl, showError, esc, fetchJSONTry, t, ctx })
      - renderDetail({ slug, DATA_BASE, appEl, showError, esc, fmtNum, fetchJSONTry, t, ctx })

   ✅ GitHub Pages repo prefix 안전 (중요)
      - /data/... /assets/... 처럼 "슬래시로 시작"하면 repo 페이지에서 404가 나므로
        fetch/img 모두 resolveFetch/resolveRes로 prefix 보정

   ✅ i18n READY
      - ctx.t 우선, 없으면 opts.t, 없으면 window.WOS_I18N.t fallback
      - buildings.{slug}.meta.title / buildings.{slug}.meta.description 우선

   ✅ FIX: 빌딩 이미지 깨짐/진입 불가 원인 해결
      - 시그니처 불일치 해결(객체 인자)
      - 리소스 경로 prefix 해결
   ========================================================= */
(() => {
  "use strict";

  // =========================
  // A) Cost mapping (resource keys)
  // =========================
  const RES = {
    food: "res_100011",
    wood: "res_103",
    coal: "res_104",
    iron: "res_105",
    fireCrystal: "res_100081",
    refineStone: "res_100082",
  };

  const RES_COLS_ALL = [
    { id: "food",        labelKey: "buildings.res.food",        fallback: "Food",           key: RES.food },
    { id: "wood",        labelKey: "buildings.res.wood",        fallback: "Wood",           key: RES.wood },
    { id: "coal",        labelKey: "buildings.res.coal",        fallback: "Coal",           key: RES.coal },
    { id: "iron",        labelKey: "buildings.res.iron",        fallback: "Iron",           key: RES.iron },
    { id: "fireCrystal", labelKey: "buildings.res.fireCrystal", fallback: "Fire Crystal",   key: RES.fireCrystal },
    { id: "refineStone", labelKey: "buildings.res.refineStone", fallback: "Refining Stone", key: RES.refineStone },
  ];

  function colsForSection(sectionKey) {
    if (sectionKey === "base") {
      return RES_COLS_ALL.filter(c => c.id !== "fireCrystal" && c.id !== "refineStone");
    }
    if (sectionKey === "firecrystal") {
      return RES_COLS_ALL.filter(c => c.id !== "refineStone");
    }
    return RES_COLS_ALL;
  }

  function getCost(costs, key) {
    if (!costs) return null;
    return costs[key] ?? null;
  }

  // =========================
  // B) Slug aliases
  // =========================
  const SLUG_ALIASES = {
    crystallaboratory: "crystallaboratory",
    crystallalaboratory: "crystallaboratory",
  };

  function normalizedSlug(slug) {
    const s = String(slug || "").trim();
    return SLUG_ALIASES[s] || s;
  }

  // =========================
  // C) i18n (ctx.t > opts.t > window.WOS_I18N.t)
  // =========================
  function makeT(opts) {
    const ctx = (opts && opts.ctx) ? opts.ctx : null;
    const tFn =
      (ctx && typeof ctx.t === "function" ? ctx.t : null) ||
      (opts && typeof opts.t === "function" ? opts.t : null) ||
      (window.WOS_I18N && typeof window.WOS_I18N.t === "function" ? window.WOS_I18N.t.bind(window.WOS_I18N) : null);

    return function _t(key, fallback, vars) {
      try {
        if (!tFn) return (fallback !== undefined ? fallback : key);
        const v = tFn(key, vars);
        const s = (v === null || v === undefined) ? "" : String(v);
        if (!s.trim() || s === key) return (fallback !== undefined ? fallback : key);
        return s;
      } catch (_) {
        return (fallback !== undefined ? fallback : key);
      }
    };
  }

  // =========================
  // D) Safe helpers
  // =========================
  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, m => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    }[m]));
  }

  function attr(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function isProbablyHtml(s) {
    const t = String(s ?? "");
    return /<\/?[a-z][\s\S]*>/i.test(t);
  }

  function renderDescHtml(desc) {
    const d = desc ?? "";
    if (!d) return "";
    if (typeof d === "string" && isProbablyHtml(d)) {
      return `<div class="prose" style="line-height:1.75;text-align:center;">${String(d)}</div>`;
    }
    return `<div class="prose" style="white-space:pre-wrap;line-height:1.75;text-align:center;">${esc(String(d))}</div>`;
  }

  function safeSlug(slug) {
    return encodeURIComponent(String(slug ?? "").trim());
  }

  function cleanTitle(raw, fallback) {
    const t = String(raw ?? "").trim();
    if (!t) return String(fallback ?? "").trim() || "Building";
    const cut = t.split(" - ")[0].trim();
    return cut || t;
  }

  // =========================
  // E) URL helpers (repo prefix safe)
  // =========================
  function ensureLeadingSlash(p) {
    const s = String(p || "");
    if (!s) return s;
    return s.charAt(0) === "/" ? s : ("/" + s);
  }

  function stripLeadingSlash(p) {
    return String(p || "").replace(/^\//, "");
  }

  function resolveRes(opts, path) {
    if (!path) return path;
    const ctx = (opts && opts.ctx) ? opts.ctx : null;

    // absolute URL keep
    if (/^(https?:)?\/\//i.test(String(path))) return String(path);

    // normalize ../ ./ (상대경로 꼬임 방지)
    let p = String(path).replace(/^(\.\.\/)+/, "").replace(/^\.\//, "");

    // window.WOS_RES는 보통 "/assets/..." 형태를 기대함
    if (typeof window.WOS_RES === "function") {
      return window.WOS_RES(ensureLeadingSlash(p));
    }

    // ctx.withBase가 있으면 그걸 최우선(너 split build 규칙)
    if (ctx && typeof ctx.withBase === "function") {
      return ctx.withBase(ensureLeadingSlash(p));
    }

    // baseURI 기반 fallback
    try {
      return new URL(stripLeadingSlash(p), document.baseURI).toString();
    } catch (_) {
      return p;
    }
  }

  function resolveFetch(opts, path) {
    // fetch도 동일 규칙(리소스와 같음)
    return resolveRes(opts, path);
  }

  function routeHref(opts, path) {
    const ctx = (opts && opts.ctx) ? opts.ctx : null;
    if (ctx && typeof ctx.routeHref === "function") return ctx.routeHref(path);
    return path;
  }

  function go(opts, path) {
    const ctx = (opts && opts.ctx) ? opts.ctx : null;
    if (ctx && typeof ctx.go === "function") return ctx.go(path);
    location.href = routeHref(opts, path);
  }

  // =========================
  // F) DATA_BASE 후보 (✅ 앞에 / 붙이면 repo에서 404 나서 제거!)
  // =========================
  const DATA_BASE_CANDIDATES = [
    "data/buildings",
    "assets/data/buildings",
    "assets/data/buildings/base",
  ];

  function buildIndexUrlCandidates(base) {
    const b = String(base || "").replace(/\/$/, "");
    // base가 이미 .../base면 중복 방지
    const isBase = /\/base$/i.test(b);
    return isBase
      ? [`${b}/index.json`]
      : [`${b}/index.json`, `${b}/base/index.json`];
  }

  function buildDetailUrlCandidates(base, slug) {
    const s = String(slug || "").trim();
    const a = SLUG_ALIASES[s];
    const slugsToTry = a ? [s, a] : [s];

    const b = String(base || "").replace(/\/$/, "");
    const isBase = /\/base$/i.test(b);

    const urls = [];
    for (const x of slugsToTry) {
      urls.push(`${b}/${encodeURIComponent(x)}.json`);
      if (!isBase) urls.push(`${b}/base/${encodeURIComponent(x)}.json`);
    }
    return urls;
  }

  function normalizeIndexItems(idx) {
    if (!idx) return [];
    if (Array.isArray(idx)) return idx;
    if (Array.isArray(idx.items)) return idx.items;
    return [];
  }

  async function fetchJSON(opts, url) {
    const u = resolveFetch(opts, url);
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${u}`);
    return await r.json();
  }

  async function fetchJSONTryFallback(opts, urls) {
    let lastErr;
    for (const url of urls) {
      try {
        return await fetchJSON(opts, url);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("fetchJSONTryFallback: all candidates failed");
  }

  async function resolveDataBase(fetchTry, opts) {
    const tryFn = fetchTry || ((urls) => fetchJSONTryFallback(opts || {}, urls));
    const o = opts || {};
    for (const base of DATA_BASE_CANDIDATES) {
      try {
        await tryFn(buildIndexUrlCandidates(base), o);
        return base;
      } catch (_) {}
    }
    return DATA_BASE_CANDIDATES[0];
  }

  // =========================
  // G) Image fallback
  // =========================
  function imageSlugFor(slug) {
    const s = String(slug || "").trim();
    const a = SLUG_ALIASES[s];
    return (a || s || "unknown");
  }

  function fallbackMainImage(slug) {
    const imgSlug = imageSlugFor(slug);
    // ✅ 절대경로(/) 금지: repo에서 깨짐 -> 상대형으로 만들고 resolveRes로 처리
    return `assets/buildings/${imgSlug}/firecrystal_img/${imgSlug}.png`;
  }

  // =========================
  // H) UI style
  // =========================
  const PAGE_WRAP_STYLE =
    "max-width:1100px;margin:0 auto;padding:0 12px;box-sizing:border-box;text-align:center;";

  function defaultShowError(err) {
    console.error(err);
  }

  // =========================
  // I) LIST (객체 인자 방식 유지)
  // =========================
  async function renderList(opts) {
    opts = opts || {};
    const appEl = opts.appEl;
    if (!appEl) return;

    const _t = makeT(opts);
    const _showError = typeof opts.showError === "function" ? opts.showError : defaultShowError;
    const fetchTry = typeof opts.fetchJSONTry === "function"
      ? opts.fetchJSONTry
      : (urls) => fetchJSONTryFallback(opts, urls);

    const base = opts.DATA_BASE || await resolveDataBase((urls) => fetchTry(urls), opts);

    appEl.innerHTML = `
      <div class="wos-page" style="${PAGE_WRAP_STYLE}">
        <div class="loading">${esc(_t("buildings.loading_list", "Loading buildings…"))}</div>
      </div>
    `;

    let idx;
    try {
      idx = await fetchTry(buildIndexUrlCandidates(base));
    } catch (err) {
      _showError(err, { attempted: buildIndexUrlCandidates(base), base });
      appEl.innerHTML = `
        <div class="wos-page" style="${PAGE_WRAP_STYLE}">
          <div class="error" style="text-align:center;">
            <h2>${esc(_t("buildings.load_failed", "Failed to load buildings"))}</h2>
            <p class="muted">${esc(String(err && (err.message || err) || ""))}</p>
          </div>
        </div>
      `;
      return;
    }

    const items = normalizeIndexItems(idx);
    const placeholder = resolveRes(opts, "assets/img/placeholder.png");

    appEl.innerHTML = `
      <div class="wos-page" style="${PAGE_WRAP_STYLE}">
        <header class="page-head" style="text-align:center;">
          <h1 class="h1" style="margin:8px 0 6px;" data-i18n="buildings.list.title">
            ${esc(_t("buildings.list.title", "Buildings"))}
          </h1>
          <p class="muted" style="margin:0 0 14px;" data-i18n="buildings.list.subtitle">
            ${esc(_t("buildings.list.subtitle", "Select a building to view details."))}
          </p>
        </header>

        <section class="grid building-grid" style="
          display:grid;
          justify-content:center;
          justify-items:center;
          grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));
          gap:14px;
          width:100%;
          margin:0 auto;
        ">
          ${items.map(it => {
            const slug = String(it?.slug ?? it?.meta?.slug ?? "").trim();
            if (!slug) return "";

            const nSlug = normalizedSlug(slug);

            const jsonTitle = (it?.name ?? it?.meta?.title ?? slug);
            const i18nTitleKey = `buildings.${nSlug}.meta.title`;
            const name = cleanTitle(_t(i18nTitleKey, jsonTitle), slug);

            const rawImg =
              (it?.img ? String(it.img) : "") ||
              (it?.image ? String(it.image) : "") ||
              (it?.assets?.mainImage ? String(it.assets.mainImage) : "") ||
              "";

            const imgSrc = resolveRes(opts, rawImg || fallbackMainImage(slug));

            const href = routeHref(opts, `/buildings/${safeSlug(slug)}`);

            return `
              <a class="card building-card" href="${attr(href)}" data-link="1"
                 style="text-align:center;padding:14px;width:100%;max-width:280px;">
                <img
                  class="building-card-img"
                  src="${attr(imgSrc)}"
                  alt="${attr(name)}"
                  loading="lazy"
                  onerror="this.onerror=null;this.src='${attr(placeholder)}';"
                  style="display:block;width:100%;height:160px;object-fit:contain;margin:0 auto 10px;border-radius:16px;"
                >
                <strong style="display:block;font-weight:900;"
                        data-i18n="${attr(i18nTitleKey)}">${esc(name)}</strong>
              </a>
            `;
          }).join("")}
        </section>
      </div>
    `;

    // i18n apply hook
    try {
      if (opts.ctx && typeof opts.ctx.applyI18n === "function") opts.ctx.applyI18n(appEl);
      else if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") window.WOS_I18N.apply(appEl);
    } catch (_) {}
  }

  // =========================
  // J) DETAIL (객체 인자 방식 유지)
  // =========================
  async function renderDetail(opts) {
    opts = opts || {};
    const appEl = opts.appEl;
    if (!appEl) return;

    const _t = makeT(opts);
    const _showError = typeof opts.showError === "function" ? opts.showError : defaultShowError;

    const fetchTry = typeof opts.fetchJSONTry === "function"
      ? opts.fetchJSONTry
      : (urls) => fetchJSONTryFallback(opts, urls);

    const slug = String(opts.slug ?? "").trim();
    if (!slug) {
      appEl.innerHTML = `
        <div class="wos-page" style="${PAGE_WRAP_STYLE}">
          <div class="error" style="text-align:center;">
            <h2>${esc(_t("buildings.detail_failed", "Failed to load building detail"))}</h2>
            <p class="muted">${esc(_t("buildings.not_found", "Building not found."))}</p>
          </div>
        </div>
      `;
      return;
    }

    const base = opts.DATA_BASE || await resolveDataBase((urls) => fetchTry(urls), opts);
    const attempted = buildDetailUrlCandidates(base, slug);

    appEl.innerHTML = `
      <div class="wos-page" style="${PAGE_WRAP_STYLE}">
        <div class="loading">${esc(_t("buildings.loading_detail", "Loading building…"))}</div>
      </div>
    `;

    let data;
    try {
      data = await fetchTry(attempted);
    } catch (err) {
      _showError(err, { attempted, base });
      appEl.innerHTML = `
        <div class="wos-page" style="${PAGE_WRAP_STYLE}">
          <div class="error" style="text-align:center;">
            <h2>${esc(_t("buildings.detail_failed", "Failed to load building detail"))}</h2>
            <p class="muted">${esc(String(err && (err.message || err) || ""))}</p>
          </div>
        </div>
      `;
      return;
    }

    // ---- assets merge (detail + index fallback) ----
    let assets = (data && typeof data === "object" && data.assets && typeof data.assets === "object")
      ? data.assets
      : {};

    const needsIndexAssets = !assets || !assets.mainImage;

    if (needsIndexAssets) {
      try {
        const idx = await fetchTry(buildIndexUrlCandidates(base));
        const items = normalizeIndexItems(idx);

        const s = String(slug || "").trim();
        const a = SLUG_ALIASES[s];
        const slugsToTry = a ? [s, a] : [s];

        const found =
          items.find(it => it && slugsToTry.includes(String(it.slug || "").trim())) ||
          items.find(it => it && slugsToTry.includes(String(it.meta?.slug || "").trim())) ||
          null;

        const idxAssets = found?.assets && typeof found.assets === "object" ? found.assets : {};
        if (!idxAssets.mainImage) {
          const fimg = (found && (found.img || found.image)) ? String(found.img || found.image) : "";
          if (fimg) idxAssets.mainImage = fimg;
        }

        assets = { ...(idxAssets || {}), ...(assets || {}) };
        data.assets = assets;
      } catch (_) {}
    }

    // ---- meta i18n ----
    const nSlug = normalizedSlug(slug);

    const jsonTitle =
      data?.meta?.displayTitle ??
      data?.meta?.name ??
      data?.name ??
      data?.meta?.title ??
      data?.title ??
      nSlug;

    const jsonDesc =
      data?.meta?.displayDescription ??
      data?.meta?.description ??
      data?.description ??
      "";

    const i18nTitleKey = `buildings.${nSlug}.meta.title`;
    const i18nDescKey  = `buildings.${nSlug}.meta.description`;

    const title = cleanTitle(_t(i18nTitleKey, jsonTitle), nSlug);
    const rawDesc = _t(i18nDescKey, jsonDesc);

    const mainImageSrc = resolveRes(
      opts,
      (assets?.mainImage ? String(assets.mainImage) : "") || fallbackMainImage(nSlug)
    );

    const placeholder = resolveRes(opts, "assets/img/placeholder.png");

    const phases = [
      { key: "base",            labelKey: "buildings.phase.1", fallback: "Phase 1" },
      { key: "firecrystal",     labelKey: "buildings.phase.2", fallback: "Phase 2" },
      { key: "firecrystalPlus", labelKey: "buildings.phase.3", fallback: "Phase 3" },
    ].map(p => ({
      ...p,
      hasRows: Array.isArray(data?.[p.key]?.rows) && data[p.key].rows.length > 0
    }));

    const available = phases.filter(p => p.hasRows);
    const hasAnyPhase = available.length > 0;
    const defaultPhase = (available[0]?.key) || "base";

    const _fmtNum = typeof opts.fmtNum === "function" ? opts.fmtNum : (n => (n === null || n === undefined || n === "" ? "-" : String(n)));

    appEl.innerHTML = `
      <div class="wos-page" style="${PAGE_WRAP_STYLE}">
        <div class="topbar" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
          <button class="btn" type="button" data-i18n="buildings.detail.back">
            ${esc(_t("buildings.detail.back","← Buildings"))}
          </button>
        </div>

        <header class="page-head" style="text-align:center;">
          <div class="building-hero" style="display:flex;justify-content:center;margin:12px 0;">
            <img
              class="building-main-img"
              src="${attr(mainImageSrc)}"
              alt="${attr(title)}"
              loading="lazy"
              onerror="this.onerror=null; this.src='${attr(placeholder)}';"
              style="display:block;margin:0 auto;border-radius:18px;max-height:320px;object-fit:contain;"
            >
          </div>

          <h1 class="h1" style="margin:8px 0 10px;" data-i18n="${attr(i18nTitleKey)}">${esc(title)}</h1>

          ${rawDesc ? `
            <div class="muted" style="max-width:920px;margin:0 auto;" data-i18n="${attr(i18nDescKey)}">
              ${renderDescHtml(rawDesc)}
            </div>
          ` : ""}
        </header>

        ${hasAnyPhase ? `
          <section class="panel" style="text-align:center;">
            <p class="common-note" style="margin:0;line-height:1.7;text-align:center;" data-i18n="buildings.notice.build_time">
              ${esc(_t("buildings.notice.build_time",
                "The construction times recorded beneath are the base times. It does not take into account any reduction benefits like State Buff, Research, Zinman's skill and etc. For most players, the time to build would be lesser than what is listed here."
              ))}
            </p>
          </section>

          <div class="tabs" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:14px 0 10px;">
            ${available.map(p => `
              <button type="button" class="tab" data-key="${esc(p.key)}" data-i18n="${esc(p.labelKey)}">
                ${esc(_t(p.labelKey, p.fallback))}
              </button>
            `).join("")}
          </div>

          <section id="table-area"></section>
        ` : ``}

        <section id="extra-area"></section>
      </div>
    `;

    // back hook
    const backBtn = appEl.querySelector(".topbar .btn");
    if (backBtn) backBtn.addEventListener("click", () => go(opts, "/buildings"));

    // tabs + table
    if (hasAnyPhase) {
      setActiveTab(defaultPhase);
      renderSection(defaultPhase);

      appEl.querySelectorAll(".tabs .tab").forEach(btn => {
        btn.addEventListener("click", () => {
          const key = btn.dataset.key;
          setActiveTab(key);
          renderSection(key);
        });
      });
    }

    // extras
    renderExtras(data);

    // i18n apply hook
    try {
      if (opts.ctx && typeof opts.ctx.applyI18n === "function") opts.ctx.applyI18n(appEl);
      else if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") window.WOS_I18N.apply(appEl);
    } catch (_) {}

    function setActiveTab(key) {
      appEl.querySelectorAll(".tabs .tab").forEach(b => {
        b.classList.toggle("active", b.dataset.key === key);
      });
    }

    function renderSection(sectionKey) {
      const rows = data?.[sectionKey]?.rows ?? [];
      const area = appEl.querySelector("#table-area");
      if (!area) return;

      if (!rows.length) {
        area.innerHTML = "";
        return;
      }

      const cols = colsForSection(sectionKey);

      area.innerHTML = `
        <div class="panel" style="text-align:center;">
          <div class="table-wrap" style="overflow-x:auto;">
            <table class="tbl" style="min-width:860px;width:max-content;margin:0 auto;border-collapse:collapse;">
              <thead>
                <tr>
                  <th data-i18n="buildings.table.level">${esc(_t("buildings.table.level","Level"))}</th>
                  <th class="prereq" data-i18n="buildings.table.prereq">${esc(_t("buildings.table.prereq","Prerequisites"))}</th>
                  ${cols.map(c => `
                    <th class="res-head">
                      <span data-i18n="${esc(c.labelKey)}">${esc(_t(c.labelKey, c.fallback))}</span>
                    </th>
                  `).join("")}
                  <th data-i18n="buildings.table.time">${esc(_t("buildings.table.time","Time"))}</th>
                  <th data-i18n="buildings.table.power">${esc(_t("buildings.table.power","Power"))}</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => {
                  const costs = r.costs ?? {};
                  const prereq = esc(String(r.prerequisites ?? "")).replace(/\n/g, "<br>");
                  return `
                    <tr>
                      <td class="mono">${esc(r.level)}</td>
                      <td class="prereq" style="text-align:left;white-space:normal;line-height:1.35;">${prereq}</td>
                      ${cols.map(c => `<td class="num">${esc(_fmtNum(getCost(costs, c.key)))}</td>`).join("")}
                      <td class="mono">${esc(r.time?.raw ?? "-")}</td>
                      <td class="num">${esc(r.power ?? "-")}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;

      // re-apply i18n (table rerender)
      try {
        if (opts.ctx && typeof opts.ctx.applyI18n === "function") opts.ctx.applyI18n(area);
        else if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") window.WOS_I18N.apply(area);
      } catch (_) {}
    }

    function renderExtras(dataObj) {
      const root = appEl.querySelector("#extra-area");
      if (!root) return;

      const sections = dataObj?.extras?.sections;
      if (!Array.isArray(sections) || sections.length === 0) {
        root.innerHTML = "";
        return;
      }

      root.innerHTML = `
        <div class="panel" style="text-align:center;">
          <h2 class="h2" style="margin:0 0 12px;" data-i18n="buildings.extras.title">
            ${esc(_t("buildings.extras.title","Tips & Notes"))}
          </h2>
          <div class="stack" style="text-align:left;max-width:980px;margin:0 auto;">
            ${sections.map(sec => renderExtraSection(sec)).join("")}
          </div>
        </div>
      `;
    }

    function renderExtraSection(sec) {
      const type = String(sec?.type ?? "").toLowerCase();
      const titleHtml = sec?.title
        ? `<h3 class="h3" style="margin:14px 0 8px;">${esc(sec.title)}</h3>`
        : "";

      if (type === "table") {
        const cols = Array.isArray(sec.columns) ? sec.columns : [];
        const rows = Array.isArray(sec.rows) ? sec.rows : [];

        return `
          <div class="extra-section">
            ${titleHtml}
            <div class="table-wrap" style="overflow-x:auto;">
              <table class="tbl" style="min-width:720px;width:max-content;margin:0 auto;border-collapse:collapse;">
                <thead>
                  <tr>${cols.map(c => `<th>${esc(c)}</th>`).join("")}</tr>
                </thead>
                <tbody>
                  ${rows.map(r => `
                    <tr>
                      ${(Array.isArray(r) ? r : []).map(cell =>
                        `<td>${esc(String(cell ?? "")).replace(/\n/g, "<br>")}</td>`
                      ).join("")}
                    </tr>
                  `).join("")}
                </tbody>
              </table>
            </div>
          </div>
        `;
      }

      if (type === "text") {
        const body = sec?.text
          ? `<div class="muted" style="white-space:pre-wrap;line-height:1.75;">${esc(sec.text)}</div>`
          : "";

        const bullets = Array.isArray(sec?.bullets) ? sec.bullets : [];
        const list = bullets.length
          ? `<ul class="ul">
              ${bullets.map(b => `<li style="line-height:1.7;">${esc(String(b ?? "")).replace(/\n/g, "<br>")}</li>`).join("")}
            </ul>`
          : "";

        return `
          <div class="extra-section">
            ${titleHtml}
            ${body}
            ${list}
          </div>
        `;
      }

      return `
        <div class="extra-section">
          ${titleHtml}
          <p class="muted small" data-i18n="buildings.extras.unsupported">
            ${esc(_t("buildings.extras.unsupported","Unsupported extra type:"))}
            <span class="mono">${esc(sec?.type ?? "")}</span>
          </p>
        </div>
      `;
    }
  }

  // =========================
  // Export
  // =========================
  window.WOS_BUILDINGS = {
    RES,
    SLUG_ALIASES,
    buildIndexUrlCandidates,
    buildDetailUrlCandidates,
    normalizeIndexItems,
    fallbackMainImage,
    resolveDataBase,
    renderList,
    renderDetail,
  };
})();

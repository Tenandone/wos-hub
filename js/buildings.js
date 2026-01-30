/* =========================================================
   WOS.GG DEV - buildings.js (List + Detail Module) - FINAL + i18n READY
   ✅ 기존 기능 유지
   ✅ 고정 UI 텍스트는 data-i18n 키로만 출력 (언어 변경 즉시 반영)
   ✅ app.js에서 t를 넘겨주면(권장) fallback 텍스트도 자동 번역됨
   ✅ (추가) 빌딩별 meta.title / meta.description 도 i18n 키 우선 적용
      - 키: buildings.{slug}.meta.title
      - 키: buildings.{slug}.meta.description
      - 없으면 기존 JSON(meta/title/description)로 fallback
   ✅ (추가) LIST(목록) 페이지 카드 건물명도 i18n 키 우선 적용
      - 키: buildings.{slug}.meta.title
   ✅ FIX: detail description 렌더링 시 HTML/텍스트 모두 안전 처리 (escape 함수 일관화)
   ✅ FIX: renderDescHtml에 잘못된 escFn 전달 문제 수정
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

  // ✅ label을 직접 문자열로 고정하지 말고 i18n key로
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
  // B) Dev slug alias
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
  // C) URL helpers
  // =========================
  function buildDetailUrlCandidates(base, slug) {
    const s = String(slug || "").trim();
    const a = SLUG_ALIASES[s];
    const slugsToTry = a ? [s, a] : [s];

    const urls = [];
    for (const x of slugsToTry) {
      urls.push(`${base}/${x}.json`);
      urls.push(`${base}/base/${x}.json`);
    }
    return urls;
  }

  function buildIndexUrlCandidates(base) {
    return [
      `${base}/index.json`,
      `${base}/base/index.json`,
    ];
  }

  function normalizeIndexItems(idx) {
    if (!idx) return [];
    if (Array.isArray(idx)) return idx;
    if (Array.isArray(idx.items)) return idx.items;
    return [];
  }

  // =========================
  // D) Safe helpers
  // =========================
  function escFallback(v) {
    return String(v ?? "").replace(/[&<>"']/g, m => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[m]));
  }

  function attr(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function safeSlug(slug) {
    return encodeURIComponent(String(slug ?? "").trim());
  }

  async function fetchJSON(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${url}`);
    return await r.json();
  }

  async function fetchJSONTryFallback(urls) {
    let lastErr;
    for (const u of urls) {
      try {
        return await fetchJSON(u);
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr || new Error("fetchJSONTry: all candidates failed");
  }

  // =========================
  // E) DATA_BASE 자동 탐색
  // =========================
  const DATA_BASE_CANDIDATES = [
    "/assets/data/buildings",
    "/data/buildings",
    "/assets/data/buildings/base",
  ];

  async function resolveDataBase(fetchJSONTry) {
    const tryFn = fetchJSONTry || fetchJSONTryFallback;

    for (const base of DATA_BASE_CANDIDATES) {
      try {
        await tryFn(buildIndexUrlCandidates(base));
        return base;
      } catch (_) {}
    }
    return DATA_BASE_CANDIDATES[0];
  }

  // =========================
  // F) Main image fallback helper
  // =========================
  function imageSlugFor(slug) {
    const s = String(slug || "").trim();
    const a = SLUG_ALIASES[s];
    return (a || s || "unknown");
  }

  function fallbackMainImage(slug) {
    const imgSlug = imageSlugFor(slug);
    return `/assets/buildings/${imgSlug}/firecrystal_img/${imgSlug}.png`;
  }

  // =========================
  // G) Center wrap style
  // =========================
  const PAGE_WRAP_STYLE =
    "max-width:1100px;margin:0 auto;padding:0 12px;box-sizing:border-box;text-align:center;";

  // =========================
  // H) Title clean helpers
  // =========================
  function cleanTitle(raw, fallback) {
    const t = String(raw ?? "").trim();
    if (!t) return String(fallback ?? "").trim() || "Building";
    const cut = t.split(" - ")[0].trim();
    return cut || t;
  }

  function isProbablyHtml(s) {
    const t = String(s ?? "");
    return /<\/?[a-z][\s\S]*>/i.test(t);
  }

  // ✅ escFn은 "escape function" 자체를 기대 (문자열이 아님)
  function renderDescHtml(desc, escFn) {
    const _esc = typeof escFn === "function" ? escFn : escFallback;
    const d = desc ?? "";
    if (!d) return "";

    if (typeof d === "string" && isProbablyHtml(d)) {
      // HTML이면 그대로 렌더 (신뢰할 수 있는 소스라는 전제)
      return `<div class="prose" style="line-height:1.75;text-align:center;">${d}</div>`;
    }

    const safe = _esc(String(d));
    return `<div class="prose" style="white-space:pre-wrap;line-height:1.75;text-align:center;">${safe}</div>`;
  }

  // =========================
  // I) LIST
  // =========================
  async function renderList({
    DATA_BASE,
    appEl,
    showError,
    esc,
    fetchJSONTry,
    t, // ✅ i18n
  }) {
    const _esc = esc || escFallback;
    const _fetchTry = fetchJSONTry || fetchJSONTryFallback;
    const _showError = showError || ((err) => console.error(err));
    const _t = (k, fb) => {
      try { return (typeof t === "function" ? t(k) : null) || fb || k; } catch (_) { return fb || k; }
    };

    const base = DATA_BASE || await resolveDataBase(_fetchTry);

    let idx;
    try {
      idx = await _fetchTry(buildIndexUrlCandidates(base));
    } catch (err) {
      _showError(err, { attempted: buildIndexUrlCandidates(base), base });
      return;
    }

    const items = normalizeIndexItems(idx);

    appEl.innerHTML = `
      <div class="wos-page" style="${PAGE_WRAP_STYLE}">
        <header class="page-head" style="text-align:center;">
          <h1 class="h1" style="margin:8px 0 6px;"
              data-i18n="buildings.list.title">${_esc(_t("buildings.list.title","Buildings"))}</h1>
          <p class="muted" style="margin:0 0 14px;"
             data-i18n="buildings.list.subtitle">${_esc(_t("buildings.list.subtitle","Select a building to view details."))}</p>
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
            const slug = String(it?.slug ?? "").trim();
            const nSlug = normalizedSlug(slug);

            const jsonTitle = (it?.name ?? it?.meta?.title ?? slug);
            const i18nTitleKey = `buildings.${nSlug}.meta.title`;
            const name = cleanTitle(_t(i18nTitleKey, jsonTitle), slug);

            const imgSrc = (it?.img ? String(it.img) : "") || fallbackMainImage(slug);
            const href = `/buildings/${safeSlug(slug)}`;

            return `
              <a class="card building-card" href="${attr(href)}" data-link
                 style="text-align:center;padding:14px;width:100%;max-width:280px;">
                <img
                  class="building-card-img"
                  src="${attr(imgSrc)}"
                  alt="${attr(name)}"
                  loading="lazy"
                  onerror="this.onerror=null; this.src='/assets/img/placeholder.png';"
                  style="display:block;width:100%;height:160px;object-fit:contain;margin:0 auto 10px;border-radius:16px;"
                >
                <strong
                  style="display:block;font-weight:900;"
                  data-i18n="${attr(i18nTitleKey)}"
                >${_esc(name)}</strong>
              </a>
            `;
          }).join("")}
        </section>
      </div>
    `;
  }

  // =========================
  // J) DETAIL
  // =========================
  async function renderDetail({
    slug,
    DATA_BASE,
    appEl,
    showError,
    esc,
    fmtNum,
    fetchJSONTry,
    t, // ✅ i18n
  }) {
    const _esc = esc || escFallback;
    const _fetchTry = fetchJSONTry || fetchJSONTryFallback;
    const _showError = showError || ((err) => console.error(err));
    const _t = (k, fb) => {
      try { return (typeof t === "function" ? t(k) : null) || fb || k; } catch (_) { return fb || k; }
    };

    const base = DATA_BASE || await resolveDataBase(_fetchTry);

    const attempted = buildDetailUrlCandidates(base, slug);

    let data;
    try {
      data = await _fetchTry(attempted);
    } catch (err) {
      _showError(err, { attempted, base });
      return;
    }

    // ---- assets merge (detail + index fallback) ----
    let assets = (data && typeof data === "object" && data.assets && typeof data.assets === "object")
      ? data.assets
      : {};

    const needsIndexAssets = !assets || !assets.mainImage;

    if (needsIndexAssets) {
      try {
        const idx = await _fetchTry(buildIndexUrlCandidates(base));
        const items = normalizeIndexItems(idx);

        const s = String(slug || "").trim();
        const a = SLUG_ALIASES[s];
        const slugsToTry = a ? [s, a] : [s];

        const found =
          items.find(it => it && slugsToTry.includes(String(it.slug || "").trim())) ||
          items.find(it => it && slugsToTry.includes(String(it.meta?.slug || "").trim())) ||
          null;

        const idxAssets = found?.assets && typeof found.assets === "object" ? found.assets : {};

        assets = { ...(idxAssets || {}), ...(assets || {}) };
        data.assets = assets;
      } catch (_) {}
    }

    // -------------------------
    // ✅ 빌딩 meta i18n 키 우선 적용
    // 키: buildings.{slug}.meta.title / buildings.{slug}.meta.description
    // -------------------------
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

    const mainImageSrc =
      (assets?.mainImage ? String(assets.mainImage) : "") ||
      fallbackMainImage(nSlug);

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

    const _fmtNum = fmtNum || ((n) => (n === null || n === undefined || n === "" ? "-" : String(n)));

    appEl.innerHTML = `
      <div class="wos-page" style="${PAGE_WRAP_STYLE}">
        <div class="topbar" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">
          <a class="btn" href="/buildings" data-link
             data-i18n="buildings.detail.back">${_esc(_t("buildings.detail.back","← Buildings"))}</a>
        </div>

        <header class="page-head" style="text-align:center;">
          <div class="building-hero" style="display:flex;justify-content:center;margin:12px 0;">
            <img
              class="building-main-img"
              src="${attr(mainImageSrc)}"
              alt="${attr(title)}"
              loading="lazy"
              onerror="this.onerror=null; this.src='/assets/img/placeholder.png';"
              style="display:block;margin:0 auto;border-radius:18px;max-height:320px;object-fit:contain;"
            >
          </div>

          <h1 class="h1" style="margin:8px 0 10px;">${_esc(title)}</h1>
          ${rawDesc ? `
            <div class="muted" style="max-width:920px;margin:0 auto;">
              ${renderDescHtml(rawDesc, _esc)}
            </div>
          ` : ""}
        </header>

        ${hasAnyPhase ? `
          <section class="panel" style="text-align:center;">
            <p class="common-note" style="margin:0;line-height:1.7;text-align:center;"
               data-i18n="buildings.notice.build_time">
               ${_esc(_t("buildings.notice.build_time",
                 "The construction times recorded beneath are the base times. It does not take into account any reduction benefits like State Buff, Research, Zinman's skill and etc. For most players, the time to build would be lesser than what is listed here."
               ))}
            </p>
          </section>

          <div class="tabs" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:14px 0 10px;">
            ${available.map(p => `
              <button type="button" class="tab" data-key="${_esc(p.key)}"
                data-i18n="${_esc(p.labelKey)}">${_esc(_t(p.labelKey, p.fallback))}</button>
            `).join("")}
          </div>

          <section id="table-area"></section>
        ` : ``}

        <section id="extra-area"></section>
      </div>
    `;

    if (hasAnyPhase) {
      renderSection(defaultPhase);
      setActiveTab(defaultPhase);

      appEl.querySelectorAll(".tabs .tab").forEach(btn => {
        btn.addEventListener("click", () => {
          const key = btn.dataset.key;
          setActiveTab(key);
          renderSection(key);
        });
      });
    }

    renderExtras(data);

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
                  <th data-i18n="buildings.table.level">${_esc(_t("buildings.table.level","Level"))}</th>
                  <th class="prereq" data-i18n="buildings.table.prereq">${_esc(_t("buildings.table.prereq","Prerequisites"))}</th>
                  ${cols.map(c => `
                    <th class="res-head">
                      <span data-i18n="${_esc(c.labelKey)}">${_esc(_t(c.labelKey, c.fallback))}</span>
                    </th>
                  `).join("")}
                  <th data-i18n="buildings.table.time">${_esc(_t("buildings.table.time","Time"))}</th>
                  <th data-i18n="buildings.table.power">${_esc(_t("buildings.table.power","Power"))}</th>
                </tr>
              </thead>
              <tbody>
                ${rows.map(r => {
                  const costs = r.costs ?? {};
                  const prereq = _esc(String(r.prerequisites ?? "")).replace(/\n/g, "<br>");
                  return `
                    <tr>
                      <td class="mono">${_esc(r.level)}</td>
                      <td class="prereq" style="text-align:left;white-space:normal;line-height:1.35;">${prereq}</td>
                      ${cols.map(c => `<td class="num">${_fmtNum(getCost(costs, c.key))}</td>`).join("")}
                      <td class="mono">${_esc(r.time?.raw ?? "-")}</td>
                      <td class="num">${_esc(r.power ?? "-")}</td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
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
          <h2 class="h2" style="margin:0 0 12px;"
              data-i18n="buildings.extras.title">${_esc(_t("buildings.extras.title","Tips & Notes"))}</h2>
          <div class="stack" style="text-align:left;max-width:980px;margin:0 auto;">
            ${sections.map(sec => renderExtraSection(sec)).join("")}
          </div>
        </div>
      `;
    }

    function renderExtraSection(sec) {
      const type = String(sec?.type ?? "").toLowerCase();
      const titleHtml = sec?.title
        ? `<h3 class="h3" style="margin:14px 0 8px;">${_esc(sec.title)}</h3>`
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
                  <tr>${cols.map(c => `<th>${_esc(c)}</th>`).join("")}</tr>
                </thead>
                <tbody>
                  ${rows.map(r => `
                    <tr>
                      ${(Array.isArray(r) ? r : []).map(cell =>
                        `<td>${_esc(String(cell ?? "")).replace(/\n/g, "<br>")}</td>`
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
          ? `<div class="muted" style="white-space:pre-wrap;line-height:1.75;">${_esc(sec.text)}</div>`
          : "";

        const bullets = Array.isArray(sec?.bullets) ? sec.bullets : [];
        const list = bullets.length
          ? `<ul class="ul">
              ${bullets.map(b => `<li style="line-height:1.7;">${_esc(String(b ?? "")).replace(/\n/g, "<br>")}</li>`).join("")}
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
          <p class="muted small"
             data-i18n="buildings.extras.unsupported">
             ${_esc(_t("buildings.extras.unsupported","Unsupported extra type:"))}
             <span class="mono">${_esc(sec?.type ?? "")}</span>
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
    buildDetailUrlCandidates,
    buildIndexUrlCandidates,
    normalizeIndexItems,
    fallbackMainImage,
    resolveDataBase,
    renderList,
    renderDetail,
  };
})();

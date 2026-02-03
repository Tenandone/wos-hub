/* =========================================================
   WosHub - js/app.js (Split Build) - MAIN ✅ i18n + Pages
   - ✅ History API Router (NO HASH):
     (/buildings, /buildings/furnace, /heroes, /heroes/charlie,
      /tools, /tools/building-calculator, /tips, /tips/xxx, /lootbar)

   - ✅ 외부 모듈 수정 없음
   - ✅ /tips/:slug 일부 정적 HTML 직접 렌더 (lootbar 등)
   - ✅ FIX:
     * scheme 없는 외부링크 => https:// 자동 보정
     * 정적 HTML 주입 후 외부 링크 보정 + data-link 제거

   - ✅ NEW:
     * 언어 변경 시 (FULL RELOAD 없이) 현재 라우트 자동 리렌더
       - Core의 bindLangUIOnce가 hardReload:true로 강제하는 것을
         app.js에서 "capture listener"로 선점해서 hardReload:false로 처리
   ========================================================= */

(() => {
  "use strict";

  if (!window.WOS_CORE) {
    console.error("[WOS] app.core.js not loaded. Load /js/app.core.js before /js/app.js");
    return;
  }

  const CORE = window.WOS_CORE;

  // =========================================================
  // ✅ 0) Language change => rerender current route (NO FULL RELOAD)
  // =========================================================
  function bindLangRefreshOnce() {
    if (window.__WOS_LANG_REFRESH_BOUND__) return;
    window.__WOS_LANG_REFRESH_BOUND__ = true;

    let scheduled = false;

    const schedule = () => {
      if (scheduled) return;
      scheduled = true;

      requestAnimationFrame(() => {
        scheduled = false;
        try {
          if (window.WOS_APP && typeof window.WOS_APP.rerender === "function") {
            window.WOS_APP.rerender();
          } else {
            router().catch((err) => CORE.showError(err));
          }
        } catch (err) {
          CORE.showError(err);
        }
      });
    };

    // core setLang()이 dispatch 하는 이벤트
    window.addEventListener("wos:langchange", schedule);

    // 혹시 다른 이벤트를 쓰는 경우 대비 (있어도 무해)
    window.addEventListener("wos:i18nchange", schedule);
    window.addEventListener("i18n:change", schedule);
  }

  // =========================================================
  // ✅ 0.1) Stop CORE hard reload on language UI
  // - core가 bubble 단계에서 강제 reload를 걸어도,
  //   app.js가 capture 단계에서 먼저 가로채서 hardReload:false로 처리
  // =========================================================
  function bindLangUiNoHardReloadOnce() {
    if (window.__WOS_LANG_UI_NO_RELOAD_BOUND__) return;
    window.__WOS_LANG_UI_NO_RELOAD_BOUND__ = true;

    // change: <select id="langSelect"> or [data-lang-select="1"]
    document.addEventListener(
      "change",
      (e) => {
        const target = e && e.target;
        if (!target || !target.closest) return;

        const sel = target.closest("#langSelect,[data-lang-select='1']");
        if (!sel) return;

        const v = String(sel.value || "").toLowerCase();
        if (!v) return;

        // core bubble listener 막기
        try {
          e.stopImmediatePropagation();
          e.stopPropagation();
        } catch (_) {}

        // ✅ hardReload:false 로 언어 변경 (sync/async 모두 안전)
        Promise.resolve(CORE.setLang(v, { hardReload: false })).catch(() => {});
      },
      true // ✅ capture
    );

    // click: <a data-lang-link="ko">
    document.addEventListener(
      "click",
      (e) => {
        const t = e && e.target;
        if (!t || !t.closest) return;

        const btn = t.closest("[data-lang-link]");
        if (!btn) return;

        // 새 탭/특수키는 브라우저 기본 동작
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (btn.tagName === "A" && btn.target === "_blank") return;

        const v = String(btn.getAttribute("data-lang-link") || "").toLowerCase();
        if (!v) return;

        // core bubble listener 막기
        try {
          e.preventDefault();
          e.stopImmediatePropagation();
          e.stopPropagation();
        } catch (_) {}

        // ✅ hardReload:false 로 언어 변경 (sync/async 모두 안전)
        Promise.resolve(CORE.setLang(v, { hardReload: false })).catch(() => {});
      },
      true // ✅ capture
    );
  }

  // 먼저 바인딩 (언어 토글이 빨리 눌려도 잡히게)
  bindLangRefreshOnce();
  bindLangUiNoHardReloadOnce();

  // =========================
  // 1) Config
  // =========================
  let DATA_BASE = "/data/buildings";
  let DATA_BASE_HEROES = "/data/heroes";

  const BUILDING_CALC_KEY = "furnace";

  // state 공유 (core의 showError가 참조)
  CORE.setState({ DATA_BASE, DATA_BASE_HEROES });

  // =========================
  // 2) Tips: static HTML mapping
  // =========================
  // /data/tips/items/lootbar.html
  const TIP_HTML_MAP = {
    lootbar: "lootbar.html",
  };

  function guideLabelByLang(lang) {
    if (lang === "ko")
      return { openLootbar: "루트바 바로가기", openGuide: "루트바 셀프충전 가이드 바로가기" };
    if (lang === "ja") return { openLootbar: "LootBarを開く", openGuide: "セルフチャージガイド" };
    return { openLootbar: "Open LootBar", openGuide: "Self Top-up Guide" };
  }

  // =========================
  // 3) Affiliate
  // =========================
  async function loadAffiliateBox() {
    const candidates = ["/data/affiliate-lootbar.json", "/data/afflilate-lootbar.json"];
    try {
      const r = await CORE.fetchJSONTryWithAttempts(candidates);
      return r.data || null;
    } catch (_) {
      return null;
    }
  }

  function renderAffiliateBox(data) {
    if (!data) return "";

    const lang = CORE.getLangSafe();
    const badge = CORE.getLocalizedField(data.badge, lang, "Affiliate/Ad");
    const title = CORE.getLocalizedField(data.title, lang, "LootBar Guide");
    const intro = CORE.getLocalizedField(data.intro, lang, "");
    const coupon = CORE.getLocalizedField(data.coupon, lang, "");
    const trust = CORE.getLocalizedField(data.trust, lang, "");
    const choice = CORE.getLocalizedField(data.choiceNote, lang, "");

    const linkLabelFromData = CORE.getLocalizedField(data?.link?.label, lang, "");
    const linkUrlRaw = String(data?.link?.url || "").trim();
    const linkUrl = CORE.normalizeExternalHref(linkUrlRaw);

    const points = data?.keyPoints && data.keyPoints[lang] ? data.keyPoints[lang] : [];
    const safePoints = Array.isArray(points) ? points : [];

    const labels = guideLabelByLang(lang);
    const openLootbarLabel = linkLabelFromData || labels.openLootbar;
    const guideHref = CORE.routeHref("/tips/lootbar");

    const btnRow = `
      <div class="wos-btnrow">
        ${
          linkUrl
            ? `<a class="wos-btn" href="${CORE.esc(linkUrl)}" target="_blank" rel="noopener noreferrer">${CORE.esc(
                openLootbarLabel
              )}</a>`
            : ""
        }
        <a class="wos-btn" href="${CORE.esc(guideHref)}" data-link>${CORE.esc(labels.openGuide)}</a>
      </div>
    `;

    return `
      <div class="wos-panel" style="margin-top:12px;">
        <div style="min-width:0;">
          <div class="wos-badge">${CORE.esc(badge)}</div>
          <h2 style="margin:10px 0 6px; font-size:18px; letter-spacing:-.2px;">${CORE.esc(title)}</h2>
          ${
            intro
              ? `<div class="wos-muted" style="font-size:13px; line-height:1.65;">${CORE.esc(intro)}</div>`
              : ""
          }
        </div>

        ${coupon ? `<div style="margin-top:10px; font-weight:900;">${CORE.esc(coupon)}</div>` : ""}

        ${
          safePoints.length
            ? `<div style="margin-top:10px;">
                 <ul style="margin:8px 0 0; padding-left:18px; line-height:1.75;">
                   ${safePoints.map((s) => `<li>${CORE.esc(String(s))}</li>`).join("")}
                 </ul>
               </div>`
            : ""
        }

        ${
          trust
            ? `<div class="wos-muted" style="margin-top:10px; font-size:13px; line-height:1.65;">${CORE.esc(
                trust
              )}</div>`
            : ""
        }
        ${
          choice
            ? `<div class="wos-muted" style="margin-top:10px; font-size:13px; line-height:1.65;">${CORE.esc(
                choice
              )}</div>`
            : ""
        }

        ${btnRow}
      </div>
    `;
  }

  function renderLootbarPage(data) {
    const lang = CORE.getLangSafe();
    const labels = guideLabelByLang(lang);

    if (!data) {
      return `
        <div class="wos-panel">
          <h2 style="margin:0 0 8px; font-size:20px;">LootBar</h2>
          <div class="wos-muted" style="font-size:13px; line-height:1.7;">
            <div>데이터 파일이 없어서 내용을 표시할 수 없어.</div>
            <div class="wos-mono" style="margin-top:10px;">/data/affiliate-lootbar.json (또는 /data/afflilate-lootbar.json)</div>
          </div>

          <div class="wos-btnrow">
            <a class="wos-btn" href="${CORE.esc(CORE.routeHref("/tips/lootbar"))}" data-link>${CORE.esc(
        labels.openGuide
      )}</a>
          </div>
        </div>
      `;
    }

    const badge = CORE.getLocalizedField(data.badge, lang, "Affiliate/Ad");
    const title = CORE.getLocalizedField(data.title, lang, "LootBar Guide");
    const intro = CORE.getLocalizedField(data.intro, lang, "");
    const coupon = CORE.getLocalizedField(data.coupon, lang, "");
    const trust = CORE.getLocalizedField(data.trust, lang, "");
    const choice = CORE.getLocalizedField(data.choiceNote, lang, "");

    const linkLabelFromData = CORE.getLocalizedField(data?.link?.label, lang, "");
    const linkUrlRaw = String(data?.link?.url || "").trim();
    const linkUrl = CORE.normalizeExternalHref(linkUrlRaw);

    const points = data?.keyPoints && data.keyPoints[lang] ? data.keyPoints[lang] : [];
    const safePoints = Array.isArray(points) ? points : [];

    const openLootbarLabel = linkLabelFromData || labels.openLootbar;
    const guideHref = CORE.routeHref("/tips/lootbar");

    return `
      <div class="wos-panel">
        <div style="min-width:0;">
          <div class="wos-badge">${CORE.esc(badge)}</div>
          <h2 style="margin:10px 0 6px; font-size:22px; letter-spacing:-.3px;">${CORE.esc(title)}</h2>
          ${
            intro
              ? `<div class="wos-muted" style="font-size:13px; line-height:1.75;">${CORE.esc(intro)}</div>`
              : ""
          }
        </div>

        ${coupon ? `<div style="margin-top:12px; font-weight:950;">${CORE.esc(coupon)}</div>` : ""}

        ${
          safePoints.length
            ? `<div style="margin-top:12px;">
                 <h3 style="margin:0 0 8px; font-size:16px;">Key Points</h3>
                 <ul style="margin:8px 0 0; padding-left:18px; line-height:1.85;">
                   ${safePoints.map((s) => `<li>${CORE.esc(String(s))}</li>`).join("")}
                 </ul>
               </div>`
            : ""
        }

        ${
          trust
            ? `<div class="wos-muted" style="margin-top:12px; font-size:13px; line-height:1.75;">${CORE.esc(
                trust
              )}</div>`
            : ""
        }
        ${
          choice
            ? `<div class="wos-muted" style="margin-top:12px; font-size:13px; line-height:1.75;">${CORE.esc(
                choice
              )}</div>`
            : ""
        }

        <div class="wos-btnrow">
          ${
            linkUrl
              ? `<a class="wos-btn" href="${CORE.esc(linkUrl)}" target="_blank" rel="noopener noreferrer">${CORE.esc(
                  openLootbarLabel
                )}</a>`
              : ""
          }
          <a class="wos-btn" href="${CORE.esc(guideHref)}" data-link>${CORE.esc(labels.openGuide)}</a>
        </div>
      </div>
    `;
  }

  // =========================
  // 4) Home data
  // =========================
  async function loadLatestUploads() {
    const candidates = ["/data/latest.json"];
    try {
      const r = await CORE.fetchJSONTryWithAttempts(candidates);
      const list = CORE.normalizeIndex(r.data);
      return list.slice(0, 10);
    } catch (_) {
      return [];
    }
  }

  function normLatestItem(it) {
    const category = it?.category ?? it?.type ?? it?.badge ?? "Update";
    const title = it?.title ?? it?.name ?? it?.label ?? it?.slug ?? "Untitled";
    const date = CORE.fmtDateLike(it?.date ?? it?.time ?? it?.updatedAt ?? it?.createdAt ?? "");
    let href = it?.href ?? it?.url ?? it?.link ?? it?.path ?? "";

    const ap = href ? CORE.toAppPathFromHref(href) || (href.startsWith("/") ? href : "") : "";
    if (ap && CORE.isSpaPath(ap)) href = CORE.routeHref(ap);
    else href = CORE.routeHref("/");

    return { category, title, date, href };
  }

  async function loadTipsIndex() {
    const candidates = ["/data/tips/index.json"];
    const r = await CORE.fetchJSONTryWithAttempts(candidates);
    const items = CORE.normalizeIndex(r.data);
    return items.filter((it) => (it?.status ?? "published") === "published");
  }

  function normTipItem(it) {
    const title = it?.title ?? it?.name ?? it?.slug ?? "Tip";
    const slug = String(it?.slug ?? "");
    const date = CORE.fmtDateLike(it?.date ?? it?.updatedAt ?? it?.createdAt ?? "");
    const category = it?.category ?? it?.tag ?? "Tip";
    return { title, slug, date, category };
  }

  // Deterministic "daily random" pick
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
      let x = (seed += 0x6d2b79f5);
      x = Math.imul(x ^ (x >>> 15), x | 1);
      x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pickDailyFixed(items, count = 3) {
    const list = (items || []).slice();
    if (!list.length) return [];

    const d = new Date();
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(
      2,
      "0"
    )}`;
    const rnd = mulberry32(hashStringToInt(key));

    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }

    return list.slice(0, Math.min(count, list.length));
  }

  async function detectDataBaseBuildings() {
    return CORE.withRes("/data/buildings");
  }
  async function detectDataBaseHeroes() {
    return CORE.withRes("/data/heroes");
  }

  // =========================
  // 4.1) Static HTML injected content: external link sanitize
  // =========================
  function fixInjectedExternalLinks(root) {
    try {
      if (!root) return;
      const links = root.querySelectorAll ? root.querySelectorAll("a[href]") : [];
      links.forEach((a) => {
        try {
          let href = String(a.getAttribute("href") || "").trim();
          if (!href || href.startsWith("#")) return;

          const fixed = CORE.normalizeExternalHref(href);
          if (fixed && fixed !== href) {
            a.setAttribute("href", fixed);
            href = fixed;
          }

          // same-origin이면 건드리지 않음(=SPA가 처리 가능)
          const u = new URL(href, location.href);
          if (/^(mailto:|tel:|sms:|data:|blob:)/i.test(u.protocol)) return;
          if (u.origin === location.origin) return;

          // 외부 링크는 SPA 속성 제거 + 새탭
          a.removeAttribute("data-link");
          a.removeAttribute("data-nav");
          a.setAttribute("data-external", "true");
          if (typeof CORE.ensureExternalTarget === "function") {
            CORE.ensureExternalTarget(a);
          } else {
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  // =========================
  // 5) History Router (NO HASH)
  // =========================
  function go(path) {
    let p = String(path ?? "").trim();
    const appPath = CORE.toAppPathFromHref(p) || (p.startsWith("/") ? p : p ? "/" + p : "/");
    if (!CORE.isSpaPath(appPath)) return;

    history.pushState({}, "", CORE.withBase(appPath));
    router().catch((err) => CORE.showError(err));
  }

  // appcore에서 호출 가능하게 공개
  if (!window.WOS_APP) window.WOS_APP = {};
  window.WOS_APP.go = go;
  window.WOS_APP.rerender = function () {
    return router().catch((err) => CORE.showError(err));
  };

  function bindLinkInterceptOnce() {
    if (window.__WOS_LINK_INTERCEPT_BOUND__) return;
    window.__WOS_LINK_INTERCEPT_BOUND__ = true;

    // ✅ 캡처 단계에서 SPA 라우트만 가로챔 + 외부링크는 무조건 브라우저 기본동작
    document.addEventListener(
      "click",
      (e) => {
        const a = e?.target?.closest?.("a");
        if (!a) return;

        // 0) 기본 허용 조건
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        if (a.hasAttribute("download")) return;
        if (a.getAttribute("data-no-spa") === "1") return;

        let href = (a.getAttribute("href") || "").trim();
        if (!href) return;
        if (href.startsWith("#")) return;

        // 1) scheme 없는 외부 링크 사전 보정
        const fixed = CORE.normalizeExternalHref(href);
        if (fixed && fixed !== href) {
          a.setAttribute("href", fixed);
          href = fixed;
        }

        // 2) data-external="true"는 무조건 외부 취급
        if (a.dataset && a.dataset.external === "true") {
          a.removeAttribute("data-link");
          a.removeAttribute("data-nav");
          CORE.ensureExternalTarget(a);
          return;
        }

        // 3) 외부 도메인(origin 다름)은 절대 SPA가 가로채지 않음
        try {
          const u = new URL(href, location.href);

          if (/^(mailto:|tel:|sms:|data:|blob:)/i.test(u.protocol)) return;

          if (u.origin !== location.origin) {
            a.removeAttribute("data-link");
            a.removeAttribute("data-nav");
            a.setAttribute("data-external", "true");
            CORE.ensureExternalTarget(a);
            return;
          }
        } catch (_) {
          return;
        }

        // 4) SPA 경로 판별
        const appPath = CORE.toAppPathFromHref(href);
        if (!appPath) return;
        if (!CORE.isSpaPath(appPath)) return;

        // 5) 여기부터 SPA 라우트
        e.preventDefault();
        e.stopPropagation();
        go(appPath);
      },
      true
    );
  }

  function bindPopStateOnce() {
    if (window.__WOS_POPSTATE_BOUND__) return;
    window.__WOS_POPSTATE_BOUND__ = true;

    window.addEventListener("popstate", () => {
      router().catch((err) => CORE.showError(err));
    });
  }

  // =========================
  // 6) Pages
  // =========================
  async function pageHome() {
    const path = CORE.getPath();
    const view = CORE.renderShell({ path, title: "", contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    const lang = CORE.getLangSafe();

    let todaysTips = [];
    try {
      const tipsAll = (await loadTipsIndex()).map(normTipItem);
      todaysTips = pickDailyFixed(tipsAll, 3);
    } catch (_) {
      todaysTips = [];
    }

    const latestRaw = await loadLatestUploads();
    const latest = latestRaw.map(normLatestItem).slice(0, 10);

    const affiliateData = await loadAffiliateBox();
    const affiliateHtml = renderAffiliateBox(affiliateData);

    view.innerHTML = `
      <section class="wos-home">
        <div class="wos-home-grid">

          <div class="wos-panel">
            <div class="wos-row" style="margin-bottom:10px;">
              <div>
                <h2 style="margin:0 0 6px;" data-i18n="home.quick_access">${CORE.esc(
                  CORE.t("home.quick_access") || "Quick Access"
                )}</h2>
              </div>
            </div>

            <div class="wos-tiles">
              <a class="wos-tile wos-tile--img" href="${CORE.routeHref("/buildings")}" data-link>
                <div class="wos-iconbox">
                  <img src="${CORE.esc(CORE.withRes("/assets/buildings/furnace/firecrystal_img/furnace.png"))}" alt="Buildings" loading="lazy">
                </div>
                <div style="min-width:0;">
                  <div class="wos-tile-title" data-i18n="nav.buildings">${CORE.esc(
                    CORE.t("nav.buildings") || "Buildings"
                  )}</div>
                </div>
              </a>

              <a class="wos-tile wos-tile--img" href="${CORE.routeHref("/heroes")}" data-link>
                <div class="wos-iconbox">
                  <img src="${CORE.esc(CORE.withRes("/assets/heroes/ssr/s1/jeronimo/img/jeronimo.png"))}" alt="Heroes" loading="lazy">
                </div>
                <div style="min-width:0;">
                  <div class="wos-tile-title" data-i18n="nav.heroes">${CORE.esc(
                    CORE.t("nav.heroes") || "Heroes"
                  )}</div>
                </div>
              </a>

              <a class="wos-tile wos-tile--img" href="${CORE.routeHref("/tools/building-calculator")}" data-link>
                <div class="wos-iconbox">
                  <img src="${CORE.esc(CORE.withRes("/assets/heroes/ssr/s1/zinman/img/zinman.png"))}" alt="Calculator" loading="lazy">
                </div>
                <div style="min-width:0;">
                  <div class="wos-tile-title" data-i18n="nav.calculator">${CORE.esc(
                    CORE.t("nav.calculator") || "Calculator"
                  )}</div>
                </div>
              </a>
            </div>
          </div>

          <div class="wos-panel">
            <div class="wos-row">
              <div>
                <h2 style="margin:0 0 6px;" data-i18n="home.todays_tips">${CORE.esc(
                  CORE.t("home.todays_tips") || "Today’s Tips"
                )}</h2>
              </div>
              <a class="wos-btn" href="${CORE.routeHref("/tips")}" data-link data-i18n="home.see_all_tips">${CORE.esc(
                CORE.t("home.see_all_tips") || "See All Tips"
              )}</a>
            </div>

            ${
              todaysTips.length
                ? `<div class="wos-grid3" style="margin-top:12px;">
                    ${todaysTips
                      .map((ti, i) => {
                        const titleTxt = CORE.getLocalizedField(ti.title, lang, "Tip");
                        const catTxt = CORE.getLocalizedField(ti.category, lang, "Tip");
                        const slugEnc = encodeURIComponent(String(ti.slug || ""));
                        const dateTxt = ti.date ? String(ti.date) : "";

                        return `
                        <a class="wos-item" href="${CORE.routeHref(`/tips/${slugEnc}`)}" data-link style="flex-direction:column;">
                          <div style="display:flex; align-items:center; gap:10px; width:100%;">
                            <div class="wos-badge">${CORE.esc(String(i + 1))}</div>
                            <div class="wos-item-title" style="margin:0; flex:1; min-width:0;">
                              ${CORE.esc(CORE.clampStr(titleTxt, 60))}
                            </div>
                          </div>
                          <div class="wos-item-meta" style="margin-top:8px;">
                            ${CORE.esc(catTxt)}
                            ${dateTxt ? ` · ${CORE.esc(dateTxt)}` : ""}
                          </div>
                        </a>
                      `;
                      })
                      .join("")}
                  </div>`
                : `<div class="wos-muted" style="font-size:13px; line-height:1.65;" data-i18n="home.no_tips">
                    ${CORE.esc(CORE.t("home.no_tips") || "No tips data yet.")}
                  </div>`
            }
          </div>

          <div class="wos-panel">
            <h2 data-i18n="home.latest_uploads">${CORE.esc(CORE.t("home.latest_uploads") || "Latest Uploads")}</h2>
            ${
              latest.length
                ? `<div class="wos-list">
                    ${latest
                      .map((it) => {
                        const catTxt = CORE.getLocalizedField(it.category, lang, "Update");
                        const titleTxt = CORE.getLocalizedField(it.title, lang, "Untitled");
                        const dateTxt = it.date ? String(it.date) : "";

                        return `
                        <a class="wos-item" href="${CORE.esc(it.href)}" data-link>
                          <div class="wos-badge">${CORE.esc(catTxt)}</div>
                          <div style="flex:1; min-width:0;">
                            <div class="wos-item-title">${CORE.esc(CORE.clampStr(titleTxt, 70))}</div>
                            <div class="wos-item-meta">${CORE.esc(dateTxt)}</div>
                          </div>
                        </a>
                      `;
                      })
                      .join("")}
                  </div>`
                : `<div class="wos-muted" style="font-size:13px; line-height:1.65;" data-i18n="home.no_latest">
                    ${CORE.esc(CORE.t("home.no_latest") || "No latest uploads data.")}
                  </div>`
            }
          </div>

          ${affiliateHtml}

        </div>
      </section>
    `;

    CORE.setActiveMenu(path);
    CORE.applyI18n(view);
    CORE.rewriteDomResources(view);
    CORE.rewriteExternalLinks(view);
    CORE.setDocTitle("");
  }

  async function pageLootbar() {
    const path = CORE.getPath();
    const pageTitle = "LootBar";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    const data = await loadAffiliateBox();
    view.innerHTML = renderLootbarPage(data);

    CORE.setActiveMenu(path);
    CORE.applyI18n(view);
    CORE.rewriteDomResources(view);
    CORE.rewriteExternalLinks(view);
    CORE.setDocTitle(pageTitle);
  }

  async function pageTipStaticHtml(_slug, filename) {
    const path = CORE.getPath();
    const pageTitle = CORE.t("nav.tips") || "Tip";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    const base = "/data/tips/items/";
    const candidates = [base + filename, base + String(filename || "").replace(/^\//, "")];

    try {
      const r = await CORE.fetchTextTryWithAttempts(candidates);
      view.innerHTML = r.text || "";

      CORE.rewriteDomResources(view);
      CORE.rewriteExternalLinks(view);
      fixInjectedExternalLinks(view); // ✅ data-link 제거 + https 보정 + target 보정

      CORE.setActiveMenu(path);
      CORE.applyI18n(view);

      const inferred = CORE.inferTitleFromView(view);
      CORE.setDocTitle(inferred || pageTitle);
    } catch (err) {
      return CORE.showError(err);
    }
  }

  async function pageTips() {
    const path = CORE.getPath();
    const pageTitle = CORE.t("nav.tips") || "Tips";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    const ok = await CORE.waitForGlobal(
      "WOS_TIPS",
      () => window.WOS_TIPS && typeof window.WOS_TIPS.renderList === "function"
    );
    if (!ok) return CORE.showError(new Error("tips.js not loaded (window.WOS_TIPS.renderList missing)."));

    await window.WOS_TIPS.renderList({
      appEl: view,
      go,
      esc: CORE.esc,
      clampStr: CORE.clampStr,
      fetchJSONTryWithAttempts: CORE.fetchJSONTryWithAttempts,
      t: CORE.t,
      tOpt: CORE.tOpt,
      routeHref: CORE.routeHref,
      withBase: CORE.withBase,
      withRes: CORE.withRes,
    });

    CORE.setActiveMenu(path);
    CORE.applyI18n(view);
    CORE.rewriteDomResources(view);
    CORE.rewriteExternalLinks(view);
    CORE.setDocTitle(pageTitle);
  }

  async function pageTip(slug) {
    const path = CORE.getPath();
    const pageTitle = CORE.t("nav.tips") || "Tip";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    const ok = await CORE.waitForGlobal(
      "WOS_TIPS",
      () => window.WOS_TIPS && typeof window.WOS_TIPS.renderDetail === "function"
    );
    if (!ok) return CORE.showError(new Error("tips.js not loaded (window.WOS_TIPS.renderDetail missing)."));

    await window.WOS_TIPS.renderDetail({
      appEl: view,
      slug,
      go,
      esc: CORE.esc,
      nl2br: CORE.nl2br,
      fetchJSONTryWithAttempts: CORE.fetchJSONTryWithAttempts,
      t: CORE.t,
      tOpt: CORE.tOpt,
      routeHref: CORE.routeHref,
      withBase: CORE.withBase,
      withRes: CORE.withRes,
    });

    CORE.setActiveMenu(path);
    CORE.applyI18n(view);
    CORE.rewriteDomResources(view);
    CORE.rewriteExternalLinks(view);

    const inferred = CORE.inferTitleFromView(view);
    CORE.setDocTitle(inferred || pageTitle);
  }

  function pageTools() {
    const path = CORE.getPath();
    const pageTitle = CORE.t("nav.tools") || "Tools";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    view.innerHTML = `
      <div class="wos-panel">
        <h2 style="margin:0 0 10px;" data-i18n="tools.title">${CORE.esc(CORE.t("tools.title") || "Tools")}</h2>
        <div class="wos-muted" style="font-size:13px; margin-bottom:12px;" data-i18n="tools.subtitle">
          ${CORE.esc(CORE.t("tools.subtitle") || "Calculators & utilities")}
        </div>

        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
          <a class="wos-item" href="${CORE.routeHref("/tools/building-calculator")}" data-link style="align-items:center;">
            <div class="wos-badge" data-i18n="nav.calculator">${CORE.esc(CORE.t("nav.calculator") || "Calculator")}</div>
            <div style="flex:1;">
              <div class="wos-item-title" data-i18n="tools.building_calc">${CORE.esc(
                CORE.t("tools.building_calc") || "Building Calculator"
              )}</div>
              <div class="wos-item-meta wos-mono">/tools/building-calculator</div>
            </div>
          </a>

          <a class="wos-item" href="${CORE.routeHref("/lootbar")}" data-link style="align-items:center;">
            <div class="wos-badge">LootBar</div>
            <div style="flex:1;">
              <div class="wos-item-title">LootBar Guide</div>
              <div class="wos-item-meta wos-mono">/lootbar</div>
            </div>
          </a>
        </div>
      </div>
    `;

    CORE.setActiveMenu(path);
    CORE.applyI18n(view);
    CORE.rewriteDomResources(view);
    CORE.rewriteExternalLinks(view);
    CORE.setDocTitle(pageTitle);
  }

  async function pageBuildingCalculator() {
    const path = CORE.getPath();
    const pageTitle = CORE.t("tools.building_calc") || "Building Calculator";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    view.innerHTML = `<div class="wos-panel" id="calcRoot"></div>`;
    const root = view.querySelector("#calcRoot");
    if (!root) return;

    const okFinal = await CORE.waitForGlobal(
      "WOS_BUILDING_CALC",
      () => window.WOS_BUILDING_CALC && typeof window.WOS_BUILDING_CALC.initCalculator === "function"
    );

    if (okFinal) {
      try {
        const ret = await window.WOS_BUILDING_CALC.initCalculator({
          DATA_BASE,
          appEl: root,
          fetchJSONTry: CORE.fetchJSONTry,
          t: CORE.t,
          tOpt: CORE.tOpt,
          withBase: CORE.withBase,
          withRes: CORE.withRes,
          routeHref: CORE.routeHref,
        });
        CORE.applyI18n(root);
        CORE.rewriteDomResources(root);
        CORE.rewriteExternalLinks(root);
        CORE.setDocTitle(pageTitle);
        return ret;
      } catch (err) {
        return CORE.showError(err);
      }
    }

    const okFallback = await CORE.waitForGlobal("WOS_CALC", () => window.WOS_CALC && typeof window.WOS_CALC.render === "function");
    if (!okFallback) {
      return CORE.showError(
        new Error(
          "Calculator modules not loaded (window.WOS_BUILDING_CALC.initCalculator / window.WOS_CALC.render missing)."
        )
      );
    }

    const ctx = {
      go,
      esc: CORE.esc,
      fmtNum: CORE.fmtNum,
      t: CORE.t,
      tOpt: CORE.tOpt,
      withBase: CORE.withBase,
      withRes: CORE.withRes,
      routeHref: CORE.routeHref,
    };

    try {
      window.WOS_CALC.render({ root, key: BUILDING_CALC_KEY, ctx });
      CORE.applyI18n(root);
      CORE.rewriteDomResources(root);
      CORE.rewriteExternalLinks(root);
      CORE.setDocTitle(pageTitle);
    } catch (err) {
      return CORE.showError(err);
    }
  }

  async function pageBuildings() {
    const path = CORE.getPath();
    const pageTitle = CORE.t("nav.buildings") || "Buildings";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    const ok = await CORE.waitForGlobal(
      "WOS_BUILDINGS",
      () => window.WOS_BUILDINGS && typeof window.WOS_BUILDINGS.renderList === "function"
    );
    if (!ok) return CORE.showError(new Error("buildings.js is not loaded (window.WOS_BUILDINGS.renderList missing)."));

    const ret = await window.WOS_BUILDINGS.renderList({
      DATA_BASE,
      appEl: view,
      showError: CORE.showError,
      esc: CORE.esc,
      fetchJSONTry: CORE.fetchJSONTry,
      t: CORE.t,
      tOpt: CORE.tOpt,
      withBase: CORE.withBase,
      withRes: CORE.withRes,
      routeHref: CORE.routeHref,
    });

    CORE.setActiveMenu(path);
    CORE.applyI18n(view);
    CORE.rewriteDomResources(view);
    CORE.rewriteExternalLinks(view);
    CORE.setDocTitle(pageTitle);
    return ret;
  }

  async function pageBuilding(slug) {
    const path = CORE.getPath();
    const pageTitle = CORE.t("nav.buildings") || "Building Detail";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    const ok = await CORE.waitForGlobal(
      "WOS_BUILDINGS",
      () => window.WOS_BUILDINGS && typeof window.WOS_BUILDINGS.renderDetail === "function"
    );
    if (!ok) return CORE.showError(new Error("buildings.js is not loaded (window.WOS_BUILDINGS.renderDetail missing)."));

    const ret = await window.WOS_BUILDINGS.renderDetail({
      slug,
      DATA_BASE,
      appEl: view,
      go,
      showError: CORE.showError,
      esc: CORE.esc,
      nl2br: CORE.nl2br,
      fmtNum: CORE.fmtNum,
      fetchJSONTry: CORE.fetchJSONTry,
      fetchJSONTryWithAttempts: CORE.fetchJSONTryWithAttempts,
      normalizeIndex: CORE.normalizeIndex,
      t: CORE.t,
      tOpt: CORE.tOpt,
      withBase: CORE.withBase,
      withRes: CORE.withRes,
      routeHref: CORE.routeHref,
    });

    CORE.setActiveMenu(path);
    CORE.applyI18n(view);
    CORE.rewriteDomResources(view);
    CORE.rewriteExternalLinks(view);

    const inferred = CORE.inferTitleFromView(view);
    CORE.setDocTitle(inferred || pageTitle);

    return ret;
  }

  async function pageHeroes() {
    const path = CORE.getPath();
    const pageTitle = CORE.t("nav.heroes") || "Heroes";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    // heroes.js 우선 사용
    if (window.WOS_HEROES && typeof window.WOS_HEROES.renderList === "function") {
      try {
        const ret = await window.WOS_HEROES.renderList(view, {
          t: CORE.t,
          tOpt: CORE.tOpt,
          esc: CORE.esc,
          clampStr: CORE.clampStr,
          routeHref: CORE.routeHref,
          go,
          withBase: CORE.withBase,
          withRes: CORE.withRes,
          DATA_BASE_HEROES,
        });
        CORE.applyI18n(view);
        CORE.rewriteDomResources(view);
        CORE.rewriteExternalLinks(view);
        CORE.setDocTitle(pageTitle);
        return ret;
      } catch (err) {
        return CORE.showError(err);
      }
    }

    // fallback
    const urls = [
      `${DATA_BASE_HEROES}/r/index.json`,
      `${DATA_BASE_HEROES}/sr/index.json`,
      `${DATA_BASE_HEROES}/ssr/index.json`,
    ];

    const attempted = [];
    const combined = [];

    for (const u of urls) {
      try {
        const r = await CORE.fetchJSONTryWithAttempts([u]);
        attempted.push(...r.attempted.filter((x) => !attempted.includes(x)));
        combined.push(...CORE.normalizeIndex(r.data));
      } catch (err) {
        const at = Array.isArray(err?.attempted) ? err.attempted : [CORE.toAbsResourceUrl(u)];
        attempted.push(...at.filter((x) => !attempted.includes(x)));
      }
    }

    if (!combined.length) {
      return CORE.showError(new Error("No heroes found in r/sr/ssr index.json"), { attempted });
    }

    view.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:12px;">
        ${combined
          .map((h) => {
            const slug2 = String(h.slug ?? "");
            const rawTitle = h.title ?? h.name ?? slug2;
            const title = CORE.tOpt(`heroes.${slug2}.name`, rawTitle);

            const portrait = h.portrait ?? h.portraitSrc ?? h.image ?? "";
            const rarity = CORE.tEnum("hero.rarity", h.rarity ?? h.tier ?? "");
            const cls = CORE.tEnum("hero.class", h.class ?? h.heroClass ?? "");
            const meta = [rarity, cls].filter(Boolean).join(" · ");

            const hrefSlug = encodeURIComponent(slug2);

            return `
              <a class="wos-item"
                 href="${CORE.routeHref("/heroes/" + hrefSlug)}"
                 data-link
                 style="flex-direction:column; align-items:stretch;">
                ${
                  portrait
                    ? `<img src="${CORE.esc(CORE.toAbsResourceUrl(portrait))}" alt="${CORE.esc(title)}"
                            style="width:100%;height:auto;border-radius:12px; border:1px solid var(--w-border);"
                            loading="lazy">`
                    : ""
                }

                <div style="display:flex; gap:10px; align-items:flex-start; margin-top:10px;">
                  <div class="wos-badge" data-i18n="nav.hero">${CORE.esc(CORE.t("nav.hero") || "Hero")}</div>
                  <div style="flex:1; min-width:0;">
                    <div class="wos-item-title">${CORE.esc(CORE.clampStr(title, 60))}</div>
                    <div class="wos-item-meta">${CORE.esc(meta || "")}</div>
                    <div class="wos-item-meta wos-mono">${CORE.esc(slug2)}</div>
                  </div>
                </div>
              </a>
            `;
          })
          .join("")}
      </div>
    `;

    CORE.setActiveMenu(path);
    CORE.applyI18n(view);
    CORE.rewriteDomResources(view);
    CORE.rewriteExternalLinks(view);
    CORE.setDocTitle(pageTitle);
    return true;
  }

  async function pageHero(slug) {
    const path = CORE.getPath();
    const pageTitle = CORE.t("nav.heroes") || "Hero";
    const view = CORE.renderShell({ path, title: pageTitle, contentHTML: "" }) || CORE.getViewEl();
    if (!view) return;

    // heroes.js 우선
    if (window.WOS_HEROES && typeof window.WOS_HEROES.renderDetail === "function") {
      try {
        const ret = await window.WOS_HEROES.renderDetail(view, slug, {
          t: CORE.t,
          tOpt: CORE.tOpt,
          esc: CORE.esc,
          nl2br: CORE.nl2br,
          routeHref: CORE.routeHref,
          go,
          withBase: CORE.withBase,
          withRes: CORE.withRes,
          DATA_BASE_HEROES,
          fetchJSONTry: CORE.fetchJSONTry,
          fetchJSONTryWithAttempts: CORE.fetchJSONTryWithAttempts,
          normalizeIndex: CORE.normalizeIndex,
        });

        CORE.applyI18n(view);
        CORE.rewriteDomResources(view);
        CORE.rewriteExternalLinks(view);

        const inferred = CORE.inferTitleFromView(view);
        CORE.setDocTitle(inferred || pageTitle);
        return ret;
      } catch (err) {
        return CORE.showError(err);
      }
    }

    // fallback
    const tiers = ["ssr", "sr", "r"];
    const seasons = ["s1", "s2", "s3", "s4", "s5"];
    const candidates = [];
    const base = String(DATA_BASE_HEROES || "/data/heroes");

    for (const tier of tiers) {
      candidates.push(`${base}/${tier}/${slug}.json`);
      candidates.push(`${base}/${tier}/${slug}/index.json`);

      for (const s of seasons) {
        candidates.push(`${base}/${tier}/${s}/${slug}.json`);
        candidates.push(`${base}/${tier}/${s}/${slug}/index.json`);
        candidates.push(`${base}/${tier}/${s}/${slug}/hero.json`);
      }
    }

    try {
      const r = await CORE.fetchJSONTryWithAttempts(candidates);
      const data = r.data || {};
      const lang = CORE.getLangSafe();

      const nameRaw =
        data?.name ??
        data?.title ??
        (data?.i18n && (data.i18n[lang] ?? data.i18n.en)) ??
        slug;

      const title = CORE.tOpt(`heroes.${slug}.name`, String(nameRaw || slug));

      view.innerHTML = `
        <div class="wos-panel">
          <div class="wos-badge" data-i18n="nav.hero">${CORE.esc(CORE.t("nav.hero") || "Hero")}</div>
          <h2 style="margin:10px 0 6px; font-size:22px; letter-spacing:-.3px;">${CORE.esc(title)}</h2>
          <div class="wos-muted" style="font-size:13px;">${CORE.esc(slug)}</div>

          <div style="margin-top:12px;">
            <div class="wos-muted" style="margin-bottom:6px;">JSON</div>
            <pre class="wos-mono" style="white-space:pre-wrap; word-break:break-word; font-size:12px; line-height:1.6; margin:0; padding:10px; border:1px solid var(--w-border); border-radius:12px; background:rgba(2,6,23,.02);">${CORE.esc(
              JSON.stringify(data, null, 2)
            )}</pre>
          </div>
        </div>
      `;

      CORE.setActiveMenu(path);
      CORE.applyI18n(view);
      CORE.rewriteDomResources(view);
      CORE.rewriteExternalLinks(view);

      CORE.setDocTitle(title || pageTitle);
      return true;
    } catch (err) {
      return CORE.showError(err);
    }
  }

  // =========================
  // 7) Routing
  // =========================
  async function router() {
    let path = CORE.getPath();
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);

    // buildings
    if (path.startsWith("/buildings/") && path.split("/").length >= 3) {
      let slug = path.replace("/buildings/", "");
      try {
        slug = decodeURIComponent(slug);
      } catch (_) {}
      return pageBuilding(slug);
    }
    if (path === "/buildings") return pageBuildings();

    // heroes
    if (path.startsWith("/heroes/") && path.split("/").length >= 3) {
      let slug = path.replace("/heroes/", "");
      try {
        slug = decodeURIComponent(slug);
      } catch (_) {}
      return pageHero(slug);
    }
    if (path === "/heroes") return pageHeroes();

    // tools
    if (path === "/tools") return pageTools();
    if (path === "/tools/building-calculator") return pageBuildingCalculator();

    // tips
    if (path === "/tips") return pageTips();
    if (path.startsWith("/tips/") && path.split("/").length >= 3) {
      let slug = path.replace("/tips/", "");
      try {
        slug = decodeURIComponent(slug);
      } catch (_) {}

      if (TIP_HTML_MAP[slug]) return pageTipStaticHtml(slug, TIP_HTML_MAP[slug]);
      return pageTip(slug);
    }

    // lootbar
    if (path === "/lootbar") return pageLootbar();

    // home
    return pageHome();
  }

  // =========================
  // 8) Boot
  // =========================
  async function boot() {
    CORE.ensureStyles();
    CORE.ensureShellMounted();
    bindLinkInterceptOnce();
    bindPopStateOnce();

    // 언어 UI 가로채기(코어가 뭘 하든 capture가 우선)
    bindLangRefreshOnce();
    bindLangUiNoHardReloadOnce();

    try {
      await CORE.initI18n();
    } catch (_) {}

    // data base detect (repo prefix safe)
    try {
      DATA_BASE = await detectDataBaseBuildings();
    } catch (_) {
      DATA_BASE = "/data/buildings";
    }

    try {
      DATA_BASE_HEROES = await detectDataBaseHeroes();
    } catch (_) {
      DATA_BASE_HEROES = "/data/heroes";
    }

    CORE.setState({ DATA_BASE, DATA_BASE_HEROES });

    try {
      await router();
    } catch (err) {
      CORE.showError(err);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
      boot().catch((e) => CORE.showError(e));
    });
  } else {
    boot().catch((e) => CORE.showError(e));
  }
})();

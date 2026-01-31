/* =========================================================
   WOS.GG - buildings.js (List + Detail Module) - FULL (FINAL) ✅
   ✅ GitHub Pages 프로젝트(/wos-hub) + 커스텀도메인 모두 안전
   ✅ History Router (NO HASH) 친화:
      - href는 ctx.routeHref() 우선
      - SPA 인터셉트를 위해 data-link="1" 부여
      - 뒤로가기/목록가기 버튼은 ctx.go("/buildings") 우선
   ✅ i18n READY:
      - ctx.t 우선, 없으면 window.WOS_I18N.t fallback
      - 빌딩 메타 키 우선:
        buildings.{slug}.meta.title
        buildings.{slug}.meta.description
      - 고정 UI 텍스트는 data-i18n + fallback 텍스트 동시 제공
   ✅ FIX(중요): 빌딩 이미지 깨짐 해결
      - "/assets/..." "/data/..." 같은 루트절대경로도
        window.WOS_RES / ctx.withBase / document.baseURI 기반으로 repo prefix 자동 보정
      - index.json img / detail assets.mainImage / fallback 이미지 모두 동일 규칙 적용
   ✅ 데이터 구조 (유연 대응):
      - index:
          data/buildings/index.json
          data/buildings/base/index.json (fallback)
      - detail:
          data/buildings/{slug}.json
          data/buildings/base/{slug}.json (fallback)
      - index payload: [] or {items:[]}
   ========================================================= */
(function () {
  "use strict";

  // =========================
  // A) Cost mapping (resource keys)
  // =========================
  var RES = {
    food: "res_100011",
    wood: "res_103",
    coal: "res_104",
    iron: "res_105",
    fireCrystal: "res_100081",
    refineStone: "res_100082",
  };

  var RES_COLS_ALL = [
    { id: "food",        labelKey: "buildings.res.food",        fallback: "Food",           key: RES.food },
    { id: "wood",        labelKey: "buildings.res.wood",        fallback: "Wood",           key: RES.wood },
    { id: "coal",        labelKey: "buildings.res.coal",        fallback: "Coal",           key: RES.coal },
    { id: "iron",        labelKey: "buildings.res.iron",        fallback: "Iron",           key: RES.iron },
    { id: "fireCrystal", labelKey: "buildings.res.fireCrystal", fallback: "Fire Crystal",   key: RES.fireCrystal },
    { id: "refineStone", labelKey: "buildings.res.refineStone", fallback: "Refining Stone", key: RES.refineStone },
  ];

  function colsForSection(sectionKey) {
    if (sectionKey === "base") {
      return RES_COLS_ALL.filter(function (c) { return c.id !== "fireCrystal" && c.id !== "refineStone"; });
    }
    if (sectionKey === "firecrystal") {
      return RES_COLS_ALL.filter(function (c) { return c.id !== "refineStone"; });
    }
    return RES_COLS_ALL;
  }

  function getCost(costs, key) {
    if (!costs) return null;
    return (costs[key] !== undefined ? costs[key] : null);
  }

  // =========================
  // B) Slug aliases
  // =========================
  var SLUG_ALIASES = {
    crystallaboratory: "crystallaboratory",
    crystallalaboratory: "crystallaboratory",
  };

  function normalizedSlug(slug) {
    var s = String(slug || "").trim();
    return SLUG_ALIASES[s] || s;
  }

  // =========================
  // C) i18n
  // =========================
  function makeT(ctx) {
    var tFn =
      (ctx && typeof ctx.t === "function" ? ctx.t : null) ||
      (window.WOS_I18N && typeof window.WOS_I18N.t === "function"
        ? function (key, vars) { return window.WOS_I18N.t(key, vars); }
        : null);

    return function _t(key, fallback, vars) {
      try {
        if (!tFn) return (fallback !== undefined ? fallback : key);
        var v = tFn(key, vars);
        var s = (v === null || v === undefined) ? "" : String(v);
        if (!s.trim() || s === key) return (fallback !== undefined ? fallback : key);
        return s;
      } catch (e) {
        return (fallback !== undefined ? fallback : key);
      }
    };
  }

  function tMaybe(_t, key, vars) {
    var v = _t(key, "", vars);
    if (!v || v === key) return null;
    return v;
  }

  // =========================
  // D) Safe HTML helpers
  // =========================
  function esc(v) {
    return String(v === null || v === undefined ? "" : v).replace(/[&<>"']/g, function (m) {
      return ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[m];
    });
  }

  function attr(v) {
    return String(v === null || v === undefined ? "" : v)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function isProbablyHtml(s) {
    var t = String(s === null || s === undefined ? "" : s);
    return /<\/?[a-z][\s\S]*>/i.test(t);
  }

  function renderDescHtml(desc) {
    var d = (desc === null || desc === undefined) ? "" : desc;
    if (!d) return "";
    if (typeof d === "string" && isProbablyHtml(d)) {
      return '<div class="prose" style="line-height:1.75;text-align:center;">' + String(d) + "</div>";
    }
    var safe = esc(String(d));
    return '<div class="prose" style="white-space:pre-wrap;line-height:1.75;text-align:center;">' + safe + "</div>";
  }

  // =========================
  // E) URL / Router helpers (GitHub Pages safe)
  // =========================
  function resUrl(ctx, p) {
    if (!p) return p;
    var s = String(p);

    // absolute URL keep
    if (/^(https?:)?\/\//i.test(s)) return s;

    // normalize ../ ./ (SPA에서 base 흔들릴 때 치명적)
    s = s.replace(/^(\.\.\/)+/, "");
    s = s.replace(/^\.\//, "");

    // unify leading slash for resolver
    if (s.charAt(0) !== "/") s = "/" + s;

    // 1) best: project-aware resource resolver
    if (typeof window.WOS_RES === "function") return window.WOS_RES(s);

    // 2) app-provided base helper
    if (ctx && typeof ctx.withBase === "function") return ctx.withBase(s);

    // 3) baseURI join (repo-safe)
    try {
      return new URL(s.replace(/^\//, ""), document.baseURI).toString();
    } catch (_) {
      return s;
    }
  }

  function fetchUrl(ctx, p) {
    // fetch에도 동일 리졸버 적용
    return resUrl(ctx, p);
  }

  function routeHref(ctx, path) {
    if (ctx && typeof ctx.routeHref === "function") return ctx.routeHref(path);
    return path;
  }

  function go(ctx, path) {
    if (ctx && typeof ctx.go === "function") return ctx.go(path);
    // fallback: hard navigation (base 안전)
    location.href = routeHref(ctx, path);
  }

  // =========================
  // F) Data paths (candidates)
  // =========================
  var DATA_BASE_CANDIDATES = [
    "data/buildings",
    "assets/data/buildings",
    "assets/data/buildings/base"
  ];

  function buildIndexUrlCandidates(base) {
    return [
      String(base).replace(/\/$/, "") + "/index.json",
      String(base).replace(/\/$/, "") + "/base/index.json"
    ];
  }

  function buildDetailUrlCandidates(base, slug) {
    var s = String(slug || "").trim();
    var a = SLUG_ALIASES[s];
    var slugsToTry = a ? [s, a] : [s];

    var urls = [];
    for (var i = 0; i < slugsToTry.length; i++) {
      var x = slugsToTry[i];
      var b = String(base).replace(/\/$/, "");
      urls.push(b + "/" + encodeURIComponent(x) + ".json");
      urls.push(b + "/base/" + encodeURIComponent(x) + ".json");
    }
    return urls;
  }

  function normalizeIndexItems(idx) {
    if (!idx) return [];
    if (Array.isArray(idx)) return idx;
    if (idx && Array.isArray(idx.items)) return idx.items;
    return [];
  }

  function fetchJson(ctx, url) {
    return fetch(fetchUrl(ctx, url), { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("HTTP " + r.status + ": " + url);
      return r.json();
    });
  }

  function fetchJsonTry(ctx, urls) {
    var i = 0;
    var lastErr = null;

    function next() {
      if (i >= urls.length) return Promise.reject(lastErr || new Error("All candidates failed"));
      var u = urls[i++];
      return fetchJson(ctx, u).catch(function (e) {
        lastErr = e;
        return next();
      });
    }
    return next();
  }

  function resolveDataBase(ctx) {
    var idx = 0;

    function tryBase() {
      if (idx >= DATA_BASE_CANDIDATES.length) return Promise.resolve(DATA_BASE_CANDIDATES[0]);
      var base = DATA_BASE_CANDIDATES[idx++];
      return fetchJsonTry(ctx, buildIndexUrlCandidates(base)).then(function () {
        return base;
      }).catch(function () {
        return tryBase();
      });
    }

    return tryBase();
  }

  // =========================
  // G) Image fallback (repo-safe via resUrl at usage)
  // =========================
  function imageSlugFor(slug) {
    var s = String(slug || "").trim();
    var a = SLUG_ALIASES[s];
    return (a || s || "unknown");
  }

  function fallbackMainImageRel(slug) {
    var imgSlug = imageSlugFor(slug);
    // 상대경로 형태로만 만든다(리졸버가 repo prefix 붙임)
    return "assets/buildings/" + imgSlug + "/firecrystal_img/" + imgSlug + ".png";
  }

  // =========================
  // H) UI helpers
  // =========================
  var PAGE_WRAP_STYLE =
    "max-width:1100px;margin:0 auto;padding:0 12px;box-sizing:border-box;text-align:center;";

  function mountEl(rootEl) {
    return (typeof rootEl === "string") ? document.querySelector(rootEl) : rootEl;
  }

  function cleanTitle(raw, fallback) {
    var t = String(raw === null || raw === undefined ? "" : raw).trim();
    if (!t) return String(fallback || "").trim() || "Building";
    var cut = t.split(" - ")[0].trim();
    return cut || t;
  }

  function fmtNumDefault(n) {
    if (n === null || n === undefined || n === "") return "-";
    return String(n);
  }

  function showError(mount, title, detail) {
    mount.innerHTML =
      '<div class="wos-page" style="' + PAGE_WRAP_STYLE + '">' +
        '<div class="error" style="text-align:center;">' +
          "<h2>" + esc(title) + "</h2>" +
          (detail ? "<p class='muted'>" + esc(detail) + "</p>" : "") +
        "</div>" +
      "</div>";
  }

  // =========================
  // I) Public: renderList
  // =========================
  function renderList(rootEl, ctx) {
    var _t = makeT(ctx);
    var mount = mountEl(rootEl);
    if (!mount) return;

    mount.innerHTML =
      '<div class="wos-page" style="' + PAGE_WRAP_STYLE + '">' +
        '<div class="loading">' + esc(_t("buildings.loading_list", "Loading buildings…")) + "</div>" +
      "</div>";

    var placeholder = resUrl(ctx, "assets/img/placeholder.png");

    resolveDataBase(ctx).then(function (base) {
      return fetchJsonTry(ctx, buildIndexUrlCandidates(base)).then(function (idx) {
        var items = normalizeIndexItems(idx);

        var html = "";
        html += '<div class="wos-page" style="' + PAGE_WRAP_STYLE + '">';
        html +=   '<header class="page-head" style="text-align:center;">';
        html +=     '<h1 class="h1" style="margin:8px 0 6px;" data-i18n="buildings.list.title">' +
                      esc(_t("buildings.list.title", "Buildings")) +
                    "</h1>";
        html +=     '<p class="muted" style="margin:0 0 14px;" data-i18n="buildings.list.subtitle">' +
                      esc(_t("buildings.list.subtitle", "Select a building to view details.")) +
                    "</p>";
        html +=   "</header>";

        html +=   '<section class="grid building-grid" style="' +
                    "display:grid;" +
                    "justify-content:center;" +
                    "justify-items:center;" +
                    "grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));" +
                    "gap:14px;" +
                    "width:100%;" +
                    "margin:0 auto;" +
                  '">';

        for (var i = 0; i < items.length; i++) {
          var it = items[i] || {};
          var slug = String(it.slug || (it.meta && it.meta.slug) || "").trim();
          if (!slug) continue;

          var nSlug = normalizedSlug(slug);

          var jsonTitle = it.name || (it.meta && it.meta.title) || slug;
          var i18nTitleKey = "buildings." + nSlug + ".meta.title";
          var name = cleanTitle(_t(i18nTitleKey, jsonTitle), slug);

          // image from index (it.img / it.image / it.assets.mainImage)
          var rawImg =
            (it.img ? String(it.img) : "") ||
            (it.image ? String(it.image) : "") ||
            (it.assets && it.assets.mainImage ? String(it.assets.mainImage) : "") ||
            "";

          var imgRel = rawImg || fallbackMainImageRel(slug);
          var imgSrc = resUrl(ctx, imgRel);

          var href = routeHref(ctx, "/buildings/" + encodeURIComponent(slug));

          html += (
            '<a class="card building-card" href="' + attr(href) + '" data-link="1" ' +
               'style="text-align:center;padding:14px;width:100%;max-width:280px;">' +
              '<img class="building-card-img" ' +
                   'src="' + attr(imgSrc) + '" ' +
                   'alt="' + attr(name) + '" loading="lazy" ' +
                   'onerror="this.onerror=null;this.src=\'' + attr(placeholder) + '\';" ' +
                   'style="display:block;width:100%;height:160px;object-fit:contain;margin:0 auto 10px;border-radius:16px;">' +
              '<strong style="display:block;font-weight:900;" data-i18n="' + attr(i18nTitleKey) + '">' +
                esc(name) +
              "</strong>" +
            "</a>"
          );
        }

        html +=   "</section>";
        html += "</div>";

        mount.innerHTML = html;

        // i18n apply hook
        try {
          if (ctx && typeof ctx.applyI18n === "function") ctx.applyI18n(mount);
          else if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") window.WOS_I18N.apply(mount);
        } catch (_) {}
      });
    }).catch(function (e) {
      showError(mount, _t("buildings.load_failed", "Failed to load buildings"), e && (e.message || String(e)));
    });
  }

  // =========================
  // J) Public: renderDetail
  // =========================
  function renderDetail(rootEl, slug, ctx) {
    var _t = makeT(ctx);
    var mount = mountEl(rootEl);
    if (!mount) return;

    var sSlug = String(slug || "").trim();
    if (!sSlug) {
      showError(mount, _t("buildings.detail_failed", "Failed to load building detail"), _t("buildings.not_found", "Building not found."));
      return;
    }

    mount.innerHTML =
      '<div class="wos-page" style="' + PAGE_WRAP_STYLE + '">' +
        '<div class="loading">' + esc(_t("buildings.loading_detail", "Loading building…")) + "</div>" +
      "</div>";

    var placeholder = resUrl(ctx, "assets/img/placeholder.png");
    var fmtNum = (ctx && typeof ctx.fmtNum === "function") ? ctx.fmtNum : fmtNumDefault;

    resolveDataBase(ctx).then(function (base) {
      var attempted = buildDetailUrlCandidates(base, sSlug);

      return fetchJsonTry(ctx, attempted).then(function (data) {
        // assets merge: detail + index fallback
        var assets = (data && typeof data === "object" && data.assets && typeof data.assets === "object")
          ? data.assets
          : {};

        var needIndexAssets = !assets || !assets.mainImage;

        var idxPromise = needIndexAssets
          ? fetchJsonTry(ctx, buildIndexUrlCandidates(base)).then(function (idx) {
              var items = normalizeIndexItems(idx);

              var a = SLUG_ALIASES[sSlug];
              var slugsToTry = a ? [sSlug, a] : [sSlug];

              var found = null;
              for (var i = 0; i < items.length; i++) {
                var it = items[i] || {};
                var islug = String(it.slug || (it.meta && it.meta.slug) || "").trim();
                if (slugsToTry.indexOf(islug) >= 0) { found = it; break; }
              }

              var idxAssets = (found && found.assets && typeof found.assets === "object") ? found.assets : {};
              // also allow found.img as mainImage fallback
              if (!idxAssets.mainImage) {
                var fimg = (found && (found.img || found.image)) ? String(found.img || found.image) : "";
                if (fimg) idxAssets.mainImage = fimg;
              }

              assets = Object.assign({}, idxAssets || {}, assets || {});
              data.assets = assets;
            }).catch(function () {})
          : Promise.resolve();

        return idxPromise.then(function () {
          var nSlug = normalizedSlug(sSlug);

          var jsonTitle =
            (data && data.meta && data.meta.displayTitle) ||
            (data && data.meta && data.meta.name) ||
            (data && data.name) ||
            (data && data.meta && data.meta.title) ||
            (data && data.title) ||
            nSlug;

          var jsonDesc =
            (data && data.meta && data.meta.displayDescription) ||
            (data && data.meta && data.meta.description) ||
            (data && data.description) ||
            "";

          var i18nTitleKey = "buildings." + nSlug + ".meta.title";
          var i18nDescKey  = "buildings." + nSlug + ".meta.description";

          var title = cleanTitle(_t(i18nTitleKey, jsonTitle), nSlug);
          var rawDesc = _t(i18nDescKey, jsonDesc);

          var mainImageRel =
            (assets && assets.mainImage ? String(assets.mainImage) : "") ||
            fallbackMainImageRel(nSlug);

          var mainImageSrc = resUrl(ctx, mainImageRel);

          var phases = [
            { key: "base",            labelKey: "buildings.phase.1", fallback: "Phase 1" },
            { key: "firecrystal",     labelKey: "buildings.phase.2", fallback: "Phase 2" },
            { key: "firecrystalPlus", labelKey: "buildings.phase.3", fallback: "Phase 3" },
          ];

          for (var pi = 0; pi < phases.length; pi++) {
            var k = phases[pi].key;
            phases[pi].hasRows = !!(data && data[k] && Array.isArray(data[k].rows) && data[k].rows.length);
          }

          var available = phases.filter(function (p) { return p.hasRows; });
          var hasAnyPhase = available.length > 0;
          var defaultPhase = (available[0] && available[0].key) ? available[0].key : "base";

          // Build skeleton HTML
          var html = "";
          html += '<div class="wos-page" style="' + PAGE_WRAP_STYLE + '">';

          // topbar
          html +=   '<div class="topbar" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;">';
          html +=     '<button class="btn" type="button" data-i18n="buildings.detail.back">' +
                        esc(_t("buildings.detail.back", "← Buildings")) +
                      "</button>";
          html +=   "</div>";

          // header
          html +=   '<header class="page-head" style="text-align:center;">';
          html +=     '<div class="building-hero" style="display:flex;justify-content:center;margin:12px 0;">';
          html +=       '<img class="building-main-img" ' +
                            'src="' + attr(mainImageSrc) + '" ' +
                            'alt="' + attr(title) + '" loading="lazy" ' +
                            'onerror="this.onerror=null;this.src=\'' + attr(placeholder) + '\';" ' +
                            'style="display:block;margin:0 auto;border-radius:18px;max-height:320px;object-fit:contain;">';
          html +=     "</div>";

          html +=     '<h1 class="h1" style="margin:8px 0 10px;" data-i18n="' + attr(i18nTitleKey) + '">' + esc(title) + "</h1>";

          if (rawDesc) {
            html += '<div class="muted" style="max-width:920px;margin:0 auto;" data-i18n="' + attr(i18nDescKey) + '">';
            html +=   renderDescHtml(rawDesc);
            html += "</div>";
          }
          html +=   "</header>";

          // phases
          if (hasAnyPhase) {
            html += '<section class="panel" style="text-align:center;">';
            html +=   '<p class="common-note" style="margin:0;line-height:1.7;text-align:center;" data-i18n="buildings.notice.build_time">';
            html +=     esc(_t(
                        "buildings.notice.build_time",
                        "The construction times recorded beneath are the base times. It does not take into account any reduction benefits like State Buff, Research, Zinman's skill and etc. For most players, the time to build would be lesser than what is listed here."
                      ));
            html +=   "</p>";
            html += "</section>";

            html += '<div class="tabs" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin:14px 0 10px;">';
            for (var ti = 0; ti < available.length; ti++) {
              var p = available[ti];
              html += '<button type="button" class="tab" data-key="' + attr(p.key) + '" data-i18n="' + attr(p.labelKey) + '">' +
                        esc(_t(p.labelKey, p.fallback)) +
                      "</button>";
            }
            html += "</div>";

            html += '<section id="table-area"></section>';
          }

          html += '<section id="extra-area"></section>';
          html += "</div>";

          mount.innerHTML = html;

          // Back button hook (History Router friendly)
          var backBtn = mount.querySelector(".topbar .btn");
          if (backBtn) {
            backBtn.addEventListener("click", function () { go(ctx, "/buildings"); });
          }

          // tabs bind + initial render
          if (hasAnyPhase) {
            setActiveTab(defaultPhase);
            renderSection(defaultPhase);

            var tabs = mount.querySelectorAll(".tabs .tab");
            for (var bi = 0; bi < tabs.length; bi++) {
              (function (btn) {
                btn.addEventListener("click", function () {
                  var key = btn.getAttribute("data-key");
                  setActiveTab(key);
                  renderSection(key);
                });
              })(tabs[bi]);
            }
          } else {
            // no phase rows -> empty table area
            var area0 = mount.querySelector("#table-area");
            if (area0) area0.innerHTML = "";
          }

          // extras
          renderExtras(data);

          // i18n apply hook
          try {
            if (ctx && typeof ctx.applyI18n === "function") ctx.applyI18n(mount);
            else if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") window.WOS_I18N.apply(mount);
          } catch (_) {}

          // ---- inner helpers for detail ----
          function setActiveTab(key) {
            var btns = mount.querySelectorAll(".tabs .tab");
            for (var i = 0; i < btns.length; i++) {
              var b = btns[i];
              b.classList.toggle("active", b.getAttribute("data-key") === key);
            }
          }

          function renderSection(sectionKey) {
            var rows = (data && data[sectionKey] && Array.isArray(data[sectionKey].rows)) ? data[sectionKey].rows : [];
            var area = mount.querySelector("#table-area");
            if (!area) return;

            if (!rows.length) { area.innerHTML = ""; return; }

            var cols = colsForSection(sectionKey);

            var table = "";
            table += '<div class="panel" style="text-align:center;">';
            table +=   '<div class="table-wrap" style="overflow-x:auto;">';
            table +=     '<table class="tbl" style="min-width:860px;width:max-content;margin:0 auto;border-collapse:collapse;">';
            table +=       "<thead><tr>";
            table +=         '<th data-i18n="buildings.table.level">' + esc(_t("buildings.table.level", "Level")) + "</th>";
            table +=         '<th class="prereq" data-i18n="buildings.table.prereq">' + esc(_t("buildings.table.prereq", "Prerequisites")) + "</th>";
            for (var ci = 0; ci < cols.length; ci++) {
              var c = cols[ci];
              table += '<th class="res-head"><span data-i18n="' + attr(c.labelKey) + '">' + esc(_t(c.labelKey, c.fallback)) + "</span></th>";
            }
            table +=         '<th data-i18n="buildings.table.time">' + esc(_t("buildings.table.time", "Time")) + "</th>";
            table +=         '<th data-i18n="buildings.table.power">' + esc(_t("buildings.table.power", "Power")) + "</th>";
            table +=       "</tr></thead>";

            table += "<tbody>";
            for (var ri = 0; ri < rows.length; ri++) {
              var r = rows[ri] || {};
              var costs = r.costs || {};
              var prereq = esc(String(r.prerequisites || "")).replace(/\n/g, "<br>");

              table += "<tr>";
              table +=   '<td class="mono">' + esc(r.level) + "</td>";
              table +=   '<td class="prereq" style="text-align:left;white-space:normal;line-height:1.35;">' + prereq + "</td>";

              for (var cj = 0; cj < cols.length; cj++) {
                var col = cols[cj];
                table += '<td class="num">' + esc(fmtNum(getCost(costs, col.key))) + "</td>";
              }

              table +=   '<td class="mono">' + esc((r.time && r.time.raw) ? r.time.raw : "-") + "</td>";
              table +=   '<td class="num">' + esc((r.power !== undefined && r.power !== null) ? r.power : "-") + "</td>";
              table += "</tr>";
            }
            table += "</tbody>";

            table +=     "</table>";
            table +=   "</div>";
            table += "</div>";

            area.innerHTML = table;

            // i18n apply (table re-rendered)
            try {
              if (ctx && typeof ctx.applyI18n === "function") ctx.applyI18n(area);
              else if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") window.WOS_I18N.apply(area);
            } catch (_) {}
          }

          function renderExtras(dataObj) {
            var root = mount.querySelector("#extra-area");
            if (!root) return;

            var sections = dataObj && dataObj.extras && dataObj.extras.sections;
            if (!Array.isArray(sections) || sections.length === 0) {
              root.innerHTML = "";
              return;
            }

            var out = "";
            out += '<div class="panel" style="text-align:center;">';
            out +=   '<h2 class="h2" style="margin:0 0 12px;" data-i18n="buildings.extras.title">' +
                      esc(_t("buildings.extras.title", "Tips & Notes")) +
                    "</h2>";
            out +=   '<div class="stack" style="text-align:left;max-width:980px;margin:0 auto;">';

            for (var si = 0; si < sections.length; si++) {
              out += renderExtraSection(sections[si]);
            }

            out +=   "</div>";
            out += "</div>";

            root.innerHTML = out;

            try {
              if (ctx && typeof ctx.applyI18n === "function") ctx.applyI18n(root);
              else if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") window.WOS_I18N.apply(root);
            } catch (_) {}
          }

          function renderExtraSection(sec) {
            sec = sec || {};
            var type = String(sec.type || "").toLowerCase();

            var titleHtml = sec.title
              ? '<h3 class="h3" style="margin:14px 0 8px;">' + esc(sec.title) + "</h3>"
              : "";

            if (type === "table") {
              var cols2 = Array.isArray(sec.columns) ? sec.columns : [];
              var rows2 = Array.isArray(sec.rows) ? sec.rows : [];

              var tHtml = "";
              tHtml += '<div class="extra-section">';
              tHtml +=   titleHtml;
              tHtml +=   '<div class="table-wrap" style="overflow-x:auto;">';
              tHtml +=     '<table class="tbl" style="min-width:720px;width:max-content;margin:0 auto;border-collapse:collapse;">';
              tHtml +=       "<thead><tr>";
              for (var ci = 0; ci < cols2.length; ci++) tHtml += "<th>" + esc(cols2[ci]) + "</th>";
              tHtml +=       "</tr></thead>";
              tHtml +=       "<tbody>";
              for (var ri = 0; ri < rows2.length; ri++) {
                var row = Array.isArray(rows2[ri]) ? rows2[ri] : [];
                tHtml += "<tr>";
                for (var cci = 0; cci < row.length; cci++) {
                  tHtml += "<td>" + esc(String(row[cci] === null || row[cci] === undefined ? "" : row[cci])).replace(/\n/g, "<br>") + "</td>";
                }
                tHtml += "</tr>";
              }
              tHtml +=       "</tbody>";
              tHtml +=     "</table>";
              tHtml +=   "</div>";
              tHtml += "</div>";
              return tHtml;
            }

            if (type === "text") {
              var body = sec.text
                ? '<div class="muted" style="white-space:pre-wrap;line-height:1.75;">' + esc(sec.text) + "</div>"
                : "";

              var bullets = Array.isArray(sec.bullets) ? sec.bullets : [];
              var list = "";
              if (bullets.length) {
                list += '<ul class="ul">';
                for (var bi = 0; bi < bullets.length; bi++) {
                  list += '<li style="line-height:1.7;">' +
                            esc(String(bullets[bi] === null || bullets[bi] === undefined ? "" : bullets[bi])).replace(/\n/g, "<br>") +
                          "</li>";
                }
                list += "</ul>";
              }

              return '<div class="extra-section">' + titleHtml + body + list + "</div>";
            }

            return (
              '<div class="extra-section">' +
                titleHtml +
                '<p class="muted small" data-i18n="buildings.extras.unsupported">' +
                  esc(_t("buildings.extras.unsupported", "Unsupported extra type:")) +
                  ' <span class="mono">' + esc(sec.type || "") + "</span>" +
                "</p>" +
              "</div>"
            );
          }
        });
      });
    }).catch(function (e) {
      showError(mount, _t("buildings.detail_failed", "Failed to load building detail"), e && (e.message || String(e)));
    });
  }

  // =========================
  // Export
  // =========================
  window.WOS_BUILDINGS = {
    RES: RES,
    SLUG_ALIASES: SLUG_ALIASES,
    // helpers (optional)
    normalizedSlug: normalizedSlug,
    buildIndexUrlCandidates: buildIndexUrlCandidates,
    buildDetailUrlCandidates: buildDetailUrlCandidates,
    normalizeIndexItems: normalizeIndexItems,
    resolveDataBase: resolveDataBase,
    resUrl: resUrl,
    // main
    renderList: renderList,
    renderDetail: renderDetail,
  };
})();

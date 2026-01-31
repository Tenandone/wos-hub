/* /js/heroes.js (FULL) — GitHub Pages + 3-index structure FINAL ✅ (History Router NO HASH)
 * Data structure (fixed):
 *   data/heroes/r/index.json
 *   data/heroes/sr/index.json
 *   data/heroes/ssr/index.json
 *   data/heroes/{rarity}/{slug}.json   (detail only)
 *
 * Rules enforced:
 *  - List source: ONLY the three index.json files (no folder scan, no auto-discovery)
 *  - slug === "index" excluded always
 *  - List image: ONLY index.json.image
 *  - Detail image: prefer index.json.image, fallback to hero.json.image if needed
 *  - Fixed columns:
 *      R: 4, SR: 3, SSR Gen1: 4, SSR Gen>=2: 3 per gen section
 *    (no auto-fit/auto-fill/responsive column calc)
 *  - SSR separated by season(gen), season null/invalid goes bottom
 *  - Fetch paths are location-based (GitHub Pages safe)
 *  - History Router friendly:
 *      - uses ctx.routeHref(...) for href (NO HASH)
 *      - uses data-link attr for app.js interception
 *      - back button uses ctx.go("/heroes")
 *  - Public API:
 *      window.WOS_HEROES = { renderList(rootEl, ctx), renderDetail(rootEl, slug, ctx) }
 *
 * i18n:
 *  - ctx.t 우선, 없으면 window.WOS_I18N.t fallback
 *  - hero name keys:
 *      heroes.{slug}.name  OR  hero.{slug}.name
 */
(function () {
  "use strict";

  // =========================
  // Constants (fixed paths)
  // =========================
  var HERO_BASE = "data/heroes";
  var IDX_R = "data/heroes/r/index.json";
  var IDX_SR = "data/heroes/sr/index.json";
  var IDX_SSR = "data/heroes/ssr/index.json";

  // =========================
  // DOM helpers
  // =========================
  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    if (attrs) {
      for (var k in attrs) {
        if (!Object.prototype.hasOwnProperty.call(attrs, k)) continue;
        var v = attrs[k];
        if (v === null || v === undefined) continue;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "style") node.setAttribute("style", String(v));
        else if (k.indexOf("on") === 0 && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, String(v));
      }
    }
    if (children !== undefined && children !== null) {
      var list = Array.isArray(children) ? children : [children];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c === null || c === undefined) continue;
        if (typeof c === "string") node.appendChild(document.createTextNode(c));
        else node.appendChild(c);
      }
    }
    return node;
  }

  function safeText(v) {
    if (v === null || v === undefined) return "";
    return String(v);
  }

  function escapeHtml(str) {
    return safeText(str).replace(/[&<>"']/g, function (m) {
      return ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
      })[m];
    });
  }

  // =========================
  // i18n
  // =========================
  function makeT(ctx) {
    var tFn =
      (ctx && typeof ctx.t === "function" ? ctx.t : null) ||
      (window.WOS_I18N && typeof window.WOS_I18N.t === "function"
        ? function (key, vars) { return window.WOS_I18N.t(key, vars); }
        : null);

    return function _t(key, fallback, vars) {
      try {
        if (!tFn) return fallback || key;
        var v = tFn(key, vars);
        var s = v === null || v === undefined ? "" : String(v);
        if (!s.trim() || s === key) return fallback || key;
        return s;
      } catch (e) {
        return fallback || key;
      }
    };
  }

  function tMaybe(_t, key, vars) {
    var v = _t(key, "", vars);
    if (!v || v === key) return null;
    return v;
  }

  function tFirst(_t, keys, fallback) {
    for (var i = 0; i < keys.length; i++) {
      var v = tMaybe(_t, keys[i]);
      if (v) return v;
    }
    return fallback;
  }

  // =========================
  // GitHub Pages-safe URL resolver
  //  - Always resolve relative to document.baseURI (repo-safe)
  //  - If ctx.withBase exists, trust it
  // =========================
  function resolveUrlLocationRelative(path) {
    var p = String(path || "");
    if (!p) return p;

    if (/^(https?:)?\/\//i.test(p)) return p;

    if (p.charAt(0) === "/") {
      try {
        var base = document.baseURI; // e.g. https://host/REPO/index.html
        var u = new URL(base);
        var repoPrefix = u.pathname.replace(/[^\/]*$/, ""); // directory of baseURI
        return u.origin + repoPrefix + p.slice(1);
      } catch (e) {
        return p;
      }
    }

    try {
      return new URL(p, document.baseURI).toString();
    } catch (e2) {
      return p;
    }
  }

  function resolveImg(ctx, src) {
    if (!src) return src;
    // ✅ IMG is a RESOURCE -> prefer WOS_RES if available (repo prefix safe)
    if (typeof window.WOS_RES === "function") return window.WOS_RES(src);
    // fallback: withBase if user provided (still ok in your split build)
    if (ctx && typeof ctx.withBase === "function") return ctx.withBase(src);
    return resolveUrlLocationRelative(src);
  }

  function resolveFetchUrl(ctx, path) {
    // fetch MUST be location-based relative (repo-safe)
    if (ctx && typeof ctx.withBase === "function") {
      var r = ctx.withBase(path);
      if (r) return r;
    }
    return resolveUrlLocationRelative(path);
  }

  // =========================
  // Layout helpers (fixed columns)
  // =========================
  function centerStyle(maxWidth) {
    var mw = maxWidth || 1100;
    return "width:100%;max-width:" + mw + "px;margin:0 auto;padding:0 12px;box-sizing:border-box;";
  }

  function makeCenter(extraClass, maxWidth) {
    return el("div", { class: "wos-page" + (extraClass ? " " + String(extraClass) : ""), style: centerStyle(maxWidth) }, []);
  }

  function mountWithCenter(mount, extraClass, maxWidth) {
    mount.innerHTML = "";
    var center = makeCenter(extraClass, maxWidth);
    mount.appendChild(center);
    return center;
  }

  function fixedGrid(columns, cards) {
    var style = [
      "display:grid",
      "justify-content:center",
      "justify-items:center",
      "gap:14px",
      "width:100%",
      "max-width:1200px",
      "margin:0 auto",
      "grid-template-columns:repeat(" + String(columns) + ", minmax(0, 1fr))"
    ].join(";");
    return el("div", { class: "grid cards hero-grid", style: style }, cards);
  }

  function renderGridSection(titleText, id, columns, cards, extraClass) {
    if (!cards || !cards.length) return null;
    var section = el("section", { class: "section heroes-group " + (extraClass || ""), style: "text-align:center;" }, [
      el("header", { class: "page-header heroes-group-header", style: "text-align:center;" }, [
        el("h2", { style: "margin:18px 0 12px;text-align:center;" }, titleText)
      ]),
      fixedGrid(columns, cards)
    ]);
    if (id) section.id = id;
    return section;
  }

  // =========================
  // Data fetch
  // =========================
  function normalizeIndexPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.heroes)) return payload.heroes;
    return [];
  }

  function parseSeason(v) {
    if (v === null || v === undefined) return null;
    var m = String(v).match(/\d+/);
    if (!m) return null;
    var n = parseInt(m[0], 10);
    return isFinite(n) ? n : null;
  }

  function isValidSlug(slug) {
    var s = safeText(slug).trim();
    if (!s) return false;
    if (s.toLowerCase() === "index") return false;
    return true;
  }

  function pickIndexItem(raw, rarityDir) {
    var slug = (raw && (raw.slug || (raw.meta && raw.meta.slug))) || "";
    if (!isValidSlug(slug)) return null;

    var season = parseSeason(raw.season);
    var image = raw.image || (raw.assets && raw.assets.image) || raw.portrait || raw.icon || null;
    var path = raw.path || null;

    if (!path) path = rarityDir + "/" + encodeURIComponent(String(slug)) + ".json";

    return {
      slug: String(slug),
      rarityDir: rarityDir,
      season: season,
      image: image ? String(image) : null,
      path: String(path)
    };
  }

  function fetchJson(url, cacheMode) {
    return fetch(url, { cache: cacheMode || "no-cache" }).then(function (res) {
      if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
      return res.json();
    });
  }

  function loadIndexOne(ctx, rarityDir) {
    var rel = rarityDir === "r" ? IDX_R : rarityDir === "sr" ? IDX_SR : IDX_SSR;
    var url = resolveFetchUrl(ctx, rel);
    return fetchJson(url, "no-cache").then(function (payload) {
      var list = normalizeIndexPayload(payload);
      var out = [];
      for (var i = 0; i < list.length; i++) {
        var it = pickIndexItem(list[i], rarityDir);
        if (it) out.push(it);
      }
      return out;
    });
  }

  function loadAllIndexes(ctx) {
    return Promise.all([
      loadIndexOne(ctx, "r"),
      loadIndexOne(ctx, "sr"),
      loadIndexOne(ctx, "ssr")
    ]).then(function (arr) {
      return { r: arr[0], sr: arr[1], ssr: arr[2] };
    });
  }

  function loadHeroDetailByPath(ctx, path) {
    var rel = HERO_BASE.replace(/\/$/, "") + "/" + String(path).replace(/^\//, "");
    var url = resolveFetchUrl(ctx, rel);
    return fetchJson(url, "no-cache");
  }

  // =========================
  // Card + header helpers
  // =========================
  function resolveHeroTitleFromSlug(slug, _t) {
    var fallback = slug || "Hero";
    if (!slug) return fallback;
    return tFirst(_t, ["heroes." + slug + ".name", "hero." + slug + ".name"], fallback);
  }

  function cardForHeroIndex(item, _t, ctx) {
    var slug = item.slug;
    var title = resolveHeroTitleFromSlug(slug, _t);

    // ✅ History Router (NO HASH): routeHref + data-link
    var href = (ctx && typeof ctx.routeHref === "function")
      ? ctx.routeHref("/heroes/" + encodeURIComponent(String(slug)))
      : "/heroes/" + encodeURIComponent(String(slug));

    var clampStr = (ctx && typeof ctx.clampStr === "function")
      ? ctx.clampStr
      : function (s, max) {
          var tx = String(s === null || s === undefined ? "" : s);
          var m = max || 80;
          return tx.length > m ? tx.slice(0, m - 1) + "…" : tx;
        };

    var imgSrc = item.image ? resolveImg(ctx, item.image) : null;

    var extraCls = "hero-card hero-card-rarity-" + item.rarityDir +
      (item.rarityDir === "ssr" && item.season ? " hero-card-gen-" + item.season : " hero-card-gen-none");

    return el("a", {
      class: "card " + extraCls,
      href: href,
      "data-link": "1",
      style: "text-align:center;padding:14px;"
    }, [
      imgSrc
        ? el("img", {
            class: "card-img hero-card-img",
            src: imgSrc,
            alt: safeText(title),
            loading: "lazy",
            style: "display:block;margin:0 auto;border-radius:18px;max-height:260px;object-fit:contain;"
          })
        : null,
      el("div", { class: "card-body", style: "margin-top:10px;" }, [
        el("div", { class: "card-title", style: "font-weight:800;" }, clampStr(title, 60))
      ])
    ]);
  }

  function renderHeroHeaderFromIndex(indexItem, heroJson, _t, ctx) {
    var slug = indexItem ? indexItem.slug : (heroJson && heroJson.slug) || "";
    var title = resolveHeroTitleFromSlug(slug, _t);

    // detail image rule:
    //  - prefer index.json.image
    //  - fallback to hero.json.image if needed
    var img = (indexItem && indexItem.image) ? indexItem.image : (heroJson && heroJson.image) ? heroJson.image : null;
    var imgSrc = img ? resolveImg(ctx, img) : null;

    var shortKeyA = "heroes." + slug + ".short";
    var shortKeyB = "hero." + slug + ".short";
    var shortI18n = tFirst(_t, [shortKeyA, shortKeyB], "");
    var shortFallback = (heroJson && (heroJson.shortDescription || heroJson.description)) || "";
    var shortDesc = shortI18n || shortFallback;

    var shortNode = shortDesc
      ? el("p", {
          class: "muted small hero-shortdesc",
          style: "text-align:center;max-width:820px;margin:10px auto 0;line-height:1.6;"
        }, safeText(shortDesc))
      : null;

    return el("header", { class: "hero-header hero-header-card panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        imgSrc
          ? el("div", { class: "hero-portrait-wrap", style: "display:flex;justify-content:center;margin:6px 0 10px;" }, [
              el("img", {
                class: "hero-portrait",
                src: imgSrc,
                alt: safeText(title),
                loading: "lazy",
                style: "display:block;margin:0 auto;border-radius:18px;max-height:340px;object-fit:contain;"
              })
            ])
          : null,
        el("h1", { class: "hero-name", style: "margin:8px 0 0;text-align:center;" }, safeText(title)),
        shortNode
      ].filter(Boolean))
    ]);
  }

  // =========================
  // Story/Description (keep simple)
  // =========================
  function isProbablyHtml(s) {
    var t = safeText(s);
    return /<\/?[a-z][\s\S]*>/i.test(t);
  }

  function renderProseNode(content) {
    if (!content) return null;

    if (typeof content === "string" && isProbablyHtml(content)) {
      return el("div", { class: "prose", html: String(content), style: "line-height:1.75;text-align:center;" });
    }

    var text = safeText(content);
    return el("div", {
      class: "prose",
      html: escapeHtml(text),
      style: "white-space:pre-wrap;line-height:1.75;text-align:center;"
    });
  }

  function renderStorySection(hero, _t) {
    var slug = (hero && (hero.slug || (hero.meta && hero.meta.slug))) || "";
    var rawFromI18n = slug
      ? (tMaybe(_t, "heroes." + slug + ".story_html") ||
         tMaybe(_t, "heroes." + slug + ".story") ||
         tMaybe(_t, "hero." + slug + ".storyHtml") ||
         tMaybe(_t, "hero." + slug + ".story"))
      : null;

    var rawFromHero =
      (hero && hero.storyHtml) ||
      (hero && hero.story && hero.story.html) ||
      (hero && hero.story) ||
      null;

    var raw = rawFromI18n || rawFromHero;
    if (!raw) return null;

    var prose = renderProseNode(raw);
    if (!prose) return null;

    return el("section", { class: "section hero-story panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        el("h2", { style: "margin:0 0 12px;text-align:center;" }, _t("hero.section.story", "Story")),
        prose
      ])
    ]);
  }

  function renderDescriptionSection(hero, _t) {
    var slug = (hero && (hero.slug || (hero.meta && hero.meta.slug))) || "";
    var htmlFromI18n = slug ? tMaybe(_t, "heroes." + slug + ".description_html") : null;
    var txtFromI18n = slug ? tMaybe(_t, "heroes." + slug + ".description") : null;

    var html = htmlFromI18n || (hero && hero.descriptionHtml) || (hero && hero.descHtml) || null;
    var txt = (!html ? (txtFromI18n || (hero && (hero.description || hero.desc)) || null) : null);

    if (!html && !txt) return null;

    var prose = renderProseNode(html || txt);
    if (!prose) return null;

    return el("section", { class: "section hero-description panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        el("h2", { style: "margin:0 0 12px;text-align:center;" }, _t("hero.section.description", "Description")),
        prose
      ])
    ]);
  }

  // =========================
  // Skills ✅ (THIS fixes "only photo/name/story" issue)
  // Supports:
  //  - hero.skills: [{name/title, description/desc, descriptionHtml/descHtml, icon/image...}]
  // i18n keys (optional):
  //  - heroes.{slug}.skills.{i}.name
  //  - heroes.{slug}.skills.{i}.description
  //  - heroes.{slug}.skills.{i}.description_html
  // =========================
  function renderSkillsSection(hero, _t, ctx) {
    var skills = (hero && Array.isArray(hero.skills)) ? hero.skills : null;
    if (!skills || !skills.length) return null;

    var slug = (hero && (hero.slug || (hero.meta && hero.meta.slug))) || "";

    var cards = [];
    for (var i = 0; i < skills.length; i++) {
      var sk = skills[i] || {};
      var rawName = sk.title || sk.name || ("Skill " + String(i + 1));

      var nameFromI18n = slug ? tMaybe(_t, "heroes." + slug + ".skills." + i + ".name") : null;
      var title = nameFromI18n || rawName;

      var icon = sk.icon || sk.iconSrc || sk.image || sk.img || null;
      var iconSrc = icon ? resolveImg(ctx, icon) : null;

      var htmlFromI18n = slug ? tMaybe(_t, "heroes." + slug + ".skills." + i + ".description_html") : null;
      var txtFromI18n = slug ? tMaybe(_t, "heroes." + slug + ".skills." + i + ".description") : null;

      var html = htmlFromI18n || sk.descriptionHtml || sk.descHtml || null;
      var txt = (!html ? (txtFromI18n || sk.description || sk.desc || "") : "");

      var bodyNode = html
        ? el("div", { class: "muted", html: String(html), style: "margin-top:10px;line-height:1.7;text-align:center;font-size:13px;" })
        : (txt
            ? el("div", { class: "muted", html: escapeHtml(String(txt)), style: "margin-top:10px;white-space:pre-wrap;line-height:1.7;text-align:center;font-size:13px;" })
            : null);

      cards.push(
        el("div", { class: "panel hero-skill-card", style: "padding:12px;text-align:center;" }, [
          el("div", { style: "display:flex;gap:10px;align-items:center;justify-content:center;" }, [
            iconSrc ? el("img", { src: iconSrc, alt: safeText(title), loading: "lazy", style: "width:44px;height:44px;border-radius:12px;object-fit:cover;" }) : null,
            el("div", { style: "font-weight:900;" }, safeText(title))
          ].filter(Boolean)),
          bodyNode
        ].filter(Boolean))
      );
    }

    return el("section", { class: "section hero-skills panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        el("h2", { style: "margin:0 0 12px;text-align:center;" }, _t("hero.section.skills", "Skills")),
        el("div", {
          style: [
            "display:grid",
            "grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))",
            "gap:12px",
            "max-width:1200px",
            "margin:0 auto"
          ].join(";")
        }, cards)
      ])
    ]);
  }

  // =========================
  // SSR grouping helpers
  // =========================
  function sortSsrItemsForGrouping(items) {
    var ssr = items.slice();
    ssr.sort(function (a, b) {
      var sa = a.season;
      var sb = b.season;

      var aNull = (sa === null || sa === undefined);
      var bNull = (sb === null || sb === undefined);

      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;

      if (sb !== sa) return sb - sa;
      return 0;
    });
    return ssr;
  }

  function groupSsrBySeason(items) {
    var map = {};
    var unknown = [];
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      var s = it.season;
      if (s === null || s === undefined) unknown.push(it);
      else {
        var key = String(s);
        if (!map[key]) map[key] = [];
        map[key].push(it);
      }
    }
    return { bySeason: map, unknown: unknown };
  }

  function getSortedSeasonNumbersDesc(map) {
    var nums = [];
    for (var k in map) {
      if (!Object.prototype.hasOwnProperty.call(map, k)) continue;
      var n = parseInt(k, 10);
      if (isFinite(n)) nums.push(n);
    }
    nums.sort(function (a, b) { return b - a; });
    return nums;
  }

  // =========================
  // Public: renderList
  // =========================
  function renderList(rootEl, ctx) {
    var _t = makeT(ctx);
    var mount = (typeof rootEl === "string") ? document.querySelector(rootEl) : rootEl;
    if (!mount) return;

    mount.innerHTML = "";
    mount.appendChild(el("div", { class: "loading" }, _t("heroes.loading_list", "Loading heroes…")));

    loadAllIndexes(ctx).then(function (all) {
      var center = mountWithCenter(mount, "heroes-list-center", 1400);

      center.appendChild(el("header", { class: "page-header", style: "text-align:center;" }, [
        el("h1", { style: "text-align:center;margin:10px 0 14px;" }, _t("nav.heroes", "Heroes"))
      ]));

      var rCards = [];
      for (var i = 0; i < all.r.length; i++) rCards.push(cardForHeroIndex(all.r[i], _t, ctx));

      var srCards = [];
      for (var j = 0; j < all.sr.length; j++) srCards.push(cardForHeroIndex(all.sr[j], _t, ctx));

      var ssrSorted = sortSsrItemsForGrouping(all.ssr);
      var grouped = groupSsrBySeason(ssrSorted);
      var seasonsDesc = getSortedSeasonNumbersDesc(grouped.bySeason);

      for (var sidx = 0; sidx < seasonsDesc.length; sidx++) {
        var season = seasonsDesc[sidx];
        var list = grouped.bySeason[String(season)] || [];
        if (!list.length) continue;

        var cards = [];
        for (var k = 0; k < list.length; k++) cards.push(cardForHeroIndex(list[k], _t, ctx));

        var cols = (season === 1) ? 4 : 3;
        var title = _t("heroes.ssr_gen", "SSR · Gen {gen}", { gen: season }).replace("{gen}", String(season));
        var secId = "ssr-gen-" + String(season);

        var sec = renderGridSection(title, secId, cols, cards, "hero-grid-ssr hero-grid-ssr-gen-" + String(season));
        if (sec) center.appendChild(sec);
      }

      if (grouped.unknown && grouped.unknown.length) {
        var unkCards = [];
        for (var u = 0; u < grouped.unknown.length; u++) unkCards.push(cardForHeroIndex(grouped.unknown[u], _t, ctx));
        var unkSec = renderGridSection(_t("heroes.ssr", "SSR"), "ssr-gen-unknown", 3, unkCards, "hero-grid-ssr hero-grid-ssr-gen-unknown");
        if (unkSec) center.appendChild(unkSec);
      }

      if (srCards.length) {
        var srSec = renderGridSection(_t("heroes.sr", "SR"), "sr", 3, srCards, "hero-grid-sr");
        if (srSec) center.appendChild(srSec);
      }

      if (rCards.length) {
        var rSec = renderGridSection(_t("heroes.r", "R"), "r", 4, rCards, "hero-grid-r");
        if (rSec) center.appendChild(rSec);
      }

      if (!seasonsDesc.length && !(grouped.unknown && grouped.unknown.length) && !srCards.length && !rCards.length) {
        center.appendChild(el("p", { class: "muted", style: "text-align:center;" }, _t("heroes.empty", "No heroes found.")));
      }
    }).catch(function (e) {
      var centerErr = mountWithCenter(mount, "heroes-error-center", 1100);
      centerErr.appendChild(el("div", { class: "error", style: "text-align:center;" }, [
        el("h2", null, _t("heroes.load_failed", "Failed to load heroes index")),
        el("p", null, safeText(e && (e.message || e)))
      ]));
    });
  }

  // =========================
  // Public: renderDetail
  // =========================
  function renderDetail(rootEl, slug, ctx) {
    var _t = makeT(ctx);
    var mount = (typeof rootEl === "string") ? document.querySelector(rootEl) : rootEl;
    if (!mount) return;

    var sSlug = safeText(slug).trim();
    mount.innerHTML = "";
    mount.appendChild(el("div", { class: "loading" }, _t("heroes.loading_detail", "Loading hero…")));

    var goList = function () {
      if (ctx && typeof ctx.go === "function") ctx.go("/heroes");
      else location.href = (ctx && typeof ctx.routeHref === "function") ? ctx.routeHref("/heroes") : "/heroes";
    };

    if (!isValidSlug(sSlug)) {
      var c0 = mountWithCenter(mount, "hero-error-center", 980);
      c0.appendChild(el("div", { class: "error", style: "text-align:center;" }, [
        el("h2", null, _t("heroes.detail_failed", "Failed to load hero detail")),
        el("p", null, _t("heroes.slug", "Slug") + ": " + safeText(sSlug)),
        el("p", null, _t("heroes.not_found", "Hero not found.")),
        el("p", null, el("button", { class: "btn", type: "button", onclick: goList }, _t("heroes.go_list", "Go to Heroes list")))
      ]));
      return;
    }

    loadAllIndexes(ctx).then(function (all) {
      function findIn(list) {
        for (var i = 0; i < list.length; i++) {
          if (list[i].slug === sSlug) return list[i];
        }
        return null;
      }

      var found = findIn(all.ssr) || findIn(all.sr) || findIn(all.r);

      if (!found) {
        var c1 = mountWithCenter(mount, "hero-error-center", 980);
        c1.appendChild(el("div", { class: "error", style: "text-align:center;" }, [
          el("h2", null, _t("heroes.detail_failed", "Failed to load hero detail")),
          el("p", null, _t("heroes.slug", "Slug") + ": " + safeText(sSlug)),
          el("p", null, _t("heroes.not_found", "Hero not found in index.json.")),
          el("p", null, el("button", { class: "btn", type: "button", onclick: goList }, _t("heroes.go_list", "Go to Heroes list")))
        ]));
        return;
      }

      return loadHeroDetailByPath(ctx, found.path).then(function (heroJson) {
        var center = mountWithCenter(mount, "hero-detail-center", 2000);

        // back (History Router friendly)
        center.appendChild(el("div", { style: "text-align:center;" }, [
          el("button", {
            class: "btn back-link",
            type: "button",
            style: "display:inline-flex;margin:10px 0 14px;",
            onclick: goList
          }, _t("heroes.back", "← Back to Heroes"))
        ]));

        center.appendChild(renderHeroHeaderFromIndex(found, heroJson, _t, ctx));

        // ✅ description first (usually short)
        var desc = renderDescriptionSection(heroJson, _t);
        if (desc) center.appendChild(desc);

        // ✅ story
        var story = renderStorySection(heroJson, _t);
        if (story) center.appendChild(story);

        // ✅ skills (fix)
        var skillsSec = renderSkillsSection(heroJson, _t, ctx);
        if (skillsSec) center.appendChild(skillsSec);

        // ✅ apply i18n to inserted DOM if your engine supports apply(root)
        try {
          if (ctx && typeof ctx.applyI18n === "function") ctx.applyI18n(center);
          else if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") window.WOS_I18N.apply(center);
        } catch (_) {}
      });
    }).catch(function (e) {
      var centerErr2 = mountWithCenter(mount, "hero-error-center", 980);
      centerErr2.appendChild(el("div", { class: "error", style: "text-align:center;" }, [
        el("h2", null, _t("heroes.detail_failed", "Failed to load hero detail")),
        el("p", null, _t("heroes.slug", "Slug") + ": " + safeText(slug)),
        el("p", null, safeText(e && (e.message || e))),
        el("p", null, el("button", { class: "btn", type: "button", onclick: goList }, _t("heroes.go_list", "Go to Heroes list")))
      ]));
    });
  }

  // =========================
  // Public API
  // =========================
  window.WOS_HEROES = {
    renderList: renderList,
    renderDetail: renderDetail
  };
})();

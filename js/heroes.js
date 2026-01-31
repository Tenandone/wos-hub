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
 *  - Detail sections supported (matches your JSON):
 *      - story / description
 *      - stats.exploration (attack/defense/health)
 *      - stats.expedition (attack_percent/defense_percent etc)
 *      - sources (array)
 *      - skills[] (mode: exploration|expedition)
 *      - ✅ talent[] (ONLY render when exists & length > 0)
 *      - special.stats (exploration / expedition)
 *      - special.exclusiveWeapon (name/power/image/perks[])
 *
 * Public API:
 *   window.WOS_HEROES = { renderList(rootEl, ctx), renderDetail(rootEl, slug, ctx) }
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

  function isObj(v) {
    return v && typeof v === "object" && !Array.isArray(v);
  }

  function fmtNum(v) {
    if (v === null || v === undefined) return "";
    var n = Number(v);
    if (!isFinite(n)) return String(v);
    try { return n.toLocaleString(); } catch (_) { return String(n); }
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
  //  - Fix "../assets/..." style paths -> "assets/..."
  // =========================
  function normalizeAssetPath(p) {
    var s = safeText(p).trim();
    if (!s) return s;

    if (/^(https?:)?\/\//i.test(s)) return s;

    if (s.indexOf("../") === 0 && s.indexOf("assets/") !== -1) {
      s = s.replace(/^(\.\.\/)+/g, "");
    }

    if (s.indexOf("./assets/") === 0) {
      s = s.replace(/^\.\//, "");
    }

    return s;
  }

  function resolveUrlLocationRelative(path) {
    var p = String(path || "");
    if (!p) return p;

    if (/^(https?:)?\/\//i.test(p)) return p;

    if (p.charAt(0) === "/") {
      try {
        var base = document.baseURI;
        var u = new URL(base);
        var repoPrefix = u.pathname.replace(/[^\/]*$/, "");
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
    var fixed = normalizeAssetPath(src);

    // ✅ IMG/ASSET: prefer WOS_RES if available (repo prefix safe)
    if (typeof window.WOS_RES === "function") return window.WOS_RES(fixed);

    // fallback: withBase if provided
    if (ctx && typeof ctx.withBase === "function") return ctx.withBase(fixed);

    return resolveUrlLocationRelative(fixed);
  }

  function resolveFetchUrl(ctx, path) {
    if (ctx && typeof ctx.withBase === "function") {
      var r = ctx.withBase(path);
      if (r) return r;
    }
    return resolveUrlLocationRelative(path);
  }

  // =========================
  // Layout helpers
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

  function panelSection(title, contentNodes) {
    var kids = Array.isArray(contentNodes) ? contentNodes : [contentNodes];
    return el("section", { class: "section panel", style: "margin-top:14px;" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        title ? el("h2", { style: "margin:0 0 12px;text-align:center;" }, title) : null
      ].concat(kids).filter(Boolean))
    ]);
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
  // Text rendering
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

  // =========================
  // Header helpers
  // =========================
  function resolveHeroTitleFromSlug(slug, _t) {
    var fallback = slug || "Hero";
    if (!slug) return fallback;
    return tFirst(_t, ["heroes." + slug + ".name", "hero." + slug + ".name"], fallback);
  }

  function renderHeroHeaderFromIndex(indexItem, heroJson, _t, ctx) {
    var slug = indexItem ? indexItem.slug : (heroJson && heroJson.slug) || "";
    var title = resolveHeroTitleFromSlug(slug, _t);

    // detail image: prefer index image
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
  // List card
  // =========================
  function cardForHeroIndex(item, _t, ctx) {
    var slug = item.slug;
    var title = resolveHeroTitleFromSlug(slug, _t);

    // History Router (NO HASH)
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
        el("div", { class: "card-title", style: "font-weight:800;" }, (typeof ctx?.clampStr === "function" ? ctx.clampStr(title, 60) : title))
      ])
    ]);
  }

  // =========================
  // Detail sections (YOUR JSON)
  // =========================
  function renderQuickInfo(hero, _t) {
    if (!hero) return null;

    var rarity = safeText(hero.rarity || hero.rarityDir || "").toUpperCase();
    var season = (hero.season !== null && hero.season !== undefined) ? String(hero.season) : "";
    var cls = safeText(hero.class || hero.heroClass || "");
    var sub = safeText(hero.subClass || hero.subclass || hero.role || "");

    var rows = [];

    if (rarity) rows.push(["Rarity", rarity]);
    if (season) rows.push(["Gen", season]);
    if (cls) rows.push(["Class", cls]);
    if (sub) rows.push(["Type", sub]);

    var sources = Array.isArray(hero.sources) ? hero.sources : null;
    if (sources && sources.length) {
      rows.push(["Sources", sources.join(", ")]);
    }

    if (!rows.length) return null;

    var table = el("table", { style: "width:100%;max-width:860px;margin:0 auto;border-collapse:separate;border-spacing:0 10px;" }, [
      el("tbody", null, rows.map(function (r) {
        return el("tr", null, [
          el("td", { style: "text-align:right;vertical-align:top;padding:0 10px;color:var(--mut,#6b7280);font-weight:700;white-space:nowrap;width:140px;" }, r[0]),
          el("td", { style: "text-align:left;vertical-align:top;padding:0 10px;font-weight:700;" }, r[1])
        ]);
      }))
    ]);

    return panelSection(_t("hero.section.info", "Info"), table);
  }

  function renderStatsTable(title, obj, labelMap) {
    if (!isObj(obj)) return null;
    var keys = Object.keys(obj);
    if (!keys.length) return null;

    var rows = keys.map(function (k) {
      var label = (labelMap && labelMap[k]) ? labelMap[k] : k;
      return el("tr", null, [
        el("td", { style: "text-align:right;padding:8px 10px;color:var(--mut,#6b7280);font-weight:800;white-space:nowrap;width:180px;border-top:1px solid rgba(0,0,0,.06);" }, label),
        el("td", { style: "text-align:left;padding:8px 10px;font-weight:800;border-top:1px solid rgba(0,0,0,.06);" }, fmtNum(obj[k]))
      ]);
    });

    var table = el("table", { style: "width:100%;max-width:860px;margin:0 auto;border-collapse:collapse;" }, [
      el("tbody", null, rows)
    ]);

    return panelSection(title, table);
  }

  function renderStatsSection(hero, _t) {
    var stats = hero && hero.stats;
    if (!isObj(stats)) return null;

    var exp = isObj(stats.exploration) ? stats.exploration : null;
    var ed = isObj(stats.expedition) ? stats.expedition : null;

    if (!exp && !ed) return null;

    var labelExp = { attack: "Attack", defense: "Defense", def: "Defense", health: "Health" };

    var labelEd = {
      attack_percent: "Attack",
      defense_percent: "Defense",
      health_percent: "Health",
      lethality: "Lethality",
      damage: "Damage",
      dmg: "Damage"
    };

    var kids = [];
    if (exp) kids.push(renderStatsTable(_t("hero.stats.exploration", "Exploration Stats"), exp, labelExp));
    if (ed) kids.push(renderStatsTable(_t("hero.stats.expedition", "Expedition Stats"), ed, labelEd));

    if (!kids.length) return null;

    return el("div", null, kids);
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

    return panelSection(_t("hero.section.story", "Story"), prose);
  }

  function renderDescriptionSection(hero, _t) {
    var slug = (hero && (hero.slug || (hero.meta && hero.meta.slug))) || "";
    var htmlFromI18n = slug ? tMaybe(_t, "heroes." + slug + ".description_html") : null;
    var txtFromI18n = slug ? tMaybe(_t, "heroes." + slug + ".description") : null;

    var html = htmlFromI18n || (hero && (hero.descriptionHtml || hero.descHtml)) || null;
    var txt = (!html ? (txtFromI18n || (hero && (hero.description || hero.desc)) || null) : null);

    if (!html && !txt) return null;

    var prose = renderProseNode(html || txt);
    if (!prose) return null;

    return panelSection(_t("hero.section.description", "Description"), prose);
  }

  function renderSkillsSection(hero, _t, ctx) {
    var skills = (hero && Array.isArray(hero.skills)) ? hero.skills : null;
    if (!skills || !skills.length) return null;

    var exp = [];
    var ed = [];
    for (var i = 0; i < skills.length; i++) {
      var s = skills[i] || {};
      var mode = safeText(s.mode || "").toLowerCase();
      if (mode === "expedition") ed.push(s);
      else exp.push(s);
    }

    function skillCard(sk) {
      var name = sk.title || sk.name || "Skill";
      var desc = sk.description || sk.desc || "";
      var icon = sk.icon || sk.image || sk.img || null;

      var iconSrc = icon ? resolveImg(ctx, icon) : null;

      return el("div", { class: "panel hero-skill-card", style: "padding:12px;text-align:center;" }, [
        el("div", { style: "display:flex;gap:10px;align-items:center;justify-content:center;" }, [
          iconSrc ? el("img", { src: iconSrc, alt: safeText(name), loading: "lazy", style: "width:44px;height:44px;border-radius:12px;object-fit:cover;" }) : null,
          el("div", { style: "font-weight:900;" }, safeText(name))
        ].filter(Boolean)),
        desc ? el("div", { class: "muted", html: escapeHtml(String(desc)), style: "margin-top:10px;white-space:pre-wrap;line-height:1.7;text-align:center;font-size:13px;" }) : null
      ].filter(Boolean));
    }

    function gridOf(list) {
      return el("div", {
        style: [
          "display:grid",
          "grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))",
          "gap:12px",
          "max-width:1200px",
          "margin:0 auto"
        ].join(";")
      }, list.map(skillCard));
    }

    var kids = [];
    if (exp.length) kids.push(panelSection(_t("hero.skills.exploration", "Exploration Skills"), gridOf(exp)));
    if (ed.length) kids.push(panelSection(_t("hero.skills.expedition", "Expedition Skills"), gridOf(ed)));

    return el("div", null, kids);
  }

  // =========================
  // ✅ Talent section (HIDE if none)
  // =========================
  function renderTalentSection(hero, _t, ctx) {
    if (!hero) return null;

    // user rule: talent 없는 영웅은 숨김
    var talent = null;

    if (Array.isArray(hero.talent)) talent = hero.talent;
    else if (Array.isArray(hero.talents)) talent = hero.talents;
    else if (hero.talent && Array.isArray(hero.talent.items)) talent = hero.talent.items;

    if (!talent || !talent.length) return null;

    function talentCard(tl) {
      var name = tl.title || tl.name || "Talent";
      var desc = tl.description || tl.desc || "";
      var icon = tl.icon || tl.image || tl.img || null;

      var iconSrc = icon ? resolveImg(ctx, icon) : null;

      return el("div", { class: "panel hero-talent-card", style: "padding:12px;text-align:center;" }, [
        el("div", { style: "display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;" }, [
          iconSrc ? el("img", { src: iconSrc, alt: safeText(name), loading: "lazy", style: "width:44px;height:44px;border-radius:12px;object-fit:cover;" }) : null,
          el("div", { style: "font-weight:1000;" }, safeText(name))
        ].filter(Boolean)),
        desc ? el("div", { class: "muted", html: escapeHtml(String(desc)), style: "margin-top:10px;white-space:pre-wrap;line-height:1.7;text-align:center;font-size:13px;" }) : null
      ].filter(Boolean));
    }

    var grid = el("div", {
      style: [
        "display:grid",
        "grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))",
        "gap:12px",
        "max-width:1200px",
        "margin:0 auto"
      ].join(";")
    }, talent.map(talentCard));

    return panelSection(_t("hero.section.talent", "Talent"), grid);
  }

  function renderSpecialSection(hero, _t, ctx) {
    var sp = hero && hero.special;
    if (!isObj(sp)) return null;

    var nodes = [];

    if (isObj(sp.stats)) {
      var sExp = isObj(sp.stats.exploration) ? sp.stats.exploration : null;
      var sEd = isObj(sp.stats.expedition) ? sp.stats.expedition : null;

      if (sExp) nodes.push(renderStatsTable(_t("hero.special.exploration", "Special Exploration"), sExp, { attack: "Attack", defense: "Defense", def: "Defense", health: "Health" }));
      if (sEd) nodes.push(renderStatsTable(_t("hero.special.expedition", "Special Expedition"), sEd, null));
    }

    var ew = sp.exclusiveWeapon;
    if (isObj(ew)) {
      var ewName = safeText(ew.name) || _t("hero.exclusive_weapon", "Exclusive Weapon");
      var ewPower = (ew.power !== null && ew.power !== undefined) ? fmtNum(ew.power) : "";
      var ewImg = ew.image ? resolveImg(ctx, ew.image) : null;

      var head = el("div", { style: "display:flex;gap:14px;align-items:center;justify-content:center;flex-wrap:wrap;" }, [
        ewImg ? el("img", { src: ewImg, alt: ewName, loading: "lazy", style: "width:72px;height:72px;border-radius:16px;object-fit:cover;" }) : null,
        el("div", { style: "text-align:center;" }, [
          el("div", { style: "font-weight:1000;font-size:18px;" }, ewName),
          ewPower ? el("div", { class: "muted", style: "margin-top:4px;font-weight:800;" }, "Power: " + ewPower) : null
        ].filter(Boolean))
      ]);

      var perks = Array.isArray(ew.perks) ? ew.perks : [];
      var perkGrid = null;

      if (perks.length) {
        perkGrid = el("div", {
          style: [
            "display:grid",
            "grid-template-columns:repeat(auto-fit, minmax(240px, 1fr))",
            "gap:12px",
            "max-width:1200px",
            "margin:14px auto 0"
          ].join(";")
        }, perks.map(function (p) {
          var pName = safeText(p.name) || "Perk";
          var pLevel = (p.level !== null && p.level !== undefined) ? "Lv." + String(p.level) : "";
          var pDesc = safeText(p.description) || "";
          var pIcon = p.icon ? resolveImg(ctx, p.icon) : null;

          return el("div", { class: "panel", style: "padding:12px;text-align:center;" }, [
            el("div", { style: "display:flex;gap:10px;align-items:center;justify-content:center;" }, [
              pIcon ? el("img", { src: pIcon, alt: pName, loading: "lazy", style: "width:44px;height:44px;border-radius:12px;object-fit:cover;" }) : null,
              el("div", { style: "font-weight:1000;" }, pName + (pLevel ? " · " + pLevel : ""))
            ].filter(Boolean)),
            pDesc ? el("div", { class: "muted", html: escapeHtml(pDesc), style: "margin-top:10px;white-space:pre-wrap;line-height:1.7;font-size:13px;" }) : null
          ].filter(Boolean));
        }));
      }

      nodes.push(panelSection(_t("hero.section.exclusive_weapon", "Exclusive Weapon"), [head, perkGrid].filter(Boolean)));
    }

    if (!nodes.length) return null;
    return el("div", null, nodes);
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
      else {
        var h = (ctx && typeof ctx.routeHref === "function") ? ctx.routeHref("/heroes") : "/heroes";
        location.href = h;
      }
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

        // back
        center.appendChild(el("div", { style: "text-align:center;" }, [
          el("button", {
            class: "btn back-link",
            type: "button",
            style: "display:inline-flex;margin:10px 0 14px;",
            onclick: goList
          }, _t("heroes.back", "← Back to Heroes"))
        ]));

        // header
        center.appendChild(renderHeroHeaderFromIndex(found, heroJson, _t, ctx));

        // Info (rarity/gen/class/sources)
        var info = renderQuickInfo(heroJson, _t);
        if (info) center.appendChild(info);

        // Stats
        var stats = renderStatsSection(heroJson, _t);
        if (stats) center.appendChild(stats);

        // Description
        var desc = renderDescriptionSection(heroJson, _t);
        if (desc) center.appendChild(desc);

        // Story
        var story = renderStorySection(heroJson, _t);
        if (story) center.appendChild(story);

        // Skills
        var skillsSec = renderSkillsSection(heroJson, _t, ctx);
        if (skillsSec) center.appendChild(skillsSec);

        // ✅ Talent (ONLY if exists)
        var talentSec = renderTalentSection(heroJson, _t, ctx);
        if (talentSec) center.appendChild(talentSec);

        // Special
        var specialSec = renderSpecialSection(heroJson, _t, ctx);
        if (specialSec) center.appendChild(specialSec);

        // i18n apply
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

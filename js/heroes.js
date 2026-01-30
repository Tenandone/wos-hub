/* /assets/heroes.js (FULL) — i18n + ctx-compatible FINAL (KOJSON hero.section.* aligned)
 * ✅ app.js delegate 호환:
 *    - renderList(view, {t, esc, clampStr, DATA_BASE_HEROES?})
 *    - renderDetail(view, slug, {t, esc, nl2br, fmtNum, DATA_BASE_HEROES?})
 *    - renderHomeCards(view, topN, {t, ...})
 *
 * ✅ i18n:
 *    - ctx.t 우선, 없으면 window.WOS_I18N.t fallback
 *    - 섹션 라벨/버튼/에러 문구 t() 적용
 *    - Hero 이름 키 지원:
 *        1) heroes.{slug}.name (기존)
 *        2) hero.{slug}.name   (✅ 현재 KOJSON 구조)
 *    - ✅ 번역 미존재 시 key 그대로 반환되는 케이스 방지 (s===key면 fallback)
 *
 * ✅ FIX(요청사항):
 *    - ✅ 스토리: i18n hero.{slug}.storyHtml/story 가 있으면 "항상 우선" (영문 JSON 덮어쓰기)
 *    - ✅ 스킬: i18n hero.{slug}.skill.{id}.name/desc 가 있으면 "항상 덮어쓰기"
 *    - ✅ 전용무기: i18n hero.{slug}.weapon.name/desc(및 html) 있으면 "항상 덮어쓰기"
 *    - ✅ 전용무기 옵션(퍼크): i18n hero.{slug}.weapon.perk.{id}.name/desc 있으면 "항상 덮어쓰기"
 *    - 스탯: stats 키가 attack/defense/... 처럼 key일 경우 hero.stats.* 로 라벨 번역
 *    - 소스: sources 값이 exploration/hero_recruitment... 처럼 key일 경우 hero.source.* 번역
 *
 * ✅ 기존 CENTER-FIX 유지
 * ✅ FIX(추가요청): 네비 탭에서 R / SR 은 "같은 줄"에 배치 (섹션은 분리 유지)
 */
(function () {
  "use strict";

  const DEFAULT_TOP_N = 6;

  // =========================
  // DOM helpers
  // =========================
  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        if (v === null || v === undefined) continue;
        if (k === "class") node.className = v;
        else if (k === "html") node.innerHTML = v;
        else if (k === "style") node.setAttribute("style", String(v));
        else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
        else node.setAttribute(k, String(v));
      }
    }
    if (children !== undefined && children !== null) {
      const list = Array.isArray(children) ? children : [children];
      for (const c of list) {
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
    return safeText(str).replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  // ✅ FIX: if t() returns key itself (missing translation), fall back
  function makeT(ctx) {
    const tFn =
      (ctx && typeof ctx.t === "function" ? ctx.t : null) ||
      (window.WOS_I18N && typeof window.WOS_I18N.t === "function"
        ? window.WOS_I18N.t.bind(window.WOS_I18N)
        : null);

    return function _t(key, fallback, vars) {
      try {
        if (!tFn) return fallback || key;
        const v = tFn(key, vars);
        const s = v === null || v === undefined ? "" : String(v);
        if (!s.trim() || s === key) return fallback || key;
        return s;
      } catch (_) {
        return fallback || key;
      }
    };
  }

  // ✅ i18n에서 "실제 값이 있을 때만" 꺼내는 helper
  function tMaybe(_t, key, vars) {
    const v = _t(key, "", vars);
    if (!v || v === key) return null;
    return v;
  }

  // ✅ 여러 후보키 중 먼저 매칭되는 번역 반환
  function tFirst(_t, keys, fallback) {
    for (const k of keys) {
      const v = tMaybe(_t, k);
      if (v) return v;
    }
    return fallback;
  }

  function joinUrl(base, path) {
    if (!base) return path;
    let b = String(base);
    let p = String(path || "");
    if (b.endsWith("/")) b = b.slice(0, -1);
    if (p.startsWith("/")) p = p.slice(1);
    return b + "/" + p;
  }

  function normalizeIndexPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    return [];
  }

  function pickText(v) {
    if (v === null || v === undefined) return null;
    if (typeof v === "string") return v;
    if (typeof v === "object") {
      if (typeof v.text === "string") return v.text;
      if (typeof v.name === "string") return v.name;
      if (typeof v.title === "string") return v.title;
      if (typeof v.label === "string") return v.label;
    }
    return null;
  }

  function getRarity(hero) {
    return pickText(hero?.meta?.rarity) || pickText(hero?.summary?.rarity) || pickText(hero?.rarity) || null;
  }

  function normalizeRarityName(v) {
    const s = safeText(v).trim().toLowerCase();
    if (!s) return null;
    if (s === "rare" || s === "r") return "r";
    if (s === "epic" || s === "sr") return "sr";
    if (s === "legend" || s === "legendary" || s === "ssr") return "ssr";
    return null;
  }

  function rarityDirFromHeroIndexItem(it) {
    const r = pickText(it?.rarity) || pickText(it?.meta?.rarity) || pickText(it?.summary?.rarity) || null;
    return normalizeRarityName(r);
  }

  function rarityDirFromHeroDetail(hero) {
    return normalizeRarityName(getRarity(hero));
  }

  function buildIndexUrl(base, rarityDir) {
    return joinUrl(joinUrl(base, rarityDir), "index.json");
  }

  function buildDetailUrls(base, rarityDir, slug) {
    const dir = joinUrl(base, rarityDir);
    return [joinUrl(dir, slug + ".json"), joinUrl(dir, encodeURIComponent(slug) + ".json")];
  }

  // =========================
  // base candidates (ctx aware)
  // =========================
  function candidatesForHeroesBase(ctx) {
    const out = [];
    const cfg = window.WOS_CONFIG || {};

    if (ctx?.DATA_BASE_HEROES) out.push(ctx.DATA_BASE_HEROES);
    if (ctx?.DATA_BASE) out.push(joinUrl(ctx.DATA_BASE, "heroes"));

    if (window.DATA_BASE_HEROES) out.push(window.DATA_BASE_HEROES);
    if (window.DATA_BASE) out.push(joinUrl(window.DATA_BASE, "heroes"));

    if (cfg.dataBaseHeroes) out.push(cfg.dataBaseHeroes);
    if (cfg.dataBase) out.push(joinUrl(cfg.dataBase, "heroes"));

    out.push("/data/heroes", "data/heroes", "./data/heroes", "../data/heroes", "../../data/heroes");
    out.push("/page/data/heroes", "page/data/heroes", "./page/data/heroes");

    try {
      out.push(new URL("data/heroes", document.baseURI).pathname.replace(/\/+$/, ""));
    } catch (_) {}

    const seen = new Set();
    return out.filter((x) => {
      if (!x) return false;
      const key = String(x);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  async function fetchJsonWithAttempts(urls, fetchOpts) {
    const attempted = [];
    let lastErr = null;

    for (const u of urls) {
      attempted.push(u);
      try {
        const res = await fetch(u, fetchOpts || {});
        if (!res.ok) throw new Error("HTTP " + res.status + " " + res.statusText);
        const data = await res.json();
        return { data, usedUrl: u, attempted };
      } catch (e) {
        lastErr = e;
      }
    }

    const err = new Error("Fetch failed for all candidates");
    err.attempted = attempted;
    err.cause = lastErr;
    throw err;
  }

  async function resolveHeroesBase(ctx) {
    const bases = candidatesForHeroesBase(ctx);
    const rarDirs = ["r", "sr", "ssr"];
    const urls = [];
    for (const b of bases) for (const rd of rarDirs) urls.push(buildIndexUrl(b, rd));

    const { usedUrl, attempted } = await fetchJsonWithAttempts(urls, { cache: "no-cache" });
    const base = usedUrl.replace(/\/(r|sr|ssr)\/index\.json(?:\?.*)?$/, "");
    return { base, attempted };
  }

  async function loadHeroesIndexAll(ctx) {
    const { base, attempted: attemptedBases } = await resolveHeroesBase(ctx);
    const urls = [buildIndexUrl(base, "r"), buildIndexUrl(base, "sr"), buildIndexUrl(base, "ssr")];

    const all = [];
    const attempted = attemptedBases.slice();

    for (const u of urls) {
      try {
        const r = await fetchJsonWithAttempts([u], { cache: "no-cache" });
        attempted.push(...r.attempted.filter((x) => !attempted.includes(x)));
        const items = normalizeIndexPayload(r.data);
        if (Array.isArray(items) && items.length) all.push(...items);
      } catch (e) {
        const at = Array.isArray(e?.attempted) ? e.attempted : [u];
        for (const x of at) if (!attempted.includes(x)) attempted.push(x);
      }
    }

    return { base, items: all, attempted };
  }

  async function loadHeroDetail(slug, ctx) {
    const { base, attempted: attemptedBases } = await resolveHeroesBase(ctx);
    const { items, attempted: attemptedIdx } = await loadHeroesIndexAll(ctx);
    const idxItem = items.find((it) => safeText(it?.slug) === safeText(slug)) || null;

    const rarityDir = idxItem ? rarityDirFromHeroIndexItem(idxItem) : null;
    if (!rarityDir) {
      const err = new Error("Hero not found in any rarity index.json");
      err.attempted = attemptedBases.concat(attemptedIdx);
      throw err;
    }

    const urls = buildDetailUrls(base, rarityDir, slug);
    const { data, usedUrl, attempted } = await fetchJsonWithAttempts(urls, { cache: "no-cache" });

    void rarityDirFromHeroDetail(data);

    return {
      base,
      hero: data,
      usedUrl,
      attempted: attemptedBases
        .concat(attemptedIdx.filter((u) => !attemptedBases.includes(u)))
        .concat(attempted.filter((u) => !attemptedBases.includes(u) && !attemptedIdx.includes(u))),
    };
  }

  function buildAttemptedList(attempted, _t) {
    if (!attempted || !attempted.length) return null;
    return el("details", { class: "attempted" }, [
      el("summary", null, _t("error.tried_urls", "Attempted URLs")),
      el("ol", { class: "attempted-list" }, attempted.map((u) => el("li", null, u))),
    ]);
  }

  // =========================
  // Center wrapper (inline force)
  // =========================
  function centerStyle(maxWidth) {
    const mw = maxWidth || 1100;
    return `width:100%;max-width:${mw}px;margin:0 auto;padding:0 12px;box-sizing:border-box;`;
  }

  function makeCenter(extraClass, maxWidth) {
    return el("div", { class: "wos-page" + (extraClass ? " " + String(extraClass) : ""), style: centerStyle(maxWidth) }, []);
  }

  function mountWithCenter(mount, extraClass, maxWidth) {
    mount.innerHTML = "";
    const center = makeCenter(extraClass, maxWidth);
    mount.appendChild(center);
    return center;
  }

  // =========================
  // Center Grid (1개/마지막줄도 가운데)
  // =========================
  function centerGrid(children, opts) {
    const o = opts && typeof opts === "object" ? opts : {};
    const min = Number.isFinite(o.min) ? o.min : 240;
    const max = Number.isFinite(o.max) ? o.max : 320;
    const gap = Number.isFinite(o.gap) ? o.gap : 16;

    const style = [
      "display:grid",
      "justify-content:center",
      "justify-items:center",
      `grid-template-columns:repeat(auto-fit, minmax(${min}px, ${max}px))`,
      `gap:${gap}px`,
      "width:100%",
      "margin:0 auto",
    ].join(";");

    return el("div", { style }, children);
  }

  // =========================
  // Hero slug helpers
  // =========================
  function getHeroSlug(hero) {
    return hero?.meta?.slug || hero?.slug || hero?.key || hero?.id || null;
  }

  // =========================
  // Skills / Stats helpers
  // =========================
  function splitSkillsByMode(hero) {
    const skills = Array.isArray(hero?.skills) ? hero.skills : [];
    const groups = { exploration: [], expedition: [], special: [], other: [] };
    for (const sk of skills) {
      const mode = sk?.mode;
      if (mode === "exploration") groups.exploration.push(sk);
      else if (mode === "expedition") groups.expedition.push(sk);
      else if (mode === "special") groups.special.push(sk);
      else groups.other.push(sk);
    }
    return groups;
  }

  function extractSkillId(sk) {
    const raw =
      sk?.id ??
      sk?.skillId ??
      sk?.skill_id ??
      sk?.skillID ??
      sk?.key ??
      sk?.code ??
      sk?.skillKey ??
      null;

    if (raw === null || raw === undefined) return null;
    if (typeof raw === "number") return String(raw);

    const s = String(raw).trim();
    if (!s) return null;

    const m = s.match(/\d+/);
    if (m) return m[0];

    return s;
  }

  function isProbablyHtml(s) {
    const t = safeText(s);
    return /<\/?[a-z][\s\S]*>/i.test(t);
  }

  // ✅ i18n 있으면 "무조건 덮어쓰기" (한국어 강제)
  function applySkillI18nOverride(sk, heroSlug, _t) {
    if (!sk || !heroSlug) return sk;

    const sid = extractSkillId(sk);
    if (!sid) return sk;

    const nm =
      tMaybe(_t, `hero.${heroSlug}.skill.${sid}.name`) ||
      tMaybe(_t, `hero.${heroSlug}.skill.${sid}.title`);

    if (nm) sk.name = nm;

    const ds =
      tMaybe(_t, `hero.${heroSlug}.skill.${sid}.desc`) ||
      tMaybe(_t, `hero.${heroSlug}.skill.${sid}.description`);

    if (ds) {
      if (isProbablyHtml(ds)) {
        sk.descriptionHtml = ds;
        sk.description = null;
        sk.desc = null;
      } else {
        sk.description = ds;
        sk.desc = null;
        sk.descriptionHtml = null;
      }
    }

    return sk;
  }

  // ✅ 전용무기 옵션(퍼크) i18n override (hero.{slug}.weapon.perk.{id}.name/desc)
  function applyWeaponPerkI18nOverride(perk, heroSlug, _t) {
    if (!perk || !heroSlug) return perk;

    const pid = extractSkillId(perk); // perk.id / key / code 등 재사용
    if (!pid) return perk;

    const nm =
      tMaybe(_t, `hero.${heroSlug}.weapon.perk.${pid}.name`) ||
      tMaybe(_t, `hero.${heroSlug}.weapon.perk.${pid}.title`);

    if (nm) perk.name = nm;

    const ds =
      tMaybe(_t, `hero.${heroSlug}.weapon.perk.${pid}.desc`) ||
      tMaybe(_t, `hero.${heroSlug}.weapon.perk.${pid}.description`);

    if (ds) {
      if (isProbablyHtml(ds)) {
        perk.descriptionHtml = ds;
        perk.description = null;
        perk.desc = null;
      } else {
        perk.description = ds;
        perk.desc = null;
        perk.descriptionHtml = null;
      }
    }

    return perk;
  }

  function renderSkillCardVertical(sk, heroSlug, _t) {
    if (_t && heroSlug) applySkillI18nOverride(sk, heroSlug, _t);

    const title = sk?.name || sk?.title || sk?.key || "Skill";
    const icon = sk?.icon || sk?.iconSrc || sk?.image || null;

    const descHtml = sk?.descriptionHtml || sk?.descHtml || sk?.html || null;
    const descText = sk?.description || sk?.desc || null;

    const modes = Array.isArray(sk?.modes) ? sk.modes : [];

    const blocks = [];

    if (icon) {
      blocks.push(
        el("img", {
          class: "skill-icon skill-icon-top",
          src: icon,
          alt: safeText(title),
          loading: "lazy",
          style: "display:block;margin:0 auto 10px auto;max-width:72px;max-height:72px;object-fit:contain;",
        })
      );
    }

    blocks.push(el("div", { class: "skill-title", style: "text-align:center;font-weight:800;" }, safeText(title)));

    if (descHtml) blocks.push(el("div", { class: "skill-desc", html: String(descHtml), style: "text-align:center;line-height:1.55;" }));
    else if (descText) blocks.push(el("p", { class: "skill-desc", style: "text-align:center;line-height:1.55;margin:8px 0 0;" }, safeText(descText)));

    if (modes.length) {
      const modeCards = modes.map((m) => {
        const mt = safeText(m?.title || m?.name || "Mode");
        const mi = m?.icon || m?.iconSrc || m?.image || null;
        const mHtml = m?.descriptionHtml || m?.descHtml || m?.html || null;
        const mTxt = m?.description || m?.desc || null;

        const inner = [];
        if (mi) {
          inner.push(
            el("img", {
              class: "skill-icon skill-icon-top",
              src: mi,
              alt: mt,
              loading: "lazy",
              style: "display:block;margin:0 auto 10px auto;max-width:72px;max-height:72px;object-fit:contain;",
            })
          );
        }
        inner.push(el("div", { class: "skill-title", style: "text-align:center;font-weight:800;" }, mt));
        if (mHtml) inner.push(el("div", { class: "skill-desc", html: String(mHtml), style: "text-align:center;line-height:1.55;" }));
        else if (mTxt) inner.push(el("p", { class: "skill-desc", style: "text-align:center;line-height:1.55;margin:8px 0 0;" }, safeText(mTxt)));

        return el("div", { class: "card skill-card skill-card-vertical skill-mode", style: "padding:16px;" }, inner);
      });

      blocks.push(el("div", { class: "skill-modes", style: "margin-top:12px;" }, centerGrid(modeCards, { min: 220, max: 320, gap: 14 })));
    }

    return el("div", { class: "card skill-card skill-card-vertical", style: "padding:18px;" }, blocks);
  }

  function renderSkillsGridOnly(list, heroSlug, _t) {
    if (!list || !list.length) return null;
    const cards = list.map((sk) => renderSkillCardVertical(sk, heroSlug, _t));
    return centerGrid(cards, { min: 240, max: 340, gap: 18 });
  }

  // ✅ 전역 table(min-width) 영향 차단 + stats 라벨 번역
  function renderStatsTableOnly(hero, modeKey, _t) {
    const stats = hero?.stats;
    if (!stats) return null;

    function tStatLabel(k) {
      const key = safeText(k).trim();
      const v = tMaybe(_t, `hero.stats.${key}`);
      return v || key;
    }

    function renderKeyValueTable(obj) {
      const rows = Object.entries(obj).map(([k, v]) =>
        el("tr", null, [
          el("th", { style: "text-align:left;padding:10px 12px;white-space:nowrap;" }, tStatLabel(k)),
          el("td", { style: "text-align:right;padding:10px 12px;white-space:nowrap;" }, safeText(v)),
        ])
      );

      return el("table", {
        class: "stats-table",
        style: "width:auto;min-width:0;max-width:100%;margin:0 auto;border-collapse:collapse;",
      }, [el("tbody", null, rows)]);
    }

    function renderItemsTable(items) {
      const rows = items.map((it) => {
        const labelRaw = it?.label ?? "";
        const value = it?.value ?? "";
        const icon = it?.icon || null;

        const label =
          (typeof labelRaw === "string" && labelRaw.startsWith("hero.stats."))
            ? _t(labelRaw, labelRaw)
            : (typeof labelRaw === "string" ? tStatLabel(labelRaw) : safeText(labelRaw));

        const thKids = [];
        if (icon) {
          thKids.push(
            el("img", {
              src: icon,
              alt: safeText(label),
              loading: "lazy",
              style: "display:inline-block;width:18px;height:18px;vertical-align:-3px;margin-right:8px;",
            })
          );
        }
        thKids.push(safeText(label));

        return el("tr", null, [
          el("th", { style: "text-align:left;padding:10px 12px;white-space:nowrap;" }, thKids),
          el("td", { style: "text-align:right;padding:10px 12px;white-space:nowrap;" }, safeText(value)),
        ]);
      });

      return el("table", {
        class: "stats-table",
        style: "width:auto;min-width:0;max-width:100%;margin:0 auto;border-collapse:collapse;",
      }, [el("tbody", null, rows)]);
    }

    const obj = stats?.[modeKey];
    if (obj && typeof obj === "object" && !Array.isArray(obj) && Object.keys(obj).length) return renderKeyValueTable(obj);
    if (Array.isArray(obj) && obj.length) return renderItemsTable(obj);

    return null;
  }

  // =========================
  // Story/Description
  // =========================
  function renderProseNode(content) {
    if (!content) return null;

    if (typeof content === "string" && isProbablyHtml(content)) {
      return el("div", { class: "prose", html: String(content), style: "line-height:1.75;text-align:center;" });
    }

    const text = safeText(content);
    return el("div", {
      class: "prose",
      html: escapeHtml(text),
      style: "white-space:pre-wrap;line-height:1.75;text-align:center;",
    });
  }

  // ✅ hero.section.story + ✅ i18n이 있으면 "항상 우선" (영문 JSON 덮어쓰기)
  function renderStorySection(hero, _t) {
    const slug = getHeroSlug(hero);

    const rawFromI18n = slug
      ? (tMaybe(_t, `hero.${slug}.storyHtml`) || tMaybe(_t, `hero.${slug}.story`))
      : null;

    const rawFromHero =
      hero?.storyHtml ??
      hero?.story?.html ??
      hero?.storyHtmlString ??
      hero?.story?.htmlString ??
      hero?.story;

    const raw = rawFromI18n || rawFromHero;
    if (!raw) return null;

    const prose = renderProseNode(raw);
    if (!prose) return null;

    return el("section", { class: "section hero-story panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        el("h2", { style: "margin:0 0 12px;text-align:center;" }, _t("hero.section.story", "Story")),
        prose,
      ]),
    ]);
  }

  function renderDescriptionSection(hero, _t) {
    const html = hero?.descriptionHtml;
    const txt = hero?.description;
    if (!html && !txt) return null;

    const prose = renderProseNode(html || txt);
    if (!prose) return null;

    return el("section", { class: "section hero-description panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        el("h2", { style: "margin:0 0 12px;text-align:center;" }, _t("hero.section.description", "Description")),
        prose,
      ]),
    ]);
  }

  // ✅ sources 값 번역(hero.source.*) 지원
  function renderSourcesInline(hero, _t) {
    const sources = hero?.sources;
    if (!sources) return null;

    const items = Array.isArray(sources) ? sources : [sources];
    if (!items.length) return null;

    return el("ul", { class: "list sources-list hero-sources-inline", style: "list-style:none;padding:0;margin:0;text-align:center;" },
      items.map((s) => {
        if (typeof s === "string") {
          const key = s.trim();
          const translated = tMaybe(_t, `hero.source.${key}`) || key;
          return el("li", { style: "margin:6px 0;" }, translated);
        }
        if (s && typeof s === "object") {
          const labelRaw = s.title || s.name || s.label || "";
          const label =
            (typeof labelRaw === "string" && labelRaw.trim())
              ? (tMaybe(_t, `hero.source.${labelRaw}`) || labelRaw)
              : "";

          const url = s.url || s.href || "";
          if (url) {
            return el("li", { style: "margin:6px 0;" }, [
              label ? label + ": " : "",
              el("a", { href: url, target: "_blank", rel: "noopener noreferrer" }, url),
            ]);
          }
          return el("li", { style: "margin:6px 0;" }, label ? safeText(label) : safeText(JSON.stringify(s)));
        }
        return el("li", { style: "margin:6px 0;" }, safeText(s));
      })
    );
  }

  // =========================
  // Hero header (name i18n)
  // =========================
  function resolveHeroTitle(hero, _t) {
    const slug = getHeroSlug(hero);
    const fallback = hero?.meta?.title || hero?.title || hero?.name || slug || "Hero";
    if (!slug) return fallback;
    return tFirst(_t, [`heroes.${slug}.name`, `hero.${slug}.name`], fallback);
  }

  function resolveHeroShort(hero, _t) {
    const slug = getHeroSlug(hero);
    const fallback = hero?.shortDescription ?? hero?.description ?? null;
    if (!slug) return fallback;
    return tFirst(_t, [`heroes.${slug}.short`, `hero.${slug}.short`], fallback);
  }

  function renderHeroHeader(hero, _t) {
    const title = resolveHeroTitle(hero, _t);
    const portrait = hero?.meta?.portrait || hero?.assets?.portrait || hero?.portrait || hero?.portraitSrc || hero?.image || null;

    const rarityIcon = hero?.rarityIcon || hero?.meta?.rarityIcon || hero?.assets?.rarityIcon || null;
    const classIcon = hero?.classIcon || hero?.meta?.classIcon || hero?.assets?.classIcon || null;
    const subClassIcon = hero?.subClassIcon || hero?.meta?.subClassIcon || hero?.assets?.subClassIcon || null;

    const shortDesc = resolveHeroShort(hero, _t);
    const shortDescNode = shortDesc
      ? el("p", { class: "muted small hero-shortdesc", style: "text-align:center;max-width:820px;margin:10px auto 0;line-height:1.6;" }, safeText(shortDesc))
      : null;

    const portraitWrap = el("div", { class: "hero-portrait-wrap", style: "display:flex;justify-content:center;position:relative;margin:6px 0 10px;" }, [
      portrait
        ? el("img", { class: "hero-portrait", src: portrait, alt: safeText(title), loading: "lazy", style: "display:block;margin:0 auto;border-radius:18px;max-height:340px;object-fit:contain;" })
        : null,
      rarityIcon
        ? el("img", { class: "hero-icon hero-icon-rarity", src: rarityIcon, alt: "rarity", loading: "lazy", style: "position:absolute;left:12px;top:12px;width:28px;height:28px;" })
        : null,
      classIcon || subClassIcon
        ? el("div", { class: "hero-icon-classes", style: "position:absolute;right:12px;top:12px;display:flex;gap:8px;" }, [
            classIcon ? el("img", { class: "hero-icon hero-icon-class", src: classIcon, alt: "class", loading: "lazy", style: "width:28px;height:28px;" }) : null,
            subClassIcon ? el("img", { class: "hero-icon hero-icon-subclass", src: subClassIcon, alt: "subclass", loading: "lazy", style: "width:28px;height:28px;" }) : null,
          ].filter(Boolean))
        : null,
    ].filter(Boolean));

    return el("header", { class: "hero-header hero-header-card panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        portraitWrap,
        el("h1", { class: "hero-name", style: "margin:8px 0 0;text-align:center;" }, safeText(title)),
        shortDescNode,
      ].filter(Boolean)),
    ]);
  }

  // =========================
  // Generation helper
  // =========================
  function getIndexGeneration(item) {
    const rawDirect =
      item?.gen ?? item?.generation ??
      item?.meta?.gen ?? item?.meta?.generation ??
      item?.summary?.gen ?? item?.summary?.generation ??
      null;

    const raw = (rawDirect !== null && rawDirect !== undefined)
      ? rawDirect
      : item?.season ?? item?.meta?.season ?? item?.summary?.season ?? null;

    if (raw === null || raw === undefined) return null;
    const s = String(raw).trim();
    const m = s.match(/\d+/);
    if (!m) return null;
    const n = Number.parseInt(m[0], 10);
    return Number.isFinite(n) ? n : null;
  }

  // =========================
  // List card (name i18n)
  // =========================
  function cardForHero(item, meta, _t, ctx) {
    const slug = item?.meta?.slug || item?.slug || item?.key || item?.id || "";
    const fallbackTitle = item?.meta?.title || item?.title || item?.name || slug || "Hero";

    const title = slug
      ? tFirst(_t, [`heroes.${slug}.name`, `hero.${slug}.name`], fallbackTitle)
      : fallbackTitle;

    const portrait = item?.meta?.portrait || item?.assets?.portrait || item?.portrait || item?.portraitSrc || item?.image || null;

    const rarityDir = meta?.rarityDir || rarityDirFromHeroIndexItem(item) || "unknown";
    const gen = meta?.gen ?? null;

    const extraCls = [
      "hero-card-rarity-" + String(rarityDir),
      rarityDir === "ssr" && gen ? "hero-card-gen-" + String(gen) : "hero-card-gen-none",
    ].join(" ");

    const href = slug ? "#/heroes/" + encodeURIComponent(String(slug)) : "#/heroes";

    const clampStr = typeof ctx?.clampStr === "function" ? ctx.clampStr : (s, max = 80) => {
      const tx = String(s ?? "");
      return tx.length > max ? tx.slice(0, max - 1) + "…" : tx;
    };

    return el("a", { class: "card hero-card " + extraCls, href, style: "text-align:center;padding:14px;" }, [
      portrait
        ? el("img", {
            class: "card-img hero-card-img",
            src: portrait,
            alt: safeText(title),
            loading: "lazy",
            style: "display:block;margin:0 auto;border-radius:18px;max-height:260px;object-fit:contain;",
          })
        : null,
      el("div", { class: "card-body", style: "margin-top:10px;" }, [
        el("div", { class: "card-title", style: "font-weight:800;" }, clampStr(title, 60)),
      ]),
    ]);
  }

  function renderGridSection(titleText, gridClass, columns, cards) {
    if (!cards || !cards.length) return null;

    const gridStyle = [
      "display:grid",
      "justify-content:center",
      "justify-items:center",
      "gap:14px",
      "width:100%",
      `grid-template-columns:repeat(${String(columns)}, minmax(0, 1fr))`,
      "max-width:1200px",
      "margin:0 auto",
    ].join(";");

    return el("section", { class: "section heroes-group " + gridClass, style: "text-align:center;" }, [
      el("header", { class: "page-header heroes-group-header", style: "text-align:center;" }, [
        el("h2", { style: "margin:18px 0 12px;text-align:center;" }, titleText),
      ]),
      el("div", { class: "grid cards hero-grid " + gridClass, style: gridStyle }, cards),
    ]);
  }

  function sortNumberDesc(arr) {
    return arr.slice().sort((a, b) => b - a);
  }

  // =========================
  // Heroes nav (✅ rows 지원: SR/R 같은 줄)
  // =========================
  function buildHeroesNavTabs(cfg) {
    // ✅ cfg.rows: [[{id,label},{id,label}], [{id,label}], ...]
    const rows = Array.isArray(cfg?.rows) ? cfg.rows : null;
    const items = Array.isArray(cfg?.items) ? cfg.items : [];

    const list = rows ? rows.flat().filter(Boolean) : items.filter(Boolean);
    if (!list.length) return null;

    function onJump(e, id) {
      if (e) e.preventDefault();
      const target = document.getElementById(id);
      if (!target) return;
      try { target.scrollIntoView({ behavior: "smooth", block: "start" }); }
      catch (_) { target.scrollIntoView(true); }
    }

    function link(it) {
      return el(
        "a",
        {
          class: "tab heroes-nav-tab",
          href: "#" + String(it.id),
          onclick: (e) => onJump(e, String(it.id)),
          style: "text-align:center;"
        },
        safeText(it.label)
      );
    }

    // ✅ rows가 있으면 "여러 줄" nav (SR/R 같은 줄 가능)
    if (rows) {
      const rowNodes = rows
        .filter((r) => Array.isArray(r) && r.length)
        .map((r) =>
          el(
            "div",
            { class: "heroes-nav-row", style: "display:flex;justify-content:center;flex-wrap:wrap;gap:8px;" },
            r.map(link)
          )
        );

      return el(
        "nav",
        { class: "heroes-nav tabs", style: "display:flex;flex-direction:column;align-items:center;gap:10px;" },
        rowNodes
      );
    }

    // 기존 단일줄 fallback
    return el("nav", { class: "heroes-nav tabs", style: "display:flex;justify-content:center;flex-wrap:wrap;gap:8px;" }, items.map(link));
  }

  // =========================
  // SSR Exclusive Weapon (one section)
  // =========================
  function renderSsrExclusiveWeaponOne(hero, _t) {
    const rarityDir = normalizeRarityName(getRarity(hero));
    if (rarityDir !== "ssr") return null;

    const heroSlug = getHeroSlug(hero);

    const special = hero?.special || null;
    const specialStats = special?.stats || null;
    const ewFromSpecial = special?.exclusiveWeapon || null;
    const ewTop = hero?.exclusiveWeapon || null;

    const weaponLegacy = hero?.weapon || null;
    const weaponOptionsLegacy = Array.isArray(hero?.weaponOptions) ? hero.weaponOptions : [];

    const exclusiveWeapon = ewFromSpecial || ewTop || null;

    const legacyOpts = weaponOptionsLegacy.length
      ? weaponOptionsLegacy
      : Array.isArray(weaponLegacy?.options)
      ? weaponLegacy.options
      : [];

    const optionsList = Array.isArray(exclusiveWeapon?.perks) ? exclusiveWeapon.perks
      : Array.isArray(legacyOpts) ? legacyOpts
      : [];

    // ✅ weapon i18n override
    const i18nWeaponName = heroSlug
      ? (tMaybe(_t, `hero.${heroSlug}.weapon.name`) || tMaybe(_t, `hero.${heroSlug}.exclusiveWeapon.name`))
      : null;

    const i18nWeaponDesc = heroSlug
      ? (
          tMaybe(_t, `hero.${heroSlug}.weapon.descHtml`) ||
          tMaybe(_t, `hero.${heroSlug}.weapon.descriptionHtml`) ||
          tMaybe(_t, `hero.${heroSlug}.weapon.desc`) ||
          tMaybe(_t, `hero.${heroSlug}.weapon.description`)
        )
      : null;

    const ewName = i18nWeaponName || exclusiveWeapon?.name || weaponLegacy?.name || _t("hero.section.exclusive_weapon", "Exclusive Weapon");
    const ewIcon = exclusiveWeapon?.icon || exclusiveWeapon?.image || weaponLegacy?.icon || weaponLegacy?.image || null;
    const ewPower = (exclusiveWeapon?.power !== null && exclusiveWeapon?.power !== undefined) ? safeText(exclusiveWeapon.power) : "";

    const rawWeaponDesc = i18nWeaponDesc || exclusiveWeapon?.description || weaponLegacy?.description || "";
    const weaponDescNode = rawWeaponDesc
      ? (isProbablyHtml(rawWeaponDesc)
          ? el("div", { style: "line-height:1.6;", html: String(rawWeaponDesc) })
          : el("div", { style: "line-height:1.6;white-space:pre-wrap;", html: escapeHtml(rawWeaponDesc) }))
      : null;

    const weaponCard = el("div", { class: "card", style: "padding:18px;text-align:center;" }, [
      ewIcon ? el("img", { src: ewIcon, alt: ewName, loading: "lazy", style: "display:block;margin:0 auto 10px auto;max-width:84px;max-height:84px;object-fit:contain;" }) : null,
      el("div", { style: "font-weight:900;font-size:16px;margin:0 0 8px 0;" }, safeText(ewName)),
      weaponDescNode,
    ].filter(Boolean));

    function renderEwStatsBlock() {
      const rows = [];
      if (ewPower) rows.push([_t("hero.power", "Power"), ewPower]);

      const exp = specialStats?.exploration && typeof specialStats.exploration === "object" ? specialStats.exploration : null;
      const ed  = specialStats?.expedition  && typeof specialStats.expedition  === "object" ? specialStats.expedition  : null;

      const expLabel = _t("hero.section.exploration", _t("hero.exploration", "Exploration"));
      const edLabel  = _t("hero.section.expedition",  _t("hero.expedition",  "Expedition"));

      if (exp) for (const [k, v] of Object.entries(exp)) rows.push([`${expLabel} · ${k}`, safeText(v)]);
      if (ed)  for (const [k, v] of Object.entries(ed))  rows.push([`${edLabel} · ${k}`,  safeText(v)]);

      if (!rows.length) return null;

      const table = el("table", {
        class: "stats-table",
        style: "width:auto;min-width:0;max-width:100%;margin:0 auto;border-collapse:collapse;",
      }, [
        el("tbody", null, rows.map(([k, v]) =>
          el("tr", null, [
            el("th", { style: "text-align:left;padding:10px 12px;white-space:nowrap;" }, k),
            el("td", { style: "text-align:right;padding:10px 12px;white-space:nowrap;" }, v),
          ])
        )),
      ]);

      return el("div", { style: "display:flex;justify-content:center;width:100%;margin:0 auto;" }, table);
    }

    const statsBlock = renderEwStatsBlock();

    function toOptionSkillLike(item) {
      // ✅ perk i18n override first
      if (heroSlug) applyWeaponPerkI18nOverride(item, heroSlug, _t);

      const level = item?.level ?? item?.lv ?? item?.tier ?? null;
      const baseName = item?.name || item?.title || item?.key || "Option";
      const name = (level !== null && level !== undefined && String(level).trim() !== "")
        ? `${safeText(baseName)} (Lv.${safeText(level)})`
        : safeText(baseName);

      const icon = item?.icon || item?.iconSrc || item?.image || item?.img || null;
      const descriptionHtml = item?.descriptionHtml || item?.descHtml || item?.html || null;
      const description = item?.description || item?.desc || item?.text || null;
      return { name, icon, descriptionHtml, description };
    }

    // ✅ heroSlug 전달해서 (추후 확장/일관성) + 위에서 perk override 이미 적용
    const optionCards = Array.isArray(optionsList) && optionsList.length
      ? optionsList.filter(Boolean).map((it) => renderSkillCardVertical(toOptionSkillLike(it), heroSlug, _t))
      : [];

    const blocks = [];
    blocks.push(el("h2", { style: "margin:0 0 14px;text-align:center;" }, _t("hero.section.exclusive_weapon", "Exclusive Weapon")));
    blocks.push(centerGrid([weaponCard], { min: 260, max: 420, gap: 14 }));

    if (statsBlock) {
      blocks.push(el("div", { style: "margin-top:14px;text-align:center;font-weight:900;" }, _t("hero.section.stats", "Stats")));
      blocks.push(statsBlock);
    }

    if (optionCards.length) {
      blocks.push(el("div", { style: "margin-top:18px;text-align:center;font-weight:900;" }, _t("hero.section.options", "Options")));
      blocks.push(centerGrid(optionCards, { min: 240, max: 340, gap: 18 }));
    }

    return el("section", { class: "section hero-ssr panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, blocks),
    ]);
  }

  // =========================
  // Talent section
  // =========================
  function renderTalentSection(hero, _t) {
    const talentRaw = hero?.talent ?? null;
    const talentList = Array.isArray(talentRaw) ? talentRaw : (talentRaw && typeof talentRaw === "object" ? [talentRaw] : []);
    if (!talentList.length) return null;

    function toTalentSkillLike(item) {
      const title = item?.name || item?.title || item?.key || _t("hero.section.talent", "Talent");
      const icon = item?.icon || item?.iconSrc || item?.image || item?.img || null;
      const descriptionHtml = item?.descriptionHtml || item?.descHtml || item?.html || null;
      const description = item?.description || item?.desc || item?.text || null;
      return { name: safeText(title), icon, descriptionHtml, description };
    }

    const cards = talentList.map((t) => renderSkillCardVertical(toTalentSkillLike(t), null, _t));

    return el("section", { class: "section hero-talent panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        el("h2", { style: "margin:0 0 14px;text-align:center;" }, _t("hero.section.talent", "Talent")),
        centerGrid(cards, { min: 240, max: 340, gap: 18 }),
      ]),
    ]);
  }

  // =========================
  // Mode section
  // =========================
  function renderModeSection(hero, modeKey, titleText, skillsList, _t) {
    const statsTable = renderStatsTableOnly(hero, modeKey, _t);
    const heroSlug = getHeroSlug(hero);
    const skillsGrid = renderSkillsGridOnly(skillsList, heroSlug, _t);

    if (!statsTable && !skillsGrid) return null;

    const statsWrap = statsTable
      ? el("div", { style: "display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;margin:0 auto;" }, [
          el("div", { style: "font-weight:900;text-align:center;" }, _t("hero.section.stats", "Stats")),
          el("div", { style: "display:flex;justify-content:center;width:100%;" }, statsTable),
        ])
      : null;

    const skillsWrap = skillsGrid
      ? el("div", { style: "display:flex;flex-direction:column;align-items:center;gap:12px;width:100%;margin:18px auto 0;" }, [
          el("div", { style: "font-weight:900;text-align:center;" }, _t("hero.section.skills", "Skills")),
          skillsGrid,
        ])
      : null;

    return el("section", { class: "section hero-mode hero-mode-" + modeKey + " panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        el("h2", { style: "margin:0 0 14px;text-align:center;" }, titleText),
        statsWrap,
        skillsWrap,
      ].filter(Boolean)),
    ]);
  }

  // =========================
  // Shards
  // =========================
  function renderShardsSection(hero, _t) {
    const shards = hero?.shards || hero?.shardTable || hero?.shardsTable;
    if (!shards) return null;

    const rows = Array.isArray(shards?.rows) ? shards.rows : null;
    const itemIcon = shards?.itemIcon || null;
    const starIcon = shards?.starIcon || null;

    function renderStarsCell(value) {
      const v = safeText(value);
      return el("div", { class: "shards-stars", style: "display:flex;align-items:center;justify-content:center;gap:6px;" }, [
        starIcon
          ? el("img", { class: "shards-star-icon", src: starIcon, alt: "Star", loading: "lazy", style: "display:block;width:16px;height:16px;margin:0;" })
          : null,
        el("span", { class: "shards-stars-value" }, v),
      ].filter(Boolean));
    }

    if (rows && rows.length) {
      const columns = [
        _t("hero.shards.stars", "Stars"),
        _t("hero.shards.t1", "Tier 1"),
        _t("hero.shards.t2", "Tier 2"),
        _t("hero.shards.t3", "Tier 3"),
        _t("hero.shards.t4", "Tier 4"),
        _t("hero.shards.t5", "Tier 5"),
        _t("hero.shards.t6", "Tier 6"),
        _t("hero.shards.total", "Total"),
      ];

      const thead = el("thead", null, [
        el("tr", null, columns.map((c) => el("th", null, c))),
      ]);

      const tbody = el("tbody", null, rows.map((r) =>
        el("tr", null, [
          el("td", null, renderStarsCell(r?.stars)),
          el("td", null, safeText(r?.tier1)),
          el("td", null, safeText(r?.tier2)),
          el("td", null, safeText(r?.tier3)),
          el("td", null, safeText(r?.tier4)),
          el("td", null, safeText(r?.tier5)),
          el("td", null, safeText(r?.tier6)),
          el("td", null, safeText(r?.total)),
        ])
      ));

      const headRow = el("div", { class: "section-head", style: "display:flex;align-items:center;justify-content:center;gap:10px;" }, [
        el("h2", { style: "margin:0;text-align:center;" }, _t("hero.section.shards", "Shards")),
        itemIcon ? el("img", { src: itemIcon, alt: "Shard", loading: "lazy", style: "display:block;width:36px;height:36px;border-radius:10px;margin:0;" }) : null,
      ].filter(Boolean));

      const table = el("table", { class: "shards-table", style: "width:auto;min-width:0;max-width:100%;margin:0 auto;border-collapse:collapse;" }, [thead, tbody]);

      return el("section", { class: "section hero-shards panel" }, [
        el("div", { class: "panel-inner", style: "text-align:center;" }, [
          headRow,
          el("div", { style: "display:flex;justify-content:center;overflow-x:auto;padding-top:12px;" }, table),
        ]),
      ]);
    }

    return null;
  }

  // =========================
  // Main renders (ctx compatible)
  // =========================
  async function renderList(rootEl, ctx) {
    const _t = makeT(ctx);
    const mount = typeof rootEl === "string" ? document.querySelector(rootEl) : rootEl;
    if (!mount) return;

    mount.innerHTML = "";
    mount.appendChild(el("div", { class: "loading" }, _t("heroes.loading_list", "Loading heroes…")));

    try {
      const { items } = await loadHeroesIndexAll(ctx);
      const center = mountWithCenter(mount, "heroes-list-center", 1400);

      const groupR = [];
      const groupSR = [];

      const ssrByGen = Object.create(null);
      const ssrUnknown = [];

      for (const it of items) {
        const rd = rarityDirFromHeroIndexItem(it);

        if (rd === "ssr") {
          const gen = getIndexGeneration(it);
          const gk = gen !== null && gen !== undefined ? String(gen) : "unknown";
          const node = cardForHero(it, { rarityDir: "ssr", gen }, _t, ctx);

          if (gk === "unknown") ssrUnknown.push(node);
          else {
            if (!ssrByGen[gk]) ssrByGen[gk] = [];
            ssrByGen[gk].push(node);
          }
          continue;
        }

        if (rd === "sr") { groupSR.push(cardForHero(it, { rarityDir: "sr", gen: null }, _t, ctx)); continue; }
        if (rd === "r")  { groupR.push(cardForHero(it, { rarityDir: "r", gen: null }, _t, ctx));  continue; }
      }

      center.appendChild(el("header", { class: "page-header", style: "text-align:center;" }, [
        el("h1", { style: "text-align:center;margin:10px 0 14px;" }, _t("nav.heroes", "Heroes")),
      ]));

      const genNums = [];
      for (const k of Object.keys(ssrByGen)) {
        const n = Number.parseInt(k, 10);
        if (Number.isFinite(n)) genNums.push(n);
      }
      const sortedGens = sortNumberDesc(genNums);

      // ✅ NAV rows: SSR(들) 위, SR/R 아래 같은 줄
      const navRows = [];

      const ssrRow = [];
      for (const g of sortedGens) {
        ssrRow.push({
          id: "ssr-gen-" + String(g),
          label: _t("heroes.ssr_gen", "SSR Gen {gen}", { gen: g }).replace("{gen}", String(g)),
        });
      }
      if (ssrUnknown.length) ssrRow.push({ id: "ssr-gen-unknown", label: _t("heroes.ssr", "SSR") });
      if (ssrRow.length) navRows.push(ssrRow);

      const rrRow = [];
      if (groupSR.length) rrRow.push({ id: "sr", label: _t("heroes.sr", "SR") });
      if (groupR.length)  rrRow.push({ id: "r",  label: _t("heroes.r", "R") });
      if (rrRow.length) navRows.push(rrRow);

      const nav = buildHeroesNavTabs({ rows: navRows });
      if (nav) center.appendChild(nav);

      const sections = [];

      for (const g of sortedGens) {
        const gk = String(g);
        const cards = ssrByGen[gk] || [];
        if (!cards.length) continue;
        const cols = g === 1 ? 4 : 3;

        const title = _t("heroes.ssr_gen", "SSR · Gen {gen}", { gen: gk }).replace("{gen}", gk);
        const sec = renderGridSection(title, "hero-grid-ssr hero-grid-ssr-gen-" + gk, cols, cards);
        if (sec) { sec.id = "ssr-gen-" + gk; sections.push(sec); }
      }

      if (ssrUnknown.length) {
        const secUnk = renderGridSection(_t("heroes.ssr", "SSR"), "hero-grid-ssr hero-grid-ssr-gen-unknown", 3, ssrUnknown);
        if (secUnk) { secUnk.id = "ssr-gen-unknown"; sections.push(secUnk); }
      }

      if (groupSR.length) {
        const srSec = renderGridSection(_t("heroes.sr", "SR"), "hero-grid-sr", 3, groupSR);
        if (srSec) { srSec.id = "sr"; sections.push(srSec); }
      }

      if (groupR.length) {
        const rSec = renderGridSection(_t("heroes.r", "R"), "hero-grid-r", 4, groupR);
        if (rSec) { rSec.id = "r"; sections.push(rSec); }
      }

      if (!sections.length) {
        center.appendChild(el("p", { class: "muted", style: "text-align:center;" }, _t("heroes.empty", "No heroes found in index.json.")));
        return;
      }

      for (const s of sections) center.appendChild(s);
    } catch (e) {
      const attempted = e?.attempted || [];
      const msg = e?.cause ? safeText(e.cause.message || e.cause) : safeText(e.message || e);

      const center = mountWithCenter(mount, "heroes-error-center", 1100);
      center.appendChild(el("div", { class: "error", style: "text-align:center;" }, [
        el("h2", null, _t("heroes.load_failed", "Failed to load heroes index")),
        el("p", null, msg),
        buildAttemptedList(attempted, _t),
      ]));
    }
  }

  async function renderDetail(rootEl, slug, ctx) {
    const _t = makeT(ctx);
    const mount = typeof rootEl === "string" ? document.querySelector(rootEl) : rootEl;
    if (!mount) return;

    mount.innerHTML = "";
    mount.appendChild(el("div", { class: "loading" }, _t("heroes.loading_detail", "Loading hero…")));

    try {
      const { hero } = await loadHeroDetail(slug, ctx);

      const center = mountWithCenter(mount, "hero-detail-center", 2000);

      const back = el(
        "a",
        { class: "btn back-link", href: "#/heroes", style: "display:inline-flex;margin:10px 0 14px;" },
        _t("heroes.back", "← Back to Heroes")
      );
      center.appendChild(el("div", { style: "text-align:center;" }, back));

      center.appendChild(renderHeroHeader(hero, _t));

      const story = renderStorySection(hero, _t);
      if (story) center.appendChild(story);

      const sourcesInline = renderSourcesInline(hero, _t);
      if (sourcesInline) {
        center.appendChild(el("section", { class: "section hero-sources panel" }, [
          el("div", { class: "panel-inner", style: "text-align:center;" }, [
            el("h2", { style: "margin:0 0 12px;text-align:center;" }, _t("hero.section.sources", "Sources")),
            sourcesInline,
          ]),
        ]));
      }

      const talentSec = renderTalentSection(hero, _t);
      if (talentSec) center.appendChild(talentSec);

      const groups = splitSkillsByMode(hero);

      const expTitle = _t("hero.section.exploration", _t("hero.exploration", "Exploration"));
      const expSec = renderModeSection(hero, "exploration", expTitle, groups.exploration || [], _t);
      if (expSec) center.appendChild(expSec);

      const edTitle = _t("hero.section.expedition", _t("hero.expedition", "Expedition"));
      const edSec = renderModeSection(hero, "expedition", edTitle, groups.expedition || [], _t);
      if (edSec) center.appendChild(edSec);

      const shards = renderShardsSection(hero, _t);
      if (shards) center.appendChild(shards);

      const desc = renderDescriptionSection(hero, _t);
      if (desc) center.appendChild(desc);

      const ewOne = renderSsrExclusiveWeaponOne(hero, _t);
      if (ewOne) center.appendChild(ewOne);

    } catch (e) {
      const attempted = e?.attempted || [];
      const msg = e?.cause ? safeText(e.cause.message || e.cause) : safeText(e.message || e);

      const center = mountWithCenter(mount, "hero-error-center", 980);
      center.appendChild(el("div", { class: "error", style: "text-align:center;" }, [
        el("h2", null, _t("heroes.detail_failed", "Failed to load hero detail")),
        el("p", null, _t("heroes.slug", "Slug") + ": " + safeText(slug)),
        el("p", null, msg),
        buildAttemptedList(attempted, _t),
        el("p", null, el("a", { href: "#/heroes" }, _t("heroes.go_list", "Go to Heroes list"))),
      ]));
    }
  }

  async function renderHomeCards(rootEl, topN, ctx) {
    const _t = makeT(ctx);
    const mount = typeof rootEl === "string" ? document.querySelector(rootEl) : rootEl;
    if (!mount) return;

    const n = Number.isFinite(topN) ? topN : DEFAULT_TOP_N;

    const mountIsGridSlot =
      mount.classList?.contains("grid") ||
      String(mount.id || "").toLowerCase().includes("homeheroesgrid");

    function rarityRank(rd) {
      if (rd === "ssr") return 0;
      if (rd === "sr") return 1;
      if (rd === "r") return 2;
      return 3;
    }

    function safeNumDesc(v) {
      if (v === null || v === undefined) return -1;
      const nn = Number.parseInt(String(v), 10);
      return Number.isFinite(nn) ? nn : -1;
    }

    function sortForHome(a, b) {
      const ra = rarityRank(a.rarityDir);
      const rb = rarityRank(b.rarityDir);
      if (ra !== rb) return ra - rb;

      const ga = a.rarityDir === "ssr" ? safeNumDesc(a.gen) : -1;
      const gb = a.rarityDir === "ssr" ? safeNumDesc(b.gen) : -1;
      if (gb !== ga) return gb - ga;

      return 0;
    }

    if (mountIsGridSlot) {
      mount.innerHTML = `<div class="muted small">${escapeHtml(_t("common.loading", "Loading…"))}</div>`;
      try {
        const { items } = await loadHeroesIndexAll(ctx);

        const packed = items.map((it) => {
          const rarityDir = rarityDirFromHeroIndexItem(it) || "other";
          const gen = rarityDir === "ssr" ? getIndexGeneration(it) : null;
          return { it, rarityDir, gen };
        });

        packed.sort(sortForHome);

        const slice = packed.slice(0, Math.max(0, n));
        mount.innerHTML = "";
        if (!slice.length) {
          mount.appendChild(el("div", { class: "muted small" }, _t("heroes.empty", "No heroes found in index.json.")));
          return;
        }

        const limiter = el("div", { style: "width:100%;max-width:1100px;margin:0 auto;box-sizing:border-box;" }, []);
        for (const p of slice) limiter.appendChild(cardForHero(p.it, { rarityDir: p.rarityDir, gen: p.gen }, _t, ctx));
        mount.appendChild(limiter);
      } catch (e) {
        const attempted = e?.attempted || [];
        const msg = e?.cause ? safeText(e.cause.message || e.cause) : safeText(e.message || e);
        mount.innerHTML = "";
        mount.appendChild(el("div", { class: "error" }, [
          el("p", null, _t("heroes.home_failed", "Failed to load heroes for home.")),
          el("p", { class: "muted" }, msg),
          buildAttemptedList(attempted, _t),
        ]));
      }
      return;
    }

    const center = mountWithCenter(mount, "home-heroes-center", 1100);

    const section = el("section", { class: "section home-heroes panel" }, [
      el("div", { class: "panel-inner", style: "text-align:center;" }, [
        el("div", { class: "section-head", style: "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;" }, [
          el("h2", { style: "margin:0;text-align:center;flex:1;" }, _t("nav.heroes", "Heroes")),
          el("a", { class: "btn", href: "#/heroes" }, _t("common.open", "Open")),
        ]),
        el("div", { class: "loading", style: "margin-top:12px;" }, _t("common.loading", "Loading…")),
      ]),
    ]);

    center.appendChild(section);

    try {
      const { items } = await loadHeroesIndexAll(ctx);

      const packed = items.map((it) => {
        const rarityDir = rarityDirFromHeroIndexItem(it) || "other";
        const gen = rarityDir === "ssr" ? getIndexGeneration(it) : null;
        return { it, rarityDir, gen };
      });

      packed.sort(sortForHome);

      const slice = packed.slice(0, Math.max(0, n));
      const cards = slice.map((p) => cardForHero(p.it, { rarityDir: p.rarityDir, gen: p.gen }, _t, ctx));

      section.querySelector(".loading")?.remove();

      if (!cards.length) {
        section.querySelector(".panel-inner")?.appendChild(el("p", { class: "muted", style: "text-align:center;" }, _t("heroes.empty", "No heroes found in index.json.")));
        return;
      }

      section.querySelector(".panel-inner")?.appendChild(centerGrid(cards, { min: 200, max: 280, gap: 14 }));
    } catch (e) {
      const attempted = e?.attempted || [];
      const msg = e?.cause ? safeText(e.cause.message || e.cause) : safeText(e.message || e);

      section.querySelector(".loading")?.remove();
      section.querySelector(".panel-inner")?.appendChild(el("div", { class: "error", style: "text-align:center;" }, [
        el("p", null, _t("heroes.home_failed", "Failed to load heroes for home.")),
        el("p", { class: "muted" }, msg),
        buildAttemptedList(attempted, _t),
      ]));
    }
  }

  window.WOS_HEROES = {
    renderList,
    renderDetail,
    renderHomeCards,
    _internal: {
      candidatesForHeroesBase,
      resolveHeroesBase,
      loadHeroesIndexAll,
      loadHeroDetail,
      normalizeIndexPayload,
      pickText,
      getRarity,
      normalizeRarityName,
      rarityDirFromHeroIndexItem,
      rarityDirFromHeroDetail,
      splitSkillsByMode,
      getIndexGeneration,
      extractSkillId,
      applySkillI18nOverride,
      applyWeaponPerkI18nOverride,
      tMaybe,
      tFirst,
    },
  };
})();

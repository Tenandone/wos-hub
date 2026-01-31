(() => {
  "use strict";

  const BUILD_ID =
    "bcalc-" + Math.random().toString(36).slice(2, 8) + "-" + Date.now().toString(36);

  const ALLOWED_SLUGS = [
    "furnace",
    "embassy",
    "commandcenter",
    "infirmary",
    "infantrycamp",
    "lancercamp",
    "marksmancamp",
    "waracademy",
  ];

  const RES_ID = {
    food: "res_100011",
    wood: "res_103",
    coal: "res_104",
    iron: "res_105",
    fireCrystal: "res_100081",
    refineStone: "res_100082",
  };

  const CSV_COLS = {
    level: "레벨",
    fireCrystal: "불수정",
    refined: "정제",
    food: "고기",
    wood: "나무",
    coal: "석탄",
    iron: "철광",
    convertHours: "변환시간",
  };

  const useFireCrystal = true;

  // ✅ FIX: 절대경로(/assets/...)로 통일 (상대경로 assets/... 는 라우트에 따라 깨짐)
  const DEFAULT_RES_ICONS = {
    fireCrystal: "/assets/buildings/furnace/firecrystal_img/item_icon_100081.png",
    refined: "/assets/buildings/furnace/firecrystal_img/item_icon_100082.png",
    food: "/assets/buildings/furnace/firecrystal_img/item_icon_100011.png",
    wood: "/assets/buildings/furnace/firecrystal_img/item_icon_103.png",
    coal: "/assets/buildings/furnace/firecrystal_img/item_icon_104.png",
    iron: "/assets/buildings/furnace/firecrystal_img/item_icon_105.png",
    time: "/assets/resources/time.png",
    svs: "/assets/resources/svs.png",
  };

  // =========================================================
  // ✅ Resource URL resolver (GitHub Pages /repo prefix + route-safe)
  // - 왜 필요?
  //   1) "assets/..." 상대경로는 /tools/... 에서 깨짐
  //   2) GitHub Pages 프로젝트 페이지는 /repo prefix 필요
  //   3) app.js는 window.WOS_RES로 해결하므로, 여기서도 반드시 사용
  // =========================================================
  function isExternalLike(u) {
    const s = String(u ?? "");
    return (
      /^(https?:)?\/\//i.test(s) ||
      s.startsWith("data:") ||
      s.startsWith("blob:") ||
      s.startsWith("mailto:") ||
      s.startsWith("tel:")
    );
  }

  function normalizeToRootPath(u) {
    const s = String(u ?? "").trim();
    if (!s) return s;

    if (isExternalLike(s)) return s;

    // "./assets/..", "assets/.." 같은 상대경로를 "/assets/.." 로 강제 변환
    const clean = s.replace(/^\.?\//, ""); // remove leading "./" or "/"
    if (s.startsWith("/")) return s;
    return "/" + clean;
  }

  function withResSafe(u) {
    const raw = String(u ?? "");
    if (!raw) return raw;
    if (isExternalLike(raw)) return raw;

    const rootPath = normalizeToRootPath(raw);

    // app.js에서 제공
    if (typeof window.WOS_RES === "function") {
      return window.WOS_RES(rootPath);
    }

    // fallback: WOS_BASE가 있으면 prefix 적용
    const base = typeof window.WOS_BASE === "string" ? window.WOS_BASE : "";
    if (base && rootPath.startsWith(base + "/")) return rootPath;
    return (base || "") + rootPath;
  }

  function withNavSafe(path) {
    const p = String(path ?? "").trim() || "/";
    const rootPath = p.startsWith("/") ? p : "/" + p.replace(/^\.?\//, "");
    if (typeof window.WOS_URL === "function") return window.WOS_URL(rootPath); // app.js withBase
    // fallback
    const base = typeof window.WOS_BASE === "string" ? window.WOS_BASE : "";
    if (base && rootPath.startsWith(base + "/")) return rootPath;
    return (base || "") + rootPath;
  }

  function makeT(t) {
    return (k, fb) => {
      try {
        const v = typeof t === "function" ? t(k) : null;
        return (v != null && String(v).trim() !== "" ? v : null) || fb || k;
      } catch (_) {
        return fb || k;
      }
    };
  }

  function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, (m) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[m]));
  }

  function attr(v) {
    return String(v ?? "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function num(v) {
    if (v == null) return 0;
    const s = String(v).trim();
    if (!s) return 0;
    const n = Number(s.replace(/,/g, ""));
    return Number.isFinite(n) ? n : 0;
  }

  function clampInt(v, min, max) {
    const n = parseInt(String(v ?? ""), 10);
    if (!Number.isFinite(n)) return min;
    return Math.max(min, Math.min(max, n));
  }

  function isPressed(el) {
    return !!el && String(el.getAttribute("aria-pressed") || "false") === "true";
  }

  function setPressed(el, pressed) {
    if (!el) return;
    el.setAttribute("aria-pressed", pressed ? "true" : "false");
    el.classList.toggle("primary", !!pressed);
  }

  function togglePressed(el) {
    const next = !isPressed(el);
    setPressed(el, next);
    return next;
  }

  function normalizeIndexItems(idx) {
    if (!idx) return [];
    if (Array.isArray(idx)) return idx;
    if (Array.isArray(idx.items)) return idx.items;
    return [];
  }

  // ✅ FIX: fetch도 리소스 기준 URL로 정규화해야 라우트/레포 prefix에서 안 깨짐
  async function fetchJSON(url) {
    const u = withResSafe(url);
    const r = await fetch(u, { cache: "no-store" });
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${u}`);
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

  function getIconUrl(key) {
    const w = window.WOS_BUILDING_CALC_ASSETS;
    const map = w && w.resourceIcons && typeof w.resourceIcons === "object" ? w.resourceIcons : null;

    const raw = (map && map[key] ? String(map[key]) : (DEFAULT_RES_ICONS[key] || "")) || "";
    if (!raw) return "";

    // ✅ FIX: 어떤 형태로 들어와도 (assets/... / /assets/...) repo prefix + route safe 처리
    return withResSafe(raw);
  }

  function iconHTML(key, alt, size = 16) {
    const src = getIconUrl(key);
    const safeAlt = esc(alt || key);
    if (!src) return "";
    return `<img src="${attr(src)}" alt="${safeAlt}" style="width:${size}px;height:${size}px;vertical-align:-3px;object-fit:contain" onerror="this.style.display='none'">`;
  }

  function formatSVS(value) {
    const v = Number(value || 0);
    if (!Number.isFinite(v) || v <= 0) return "0";
    if (v >= 1e9) return (v / 1e9).toFixed(v >= 1e10 ? 1 : 2).replace(/\.0+$/, "") + "B";
    if (v >= 1e6) return (v / 1e6).toFixed(v >= 1e8 ? 1 : 2).replace(/\.0+$/, "") + "M";
    if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0+$/, "") + "K";
    return String(Math.floor(v));
  }

  function formatKM(value) {
    const v0 = Number(value || 0);
    if (!Number.isFinite(v0) || v0 <= 0) return "0";
    const v = Math.floor(v0);

    let denom = 1;
    let suf = "";

    if (v >= 1e9) {
      denom = 1e9; suf = "B";
    } else if (v >= 1e6) {
      denom = 1e6; suf = "M";
    } else if (v >= 1e3) {
      denom = 1e3; suf = "K";
    } else {
      return v.toLocaleString();
    }

    let n = v / denom;

    if (suf === "K" && n >= 999.95) { denom = 1e6; suf = "M"; n = v / denom; }
    if (suf === "M" && n >= 999.95) { denom = 1e9; suf = "B"; n = v / denom; }

    const s = n.toFixed(1).replace(/\.0$/, "");
    return s + suf;
  }

  function formatHourToTime(hours) {
    let totalMin = Math.max(0, Math.round((Number(hours) || 0) * 60));
    const d = Math.floor(totalMin / (24 * 60));
    totalMin -= d * 24 * 60;
    const h = Math.floor(totalMin / 60);
    totalMin -= h * 60;
    const m = totalMin;

    const out = [];
    if (d) out.push(d + "d");
    if (h) out.push(h + "h");
    if (m || (!d && !h)) out.push(m + "m");
    return out.join(" ");
  }

  function getValeriaBonus(selEl) {
    const lv = clampInt(selEl?.value || 0, 0, 10);
    return lv * 0.02;
  }

  function getExpertFlatHours(selEl) {
    const lv = clampInt(selEl?.value || 0, 0, 5);
    if (lv === 1) return 2;
    if (lv === 2) return 3;
    if (lv === 3) return 4;
    if (lv === 4) return 6;
    if (lv === 5) return 8;
    return 0;
  }

  function getActiveVP(btn10, btn15) {
    if (isPressed(btn10)) return 10;
    if (isPressed(btn15)) return 15;
    return 0;
  }

  function getFactorForTime({ buildSpeedPct, vpPct, serverBuffActive, petPct }) {
    let factor = 1 + (Number(buildSpeedPct) || 0) / 100;
    factor += (Number(vpPct) || 0) / 100;
    if (serverBuffActive) factor += 0.10;
    factor += (Number(petPct) || 0) / 100;
    if (!Number.isFinite(factor) || factor <= 0) factor = 1;
    return factor;
  }

  function filterLevelsWithIndex(levelLabels, useFireCrystalFlag) {
    const out = [];
    const list = Array.isArray(levelLabels) ? levelLabels : [];
    for (let i = 0; i < list.length; i++) {
      const label = String(list[i] ?? "").trim();
      if (!label) continue;

      if (!useFireCrystalFlag) {
        if (/^FC/i.test(label)) continue;
        if (/-/.test(label) && /^FC/i.test(label.replace(/\s+/g, ""))) continue;
      }
      out.push({ idx: i, label });
    }
    return out;
  }

  function parseToHours(v) {
    if (v == null) return 0;

    if (typeof v === "object" && !Array.isArray(v)) {
      const raw = v.raw ?? v.text ?? v.display ?? v.value ?? null;
      const sec = v.seconds ?? v.sec ?? v.s ?? null;
      if (raw != null && String(raw).trim() !== "") return parseToHours(raw);
      if (sec != null && Number.isFinite(Number(sec))) return Math.max(0, Number(sec) / 3600);
    }

    if (typeof v === "number") {
      if (!Number.isFinite(v)) return 0;
      const n = v;
      if (Number.isInteger(n) && n >= 60) return Math.max(0, n / 3600);
      return Math.max(0, n);
    }

    const s0 = String(v).trim();
    if (!s0) return 0;
    const s = s0.toLowerCase();

    if (/^\d+:\d+:\d+$/.test(s)) {
      const [hh, mm, ss] = s.split(":").map((x) => parseInt(x, 10));
      if (Number.isFinite(hh) && Number.isFinite(mm) && Number.isFinite(ss)) {
        return Math.max(0, hh + mm / 60 + ss / 3600);
      }
    }

    if (/^\d+:\d+$/.test(s)) {
      const [mm, ss] = s.split(":").map((x) => parseInt(x, 10));
      if (Number.isFinite(mm) && Number.isFinite(ss)) {
        return Math.max(0, mm / 60 + ss / 3600);
      }
    }

    let d = 0, h = 0, m = 0, sec = 0;

    s.replace(/(\d+)\s*d/g, (_, x) => { d = +x; });
    s.replace(/(\d+)\s*h/g, (_, x) => { h = +x; });
    s.replace(/(\d+)\s*m/g, (_, x) => { m = +x; });
    s.replace(/(\d+)\s*s/g, (_, x) => { sec = +x; });

    s.replace(/(\d+)\s*일/g, (_, x) => { d = +x; });
    s.replace(/(\d+)\s*시(?:간)?/g, (_, x) => { h = +x; });
    s.replace(/(\d+)\s*분/g, (_, x) => { m = +x; });
    s.replace(/(\d+)\s*초/g, (_, x) => { sec = +x; });

    if (d + h + m + sec > 0) return Math.max(0, d * 24 + h + m / 60 + sec / 3600);

    const n = Number(s0.replace(/,/g, ""));
    if (Number.isFinite(n)) {
      if (Number.isInteger(n) && n >= 60) return Math.max(0, n / 3600);
      return Math.max(0, n);
    }

    return 0;
  }

  const KEY_MAP = {
    "레벨": ["레벨", "level", "lv", "lvl", "target", "단계"],
    "불수정": ["불수정", "fc", "fire_crystal", "fireCrystal", "firecrystal", "fire crystal", "fire_crystals"],
    "정제": ["정제", "refined", "refined_fc", "refinedFireCrystal", "refind", "refind_fc", "refine", "refining"],
    "고기": ["고기", "food", "meat"],
    "나무": ["나무", "wood", "lumber"],
    "석탄": ["석탄", "coal"],
    "철광": ["철광", "iron"],
    "변환시간": ["변환시간", "time", "buildTime", "duration", "conversionTime", "convertTime", "convertedTime", "hours"],
  };

  function getAny(obj, keys) {
    for (const k of keys) {
      if (obj == null) continue;
      if (Object.prototype.hasOwnProperty.call(obj, k)) return obj[k];
      const kk = String(k).toLowerCase();
      for (const ok of Object.keys(obj)) {
        if (String(ok).toLowerCase() === kk) return obj[ok];
      }
    }
    return undefined;
  }

  function normalizeOneRow(rawRow) {
    if (rawRow == null) return null;

    const costs = rawRow.costs && typeof rawRow.costs === "object" ? rawRow.costs : null;

    const out = {
      [CSV_COLS.level]: "",
      [CSV_COLS.fireCrystal]: 0,
      [CSV_COLS.refined]: 0,
      [CSV_COLS.food]: 0,
      [CSV_COLS.wood]: 0,
      [CSV_COLS.coal]: 0,
      [CSV_COLS.iron]: 0,
      [CSV_COLS.convertHours]: 0,
    };

    const lv =
      rawRow[CSV_COLS.level] ??
      rawRow.level ??
      rawRow.lv ??
      rawRow.lvl ??
      rawRow.레벨 ??
      getAny(rawRow, KEY_MAP["레벨"]);
    out[CSV_COLS.level] = String(lv ?? "").trim();

    if (costs) {
      out[CSV_COLS.food] = num(costs[RES_ID.food]);
      out[CSV_COLS.wood] = num(costs[RES_ID.wood]);
      out[CSV_COLS.coal] = num(costs[RES_ID.coal]);
      out[CSV_COLS.iron] = num(costs[RES_ID.iron]);
      out[CSV_COLS.fireCrystal] = num(costs[RES_ID.fireCrystal]);
      out[CSV_COLS.refined] = num(costs[RES_ID.refineStone]);
    } else {
      out[CSV_COLS.food] = num(getAny(rawRow, KEY_MAP["고기"]) ?? rawRow[CSV_COLS.food]);
      out[CSV_COLS.wood] = num(getAny(rawRow, KEY_MAP["나무"]) ?? rawRow[CSV_COLS.wood]);
      out[CSV_COLS.coal] = num(getAny(rawRow, KEY_MAP["석탄"]) ?? rawRow[CSV_COLS.coal]);
      out[CSV_COLS.iron] = num(getAny(rawRow, KEY_MAP["철광"]) ?? rawRow[CSV_COLS.iron]);
      out[CSV_COLS.fireCrystal] = num(getAny(rawRow, KEY_MAP["불수정"]) ?? rawRow[CSV_COLS.fireCrystal]);
      out[CSV_COLS.refined] = num(getAny(rawRow, KEY_MAP["정제"]) ?? rawRow[CSV_COLS.refined]);
    }

    const t =
      rawRow[CSV_COLS.convertHours] ??
      rawRow.time ??
      rawRow.buildTime ??
      rawRow.duration ??
      rawRow.conversionTime ??
      getAny(rawRow, KEY_MAP["변환시간"]);
    out[CSV_COLS.convertHours] = parseToHours(t);

    if (!out[CSV_COLS.level] && rawRow.levelInfo && typeof rawRow.levelInfo === "object") {
      const k = rawRow.levelInfo.key ?? rawRow.levelInfo.label ?? rawRow.levelInfo.n ?? "";
      out[CSV_COLS.level] = String(k ?? "").trim();
    }

    return out[CSV_COLS.level] ? out : null;
  }

  function normalizeRowsFromTable(table) {
    if (!Array.isArray(table) || table.length < 2) return [];
    const header = Array.isArray(table[0]) ? table[0].map((x) => String(x ?? "").trim()) : [];
    if (!header.length) return [];

    const out = [];
    for (let i = 1; i < table.length; i++) {
      const rowArr = table[i];
      if (!Array.isArray(rowArr)) continue;
      const obj = {};
      for (let c = 0; c < header.length; c++) obj[header[c]] = rowArr[c];
      const n = normalizeOneRow(obj);
      if (n) out.push(n);
    }
    return out;
  }

  function normalizeRowsFromArray(arr) {
    if (!Array.isArray(arr)) return [];
    const out = [];
    for (const r of arr) {
      if (r == null) continue;
      if (Array.isArray(r)) continue;
      const n = normalizeOneRow(r);
      if (n) out.push(n);
    }
    return out;
  }

  function extractCandidateNodes(buildingJson) {
    const nodes = [];

    if (buildingJson && typeof buildingJson.phases === "object") {
      const ph = buildingJson.phases;
      for (const k of ["base", "firecrystal", "firecrystalPlus", "fc", "fcPlus"]) {
        if (ph[k]) nodes.push(ph[k]);
      }
    }

    for (const k of ["base", "firecrystal", "firecrystalPlus", "fc", "fcPlus"]) {
      if (buildingJson && buildingJson[k]) nodes.push(buildingJson[k]);
    }

    nodes.push(buildingJson);
    return nodes.filter(Boolean);
  }

  function normalizeBuildingRows(buildingJson) {
    if (!buildingJson) return [];

    const out = [];

    const nodes = extractCandidateNodes(buildingJson);
    for (const node of nodes) {
      if (Array.isArray(node.table)) {
        out.push(...normalizeRowsFromTable(node.table));
        continue;
      }

      if (Array.isArray(node.rows)) {
        out.push(...normalizeRowsFromArray(node.rows));
        continue;
      }

      if (node !== buildingJson) continue;

      if (Array.isArray(buildingJson.table)) out.push(...normalizeRowsFromTable(buildingJson.table));
      if (Array.isArray(buildingJson.rows)) out.push(...normalizeRowsFromArray(buildingJson.rows));
    }

    const seen = new Set();
    const final = [];
    for (const r of out) {
      const k = String(r[CSV_COLS.level] ?? "").trim();
      if (!k) continue;
      if (seen.has(k)) continue;
      seen.add(k);
      final.push(r);
    }
    return final;
  }

  function buildDetailCandidates(base, slug) {
    const s = String(slug || "").trim();
    return [
      `${base}/base/${s}.json`,
      `${base}/${s}.json`,
      `${base}/fc/${s}.json`,
      `${base}/fcPlus/${s}.json`,
    ];
  }

  async function loadBuildingDataFromJSON(DATA_BASE, fetchJSONTry) {
    const _try = fetchJSONTry || fetchJSONTryFallback;

    // ✅ FIX: DATA_BASE가 상대값으로 들어오면 라우트에 따라 깨짐 → withResSafe로 보정
    const baseResolved = withResSafe(DATA_BASE || "/data/buildings");
    const base = String(baseResolved).replace(/\/+$/, "");

    const idxUrl = `${base}/index.json`;
    const idx = await _try([idxUrl]);
    const items = normalizeIndexItems(idx);

    const bySlug = new Map();
    for (const it of items) {
      const slug = String(it?.slug ?? it?.meta?.slug ?? "").trim();
      if (!slug) continue;
      const title = it?.title ?? it?.name ?? it?.meta?.title ?? it?.meta?.name ?? "";
      bySlug.set(slug, { slug, title: String(title || slug) });
    }

    const list = [];
    for (const slug of ALLOWED_SLUGS) {
      const hit = bySlug.get(slug);
      if (hit) list.push(hit);
      else list.push({ slug, title: slug });
    }

    const data = new Map();
    for (const it of list) {
      const slug = it.slug;
      const urls = buildDetailCandidates(base, slug);
      const json = await _try(urls);
      const rows = normalizeBuildingRows(json);
      const levelLabels = rows.map((r) => r[CSV_COLS.level]);
      const levels = filterLevelsWithIndex(levelLabels, useFireCrystal);
      data.set(slug, { slug, title: it.title, rows, levels });
    }

    return { base, list, data };
  }

  function emptySums() {
    return {
      fireCrystal: 0,
      refined: 0,
      food: 0,
      wood: 0,
      coal: 0,
      iron: 0,
    };
  }

  function calcSegment(rows, startIdx, endIdx, {
    buildSpeedPct,
    hyenaPct,
    vpPct,
    serverBuffActive,
    chiefOrderActive,
    agenesFlatHours,
    valeriaBonus,
  }) {
    const s = clampInt(startIdx, 0, Math.max(0, rows.length - 1));
    const e = clampInt(endIdx, 0, Math.max(0, rows.length - 1));
    if (!(s < e)) {
      return {
        valid: false,
        sums: emptySums(),
        hours: 0,
        adjHours: 0,
        score: 0,
        factor: 1,
      };
    }

    const slice = rows.slice(s + 1, e + 1);

    const sums = emptySums();
    let hours = 0;
    for (const r of slice) {
      sums.fireCrystal += Number(r[CSV_COLS.fireCrystal]) || 0;
      sums.refined += Number(r[CSV_COLS.refined]) || 0;
      sums.food += Number(r[CSV_COLS.food]) || 0;
      sums.wood += Number(r[CSV_COLS.wood]) || 0;
      sums.coal += Number(r[CSV_COLS.coal]) || 0;
      sums.iron += Number(r[CSV_COLS.iron]) || 0;
      hours += Number(r[CSV_COLS.convertHours]) || 0;
    }

    const factor = getFactorForTime({
      buildSpeedPct,
      vpPct,
      serverBuffActive,
      petPct: hyenaPct,
    });

    let adjHours = hours / factor;

    if (chiefOrderActive) adjHours *= 0.8;
    if (agenesFlatHours) adjHours = Math.max(0, adjHours - agenesFlatHours);

    const v = Number(valeriaBonus) || 0;

    const fcScore = (sums.fireCrystal || 0) * 2000;
    const rfScore = (sums.refined || 0) * 30000;
    const spScore = (adjHours * 60) * 30;

    const score =
      Math.floor(fcScore * (1 + v)) +
      Math.floor(rfScore * (1 + v)) +
      Math.floor(spScore * (1 + v));

    return {
      valid: true,
      sums,
      hours,
      adjHours,
      score,
      factor,
    };
  }

  function ensureStyleOnce() {
    const STYLE_ID = "bcalc-style";
    if (document.getElementById(STYLE_ID)) return;

    const st = document.createElement("style");
    st.id = STYLE_ID;
    st.textContent = `
      .bcalc-wrap{width:100%;max-width:780px;margin:0 auto;padding:0 12px;box-sizing:border-box;}
      #fc-total-kv{grid-template-columns:repeat(4,minmax(0,1fr));}
      @media (max-width: 640px){
        #fc-total-kv{grid-template-columns:repeat(2,minmax(0,1fr));}
      }
      @media (max-width: 360px){
        #fc-total-kv{grid-template-columns:1fr;}
      }
      @media (max-width: 520px){
        #fc-controls .grid-2{grid-template-columns:1fr !important;}
      }
    `;
    document.head.appendChild(st);
  }

  function renderShell(appEl, _t) {
    ensureStyleOnce();

    // ✅ FIX: NO HASH 라우터에 맞춤 (app.js History Router)
    const toolsHref = withNavSafe("/tools");

    appEl.innerHTML = `
      <div class="bcalc-wrap">
        <div class="container">
          <div class="topbar">
            <div>
              <div class="brand">WOS.GG</div>
              <div class="muted small" data-i18n="tools.building_calc.breadcrumb">${esc(_t("tools.building_calc.breadcrumb", "Tools · Building Calculator"))}</div>
            </div>
            <div>
              <a class="btn" href="${attr(toolsHref)}" data-link data-i18n="tools.common.back">${esc(_t("tools.common.back", "Back"))}</a>
            </div>
          </div>

          <div class="panel" style="margin-top:12px">
            <h1 class="h1" style="margin:0 0 8px" data-i18n="tools.building_calc.title">${esc(_t("tools.building_calc.title", "Building Calculator"))}</h1>

            <div class="howto muted small">
              <div class="howto-title" data-i18n="tools.building_calc.howto.title">${esc(_t("tools.building_calc.howto.title", "How to Use"))}</div>
              <ol class="howto-ol">
                <li data-i18n="tools.building_calc.howto.step1">${esc(_t("tools.building_calc.howto.step1", "Select a Building, then choose your Current Level and Target Level."))}</li>
                <li data-i18n="tools.building_calc.howto.step2">${esc(_t("tools.building_calc.howto.step2", "Enter buffs that match your account."))}</li>
                <li data-i18n="tools.building_calc.howto.step3">${esc(_t("tools.building_calc.howto.step3", "The calculator loads local JSON automatically and updates results instantly."))}</li>
                <li data-i18n="tools.building_calc.howto.step4">${esc(_t("tools.building_calc.howto.step4", "Check Total Result for overall costs/time/SVS, and Detail (Per Level) for step-by-step requirements."))}</li>
              </ol>

              <div class="howto-tip" data-i18n="tools.building_calc.howto.tip">${esc(_t("tools.building_calc.howto.tip", "Tip: For the most accurate estimate, input buffs exactly as they are in your account."))}</div>
            </div>
          </div>

          <div class="panel" style="margin-top:12px;display:none" id="fc-error">
            <div style="color:#ff6b6b;font-weight:700" data-i18n="tools.building_calc.error.title">${esc(_t("tools.building_calc.error.title", "Error"))}</div>
            <pre id="fc-error-pre" style="white-space:pre-wrap;margin:10px 0 0"></pre>
          </div>

          <div class="panel" style="margin-top:12px" id="fc-controls">
            <div class="grid" style="display:grid;gap:12px;grid-template-columns:1fr;align-items:end;">
              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.building">${esc(_t("tools.building_calc.controls.building", "Building"))}</label>
                <select id="fc-building" class="input" style="width:100%;padding:10px"></select>
              </div>
              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.current">${esc(_t("tools.building_calc.controls.current", "Current Level"))}</label>
                <select id="fc-cur" class="input" style="width:100%;padding:10px"></select>
              </div>
              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.target">${esc(_t("tools.building_calc.controls.target", "Target Level"))}</label>
                <select id="fc-tar" class="input" style="width:100%;padding:10px"></select>
              </div>
            </div>

            <div class="grid grid-2" style="display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));align-items:end;margin-top:12px;">
              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.build_speed">${esc(_t("tools.building_calc.controls.build_speed", "Construction Speed (%)"))}</label>
                <input id="fc-buildspeed" class="input" style="width:100%;padding:10px" type="number" value="0" min="0" step="0.1">
              </div>
              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.pet">${esc(_t("tools.building_calc.controls.pet", "Pet Buff (Hyena)"))}</label>
                <select id="fc-hyena" class="input" style="width:100%;padding:10px"></select>
              </div>
              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.agenes">${esc(_t("tools.building_calc.controls.agenes", "Agenes Buff (Flat Time, Once)"))}</label>
                <select id="fc-agenes" class="input" style="width:100%;padding:10px"></select>
              </div>
              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.valeria">${esc(_t("tools.building_calc.controls.valeria", "Valeria Buff (SVS +%)"))}</label>
                <select id="fc-valeria" class="input" style="width:100%;padding:10px"></select>
              </div>
            </div>

            <div class="grid grid-2" style="display:grid;gap:12px;grid-template-columns:repeat(2,minmax(0,1fr));align-items:end;margin-top:12px;">
              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.vp_label">${esc(_t("tools.building_calc.controls.vp_label", "Select Buff (VP)"))}</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
                  <button id="fc-vp10" class="btn" type="button" aria-pressed="false" data-i18n="tools.building_calc.controls.vp10">${esc(_t("tools.building_calc.controls.vp10", "VP +10%"))}</button>
                  <button id="fc-vp15" class="btn" type="button" aria-pressed="false" data-i18n="tools.building_calc.controls.vp15">${esc(_t("tools.building_calc.controls.vp15", "VP +15%"))}</button>
                </div>
              </div>

              <div>
                <label class="muted small" data-i18n="tools.building_calc.controls.server_chief_label">${esc(_t("tools.building_calc.controls.server_chief_label", "Select Buff (Server / Chief)"))}</label>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px">
                  <button id="fc-server" class="btn" type="button" aria-pressed="false" data-i18n="tools.building_calc.controls.server_buff">${esc(_t("tools.building_calc.controls.server_buff", "Server Buff (+10%)"))}</button>
                  <button id="fc-chief" class="btn" type="button" aria-pressed="false" data-i18n="tools.building_calc.controls.chief_order">${esc(_t("tools.building_calc.controls.chief_order", "Chief Order (-20% time)"))}</button>
                </div>
              </div>
            </div>
          </div>

          <div class="panel" style="margin-top:12px" id="fc-total">
            <h2 class="h2" style="margin:0 0 10px" data-i18n="tools.building_calc.total.title">${esc(_t("tools.building_calc.total.title", "Total Result"))}</h2>
            <div class="grid" style="display:grid;gap:8px;" id="fc-total-kv"></div>
          </div>

          <div class="panel" style="margin-top:12px" id="fc-summary-wrap">
            <h2 class="h2" style="margin:0 0 10px" data-i18n="tools.building_calc.summary.title">${esc(_t("tools.building_calc.summary.title", "Summary"))}</h2>
            <div style="overflow:auto">
              <table class="table" style="width:100%;max-width:100%;border-collapse:collapse">
                <thead>
                  <tr class="muted small" style="text-align:left">
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)" data-i18n="tools.building_calc.table.building">${esc(_t("tools.building_calc.table.building", "Building"))}</th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)" data-i18n="tools.building_calc.table.current">${esc(_t("tools.building_calc.table.current", "Current"))}</th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)" data-i18n="tools.building_calc.table.target">${esc(_t("tools.building_calc.table.target", "Target"))}</th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("fireCrystal", _t("tools.building_calc.total.fireCrystal", "Fire Crystal"))} <span data-i18n="tools.building_calc.table.fc">${esc(_t("tools.building_calc.table.fc", "FC"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("refined", _t("tools.building_calc.total.refined", "Refined"))} <span data-i18n="tools.building_calc.table.refined">${esc(_t("tools.building_calc.table.refined", "Refined"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("food", _t("tools.building_calc.total.food", "Food"))} <span data-i18n="tools.building_calc.table.food">${esc(_t("tools.building_calc.table.food", "Food"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("wood", _t("tools.building_calc.total.wood", "Wood"))} <span data-i18n="tools.building_calc.table.wood">${esc(_t("tools.building_calc.table.wood", "Wood"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("coal", _t("tools.building_calc.total.coal", "Coal"))} <span data-i18n="tools.building_calc.table.coal">${esc(_t("tools.building_calc.table.coal", "Coal"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("iron", _t("tools.building_calc.total.iron", "Iron"))} <span data-i18n="tools.building_calc.table.iron">${esc(_t("tools.building_calc.table.iron", "Iron"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("time", _t("tools.building_calc.total.time", "Estimated Time"))} <span data-i18n="tools.building_calc.table.est_time">${esc(_t("tools.building_calc.table.est_time", "Est. Time"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("svs", "SVS")} <span data-i18n="tools.building_calc.table.svs">${esc(_t("tools.building_calc.table.svs", "SVS"))}</span></th>
                  </tr>
                </thead>
                <tbody id="fc-summary-tbody">
                  <tr>
                    <td colspan="11" class="muted small" style="padding:12px" data-i18n="tools.building_calc.summary.loading">${esc(_t("tools.building_calc.summary.loading", "Loading building JSON..."))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div class="panel" style="margin-top:12px" id="fc-detail-wrap">
            <h2 class="h2" style="margin:0 0 10px" data-i18n="tools.building_calc.detail.title">${esc(_t("tools.building_calc.detail.title", "Detail (Per Level)"))}</h2>
            <div class="muted small" style="margin:0 0 10px" data-i18n="tools.building_calc.detail.subtitle">${esc(_t("tools.building_calc.detail.subtitle", "Shows rows from JSON between Current → Target."))}</div>
            <div style="overflow:auto">
              <table class="table" style="width:100%;max-width:100%;border-collapse:collapse">
                <thead>
                  <tr class="muted small" style="text-align:left">
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)" data-i18n="tools.building_calc.table.step_level">${esc(_t("tools.building_calc.table.step_level", "Step Level"))}</th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("fireCrystal", _t("tools.building_calc.total.fireCrystal", "Fire Crystal"))} <span data-i18n="tools.building_calc.table.fc">${esc(_t("tools.building_calc.table.fc", "FC"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("refined", _t("tools.building_calc.total.refined", "Refined"))} <span data-i18n="tools.building_calc.table.refined">${esc(_t("tools.building_calc.table.refined", "Refined"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("food", _t("tools.building_calc.total.food", "Food"))} <span data-i18n="tools.building_calc.table.food">${esc(_t("tools.building_calc.table.food", "Food"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("wood", _t("tools.building_calc.total.wood", "Wood"))} <span data-i18n="tools.building_calc.table.wood">${esc(_t("tools.building_calc.table.wood", "Wood"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("coal", _t("tools.building_calc.total.coal", "Coal"))} <span data-i18n="tools.building_calc.table.coal">${esc(_t("tools.building_calc.table.coal", "Coal"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("iron", _t("tools.building_calc.total.iron", "Iron"))} <span data-i18n="tools.building_calc.table.iron">${esc(_t("tools.building_calc.table.iron", "Iron"))}</span></th>
                    <th style="padding:10px;border-bottom:1px solid rgba(255,255,255,.08)">${iconHTML("time", _t("tools.building_calc.detail.base_time", "Base Time"))} <span data-i18n="tools.building_calc.detail.base_time">${esc(_t("tools.building_calc.detail.base_time", "Base Time"))}</span></th>
                  </tr>
                </thead>
                <tbody id="fc-detail-tbody">
                  <tr>
                    <td colspan="8" class="muted small" style="padding:12px" data-i18n="tools.building_calc.detail.placeholder">${esc(_t("tools.building_calc.detail.placeholder", "Select Building / Current / Target."))}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    `;
  }

  function showError(err, meta) {
    const box = document.getElementById("fc-error");
    const pre = document.getElementById("fc-error-pre");
    if (!box || !pre) return;
    box.style.display = "block";
    pre.textContent =
      (err?.message ? err.message : String(err)) +
      (meta ? ("\n\n" + JSON.stringify(meta, null, 2)) : "");
  }

  function hideError() {
    const box = document.getElementById("fc-error");
    if (box) box.style.display = "none";
  }

  function fillSelectOptions(sel, options) {
    if (!sel) return;
    sel.innerHTML = options.map((o) => `<option value="${attr(o.value)}">${esc(o.label)}</option>`).join("");
  }

  function readGlobalState() {
    const buildSpeedPct = num(document.getElementById("fc-buildspeed")?.value);
    const hyenaSel = document.getElementById("fc-hyena");
    const agenesSel = document.getElementById("fc-agenes");
    const valeriaSel = document.getElementById("fc-valeria");
    const btn10 = document.getElementById("fc-vp10");
    const btn15 = document.getElementById("fc-vp15");
    const btnServer = document.getElementById("fc-server");
    const btnChief = document.getElementById("fc-chief");

    const hyenaLv = clampInt(hyenaSel?.value || 0, 0, 5);
    const hyenaPct = hyenaLv;
    const valeriaBonus = getValeriaBonus(valeriaSel);
    const agenesFlatHours = getExpertFlatHours(agenesSel);

    const vpPct = getActiveVP(btn10, btn15);
    const serverBuffActive = isPressed(btnServer);
    const chiefOrderActive = isPressed(btnChief);

    return {
      buildSpeedPct,
      hyenaPct,
      vpPct,
      serverBuffActive,
      chiefOrderActive,
      agenesFlatHours,
      valeriaBonus,
    };
  }

  function renderTotals(totals, _t) {
    const kv = document.getElementById("fc-total-kv");
    if (!kv) return;

    const longScore = Math.floor(totals.score || 0).toLocaleString();
    const shortScore = formatSVS(totals.score || 0);

    const row = (key, labelKey, fallback, value, iconKey) => `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(255,255,255,.06);border-radius:10px;">
        <div style="width:18px;flex:0 0 18px;">${iconHTML(iconKey || key, _t(labelKey, fallback), 18) || ""}</div>
        <div style="flex:1;min-width:0;">
          <div class="muted tiny" style="line-height:1.1" data-i18n="${esc(labelKey)}">${esc(_t(labelKey, fallback))}</div>
          <div style="font-weight:800">${esc(value)}</div>
        </div>
      </div>
    `;

    kv.innerHTML = `
      ${row("fireCrystal", "tools.building_calc.total.fireCrystal", "Fire Crystal", Math.floor(totals.fireCrystal || 0).toLocaleString(), "fireCrystal")}
      ${row("refined", "tools.building_calc.total.refined", "Refined", Math.floor(totals.refined || 0).toLocaleString(), "refined")}
      ${row("food", "tools.building_calc.total.food", "Food", Math.floor(totals.food || 0).toLocaleString(), "food")}
      ${row("wood", "tools.building_calc.total.wood", "Wood", Math.floor(totals.wood || 0).toLocaleString(), "wood")}
      ${row("coal", "tools.building_calc.total.coal", "Coal", Math.floor(totals.coal || 0).toLocaleString(), "coal")}
      ${row("iron", "tools.building_calc.total.iron", "Iron", Math.floor(totals.iron || 0).toLocaleString(), "iron")}
      ${row("time", "tools.building_calc.total.time", "Estimated Time", formatHourToTime(totals.adjHours || 0), "time")}
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px solid rgba(255,255,255,.06);border-radius:10px;">
        <div style="width:18px;flex:0 0 18px;">${iconHTML("svs", "SVS", 18) || ""}</div>
        <div style="flex:1;min-width:0;">
          <div class="muted tiny" style="line-height:1.1" data-i18n="tools.building_calc.total.svs">${esc(_t("tools.building_calc.total.svs", "SVS"))}</div>
          <div style="font-weight:800">${esc(longScore)} <span class="muted small">(${esc(shortScore)})</span></div>
        </div>
      </div>
    `;
  }

  function renderSummaryRow({ title, slug, curLabel, tarLabel, result }, _t) {
    const tb = document.getElementById("fc-summary-tbody");
    if (!tb) return;

    if (!result || !result.valid) {
      tb.innerHTML = `
        <tr>
          <td colspan="11" class="muted small" style="padding:12px" data-i18n="tools.building_calc.msg.invalid_range">${esc(_t("tools.building_calc.msg.invalid_range", "Target must be greater than Current."))}</td>
        </tr>
      `;
      return;
    }

    const sums = result.sums || emptySums();
    const longScore = Math.floor(result.score || 0).toLocaleString();

    const rawTitle = title || slug;
    const displayTitle = _t(`building.${slug}`, rawTitle);

    tb.innerHTML = `
      <tr>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)"><strong>${esc(displayTitle)}</strong> <span class="muted tiny mono">(${esc(slug)})</span></td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(curLabel || "")}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(tarLabel || "")}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${Math.floor(sums.fireCrystal || 0).toLocaleString()}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${Math.floor(sums.refined || 0).toLocaleString()}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(formatKM(sums.food || 0))}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(formatKM(sums.wood || 0))}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(formatKM(sums.coal || 0))}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(formatKM(sums.iron || 0))}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(formatHourToTime(result.adjHours || 0))}</td>
        <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(longScore)}</td>
      </tr>
    `;
  }

  function renderDetailRows(rows, startIdx, endIdx, _t) {
    const tb = document.getElementById("fc-detail-tbody");
    if (!tb) return;

    const s = clampInt(startIdx, 0, Math.max(0, rows.length - 1));
    const e = clampInt(endIdx, 0, Math.max(0, rows.length - 1));

    if (!(s < e)) {
      tb.innerHTML = `
        <tr>
          <td colspan="8" class="muted small" style="padding:12px" data-i18n="tools.building_calc.msg.invalid_range">${esc(_t("tools.building_calc.msg.invalid_range", "Target must be greater than Current."))}</td>
        </tr>
      `;
      return;
    }

    const slice = rows.slice(s + 1, e + 1);
    if (!slice.length) {
      tb.innerHTML = `
        <tr>
          <td colspan="8" class="muted small" style="padding:12px" data-i18n="tools.building_calc.msg.no_rows">${esc(_t("tools.building_calc.msg.no_rows", "No rows."))}</td>
        </tr>
      `;
      return;
    }

    tb.innerHTML = slice.map((r) => {
      const lv = String(r[CSV_COLS.level] ?? "").trim();
      const fc = Math.floor(Number(r[CSV_COLS.fireCrystal]) || 0).toLocaleString();
      const rf = Math.floor(Number(r[CSV_COLS.refined]) || 0).toLocaleString();
      const food = formatKM(Number(r[CSV_COLS.food]) || 0);
      const wood = formatKM(Number(r[CSV_COLS.wood]) || 0);
      const coal = formatKM(Number(r[CSV_COLS.coal]) || 0);
      const iron = formatKM(Number(r[CSV_COLS.iron]) || 0);
      const baseTime = formatHourToTime(Number(r[CSV_COLS.convertHours]) || 0);

      return `
        <tr>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(lv)}</td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(fc)}</td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(rf)}</td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(food)}</td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(wood)}</td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(coal)}</td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(iron)}</td>
          <td style="padding:10px;border-bottom:1px solid rgba(255,255,255,.06)">${esc(baseTime)}</td>
        </tr>
      `;
    }).join("");
  }

  async function initCalculator({ DATA_BASE, appEl, fetchJSONTry, t } = {}) {
    const _t = makeT(t);
    const _app = appEl || document.querySelector("#app") || document.body;

    const BIND_KEY = "__wos_bcalc_bound__";

    renderShell(_app, _t);
    hideError();

    const hyena = document.getElementById("fc-hyena");
    const agenes = document.getElementById("fc-agenes");
    const valeria = document.getElementById("fc-valeria");

    const none = _t("tools.common.none", "None");
    fillSelectOptions(hyena, [
      { value: 0, label: none },
      { value: 1, label: "Lv.1 (+1%)" },
      { value: 2, label: "Lv.2 (+2%)" },
      { value: 3, label: "Lv.3 (+3%)" },
      { value: 4, label: "Lv.4 (+4%)" },
      { value: 5, label: "Lv.5 (+5%)" },
    ]);

    fillSelectOptions(agenes, [
      { value: 0, label: none },
      { value: 1, label: "Lv.1 (-2h)" },
      { value: 2, label: "Lv.2 (-3h)" },
      { value: 3, label: "Lv.3 (-4h)" },
      { value: 4, label: "Lv.4 (-6h)" },
      { value: 5, label: "Lv.5 (-8h)" },
    ]);

    const vOpts = [{ value: 0, label: none }];
    for (let i = 1; i <= 10; i++) vOpts.push({ value: i, label: `Lv.${i} (+${(i * 2)}%)` });
    fillSelectOptions(valeria, vOpts);

    const btn10 = document.getElementById("fc-vp10");
    const btn15 = document.getElementById("fc-vp15");
    const btnServer = document.getElementById("fc-server");
    const btnChief = document.getElementById("fc-chief");

    let recalcAll = () => {};

    function updateVPButtons(clicked) {
      if (!btn10 || !btn15) return;
      if (clicked === btn10) {
        const next = !isPressed(btn10);
        setPressed(btn10, next);
        setPressed(btn15, false);
      } else if (clicked === btn15) {
        const next = !isPressed(btn15);
        setPressed(btn15, next);
        setPressed(btn10, false);
      }
    }

    // ✅ FIX: 중복 바인딩 방지 (여기서 else로 또 붙일 필요 없음)
    if (!_app[BIND_KEY]) {
      _app[BIND_KEY] = true;

      if (btn10) btn10.addEventListener("click", () => { updateVPButtons(btn10); recalcAll(); });
      if (btn15) btn15.addEventListener("click", () => { updateVPButtons(btn15); recalcAll(); });
      if (btnServer) btnServer.addEventListener("click", () => { togglePressed(btnServer); recalcAll(); });
      if (btnChief) btnChief.addEventListener("click", () => { togglePressed(btnChief); recalcAll(); });

      const controls = ["fc-buildspeed", "fc-hyena", "fc-agenes", "fc-valeria"];
      for (const id of controls) {
        const el = document.getElementById(id);
        if (el) el.addEventListener("input", () => recalcAll());
        if (el) el.addEventListener("change", () => recalcAll());
      }
    }

    let base, list, data;
    try {
      const r = await loadBuildingDataFromJSON(DATA_BASE, fetchJSONTry);
      base = r.base;
      list = r.list;
      data = r.data;
    } catch (e) {
      showError(e, { DATA_BASE, hint: "Failed to load local building JSON" });
      return;
    }

    const buildingSel = document.getElementById("fc-building");
    const curSel = document.getElementById("fc-cur");
    const tarSel = document.getElementById("fc-tar");
    if (!buildingSel || !curSel || !tarSel) return;

    const bOpts = list.map((it) => {
      const d = data.get(it.slug);
      const rawTitle = d?.title || it.title || it.slug;
      const label = _t(`building.${it.slug}`, rawTitle);
      return { value: it.slug, label };
    });
    fillSelectOptions(buildingSel, bOpts);

    const prefer = data.has("furnace") ? "furnace" : (list[0]?.slug || "");
    buildingSel.value = prefer;

    function rebuildLevelSelects(slug) {
      const d = data.get(slug);
      const levels = d?.levels?.length ? d.levels : [];
      const opts = levels.map((lv) => ({ value: lv.idx, label: lv.label }));
      fillSelectOptions(curSel, opts);
      fillSelectOptions(tarSel, opts);

      const maxIdx = Math.max(0, (d?.rows?.length || 0) - 1);
      curSel.value = String(0);
      tarSel.value = String(Math.min(1, maxIdx));
    }

    rebuildLevelSelects(buildingSel.value);

    buildingSel.addEventListener("change", () => {
      rebuildLevelSelects(buildingSel.value);
      recalcAll();
    });
    curSel.addEventListener("change", () => recalcAll());
    tarSel.addEventListener("change", () => recalcAll());

    recalcAll = function recalcAllImpl() {
      const g = readGlobalState();

      const slug = String(buildingSel.value || "").trim();
      const d = data.get(slug);

      const totals = emptySums();
      let totalAdjHours = 0;
      let totalScore = 0;

      if (!d || !Array.isArray(d.rows) || !d.rows.length) {
        renderSummaryRow({
          title: d?.title || slug,
          slug,
          curLabel: "",
          tarLabel: "",
          result: { valid: false }
        }, _t);
        renderDetailRows([], 0, 0, _t);
        renderTotals({ ...totals, adjHours: 0, score: 0 }, _t);
        return;
      }

      const startIdx = clampInt(curSel?.value || 0, 0, d.rows.length - 1);
      const endIdx = clampInt(tarSel?.value || 0, 0, d.rows.length - 1);

      const levelsByIdx = new Map((d.levels || []).map((x) => [String(x.idx), x.label]));
      const curLabel = levelsByIdx.get(String(startIdx)) || String(curSel?.selectedOptions?.[0]?.textContent || "");
      const tarLabel = levelsByIdx.get(String(endIdx)) || String(tarSel?.selectedOptions?.[0]?.textContent || "");

      const res = calcSegment(d.rows, startIdx, endIdx, g);

      renderSummaryRow({
        title: d.title || slug,
        slug,
        curLabel,
        tarLabel,
        result: res
      }, _t);

      renderDetailRows(d.rows, startIdx, endIdx, _t);

      if (res.valid) {
        totals.fireCrystal += res.sums.fireCrystal;
        totals.refined += res.sums.refined;
        totals.food += res.sums.food;
        totals.wood += res.sums.wood;
        totals.coal += res.sums.coal;
        totals.iron += res.sums.iron;
        totalAdjHours += res.adjHours;
        totalScore += res.score;
      }

      renderTotals({
        ...totals,
        adjHours: totalAdjHours,
        score: totalScore,
      }, _t);
    };

    recalcAll();
    console.info("[building-calc] ready (LOCAL JSON)", { base, buildId: BUILD_ID, slugs: list.map(x => x.slug) });
  }

  window.WOS_BUILDING_CALC = {
    __buildId: BUILD_ID,
    initCalculator,
    ALLOWED_SLUGS,
    RES_ID,
    CSV_COLS,
    normalizeBuildingRows,
    loadBuildingDataFromJSON,
    filterLevelsWithIndex,
    formatSVS,
    formatKM,
    formatHourToTime,
    getValeriaBonus,
    getExpertFlatHours,
    getActiveVP,
    isPressed,
    getFactorForTime,
    parseToHours,
  };

  try {
    if (window.WOS_CALC && typeof window.WOS_CALC.register === "function") {
      window.WOS_CALC.register("building-calculator", {
        title: "Building Calculator",
        render(root, ctx) {
          initCalculator({
            // ✅ FIX: ctx 없으면 상대경로로 깨질 수 있어 기본값 보정
            DATA_BASE: (ctx && ctx.DATA_BASE) ? ctx.DATA_BASE : "/data/buildings",
            appEl: root,
            fetchJSONTry: ctx?.fetchJSONTry,
            t: ctx?.t,
          });
        }
      });
    }
  } catch (_) {}

  console.info("[building-calc] loaded", { buildId: BUILD_ID });
})();

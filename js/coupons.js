/* =========================================================
   WosHub - js/coupons.js  (FULL / STANDALONE + SPA) ✅ FINAL (app.js 호환 최적화)
   - Works in 3 modes:

   (A) Standalone coupon pages (index.en.html / index.ko.html / index.ja.html)
       - Put: <div id="couponGrid" data-coupon-grid="1"></div>
       - Optional: #lastUpdated, filter chips (.chip[data-filter])
       - Script tag can pass:
         <script defer src="/js/coupons.js"
                 data-locale="ko"
                 data-json="/coupons/coupons.json"
                 data-max="999"
                 data-footer="0"></script>

   (B) SPA (#/coupons) via app.js
       - app.js calls: window.WOS_COUPONS.renderPage({ appEl, locale, jsonUrl, ... })
       - app.js template mode calls: window.WOS_COUPONS.renderList({ appEl, locale, jsonUrl, ... })
       - app.js optional lastUpdated:
           - prefers window.WOS_COUPONS._fetchCoupons(jsonUrl)

   (C) Home/footer strip injection (optional)
       - injects #wosFooterCoupons unless disabled: data-footer="0"

   JSON format accepted:
     - Array: [ { code, expires, ... }, ... ]
     - Object: { updatedAt, items:[...]} OR { lastUpdated, coupons:[...] } OR { updated, items:[...] }

   Expiry rule:
     - If expires is "YYYY-MM-DD": expires at UTC 00:00 of that date.
       (now >= that instant => expired)
     - If expires is full ISO datetime: Date(expires) used as-is.
   ========================================================= */

(() => {
  "use strict";

  // -------------------------
  // Helpers
  // -------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function pickLang(input) {
    const v = String(input || "").toLowerCase();
    return v === "ko" || v === "en" || v === "ja" ? v : "en";
  }

  function uniq(arr) {
    const out = [];
    const seen = new Set();
    for (const x of arr || []) {
      const v = String(x || "").trim();
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }

  function safeToAbs(url) {
    // keep absolute/protocol-relative/relative as-is (caller provides proper path)
    const u = String(url || "").trim();
    return u || "";
  }

  function findCouponsScriptTag() {
    // In SPA route changes, currentScript can be null.
    // We'll pick last script that includes "coupons.js".
    const cur = document.currentScript;
    if (cur && String(cur.src || "").includes("coupons.js")) return cur;
    const hits = $$("script[src]").filter((s) => String(s.src || "").includes("coupons.js"));
    return hits.length ? hits[hits.length - 1] : null;
  }

  function getScriptConfig() {
    const cur = findCouponsScriptTag();

    const htmlLang = pickLang(document.documentElement.getAttribute("lang"));
    const dataLocale = cur ? pickLang(cur.getAttribute("data-locale")) : "";
    const locale = pickLang(dataLocale || htmlLang || "en");

    // ✅ FIX: 올바른 attribute에서 json 경로 읽기
    const json =
      (cur && (cur.getAttribute("data-json") || cur.getAttribute("data-coupons-json"))) ||
      "/coupons/coupons.json";

    const max = Number(cur && cur.getAttribute("data-max"));
    const maxNum = Number.isFinite(max) && max > 0 ? Math.floor(max) : 999;

    const footer = (cur && cur.getAttribute("data-footer")) || "1";
    const footerOn = footer !== "0" && footer !== "false";

    return { cur, locale, json, max: maxNum, footerOn };
  }

  function normalizeList(payload) {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.items)) return payload.items;
    if (payload && Array.isArray(payload.coupons)) return payload.coupons;
    if (payload && Array.isArray(payload.data)) return payload.data;
    return [];
  }

  function getUpdatedAt(payload) {
    const v =
      payload?.updatedAt ||
      payload?.lastUpdated ||
      payload?.updated || // ✅ supports your {updated, items}
      payload?.time ||
      payload?.date ||
      "";
    return String(v || "");
  }

  function fmtUpdatedAt(s) {
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return String(s).replace("T", " ").slice(0, 16);
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${yy}-${mm}-${dd} ${hh}:${mi}`;
    }
    return String(s);
  }

  function parseExpiresToMs(expires) {
    if (!expires) return null;
    const s = String(expires).trim();
    if (!s) return null;

    // date-only => UTC 00:00
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split("-").map((x) => Number(x));
      if (!y || !m || !d) return null;
      return Date.UTC(y, m - 1, d, 0, 0, 0, 0);
    }

    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) return dt.getTime();
    return null;
  }

  function isExpired(expiresMs, nowMs = Date.now()) {
    if (expiresMs == null) return false;
    return nowMs >= expiresMs;
  }

  function getText(locale, key) {
    const dict = {
      en: {
        coupons: "Coupons",
        copy: "Copy",
        copied: "Copied",
        redeem: "Redeem",
        active: "Active",
        expired: "Expired",
        permanent: "Permanent",
        expires: "Expires",
        lastUpdated: "Last updated",
        filterAll: "All",
        filterActive: "Active",
        filterExpired: "Expired",
        openCoupons: "Open coupons",
        noCoupons: "No coupons found.",
        hint: "Expiry 기준: UTC 00:00 · Copy 후 공식 포털에 입력하세요.",
        failed: "Failed to load coupons.json",
        tried: "Tried URLs",
      },
      ko: {
        coupons: "쿠폰",
        copy: "복사",
        copied: "복사됨",
        redeem: "입력",
        active: "사용 가능",
        expired: "만료됨",
        permanent: "무기한",
        expires: "만료",
        lastUpdated: "마지막 업데이트",
        filterAll: "전체",
        filterActive: "사용 가능",
        filterExpired: "만료됨",
        openCoupons: "쿠폰 보기",
        noCoupons: "쿠폰 데이터가 없습니다.",
        hint: "만료 기준: UTC 00:00 · 코드 복사 후 공식 포털에 입력하세요.",
        failed: "coupons.json 로드 실패",
        tried: "시도한 URL",
      },
      ja: {
        coupons: "クーポン",
        copy: "コピー",
        copied: "コピー済み",
        redeem: "入力",
        active: "有効",
        expired: "期限切れ",
        permanent: "無期限",
        expires: "期限",
        lastUpdated: "最終更新",
        filterAll: "すべて",
        filterActive: "有効",
        filterExpired: "期限切れ",
        openCoupons: "クーポンを見る",
        noCoupons: "クーポンが見つかりません。",
        hint: "期限基準: UTC 00:00 · コピーして公式ポータルで入力してください。",
        failed: "coupons.json の読み込みに失敗しました",
        tried: "試行したURL",
      },
    };
    const l = pickLang(locale);
    return dict[l]?.[key] ?? dict.en[key] ?? String(key);
  }

  function normalizeCoupon(raw) {
    const code = String(raw?.code ?? raw?.coupon ?? raw?.key ?? "").trim();
    if (!code) return null;

    const title = raw?.title ?? raw?.name ?? raw?.label ?? "";
    const note = raw?.note ?? raw?.desc ?? raw?.description ?? "";
    const region = raw?.region ?? raw?.server ?? raw?.scope ?? "";
    const reward = raw?.reward ?? raw?.rewards ?? raw?.items ?? "";
    const expires = raw?.expires ?? raw?.expiry ?? raw?.expire ?? raw?.end ?? raw?.until ?? null;

    const expiresMs = parseExpiresToMs(expires);
    const permanent = expiresMs == null;

    return {
      code,
      title: String(title || ""),
      note: String(note || ""),
      region: String(region || ""),
      reward: typeof reward === "string" ? reward : (Array.isArray(reward) ? reward.join(", ") : ""),
      expiresRaw: expires ? String(expires) : "",
      expiresMs,
      permanent,
      _raw: raw,
    };
  }

  // -------------------------
  // Robust fetch (tries many URLs)
  // -------------------------
  function buildJsonCandidates(inputUrl) {
    const cfg = getScriptConfig();
    const base = safeToAbs(inputUrl || cfg.json || "/coupons/coupons.json");

    // ✅ 중복 제거 + 구조 유지
    return uniq([
      base,
      "/coupons/coupons.json",
      "coupons/coupons.json",
      "/coupons.json",
      "coupons.json",
      "/page/data/coupons.json",
      "page/data/coupons.json",
    ]);
  }

  async function fetchCouponsAny(urlOrUrls) {
    const urls = Array.isArray(urlOrUrls) ? urlOrUrls : buildJsonCandidates(urlOrUrls);
    let lastErr = null;
    const attempted = [];

    for (const u of uniq(urls)) {
      attempted.push(u);
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const payload = await res.json();
        const list = normalizeList(payload).map(normalizeCoupon).filter(Boolean);
        const updatedAt = fmtUpdatedAt(getUpdatedAt(payload));
        return { list, updatedAt, payload, usedUrl: u, attempted };
      } catch (e) {
        lastErr = new Error(`coupons.json fetch failed: ${u} (${e.message})`);
      }
    }

    if (lastErr) lastErr.attempted = attempted;
    throw lastErr || new Error("coupons.json fetch failed");
  }

  function stableSortCoupons(list) {
    const now = Date.now();
    return (list || []).slice().sort((a, b) => {
      const aExp = isExpired(a.expiresMs, now);
      const bExp = isExpired(b.expiresMs, now);
      if (aExp !== bExp) return aExp ? 1 : -1;

      if (a.permanent !== b.permanent) return a.permanent ? 1 : -1;

      const ax = a.expiresMs == null ? Number.POSITIVE_INFINITY : a.expiresMs;
      const bx = b.expiresMs == null ? Number.POSITIVE_INFINITY : b.expiresMs;
      if (ax !== bx) return ax - bx;

      return a.code.localeCompare(b.code);
    });
  }

  function formatExpiryLine(c, locale) {
    if (c.permanent) return getText(locale, "permanent");

    const s = String(c.expiresRaw || "");
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      return `${getText(locale, "expires")}: ${s} (UTC 00:00)`;
    }

    const d = new Date(c.expiresMs);
    if (!Number.isNaN(d.getTime())) {
      const yy = d.getUTCFullYear();
      const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
      const dd = String(d.getUTCDate()).padStart(2, "0");
      const hh = String(d.getUTCHours()).padStart(2, "0");
      const mi = String(d.getUTCMinutes()).padStart(2, "0");
      return `${getText(locale, "expires")}: ${yy}-${mm}-${dd} ${hh}:${mi} UTC`;
    }
    return `${getText(locale, "expires")}: ${esc(s)}`;
  }

  async function copyToClipboard(text) {
    const tx = String(text || "");
    if (!tx) return false;

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(tx);
        return true;
      }
    } catch (_) {}

    try {
      const ta = document.createElement("textarea");
      ta.value = tx;
      ta.setAttribute("readonly", "");
      ta.style.position = "fixed";
      ta.style.left = "-9999px";
      ta.style.top = "-9999px";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      return !!ok;
    } catch (_) {
      return false;
    }
  }

  // -------------------------
  // Render: Grid
  // -------------------------
  function renderCouponCards(root, coupons, locale, opts = {}) {
    const now = Date.now();
    const redeemUrl = opts.redeemUrl || "https://wos-giftcode.centurygame.com/";

    const max = Number.isFinite(opts.max) && opts.max > 0 ? Math.floor(opts.max) : 999;
    const sliced = (coupons || []).slice(0, Math.min(max, (coupons || []).length));

    if (!sliced.length) {
      root.innerHTML = `<div class="muted" style="padding:10px 2px;">${esc(getText(locale, "noCoupons"))}</div>`;
      return;
    }

    const useStandaloneClasses =
      root.classList.contains("grid") || root.getAttribute("data-coupon-grid") === "1";

    if (useStandaloneClasses) {
      root.innerHTML = sliced.map((c) => {
        const exp = isExpired(c.expiresMs, now);
        const badgeClass = exp ? "badge expired" : "badge active";
        const wrapClass = exp ? "card expired" : "card";
        const expiryLine = formatExpiryLine(c, locale);

        const metaBits = [];
        if (c.reward) metaBits.push(c.reward);
        if (c.region) metaBits.push(c.region);
        if (c.note) metaBits.push(c.note);

        return `
          <article class="${wrapClass}" data-coupon-card="1" data-expired="${exp ? "1" : "0"}">
            <div style="display:flex;align-items:center;justify-content:space-between;gap:10px;">
              <div class="code">${esc(c.code)}</div>
              <span class="${badgeClass}">
                ${esc(exp ? getText(locale, "expired") : getText(locale, "active"))}
              </span>
            </div>

            <div class="meta">
              ${esc(expiryLine)}
              ${metaBits.length ? `<div style="margin-top:6px;">${esc(metaBits.join(" · "))}</div>` : ""}
            </div>

            <div class="actions">
              <button class="btn" type="button" data-copy="${esc(c.code)}">${esc(getText(locale, "copy"))}</button>
              <a class="btn primary" href="${esc(redeemUrl)}" target="_blank" rel="noopener">${esc(getText(locale, "redeem"))}</a>
            </div>
          </article>
        `;
      }).join("");
      return;
    }

    // SPA style
    root.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
        ${sliced.map((c) => {
          const exp = isExpired(c.expiresMs, now);
          const badge = exp ? getText(locale, "expired") : getText(locale, "active");
          const expiryLine = formatExpiryLine(c, locale);

          const metaBits = [];
          metaBits.push(expiryLine);
          if (c.reward) metaBits.push(c.reward);
          if (c.region) metaBits.push(c.region);

          return `
            <div class="wos-panel" data-coupon-card="1" data-expired="${exp ? "1" : "0"}" style="padding:12px;">
              <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                <div style="font-weight:900; letter-spacing:.3px;" class="wos-mono">${esc(c.code)}</div>
                <div class="wos-badge">${esc(badge)}</div>
              </div>
              <div class="wos-muted" style="margin-top:8px; font-size:13px; line-height:1.55;">
                ${esc(metaBits.filter(Boolean).join(" · "))}
                ${c.note ? `<div style="margin-top:6px;">${esc(c.note)}</div>` : ""}
              </div>
              <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:10px;">
                <button class="wos-btn" type="button" data-copy="${esc(c.code)}">${esc(getText(locale, "copy"))}</button>
                <a class="wos-btn" href="${esc(redeemUrl)}" target="_blank" rel="noopener">${esc(getText(locale, "redeem"))}</a>
              </div>
            </div>
          `;
        }).join("")}
      </div>
    `;
  }

  // -------------------------
  // Events (guarded)
  // -------------------------
  function bindCopyButtons(root, locale) {
    if (!root || root.__wosCouponsCopyBound) return;
    root.__wosCouponsCopyBound = true;

    root.addEventListener("click", async (e) => {
      const btn = e.target && e.target.closest && e.target.closest("[data-copy]");
      if (!btn) return;

      const code = btn.getAttribute("data-copy") || "";
      const ok = await copyToClipboard(code);

      const old = btn.textContent;
      btn.textContent = ok ? getText(locale, "copied") : old;
      btn.setAttribute("disabled", "disabled");

      setTimeout(() => {
        btn.textContent = old;
        btn.removeAttribute("disabled");
      }, 900);
    });
  }

  function bindFilterChips(rootContainer, gridEl) {
    if (!rootContainer || !gridEl) return;
    if (rootContainer.__wosCouponsFilterBound) return;
    rootContainer.__wosCouponsFilterBound = true;

    const chips = $$(".chip[data-filter]", rootContainer);
    if (!chips.length) return;

    const setPressed = (activeFilter) => {
      chips.forEach((c) =>
        c.setAttribute(
          "aria-pressed",
          c.getAttribute("data-filter") === activeFilter ? "true" : "false"
        )
      );
    };

    const applyFilter = (filter) => {
      const cards = $$("[data-coupon-card='1']", gridEl);
      cards.forEach((card) => {
        const expired = card.getAttribute("data-expired") === "1";
        const show =
          filter === "all" ||
          (filter === "active" && !expired) ||
          (filter === "expired" && expired);
        card.style.display = show ? "" : "none";
      });
      setPressed(filter);
    };

    chips.forEach((chip) => {
      chip.addEventListener("click", () => {
        const f = chip.getAttribute("data-filter") || "all";
        applyFilter(f);
      });
    });

    applyFilter("all");
  }

  // -------------------------
  // Footer strip
  // -------------------------
  function ensureFooterSlot() {
    const footer = $("footer.site-footer") || $("footer") || null;
    if (!footer) return null;

    let slot = $("#wosFooterCoupons", footer);
    if (slot) return slot;

    slot = document.createElement("div");
    slot.id = "wosFooterCoupons";
    slot.style.marginTop = "10px";
    slot.style.width = "100%";
    footer.appendChild(slot);
    return slot;
  }

  function renderFooterStrip(slot, coupons, locale, opts = {}) {
    const max = Number.isFinite(opts.max) && opts.max > 0 ? Math.floor(opts.max) : 3;
    const now = Date.now();

    const top = stableSortCoupons(coupons)
      .filter((c) => !isExpired(c.expiresMs, now))
      .slice(0, max);

    if (!top.length) {
      slot.innerHTML = "";
      return;
    }

    const title = getText(locale, "coupons");
    const openLabel = getText(locale, "openCoupons");

    slot.innerHTML = `
      <div style="margin-top:10px; border-top:1px solid rgba(15,23,42,.10); padding-top:10px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap;">
          <div style="font-weight:900; font-size:13px;">${esc(title)}</div>
          <a href="#/coupons" data-link style="font-weight:800; font-size:12px; text-decoration:none; color:#1d4ed8;">
            ${esc(openLabel)} →
          </a>
        </div>

        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:8px;">
          ${top.map((c) => `
            <button type="button"
              data-copy="${esc(c.code)}"
              style="padding:7px 10px; border-radius:999px; border:1px solid rgba(15,23,42,.10); background:#fff; cursor:pointer; font-weight:900; font-size:12px;"
              title="${esc(getText(locale, "copy"))}">
              ${esc(c.code)}
            </button>
          `).join("")}
        </div>
      </div>
    `;
  }

  // -------------------------
  // Public API (for app.js)
  // -------------------------
  function resolveLocale(argsLocale) {
    const cfg = getScriptConfig();
    const htmlLang = pickLang(document.documentElement.getAttribute("lang"));
    return pickLang(argsLocale || cfg.locale || htmlLang || "en");
  }

  function resolveJsonUrl(args = {}) {
    const cfg = getScriptConfig();
    return (
      args.jsonUrl ||
      args.dataUrl ||
      args.dataCouponsJson ||
      args.couponsJson ||
      cfg.json ||
      "/coupons/coupons.json"
    );
  }

  async function renderPage(args = {}) {
    const appEl = args.appEl || null;
    if (!appEl) return;

    const locale = resolveLocale(args.locale);
    const jsonUrl = resolveJsonUrl(args);
    const max = Number.isFinite(args.max) ? args.max : 999;
    const focusSlug = String(args.focusSlug || "");

    // skeleton
    appEl.innerHTML = `
      <div class="wos-panel">
        <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <h2 style="margin:0 0 6px; font-size:20px; letter-spacing:-.2px;">${esc(getText(locale, "coupons"))}</h2>
            <div class="wos-muted" style="font-size:13px; line-height:1.55;">
              ${esc(getText(locale, "hint"))}
            </div>
          </div>
          <div class="wos-muted" style="font-size:12px;">
            ${esc(getText(locale, "lastUpdated"))}: <span id="lastUpdated">—</span>
          </div>
        </div>

        <div class="toolbar" style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div class="chips" role="group" aria-label="filter" style="display:flex; gap:8px; flex-wrap:wrap;">
            <button class="chip" type="button" data-filter="all" aria-pressed="true">${esc(getText(locale, "filterAll"))}</button>
            <button class="chip" type="button" data-filter="active" aria-pressed="false">${esc(getText(locale, "filterActive"))}</button>
            <button class="chip" type="button" data-filter="expired" aria-pressed="false">${esc(getText(locale, "filterExpired"))}</button>
          </div>
          <a class="wos-btn" href="https://wos-giftcode.centurygame.com/" target="_blank" rel="noopener">${esc(getText(locale, "redeem"))}</a>
        </div>

        <div id="couponGrid" style="margin-top:12px;"></div>
        <div id="couponDebug" class="wos-muted" style="margin-top:10px; font-size:12px; display:none;"></div>
      </div>
    `;

    const grid = $("#couponGrid", appEl);
    const debug = $("#couponDebug", appEl);

    bindCopyButtons(appEl, locale);

    try {
      const { list, updatedAt, usedUrl } = await fetchCouponsAny(jsonUrl);
      const sorted = stableSortCoupons(list);

      const lastUpdatedEl = $("#lastUpdated", appEl);
      if (lastUpdatedEl) lastUpdatedEl.textContent = updatedAt || "—";

      renderCouponCards(grid, sorted, locale, { max });
      bindFilterChips(appEl, grid);

      // debug info (hidden by default)
      if (debug) {
        debug.style.display = "";
        debug.innerHTML = `<div>json: <code>${esc(usedUrl || "")}</code></div>`;
      }

      // optional focus: scroll to code
      if (focusSlug) {
        const target = $$("[data-coupon-card='1']", grid).find((el) => {
          const btn = el.querySelector("[data-copy]");
          return btn && String(btn.getAttribute("data-copy") || "").toLowerCase() === focusSlug.toLowerCase();
        });
        if (target && typeof target.scrollIntoView === "function") {
          try { target.scrollIntoView({ behavior: "smooth", block: "start" }); } catch (_) { target.scrollIntoView(); }
        }
      }
    } catch (err) {
      console.error(err);
      const attempted = Array.isArray(err?.attempted) ? err.attempted : buildJsonCandidates(jsonUrl);

      if (grid) {
        grid.innerHTML = `
          <div class="wos-muted" style="padding:10px 2px;">
            ${esc(getText(locale, "failed"))}<br>
            <span style="font-size:12px;">${esc(String(err?.message || err))}</span>
          </div>
          <div class="wos-panel" style="margin-top:10px; padding:10px;">
            <div class="wos-muted" style="font-weight:900; margin-bottom:6px;">${esc(getText(locale, "tried"))}</div>
            <div class="wos-mono" style="font-size:12px;">
              ${attempted.map((u) => `<div><code>${esc(u)}</code></div>`).join("")}
            </div>
          </div>
        `;
      }
    }
  }

  async function renderList(args = {}) {
    const appEl = args.appEl || null;
    if (!appEl) return;

    const locale = resolveLocale(args.locale);
    const jsonUrl = resolveJsonUrl(args);
    const max = Number.isFinite(args.max) ? args.max : 999;

    bindCopyButtons(appEl, locale);

    try {
      const { list } = await fetchCouponsAny(jsonUrl);
      const sorted = stableSortCoupons(list);
      renderCouponCards(appEl, sorted, locale, { max });
    } catch (err) {
      console.error(err);
      const attempted = Array.isArray(err?.attempted) ? err.attempted : buildJsonCandidates(jsonUrl);
      appEl.innerHTML = `
        <div class="muted" style="padding:10px 2px;">
          ${esc(getText(locale, "failed"))}
        </div>
        <div class="muted" style="font-size:12px;">
          ${attempted.map((u) => `<div><code>${esc(u)}</code></div>`).join("")}
        </div>
      `;
    }
  }

  async function renderFooter(args = {}) {
    const locale = resolveLocale(args.locale);
    const jsonUrl = resolveJsonUrl(args);
    const max = Number.isFinite(args.max) ? args.max : 3;

    const slot = args.rootEl || ensureFooterSlot();
    if (!slot) return;

    bindCopyButtons(slot, locale);

    try {
      const { list } = await fetchCouponsAny(jsonUrl);
      renderFooterStrip(slot, list, locale, { max });
    } catch (_) {
      // silent in footer
    }
  }

  // -------------------------
  // Auto init (standalone pages + footer)
  // -------------------------
  async function autoInit() {
    const cfg = getScriptConfig();
    const locale = cfg.locale;

    // Standalone page hook
    const grid = $("#couponGrid") || $("[data-coupon-grid='1']");
    const lastUpdated = $("#lastUpdated");

    if (grid) {
      bindCopyButtons(document, locale);

      try {
        const { list, updatedAt } = await fetchCouponsAny(cfg.json);
        const sorted = stableSortCoupons(list);

        if (lastUpdated) lastUpdated.textContent = updatedAt || "—";

        renderCouponCards(grid, sorted, locale, { max: cfg.max });
        bindFilterChips(document, grid);
      } catch (err) {
        console.error(err);
        const attempted = Array.isArray(err?.attempted) ? err.attempted : buildJsonCandidates(cfg.json);
        grid.innerHTML = `
          <div class="muted" style="padding:10px 2px;">
            ${esc(getText(locale, "failed"))}
          </div>
          <div class="muted" style="font-size:12px;">
            ${attempted.map((u) => `<div><code>${esc(u)}</code></div>`).join("")}
          </div>
        `;
      }
    }

    // Footer strip (optional)
    if (cfg.footerOn) {
      const slot = ensureFooterSlot();
      if (slot && !slot.__wosCouponsFooterBound) {
        slot.__wosCouponsFooterBound = true;
        await renderFooter({ rootEl: slot, locale, jsonUrl: cfg.json, max: 3 });
      }
    }
  }

  // -------------------------
  // Export (app.js 호환)
  // -------------------------
  window.WOS_COUPONS = {
    // Preferred for app.js
    renderPage,

    // Template mode / fallback
    renderList,

    // Footer helper
    renderFooter,

    // ✅ app.js가 lastUpdated를 위해 호출하는 이름 호환
    _fetchCoupons: fetchCouponsAny,

    // Debug / utilities
    _fetchCouponsAny: fetchCouponsAny,
    _normalizeCoupon: normalizeCoupon,
    _stableSort: stableSortCoupons,
    _buildJsonCandidates: buildJsonCandidates,
    _getScriptConfig: getScriptConfig,
  };

  // Run
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit, { once: true });
  } else {
    autoInit().catch(() => {});
  }
})();

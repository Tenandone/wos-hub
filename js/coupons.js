/* js/coupons.js (IIFE) — FINAL (NO-HASH SPA + Standalone safe) */
(() => {
  "use strict";

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

  function pickLang(v) {
    const s = String(v || "").toLowerCase();
    return s === "ko" || s === "ja" || s === "en" ? s : "en";
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

  // ✅ NO-HASH: History Router path builder
  function routeHref(path) {
    let p = String(path ?? "");
    if (!p.startsWith("/")) p = "/" + p;
    return p;
  }

  function safeDecode(s) {
    try {
      return decodeURIComponent(String(s ?? ""));
    } catch (_) {
      return String(s ?? "");
    }
  }

  function t(key, vars) {
    try {
      if (window.WOS_I18N && typeof window.WOS_I18N.t === "function") {
        return window.WOS_I18N.t(key, vars);
      }
    } catch (_) {}
    return String(key || "");
  }

  function tOpt(key, fallback = "") {
    const k = String(key || "");
    const v = String(t(k) ?? "");
    if (!k) return String(fallback ?? "");
    if (!v || v === k) return String(fallback ?? "");
    return v;
  }

  function applyI18n(root = document) {
    try {
      if (window.WOS_I18N && typeof window.WOS_I18N.apply === "function") {
        window.WOS_I18N.apply(root);
      }
    } catch (_) {}
  }

  function setDocTitle(pageTitle = "") {
    const site = "WosHub";
    const tx = String(pageTitle || "").trim();
    document.title = tx ? `${tx} · ${site}` : site;
  }

  function fmtDateLike(v) {
    if (!v) return "";
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 16).replace("T", " ");
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const yy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, "0");
      const dd = String(d.getDate()).padStart(2, "0");
      const hh = String(d.getHours()).padStart(2, "0");
      const mi = String(d.getMinutes()).padStart(2, "0");
      return `${yy}-${mm}-${dd} ${hh}:${mi}`;
    }
    return s;
  }

  async function fetchTextTryWithAttempts(urls) {
    const attempted = [];
    let lastErr = null;

    for (const u of urls) {
      attempted.push(u);
      try {
        const res = await fetch(u, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        return { text, usedUrl: u, attempted };
      } catch (e) {
        lastErr = new Error(`Fetch failed: ${u} (${e.message})`);
      }
    }

    if (lastErr) lastErr.attempted = attempted;
    throw lastErr || new Error("Fetch failed");
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
      payload?.updatedAt ??
      payload?.lastUpdated ??
      payload?.updated ??
      payload?.time ??
      payload?.date ??
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
    const v = dict[l]?.[key] ?? dict.en[key] ?? String(key);

    if (key === "coupons") return tOpt("nav.coupons", v);
    if (key === "copy") return tOpt("coupons.copy", v);
    if (key === "copied") return tOpt("coupons.copied", v);
    if (key === "active") return tOpt("coupons.active", v);
    if (key === "expired") return tOpt("coupons.expired", v);
    if (key === "lastUpdated") return tOpt("coupons.updated", v);
    if (key === "noCoupons") return tOpt("coupons.empty", v);
    return v;
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
      reward: typeof reward === "string" ? reward : Array.isArray(reward) ? reward.join(", ") : "",
      expiresRaw: expires ? String(expires) : "",
      expiresMs,
      permanent,
      _raw: raw,
    };
  }

  function buildJsonCandidates(inputUrl) {
    const base = String(inputUrl || "/coupons/coupons.json").trim() || "/coupons/coupons.json";
    return uniq([
      base,
      "/coupons/coupons.json",
      "coupons/coupons.json",
      "/coupons.json",
      "coupons.json",
      "/page/data/coupons.json",
      "page/data/coupons.json",
      "/data/coupons.json",
      "data/coupons.json",
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

  function renderCouponCards(root, coupons, locale, opts = {}) {
    const now = Date.now();
    const redeemUrl = opts.redeemUrl || "https://wos-giftcode.centurygame.com/";
    const max = Number.isFinite(opts.max) && opts.max > 0 ? Math.floor(opts.max) : 999;
    const sliced = (coupons || []).slice(0, Math.min(max, (coupons || []).length));

    if (!sliced.length) {
      root.innerHTML = `<div class="muted" style="padding:10px 2px;">${esc(
        getText(locale, "noCoupons")
      )}</div>`;
      return;
    }

    const useStandaloneClasses =
      root.classList.contains("grid") || root.getAttribute("data-coupon-grid") === "1";

    if (useStandaloneClasses) {
      root.innerHTML = sliced
        .map((c) => {
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
              <button class="btn" type="button" data-copy="${esc(c.code)}">${esc(
            getText(locale, "copy")
          )}</button>
              <a class="btn primary" href="${esc(redeemUrl)}" target="_blank" rel="noopener">${esc(
            getText(locale, "redeem")
          )}</a>
            </div>
          </article>
        `;
        })
        .join("");
      return;
    }

    root.innerHTML = `
      <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
        ${sliced
          .map((c) => {
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
                <button class="wos-btn" type="button" data-copy="${esc(c.code)}">${esc(
              getText(locale, "copy")
            )}</button>
                <a class="wos-btn" href="${esc(redeemUrl)}" target="_blank" rel="noopener">${esc(
              getText(locale, "redeem")
            )}</a>
              </div>
            </div>
          `;
          })
          .join("")}
      </div>
    `;
  }

  function bindCopyButtons(root, locale) {
    if (!root || root.__wosCouponsCopyBound) return;
    root.__wosCouponsCopyBound = true;

    root.addEventListener("click", async (e) => {
      const btn = e.target && e.target.closest && e.target.closest("[data-copy]");
      if (!btn) return;

      const code = btn.getAttribute("data-copy") || "";
      const ok = await copyToClipboard(code);

      const old = btn.textContent;
      if (ok) btn.textContent = getText(locale, "copied");
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
      chips.forEach((c) => {
        const f = c.getAttribute("data-filter") || "";
        c.setAttribute("aria-pressed", f === activeFilter ? "true" : "false");
      });
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

  function focusCouponCard(gridEl, focusSlug) {
    if (!gridEl || !focusSlug) return;
    const slug = String(focusSlug || "").toLowerCase().trim();
    if (!slug) return;

    const cards = $$("[data-coupon-card='1']", gridEl);
    const target = cards.find((el) => {
      const btn = el.querySelector("[data-copy]");
      const code = btn ? String(btn.getAttribute("data-copy") || "") : "";
      return code.toLowerCase() === slug;
    });

    if (target && typeof target.scrollIntoView === "function") {
      try {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch (_) {
        target.scrollIntoView();
      }
    }
  }

  // ✅ SPA에서 템플릿을 주입했을 때 내부 링크는 data-link 달아주기
  function markSpaLinks(root) {
    try {
      const links = $$('a[href^="/"]', root);
      links.forEach((a) => {
        const href = a.getAttribute("href") || "";
        const target = (a.getAttribute("target") || "").toLowerCase();
        if (!href.startsWith("/")) return;
        if (target === "_blank") return; // 외부 새창은 유지
        if (!a.hasAttribute("data-link")) a.setAttribute("data-link", "");
      });
    } catch (_) {}
  }

  // ✅ 3개 언어 템플릿 → 1개 템플릿로 통일
  async function loadCouponsTemplateInto(container, lang) {
    const _l = pickLang(lang); // (미사용이지만 시그니처 유지)
    const candidates = [
      "/coupons/index.html",
      "/coupons/",
      "coupons/index.html",
      "coupons/",
      "/page/coupons/index.html",
      "page/coupons/index.html",
    ];

    const r = await fetchTextTryWithAttempts(candidates);

    const doc = new DOMParser().parseFromString(r.text || "", "text/html");
    const root = doc.querySelector("#couponPage") || doc.querySelector("main") || doc.body;

    try {
      root.querySelectorAll("script").forEach((s) => s.remove());
    } catch (_) {}

    container.innerHTML = root ? root.innerHTML : r.text || "";
    markSpaLinks(container); // ✅ SPA friendly
    return { usedUrl: r.usedUrl, attempted: r.attempted };
  }

  function getCouponKeyRaw(it) {
    return String(it?.code ?? it?.coupon ?? it?.slug ?? it?.id ?? it?.key ?? it?.name ?? "").trim();
  }

  function isCouponExpiredRaw(it) {
    const raw =
      it?.expiresAt ??
      it?.expireAt ??
      it?.expiredAt ??
      it?.endAt ??
      it?.endDate ??
      it?.expiry ??
      it?.expires ??
      it?.until;

    if (!raw) return false;

    const d = new Date(String(raw));
    if (Number.isNaN(d.getTime())) {
      const n = Number(raw);
      if (Number.isFinite(n)) return n < Date.now();
      return false;
    }
    return d.getTime() < Date.now();
  }

  function renderCouponPreviewCard(view, coupon, { slug, updatedAt, pageTitle, locale }) {
    const code = getCouponKeyRaw(coupon) || slug || "";
    const expired = isCouponExpiredRaw(coupon);

    const title =
      String(coupon?.title ?? coupon?.name ?? coupon?.label ?? "") ||
      code ||
      (tOpt("nav.coupons", getText(locale, "coupons")) || getText(locale, "coupons"));

    const desc = coupon?.descriptionHtml ?? coupon?.descHtml ?? coupon?.html ?? "";
    const descText = !desc ? String(coupon?.description ?? coupon?.desc ?? coupon?.note ?? coupon?.notes ?? "") : "";

    const reward = String(coupon?.reward ?? coupon?.benefit ?? coupon?.value ?? coupon?.bonus ?? "");
    const start = String(coupon?.startAt ?? coupon?.startDate ?? coupon?.startsAt ?? coupon?.from ?? "");
    const end = String(coupon?.expiresAt ?? coupon?.expireAt ?? coupon?.endAt ?? coupon?.endDate ?? coupon?.until ?? "");

    const statusLabel = expired ? tOpt("coupons.expired", getText(locale, "expired")) : tOpt("coupons.active", getText(locale, "active"));

    view.innerHTML = `
      <div class="wos-panel">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div style="min-width:220px;">
            <div class="wos-muted" style="font-size:12px; margin-bottom:6px;">
              <a class="wos-a" href="${routeHref("/coupons")}" data-link>← ${esc(tOpt("common.back", "Back"))}</a>
            </div>
            <h2 style="margin:0; font-size:20px; letter-spacing:-.2px;">${esc(title)}</h2>
            <div class="wos-muted" style="font-size:13px; margin-top:6px;">
              <span class="wos-badge" style="${expired ? "opacity:.7" : ""}">${esc(statusLabel)}</span>
              ${reward ? ` <span class="wos-muted">· ${esc(reward)}</span>` : ""}
            </div>
          </div>

          <div style="display:flex; gap:8px; align-items:center;">
            <button class="wos-btn" type="button" id="couponCopyBtn" data-copy="${esc(code)}">
              ${esc(tOpt("coupons.copy", getText(locale, "copy")))}
            </button>
            <span class="wos-mono" style="font-size:13px; padding:8px 10px; border:1px solid var(--w-border); border-radius:12px;">
              ${esc(code || "-")}
            </span>
          </div>
        </div>

        ${(start || end)
          ? `
          <div class="wos-muted" style="font-size:12px; margin-top:10px;">
            ${start ? `${esc(tOpt("coupons.starts", "Starts"))}: ${esc(fmtDateLike(start))}` : ""}
            ${(start && end) ? " · " : ""}
            ${end ? `${esc(tOpt("coupons.ends", "Ends"))}: ${esc(fmtDateLike(end))}` : ""}
          </div>
        `
          : ""}

        ${desc ? `<div style="margin-top:12px;">${desc}</div>` : ""}
        ${!desc && descText ? `<div class="wos-muted" style="margin-top:12px; font-size:13px; line-height:1.7;">${esc(descText).replace(/\n/g, "<br>")}</div>` : ""}

        <div class="wos-muted" style="font-size:12px; margin-top:14px; display:flex; gap:10px; flex-wrap:wrap;">
          ${updatedAt ? `<span>${esc(tOpt("coupons.updated", "Updated"))}: ${esc(fmtDateLike(updatedAt))}</span>` : ""}
          <span>/${esc(pageTitle || "coupons")}</span>
        </div>
      </div>
    `;

    const btn = $("#couponCopyBtn", view);
    if (btn) {
      btn.addEventListener("click", async () => {
        const v = btn.getAttribute("data-copy") || "";
        if (!v) return;

        let ok = false;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(v);
            ok = true;
          }
        } catch (_) {}

        if (!ok) {
          try {
            const ta = document.createElement("textarea");
            ta.value = v;
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            ok = document.execCommand("copy");
            document.body.removeChild(ta);
          } catch (_) {}
        }

        btn.textContent = ok ? tOpt("coupons.copied", getText(locale, "copied")) : tOpt("coupons.copy_failed", "Copy failed");
        setTimeout(() => {
          btn.textContent = tOpt("coupons.copy", getText(locale, "copy"));
        }, 900);
      });
    }

    applyI18n(view);
  }

  // ✅ SPA 언어 우선: args.locale -> window.WOS_LANG -> html lang
  function resolveLocale(argsLocale) {
    if (argsLocale) return pickLang(argsLocale);
    if (window.WOS_LANG) return pickLang(window.WOS_LANG);
    return pickLang(document.documentElement.getAttribute("lang") || "en");
  }

  function resolveJsonUrl(args = {}) {
    return args.jsonUrl || args.dataUrl || args.dataCouponsJson || args.couponsJson || "/coupons/coupons.json";
  }

  function renderFetchError(root, locale, err, attempted) {
    const tried = attempted && attempted.length ? attempted : buildJsonCandidates("/coupons/coupons.json");
    root.innerHTML = `
      <div class="wos-panel">
        <h2 style="margin:0 0 8px; font-size:20px;">${esc(getText(locale, "failed"))}</h2>
        <div class="wos-muted" style="font-size:13px; line-height:1.7;">${esc(String(err?.message || err || ""))}</div>
      </div>
      <div class="wos-panel" style="margin-top:12px;">
        <div class="wos-muted" style="font-weight:900; margin-bottom:6px;">${esc(getText(locale, "tried"))}</div>
        <div class="wos-mono" style="font-size:12px;">
          ${tried.map((u) => `<div><code>${esc(u)}</code></div>`).join("")}
        </div>
      </div>
    `;
    applyI18n(root);
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
      const attempted = Array.isArray(err?.attempted) ? err.attempted : buildJsonCandidates(jsonUrl);
      appEl.innerHTML = `
        <div class="muted" style="padding:10px 2px;">
          ${esc(getText(locale, "failed"))}
        </div>
        <div class="muted" style="font-size:12px;">
          ${attempted.map((u) => `<div><code>${esc(u)}</code></div>`).join("")}
        </div>
      `;
      applyI18n(appEl);
    }
  }

  async function renderListPage(appEl, locale, jsonUrl, max, focusSlug) {
    let templateLoaded = false;
    let gridEl = null;

    try {
      await loadCouponsTemplateInto(appEl, locale);
      templateLoaded = true;
    } catch (_) {
      templateLoaded = false;
    }

    if (templateLoaded) {
      gridEl = $("#couponGrid", appEl) || $("[data-coupon-grid='1']", appEl) || appEl;
      if (gridEl && gridEl.id === "couponGrid") {
        gridEl.setAttribute("data-coupon-grid", gridEl.getAttribute("data-coupon-grid") || "1");
      }

      await renderList({ appEl: gridEl, locale, jsonUrl, max });

      try {
        const r = await fetchCouponsAny(jsonUrl);
        const el = $("#lastUpdated", appEl);
        if (el && r.updatedAt) el.textContent = String(r.updatedAt);
      } catch (_) {}

      bindFilterChips(appEl, gridEl);
      if (focusSlug) focusCouponCard(gridEl, focusSlug);

      applyI18n(appEl);
      setDocTitle(tOpt("nav.coupons", getText(locale, "coupons")));
      return;
    }

    // fallback template (still works inside SPA)
    appEl.innerHTML = `
      <div class="wos-panel">
        <div style="display:flex; align-items:flex-end; justify-content:space-between; gap:12px; flex-wrap:wrap;">
          <div>
            <h2 style="margin:0 0 6px; font-size:20px; letter-spacing:-.2px;">${esc(tOpt("nav.coupons", getText(locale, "coupons")))}</h2>
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

      if (debug) {
        debug.style.display = "";
        debug.innerHTML = `<div>json: <code>${esc(usedUrl || "")}</code></div>`;
      }

      if (focusSlug) focusCouponCard(grid, focusSlug);
      applyI18n(appEl);
      setDocTitle(tOpt("nav.coupons", getText(locale, "coupons")));
    } catch (err) {
      const attempted = Array.isArray(err?.attempted) ? err.attempted : buildJsonCandidates(jsonUrl);
      renderFetchError(appEl, locale, err, attempted);
      setDocTitle(tOpt("nav.coupons", getText(locale, "coupons")));
    }
  }

  async function renderDetailPage(appEl, locale, jsonUrl, focusSlug) {
    const pageTitle = tOpt("nav.coupons", getText(locale, "coupons"));
    const focus = safeDecode(focusSlug).trim();
    if (!focus) {
      await renderListPage(appEl, locale, jsonUrl, 999, "");
      return;
    }

    let r;
    try {
      r = await fetchCouponsAny(jsonUrl);
    } catch (err) {
      const attempted = Array.isArray(err?.attempted) ? err.attempted : buildJsonCandidates(jsonUrl);
      renderFetchError(appEl, locale, err, attempted);
      setDocTitle(pageTitle);
      return;
    }

    const payload = r.payload;
    const items = normalizeList(payload);
    const key = focus.toLowerCase();
    const found = items.find((it) => getCouponKeyRaw(it).toLowerCase() === key);

    if (!found) {
      appEl.innerHTML = `
        <div class="wos-panel">
          <div class="wos-muted" style="font-size:12px; margin-bottom:6px;">
            <a class="wos-a" href="${routeHref("/coupons")}" data-link>← ${esc(tOpt("common.back", "Back"))}</a>
          </div>
          <h2 style="margin:0 0 8px;">${esc(tOpt("coupons.not_found", "Coupon not found"))}</h2>
          <div class="wos-muted" style="font-size:13px; line-height:1.7;">
            ${esc(tOpt("coupons.not_found_desc", "This coupon code was not found in the current list."))}<br>
            <span class="wos-mono">${esc(focus)}</span>
          </div>
          <div style="margin-top:12px;">
            <a class="wos-btn" href="${routeHref("/coupons")}" data-link>${esc(pageTitle)}</a>
          </div>
        </div>
      `;
      applyI18n(appEl);
      setDocTitle(pageTitle);
      return;
    }

    renderCouponPreviewCard(appEl, found, {
      slug: focus,
      updatedAt: r.updatedAt,
      pageTitle: "coupons",
      locale,
    });

    setDocTitle(getCouponKeyRaw(found) || pageTitle);
  }

  async function renderPage(args = {}) {
    const appEl = args.appEl || null;
    if (!appEl) return;

    const locale = resolveLocale(args.locale);
    const jsonUrl = resolveJsonUrl(args);
    const max = Number.isFinite(args.max) ? args.max : 999;
    const focusSlug = String(args.focusSlug || "");

    if (focusSlug) {
      await renderDetailPage(appEl, locale, jsonUrl, focusSlug);
      return;
    }

    await renderListPage(appEl, locale, jsonUrl, max, "");
  }

  async function autoInitStandalone() {
    const locale = pickLang(document.documentElement.getAttribute("lang"));
    const grid = $("#couponGrid") || $("[data-coupon-grid='1']");
    if (!grid) return;

    const jsonUrl =
      (document.currentScript &&
        (document.currentScript.getAttribute("data-json") ||
          document.currentScript.getAttribute("data-coupons-json"))) ||
      "/coupons/coupons.json";

    const maxRaw = document.currentScript && Number(document.currentScript.getAttribute("data-max"));
    const max = Number.isFinite(maxRaw) && maxRaw > 0 ? Math.floor(maxRaw) : 999;

    const lastUpdated = $("#lastUpdated");

    bindCopyButtons(document, locale);

    try {
      const { list, updatedAt } = await fetchCouponsAny(jsonUrl);
      const sorted = stableSortCoupons(list);

      if (lastUpdated) lastUpdated.textContent = updatedAt || "—";

      renderCouponCards(grid, sorted, locale, { max });
      bindFilterChips(document, grid);
      applyI18n(document);
    } catch (err) {
      const attempted = Array.isArray(err?.attempted) ? err.attempted : buildJsonCandidates(jsonUrl);
      grid.innerHTML = `
        <div class="muted" style="padding:10px 2px;">
          ${esc(getText(locale, "failed"))}
        </div>
        <div class="muted" style="font-size:12px;">
          ${attempted.map((u) => `<div><code>${esc(u)}</code></div>`).join("")}
        </div>
      `;
      applyI18n(document);
    }
  }

  // ✅ Standalone 판별: /coupons/index.html 에만 autoInit 허용
  function isStandaloneCouponsPage() {
    return (
      document.body.classList.contains("coupon-page") ||
      document.documentElement.getAttribute("data-page") === "coupons-index"
    );
  }

  window.WOS_COUPONS = {
    renderPage,
    renderList,
    _fetchCoupons: fetchCouponsAny,
    _fetchCouponsAny: fetchCouponsAny,
  };

  // ✅ 핵심: SPA index.html(메인)에서는 자동 렌더 금지
  if (isStandaloneCouponsPage()) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", autoInitStandalone, { once: true });
    } else {
      autoInitStandalone().catch(() => {});
    }
  }
})();

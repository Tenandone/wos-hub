(() => {
  "use strict";

  const Calculator = {};
  const CALCULATORS = Object.create(null);

  // =========================
  // ✅ 내부 유틸: 리소스 URL 보정기
  // - 왜 필요?
  //   GitHub Pages 프로젝트 페이지에서는 "/assets/..."가
  //   도메인 루트로 가서 404가 나는 경우가 많음.
  //   app.js는 window.WOS_RES(withRes)로 해결하지만,
  //   계산기 폴백은 calc.render가 만든 DOM/HTML 안의 src를 직접 보정해야 안전함.
  // =========================
  function getResResolver(ctx) {
    // 우선순위:
    // 1) ctx.withRes (app.js에서 넘겨줄 수 있음)
    // 2) window.WOS_RES (app.js가 전역으로 노출)
    // 3) fallback: 그대로 반환
    if (ctx && typeof ctx.withRes === "function") return ctx.withRes;
    if (typeof window.WOS_RES === "function") return window.WOS_RES;
    return (u) => String(u ?? "");
  }

  // srcset도 같이 보정 (예: "a.png 1x, b.png 2x")
  function rewriteSrcset(srcset, resolve) {
    const s = String(srcset || "").trim();
    if (!s) return s;

    return s
      .split(",")
      .map((part) => part.trim())
      .map((part) => {
        // "url 2x" 형태
        const chunks = part.split(/\s+/);
        const url = chunks[0] || "";
        const desc = chunks.slice(1).join(" ");
        const fixed = rewriteMaybe(url, resolve);
        return desc ? `${fixed} ${desc}` : fixed;
      })
      .join(", ");
  }

  // "/assets/..", "/data/..", "/i18n/.."만 보정 (외부 URL은 건드리지 않음)
  function rewriteMaybe(url, resolve) {
    const u = String(url ?? "");
    if (!u) return u;

    // 외부/데이터 URL 건드리면 안 됨
    if (/^(https?:)?\/\//i.test(u)) return u;
    if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("mailto:") || u.startsWith("tel:")) return u;

    // 이미 상대경로(./, ../)면 calc 쪽 파일 위치에 따라 의도와 다를 수 있어 건드리지 않음
    // (상대경로를 무조건 바꾸면 더 꼬일 수 있어서 안전하게 둠)
    if (u.startsWith("./") || u.startsWith("../")) return u;

    // ✅ 프로젝트에서 문제나는 핵심: 루트 절대경로
    if (u.startsWith("/assets/") || u.startsWith("/data/") || u.startsWith("/i18n/")) {
      return resolve(u);
    }

    return u;
  }

  function rewriteAssetsInContainer(container, ctx) {
    if (!container) return;

    const resolve = getResResolver(ctx);

    // img[src]
    container.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src");
      const fixed = rewriteMaybe(src, resolve);
      if (fixed !== src) img.setAttribute("src", fixed);
    });

    // source[srcset], img[srcset]
    container.querySelectorAll("source[srcset], img[srcset]").forEach((el) => {
      const srcset = el.getAttribute("srcset");
      const fixed = rewriteSrcset(srcset, (u) => rewriteMaybe(u, resolve));
      if (fixed !== srcset) el.setAttribute("srcset", fixed);
    });

    // link[href] (스타일시트 등)
    container.querySelectorAll("link[href]").forEach((lnk) => {
      const href = lnk.getAttribute("href");
      const fixed = rewriteMaybe(href, resolve);
      if (fixed !== href) lnk.setAttribute("href", fixed);
    });
  }

  // =========================
  // Register
  // =========================
  Calculator.register = function (key, config) {
    if (!key) throw new Error("Calculator.register: key is required");
    if (!config || typeof config.render !== "function") {
      throw new Error("Calculator.register: config.render is required");
    }
    if (CALCULATORS[key]) {
      console.warn(`[WOS_CALC] calculator key duplicated: ${key} (overwritten)`);
    }
    CALCULATORS[key] = config;
  };

  // =========================
  // Render
  // =========================
  Calculator.render = function (arg1, arg2) {
    let root, key, ctx;

    // ✅ app.js에서 호출하는 형태: WOS_CALC.render({ root, key, ctx })
    if (arg1 && typeof arg1 === "object" && arg1.root) {
      root = arg1.root;
      key = arg1.key;
      ctx = arg1.ctx || {};
    } else {
      // legacy 형태: WOS_CALC.render(root, key)
      root = arg1;
      key = arg2;
      ctx = {};
    }

    if (!root || typeof root !== "object") return;
    if (typeof root.appendChild !== "function") return;

    const calc = CALCULATORS[key];
    if (!calc) {
      root.innerHTML = "<p>Calculator not found.</p>";
      return;
    }

    // ✅ i18n
    const t =
      typeof ctx.t === "function"
        ? ctx.t
        : (k, fb) => (fb !== undefined ? fb : k);

    const applyI18n =
      typeof ctx.applyI18n === "function"
        ? ctx.applyI18n
        : (window.WOS_I18N && typeof window.WOS_I18N.apply === "function"
          ? window.WOS_I18N.apply
          : null);

    // ✅ 리소스 보정 함수(ctx에 기본 주입)
    // - calc 모듈들이 ctx.withRes("/assets/...")를 쓰면 안전
    if (typeof ctx.withRes !== "function" && typeof window.WOS_RES === "function") {
      ctx.withRes = window.WOS_RES;
    }
    if (typeof ctx.resolveRes !== "function") {
      ctx.resolveRes = (u) => rewriteMaybe(u, getResResolver(ctx));
    }

    root.innerHTML = "";
    const container = document.createElement("section");
    container.className = "calculator";
    container.dataset.calcKey = String(key);

    const titleKey = calc.titleKey || "";
    const titleFallback = calc.titleFallback || calc.title || "";
    const titleText = titleKey ? t(titleKey, titleFallback) : titleFallback;

    if (titleText) {
      const h2 = document.createElement("h2");
      if (titleKey) h2.setAttribute("data-i18n", titleKey);
      h2.textContent = String(titleText);
      container.appendChild(h2);
    }

    // ✅ 계산기 실제 렌더
    calc.render(container, ctx);

    // ✅ (핵심) 계산기 렌더 후, 내부의 img/src 등을 WOS_RES 기준으로 자동 보정
    // - calc 모듈이 innerHTML로 "/assets/..." 박아도 여기서 살아남음
    rewriteAssetsInContainer(container, ctx);

    root.appendChild(container);

    if (applyI18n) {
      try { applyI18n(container); } catch (_) {}
    }
  };

  // =========================
  // Helpers
  // =========================
  Calculator.getNumber = function (elOrSelector, root) {
    let el = elOrSelector;

    if (typeof elOrSelector === "string") {
      el = root ? root.querySelector(elOrSelector) : null;
    }

    if (!el) return 0;
    const n = Number(el.value);
    return Number.isFinite(n) ? n : 0;
  };

  Calculator.setHTML = function (target, html, root) {
    let el = target;

    if (typeof target === "string") {
      el = root ? root.querySelector(target) : null;
    }

    if (el) el.innerHTML = html;
  };

  window.WOS_CALC = Calculator;
  window.WOS_CALCULATOR = Calculator;
})();

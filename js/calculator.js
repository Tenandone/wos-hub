(() => {
  "use strict";

  const Calculator = {};
  const CALCULATORS = Object.create(null);

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

  Calculator.render = function (arg1, arg2) {
    let root, key, ctx;

    if (arg1 && typeof arg1 === "object" && arg1.root) {
      root = arg1.root;
      key = arg1.key;
      ctx = arg1.ctx || {};
    } else {
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

    const t = typeof ctx.t === "function" ? ctx.t : (k, fb) => fb || k;
    const applyI18n =
      typeof ctx.applyI18n === "function"
        ? ctx.applyI18n
        : (window.WOS_I18N && typeof window.WOS_I18N.apply === "function" ? window.WOS_I18N.apply : null);

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

    calc.render(container, ctx);
    root.appendChild(container);

    if (applyI18n) {
      try { applyI18n(container); } catch (_) {}
    }
  };

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

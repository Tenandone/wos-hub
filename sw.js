/* =========================================================
   WosHub - sw.js (FINAL) ✅ GitHub Pages /repo safe
   - Scope-safe base derived from self.registration.scope
   - Navigation fallback to index.html (app shell)
   - /data, /i18n : network-first (fresh)
   - /assets      : cache-first
   - /js, /css    : stale-while-revalidate
   ========================================================= */

"use strict";

const VERSION = "woshub-sw-v1.0.0";

const CACHE_SHELL  = `${VERSION}:shell`;
const CACHE_HTML   = `${VERSION}:html`;
const CACHE_ASSETS = `${VERSION}:assets`;
const CACHE_DATA   = `${VERSION}:data`;
const CACHE_CODE   = `${VERSION}:code`;

const SCOPE_URL = new URL(self.registration.scope); // e.g. https://host/repo/
const SCOPE_ORIGIN = SCOPE_URL.origin;
const SCOPE_PATH = SCOPE_URL.pathname.endsWith("/") ? SCOPE_URL.pathname : (SCOPE_URL.pathname + "/");

function inScope(url) {
  return url.origin === SCOPE_ORIGIN && url.pathname.startsWith(SCOPE_PATH);
}

function isNavigation(req) {
  return req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html");
}

function isDataPath(pathname) {
  return pathname.includes("/data/") || pathname.includes("/i18n/");
}

function isAssetPath(pathname) {
  return pathname.includes("/assets/");
}

function isCodePath(pathname) {
  return pathname.includes("/js/") || pathname.includes("/css/") || pathname.endsWith(".js") || pathname.endsWith(".css");
}

function shellUrls() {
  // "/repo/" and "/repo/index.html"
  const base = SCOPE_ORIGIN + SCOPE_PATH;
  return [base, base + "index.html"];
}

async function cachePutSafe(cacheName, request, response) {
  try {
    if (!response || !response.ok) return;
    const cache = await caches.open(cacheName);
    await cache.put(request, response);
  } catch (_) {}
}

async function cacheMatchAny(cacheName, requests) {
  const cache = await caches.open(cacheName);
  for (const r of requests) {
    const hit = await cache.match(r, { ignoreSearch: true });
    if (hit) return hit;
  }
  return null;
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_SHELL);

    // shell precache (best-effort)
    for (const u of shellUrls()) {
      try {
        await cache.add(new Request(u, { cache: "reload" }));
      } catch (_) {}
    }

    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("woshub-sw-") && !k.startsWith(VERSION))
        .map((k) => caches.delete(k))
    );

    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  try {
    if (event.data === "SKIP_WAITING") self.skipWaiting();
  } catch (_) {}
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (!inScope(url)) return;

  // ---- Navigation: network-first, fallback to shell
  if (isNavigation(req)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);

        // GitHub Pages deep link: 404가 올 수도 있음 → shell로 폴백
        if (res && res.status === 404) {
          const shell = await cacheMatchAny(CACHE_SHELL, shellUrls());
          return shell || res;
        }

        // 정상 HTML만 캐시(오프라인 대비)
        await cachePutSafe(CACHE_HTML, req, res.clone());
        return res;
      } catch (_) {
        // offline fallback
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;

        const shell = await cacheMatchAny(CACHE_SHELL, shellUrls());
        return shell || Response.error();
      }
    })());
    return;
  }

  const pathname = url.pathname;

  // ---- Data/i18n: network-first (fresh)
  if (isDataPath(pathname)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);
        await cachePutSafe(CACHE_DATA, req, res.clone());
        return res;
      } catch (_) {
        const cache = await caches.open(CACHE_DATA);
        const hit = await cache.match(req, { ignoreSearch: false });
        return hit || Response.error();
      }
    })());
    return;
  }

  // ---- Assets: cache-first
  if (isAssetPath(pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_ASSETS);
      const hit = await cache.match(req, { ignoreSearch: true });
      if (hit) return hit;

      try {
        const res = await fetch(req);
        await cachePutSafe(CACHE_ASSETS, req, res.clone());
        return res;
      } catch (_) {
        return Response.error();
      }
    })());
    return;
  }

  // ---- JS/CSS: stale-while-revalidate
  if (isCodePath(pathname)) {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_CODE);
      const hit = await cache.match(req, { ignoreSearch: true });

      const fetchPromise = (async () => {
        try {
          const res = await fetch(req);
          await cachePutSafe(CACHE_CODE, req, res.clone());
          return res;
        } catch (_) {
          return null;
        }
      })();

      return hit || (await fetchPromise) || Response.error();
    })());
    return;
  }

  // ---- Default: try network, fallback cache
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      return res;
    } catch (_) {
      const hit = await caches.match(req, { ignoreSearch: true });
      return hit || Response.error();
    }
  })());
});

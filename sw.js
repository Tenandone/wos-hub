/* =========================================================
   WosHub - sw.js (FINAL) ✅ GitHub Pages /repo safe
   - Scope-safe base derived from self.registration.scope
   - Navigation fallback to index.html (app shell)
   - ✅ IMPORTANT FIX:
     * SPA 라우트(/lootbar, /tips/xxx 등)가 "fetch"로 요청돼도
       404 네트워크 요청을 하지 않고 index.html로 폴백 (404 제거)
   - /data, /i18n : network-first (fresh)
   - /assets      : cache-first
   - /js, /css    : stale-while-revalidate
   ========================================================= */

"use strict";

const VERSION = "woshub-sw-v1.0.1"; // ✅ 버전 올려서 캐시 갱신 강제

const CACHE_SHELL  = `${VERSION}:shell`;
const CACHE_HTML   = `${VERSION}:html`;
const CACHE_ASSETS = `${VERSION}:assets`;
const CACHE_DATA   = `${VERSION}:data`;
const CACHE_CODE   = `${VERSION}:code`;

const SCOPE_URL = new URL(self.registration.scope); // e.g. https://host/repo/
const SCOPE_ORIGIN = SCOPE_URL.origin;
const SCOPE_PATH = SCOPE_URL.pathname.endsWith("/")
  ? SCOPE_URL.pathname
  : (SCOPE_URL.pathname + "/");

// ---------------------------------------------------------
// Scope helpers
// ---------------------------------------------------------
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
  return (
    pathname.includes("/js/") ||
    pathname.includes("/css/") ||
    pathname.endsWith(".js") ||
    pathname.endsWith(".css")
  );
}

// "/repo/" and "/repo/index.html"
function shellUrls() {
  const base = SCOPE_ORIGIN + SCOPE_PATH;
  return [base, base + "index.html"];
}

// ---------------------------------------------------------
// ✅ SPA route fallback (even for fetch)
//   - GitHub Pages에서는 /repo/lootbar 같은 물리 파일이 없어서 404가 뜸
//   - navigate는 이미 폴백 처리 중이지만, fetch는 그대로 404가 찍히는 경우가 있음
//   - 아래 로직이 그 "fetch 404"를 막아줌
// ---------------------------------------------------------
function toAppPathFromScope(pathname) {
  // "/repo/lootbar" -> "/lootbar"
  // "/repo/"        -> "/"
  try {
    if (!pathname) return null;

    // "/repo" 처럼 슬래시 없는 변종도 방어
    const scopeNoTrail = SCOPE_PATH.endsWith("/") ? SCOPE_PATH.slice(0, -1) : SCOPE_PATH;
    if (pathname === scopeNoTrail) return "/";

    if (!pathname.startsWith(SCOPE_PATH)) return null;

    const rest = pathname.slice(SCOPE_PATH.length); // "lootbar" or ""
    let ap = "/" + rest; // "/lootbar" or "/"
    if (ap.length > 1 && ap.endsWith("/")) ap = ap.slice(0, -1);
    return ap || "/";
  } catch (_) {
    return null;
  }
}

function hasFileExtension(pathname) {
  // 마지막 세그먼트에 "."가 있으면 파일로 본다 (예: index.html, image.png)
  const p = String(pathname || "");
  const last = p.split("/").pop() || "";
  return /\.[a-z0-9]{1,8}$/i.test(last);
}

function isKnownSpaAppPath(appPath) {
  const p = String(appPath || "/");
  return (
    p === "/" ||
    p === "/buildings" ||
    p.startsWith("/buildings/") ||
    p === "/heroes" ||
    p.startsWith("/heroes/") ||
    p === "/tips" ||
    p.startsWith("/tips/") ||
    p === "/tools" ||
    p.startsWith("/tools/") ||
    p === "/lootbar"
  );
}

function shouldServeShellForSpaFetch(req, url) {
  // 이미 navigate(문서 이동)면 위에서 처리하므로 여기선 제외
  if (isNavigation(req)) return false;

  const pathname = url.pathname;

  // 정적/데이터/코드 요청이면 절대 폴백하면 안 됨
  if (isDataPath(pathname) || isAssetPath(pathname) || isCodePath(pathname)) return false;
  if (pathname.endsWith("/sw.js")) return false;
  if (hasFileExtension(pathname)) return false; // index.html, *.png 같은 파일은 제외

  // scope 기준 appPath로 바꿔서, 우리가 아는 SPA 라우트면 쉘로 응답
  const appPath = toAppPathFromScope(pathname);
  if (!appPath) return false;

  return isKnownSpaAppPath(appPath);
}

// ---------------------------------------------------------
// Cache helpers
// ---------------------------------------------------------
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

async function getShellResponse() {
  // 1) 캐시에 있으면 즉시 사용
  const hit = await cacheMatchAny(CACHE_SHELL, shellUrls());
  if (hit) return hit;

  // 2) 캐시에 없으면 index.html을 네트워크로 받아서 캐시에 넣고 사용
  try {
    const urls = shellUrls();
    const indexUrl = urls[1];
    const req = new Request(indexUrl, { cache: "reload" });
    const res = await fetch(req);
    await cachePutSafe(CACHE_SHELL, req, res.clone());
    return res;
  } catch (_) {
    return Response.error();
  }
}

// ---------------------------------------------------------
// Install / Activate
// ---------------------------------------------------------
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

// ---------------------------------------------------------
// Fetch
// ---------------------------------------------------------
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (!inScope(url)) return;

  // ---- 0) ✅ SPA route requested by "fetch" → serve shell to prevent 404
  if (shouldServeShellForSpaFetch(req, url)) {
    event.respondWith(getShellResponse());
    return;
  }

  // ---- 1) Navigation: network-first, fallback to shell
  if (isNavigation(req)) {
    event.respondWith((async () => {
      try {
        const res = await fetch(req);

        // GitHub Pages deep link: 404가 올 수도 있음 → shell로 폴백
        if (res && res.status === 404) {
          const shell = await getShellResponse();
          return shell || res;
        }

        // 정상 HTML만 캐시(오프라인 대비)
        await cachePutSafe(CACHE_HTML, req, res.clone());
        return res;
      } catch (_) {
        // offline fallback
        const cached = await caches.match(req, { ignoreSearch: true });
        if (cached) return cached;

        const shell = await getShellResponse();
        return shell || Response.error();
      }
    })());
    return;
  }

  const pathname = url.pathname;

  // ---- 2) Data/i18n: network-first (fresh)
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

  // ---- 3) Assets: cache-first
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

  // ---- 4) JS/CSS: stale-while-revalidate
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

  // ---- 5) Default: try network, fallback cache
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

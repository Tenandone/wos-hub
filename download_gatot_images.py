# download_gatot_images.py
# 사용법:
#   pip install requests beautifulsoup4
#   python download_gatot_images.py --url "https://www.whiteoutsurvival.wiki/heroes/gatot/" --out "./gatot_imgs"
# 옵션:
#   --filter "gatot"   : URL에 포함된 문자열로 필터(기본 gatot)
#   --no-filter        : 필터 없이 페이지 내 모든 이미지 다운로드
#   --include-icons    : 작은 아이콘/스프라이트까지 포함(기본은 너무 작은 건 제외)
#   --min-width 80     : URL에 width/size가 없으면 최소폭 추정 필터(보수적으로 적용)

import argparse
import os
import re
import time
from urllib.parse import urljoin, urlparse, unquote

import requests
from bs4 import BeautifulSoup


def sanitize_filename(name: str) -> str:
    name = unquote(name)
    name = re.sub(r"[^\w\-.]+", "_", name, flags=re.UNICODE).strip("_")
    if not name:
        name = "file"
    return name[:180]


def pick_best_from_srcset(srcset: str) -> str | None:
    """
    srcset 예: "a.webp 320w, b.webp 640w, c.webp 1024w"
    가장 큰 w/2x 쪽을 선택
    """
    if not srcset:
        return None

    candidates = []
    parts = [p.strip() for p in srcset.split(",") if p.strip()]
    for p in parts:
        seg = p.split()
        if not seg:
            continue
        url = seg[0].strip()
        score = 0
        if len(seg) >= 2:
            desc = seg[1].strip().lower()
            m_w = re.match(r"(\d+)w$", desc)
            m_x = re.match(r"(\d+(?:\.\d+)?)x$", desc)
            if m_w:
                score = int(m_w.group(1))
            elif m_x:
                score = int(float(m_x.group(1)) * 1000)
        candidates.append((score, url))

    if not candidates:
        return None
    candidates.sort(key=lambda x: x[0], reverse=True)
    return candidates[0][1]


def extract_image_urls(page_url: str, html: str, *, use_filter: bool, filter_text: str, include_icons: bool) -> list[str]:
    soup = BeautifulSoup(html, "html.parser")
    urls: set[str] = set()

    def add(u: str | None):
        if not u:
            return
        u = u.strip()
        if not u:
            return
        abs_u = urljoin(page_url, u)
        urls.add(abs_u)

    # 1) <img src=...> / <img data-src=...> / <img srcset=...>
    for img in soup.find_all("img"):
        src = img.get("src") or img.get("data-src") or img.get("data-lazy-src")
        srcset = img.get("srcset") or img.get("data-srcset")
        best = pick_best_from_srcset(srcset) if srcset else None
        add(best or src)

    # 2) a href가 이미지로 끝나는 경우도 포함
    for a in soup.find_all("a"):
        href = a.get("href")
        if href and re.search(r"\.(png|jpe?g|webp|gif|svg)(\?.*)?$", href, re.IGNORECASE):
            add(href)

    # 3) style background-image: url(...)
    for tag in soup.find_all(style=True):
        style = tag.get("style") or ""
        for m in re.finditer(r"background-image\s*:\s*url\(([^)]+)\)", style, re.IGNORECASE):
            raw = m.group(1).strip().strip("'\"")
            add(raw)

    # 필터 적용(기본: gatot 들어간 것만)
    out = []
    for u in urls:
        u_low = u.lower()
        if use_filter and filter_text:
            if filter_text.lower() not in u_low:
                continue

        # 아이콘/스프라이트 대량 방지(원하면 include_icons로 해제)
        if not include_icons:
            # 흔한 아이콘 경로 키워드들
            if any(k in u_low for k in ["sprite", "icon", "favicon", "logo", "emoji"]):
                continue
            # svg는 대부분 아이콘일 확률 높아서 제외
            if u_low.endswith(".svg"):
                continue

        # 데이터 URI 제외
        if u_low.startswith("data:"):
            continue

        out.append(u)

    # 보기 좋게 정렬
    out.sort()
    return out


def guess_ext_from_url(u: str) -> str:
    path = urlparse(u).path
    ext = os.path.splitext(path)[1].lower()
    if ext in [".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg"]:
        return ext
    return ".bin"


def download_file(session: requests.Session, url: str, out_dir: str, idx: int) -> str | None:
    try:
        r = session.get(url, stream=True, timeout=30)
        r.raise_for_status()

        ext = guess_ext_from_url(url)
        base = os.path.basename(urlparse(url).path) or f"img_{idx}{ext}"
        base = sanitize_filename(base)
        if not os.path.splitext(base)[1]:
            base += ext

        # 중복 파일명 방지
        path = os.path.join(out_dir, base)
        if os.path.exists(path):
            root, e = os.path.splitext(base)
            path = os.path.join(out_dir, f"{root}_{idx}{e}")

        with open(path, "wb") as f:
            for chunk in r.iter_content(chunk_size=1024 * 64):
                if chunk:
                    f.write(chunk)

        return path
    except Exception as e:
        print(f"[FAIL] {url} -> {e}")
        return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--url", required=True, help="페이지 URL")
    ap.add_argument("--out", default="./downloads", help="저장 폴더")
    ap.add_argument("--filter", default="gatot", help="이미지 URL에 포함될 문자열(기본 gatot)")
    ap.add_argument("--no-filter", action="store_true", help="필터 없이 페이지 내 모든 이미지 다운로드")
    ap.add_argument("--include-icons", action="store_true", help="아이콘/스프라이트도 포함")
    ap.add_argument("--min-width", type=int, default=0, help="(보수적) 너무 작은 이미지 제외용 힌트(기본 0=미사용)")
    ap.add_argument("--sleep", type=float, default=0.2, help="다운로드 사이 딜레이(초)")
    args = ap.parse_args()

    os.makedirs(args.out, exist_ok=True)

    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; ImageDownloader/1.0; +local-script)"
    }

    with requests.Session() as s:
        s.headers.update(headers)

        print(f"[GET] {args.url}")
        res = s.get(args.url, timeout=30)
        res.raise_for_status()

        use_filter = not args.no_filter
        urls = extract_image_urls(
            args.url,
            res.text,
            use_filter=use_filter,
            filter_text=args.filter,
            include_icons=args.include_icons,
        )

        # min-width 힌트는 URL에 w=xxx, width=xxx 같은 파라미터 있을 때만 적용(없으면 패스)
        if args.min_width and args.min_width > 0:
            filtered = []
            for u in urls:
                q = urlparse(u).query.lower()
                m = re.search(r"(?:w|width|size)=(\d+)", q)
                if m:
                    if int(m.group(1)) < args.min_width:
                        continue
                filtered.append(u)
            urls = filtered

        if not urls:
            print("[INFO] 다운로드할 이미지가 없음. (필터 조건이 너무 강할 수 있음)")
            return

        print(f"[FOUND] {len(urls)} images")
        ok = 0
        for i, u in enumerate(urls, 1):
            path = download_file(s, u, args.out, i)
            if path:
                ok += 1
                print(f"[OK] ({ok}/{len(urls)}) {path}")
            time.sleep(max(0.0, args.sleep))

        print(f"[DONE] saved {ok} files to: {os.path.abspath(args.out)}")


if __name__ == "__main__":
    main()

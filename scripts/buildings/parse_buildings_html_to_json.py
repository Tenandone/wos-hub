# parse_buildings_html_to_json.py
# ------------------------------------------------------------
# ✅ "scripts/buildings" 폴더에 있는 파이썬 스크립트 기준으로
#    isolate/buildings -> page/data/buildings 로 파싱 저장
#
# 폴더 구조(네가 올린 스샷 기준):
# scripts/
#   buildings/
#     parse_buildings_html_to_json.py   <- 이 파일
#     isolate/
#       buildings/
#         *.html
#     page/
#       data/
#         buildings/   <- 여기에 json 생성
#
# ------------------------------------------------------------

import os
import re
import json
import argparse
from typing import Any, Dict, List, Optional, Tuple

from bs4 import BeautifulSoup


# =============================
# 경로 (핵심)
# =============================
SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))  # = scripts/buildings

def pjoin(*parts: str) -> str:
    return os.path.normpath(os.path.join(*parts))

def resolve_from_script_dir(rel_or_abs: str) -> str:
    """
    왜 이 함수가 필요하냐:
    - 너는 터미널을 어디에서 실행할지 매번 달라질 수 있음
    - 상대경로는 실행 위치에 따라 깨짐
    - 그래서 "이 파이썬 파일이 있는 폴더(scripts/buildings)" 기준으로 상대경로를 확정한다.
    """
    rel_or_abs = rel_or_abs.strip().strip('"').strip("'")
    if os.path.isabs(rel_or_abs):
        return rel_or_abs
    return pjoin(SCRIPT_DIR, rel_or_abs)


# =============================
# 텍스트/값 처리
# =============================
def clean_text(s: str) -> str:
    if not s:
        return ""
    return re.sub(r"\s+", " ", s).strip()

def smart_value(v: str) -> Any:
    v = clean_text(v)
    if v == "":
        return ""

    # 퍼센트/시간/문자 섞이면 문자열 유지
    if any(ch in v for ch in ["%", ":", "d", "h", "m", "s"]) and not re.fullmatch(r"[\d,]+", v):
        return v

    # 1,234
    if re.fullmatch(r"\d{1,3}(?:,\d{3})+", v):
        return int(v.replace(",", ""))

    # 정수
    if re.fullmatch(r"\d+", v):
        try:
            return int(v)
        except Exception:
            return v

    # 소수
    if re.fullmatch(r"\d+\.\d+", v):
        try:
            return float(v)
        except Exception:
            return v

    return v


# =============================
# 레벨 정렬 (1, 30-1, fc1, fc5-1 등)
# =============================
def level_sort_key(label: Any) -> Tuple[int, int, int, str]:
    s = str(label).strip()
    low = s.lower()

    # 일반: 30 / 30-1
    m = re.fullmatch(r"(\d+)(?:-(\d+))?", low)
    if m:
        base = int(m.group(1))
        sub = int(m.group(2)) if m.group(2) else 0
        return (0, base, sub, s)

    # fc: fc1 / fc5-1
    m = re.fullmatch(r"fc(\d+)(?:-(\d+))?", low)
    if m:
        tier = int(m.group(1))
        sub = int(m.group(2)) if m.group(2) else 0
        return (1, tier, sub, s)

    return (2, 0, 0, s)


# =============================
# 테이블 파싱
# =============================
LEVEL_HINTS = {"lv", "level", "레벨", "단계", "tier"}

def parse_html_table(table_tag) -> Dict[str, Any]:
    thead = table_tag.find("thead")
    headers: List[str] = []

    if thead:
        ths = thead.find_all(["th", "td"])
        headers = [clean_text(th.get_text(" ")) for th in ths]

    if not headers:
        first_tr = table_tag.find("tr")
        if first_tr:
            ths = first_tr.find_all("th")
            if ths:
                headers = [clean_text(th.get_text(" ")) for th in ths]

    tbody = table_tag.find("tbody")
    trs = tbody.find_all("tr") if tbody else table_tag.find_all("tr")

    rows: List[List[Any]] = []
    for tr in trs:
        if tr.find_all("th") and not tr.find_all("td"):
            continue
        tds = tr.find_all(["td", "th"])
        if not tds:
            continue
        row = [smart_value(td.get_text(" ")) for td in tds]
        if all(str(x).strip() == "" for x in row):
            continue
        rows.append(row)

    rows_as_objects: List[Dict[str, Any]] = []
    if headers and rows:
        for r in rows:
            obj: Dict[str, Any] = {}
            for i, h in enumerate(headers):
                key = h if h else f"col_{i}"
                obj[key] = r[i] if i < len(r) else ""
            rows_as_objects.append(obj)

    return {"columns": headers, "rows": rows, "rows_as_objects": rows_as_objects}

def score_table_as_main(table_info: Dict[str, Any]) -> int:
    cols = [c.lower() for c in table_info.get("columns", []) if isinstance(c, str)]
    rows = table_info.get("rows", []) or []

    score = 0
    if any(any(h in c for h in LEVEL_HINTS) for c in cols):
        score += 100
    score += min(len(rows), 200)

    if rows:
        first_col = [str(r[0]).strip().lower() for r in rows if r]
        levelish = 0
        for v in first_col[:20]:
            if re.fullmatch(r"\d+(-\d+)?", v) or re.fullmatch(r"fc\d+(-\d+)?", v):
                levelish += 1
        score += levelish * 5

    return score


# =============================
# 섹션 파싱 (진먼/건설시간 관련 섹션 포함)
# =============================
SECTION_TITLE_TAGS = ["h2", "h3", "h4"]
TIME_KEYWORDS = [
    "gem", "gems", "젬", "다이아", "diamond",
    "time", "build time", "construction time", "건설시간", "시간",
    "speedup", "speed up", "가속",
]

def is_time_related(title: str) -> bool:
    t = title.lower()
    return any(k in t for k in TIME_KEYWORDS)

def extract_sections(soup: BeautifulSoup) -> List[Dict[str, Any]]:
    sections: List[Dict[str, Any]] = []
    headings = soup.find_all(SECTION_TITLE_TAGS)
    if not headings:
        return sections

    for h in headings:
        title = clean_text(h.get_text(" "))
        if not title:
            continue

        content_nodes = []
        node = h.next_sibling
        while node is not None:
            if getattr(node, "name", None) in SECTION_TITLE_TAGS:
                break
            if getattr(node, "name", None):
                content_nodes.append(node)
            node = node.next_sibling

        tables: List[Dict[str, Any]] = []
        lists: List[List[str]] = []
        paragraphs: List[str] = []

        for n in content_nodes:
            for tbl in n.find_all("table"):
                tables.append(parse_html_table(tbl))
            for ul in n.find_all(["ul", "ol"]):
                items = [clean_text(li.get_text(" ")) for li in ul.find_all("li")]
                items = [it for it in items if it]
                if items:
                    lists.append(items)
            for p in n.find_all("p"):
                txt = clean_text(p.get_text(" "))
                if txt:
                    paragraphs.append(txt)

        if not tables and not lists and not paragraphs:
            continue

        sections.append({
            "title": title,
            "is_time_related": is_time_related(title),
            "tables": tables,
            "lists": lists,
            "paragraphs": paragraphs,
        })

    return sections


# =============================
# 제목/설명
# =============================
def extract_title(soup: BeautifulSoup) -> str:
    h1 = soup.find("h1")
    if h1:
        t = clean_text(h1.get_text(" "))
        if t:
            return t
    tt = soup.find("title")
    if tt:
        t = clean_text(tt.get_text(" "))
        if t:
            return t
    return ""

def extract_description(soup: BeautifulSoup) -> str:
    meta = soup.find("meta", attrs={"name": "description"})
    if meta and meta.get("content"):
        return clean_text(meta["content"])

    h1 = soup.find("h1")
    if h1:
        p = h1.find_next("p")
        if p:
            txt = clean_text(p.get_text(" "))
            if txt:
                return txt

    p = soup.find("p")
    if p:
        return clean_text(p.get_text(" "))

    return ""


# =============================
# 파일명 -> slug / variant
# =============================
def filename_to_slug(filename: str) -> str:
    base = os.path.basename(filename)
    base = re.sub(r"\.html?$", "", base, flags=re.I)
    base = re.sub(r"^(building_|firecrystal_)", "", base, flags=re.I)
    base = re.sub(r"_local$", "", base, flags=re.I)
    return base

def filename_to_variant(filename: str) -> str:
    base = os.path.basename(filename).lower()
    if base.startswith("firecrystal_"):
        return "firecrystal"
    if base.startswith("building_"):
        return "base"
    return "other"


# =============================
# HTML 1개 파싱
# =============================
def parse_one_html(html_path: str) -> Dict[str, Any]:
    with open(html_path, "r", encoding="utf-8", errors="ignore") as f:
        html = f.read()

    soup = BeautifulSoup(html, "html.parser")
    title = extract_title(soup)
    description = extract_description(soup)

    table_tags = soup.find_all("table")
    parsed_tables = [parse_html_table(t) for t in table_tags]

    main_table = None
    main_idx = None
    best_score = -1
    for i, tinfo in enumerate(parsed_tables):
        sc = score_table_as_main(tinfo)
        if sc > best_score:
            best_score = sc
            main_table = tinfo
            main_idx = i

    # 메인 테이블 정렬
    def sort_main_table(mt: Dict[str, Any]) -> None:
        cols = mt.get("columns", []) or []
        rows_obj = mt.get("rows_as_objects", []) or []

        level_col = None
        for c in cols:
            cl = str(c).lower()
            if any(h in cl for h in LEVEL_HINTS):
                level_col = c
                break

        if level_col and rows_obj:
            try:
                mt["rows_as_objects"] = sorted(rows_obj, key=lambda o: level_sort_key(o.get(level_col, "")))
            except Exception:
                pass

        rows = mt.get("rows", []) or []
        if rows:
            try:
                mt["rows"] = sorted(rows, key=lambda r: level_sort_key(r[0] if r else ""))
            except Exception:
                pass

    if main_table:
        sort_main_table(main_table)

    sections = extract_sections(soup)

    return {
        "title": title,
        "description": description,
        "tables_total": len(parsed_tables),
        "main_table_index": main_idx,
        "main_table": main_table,
        "sections": sections,
    }


# =============================
# 폴더 전체 파싱
# =============================
def run(input_dir: str, output_dir: str, include_local: bool = True) -> None:
    input_dir = resolve_from_script_dir(input_dir)
    output_dir = resolve_from_script_dir(output_dir)

    if not os.path.exists(input_dir):
        raise FileNotFoundError(f"❌ 입력 폴더 없음: {input_dir}")

    os.makedirs(output_dir, exist_ok=True)
    for variant in ["base", "firecrystal", "other"]:
        os.makedirs(pjoin(output_dir, variant), exist_ok=True)

    files = []
    for fn in os.listdir(input_dir):
        if not fn.lower().endswith(".html"):
            continue
        if (not include_local) and fn.lower().endswith("_local.html"):
            continue
        files.append(pjoin(input_dir, fn))
    files.sort()

    results_index: List[Dict[str, Any]] = []

    for html_path in files:
        slug = filename_to_slug(html_path)
        variant = filename_to_variant(html_path)

        data = parse_one_html(html_path)

        out = {
            "slug": slug,
            "variant": variant,
            "source_html": os.path.basename(html_path),
            **data,
        }

        out_path = pjoin(output_dir, variant, f"{slug}.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(out, f, ensure_ascii=False, indent=2)

        results_index.append({
            "slug": slug,
            "variant": variant,
            "json": f"{variant}/{slug}.json",
            "source_html": os.path.basename(html_path),
            "title": out.get("title", ""),
        })

        print(f"[OK] {os.path.basename(html_path)} -> {out_path}")

    index_path = pjoin(output_dir, "index.json")
    with open(index_path, "w", encoding="utf-8") as f:
        json.dump({"items": results_index}, f, ensure_ascii=False, indent=2)

    print(f"\n[OK] index.json 생성: {index_path}")
    print(f"총 {len(results_index)}개 처리 완료")


# =============================
# 실행
# =============================
if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--input",
        default=pjoin("isolate", "buildings"),
        help="(scripts/buildings 기준) HTML 폴더: isolate/buildings",
    )
    parser.add_argument(
        "--output",
        default=pjoin("page", "data", "buildings"),
        help="(scripts/buildings 기준) JSON 출력 폴더: page/data/buildings",
    )
    parser.add_argument("--no-local", action="store_true", help="*_local.html 제외")
    args = parser.parse_args()

    run(
        input_dir=args.input,
        output_dir=args.output,
        include_local=not args.no_local
    )

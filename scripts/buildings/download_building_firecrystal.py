import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# =========================
# 프로젝트 루트 기준 경로 계산
# =========================
BASE_DIR = os.path.abspath(
    os.path.join(os.path.dirname(__file__), "..", "..")
)

# =========================
# 설정
# =========================
BUILDING_NAME = "crystallaboratory"

HTML_PATH = os.path.join(
    BASE_DIR,
    "isolate",
    "buildings",
    f"firecrystal_{BUILDING_NAME}.html"
)

OUTPUT_HTML = os.path.join(
    BASE_DIR,
    "isolate",
    "buildings",
    f"firecrystal_{BUILDING_NAME}_local.html"
)

OUTPUT_IMG_DIR = os.path.join(
    BASE_DIR,
    "assets",
    "buildings",
    BUILDING_NAME,
    "firecrystal_img"
)

os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)

# =========================
# HTML 로드
# =========================
if not os.path.exists(HTML_PATH):
    raise FileNotFoundError(f"❌ 파일 없음: {HTML_PATH}")

with open(HTML_PATH, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

downloaded = {}

def download_image(url):
    if not url or not url.startswith("http"):
        return url

    filename = os.path.basename(urlparse(url).path)
    if not filename:
        return url

    save_path = os.path.join(OUTPUT_IMG_DIR, filename)

    if filename not in downloaded:
        print(f"📥 이미지 다운로드: {filename}")
        r = requests.get(url, timeout=20)
        r.raise_for_status()
        with open(save_path, "wb") as f:
            f.write(r.content)
        downloaded[filename] = True

    return os.path.relpath(
        save_path,
        os.path.dirname(OUTPUT_HTML)
    ).replace("\\", "/")

# =========================
# 이미지 로컬화
# =========================
for img in soup.find_all("img"):
    src = img.get("src")
    if src and src.startswith("http"):
        try:
            img["src"] = download_image(src)
        except Exception as e:
            print("⚠ 이미지 실패:", src, e)

# =========================
# Fire Crystal 테이블 파싱
# =========================
levels = []

for table in soup.find_all("table"):
    tbody = table.find("tbody")
    if not tbody:
        continue

    for row in tbody.find_all("tr"):
        cols = row.find_all("td")
        if len(cols) < 6:
            continue

        levels.append({
            "level": cols[0].get_text(strip=True),
            "required_building": cols[1].get_text(" ", strip=True),
            "fire_crystal": cols[2].get_text(" ", strip=True),
            "other_cost": cols[3].get_text(" ", strip=True),
            "build_time": cols[4].get_text(strip=True),
            "power": cols[5].get_text(strip=True),
        })

# =========================
# 결과 HTML 저장
# =========================
with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(str(soup))

# =========================
# 로그
# =========================
print("\n🔥 Fire Crystal 건물 처리 완료")
print(f"- 건물: {BUILDING_NAME}")
print(f"- 레벨 수: {len(levels)}")
print(f"- 이미지 폴더: {OUTPUT_IMG_DIR}")
print(f"- 로컬 HTML: {OUTPUT_HTML}")

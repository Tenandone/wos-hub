import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# =========================
# 설정
# =========================
BUILDING_NAME = "lancercamp"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

HTML_PATH = os.path.join(
    BASE_DIR,
    "..", "..", "isolate", "buildings",
    f"building_{BUILDING_NAME}.html"
)

OUTPUT_HTML = os.path.join(
    BASE_DIR,
    "..", "..", "isolate", "buildings",
    f"building_{BUILDING_NAME}_local.html"
)

OUTPUT_IMG_DIR = os.path.join(
    BASE_DIR,
    "..", "..", "assets", "buildings",
    BUILDING_NAME, "img"
)

os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)

# =========================
# HTML 로드
# =========================
if not os.path.exists(HTML_PATH):
    raise FileNotFoundError(f"❌ building HTML 파일을 찾을 수 없습니다:\n{HTML_PATH}")

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
        r = requests.get(url, timeout=15)
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
        img["src"] = download_image(src)

# =========================
# 결과 저장
# =========================
with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(str(soup))

print("\n✅ 건물 처리 완료")
print(f"- BUILDING: {BUILDING_NAME}")
print(f"- HTML: {OUTPUT_HTML}")
print(f"- IMG DIR: {OUTPUT_IMG_DIR}")

import os
import requests
from bs4 import BeautifulSoup
from urllib.parse import urlparse

# ==================================================
# 기본 설정
# ==================================================
GRADE = "ssr"
SEASON = "s15"          # s2, s3 ... 변경 가능
HERO_NAME = "viveca"    # 영웅명

HTML_PATH = f"../isolate/hero_isolate_{GRADE}_{SEASON}_{HERO_NAME}.html"
OUTPUT_HTML = f"../isolate/{GRADE}_{SEASON}_{HERO_NAME}_local.html"
OUTPUT_IMG_DIR = f"../assets/heroes/{GRADE}/{SEASON}/{HERO_NAME}/img"

os.makedirs(OUTPUT_IMG_DIR, exist_ok=True)

# ==================================================
# HTML 로드
# ==================================================
with open(HTML_PATH, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

downloaded = {}

def download_image(url):
    """이미지 다운로드 + 로컬 경로 치환"""
    if not url or not url.startswith("http"):
        return url

    parsed = urlparse(url)
    filename = os.path.basename(parsed.path)
    if not filename:
        return url

    save_path = os.path.join(OUTPUT_IMG_DIR, filename)

    if filename not in downloaded:
        print(f"📥 {filename}")
        r = requests.get(url, timeout=15)
        r.raise_for_status()
        with open(save_path, "wb") as f:
            f.write(r.content)
        downloaded[filename] = True

    return os.path.relpath(save_path, os.path.dirname(OUTPUT_HTML)).replace("\\", "/")

# ==================================================
# 스킬 그룹 파서 (Exploration / Expedition)
# ==================================================
def parse_skill_group(container_id):
    skills = []
    container = soup.find(id=container_id)
    if not container:
        return skills

    cards = container.select(".bg-dark.rounded.p-3")

    for card in cards:
        img = card.find("img")
        title = card.find("h5")
        desc = card.find("p")

        if img and img.get("src"):
            img["src"] = download_image(img["src"])

        skills.append({
            "icon": img["src"] if img else "",
            "name": title.get_text(strip=True) if title else "",
            "description": desc.get_text(" ", strip=True) if desc else ""
        })

    return skills

# ==================================================
# SSR 기본 스킬 파싱
# ==================================================
exploration_skills = parse_skill_group("exploration-skills")
expedition_skills  = parse_skill_group("expedition-skills")

# ==================================================
# 페이지 전체 이미지 로컬화
# ==================================================
for img in soup.find_all("img"):
    src = img.get("src")
    if src and src.startswith("http"):
        try:
            img["src"] = download_image(src)
        except Exception:
            print(f"⚠ 이미지 실패: {src}")

# ==================================================
# HTML 저장
# ==================================================
with open(OUTPUT_HTML, "w", encoding="utf-8") as f:
    f.write(str(soup))

# ==================================================
# 결과 로그
# ==================================================
print("\n✅ SSR 기본형 영웅 처리 완료")
print(f"- 영웅: {HERO_NAME}")
print(f"- Exploration 스킬: {len(exploration_skills)}")
print(f"- Expedition 스킬 : {len(expedition_skills)}")
print(f"- 이미지 폴더     : {OUTPUT_IMG_DIR}")
print(f"- 로컬 HTML       : {OUTPUT_HTML}")

const app = document.getElementById("app");

window.addEventListener("hashchange", render);
window.addEventListener("load", render);

async function render() {
  const hash = location.hash.replace("#", "") || "/";

  // 홈
  if (hash === "/") {
    renderHome();
    return;
  }

  // 건물 목록
  if (hash === "/buildings") {
    await renderBuildings();
    return;
  }

  // 건물 상세: /buildings/furnace
  if (hash.startsWith("/buildings/")) {
    const slug = hash.split("/")[2];
    await renderBuildingDetail(slug);
    return;
  }

  app.innerHTML = `<h1>404</h1>`;
}

function renderHome() {
  app.innerHTML = `
    <h1>WOS Data Project</h1>
    <p>Whiteout Survival 데이터 사이트</p>
  `;
}

/* =========================
   BUILDINGS LIST
========================= */
async function renderBuildings() {
  const res = await fetch("/data/buildings/index.json");
  const data = await res.json();

  app.innerHTML = `
    <h1>${data.meta?.title || "Buildings"}</h1>
    <p>${data.meta?.desc || ""}</p>

    <div class="grid">
      ${data.items.map(b => `
        <div class="card" onclick="location.hash='/buildings/${b.slug}'">
          <h3>${b.name}</h3>
          <p>${b.desc || ""}</p>
        </div>
      `).join("")}
    </div>
  `;
}

/* =========================
   BUILDING DETAIL
========================= */
async function renderBuildingDetail(slug) {
  const res = await fetch(`/data/buildings/${slug}.json`);
  if (!res.ok) {
    app.innerHTML = `<p>건물 데이터를 불러올 수 없습니다.</p>`;
    return;
  }

  const data = await res.json();

  app.innerHTML = `
    <a href="#/buildings">← 목록으로</a>

    <h1>${data.meta.name}</h1>
    <p>Slug: ${data.meta.slug}</p>

    <h2>Phases</h2>
    <ul>
      ${Object.keys(data.phases || {}).map(p => `
        <li>${p}</li>
      `).join("")}
    </ul>
  `;
}

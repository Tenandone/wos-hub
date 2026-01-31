import fs from "fs";
import path from "path";

const ROOT = path.resolve("data/heroes");
const OUT  = path.join(ROOT, "index.json");

const result = [];

for (const rarity of ["ssr", "sr", "r"]) {
  const dir = path.join(ROOT, rarity);
  if (!fs.existsSync(dir)) continue;

  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;

    const slug = file.replace(/\.json$/, "");

    // hero.json에서 season만 읽어옴 (선택)
    let season = null;
    try {
      const hero = JSON.parse(
        fs.readFileSync(path.join(dir, file), "utf-8")
      );
      season = Number(hero.season) || null;
    } catch (_) {}

    result.push({
      slug,
      rarity: rarity.toUpperCase(),
      season,
      path: `${rarity}/${file}`
    });
  }
}

fs.writeFileSync(
  OUT,
  JSON.stringify({ heroes: result }, null, 2),
  "utf-8"
);

console.log(`✅ index.json generated (${result.length} heroes)`);

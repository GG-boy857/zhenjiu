import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.goto("http://localhost:4321/", { waitUntil: "domcontentloaded" });
await page.locator("#bronze3d").scrollIntoViewIfNeeded();
// 等待解剖模型就绪
await page.locator('#bronze3d button:has-text("肌肉")').waitFor({ state: "visible", timeout: 25000 });
await page.waitForTimeout(800);

const box = await page.locator("#bronze3d").boundingBox();
const cx = box.x + box.width / 2;
const cy = box.y + box.height / 2;

// 1. 选中单条经络（提示态）→ 悬停单穴（高亮）
await page.locator('#bronze3d button:has-text("手太阴肺经")').click();
await page.waitForTimeout(500);
await page.locator("#bronze3d").screenshot({ path: "shots/29-3d-filtered-hint.png" });
await page.mouse.move(cx, cy);
await page.waitForTimeout(600);
console.log("debug:", await page.evaluate(() => window.__zhentuDebug?.()));
// 网格扫描找可悬停点
let found = null;
for (let dy = -160; dy <= 160 && !found; dy += 40) {
  for (let dx = -120; dx <= 120 && !found; dx += 30) {
    await page.mouse.move(cx + dx, cy + dy);
    await page.waitForTimeout(120);
    const d = await page.evaluate(() => window.__zhentuDebug?.());
    if (d?.hovered) found = { dx, dy };
  }
}
console.log("hover found at:", JSON.stringify(found));
await page.mouse.move(cx + (found?.dx ?? 0), cy + (found?.dy ?? 0));
await page.waitForTimeout(600);
await page.locator("#bronze3d").screenshot({ path: "shots/26-3d-hover.png" });
const tipVisible = await page.evaluate(() => {
  const t = document.querySelector(".tip3d");
  return t ? t.style.opacity : "none";
});
console.log("tooltip opacity:", tipVisible);
await page.locator('#bronze3d button:has-text("全部经络")').click();
await page.waitForTimeout(400);

// 2. 背面视图
await page.locator('#bronze3d button:has-text("背面")').click();
await page.waitForTimeout(900);
await page.locator("#bronze3d").screenshot({ path: "shots/27-3d-back.png" });

// 3. 肌肉视图背面
await page.locator('#bronze3d button:has-text("肌肉")').click();
await page.waitForTimeout(700);
await page.locator("#bronze3d").screenshot({ path: "shots/28-3d-back-muscle.png" });

await browser.close();
console.log("done");

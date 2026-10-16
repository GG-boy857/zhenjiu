import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));

await page.goto("http://localhost:4321/", { waitUntil: "domcontentloaded" });
await page.locator("#bronze3d").scrollIntoViewIfNeeded();
await page.locator('#bronze3d button:has-text("肌肉")').waitFor({ state: "visible", timeout: 25000 });
await page.waitForTimeout(600);

for (const code of ["ST32", "ST36", "GB31", "LR3", "LI4", "ST17", "GV20"]) {
  const r = await page.evaluate((c) => window.__zhentuDebug?.(c), code);
  console.log(code, JSON.stringify(r?.probe));
}

await browser.close();
console.log("done");

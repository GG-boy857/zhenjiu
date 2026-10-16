import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("console", (m) => {
  if (m.type() === "error" || m.type() === "warning") console.log("[console]", m.type(), m.text().slice(0, 300));
});
page.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 500)));
page.on("requestfailed", (r) => console.log("[reqfail]", r.url().slice(-60), r.failure()?.errorText));

await page.goto("http://localhost:4321/", { waitUntil: "domcontentloaded" });
await page.locator("#bronze3d").scrollIntoViewIfNeeded();
await page.waitForTimeout(15000);
const fallback = await page.locator("text=已切换简化建模").count();
const ready = await page.locator('#bronze3d button:has-text("肌肉")').count();
console.log("fallback:", fallback, "| ready:", ready);
await browser.close();

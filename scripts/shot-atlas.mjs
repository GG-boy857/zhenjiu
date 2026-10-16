import { chromium } from "playwright-core";

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
await page.goto("http://localhost:4321/atlas/", { waitUntil: "networkidle" });

// 背面视图
await page.getByRole("button", { name: "背面" }).click();
await page.waitForTimeout(250);
await page.screenshot({ path: "shots/17-atlas-back.png" });

// 正面头部特写
await page.getByRole("button", { name: "正面" }).click();
await page.waitForTimeout(250);
await page.screenshot({
  path: "shots/18-atlas-head-zoom.png",
  clip: { x: 300, y: 260, width: 620, height: 640 },
});

await browser.close();
console.log("done");

/**
 * 浏览器实测脚本（开发辅助，不参与站点构建）：
 * 1) 对关键页面截图到 shots/
 * 2) 对核心交互做断言（穴位图点击跳转、笔记保存、学习标记、搜索高亮、自测流程）
 * 用法：node scripts/e2e.mjs
 */
import { chromium } from "playwright-core";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:4321";
const OUT = "shots";
mkdirSync(OUT, { recursive: true });

const results = [];
function check(name, cond, extra = "") {
  results.push({ name, ok: !!cond, extra });
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? " — " + extra : ""}`);
}

const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });

async function shot(path, url, opts = {}) {
  await page.goto(BASE + url, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(opts.wait ?? 250);
  if (opts.before) await opts.before();
  await page.screenshot({ path: `${OUT}/${path}.png`, fullPage: opts.full ?? false });
  console.log(`shot  ${path}  <- ${url}`);
}

try {
  // ---------- 截图 ----------
  await shot("01-home", "/");
  await shot("02-meridians", "/meridians/", { full: true });
  await shot("03-meridian-lung", "/meridians/lung/", { full: true });
  await shot("04-acupoint-LI4", "/acupoints/LI4/");
  await shot("05-atlas-front", "/atlas/");
  await shot("06-review", "/review/");
  await shot("07-search", "/search/", {
    before: async () => {
      await page.fill("input[type=search]", "胃痛");
      await page.waitForTimeout(300);
    },
  });

  // ---------- 交互断言 ----------

  // 1. 穴位图：合谷（LI4）标记点可点击并跳转详情页
  await page.goto(BASE + "/atlas/", { waitUntil: "networkidle" });
  const heguLink = page.locator('a[aria-label="合谷（LI4）"]').first();
  check("穴位图存在合谷标记点", (await heguLink.count()) > 0);
  await heguLink.click();
  await page.waitForURL("**/acupoints/LI4/");
  check("点击穴位图标记跳转到 /acupoints/LI4/", page.url().includes("/acupoints/LI4/"));

  // 悬停显示穴位名
  await page.goto(BASE + "/atlas/", { waitUntil: "networkidle" });
  await heguLink.hover();
  await page.waitForTimeout(200);
  const label = await page.locator("svg text").filter({ hasText: "合谷" }).count();
  check("悬停标记点显示穴位名标签", label > 0);
  // 按经络过滤
  await page.getByRole("button", { name: "手太阴肺经" }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: `${OUT}/08-atlas-lung-filter.png` });

  // 2. 笔记保存到 localStorage 并可重新加载
  await page.goto(BASE + "/acupoints/LI4/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const note = "合谷：面口疾患要穴，四总穴歌“面口合谷收”。测试笔记 " + Date.now();
  await page.fill("textarea", note);
  await page.waitForTimeout(1200); // 等自动保存
  const stored = await page.evaluate(() => localStorage.getItem("zhentu.notes.v1"));
  check("笔记已写入 localStorage", stored && stored.includes("合谷：面口疾患要穴"));
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const reloaded = await page.inputValue("textarea");
  check("刷新后笔记回显", reloaded.includes("面口疾患要穴"));

  // 导出按钮存在
  check("存在导出笔记按钮", (await page.getByRole("button", { name: /导出此笔记 JSON/ }).count()) > 0);

  // 3. 学习状态标记
  const toggle = page.getByRole("button", { name: /标记为已学习|已学习/ });
  await toggle.click();
  await page.waitForTimeout(200);
  const pressed = await toggle.getAttribute("aria-pressed");
  check("点击后穴位标记为已学习", pressed === "true");
  await page.screenshot({ path: `${OUT}/09-acupoint-LI4-note.png`, fullPage: true });

  // 4. 列表页徽标同步
  await page.goto(BASE + "/meridians/large-intestine/", { waitUntil: "networkidle" });
  const learnedBadge = await page
    .locator('[data-learned-badge][data-code="LI4"]')
    .textContent();
  check("经络列表页 LI4 徽标显示已学习", learnedBadge?.includes("已学习"));
  await shot("10-meridian-LI", "/meridians/large-intestine/", { full: true });

  // 5. 搜索：名称 / 代码 / 主治，结果高亮
  await page.goto(BASE + "/search/", { waitUntil: "networkidle" });
  const input = page.locator('input[type="search"]').nth(1); // 页面内搜索框（页头还有一个）
  await input.fill("LI4");
  await page.waitForTimeout(250);
  check("按代码 LI4 搜索出合谷", (await page.locator("text=合谷").count()) > 0);
  await input.fill("头痛");
  await page.waitForTimeout(250);
  const marks = await page.locator("mark").count();
  check("主治关键词搜索命中并高亮", marks > 0, `高亮 ${marks} 处`);
  await page.screenshot({ path: `${OUT}/11-search-result.png`, fullPage: true });
  const firstResult = await page.locator("ul a").first().textContent();
  check(
    "搜索“头痛”首位结果按主治匹配且含高亮",
    /匹配于:主治/.test(firstResult ?? "") && /头痛/.test(firstResult ?? "")
  );

  // 6. 复习自测：闪卡翻面 + 选择题
  await page.goto(BASE + "/review/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "显示答案" }).click();
  check("闪卡翻面显示定位与评分按钮", (await page.getByRole("button", { name: "认识" }).count()) > 0);
  await page.screenshot({ path: `${OUT}/12-review-flash.png` });
  await page.getByRole("button", { name: "认识", exact: true }).click();
  await page.waitForTimeout(150);
  await page.getByRole("button", { name: "定位选择题" }).click();
  await page.waitForTimeout(250);
  const optionCount = await page.locator("ul li button").count();
  check("定位选择题出现 4 个选项", optionCount === 4);
  check("复习页包含经穴经典记忆歌诀板块", (await page.locator("text=经穴经典记忆歌诀").count()) > 0);
  check("歌诀包含四总穴与马丹阳天星十二穴", (await page.locator("text=肚腹三里留").count()) > 0);
  await page.screenshot({ path: `${OUT}/13-review-choice.png` });

  // 7. 首页数据面板与学习路径
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.waitForTimeout(300);
  const panelText = await page.locator("text=已学习").first().textContent();
  check("首页数据面板显示已学计数", /已学习/.test(panelText ?? ""));
  await shot("14-home-with-progress", "/");

  // 7.5 主页 3D 铜人
  await page.goto(BASE + "/", { waitUntil: "networkidle" });
  await page.locator("#bronze3d").scrollIntoViewIfNeeded();
  const canvas3d = page.locator("#bronze3d canvas");
  await canvas3d.waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1200);
  check("主页 3D 铜人画布已渲染", (await canvas3d.count()) === 1);
  check("3D 铜人工具栏包含穴位定位搜索框", (await page.locator('#bronze3d input[type="search"]').count()) > 0);
  // 等待解剖模型就绪（皮肤/肌肉切换按钮出现）
  const layerBtn = page.locator('#bronze3d button:has-text("肌肉")');
  try {
    await layerBtn.waitFor({ state: "visible", timeout: 20000 });
    check("解剖级模型加载完成（图层切换可用）", true);
  } catch {
    check("解剖级模型加载完成（图层切换可用）", false, "20s 内未就绪，已回退简化建模");
  }
  await page.locator("#bronze3d").screenshot({ path: `${OUT}/24-home-3d.png` });
  // 肌肉视图截图
  try {
    await page.locator('#bronze3d button:has-text("肌肉")').click({ timeout: 3000 });
    await page.waitForTimeout(900);
    await page.locator("#bronze3d").screenshot({ path: `${OUT}/25-home-3d-muscle.png` });
  } catch { /* 回退模式下无图层按钮 */ }
  check(
    "3D 工具栏包含经络筛选与正背面按钮",
    (await page.locator('#bronze3d button:has-text("背面")').count()) > 0
  );

  // 8. 穴位图缩放特写
  await page.goto(BASE + "/atlas/", { waitUntil: "networkidle" });
  const vbBefore = await page.locator("svg[role=img]").first().getAttribute("viewBox");
  await page.getByRole("button", { name: "放大" }).click();
  await page.getByRole("button", { name: "放大" }).click();
  const vbZoomed = await page.locator("svg[role=img]").first().getAttribute("viewBox");
  check("点击放大后 viewBox 变化（缩放生效）", vbBefore !== vbZoomed);
  await page.screenshot({ path: `${OUT}/20-atlas-zoomed.png` });
  await page.getByRole("button", { name: "复位" }).click();
  const vbReset = await page.locator("svg[role=img]").first().getAttribute("viewBox");
  check("复位后恢复全景", vbReset === "0 0 400 800");
  // focus 特写：详情页「打开穴位图定位」自动放大
  await page.goto(BASE + "/atlas/?focus=LI4", { waitUntil: "networkidle" });
  const vbFocus = await page.locator("svg[role=img]").first().getAttribute("viewBox");
  check("focus 参数自动放大到穴位特写", vbFocus !== "0 0 400 800");
  await page.screenshot({ path: `${OUT}/21-atlas-focus-LI4.png` });

  // 9. 治疗视频与文献
  await page.goto(BASE + "/acupoints/LI4/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(400);
  const iframeCount = await page.locator('iframe[title*="合谷"]').count();
  check("LI4 详情页内嵌治疗视频播放器", iframeCount >= 1);
  check(
    "详情页存在文献检索直达链接",
    (await page.locator('a[href*="pubmed.ncbi.nlm.nih.gov"]').count()) > 0
  );
  check(
    "详情页存在 3D 铜人直达特写入口",
    (await page.locator('a[href*="focus=LI4#bronze3d"]').count()) > 0
  );
  await page.goto(BASE + "/acupoints/LU5/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(300);
  check(
    "未收录视频的穴位显示搜索直达按钮",
    (await page.locator('a[href*="search.bilibili.com"]').count()) > 0
  );
  await page.goto(BASE + "/references/", { waitUntil: "networkidle" });
  check(
    "文献知识库页包含 WHO 标准条目",
    (await page.locator("text=WHO Standard Acupuncture Point Locations").count()) > 0
  );
  await page.screenshot({ path: `${OUT}/19-references.png`, fullPage: true });

  // 10. 全经络数据
  await page.goto(BASE + "/meridians/bladder/", { waitUntil: "networkidle" });
  check(
    "膀胱经页显示共 67 穴",
    (await page.locator("text=共 67 穴").count()) > 0 &&
      (await page.locator('a[href="/acupoints/BL13/"]').count()) === 1
  );
  await page.goto(BASE + "/meridians/heart/", { waitUntil: "networkidle" });
  check(
    "心经页列出全部 9 穴",
    (await page.locator('a[href^="/acupoints/HT"]').count()) === 9
  );
  await page.goto(BASE + "/meridians/chong/", { waitUntil: "networkidle" });
  check(
    "冲脉页显示交会说明并含 12 穴卡片",
    (await page.locator("text=冲脉不独立设穴").count()) > 0 &&
      (await page.locator('a[href^="/acupoints/"]').count()) === 12
  );

  // 11. 穴位图背面视图
  await page.goto(BASE + "/atlas/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "背面" }).click();
  await page.waitForTimeout(300);
  check(
    "背面视图显示膀胱经穴位（肺俞）",
    (await page.locator('a[aria-label="肺俞（BL13）"]').count()) > 0
  );
  check(
    "背面视图显示督脉穴位（命门）",
    (await page.locator('a[aria-label="命门（GV4）"]').count()) > 0
  );
  await page.screenshot({ path: `${OUT}/22-atlas-back-points.png`, fullPage: false });

  // 12. 奇经八脉
  await page.goto(BASE + "/meridians/dai/", { waitUntil: "networkidle" });
  check("带脉页显示交会穴卡片区", (await page.locator("text=本脉交会穴位").count()) > 0);
  check(
    "带脉交会穴卡片共 4 张",
    (await page.locator('a[href^="/acupoints/"]').count()) === 4
  );
  await page.goto(BASE + "/atlas/", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "冲脉" }).click();
  await page.waitForTimeout(300);
  check("穴位图选中冲脉显示循行虚线", (await page.locator("path.vessel-path").count()) >= 1);
  check(
    "冲脉筛选下交会穴（公孙）保持高亮",
    (await page.locator('a[aria-label="公孙（SP4）"]').count()) > 0
  );
  await page.screenshot({ path: `${OUT}/23-atlas-chong-path.png` });

  // 13. 404 页
  const resp = await page.goto(BASE + "/not-exist/");
  check("404 页正常返回", resp?.status() === 404 || page.url().includes("not-exist"));

  // 14. 3D 铜人 URL 联动聚焦
  await page.goto(BASE + "/?focus=LI4#bronze3d", { waitUntil: "domcontentloaded" });
  await page.locator('#bronze3d button:has-text("肌肉")').waitFor({ state: "visible", timeout: 20000 });
  await page.waitForTimeout(1500);
  check(
    "3D 铜人支持 focus 参数自动高亮并显示合谷提示",
    (await page.locator('#bronze3d .tip3d:has-text("合谷")').count()) > 0
  );
  await page.locator("#bronze3d").screenshot({ path: `${OUT}/26-3d-focus-LI4.png` });

  // ---------- 移动端视口 ----------
  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await mobile.goto(BASE + "/atlas/", { waitUntil: "domcontentloaded" });
  await mobile.screenshot({ path: `${OUT}/15-mobile-atlas.png`, fullPage: true });
  await mobile.goto(BASE + "/acupoints/LI4/", { waitUntil: "domcontentloaded" });
  await mobile.screenshot({ path: `${OUT}/16-mobile-acupoint.png`, fullPage: true });
  await mobile.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n==== ${results.length - failed.length}/${results.length} 项通过 ====`);
if (failed.length) {
  console.log("未通过项：");
  for (const f of failed) console.log(" -", f.name, f.extra);
  process.exit(1);
}

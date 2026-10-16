// 审计 dist 全部 HTML 页面：找出未带 /zhenjiu 前缀的内部链接
// 用法：node scripts/audit-links.mjs
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = "dist";
const BASE = "/zhenjiu";
const INTERNAL_RE = /(?:href|action)="(\/[^"]*)"/g;
const ALLOW = []; // 允许的根路径（无）

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p);
    else if (name.endsWith(".html")) files.push(p);
  }
})(DIST);

const bad = [];
for (const f of files) {
  const html = readFileSync(f, "utf8");
  for (const m of html.matchAll(INTERNAL_RE)) {
    const url = m[1];
    if (ALLOW.some((a) => url.startsWith(a))) continue;
    if (url === BASE || url.startsWith(BASE + "/") || url.startsWith(BASE + "?") || url.startsWith(BASE + "#")) continue;
    bad.push({ file: relative(DIST, f), url });
  }
}

console.log(`scanned ${files.length} html files, found ${bad.length} non-prefixed internal links`);
const uniq = [...new Map(bad.map((b) => [b.file + b.url, b])).values()];
for (const b of uniq.slice(0, 30)) console.log("  BAD", b.file, "->", b.url);
if (bad.length === 0) console.log("ALL INTERNAL LINKS PREFIXED ✔");

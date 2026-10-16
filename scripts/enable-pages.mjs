// 启用 GitHub Pages（build_type=workflow）并触发重跑
// 用法：node scripts/enable-pages.mjs
import { execSync, execFileSync } from "node:child_process";

const credInput = "protocol=https\nhost=github.com\n\n";
let token = "";
try {
  const out = execSync('"C:\\Program Files\\Git\\cmd\\git.exe" credential fill', {
    input: credInput,
    encoding: "utf8",
  });
  token = (out.match(/^password=(.+)$/m)?.[1] ?? "").trim();
} catch (e) {
  console.log("credential fill failed:", e.message);
}
if (!token) {
  console.log("NO_TOKEN");
  process.exit(1);
}

const PROXY = "http://127.0.0.1:7897";
const BASE = "https://api.github.com/repos/GG-boy857/zhenjiu";

const curlJson = (method, url, bodyStr) => {
  const args = [
    "-sS", "-x", PROXY,
    "-X", method,
    "-H", `Authorization: Bearer ${token}`,
    "-H", "User-Agent: zhentu-deploy",
    "-H", "Accept: application/vnd.github+json",
    url, "-w", "\n%{http_code}",
  ];
  if (bodyStr) {
    args.push("-H", "Content-Type: application/json");
    args.push("--data", bodyStr);
  }
  const out = execFileSync("curl", args, { encoding: "utf8", maxBuffer: 10 * 1024 * 1024 });
  const m = out.match(/^([\s\S]*)\n(\d{3})$/);
  return { status: m ? +m[2] : 0, body: m ? m[1] : out };
};

// 1. 启用 Pages（Actions 构建模式）
const create = curlJson("POST", `${BASE}/pages`, JSON.stringify({ build_type: "workflow" }));
console.log("pages POST:", create.status, JSON.stringify(create.body).slice(0, 300));

// 2. 查询 Pages 状态
const pages = curlJson("GET", `${BASE}/pages`);
console.log("pages GET:", pages.status, JSON.stringify(pages.body).slice(0, 300));

// 3. 找到失败的 workflow run 并重跑（deploy job 只差 Pages 站点存在）
const runs = curlJson("GET", `${BASE}/actions/runs?per_page=3`);
let runId = null;
try {
  const parsed = JSON.parse(runs.body);
  runId = parsed.workflow_runs?.[0]?.id;
} catch {}
if (runId) {
  const rerun = curlJson("POST", `${BASE}/actions/runs/${runId}/rerun`);
  console.log("rerun run", runId, ":", rerun.status, JSON.stringify(rerun.body).slice(0, 200));
} else {
  console.log("no run found; runs GET:", runs.status, runs.body.slice(0, 200));
}

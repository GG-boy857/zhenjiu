// 轮询 Pages 部署状态直至 built
// 用法：node scripts/poll-pages.mjs
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
  process.exit(1);
}
if (!token) { console.log("NO_TOKEN"); process.exit(1); }

const queryStatus = () => {
  const out = execFileSync(
    "curl",
    ["-sS", "-x", "http://127.0.0.1:7897", "-H", `Authorization: Bearer ${token}`, "-H", "User-Agent: zhentu", "https://api.github.com/repos/GG-boy857/zhenjiu/pages"],
    { encoding: "utf8", timeout: 30000 }
  );
  try { return JSON.parse(out).status ?? "unknown"; } catch { return "parse-err"; }
};

let s = null;
for (let i = 0; i < 24; i++) {
  try {
    s = queryStatus();
    console.log(`${i * 20}s pages status: ${s}`);
    if (s === "built") break;
  } catch (e) {
    console.log(`${i * 20}s poll err: ${String(e.message).slice(0, 80)}`);
  }
  execSync("ping -n 21 127.0.0.1 > nul", { stdio: "ignore" });
}
console.log(s === "built" ? "DEPLOYED" : `FINAL: ${s}`);

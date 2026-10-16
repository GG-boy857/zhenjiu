// 一次性脚本：校验并下载全部解剖数据块（带重试，开发辅助）
import { writeFileSync, existsSync, statSync } from "node:fs";

const atlas = JSON.parse(
  (await import("node:fs")).readFileSync("public/models/anatomy/atlas.json", "utf8")
);

async function download(n, gzBytes, tries = 4) {
  const out = `public/models/anatomy/body-${n}.bin.gz`;
  for (let t = 1; t <= tries; t++) {
    try {
      const res = await fetch(
        `https://raw.githubusercontent.com/asheMag/human-atlas/main/public/models/body-${n}.bin.gz`,
        { headers: { "User-Agent": "zhentu-dev" } }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length !== gzBytes)
        throw new Error(`大小不符 ${buf.length} ≠ ${gzBytes}`);
      if (buf[0] !== 0x1f || buf[1] !== 0x8b) throw new Error("非 gzip");
      writeFileSync(out, buf);
      console.log("ok  ", n, (buf.length / 1048576).toFixed(2) + "MB", `第${t}次尝试`);
      return;
    } catch (e) {
      console.log(`重试 ${n}（第${t}次失败：${e.message}）`);
      if (t === tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * t));
    }
  }
}

const jobs = [];
for (const [n, c] of atlas.chunks.entries()) {
  const out = `public/models/anatomy/body-${n}.bin.gz`;
  const ok =
    existsSync(out) && statSync(out).size === c.gzipBytes;
  if (c.gzipBytes === undefined) continue;
  if (ok) {
    console.log("skip", n, "（已存在且大小正确）");
  } else {
    jobs.push(download(n, c.gzipBytes));
  }
}
await Promise.all(jobs);
console.log("ALL DONE");

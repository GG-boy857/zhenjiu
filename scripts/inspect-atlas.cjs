// 一次性分析脚本：检查 BodyParts3D atlas 数据布局（开发辅助）
const a = require("../public/models/anatomy/atlas.json");
console.log("version:", a.version, "| parts:", a.parts.length, "| chunks:", a.chunks.length, "| triangles:", a.triangles);

const bySys = {};
for (const p of a.parts) bySys[p.system] = (bySys[p.system] || 0) + 1;
console.log("systems:", JSON.stringify(bySys));

console.log("chunks:", JSON.stringify(a.chunks));

const skin = a.parts.filter((p) => p.system === "integumentary");
console.log(
  "skin parts:",
  skin.length,
  JSON.stringify(skin.map((p) => ({ n: p.name, c: p.chunk, vc: p.vertexCount })))
);

const min = [Infinity, Infinity, Infinity];
const max = [-Infinity, -Infinity, -Infinity];
for (const p of a.parts)
  for (let i = 0; i < 3; i++) {
    min[i] = Math.min(min[i], p.bounds[0][i]);
    max[i] = Math.max(max[i], p.bounds[1][i]);
  }
console.log(
  "bounds min:",
  min.map((v) => v.toFixed(2)).join(","),
  " max:",
  max.map((v) => v.toFixed(2)).join(",")
);

for (const p of a.parts.slice(0, 3))
  console.log(
    p.name,
    "| chunk",
    p.chunk,
    "| positions",
    p.positions,
    "| normals",
    p.normals,
    "| indices",
    p.indices,
    "| vc",
    p.vertexCount,
    "| ic",
    p.indexCount
  );

for (const sys of ["muscular", "integumentary", "skeletal"]) {
  const set = new Set(a.parts.filter((p) => p.system === sys).map((p) => p.chunk));
  const bytes = [...set].reduce((s, c) => s + a.chunks[c].bytes, 0);
  const gz = [...set].reduce((s, c) => s + (a.chunks[c].gzipBytes || 0), 0);
  console.log(
    sys,
    "chunks:",
    [...set].join(","),
    "raw MB:",
    (bytes / 1048576).toFixed(1),
    "gz MB:",
    (gz / 1048576).toFixed(1)
  );
}

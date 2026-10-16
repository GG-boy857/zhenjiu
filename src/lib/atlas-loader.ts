/**
 * BodyParts3D 衍生解剖图谱加载器（数据来源：asheMag/human-atlas，MIT；原始数据
 * BodyParts3D © The Database Center for Life Science，CC BY-SA 2.1 JP）。
 *
 * 图谱格式：atlas.json 描述 2234 个部件；每个部件的几何体按
 *   [Float32 positions (vc×3)][Int16 normals (vc×3, /32767)][Uint32 indices (ic)]
 * 顺序存放在 15 个二进制 chunk 中（.bin.gz，gzip 魔数 1f 8b）。
 * 坐标：米制、Y 轴向上、赤足 y=0、身高约 1.73m、面朝 +z。
 *
 * 本加载器只取皮肤（integumentary）与肌肉（muscular）两套系统，
 * 合并后线性归一化到本站 3D 铜人坐标空间（身高 3.25，足底 y=-1.62）。
 */
import * as THREE from "three";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/models/anatomy/";/** 本站铜人：身高 3.25 世界单位，足底 y=-1.62 */
const TARGET_HEIGHT = 3.25;
const FOOT_Y = -1.62;

interface AtlasPart {
  name: string;
  system: string;
  chunk: number;
  positions: number;
  normals: number;
  indices: number;
  vertexCount: number;
  indexCount: number;
}

interface AtlasMeta {
  parts: AtlasPart[];
  chunks: { url: string; bytes: number; gzip?: string; gzipBytes?: number }[];
}

export interface AtlasModel {
  /** 皮肤主体，已归一化 */
  skin: THREE.BufferGeometry;
  /** 头发与体毛，已归一化 */
  hair: THREE.BufferGeometry;
  /** 眉毛，已归一化 */
  brow: THREE.BufferGeometry;
  /** 唇，已归一化 */
  lip: THREE.BufferGeometry;
  /** 肌肉系统（合并为单一几何体，带逐部件顶点色），已归一化 */
  muscle: THREE.BufferGeometry;
}

async function fetchChunkBuffer(url: string, expectedBytes: number): Promise<ArrayBuffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`解剖数据加载失败（${res.status}）：${url}`);
  const raw = await res.arrayBuffer();
  const u8 = new Uint8Array(raw);
  // gzip 魔数 1f 8b → 解压；否则原样返回
  if (u8[0] === 0x1f && u8[1] === 0x8b) {
    const stream = new Blob([raw]).stream().pipeThrough(new DecompressionStream("gzip"));
    const out = await new Response(stream).arrayBuffer();
    if (out.byteLength !== expectedBytes) throw new Error(`解剖数据不完整：${url}`);
    return out;
  }
  return raw;
}

function slicePartGeometry(buf: ArrayBuffer, p: AtlasPart): THREE.BufferGeometry {
  const positions = new Float32Array(buf, p.positions, p.vertexCount * 3);
  const normals16 = new Int16Array(buf, p.normals, p.vertexCount * 3);
  const indices = new Uint32Array(buf, p.indices, p.indexCount);
  const normals = new Float32Array(normals16.length);
  for (let i = 0; i < normals16.length; i++) normals[i] = normals16[i] / 32767;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geo.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geo.setIndex(new THREE.BufferAttribute(indices, 1));
  return geo;
}

function mergeGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let vTotal = 0;
  let iTotal = 0;
  for (const g of geos) {
    vTotal += g.getAttribute("position").count;
    iTotal += g.getIndex()!.count;
  }
  const positions = new Float32Array(vTotal * 3);
  const normals = new Float32Array(vTotal * 3);
  const indices = new Uint32Array(iTotal);
  let vo = 0;
  let io = 0;
  for (const g of geos) {
    const p = g.getAttribute("position").array as Float32Array;
    const n = g.getAttribute("normal").array as Float32Array;
    positions.set(p, vo * 3);
    normals.set(n, vo * 3);
    const gi = g.getIndex()!.array as Uint32Array;
    for (let i = 0; i < gi.length; i++) indices[io + i] = gi[i] + vo;
    vo += g.getAttribute("position").count;
    io += gi.length;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  out.setIndex(new THREE.BufferAttribute(indices, 1));
  return out;
}

export async function loadAnatomyAtlas(
  onProgress?: (msg: string, pct: number) => void
): Promise<AtlasModel> {
  onProgress?.("正在读取解剖图谱索引…", 0.03);
  const meta: AtlasMeta = await (await fetch(`${BASE}atlas.json`)).json();

  const systems = new Set(["integumentary", "muscular"]);
  const parts = meta.parts.filter((p) => systems.has(p.system));
  const chunkIds = [...new Set(parts.map((p) => p.chunk))].sort((a, b) => a - b);

  const buffers: (ArrayBuffer | null)[] = new Array(meta.chunks.length).fill(null);
  let done = 0;
  for (const ci of chunkIds) {
    const c = meta.chunks[ci];
    const file = (c.gzip ?? c.url).split("/").pop()!;
    done += 1;
    onProgress?.(`正在下载解剖数据（${done}/${chunkIds.length}）…`, 0.05 + 0.75 * (done / chunkIds.length));
    buffers[ci] = await fetchChunkBuffer(`${BASE}${file}`, c.bytes);
  }

  onProgress?.("正在解析皮肤与肌肉…", 0.85);
  // 皮肤系统按部件名细分（独立材质表现五官细节）
  const skinBuckets: Record<string, THREE.BufferGeometry[]> = {
    skin: [],
    hair: [],
    brow: [],
    lip: [],
  };
  for (const p of parts.filter((p) => p.system === "integumentary")) {
    const buf = buffers[p.chunk]!;
    const geo = slicePartGeometry(buf, p);
    if (p.name === "Hair of head" || p.name === "Pubic hair") skinBuckets.hair.push(geo);
    else if (p.name === "Eyebrow") skinBuckets.brow.push(geo);
    else if (p.name === "Lip") skinBuckets.lip.push(geo);
    else skinBuckets.skin.push(geo);
  }
  // 肌肉：合并时给每个部件叠加细微色差，呈现“肌肉分离”的解剖层次
  const muscleParts = parts.filter((p) => p.system === "muscular");
  const muscleGeos: THREE.BufferGeometry[] = [];
  muscleParts.forEach((p, i) => {
    const geo = slicePartGeometry(buffers[p.chunk]!, p);
    const count = geo.getAttribute("position").count;
    const jitter = 0.88 + (((i * 137) % 100) / 100) * 0.24; // 0.88~1.12 确定性抖动
    const base = [0.8, 0.52, 0.4];
    const col = new Float32Array(count * 3);
    for (let v = 0; v < count; v++) {
      col[v * 3] = base[0] * jitter;
      col[v * 3 + 1] = base[1] * (0.94 + jitter * 0.06);
      col[v * 3 + 2] = base[2] * jitter;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    muscleGeos.push(geo);
  });
  if (!skinBuckets.skin.length || !muscleGeos.length) {
    throw new Error("图谱数据缺少皮肤或肌肉系统");
  }

  const skin = mergeGeometries(skinBuckets.skin);
  const hair = mergeGeometries(skinBuckets.hair);
  const brow = mergeGeometries(skinBuckets.brow);
  const lip = mergeGeometries(skinBuckets.lip);
  const muscle = mergeGeometries(muscleGeos);

  // 归一化：米制 Y-up（足 y=0，身高 1.73）→ 本站空间（足 y=-1.62，身高 3.25）
  const s = TARGET_HEIGHT / 1.73;
  const mat = new THREE.Matrix4()
    .makeTranslation(0, FOOT_Y, 0)
    .multiply(new THREE.Matrix4().makeScale(s, s, s));
  skin.applyMatrix4(mat);
  hair.applyMatrix4(mat);
  brow.applyMatrix4(mat);
  lip.applyMatrix4(mat);
  muscle.applyMatrix4(mat);

  onProgress?.("完成", 1);
  return { skin, hair, brow, lip, muscle };
}

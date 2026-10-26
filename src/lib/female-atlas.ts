/**
 * 女性体型变体：对 BodyParts3D 男性图谱几何做确定性的分区平滑变形，
 * 无需额外模型文件即可得到女体（肩/腰/颈收窄、臀与大腿加宽、胸前隆起、
 * 身高微降、后发拉长成披发）。变形在站点坐标空间（身高 3.25、足底 y=-1.62）
 * 中按米制等价比定义，皮肤与肌肉用同一位移场，保证两层轮廓一致。
 *
 * 穴位标定表（body3d.ts 的 svgTo3D）基于男性骨度分寸；femaleSeedSite 用
 * 同一场变形种子点，再由 snapPoint3D 射线投射吸附到女体表面。
 */
import * as THREE from "three";
import type { AtlasModel } from "./atlas-loader";

const M2W = 3.25 / 1.73;
const FOOT_Y = -1.62;

/** 女性身高比例（相对 1.73m 男性基准） */
const H = 0.955;

/** 米制高度 → 站点空间 y */
const Y = (m: number) => m * M2W + FOOT_Y;
/** 米制长度 → 站点空间长度 */
const L = (m: number) => m * M2W;

const bump = (t: number, c: number, s: number) =>
  Math.exp(-((t - c) * (t - c)) / (2 * s * s));

// —— 女性特征分区中心（单位：米，女性身高空间）——
const SHOULDER_Y = 1.365;
const HEAD_Y = 1.55;
const NECK_Y = 1.45;
const WAIST_Y = 1.02;
const HIP_Y = 0.88;
const THIGH_Y = 0.52;
const BREAST_Y = 1.22;
const BREAST_X = 0.082;

/** 横向缩放场：返回 (x, z) 两个方向的缩放系数（入参为站点空间 y） */
function widthScales(ys: number): [number, number] {
  const narrow =
    0.025 * bump(ys, Y(HEAD_Y), L(0.09)) + // 头型略窄
    0.07 * bump(ys, Y(SHOULDER_Y), L(0.06)) + // 肩窄
    0.045 * bump(ys, Y(WAIST_Y), L(0.06)) + // 腰细
    0.05 * bump(ys, Y(NECK_Y), L(0.035)); // 颈细
  const wx =
    1 -
    narrow +
    0.055 * bump(ys, Y(HIP_Y), L(0.07)) + // 臀宽
    0.03 * bump(ys, Y(THIGH_Y), L(0.11)); // 大腿略粗
  const wz =
    1 -
    0.03 * bump(ys, Y(WAIST_Y), L(0.06)) +
    0.03 * bump(ys, Y(HIP_Y), L(0.07)) +
    0.03 * bump(ys, Y(THIGH_Y), L(0.11)) -
    0.045 * bump(ys, Y(NECK_Y), L(0.035));
  return [wx, wz];
}

/** 基础体格变形（皮肤/肌肉/眉/唇共用）：身高缩放 + 分区横向缩放 + 胸部隆起 */
function warpVertex(px: number, py: number, pz: number): [number, number, number] {
  const ym = ((py - FOOT_Y) / M2W) * H;
  const ys = Y(ym);
  const [wx, wz] = widthScales(ys);
  let x = px * wx;
  let z = pz * wz;
  const y = ys;
  // 胸前隆起：双侧高斯位移，只作用于前侧顶点，向侧缘平滑衰减
  if (pz > 0) {
    const g =
      bump(Math.abs(px), L(BREAST_X), L(0.036)) *
      bump(ys, Y(BREAST_Y), L(0.034));
    if (g > 0.002) {
      z += L(0.046) * g * Math.min(1, pz / L(0.05));
    }
  }
  return [x, y, z];
}

/** 头发变形：在基础变形之上把后侧头发向下拉伸成披肩长发 */
function warpHairVertex(px: number, py: number, pz: number): [number, number, number] {
  let [x, y, z] = warpVertex(px, py, pz);
  const pivot = Y(1.6);
  if (z < L(0.02) && y < pivot) {
    const below = pivot - y;
    const t = Math.min(1, below / L(0.18)); // 越靠下拉伸越多，枢轴处无剪切
    y = pivot - below * (1 + 1.05 * t);
    z -= L(0.014) * t;
    x *= 1 + 0.06 * t;
  }
  return [x, y, z];
}

/** 穴位种子点变形（站点空间 x, y）：与顶点变形同场，z 交由射线投射确定 */
export function femaleSeedSite(x: number, y: number): { x: number; y: number } {
  const ym = ((y - FOOT_Y) / M2W) * H;
  const ys = Y(ym);
  const [wx] = widthScales(ys);
  return { x: x * wx, y: ys };
}

/** 克隆几何并施加变形场；索引与顶点色（如有）与原几何共享，法线重算 */
function cloneDeformed(
  src: THREE.BufferGeometry,
  warp: (x: number, y: number, z: number) => [number, number, number]
): THREE.BufferGeometry {
  const pos = src.getAttribute("position") as THREE.BufferAttribute;
  const count = pos.count;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const [x, y, z] = warp(pos.getX(i), pos.getY(i), pos.getZ(i));
    out[i * 3] = x;
    out[i * 3 + 1] = y;
    out[i * 3 + 2] = z;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(out, 3));
  geo.setIndex(src.getIndex());
  const color = src.getAttribute("color");
  if (color) geo.setAttribute("color", color);
  geo.computeVertexNormals();
  return geo;
}

export function buildFemaleAtlas(model: AtlasModel): AtlasModel {
  return {
    skin: cloneDeformed(model.skin, warpVertex),
    hair: cloneDeformed(model.hair, warpHairVertex),
    brow: cloneDeformed(model.brow, warpVertex),
    lip: cloneDeformed(model.lip, warpVertex),
    muscle: cloneDeformed(model.muscle, warpVertex),
  };
}

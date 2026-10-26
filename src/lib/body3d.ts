/**
 * 3D 针灸铜人：程序化建模 v2（无外部模型依赖）。
 * 与 2D 铜人共用同一坐标系（viewBox 400×800，中轴 200，1寸≈7px）经 K 系数换算，
 * 穴位由 snapPoint 射线投射吸附到体表。
 * v2：肢体改用带肌肉轮廓的旋转曲面（LatheGeometry），增加五官、发型、手指、
 * 脚趾等细节件，材质为高金属度青铜（配合组件侧的环境反射与 ACES 色调映射）。
 */
import * as THREE from "three";

/** svg 像素 → 世界坐标系数（头顶 y≈1.63，足底 y≈-1.62，身高约 3.25） */
export const K = 0.0042;
export const worldY = (svgY: number) => (409 - svgY) * K;
export const worldX = (svgX: number) => (svgX - 200) * K;

const BODY_MIDLINE = 200;
/** 世界坐标下的铜人身高（米制锚点 × M2W + FOOT_Y 变换用） */
const TARGET_HEIGHT = 3.25;

function bronzeMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xb08d57,
    metalness: 0.78,
    roughness: 0.34,
    envMapIntensity: 0.85,
  });
}

function hairMaterial(): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0x5f4a2e,
    metalness: 0.6,
    roughness: 0.52,
    envMapIntensity: 0.55,
  });
}

/** 以 A→B 为轴、profile 为“半径-轴向距离”曲线的旋转曲面肢体 */
function latheLimb(
  profile: [number, number][],
  ax: number,
  ay: number,
  bx: number,
  by: number,
  mat: THREE.Material,
  seg = 48
): THREE.Mesh {
  const geo = new THREE.LatheGeometry(
    profile.map(([r, t]) => new THREE.Vector2(Math.max(r, 0.001), t)),
    seg
  );
  const m = new THREE.Mesh(geo, mat);
  m.position.set(ax, ay, 0);
  m.rotation.z = Math.atan2(bx - ax, by - ay) * -1;
  return m;
}

const bump = (t: number, c: number, s: number) =>
  Math.exp(-((t - c) * (t - c)) / (2 * s * s));

/** 组装铜人身体（含左右对称肢体）；variant="female" 为程序化女体回退方案 */
export function buildBody(variant: "male" | "female" = "male"): THREE.Group {
  const group = new THREE.Group();
  group.name = "body";
  const mat = bronzeMaterial();
  const hair = hairMaterial();
  const female = variant === "female";

  // 女体躯干横向系数：胸窄、腰细、臀宽
  const torsoFactor = (y: number) =>
    female
      ? 1 -
        0.07 * bump(y, 0.8, 0.12) -
        0.045 * bump(y, 0.3, 0.1) +
        0.055 * bump(y, -0.18, 0.12)
      : 1;

  const put = (
    geo: THREE.BufferGeometry,
    x = 0,
    y = 0,
    z = 0,
    scale: [number, number, number] = [1, 1, 1],
    material: THREE.Material = mat,
    rotX = 0,
    rotZ = 0
  ) => {
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(x, y, z);
    mesh.scale.set(...scale);
    mesh.rotation.x = rotX;
    mesh.rotation.z = rotZ;
    group.add(mesh);
    return mesh;
  };

  // ———— 头部 ————
  put(new THREE.SphereGeometry(1, 48, 32), 0, 1.375, -0.005, [0.2, 0.225, 0.225]); // 颅顶
  put(new THREE.SphereGeometry(1, 32, 24), 0, 1.245, 0.045, [0.135, 0.1, 0.15]); // 下颌/颏
  put(new THREE.SphereGeometry(1, 20, 16), 0, 1.302, 0.208, [0.024, 0.038, 0.03]); // 鼻
  for (const s of [-1, 1]) {
    put(new THREE.SphereGeometry(1, 20, 16), s * 0.195, 1.375, -0.005, [0.018, 0.05, 0.032]); // 耳
  }
  // 发型盖（略大于颅顶，向后仰使前额外露）
  put(
    new THREE.SphereGeometry(
      0.216,
      48,
      24,
      0,
      Math.PI * 2,
      0,
      Math.PI * (female ? 0.74 : 0.58)
    ),
    0,
    female ? 1.378 : 1.385,
    -0.012,
    [1, female ? 1.12 : 1, 1.04],
    hair,
    female ? 0.36 : 0.3
  );

  // ———— 颈与斜方肌 ————
  put(new THREE.CylinderGeometry(0.082, 0.104, 0.2, 24), 0, 1.0, 0);
  for (const s of [-1, 1]) {
    put(
      new THREE.SphereGeometry(1, 24, 16),
      s * (female ? 0.088 : 0.1),
      0.9,
      0,
      female ? [0.13, 0.05, 0.085] : [0.15, 0.055, 0.095],
      mat,
      0,
      s * 0.55
    );
  }

  // ———— 躯干（旋转曲面：肩→胸→腰→髋） ————
  const torsoProfile: [number, number][] = [
    [0.08, 1.13],
    [0.105, 1.08],
    [0.142, 1.02],
    [0.175, 0.955],
    [0.207, 0.885],
    [0.228, 0.8],
    [0.241, 0.715],
    [0.244, 0.62],
    [0.233, 0.52],
    [0.219, 0.42],
    [0.207, 0.315],
    [0.204, 0.22],
    [0.21, 0.12],
    [0.228, 0.0],
    [0.245, -0.1],
    [0.252, -0.185],
    [0.243, -0.27],
    [0.215, -0.35],
    [0.15, -0.415],
    [0.001, -0.425],
  ];
  const torso = new THREE.Mesh(
    new THREE.LatheGeometry(
      torsoProfile.map(([r, y]) => new THREE.Vector2(r * torsoFactor(y), y)),
      56
    ),
    mat
  );
  torso.scale.z = 0.64;
  group.add(torso);

  // 乳房体块（女体）
  if (female) {
    for (const s of [-1, 1]) {
      put(
        new THREE.SphereGeometry(0.05, 24, 18),
        s * 0.068,
        0.66,
        0.126,
        [1.05, 0.95, 0.85]
      );
    }
  }

  // 三角肌（肩部体块）
  for (const s of [-1, 1]) {
    put(
      new THREE.SphereGeometry(female ? 0.077 : 0.082, 24, 18),
      s * (female ? 0.188 : 0.2),
      0.825,
      0
    );
  }
  // 臀部体块
  for (const s of [-1, 1]) {
    put(
      new THREE.SphereGeometry(1, 24, 18),
      s * (female ? 0.102 : 0.095),
      -0.31,
      -0.075,
      female ? [0.125, 0.11, 0.13] : [0.115, 0.105, 0.12]
    );
  }

  // ———— 上肢 ————
  for (const s of [-1, 1]) {
    // 上臂（三角肌→肱二头肌鼓形→肘）
    group.add(
      latheLimb(
        [
          [0.075, 0],
          [0.079, 0.06],
          [0.07, 0.17],
          [0.058, 0.31],
          [0.05, 0.42],
          [0.047, 0.45],
        ],
        s * 0.212,
        0.845,
        s * 0.293,
        0.41,
        mat
      )
    );
    // 前臂（肘→腕渐细）
    group.add(
      latheLimb(
        [
          [0.048, 0],
          [0.052, 0.07],
          [0.046, 0.19],
          [0.039, 0.31],
          [0.034, 0.42],
          [0.032, 0.44],
        ],
        s * 0.297,
        0.395,
        s * 0.332,
        -0.02,
        mat
      )
    );
    // 手：腕、掌、指、拇指
    put(new THREE.SphereGeometry(0.034, 18, 14), s * 0.338, -0.032, 0);
    put(new THREE.SphereGeometry(1, 24, 18), s * 0.348, -0.112, 0, [0.052, 0.078, 0.028]);
    for (let i = 0; i < 4; i++) {
      put(
        new THREE.CylinderGeometry(0.0095, 0.011, 0.036, 12),
        s * (0.374 - i * 0.017),
        -0.193,
        0.004
      );
    }
    put(
      new THREE.CylinderGeometry(0.011, 0.013, 0.05, 12),
      s * 0.392,
      -0.142,
      0.004,
      [1, 1, 1],
      mat,
      0,
      s * -0.85
    );
  }

  // ———— 下肢 ————
  for (const s of [-1, 1]) {
    // 大腿（髌上渐细）
    group.add(
      latheLimb(
        [
          [0.1, 0],
          [0.105, 0.09],
          [0.096, 0.23],
          [0.084, 0.39],
          [0.072, 0.53],
          [0.063, 0.64],
          [0.06, 0.66],
        ],
        s * 0.105,
        -0.295,
        s * 0.158,
        -0.945,
        mat
      )
    );
    // 小腿（腓肠肌鼓形→踝渐细）
    group.add(
      latheLimb(
        [
          [0.059, 0],
          [0.069, 0.1],
          [0.064, 0.21],
          [0.051, 0.35],
          [0.04, 0.46],
          [0.033, 0.53],
        ],
        s * 0.16,
        -0.965,
        s * 0.15,
        -1.5,
        mat
      )
    );
    // 髌骨
    put(new THREE.SphereGeometry(0.055, 20, 14), s * 0.159, -0.955, 0.01);
    // 足：跟、足背、趾端
    put(new THREE.SphereGeometry(0.042, 20, 14), s * 0.16, -1.57, -0.06);
    put(new THREE.SphereGeometry(1, 24, 16), s * 0.162, -1.578, 0.028, [0.062, 0.042, 0.115]);
    put(new THREE.SphereGeometry(1, 20, 14), s * 0.164, -1.602, 0.112, [0.042, 0.032, 0.048]);
  }

  return group;
}

export interface SnapResult {
  position: THREE.Vector3;
  normal: THREE.Vector3;
}

/**
 * ============ 真实解剖模型上的穴位重映射标定表 ============
 * 2D 铜人是简笔示意（四肢站姿与躯干比例均非写实），直接线性投影会有显著偏差。
 * 按身体分区标定：高度用“锚点分段线性”（依据 GB/T 12346 骨度分寸与人体测量学，
 * 针对 1.73m 男性体）；横向头部/躯干用分区系数、四肢用内/外缘线性映射。
 */

type YAnchor = [number, number]; // [svgY, 真实高度 m]
type SegRow = [number, number, number, number, number]; // [svgY, inner2D, outer2D, innerReal(m), outerReal(m)]

const Y_HEAD: YAnchor[] = [
  [20, 1.71], [54, 1.685], [76, 1.605], [100, 1.56], [118, 1.545], [132, 1.5], [139, 1.495],
];
const Y_NECK: YAnchor[] = [[139, 1.495], [150, 1.445], [178, 1.425]];
const Y_TRUNK: YAnchor[] = [
  [176, 1.425], [196, 1.415], [258, 1.245], [288, 1.19], [300, 1.17],
  [330, 1.115], [372, 1.04], [410, 0.985], [432, 0.9], [445, 0.87], [520, 0.79],
];
const Y_ARM: YAnchor[] = [
  [200, 1.405], [250, 1.3], [300, 1.1], [350, 1.01], [410, 0.78], [440, 0.71], [465, 0.655], [505, 0.615],
];
const Y_LEG: YAnchor[] = [
  [500, 0.815], [548, 0.7], [585, 0.6], [620, 0.535], [648, 0.495], [678, 0.425],
  [702, 0.355], [712, 0.32], [730, 0.3], [745, 0.2], [756, 0.085], [770, 0.055], [790, 0.025], [798, 0.0],
];

/** 横向系数：世界单位 / 2D像素（分区） */
const X_HEAD = 0.0032;
const X_NECK = 0.0044;
const X_TRUNK = 0.0056;
const X_ABDOMEN = 0.0058;
const X_LIMB = 0.0025;

/** 米 → 世界坐标变换（世界身高 3.25，足底 y=FOOT_Y） */
const M2W = TARGET_HEIGHT / 1.73;
const FOOT_Y = -1.62;

/** 肢体内/外缘映射：[svgY, inner2D, outer2D, innerReal(m), outerReal(m)]（左半边） */
const SEG_ARM: SegRow[] = [
  [200, 145.5, 130.4, 0.05, 0.14],
  [250, 141, 119, 0.055, 0.155],
  [300, 135, 116, 0.05, 0.145],
  [350, 130, 113, 0.048, 0.14],
  [410, 128, 112, 0.042, 0.13],
  [440, 137, 100, 0.09, 0.2],
  [465, 138, 97, 0.085, 0.185],
  [505, 130, 96, 0.036, 0.115],
];
const SEG_LEG: SegRow[] = [
  [495, 192, 132, 0.035, 0.16],
  [560, 189, 141, 0.04, 0.15],
  [620, 185, 143, 0.05, 0.135],
  [655, 180, 140, 0.045, 0.115],
  [700, 176, 137, 0.04, 0.1],
  [745, 169, 144, 0.033, 0.068],
  [762, 166, 145, 0.028, 0.06],
  [798, 170, 136, 0.015, 0.055],
];

function interpAnchor(table: YAnchor[], y: number): number {
  if (y <= table[0][0]) return table[0][1];
  const last = table[table.length - 1];
  if (y >= last[0]) return last[1];
  for (let i = 1; i < table.length; i++) {
    const [y0, v0] = table[i - 1];
    const [y1, v1] = table[i];
    if (y <= y1) return v0 + ((y - y0) / (y1 - y0)) * (v1 - v0);
  }
  return last[1];
}

/** 把 2D 铜人坐标重映射到真实解剖模型的（x, y）世界坐标（z 由射线投射确定） */
export function svgTo3D(svg: [number, number]): { x: number; y: number } {
  const sx = svg[0] <= BODY_MIDLINE ? svg[0] : 400 - svg[0]; // 归一到左半边
  const sy = svg[1];
  const sideSign = svg[0] <= BODY_MIDLINE ? -1 : 1;
  const ax = 200 - sx; // 距中线像素

  const armInnerAt = (yy: number) =>
    interpAnchor(SEG_ARM.map(([y0, i2]) => [y0, i2] as YAnchor), yy);

  let x: number;
  let y: number;
  if (sy < 140) {
    // 头
    y = interpAnchor(Y_HEAD, sy);
    x = ax * X_HEAD;
  } else if (sy < 178) {
    // 颈
    y = interpAnchor(Y_NECK, sy);
    x = ax * X_NECK;
  } else if (sy <= 460 && ax >= 200 - armInnerAt(sy) - 5) {
    // 臂：内/外缘线性映射
    y = interpAnchor(Y_ARM, sy);
    let i0 = SEG_ARM[0];
    let i1 = SEG_ARM[SEG_ARM.length - 1];
    for (let i = 1; i < SEG_ARM.length; i++) {
      if (sy <= SEG_ARM[i][0]) {
        i0 = SEG_ARM[i - 1];
        i1 = SEG_ARM[i];
        break;
      }
    }
    const t = (sy - i0[0]) / (i1[0] - i0[0]);
    const inner2 = i0[1] + t * (i1[1] - i0[1]);
    const outer2 = i0[2] + t * (i1[2] - i0[2]);
    const innerR = i0[3] + t * (i1[3] - i0[3]);
    const outerR = i0[4] + t * (i1[4] - i0[4]);
    const tt = Math.max(-0.15, Math.min(1.15, (sx - inner2) / (outer2 - inner2)));
    x = (innerR + tt * (outerR - innerR)) * 1.879;
  } else if (sy > 495 || (sy > 460 && ax > 60)) {
    // 腿（含 y 465-500 的大腿外侧部分）：内/外缘线性映射
    y = sy <= 500 ? interpAnchor(Y_TRUNK, sy) : interpAnchor(Y_LEG, sy);
    let i0 = SEG_LEG[0];
    let i1 = SEG_LEG[SEG_LEG.length - 1];
    for (let i = 1; i < SEG_LEG.length; i++) {
      if (sy <= SEG_LEG[i][0]) {
        i0 = SEG_LEG[i - 1];
        i1 = SEG_LEG[i];
        break;
      }
    }
    const t = (sy - i0[0]) / (i1[0] - i0[0]);
    const inner2 = i0[1] + t * (i1[1] - i0[1]);
    const outer2 = i0[2] + t * (i1[2] - i0[2]);
    const innerR = i0[3] + t * (i1[3] - i0[3]);
    const outerR = i0[4] + t * (i1[4] - i0[4]);
    const tt = Math.max(-0.15, Math.min(1.15, (sx - inner2) / (outer2 - inner2)));
    x = (innerR + tt * (outerR - innerR)) * 1.879;
  } else {
    // 躯干
    y = interpAnchor(Y_TRUNK, sy);
    const f =
      sy <= 330 ? X_TRUNK : sy <= 445 ? X_ABDOMEN : sy <= 520 ? 0.0055 : X_LIMB;
    x = ax * f;
  }

  // 高度锚点为米制，统一变换到世界坐标（足底 -1.62，身高 3.25）
  y = y * M2W + FOOT_Y;

  return { x: x * sideSign, y };
}

/**
 * 穴位吸附（真实解剖模型）：按标定表得到 (x,y) 后沿前后方向投射到体表；
 * 未命中则逐步向中线收拢重试，再退化为外侧横向投射。
 * remapSeed 用于女体等变体模型：先用与网格一致的变形场变换种子点再投射。
 */
export type SeedRemap = (x: number, y: number) => { x: number; y: number };

export function snapPoint3D(
  svg: [number, number],
  side: "front" | "back",
  body: THREE.Object3D,
  remapSeed?: SeedRemap
): SnapResult {
  const raw = svgTo3D(svg);
  const seed = remapSeed ? remapSeed(raw.x, raw.y) : raw;
  const x0 = seed.x;
  const y = seed.y;
  const zSign = side === "front" ? 1 : -1;
  const raycaster = new THREE.Raycaster();

  const hitAt = (
    ox: number,
    oy: number,
    oz: number,
    dx: number,
    dy: number,
    dz: number
  ): THREE.Intersection | null => {
    raycaster.set(
      new THREE.Vector3(ox, oy, oz),
      new THREE.Vector3(dx, dy, dz).normalize()
    );
    return raycaster.intersectObject(body, true)[0] ?? null;
  };

  let hit: ReturnType<typeof hitAt> = null;
  for (const shrink of [1, 0.94, 0.86, 0.78]) {
    hit = hitAt(x0 * shrink, y, zSign * 1.2, 0, 0, -zSign);
    if (hit) break;
  }
  if (!hit) {
    const sx = x0 === 0 ? 1 : Math.sign(x0);
    hit = hitAt(x0 - sx * 0.9, y, 0, sx, 0, 0);
  }
  if (!hit) {
    return {
      position: new THREE.Vector3(x0, y, zSign * 0.1),
      normal: new THREE.Vector3(0, 0, zSign),
    };
  }
  return {
    position: hit.point.clone(),
    normal: (hit.face
      ? hit.face.normal
          .clone()
          .applyNormalMatrix(
            new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
          )
          .normalize()
      : new THREE.Vector3(0, 0, zSign)),
  };
}

/** 简化建模（程序化铜人）用的朴素吸附：程序化身体按 2D 坐标雕刻，天然贴合 */
export function snapPointNaive(
  svg: [number, number],
  side: "front" | "back",
  body: THREE.Object3D
): SnapResult {
  const x = worldX(svg[0]);
  const y = worldY(svg[1]);
  const sign = side === "front" ? 1 : -1;
  const raycaster = new THREE.Raycaster();

  const hitAt = (origin: THREE.Vector3, dir: THREE.Vector3) => {
    raycaster.set(origin, dir.normalize());
    return raycaster.intersectObject(body, true)[0] ?? null;
  };

  let hit = hitAt(
    new THREE.Vector3(x, y, sign * 1.2),
    new THREE.Vector3(0, 0, -sign)
  );
  if (!hit) {
    const sx = x === 0 ? 1 : Math.sign(x);
    hit = hitAt(new THREE.Vector3(x - sx * 0.9, y, 0), new THREE.Vector3(sx, 0, 0));
  }
  if (!hit) {
    return {
      position: new THREE.Vector3(x, y, sign * 0.12),
      normal: new THREE.Vector3(0, 0, sign),
    };
  }
  return {
    position: hit.point.clone(),
    normal: (hit.face
      ? hit.face.normal
          .clone()
          .applyNormalMatrix(
            new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)
          )
          .normalize()
      : new THREE.Vector3(0, 0, sign)),
  };
}

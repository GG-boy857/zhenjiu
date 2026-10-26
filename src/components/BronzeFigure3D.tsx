import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { buildBody, snapPoint3D, snapPointNaive } from "../lib/body3d";
import { loadAnatomyAtlas } from "../lib/atlas-loader";
import type { AtlasModel } from "../lib/atlas-loader";
import { buildFemaleAtlas, femaleSeedSite } from "../lib/female-atlas";

export interface BronzePoint {
  code: string;
  name: string;
  nameEn: string;
  meridianId: string;
  color: string;
  front?: [number, number];
  back?: [number, number];
}

export interface BronzeMeridian {
  id: string;
  name: string;
  color: string;
  jiaohui?: string[];
}

type Gender = "male" | "female";
type AtlasState = "loading" | "ready" | "fallback";

function makeCircleTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  ctx.fill();
  ctx.lineWidth = 5;
  ctx.strokeStyle = "#ffffff";
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(32, 32, 13, 0, Math.PI * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  return new THREE.CanvasTexture(c);
}

function makeRingTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d")!;
  ctx.lineWidth = 7;
  ctx.strokeStyle = "#ffffff";
  ctx.beginPath();
  ctx.arc(32, 32, 24, 0, Math.PI * 2);
  ctx.stroke();
  return new THREE.CanvasTexture(c);
}

export default function BronzeFigure3D({
  points,
  meridians,
}: {
  points: BronzePoint[];
  meridians: BronzeMeridian[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState("all");
  const [failed, setFailed] = useState(false);
  const [atlasState, setAtlasState] = useState<AtlasState>("loading");
  const [atlasMsg, setAtlasMsg] = useState("正在准备…");
  const [layer, setLayer] = useState<"skin" | "muscle">("skin");
  const [gender, setGender] = useState<Gender>("male");
  const [building, setBuilding] = useState(false);
  const [directSearch, setDirectSearch] = useState("");

  const store = useRef<{
    sprites: THREE.Sprite[];
    renderer?: THREE.WebGLRenderer;
    camera?: THREE.PerspectiveCamera;
    controls?: OrbitControls;
    scene?: THREE.Scene;
    /** 吸附/拾取射线目标（仅体表网格，不含肌肉，避免数十万三角形拖慢射线） */
    body?: THREE.Object3D | null;
    mode: "atlas" | "procedural";
    gender: Gender;
    maleModel?: AtlasModel;
    maleGroup?: THREE.Object3D;
    femaleGroup?: THREE.Object3D;
    maleSurface?: THREE.Object3D;
    femaleSurface?: THREE.Object3D;
    skinMats: THREE.MeshStandardMaterial[];
    muscleMeshes: THREE.Mesh[];
    ring?: THREE.Sprite;
    metaById?: Map<string, BronzeMeridian>;
    declutter?: () => void;
    clearHover?: () => void;
    focusAcupoint?: (code: string) => void;
    applyLayer?: () => void;
    applyFilter?: () => void;
    mountBody?: (g: Gender) => void;
    activateGender?: (g: Gender) => void;
    ensureFemaleAtlas?: () => void;
    ensureFemaleProcedural?: () => void;
    matFor: (color: string) => THREE.SpriteMaterial;
    hintFor: (color: string) => THREE.SpriteMaterial;
    dimMat: THREE.SpriteMaterial;
    raf?: number;
  }>({
    sprites: [],
    mode: "atlas",
    gender: "male",
    skinMats: [],
    muscleMeshes: [],
    matFor: () => new THREE.SpriteMaterial(),
    hintFor: () => new THREE.SpriteMaterial(),
    dimMat: new THREE.SpriteMaterial(),
  });

  const jiaohuiSet = useMemo(
    () => new Set(meridians.find((m) => m.id === filter)?.jiaohui ?? []),
    [filter, meridians]
  );

  const filterRef = useRef(filter);
  const jiaohuiRef = useRef(jiaohuiSet);
  const layerRef = useRef(layer);
  useEffect(() => {
    filterRef.current = filter;
    jiaohuiRef.current = jiaohuiSet;
    layerRef.current = layer;
  }, [filter, jiaohuiSet, layer]);

  // —— 场景初始化 + 解剖模型加载（仅一次）——
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    } catch {
      setFailed(true);
      return;
    }
    let cancelled = false;

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.display = "block";
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();

    const pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    const shadowCanvas = document.createElement("canvas");
    shadowCanvas.width = shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext("2d")!;
    const grad = sctx.createRadialGradient(64, 64, 6, 64, 64, 62);
    grad.addColorStop(0, "rgba(60,50,35,0.55)");
    grad.addColorStop(1, "rgba(60,50,35,0)");
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.5, 0.72),
      new THREE.MeshBasicMaterial({
        map: new THREE.CanvasTexture(shadowCanvas),
        transparent: true,
        depthWrite: false,
        opacity: 0.42,
      })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = -1.645;
    scene.add(shadow);

    const camera = new THREE.PerspectiveCamera(
      38,
      container.clientWidth / container.clientHeight,
      0.05,
      60
    );
    camera.position.set(0, 0.12, 5.2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 0.02, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.7;
    controls.maxDistance = 8;
    controls.maxPolarAngle = Math.PI * 0.86;
    controls.minPolarAngle = Math.PI * 0.1;

    scene.add(new THREE.HemisphereLight(0xfff4e0, 0x40372a, 1.35));
    const key = new THREE.DirectionalLight(0xffffff, 2.6);
    key.position.set(1.6, 2.4, 2.2);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0xdfe8ff, 1.1);
    rim.position.set(-2.2, 1, -2.4);
    scene.add(rim);

    const tex = makeCircleTexture();
    const cache = new Map<string, THREE.SpriteMaterial>();
    const hintCache = new Map<string, THREE.SpriteMaterial>();
    const matFor = (color: string) => {
      let m = cache.get(color);
      if (!m) {
        m = new THREE.SpriteMaterial({
          map: tex,
          color: new THREE.Color(color),
          transparent: true,
          depthWrite: false,
        });
        cache.set(color, m);
      }
      return m;
    };
    const dimMat = new THREE.SpriteMaterial({
      map: tex,
      color: 0x8a8272,
      opacity: 0.22,
      transparent: true,
      depthWrite: false,
    });

    const st = store.current;
    st.renderer = renderer;
    st.camera = camera;
    st.controls = controls;
    st.scene = scene;
    st.matFor = matFor;
    st.hintFor = (color: string) => {
      let m = hintCache.get(color);
      if (!m) {
        m = new THREE.SpriteMaterial({
          map: tex,
          color: new THREE.Color(color),
          opacity: 0.42,
          transparent: true,
          depthWrite: false,
        });
        hintCache.set(color, m);
      }
      return m;
    };
    st.dimMat = dimMat;

    // 悬停光环（包住穴位点，脉动动画）
    const ring = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: makeRingTexture(),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        opacity: 0.95,
      })
    );
    ring.scale.setScalar(0.16);
    ring.visible = false;
    scene.add(ring);
    st.ring = ring;
    st.metaById = new Map(meridians.map((m) => [m.id, m]));

    // —— 图层与经络筛选的应用函数（挂载/切换时复用）——
    const applyLayer = () => {
      const muscleView = layerRef.current === "muscle";
      for (const m of st.skinMats) {
        m.opacity = muscleView ? 0.1 : 1;
        m.depthWrite = !muscleView;
      }
      for (const mm of st.muscleMeshes) mm.visible = muscleView;
    };
    st.applyLayer = applyLayer;

    const applyFilter = () => {
      st.clearHover?.();
      for (const sp of st.sprites) {
        const p = sp.userData.point as BronzePoint;
        const active =
          filterRef.current === "all" ||
          p.meridianId === filterRef.current ||
          jiaohuiRef.current.has(p.code);
        sp.material = active ? st.hintFor(p.color) : st.dimMat;
        sp.scale.setScalar(
          (sp.userData.baseScale as number) * (active ? 1 : 0.75)
        );
      }
      st.declutter?.();
    };
    st.applyFilter = applyFilter;

    // —— 穴位吸附：按当前性别模型重建全部标记 ——
    let firstMount = true;
    const mountBody = (g: Gender) => {
      const group = g === "female" ? st.femaleGroup : st.maleGroup;
      const surface = g === "female" ? st.femaleSurface : st.maleSurface;
      if (!group || !surface) return;
      st.clearHover?.();
      for (const sp of st.sprites) scene.remove(sp);
      st.sprites = [];
      group.updateMatrixWorld(true);
      st.body = surface;
      // 女体：穴位种子点经同场变形后再投射
      const remap = g === "female" ? femaleSeedSite : undefined;
      const sprites: THREE.Sprite[] = [];
      for (const p of points) {
        for (const side of ["front", "back"] as const) {
          const svg = side === "front" ? p.front : p.back;
          if (!svg) continue;
          const res =
            st.mode === "procedural"
              ? snapPointNaive(svg, side, surface)
              : snapPoint3D(svg, side, surface, remap);
          // 双侧对称：中线附近（任/督穴）只放一个标记
          const instances: { pos: THREE.Vector3; nrm: THREE.Vector3 }[] = [
            { pos: res.position, nrm: res.normal },
          ];
          if (Math.abs(res.position.x) > 0.006) {
            instances.push({
              pos: new THREE.Vector3(
                -res.position.x,
                res.position.y,
                res.position.z
              ),
              nrm: new THREE.Vector3(
                -res.normal.x,
                res.normal.y,
                res.normal.z
              ),
            });
          }
          for (const ins of instances) {
            const sprite = new THREE.Sprite(matFor(p.color));
            sprite.position.copy(ins.pos).addScaledVector(ins.nrm, 0.01);
            const baseScale = 0.026;
            sprite.scale.setScalar(baseScale);
            sprite.userData = { point: p, baseScale, side };
            scene.add(sprite);
            sprites.push(sprite);
          }
        }
      }
      st.sprites = sprites;
      // 标记挂载晚于首帧，强制重跑一次避让
      lastCamKey = "";
      applyFilter();
      // URL 参数或 Hash 联动聚焦（仅首次挂载）
      if (firstMount) {
        firstMount = false;
        const urlFocus =
          new URLSearchParams(window.location.search).get("focus") ||
          window.location.hash.match(/focus=([A-Za-z0-9]+)/)?.[1];
        if (urlFocus) {
          setTimeout(() => focusAcupoint(urlFocus), 200);
        }
      }
    };
    st.mountBody = mountBody;

    // —— 屏幕空间避让：穴位过密时按优先级隐藏重叠点，放大后自动展开 ——
    const declutter = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      const tanF = Math.tan(((camera.fov / 2) * Math.PI) / 180);
      const v = new THREE.Vector3();
      type Item = {
        sp: THREE.Sprite;
        x: number;
        y: number;
        r: number;
        d: number;
        pri: number;
        behind: boolean;
      };
      const items: Item[] = [];
      for (const sp of st.sprites) {
        v.copy(sp.position).project(camera);
        const behind = v.z > 1;
        const p = sp.userData.point as BronzePoint;
        const dist = camera.position.distanceTo(sp.position);
        const rPx = Math.max(
          3,
          ((sp.userData.baseScale as number) * 0.5 * (h / 2)) / (dist * tanF)
        );
        const active =
          filterRef.current === "all" ||
          p.meridianId === filterRef.current ||
          jiaohuiRef.current.has(p.code);
        items.push({
          sp,
          x: (v.x * 0.5 + 0.5) * w,
          y: (-v.y * 0.5 + 0.5) * h,
          r: rPx,
          d: dist,
          pri:
            (hovered === sp ? 100 : 0) +
            (active ? 10 : 0) +
            (behind ? -100 : 0) -
            dist * 0.01,
          behind,
        });
      }
      items.sort((a, b) => b.pri - a.pri || a.d - b.d);
      const placed: Item[] = [];
      for (const it of items) {
        if (it.behind || it.x < -40 || it.x > w + 40 || it.y < -40 || it.y > h + 40) {
          it.sp.visible = false;
          continue;
        }
        let clash = false;
        for (const p of placed) {
          const dx = it.x - p.x;
          const dy = it.y - p.y;
          const rr = it.r + p.r + 1;
          if (dx * dx + dy * dy < rr * rr) {
            clash = true;
            break;
          }
        }
        it.sp.visible = !clash;
        if (!clash) placed.push(it);
      }
    };
    st.declutter = declutter;
    let lastCamKey = "";
    const declutterIfMoved = () => {
      const k =
        camera.position.toArray().map((n) => n.toFixed(3)).join(",") +
        "|" +
        controls.target.toArray().map((n) => n.toFixed(3)).join(",");
      if (k !== lastCamKey) {
        lastCamKey = k;
        declutter();
      }
    };

    // —— 加载真实解剖模型；失败或超时回退到程序化铜人 ——
    const timeout = new Promise<never>((_, rej) =>
      setTimeout(() => rej(new Error("atlas timeout")), 30000)
    );
    // —— 材质：男/女共用肌肉材质，肤质按性别微调 ——
    const makeSkinMats = (skin: number, hair: number) => ({
      skin: new THREE.MeshStandardMaterial({
        color: skin,
        metalness: 0.8,
        roughness: 0.38,
        envMapIntensity: 0.9,
        transparent: true,
        opacity: 1,
      }),
      hair: new THREE.MeshStandardMaterial({
        color: hair,
        metalness: 0.5,
        roughness: 0.55,
        envMapIntensity: 0.6,
        transparent: true,
        opacity: 1,
      }),
      brow: new THREE.MeshStandardMaterial({
        color: 0x33291d,
        metalness: 0.4,
        roughness: 0.6,
        envMapIntensity: 0.5,
        transparent: true,
        opacity: 1,
      }),
      lip: new THREE.MeshStandardMaterial({
        color: 0x9c4f3f,
        metalness: 0.15,
        roughness: 0.5,
        envMapIntensity: 0.5,
        transparent: true,
        opacity: 1,
      }),
    });
    const muscleMat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      // 顶点色本身偏亮，叠一层偏暗的红棕乘色，在强光下仍保持解剖红肌质感
      color: 0x8a5a4c,
      metalness: 0.03,
      roughness: 0.8,
      envMapIntensity: 0.28,
    });

    /** 组装一个性别的模型组：体表网格单独成组（射线吸附只打体表），肌肉独立成网格 */
    const buildAtlasGroup = (
      model: AtlasModel,
      mats: ReturnType<typeof makeSkinMats>,
      name: Gender
    ) => {
      const group = new THREE.Group();
      group.name = name;
      const surface = new THREE.Group();
      surface.name = `${name}-surface`;
      surface.add(
        new THREE.Mesh(model.skin, mats.skin),
        new THREE.Mesh(model.hair, mats.hair),
        new THREE.Mesh(model.brow, mats.brow),
        new THREE.Mesh(model.lip, mats.lip)
      );
      const muscleMesh = new THREE.Mesh(model.muscle, muscleMat);
      muscleMesh.name = "muscle";
      muscleMesh.visible = false;
      group.add(surface, muscleMesh);
      return { group, surface, muscleMesh };
    };

    const ensureFemaleAtlas = () => {
      if (st.femaleGroup || !st.maleModel) return;
      const female = buildFemaleAtlas(st.maleModel);
      const mats = makeSkinMats(0xbd9a63, 0x42331f);
      const built = buildAtlasGroup(female, mats, "female");
      built.group.visible = false;
      scene.add(built.group);
      st.femaleGroup = built.group;
      st.femaleSurface = built.surface;
      st.skinMats.push(...Object.values(mats));
      st.muscleMeshes.push(built.muscleMesh);
      applyLayer();
    };
    st.ensureFemaleAtlas = ensureFemaleAtlas;

    // 程序化回退路径的女体
    const ensureFemaleProcedural = () => {
      if (st.femaleGroup) return;
      const body = buildBody("female");
      body.visible = false;
      scene.add(body);
      st.femaleGroup = body;
      st.femaleSurface = body;
    };
    st.ensureFemaleProcedural = ensureFemaleProcedural;

    // —— 切换性别：切换组可见性并重吸附穴位 ——
    const activateGender = (g: Gender) => {
      st.gender = g;
      if (st.maleGroup) st.maleGroup.visible = g === "male";
      if (st.femaleGroup) st.femaleGroup.visible = g === "female";
      mountBody(g);
    };
    st.activateGender = activateGender;

    loadAnatomyAtlas((msg, pct) => {
      if (!cancelled) setAtlasMsg(`${msg} ${Math.round(pct * 100)}%`);
    })
      .then((model) => Promise.race([Promise.resolve(model), timeout]))
      .then((model) => {
        if (cancelled) return;
        st.mode = "atlas";
        st.maleModel = model;
        const mats = makeSkinMats(0xb08d57, 0x4a3b28);
        st.skinMats.push(...Object.values(mats));
        const male = buildAtlasGroup(model, mats, "male");
        scene.add(male.group);
        st.maleGroup = male.group;
        st.maleSurface = male.surface;
        st.muscleMeshes.push(male.muscleMesh);
        applyLayer();
        mountBody("male");
        setAtlasState("ready");
      })
      .catch((err: unknown) => {
        console.error("[zhentu] 解剖模型加载失败，已回退简化建模：", err);
        if (cancelled) return;
        st.mode = "procedural";
        const body = buildBody("male");
        scene.add(body);
        st.maleGroup = body;
        st.maleSurface = body;
        mountBody("male");
        setAtlasState("fallback");
      });

    // —— 交互：悬停提示 + 点击跳转 ——
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const getHit = (e: PointerEvent): THREE.Sprite | null => {
      if (!st.body) return null;
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      );
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects([...st.sprites, st.body], true);
      const hit = hits.find((h) => h.object.visible);
      return hit && (hit.object as THREE.Sprite).isSprite
        ? (hit.object as THREE.Sprite)
        : null;
    };

    let hovered: THREE.Sprite | null = null;
    let downX = 0;
    let downY = 0;

    const restoreHover = () => {
      if (hovered) {
        hovered.material =
          (hovered.userData.prevMat as THREE.SpriteMaterial) ?? hovered.material;
        hovered.scale.setScalar(hovered.userData.baseScale as number);
        hovered = null;
      }
    };

    const clearHover = () => {
      restoreHover();
      if (st.ring) st.ring.visible = false;
      const tip = tooltipRef.current;
      if (tip) {
        tip.classList.remove("show");
        tip.style.opacity = "0";
      }
    };
    st.clearHover = clearHover;

    const showTipFor = (sp: THREE.Sprite) => {
      const p = sp.userData.point as BronzePoint;
      const m = st.metaById?.get(p.meridianId);
      const tip = tooltipRef.current;
      if (!tip) return;
      tip.innerHTML =
        `<span class="tip3d-dot" style="background:${m?.color ?? "#8a8272"}"></span>` +
        `<b>${p.name}</b><span class="tip3d-code">${p.code} · ${m?.name ?? ""}</span>` +
        `<span class="tip3d-hint">点击查看详情 →</span>`;
      tip.style.borderTopColor = m?.color ?? "#a83f2e";
      tip.classList.add("show");
      tip.style.opacity = "1";
    };

    const focusAcupoint = (code: string) => {
      const upper = code.trim().toUpperCase();
      const match =
        st.sprites.find(
          (sp) =>
            (sp.userData.point as BronzePoint).code.toUpperCase() === upper &&
            sp.userData.side === "front"
        ) ||
        st.sprites.find(
          (sp) =>
            (sp.userData.point as BronzePoint).code.toUpperCase() === upper
        );
      if (!match) return;
      const p = match.userData.point as BronzePoint;
      setFilter(p.meridianId);

      const isBack = match.userData.side === "back" || (!!p.back && !p.front);
      const targetTheta = isBack ? Math.PI : 0;

      const targetY = THREE.MathUtils.clamp(match.position.y, -1.2, 1.4);
      const startTarget = controls.target.clone();
      const endTarget = new THREE.Vector3(0, targetY, 0);

      const targetDist = 2.0;
      const sph = new THREE.Spherical().setFromVector3(
        camera.position.clone().sub(controls.target)
      );
      const startSph = sph.clone();
      let deltaTheta = targetTheta - startSph.theta;
      deltaTheta = Math.atan2(Math.sin(deltaTheta), Math.cos(deltaTheta));

      const t0 = performance.now();
      const anim = (now: number) => {
        const k = Math.min(1, (now - t0) / 800);
        const e = 1 - Math.pow(1 - k, 3);
        controls.target.lerpVectors(startTarget, endTarget, e);
        sph.theta = startSph.theta + deltaTheta * e;
        sph.radius = THREE.MathUtils.lerp(startSph.radius, targetDist, e);
        sph.phi = THREE.MathUtils.lerp(startSph.phi, Math.PI / 2, e);
        camera.position.setFromSpherical(sph).add(controls.target);
        controls.update();
        if (k < 1) {
          requestAnimationFrame(anim);
        } else {
          restoreHover();
          hovered = match;
          match.userData.prevMat = match.material;
          match.material = st.matFor(p.color);
          match.scale.setScalar((match.userData.baseScale as number) * 2.2);
          showTipFor(match);
          if (st.ring) {
            st.ring.visible = true;
            st.ring.position.copy(match.position);
            const m = st.metaById?.get(p.meridianId);
            (st.ring.material as THREE.SpriteMaterial).color.set(
              m?.color ?? "#a83f2e"
            );
          }
        }
      };
      requestAnimationFrame(anim);
    };
    st.focusAcupoint = focusAcupoint;

    const onHashChange = () => {
      const hf = window.location.hash.match(/focus=([A-Za-z0-9]+)/)?.[1];
      if (hf) focusAcupoint(hf);
    };
    window.addEventListener("hashchange", onHashChange);

    const onMove = (e: PointerEvent) => {
      const sp = getHit(e);
      if (sp === hovered) return;
      restoreHover();
      hovered = sp;
      if (sp) {
        // 悬停高亮：恢复完整材质 + 放大 + 光环 + 提示卡片
        sp.userData.prevMat = sp.material;
        sp.material = st.matFor((sp.userData.point as BronzePoint).color);
        sp.scale.setScalar((sp.userData.baseScale as number) * 2.2);
        showTipFor(sp);
        if (st.ring) {
          st.ring.visible = true;
          const m = st.metaById?.get((sp.userData.point as BronzePoint).meridianId);
          (st.ring.material as THREE.SpriteMaterial).color.set(
            m?.color ?? "#a83f2e"
          );
        }
      } else {
        if (st.ring) st.ring.visible = false;
        const tip = tooltipRef.current;
        if (tip) {
          tip.classList.remove("show");
          tip.style.opacity = "0";
        }
      }
    };
    const onLeave = () => clearHover();
    const onDown = (e: PointerEvent) => {
      downX = e.clientX;
      downY = e.clientY;
    };
    const onUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - downX, e.clientY - downY) < 6) {
        const sp = getHit(e);
        if (sp) {
          const p = sp.userData.point as BronzePoint;
          const base = import.meta.env.BASE_URL.replace(/\/$/, "");
          window.location.href = `${base}/acupoints/${p.code}/`;
        }
      }
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerleave", onLeave);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const onResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      if (!w || !h) return;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(container);

    let raf = 0;
    const proj = new THREE.Vector3();
    const startT = performance.now();
    const loop = () => {
      controls.update();
      declutterIfMoved();
      const t = (performance.now() - startT) / 1000;
      // 悬停：光环脉动 + 提示卡片跟随穴位（随视角实时投影）
      if (hovered && st.ring) {
        st.ring.position.copy(hovered.position);
        st.ring.scale.setScalar(0.13 + 0.035 * Math.sin(t * 5));
        proj.copy(hovered.position).project(camera);
        const tip = tooltipRef.current;
        if (tip) {
          const w = container.clientWidth;
          const h = container.clientHeight;
          tip.style.left = `${(proj.x * 0.5 + 0.5) * w}px`;
          tip.style.top = `${(-proj.y * 0.5 + 0.5) * h}px`;
          tip.style.opacity = proj.z < 1 ? "1" : "0";
        }
      }
      renderer.render(scene, camera);
      raf = requestAnimationFrame(loop);
    };
    loop();

    // 调试钩子（开发排查用）
    (window as unknown as Record<string, unknown>).__zhentuDebug = (code?: string) => ({
      sprites: st.sprites.length,
      bodyReady: !!st.body,
      hovered: !!hovered,
      gender: st.gender,
      scene,
      probe: code
        ? st.sprites
            .filter((sp) => (sp.userData.point as BronzePoint).code === code)
            .map((sp) => sp.position.toArray().map((v) => +v.toFixed(3)))
        : undefined,
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener("hashchange", onHashChange);
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerleave", onLeave);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      scene.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
    // points / meridians 由构建期生成，视为稳定
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // —— 图层切换：皮肤（不透明）↔ 肌肉（皮肤半透明），双性别材质一并处理 ——
  useEffect(() => {
    store.current.applyLayer?.();
  }, [layer, atlasState]);

  // —— 经络筛选：选中经络只做提示（半透明淡显），悬停单个穴位时才完整高亮 ——
  useEffect(() => {
    store.current.applyFilter?.();
  }, [filter, jiaohuiSet, atlasState]);

  // —— 性别切换：女性解剖模型按需生成（变形约 1s，先显示提示再构建） ——
  const switchGender = (g: Gender) => {
    if (g === gender || building || failed) return;
    const st = store.current;
    if (g === "female" && !st.femaleGroup) {
      setBuilding(true);
      setTimeout(() => {
        try {
          if (atlasState === "ready") st.ensureFemaleAtlas?.();
          else st.ensureFemaleProcedural?.();
        } finally {
          setBuilding(false);
        }
        st.activateGender?.(g);
        setGender(g);
      }, 30);
    } else {
      st.activateGender?.(g);
      setGender(g);
    }
  };

  const rotateTo = (theta: number) => {
    const { camera, controls } = store.current;
    if (!camera || !controls) return;
    const target = controls.target;
    const sph = new THREE.Spherical().setFromVector3(
      camera.position.clone().sub(target)
    );
    const start = sph.theta;
    let delta = theta - start;
    delta = Math.atan2(Math.sin(delta), Math.cos(delta));
    const t0 = performance.now();
    const anim = (t: number) => {
      const k = Math.min(1, (t - t0) / 650);
      const e = 1 - Math.pow(1 - k, 3);
      sph.theta = start + delta * e;
      camera.position.setFromSpherical(sph).add(target);
      camera.lookAt(target);
      if (k < 1) requestAnimationFrame(anim);
    };
    requestAnimationFrame(anim);
  };

  const resetView = () => {
    const { camera, controls } = store.current;
    if (!camera || !controls) return;
    controls.target.set(0, 0.02, 0);
    camera.position.set(0, 0.12, 5.2);
    controls.update();
  };

  if (failed) {
    return (
      <div className="p-10 text-center text-sm text-ink-soft">
        当前浏览器不支持 WebGL，无法显示 3D 铜人。请改用
        <a href={`${import.meta.env.BASE_URL}/atlas/`} className="mx-1 text-qing hover:underline">
          2D 穴位图
        </a>
        浏览穴位。
      </div>
    );
  }

  return (
    <div>
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-paper-deep/40 p-3">
        <button
          onClick={() => setFilter("all")}
          className={`rounded-full border px-3 py-1 text-sm transition-colors ${
            filter === "all"
              ? "border-ink bg-ink text-paper"
              : "border-line bg-card text-ink-soft hover:border-ink-soft"
          }`}
        >
          全部经络
        </button>
        {meridians.map((m) => (
          <button
            key={m.id}
            onClick={() => setFilter((f) => (f === m.id ? "all" : m.id))}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
              filter === m.id
                ? "border-transparent font-bold text-paper"
                : "border-line bg-card text-ink-soft hover:border-ink-soft"
            }`}
            style={filter === m.id ? { backgroundColor: m.color } : undefined}
          >
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: m.color }}
            />
            {m.name}
          </button>
        ))}
        <span className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="search"
            placeholder="定位穴位 (如 LI4 / 足三里)"
            value={directSearch}
            onChange={(e) => {
              const val = e.target.value;
              setDirectSearch(val);
              const exact = points.find(
                (p) =>
                  p.code.toLowerCase() === val.trim().toLowerCase() ||
                  p.name === val.trim()
              );
              if (exact) {
                store.current.focusAcupoint?.(exact.code);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && directSearch.trim()) {
                const q = directSearch.trim().toLowerCase();
                const found = points.find(
                  (p) =>
                    p.code.toLowerCase() === q ||
                    p.name.includes(directSearch.trim())
                );
                if (found) {
                  store.current.focusAcupoint?.(found.code);
                }
              }
            }}
            className="h-7 w-36 rounded border border-line bg-card px-2 text-xs text-ink placeholder:text-ink-faint focus:border-qing focus:outline-none sm:w-44"
          />
          {atlasState !== "loading" && (
            <span className="flex overflow-hidden rounded-md border border-line">
              {(["male", "female"] as const).map((g) => (
                <button
                  key={g}
                  onClick={() => switchGender(g)}
                  disabled={building}
                  className={`px-3 py-1 text-sm disabled:opacity-50 ${
                    gender === g
                      ? "bg-ink text-paper"
                      : "bg-card text-ink-soft hover:bg-paper-deep"
                  }`}
                >
                  {g === "male" ? "男" : "女"}
                </button>
              ))}
            </span>
          )}
          {atlasState === "ready" && (
            <span className="flex overflow-hidden rounded-md border border-line">
              {(["skin", "muscle"] as const).map((l) => (
                <button
                  key={l}
                  onClick={() => setLayer(l)}
                  className={`px-3 py-1 text-sm ${
                    layer === l
                      ? "bg-ink text-paper"
                      : "bg-card text-ink-soft hover:bg-paper-deep"
                  }`}
                >
                  {l === "skin" ? "皮肤" : "肌肉"}
                </button>
              ))}
            </span>
          )}
          <span className="flex overflow-hidden rounded-md border border-line">
            <button
              onClick={() => rotateTo(0)}
              className="bg-card px-3 py-1 text-sm text-ink-soft hover:bg-paper-deep"
            >
              正面
            </button>
            <button
              onClick={() => rotateTo(Math.PI)}
              className="border-l border-line bg-card px-3 py-1 text-sm text-ink-soft hover:bg-paper-deep"
            >
              背面
            </button>
            <button
              onClick={resetView}
              className="border-l border-line bg-card px-3 py-1 text-xs text-ink-soft hover:bg-paper-deep"
            >
              重置视角
            </button>
          </span>
        </span>
      </div>

      {/* 3D 画布 */}
      <div
        ref={containerRef}
        className="relative h-[560px] w-full cursor-grab active:cursor-grabbing md:h-[620px]"
        style={{
          background:
            "radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.9), rgba(236,228,208,0.9) 70%)",
        }}
      >
        <div ref={tooltipRef} className="tip3d" style={{ opacity: 0 }} />
        {atlasState === "loading" && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <div className="rounded-lg border border-line bg-card/95 px-6 py-4 text-center shadow-md">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-qing border-t-transparent" />
              <p className="mt-3 text-sm text-ink-soft">{atlasMsg}</p>
              <p className="mt-1 text-xs text-ink-faint">
                首次加载约 23MB，之后由浏览器缓存
              </p>
            </div>
          </div>
        )}
        {atlasState === "fallback" && (
          <div className="pointer-events-none absolute bottom-3 right-3 rounded-md bg-card/85 px-3 py-1.5 text-xs text-ink-faint shadow-sm">
            解剖模型离线不可用，已切换简化建模
          </div>
        )}
        {building && (
          <div className="absolute inset-0 z-10 grid place-items-center">
            <div className="rounded-lg border border-line bg-card/95 px-6 py-4 text-center shadow-md">
              <div className="mx-auto h-6 w-6 animate-spin rounded-full border-2 border-qing border-t-transparent" />
              <p className="mt-3 text-sm text-ink-soft">正在生成女性模型…</p>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-3 left-3 rounded-md bg-card/85 px-3 py-1.5 text-xs text-ink-faint shadow-sm">
          左键拖拽旋转 · 滚轮缩放 · 右键平移 · 悬停高亮并看穴名 · 点击进详情 · 可切换男/女体型 · 密集处自动避让，放大查看全部 · 选经络为提示态，悬停单穴高亮
        </div>
      </div>
    </div>
  );
}

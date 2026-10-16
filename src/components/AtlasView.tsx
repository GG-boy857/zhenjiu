import { useEffect, useMemo, useRef, useState } from "react";
import {
  ARM_LEFT,
  BACK_DETAIL_CENTER,
  BACK_DETAIL_LEFT,
  BODY_FILL,
  BODY_MIDLINE,
  BODY_STROKE,
  EAR_LEFT,
  FACE,
  FRONT_DETAIL_CENTER,
  FRONT_DETAIL_LEFT,
  HAIR_BACK,
  HAIR_BACK_STRANDS,
  HAIR_FILL,
  HAIR_FRONT,
  HEAD,
  SIDEBURN,
  TORSO_LEFT,
  VIEWBOX,
  mirrorTransform,
} from "../lib/svg-data";

export interface AtlasPoint {
  code: string;
  name: string;
  nameEn: string;
  meridianId: string;
  color: string;
  front?: [number, number];
  back?: [number, number];
}

export interface AtlasMeridianMeta {
  id: string;
  name: string;
  code: string;
  color: string;
  /** 交会穴代码（穴位实体位于其他经络） */
  jiaohui?: string[];
  /** 循行示意线（左半边坐标，组件负责镜像） */
  pathFront?: [number, number][];
  pathBack?: [number, number][];
}

interface HoverInfo {
  point: AtlasPoint;
  x: number;
  y: number;
}

const toPathD = (pts: [number, number][]) =>
  pts.map(([x, y], i) => `${i === 0 ? "M" : "L"} ${x},${y}`).join(" ");

const withBase = (p: string) =>
  (import.meta.env.BASE_URL.replace(/\/$/, "") || "") + p;

export default function AtlasView({
  points,
  meridians,
}: {
  points: AtlasPoint[];
  meridians: AtlasMeridianMeta[];
}) {
  const [side, setSide] = useState<"front" | "back">("front");
  const [filter, setFilter] = useState<string>("all");
  const [hover, setHover] = useState<HoverInfo | null>(null);
  const [focusCode, setFocusCode] = useState<string | null>(null);
  const [view, setView] = useState({ scale: 1, tx: 0, ty: 0 });
  const svgRef = useRef<SVGSVGElement | null>(null);
  const viewRef = useRef(view);
  const dragRef = useRef<{ startX: number; startY: number; tx: number; ty: number; moved: boolean } | null>(null);
  const dragMovedRef = useRef(false);

  useEffect(() => {
    viewRef.current = view;
  }, [view]);

  const clampView = (v: { scale: number; tx: number; ty: number }) => {
    const scale = Math.min(6, Math.max(1, v.scale));
    if (scale === 1) return { scale: 1, tx: 0, ty: 0 };
    const vw = VIEWBOX.width / scale;
    const vh = VIEWBOX.height / scale;
    return {
      scale,
      tx: Math.min(VIEWBOX.width - vw, Math.max(0, v.tx)),
      ty: Math.min(VIEWBOX.height - vh, Math.max(0, v.ty)),
    };
  };

  const zoomAt = (factor: number, ax?: number, ay?: number) => {
    setView((v) => {
      const scale = Math.min(6, Math.max(1, v.scale * factor));
      if (scale === 1) return { scale: 1, tx: 0, ty: 0 };
      const cx = ax ?? v.tx + VIEWBOX.width / v.scale / 2;
      const cy = ay ?? v.ty + VIEWBOX.height / v.scale / 2;
      const k = scale / v.scale;
      return clampView({ scale, tx: cx - (cx - v.tx) * k, ty: cy - (cy - v.ty) * k });
    });
  };

  // 滚轮缩放（以光标为中心）
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = viewRef.current;
      const rect = svg.getBoundingClientRect();
      const ux = v.tx + ((e.clientX - rect.left) / rect.width) * (VIEWBOX.width / v.scale);
      const uy = v.ty + ((e.clientY - rect.top) / rect.height) * (VIEWBOX.height / v.scale);
      zoomAt(Math.pow(1.0015, -e.deltaY), ux, uy);
    };
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (viewRef.current.scale === 1) return;
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      tx: viewRef.current.tx,
      ty: viewRef.current.ty,
      moved: false,
    };
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d || !svgRef.current) return;
    if (Math.abs(e.clientX - d.startX) + Math.abs(e.clientY - d.startY) > 4) d.moved = true;
    const rect = svgRef.current.getBoundingClientRect();
    const v = viewRef.current;
    const dx = ((e.clientX - d.startX) / rect.width) * (VIEWBOX.width / v.scale);
    const dy = ((e.clientY - d.startY) / rect.height) * (VIEWBOX.height / v.scale);
    setView(clampView({ scale: v.scale, tx: d.tx - dx, ty: d.ty - dy }));
  };

  const onPointerUp = () => {
    dragMovedRef.current = dragRef.current?.moved ?? false;
    dragRef.current = null;
    setTimeout(() => {
      dragMovedRef.current = false;
    }, 60);
  };

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("focus");
    if (q) {
      setFocusCode(q);
      const target = points.find((p) => p.code === q);
      if (target) {
        setFilter(target.meridianId);
        // 定位特写：自动放大并以穴位为中心
        const coord = target.front ?? target.back;
        if (coord) {
          const scale = 2.4;
          setView(
            clampView({
              scale,
              tx: coord[0] - VIEWBOX.width / (2 * scale),
              ty: coord[1] - VIEWBOX.height / (2 * scale),
            })
          );
        }
      }
    }
    // 仅在挂载时读取一次 URL 参数
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const focusPoint = useMemo(
    () => (focusCode ? points.find((p) => p.code === focusCode) ?? null : null),
    [focusCode, points]
  );

  const visiblePoints = useMemo(
    () => points.filter((p) => (side === "front" ? p.front : p.back)),
    [points, side]
  );

  const activeMeta = meridians.find((m) => m.id === filter);
  const jiaohuiSet = useMemo(
    () => new Set(activeMeta?.jiaohui ?? []),
    [activeMeta]
  );

  const isActiveSide = (p: AtlasPoint) =>
    filter === "all" ||
    p.meridianId === filter ||
    jiaohuiSet.has(p.code) ||
    p.code === focusCode;

  const isFocusAt = (p: AtlasPoint, x: number, y: number) => {
    if (!focusPoint) return false;
    const coord = side === "front" ? focusPoint.front : focusPoint.back;
    if (!coord) return false;
    const fx = side === "front" && coord[0] > BODY_MIDLINE ? VIEWBOX.width - coord[0] : coord[0];
    return Math.abs(fx - x) < 0.5 && Math.abs(coord[1] - y) < 0.5;
  };

  const dimmed = (p: AtlasPoint) =>
    filter !== "all" && p.meridianId !== filter && !jiaohuiSet.has(p.code) && p.code !== focusCode;

  const renderPoints = () => {
    const nodes = [];
    for (const p of visiblePoints) {
      const coord = side === "front" ? p.front : p.back;
      if (!coord) continue;
      const active = isActiveSide(p);
      for (const x of [coord[0], VIEWBOX.width - coord[0]]) {
        const isFocus = isFocusAt(p, x, coord[1]);
        nodes.push(
          <a
            key={`${p.code}-${x}`}
            href={withBase(`/acupoints/${p.code}/`)}
            aria-label={`${p.name}（${p.code}）`}
            className="cursor-pointer"
            onMouseEnter={() => setHover({ point: p, x, y: coord[1] })}
            onMouseLeave={() => setHover((h) => (h && h.point.code === p.code ? null : h))}
            onFocus={() => setHover({ point: p, x, y: coord[1] })}
            onBlur={() => setHover(null)}
          >
            {isFocus && <circle className="zhentu-pulse" cx={x} cy={coord[1]} r={6} />}
            <circle
              cx={x}
              cy={coord[1]}
              r={hover && hover.point.code === p.code ? 6 : active ? 5 : 3.5}
              fill={p.color}
              fillOpacity={dimmed(p) ? 0.15 : 0.92}
              stroke="#fbf8f0"
              strokeWidth={1.2}
            />
          </a>
        );
      }
    }
    return nodes;
  };

  const labelToLeft = hover && hover.x > VIEWBOX.width / 2;
  const infoPoint = hover?.point ?? focusPoint;

  const detailStrokes = (left: string[], center: string[]) => (
    <g stroke={BODY_STROKE} strokeWidth={1.3} fill="none" opacity={0.5} strokeLinecap="round">
      {left.map((d, i) => (
        <path key={`l${i}`} d={d} />
      ))}
      <g transform={mirrorTransform()}>
        {left.map((d, i) => (
          <path key={`ml${i}`} d={d} />
        ))}
      </g>
      {center.map((d, i) => (
        <path key={`c${i}`} d={d} />
      ))}
    </g>
  );

  return (
    <div className="space-y-4">
      {/* 工具栏：经络筛选 + 视图切换 */}
      <div className="flex flex-wrap items-center gap-2">
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
        <span className="ml-auto flex items-center gap-2">
          <span className="flex items-center overflow-hidden rounded-md border border-line">
            <button
              onClick={() => zoomAt(1 / 1.4)}
              disabled={view.scale === 1}
              aria-label="缩小"
              className="px-2.5 py-1 text-sm text-ink-soft hover:bg-paper-deep disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-12 border-x border-line bg-card px-1 py-1 text-center text-xs text-ink-faint">
              ×{view.scale.toFixed(1)}
            </span>
            <button
              onClick={() => zoomAt(1.4)}
              disabled={view.scale >= 6}
              aria-label="放大"
              className="px-2.5 py-1 text-sm text-ink-soft hover:bg-paper-deep disabled:opacity-40"
            >
              ＋
            </button>
            <button
              onClick={() => setView({ scale: 1, tx: 0, ty: 0 })}
              disabled={view.scale === 1}
              className="border-l border-line bg-card px-2.5 py-1 text-xs text-ink-soft hover:bg-paper-deep disabled:opacity-40"
            >
              复位
            </button>
          </span>
          <span className="flex overflow-hidden rounded-md border border-line">
            {(["front", "back"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSide(s)}
                className={`px-3 py-1 text-sm ${
                  side === s ? "bg-ink text-paper" : "bg-card text-ink-soft hover:bg-paper-deep"
                }`}
              >
                {s === "front" ? "正面" : "背面"}
              </button>
            ))}
          </span>
        </span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        {/* 人体图 */}
        <div className="flex-1">
          <svg
            ref={svgRef}
            viewBox={`${view.tx} ${view.ty} ${VIEWBOX.width / view.scale} ${VIEWBOX.height / view.scale}`}
            className={`mx-auto block max-w-[380px] touch-none rounded-lg border border-line bg-card ${
              view.scale > 1 ? "cursor-grab active:cursor-grabbing" : ""
            }`}
            role="img"
            aria-label={`${side === "front" ? "正面" : "背面"}人体穴位示意图（可用滚轮或按钮缩放）`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
            onClickCapture={(e) => {
              // 拖拽平移后拦截误触的穴位点击
              if (dragMovedRef.current) {
                e.preventDefault();
                e.stopPropagation();
              }
            }}
          >
            {/* 身体轮廓 */}
            <g stroke={BODY_STROKE} strokeWidth={2} fill={BODY_FILL} strokeLinejoin="round">
              <path d={ARM_LEFT} />
              <g transform={mirrorTransform()}>
                <path d={ARM_LEFT} />
              </g>
              <path d={TORSO_LEFT} />
              <g transform={mirrorTransform()}>
                <path d={TORSO_LEFT} />
              </g>
              <path d={EAR_LEFT} />
              <g transform={mirrorTransform()}>
                <path d={EAR_LEFT} />
              </g>
              <path d={HEAD} />
            </g>

            {side === "front" ? (
              <>
                {/* 发型与鬓角 */}
                <path d={HAIR_FRONT} fill={HAIR_FILL} stroke={BODY_STROKE} strokeWidth={1.5} />
                <g stroke={HAIR_FILL} strokeWidth={1.5} fill="none" strokeLinecap="round">
                  <path d={SIDEBURN} />
                  <g transform={mirrorTransform()}>
                    <path d={SIDEBURN} />
                  </g>
                </g>
                {/* 肌理细节 */}
                {detailStrokes(FRONT_DETAIL_LEFT, FRONT_DETAIL_CENTER)}
                {/* 五官 */}
                <g stroke={BODY_STROKE} fill="none" strokeLinecap="round">
                  {FACE.brows.map((d, i) => (
                    <path key={i} d={d} strokeWidth={2.2} />
                  ))}
                  <path d={FACE.noseBridge} strokeWidth={1.2} />
                  <path d={FACE.noseBase} strokeWidth={1.4} />
                  <path d={FACE.mouth} strokeWidth={1.8} />
                  <path d={FACE.lowerLip} strokeWidth={1} opacity={0.55} />
                </g>
                {FACE.eyes.map((e, i) => (
                  <g key={i}>
                    <path d={e.lid} fill="#fdfaf3" stroke={BODY_STROKE} strokeWidth={1} />
                    <circle cx={e.iris.x} cy={e.iris.y} r={1.9} fill={HAIR_FILL} />
                  </g>
                ))}
                {FACE.nostrils.map((n, i) => (
                  <circle key={i} cx={n.x} cy={n.y} r={1.2} fill={BODY_STROKE} />
                ))}
              </>
            ) : (
              <>
                {/* 背面发型（覆盖后脑） */}
                <path d={HAIR_BACK} fill={HAIR_FILL} stroke={BODY_STROKE} strokeWidth={1.5} />
                <g stroke="#f0e8d5" strokeWidth={1.2} fill="none" opacity={0.35}>
                  {HAIR_BACK_STRANDS.map((d, i) => (
                    <path key={i} d={d} />
                  ))}
                </g>
                {/* 肩胛、脊柱、臀线等肌理 */}
                {detailStrokes(BACK_DETAIL_LEFT, BACK_DETAIL_CENTER)}
              </>
            )}

            {/* 奇经循行示意线（选中该脉时显示） */}
            {activeMeta &&
              (side === "front" ? activeMeta.pathFront : activeMeta.pathBack) && (
                <g>
                  <path
                    className="vessel-path"
                    d={toPathD(
                      (side === "front" ? activeMeta.pathFront : activeMeta.pathBack)!
                    )}
                    fill="none"
                    stroke={activeMeta.color}
                    strokeWidth={2.5}
                    strokeDasharray="7 5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    opacity={0.8}
                  />
                  <g transform={mirrorTransform()}>
                    <path
                      className="vessel-path"
                      d={toPathD(
                        (side === "front" ? activeMeta.pathFront : activeMeta.pathBack)!
                      )}
                      fill="none"
                      stroke={activeMeta.color}
                      strokeWidth={2.5}
                      strokeDasharray="7 5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      opacity={0.8}
                    />
                  </g>
                </g>
              )}

            {/* 穴位标记 */}
            {renderPoints()}

            {/* 悬停标签 */}
            {hover && (
              <g pointerEvents="none">
                <text
                  x={labelToLeft ? hover.x - 12 : hover.x + 12}
                  y={hover.y - 10}
                  textAnchor={labelToLeft ? "end" : "start"}
                  fontSize={14 / view.scale}
                  fontWeight={700}
                  fill="#2c2a26"
                  stroke="#fbf8f0"
                  strokeWidth={3.5 / view.scale}
                  paintOrder="stroke"
                >
                  {hover.point.name} {hover.point.code}
                </text>
              </g>
            )}
          </svg>
        </div>

        {/* 侧栏：当前穴位信息 + 说明 */}
        <aside className="w-full space-y-4 lg:w-64">
          <div className="paper-card p-4">
            <h3 className="text-sm font-bold text-ink-faint">当前穴位</h3>
            {infoPoint ? (
              <div className="mt-2 space-y-1">
                <p className="text-xl font-bold">
                  {infoPoint.name}
                  <span className="ml-2 text-sm font-normal text-ink-soft">{infoPoint.code}</span>
                </p>
                <p className="text-sm text-ink-faint">{infoPoint.nameEn}</p>
                <div className="mt-3 flex flex-col gap-1.5">
                  <a
                    href={withBase(`/acupoints/${infoPoint.code}/`)}
                    className="inline-block rounded-md bg-vermilion px-3 py-1.5 text-center text-sm font-bold text-paper transition-colors hover:bg-vermilion-soft"
                  >
                    查看详情 →
                  </a>
                  <a
                    href={`${withBase("/")}?focus=${infoPoint.code}#bronze3d`}
                    className="inline-block rounded-md border border-line bg-card px-3 py-1 text-center text-xs font-bold text-ink-soft transition-colors hover:border-qing-soft hover:text-qing"
                  >
                    在 3D 铜人中特写 →
                  </a>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-sm text-ink-faint">
                将鼠标移到穴位点上查看名称；点击进入穴位详情页。
              </p>
            )}
          </div>

          <div className="paper-card p-4 text-sm text-ink-soft">
            <h3 className="text-sm font-bold text-ink-faint">图例说明</h3>
            <ul className="mt-2 space-y-1.5">
              <li>· 每个圆点为一个穴位，左右对称显示</li>
              <li>· 滚轮或 ＋/− 按钮可缩放特写，放大后可拖拽平移</li>
              <li>· 点击上方经络名可只高亮该经穴位</li>
              <li>· 圆点颜色对应所属经络（与经络页一致）</li>
              <li>· 选中奇经八脉时显示虚线循行示意线与该脉交会穴位</li>
              <li>· 膀胱经、督脉、小肠经等背面穴位已收录，可切换视图查看</li>
              <li>· 铜人图为教学示意，取穴以文字定位与国标为准</li>
            </ul>
          </div>
        </aside>
      </div>
    </div>
  );
}

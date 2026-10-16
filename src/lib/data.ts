import acupointsJson from "../data/acupoints.json";
import meridiansJson from "../data/meridians.json";
import type { Acupoint, Meridian } from "../types";

/**
 * 穴位数据来源：
 * - `src/data/acupoints.json`：肺经、大肠经、胃经（历史文件，继续可用）
 * - `src/data/acupoints/<meridianId>.json`：其余经络，一经一文件，便于维护
 * 两处按键合并（键为穴位代码），重复键以后加载的分文件为准。
 */
const extraModules = import.meta.glob("../data/acupoints/*.json", { eager: true });

const extras = Object.values(extraModules).map(
  (m) => (m as { default: Record<string, Acupoint> }).default ?? (m as unknown as Record<string, Acupoint>)
);

export const acupoints = Object.assign(
  {} as Record<string, Acupoint>,
  acupointsJson as unknown as Record<string, Acupoint>,
  ...extras
);

export const meridians = meridiansJson as unknown as Meridian[];

export const acupointList: Acupoint[] = Object.values(acupoints);

export function getMeridian(id: string): Meridian | undefined {
  return meridians.find((m) => m.id === id);
}

export function meridianOf(point: Acupoint): Meridian | undefined {
  return getMeridian(point.meridianId);
}

/** 按经络的 points 数组顺序返回其穴位（国标编号序） */
export function pointsOfMeridian(id: string): Acupoint[] {
  const m = getMeridian(id);
  if (!m) return [];
  return m.points.map((c) => acupoints[c]).filter(Boolean);
}

export function meridiansWithData(): Meridian[] {
  return meridians.filter((m) => m.points.length > 0);
}

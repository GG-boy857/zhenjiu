/**
 * 学习进度（已学习/未学习）：存于浏览器 localStorage。
 * 结构：{ [code]: { learned: boolean; learnedAt: number } }
 * 每次变更派发 window 事件 PROGRESS_EVENT，各列表页徽标据此实时刷新。
 */
import { dateStamp, downloadJson } from "./notes";

export type ProgressEntry = { learned: boolean; learnedAt: number };
export type ProgressMap = Record<string, ProgressEntry>;

const KEY = "zhentu.progress.v1";
export const PROGRESS_EVENT = "zhentu:progress";

export function readProgress(): ProgressMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as ProgressMap;
  } catch {
    return {};
  }
}

function writeProgress(map: ProgressMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(PROGRESS_EVENT));
}

export function isLearned(code: string): boolean {
  return readProgress()[code]?.learned === true;
}

export function setLearned(code: string, learned: boolean) {
  const map = readProgress();
  if (learned) map[code] = { learned: true, learnedAt: Date.now() };
  else delete map[code];
  writeProgress(map);
}

export function toggleLearned(code: string): boolean {
  const next = !isLearned(code);
  setLearned(code, next);
  return next;
}

export function getLearnedCodes(): string[] {
  const map = readProgress();
  return Object.keys(map).filter((c) => map[c]?.learned);
}

export function countLearned(): number {
  return getLearnedCodes().length;
}

/** 统计一组穴位中已学习的数量 */
export function countLearnedAmong(codes: string[]): number {
  const map = readProgress();
  return codes.filter((c) => map[c]?.learned).length;
}

/** 导出学习记录 JSON 文件并下载 */
export function exportProgress() {
  const payload = {
    type: "zhentu-progress",
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: readProgress(),
  };
  downloadJson(payload, `zhentu-progress-${dateStamp()}.json`);
}

/** 导入学习记录（合并），返回导入条数 */
export function importProgress(raw: string): number {
  const parsed = JSON.parse(raw) as {
    type?: string;
    progress?: ProgressMap;
  };
  if (parsed.type !== "zhentu-progress" || !parsed.progress) {
    throw new Error("文件格式不正确，请选择本站导出的学习记录 JSON");
  }
  const map = readProgress();
  let imported = 0;
  for (const [code, entry] of Object.entries(parsed.progress)) {
    if (!entry || typeof entry.learned !== "boolean") continue;
    const current = map[code];
    if (!current || (current.learnedAt ?? 0) < (entry.learnedAt ?? 0)) {
      map[code] = { learned: true, learnedAt: entry.learnedAt ?? Date.now() };
      imported++;
    }
  }
  writeProgress(map);
  return imported;
}

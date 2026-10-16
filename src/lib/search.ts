/**
 * 全局搜索：构建可检索索引并按相关度打分。
 * 支持穴位名（中文）、国际代码（LI4）、拼音（nameEn）、主治病症、定位描述。
 */
import type { Acupoint, Meridian } from "../types";

export interface SearchDoc {
  code: string;
  name: string;
  nameEn: string;
  meridianId: string;
  meridianName: string;
  meridianCode: string;
  color: string;
  location: string;
  indications: string[];
}

export interface SearchResult {
  doc: SearchDoc;
  score: number;
  /** 命中的字段名，用于展示“匹配于：主治”等提示 */
  matched: string;
  /** 命中上下文片段，用于高亮 */
  snippet: string;
}

export function buildSearchIndex(
  acupoints: Record<string, Acupoint>,
  meridians: Meridian[]
): SearchDoc[] {
  const meridianById = new Map(meridians.map((m) => [m.id, m]));
  return Object.values(acupoints).map((p) => {
    const m = meridianById.get(p.meridianId);
    return {
      code: p.code,
      name: p.name,
      nameEn: p.nameEn,
      meridianId: p.meridianId,
      meridianName: m?.name ?? "",
      meridianCode: m?.code ?? "",
      color: m?.color ?? "#888",
      location: p.location,
      indications: p.indications,
    };
  });
}

export function searchPoints(
  docs: SearchDoc[],
  query: string,
  limit = 30
): SearchResult[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];

  const results: SearchResult[] = [];
  for (const doc of docs) {
    let best: { score: number; matched: string; snippet: string } | null = null;
    const consider = (score: number, matched: string, snippet: string) => {
      if (!best || score > best.score) best = { score, matched, snippet };
    };

    if (doc.name === query.trim()) consider(1000, "穴名", doc.name);
    else if (doc.name.startsWith(query.trim())) consider(800, "穴名", doc.name);
    else if (doc.name.includes(q)) consider(600, "穴名", doc.name);

    const codeLower = doc.code.toLowerCase();
    if (codeLower === q) consider(950, "国际代码", doc.code);
    else if (codeLower.startsWith(q)) consider(750, "国际代码", doc.code);

    const nameEnLower = doc.nameEn.toLowerCase();
    if (nameEnLower.startsWith(q)) consider(550, "拼音", doc.nameEn);
    else if (nameEnLower.includes(q)) consider(450, "拼音", doc.nameEn);

    const ind = doc.indications.find((i) => i.toLowerCase().includes(q));
    if (ind) consider(400, "主治", ind);

    const locIdx = doc.location.toLowerCase().indexOf(q);
    if (locIdx >= 0) {
      const start = Math.max(0, locIdx - 8);
      const snippet =
        (start > 0 ? "…" : "") + doc.location.slice(start, locIdx + q.length + 12) +
        (locIdx + q.length + 12 < doc.location.length ? "…" : "");
      consider(250, "定位", snippet);
    }

    if (best) results.push({ doc, ...best });
  }

  results.sort(
    (a, b) => b.score - a.score || a.doc.code.localeCompare(b.doc.code)
  );
  return results.slice(0, limit);
}

/** 将文本按关键词切分为普通片段与命中片段，供高亮渲染 */
export function splitHighlight(
  text: string,
  query: string
): { hit: boolean; text: string }[] {
  const q = query.trim();
  if (!q) return [{ hit: false, text }];
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escaped})`, "gi");
  return text
    .split(re)
    .filter((s) => s !== "")
    .map((s) => ({ hit: s.toLowerCase() === q.toLowerCase(), text: s }));
}

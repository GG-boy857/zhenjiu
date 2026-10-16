/**
 * 学习笔记：存于浏览器 localStorage，无后端。
 * 结构：{ [code]: { text: string; updatedAt: number } }
 * 每次变更派发 window 事件 NOTES_EVENT。
 */
export type NoteEntry = { text: string; updatedAt: number };
export type NoteMap = Record<string, NoteEntry>;

const KEY = "zhentu.notes.v1";
export const NOTES_EVENT = "zhentu:notes";

export function readNotes(): NoteMap {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as NoteMap;
  } catch {
    return {};
  }
}

function writeNotes(map: NoteMap) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(map));
  window.dispatchEvent(new CustomEvent(NOTES_EVENT));
}

export function getNote(code: string): NoteEntry | null {
  return readNotes()[code] ?? null;
}

export function saveNote(code: string, text: string): NoteEntry {
  const map = readNotes();
  const trimmed = text.trim();
  const entry: NoteEntry = { text: trimmed, updatedAt: Date.now() };
  if (trimmed) map[code] = entry;
  else delete map[code];
  writeNotes(map);
  return entry;
}

export function deleteNote(code: string) {
  const map = readNotes();
  delete map[code];
  writeNotes(map);
}

export function countNotes(): number {
  return Object.keys(readNotes()).length;
}

/** 导出全部笔记（含穴位上下文）为 JSON 文件并触发下载 */
export function exportNotes(
  pointsById: Record<string, { name?: string; nameEn?: string }> = {}
) {
  const map = readNotes();
  const payload = {
    type: "zhentu-notes",
    version: 1,
    exportedAt: new Date().toISOString(),
    notes: Object.entries(map).map(([code, note]) => ({
      code,
      name: pointsById[code]?.name ?? "",
      nameEn: pointsById[code]?.nameEn ?? "",
      text: note.text,
      updatedAt: note.updatedAt,
    })),
  };
  downloadJson(payload, `zhentu-notes-${dateStamp()}.json`);
}

/** 导入笔记（按 updatedAt 新者覆盖旧者），返回 { imported, total } */
export function importNotes(raw: string): { imported: number; total: number } {
  const parsed = JSON.parse(raw) as {
    type?: string;
    notes?: Record<string, { text?: string; updatedAt?: number }>;
  };
  if (parsed.type !== "zhentu-notes" || !parsed.notes) {
    throw new Error("文件格式不正确，请选择本站导出的笔记 JSON");
  }
  const map = readNotes();
  let imported = 0;
  for (const [code, note] of Object.entries(parsed.notes)) {
    if (!note || typeof note.text !== "string" || !note.text.trim()) continue;
    const incoming: NoteEntry = {
      text: note.text.trim(),
      updatedAt: note.updatedAt ?? Date.now(),
    };
    const current = map[code];
    if (!current || current.updatedAt < incoming.updatedAt) {
      map[code] = incoming;
      imported++;
    }
  }
  writeNotes(map);
  return { imported, total: Object.keys(parsed.notes).length };
}

export function downloadJson(data: unknown, filename: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function dateStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}`;
}

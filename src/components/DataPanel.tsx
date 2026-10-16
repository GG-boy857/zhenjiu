import { useEffect, useState } from "react";
import { countNotes, exportNotes, importNotes } from "../lib/notes";
import {
  PROGRESS_EVENT,
  countLearned,
  exportProgress,
  importProgress,
} from "../lib/progress";
import { NOTES_EVENT } from "../lib/notes";

export default function DataPanel({
  pointsBrief,
}: {
  pointsBrief: Record<string, { name: string; nameEn: string }>;
}) {
  const [learned, setLearned] = useState(0);
  const [notes, setNotes] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setLearned(countLearned());
      setNotes(countNotes());
    };
    refresh();
    window.addEventListener(PROGRESS_EVENT, refresh);
    window.addEventListener(NOTES_EVENT, refresh);
    return () => {
      window.removeEventListener(PROGRESS_EVENT, refresh);
      window.removeEventListener(NOTES_EVENT, refresh);
    };
  }, []);

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as { type?: string };
      if (parsed.type === "zhentu-notes") {
        const r = importNotes(raw);
        setMsg(`已导入笔记 ${r.imported} 条（文件内共 ${r.total} 条，较新记录优先）`);
      } else if (parsed.type === "zhentu-progress") {
        const n = importProgress(raw);
        setMsg(`已导入学习记录 ${n} 条`);
      } else {
        setMsg("无法识别的文件格式：请选择本站导出的备份 JSON");
      }
    } catch (err) {
      setMsg(`导入失败：${err instanceof Error ? err.message : "文件解析出错"}`);
    }
  };

  return (
    <div className="paper-card p-5">
      <h3 className="section-title text-lg">学习数据（浏览器本地）</h3>
      <p className="mt-3 text-sm text-ink-soft">
        已学习 <span className="font-bold text-qing">{learned}</span> 个穴位 · 笔记{" "}
        <span className="font-bold text-vermilion">{notes}</span> 条
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={() => exportNotes(pointsBrief)}
          className="rounded-md bg-vermilion px-4 py-2 text-sm font-bold text-paper hover:bg-vermilion-soft"
        >
          导出笔记 JSON
        </button>
        <button
          onClick={() => exportProgress()}
          className="rounded-md border border-line px-4 py-2 text-sm text-ink-soft hover:border-qing-soft hover:text-qing"
        >
          导出学习记录
        </button>
        <label className="cursor-pointer rounded-md border border-line px-4 py-2 text-sm text-ink-soft hover:border-gold hover:text-gold">
          导入备份
          <input type="file" accept="application/json,.json" onChange={onFile} className="hidden" />
        </label>
      </div>
      {msg && <p className="mt-3 rounded bg-qing/10 px-3 py-2 text-sm text-qing">{msg}</p>}
      <p className="mt-3 text-xs leading-5 text-ink-faint">
        笔记与进度保存在当前浏览器 localStorage 中，换设备或清缓存前请先导出备份；导入时自动按时间合并，不会覆盖较新的记录。
      </p>
    </div>
  );
}

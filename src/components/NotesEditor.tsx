import { useEffect, useRef, useState } from "react";
import { deleteNote, downloadJson, getNote, saveNote } from "../lib/notes";

export default function NotesEditor({ code, name }: { code: string; name: string }) {
  const [text, setText] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const note = getNote(code);
    setText(note?.text ?? "");
    setSavedAt(note?.updatedAt ?? null);
    setLoaded(true);
  }, [code]);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  const persist = (value: string) => {
    const entry = saveNote(code, value);
    setSavedAt(entry.updatedAt);
    setDirty(false);
  };

  const onChange = (value: string) => {
    setText(value);
    setDirty(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => persist(value), 900);
  };

  const onDelete = () => {
    if (!confirm(`确定删除「${name}」的学习笔记吗？此操作不可恢复。`)) return;
    deleteNote(code);
    setText("");
    setSavedAt(null);
    setDirty(false);
  };

  const onExport = () => {
    downloadJson(
      {
        type: "zhentu-notes",
        version: 1,
        exportedAt: new Date().toISOString(),
        notes: { [code]: { text, updatedAt: savedAt ?? Date.now() } },
      },
      `zhentu-note-${code}.json`
    );
  };

  const fmt = (t: number) =>
    new Date(t).toLocaleString("zh-CN", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="paper-card p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="section-title text-lg">学习笔记</h3>
        <span className="text-xs text-ink-faint">
          {dirty ? "编辑中…自动保存" : savedAt ? `已保存于 ${fmt(savedAt)}` : "尚无笔记"}
        </span>
      </div>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => dirty && persist(text)}
        placeholder={`记录「${name}」的取穴心得、针刺体会、易错点……（自动保存到浏览器本地）`}
        rows={5}
        disabled={!loaded}
        className="mt-3 w-full rounded-md border border-line bg-paper p-3 text-[15px] leading-7 outline-none placeholder:text-ink-faint/70 focus:border-qing-soft"
      />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          onClick={() => persist(text)}
          disabled={!dirty}
          className={`rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${
            dirty
              ? "bg-qing text-paper hover:bg-qing-soft"
              : "cursor-not-allowed bg-paper-deep text-ink-faint"
          }`}
        >
          保存
        </button>
        <button
          onClick={onExport}
          disabled={!savedAt}
          className="rounded-md border border-line px-4 py-1.5 text-sm text-ink-soft transition-colors hover:border-qing-soft hover:text-qing disabled:opacity-50"
        >
          导出此笔记 JSON
        </button>
        <button
          onClick={onDelete}
          disabled={!savedAt}
          className="ml-auto rounded-md border border-vermilion/40 px-4 py-1.5 text-sm text-vermilion transition-colors hover:bg-vermilion/10 disabled:opacity-50"
        >
          删除
        </button>
      </div>
    </div>
  );
}

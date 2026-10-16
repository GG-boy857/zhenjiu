import { Fragment, useEffect, useMemo, useState } from "react";
import { searchPoints, splitHighlight, type SearchDoc } from "../lib/search";

function Hl({ text, q }: { text: string; q: string }) {
  const parts = splitHighlight(text, q);
  return (
    <>
      {parts.map((p, i) =>
        p.hit ? <mark key={i}>{p.text}</mark> : <Fragment key={i}>{p.text}</Fragment>
      )}
    </>
  );
}

export default function SearchClient({ index }: { index: SearchDoc[] }) {
  const [q, setQ] = useState("");

  useEffect(() => {
    setQ(new URLSearchParams(window.location.search).get("q") ?? "");
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (q.trim()) url.searchParams.set("q", q.trim());
    else url.searchParams.delete("q");
    window.history.replaceState(null, "", url);
  }, [q]);

  const results = useMemo(() => searchPoints(index, q), [index, q]);
  const samples = ["头痛", "胃痛", "合谷", "LI4", "Zusanli", "咳嗽"];

  return (
    <div className="space-y-6">
      <div className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="输入穴位名、拼音、国际代码或主治病症……"
          autoFocus
          aria-label="搜索穴位"
          className="w-full rounded-md border border-line bg-card px-4 py-2.5 text-lg outline-none placeholder:text-ink-faint/70 focus:border-qing-soft"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            className="rounded-md border border-line px-4 text-ink-soft hover:border-vermilion/50 hover:text-vermilion"
          >
            清空
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm text-ink-faint">
        试试：
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => setQ(s)}
            className="rounded-full border border-line bg-card px-3 py-0.5 text-ink-soft hover:border-qing-soft hover:text-qing"
          >
            {s}
          </button>
        ))}
      </div>

      {q.trim() && (
        <p className="text-sm text-ink-faint">
          找到 <span className="font-bold text-ink">{results.length}</span> 个与「
          <span className="font-bold text-vermilion">{q.trim()}</span>」相关的穴位
        </p>
      )}

      <ul className="grid gap-3 sm:grid-cols-2">
        {results.map(({ doc, matched }) => (
          <li key={doc.code}>
            <a
              href={`/acupoints/${doc.code}/`}
              className="paper-card block h-full p-4 hover:border-qing-soft"
            >
              <div className="flex items-center gap-2">
                <span
                  className="rounded px-1.5 py-0.5 text-xs font-bold text-paper"
                  style={{ backgroundColor: doc.color }}
                >
                  {doc.code}
                </span>
                <span className="text-lg font-bold">
                  <Hl text={doc.name} q={q} />
                </span>
                <span className="text-sm text-ink-faint">
                  <Hl text={doc.nameEn} q={q} />
                </span>
                <span className="ml-auto rounded bg-paper-deep px-2 py-0.5 text-xs text-ink-soft">
                  匹配于:{matched}
                </span>
              </div>
              <p className="mt-1.5 text-xs text-ink-faint">{doc.meridianName}</p>
              <p className="mt-2 text-sm leading-6 text-ink-soft">
                <Hl text={doc.location} q={q} />
              </p>
              <p className="mt-1.5 flex flex-wrap gap-1">
                {doc.indications.map((i) => (
                  <span key={i} className="rounded bg-paper-deep px-1.5 py-0.5 text-xs">
                    <Hl text={i} q={q} />
                  </span>
                ))}
              </p>
            </a>
          </li>
        ))}
      </ul>

      {q.trim() && results.length === 0 && (
        <div className="paper-card p-8 text-center text-ink-soft">
          <p>没有找到相关穴位。</p>
          <p className="mt-2 text-sm text-ink-faint">可尝试更短的关键词，如“痛”“咳”“胃”。</p>
        </div>
      )}
    </div>
  );
}

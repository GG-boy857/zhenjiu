import { useEffect, useState } from "react";
import { PROGRESS_EVENT, countLearnedAmong } from "../lib/progress";

const withBase = (p: string) =>
  (import.meta.env.BASE_URL.replace(/\/$/, "") || "") + p;

export interface StudyPathItem {
  id: string;
  name: string;
  nameEn: string;
  code: string;
  color: string;
  description: string;
  points: string[];
}

export default function HomeStudyPath({ items }: { items: StudyPathItem[] }) {
  const [progress, setProgress] = useState<Record<string, number>>({});

  useEffect(() => {
    const refresh = () => {
      const next: Record<string, number> = {};
      for (const item of items) next[item.id] = countLearnedAmong(item.points);
      setProgress(next);
    };
    refresh();
    window.addEventListener(PROGRESS_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_EVENT, refresh);
  }, [items]);

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {items.map((item, i) => {
        const total = item.points.length;
        const done = progress[item.id] ?? 0;
        const pct = total ? Math.round((done / total) * 100) : 0;
        return (
          <a
            key={item.id}
            href={withBase(`/meridians/${item.id}/`)}
            className="paper-card group block overflow-hidden"
          >
            <div className="h-1.5 w-full" style={{ backgroundColor: item.color }} />
            <div className="p-5">
              <p className="text-xs text-ink-faint">
                第 {i + 1} 步 · {item.code} 经
              </p>
              <h3 className="mt-1 text-xl font-bold group-hover:text-vermilion">{item.name}</h3>
              <p className="text-sm text-ink-faint">{item.nameEn}</p>
              <p className="mt-3 line-clamp-2 text-sm leading-6 text-ink-soft">
                {item.description}
              </p>
              <div className="mt-4">
                <div className="flex justify-between text-xs text-ink-faint">
                  <span>
                    已学 {done}/{total}
                  </span>
                  <span>{pct}%</span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper-deep">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, backgroundColor: item.color }}
                  />
                </div>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
}

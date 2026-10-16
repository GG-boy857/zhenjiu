import { useEffect, useState } from "react";
import { PROGRESS_EVENT, isLearned, toggleLearned } from "../lib/progress";

export default function StudyToggle({ code, name }: { code: string; name: string }) {
  const [learned, setLearned] = useState(false);

  useEffect(() => {
    setLearned(isLearned(code));
    const refresh = () => setLearned(isLearned(code));
    window.addEventListener(PROGRESS_EVENT, refresh);
    return () => window.removeEventListener(PROGRESS_EVENT, refresh);
  }, [code]);

  return (
    <button
      onClick={() => setLearned(toggleLearned(code))}
      aria-pressed={learned}
      className={`w-full rounded-md px-4 py-2 text-sm font-bold transition-colors ${
        learned
          ? "bg-qing text-paper hover:bg-qing-soft"
          : "border border-qing/50 bg-card text-qing hover:bg-qing/10"
      }`}
    >
      {learned ? `★ 已学习「${name}」` : "☆ 标记为已学习"}
    </button>
  );
}

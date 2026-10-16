import { useEffect, useMemo, useState } from "react";

export interface QuizPoint {
  code: string;
  name: string;
  nameEn: string;
  location: string;
  indications: string[];
  method: string;
  meridianId: string;
}

export interface QuizMeridian {
  id: string;
  name: string;
  color: string;
}

const STATS_KEY = "zhentu.review.v1";

type Stats = { answered: number; correct: number; streak: number; bestStreak: number };
const ZERO_STATS: Stats = { answered: 0, correct: 0, streak: 0, bestStreak: 0 };

function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function QuizView({
  points,
  meridians,
}: {
  points: QuizPoint[];
  meridians: QuizMeridian[];
}) {
  const scopes = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of points) counts.set(p.meridianId, (counts.get(p.meridianId) ?? 0) + 1);
    return meridians.filter((m) => (counts.get(m.id) ?? 0) > 0);
  }, [points, meridians]);

  const [mode, setMode] = useState<"flash" | "choice">("flash");
  const [scope, setScope] = useState("all");
  const [seed, setSeed] = useState(0);

  const deck = useMemo(() => {
    const pool = points.filter((p) => scope === "all" || p.meridianId === scope);
    return shuffle(pool);
    // seed 变化用于重新洗牌开始新一轮
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, scope, seed]);

  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [round, setRound] = useState({ done: 0, correct: 0 });
  const [picked, setPicked] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>(ZERO_STATS);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      if (raw) setStats({ ...ZERO_STATS, ...(JSON.parse(raw) as Stats) });
    } catch {
      /* 忽略损坏的本地数据 */
    }
    setStatsLoaded(true);
  }, []);

  useEffect(() => {
    if (!statsLoaded) return;
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  }, [stats, statsLoaded]);

  useEffect(() => {
    setIdx(0);
    setRevealed(false);
    setPicked(null);
    setRound({ done: 0, correct: 0 });
  }, [deck]);

  const current = deck[idx];

  // 选择题选项：当前穴位定位 + 3 个干扰项
  useEffect(() => {
    if (mode !== "choice" || !current) return;
    const distractors = shuffle(points.filter((p) => p.code !== current.code))
      .slice(0, 3)
      .map((p) => p.location);
    setOptions(shuffle([current.location, ...distractors]));
    setPicked(null);
  }, [current, mode, points]);

  const record = (correct: boolean) => {
    setRound((r) => ({ done: r.done + 1, correct: r.correct + (correct ? 1 : 0) }));
    setStats((s) => {
      const streak = correct ? s.streak + 1 : 0;
      return {
        answered: s.answered + 1,
        correct: s.correct + (correct ? 1 : 0),
        streak,
        bestStreak: Math.max(s.bestStreak, streak),
      };
    });
  };

  const gradeAndNext = (correct: boolean) => {
    record(correct);
    setRevealed(false);
    setPicked(null);
  };

  const restart = () => {
    setSeed((s) => s + 1);
    setIdx(0);
    setRevealed(false);
    setPicked(null);
    setRound({ done: 0, correct: 0 });
  };

  const finished = deck.length > 0 && round.done >= deck.length;
  const meridianOf = (id: string) => meridians.find((m) => m.id === id);

  return (
    <div className="space-y-5">
      {/* 工具栏 */}
      <div className="flex flex-wrap items-center gap-2">
        <span className="flex overflow-hidden rounded-md border border-line">
          {(
            [
              ["flash", "闪卡自测"],
              ["choice", "定位选择题"],
            ] as const
          ).map(([m, label]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1 text-sm ${
                mode === m ? "bg-ink text-paper" : "bg-card text-ink-soft hover:bg-paper-deep"
              }`}
            >
              {label}
            </button>
          ))}
        </span>
        <button
          onClick={() => setScope("all")}
          className={`rounded-full border px-3 py-1 text-sm ${
            scope === "all"
              ? "border-ink bg-ink text-paper"
              : "border-line bg-card text-ink-soft hover:border-ink-soft"
          }`}
        >
          全部范围
        </button>
        {scopes.map((m) => (
          <button
            key={m.id}
            onClick={() => setScope((s) => (s === m.id ? "all" : m.id))}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm ${
              scope === m.id ? "border-transparent font-bold text-paper" : "border-line bg-card text-ink-soft"
            }`}
            style={scope === m.id ? { backgroundColor: m.color } : undefined}
          >
            {m.name}
          </button>
        ))}
        <span className="ml-auto text-sm text-ink-faint">
          本轮 {round.done}/{deck.length} · 累计答 {stats.answered} 次 · 对 {stats.correct} · 连对{" "}
          {stats.streak}（最佳 {stats.bestStreak}）
        </span>
      </div>

      {finished ? (
        <div className="paper-card mx-auto max-w-xl p-8 text-center">
          <p className="text-4xl">✓</p>
          <h2 className="mt-2 text-2xl font-bold">本轮完成</h2>
          <p className="mt-2 text-ink-soft">
            共 {deck.length} 穴，答对 {round.correct} 题
            （正确率 {Math.round((round.correct / Math.max(deck.length, 1)) * 100)}%）
          </p>
          <button
            onClick={restart}
            className="mt-5 rounded-md bg-vermilion px-6 py-2 font-bold text-paper hover:bg-vermilion-soft"
          >
            再来一轮
          </button>
        </div>
      ) : !current ? (
        <div className="paper-card p-8 text-center text-ink-faint">该范围内暂无穴位数据</div>
      ) : mode === "flash" ? (
        /* ---------- 闪卡 ---------- */
        <div className="paper-card mx-auto max-w-xl overflow-hidden">
          <div className="border-b border-line px-6 py-3 text-sm text-ink-faint">
            第 {idx + 1} / {deck.length} 张 ·{" "}
            <span style={{ color: meridianOf(current.meridianId)?.color }}>
              {meridianOf(current.meridianId)?.name}
            </span>
          </div>
          <div className="px-6 py-8 text-center">
            {!revealed ? (
              <>
                <p className="text-4xl font-bold tracking-wide">{current.name}</p>
                <p className="mt-2 text-ink-soft">
                  {current.code} · {current.nameEn}
                </p>
                <button
                  onClick={() => setRevealed(true)}
                  className="mt-8 rounded-md bg-qing px-8 py-2.5 font-bold text-paper hover:bg-qing-soft"
                >
                  显示答案
                </button>
              </>
            ) : (
              <div className="space-y-4 text-left">
                <p className="text-center text-2xl font-bold">
                  {current.name}
                  <span className="ml-2 text-base font-normal text-ink-soft">{current.code}</span>
                </p>
                <div>
                  <p className="text-sm font-bold text-ink-faint">标准定位</p>
                  <p className="mt-1 leading-7">{current.location}</p>
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-faint">主治</p>
                  <p className="mt-1 flex flex-wrap gap-1.5">
                    {current.indications.map((i) => (
                      <span key={i} className="rounded bg-paper-deep px-2 py-0.5 text-sm">
                        {i}
                      </span>
                    ))}
                  </p>
                </div>
                <div>
                  <p className="text-sm font-bold text-ink-faint">操作</p>
                  <p className="mt-1 leading-7">{current.method}</p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <button
                    onClick={() => gradeAndNext(true)}
                    className="rounded-md bg-qing px-5 py-2 font-bold text-paper hover:bg-qing-soft"
                  >
                    认识
                  </button>
                  <button
                    onClick={() => gradeAndNext(false)}
                    className="rounded-md border border-gold/60 px-5 py-2 text-gold hover:bg-gold/10"
                  >
                    模糊
                  </button>
                  <button
                    onClick={() => gradeAndNext(false)}
                    className="rounded-md border border-vermilion/50 px-5 py-2 text-vermilion hover:bg-vermilion/10"
                  >
                    不认识
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ---------- 定位选择题 ---------- */
        <div className="paper-card mx-auto max-w-xl overflow-hidden">
          <div className="border-b border-line px-6 py-3 text-sm text-ink-faint">
            第 {idx + 1} / {deck.length} 题 · 根据穴名选出标准定位
          </div>
          <div className="px-6 py-6">
            <p className="text-center text-2xl font-bold">
              {current.name}
              <span className="ml-2 text-base font-normal text-ink-soft">{current.code}</span>
            </p>
            <ul className="mt-6 space-y-2.5">
              {options.map((opt) => {
                const isAnswer = opt === current.location;
                const chosen = picked === opt;
                let cls = "border-line bg-paper hover:border-qing-soft";
                if (picked) {
                  if (isAnswer) cls = "border-qing bg-qing/10";
                  else if (chosen) cls = "border-vermilion bg-vermilion/10";
                  else cls = "border-line bg-paper opacity-60";
                }
                return (
                  <li key={opt}>
                    <button
                      disabled={!!picked}
                      onClick={() => {
                        setPicked(opt);
                        record(isAnswer);
                      }}
                      className={`w-full rounded-md border px-4 py-2.5 text-left text-[15px] leading-7 transition-colors ${cls}`}
                    >
                      {opt}
                      {picked && isAnswer && (
                        <span className="ml-2 font-bold text-qing">✓ 正确答案</span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
            {picked && (
              <div className="mt-5 text-center">
                <p className={picked === current.location ? "font-bold text-qing" : "font-bold text-vermilion"}>
                  {picked === current.location ? "答对了！" : "答错了，再接再厉"}
                </p>
                <button
                  onClick={() => {
                    setRevealed(false);
                    setPicked(null);
                    setIdx((i) => Math.min(i + 1, deck.length - 1));
                  }}
                  className="mt-3 rounded-md bg-ink px-6 py-2 font-bold text-paper hover:bg-ink-soft"
                >
                  下一题
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

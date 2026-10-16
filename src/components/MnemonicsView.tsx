import { useState } from "react";

const withBase = (p: string) =>
  (import.meta.env.BASE_URL.replace(/\/$/, "") || "") + p;

export interface MnemonicItem {
  id: string;
  title: string;
  source: string;
  desc: string;
  verses: {
    line: string;
    note?: string;
    points: { name: string; code: string; meridian?: string }[];
  }[];
}

const MNEMONICS: MnemonicItem[] = [
  {
    id: "four-master",
    title: "四总穴歌（八总穴扩充版）",
    source: "明·徐凤《针灸大全》及后世增补",
    desc: "针灸临床必背歌诀。按人体不同部位划分主治，提纲挈领，首倡病位远道循经选穴。",
    verses: [
      {
        line: "肚腹三里留，腰背委中求",
        note: "腹部脾胃诸疾取足阳明足三里；腰背诸痛痹证取足太阳委中",
        points: [
          { name: "足三里", code: "ST36", meridian: "足阳明胃经" },
          { name: "委中", code: "BL40", meridian: "足太阳膀胱经" },
        ],
      },
      {
        line: "头项寻列缺，面口合谷收",
        note: "头颈落枕头项痛取手太阴列缺；面瘫牙痛目疾口鼻病取手阳明合谷",
        points: [
          { name: "列缺", code: "LU7", meridian: "手太阴肺经" },
          { name: "合谷", code: "LI4", meridian: "手阳明大肠经" },
        ],
      },
      {
        line: "心胸取内关，小腹三阴谋",
        note: "胸闷心痛胃脘作呕取手厥阴内关；小腹痛、月经不调、小便不利取足太阴三阴交",
        points: [
          { name: "内关", code: "PC6", meridian: "手厥阴心包经" },
          { name: "三阴交", code: "SP6", meridian: "足太阴脾经" },
        ],
      },
      {
        line: "急救水沟寻，胁肋阳陵抽",
        note: "昏迷中暑急救强刺激督脉水沟；胁肋胀痛口苦坐骨神经痛取足少阳阳陵泉",
        points: [
          { name: "水沟", code: "GV26", meridian: "督脉" },
          { name: "阳陵泉", code: "GB34", meridian: "足少阳胆经" },
        ],
      },
    ],
  },
  {
    id: "tianxing",
    title: "马丹阳天星十二穴歌",
    source: "金·马丹阳《针灸天星秘诀》",
    desc: "金代全真道针灸名家马丹阳总结的十二个疗效最为确凿神验的关键主穴。",
    verses: [
      {
        line: "三里内庭穴，曲池与合谷",
        note: "足三里通胃腑，内庭清胃热，曲池清热利关节，合谷解表理面口",
        points: [
          { name: "足三里", code: "ST36", meridian: "胃经" },
          { name: "内庭", code: "ST44", meridian: "胃经" },
          { name: "曲池", code: "LI11", meridian: "大肠经" },
          { name: "合谷", code: "LI4", meridian: "大肠经" },
        ],
      },
      {
        line: "委中并承山，昆仑环跳并",
        note: "委中舒筋利腰，承山除痔理肠，昆仑清头疏太阳，环跳利下肢髀枢",
        points: [
          { name: "委中", code: "BL40", meridian: "膀胱经" },
          { name: "承山", code: "BL57", meridian: "膀胱经" },
          { name: "昆仑", code: "BL60", meridian: "膀胱经" },
          { name: "环跳", code: "GB30", meridian: "胆经" },
        ],
      },
      {
        line: "阳陵泉通里，列缺与太冲",
        note: "阳陵利胆舒筋，通里养心神安窍，列缺开宣肺气，太冲平肝熄风止痉",
        points: [
          { name: "阳陵泉", code: "GB34", meridian: "胆经" },
          { name: "通里", code: "HT5", meridian: "心经" },
          { name: "列缺", code: "LU7", meridian: "肺经" },
          { name: "太冲", code: "LR3", meridian: "肝经" },
        ],
      },
    ],
  },
  {
    id: "yuan-points",
    title: "十二经脉原穴歌",
    source: "《灵枢·九针十二原》",
    desc: "脏腑原气所经过和留止的十二经原穴，为调节脏腑虚实气血的本经主穴。",
    verses: [
      {
        line: "肺原太渊大肠谷，胃冲阳兮脾太白",
        note: "手太阴太渊，手阳明合谷，足阳明冲阳，足太阴太白",
        points: [
          { name: "太渊", code: "LU9", meridian: "肺经" },
          { name: "合谷", code: "LI4", meridian: "大肠经" },
          { name: "冲阳", code: "ST42", meridian: "胃经" },
          { name: "太白", code: "SP3", meridian: "脾经" },
        ],
      },
      {
        line: "心原神门小肠腕，膀胱京骨肾太溪",
        note: "手少阴神门，手太阳腕骨，足太阳京骨，足少阴太溪",
        points: [
          { name: "神门", code: "HT7", meridian: "心经" },
          { name: "腕骨", code: "SI4", meridian: "小肠经" },
          { name: "京骨", code: "BL64", meridian: "膀胱经" },
          { name: "太溪", code: "KI3", meridian: "肾经" },
        ],
      },
      {
        line: "包络大陵焦阳池，胆取丘墟肝太冲",
        note: "手厥阴大陵，手少阳阳池，足少阳丘墟，足厥阴太冲",
        points: [
          { name: "大陵", code: "PC7", meridian: "心包经" },
          { name: "阳池", code: "TE4", meridian: "三焦经" },
          { name: "丘墟", code: "GB40", meridian: "胆经" },
          { name: "太冲", code: "LR3", meridian: "肝经" },
        ],
      },
    ],
  },
  {
    id: "eight-influential",
    title: "八会穴歌",
    source: "《难经·四十五难》",
    desc: "脏、腑、气、血、筋、脉、骨、髓之精气聚会之所，治疗八类组织或器官病变的关键交会穴。",
    verses: [
      {
        line: "腑会中脘脏章门，气会膻中血膈俞",
        note: "六腑之病选中脘；五脏之疾选章门；气机失调选膻中；血虚血瘀衄血选膈俞",
        points: [
          { name: "中脘", code: "CV12", meridian: "任脉" },
          { name: "章门", code: "LR13", meridian: "肝经" },
          { name: "膻中", code: "CV17", meridian: "任脉" },
          { name: "膈俞", code: "BL17", meridian: "膀胱经" },
        ],
      },
      {
        line: "筋会阳陵脉太渊，骨会大杼髓绝骨",
        note: "转筋拘挛选阳陵泉；脉管无脉证选太渊；骨痛关节病选大杼；下肢痿弱、髓海空虚选绝骨（悬钟）",
        points: [
          { name: "阳陵泉", code: "GB34", meridian: "胆经" },
          { name: "太渊", code: "LU9", meridian: "肺经" },
          { name: "大杼", code: "BL11", meridian: "膀胱经" },
          { name: "悬钟", code: "GB39", meridian: "胆经" },
        ],
      },
    ],
  },
  {
    id: "mu-points",
    title: "十二募穴歌",
    source: "《太平圣惠方》",
    desc: "脏腑之气结聚于胸腹部的十二个特定穴位，在急腹症、脏腑器质性病变诊断与针灸中不可或缺。",
    verses: [
      {
        line: "天枢大肠肺中府，关元小肠巨阙心",
        note: "大肠募天枢，肺募中府，小肠募关元，心募巨阙",
        points: [
          { name: "天枢", code: "ST25", meridian: "胃经" },
          { name: "中府", code: "LU1", meridian: "肺经" },
          { name: "关元", code: "CV4", meridian: "任脉" },
          { name: "巨阙", code: "CV14", meridian: "任脉" },
        ],
      },
      {
        line: "中极膀胱京门肾，日月少阳胆募寻",
        note: "膀胱募中极，肾募京门，胆募日月",
        points: [
          { name: "中极", code: "CV3", meridian: "任脉" },
          { name: "京门", code: "GB25", meridian: "胆经" },
          { name: "日月", code: "GB24", meridian: "胆经" },
        ],
      },
      {
        line: "期门肝募脾章门，膻中包络焦石门",
        note: "肝募期门，脾募章门，心包募膻中，三焦募石门，胃募中脘",
        points: [
          { name: "期门", code: "LR14", meridian: "肝经" },
          { name: "章门", code: "LR13", meridian: "肝经" },
          { name: "膻中", code: "CV17", meridian: "任脉" },
          { name: "石门", code: "CV5", meridian: "任脉" },
          { name: "中脘", code: "CV12", meridian: "任脉" },
        ],
      },
    ],
  },
  {
    id: "huiyang",
    title: "回阳九针歌",
    source: "明·高武《针灸聚英》",
    desc: "专治厥逆亡阳、卒然中风、暴脱休克危急重症，具回阳救逆、开窍苏厥之功。",
    verses: [
      {
        line: "哑门劳宫三阴交，涌泉太溪中脘接",
        note: "哑门开通心神，劳宫清心苏厥，三阴交摄下焦，涌泉滋阴潜阳，太溪固肾纳气，中脘健运中气",
        points: [
          { name: "哑门", code: "GV15", meridian: "督脉" },
          { name: "劳宫", code: "PC8", meridian: "心包经" },
          { name: "三阴交", code: "SP6", meridian: "脾经" },
          { name: "涌泉", code: "KI1", meridian: "肾经" },
          { name: "太溪", code: "KI3", meridian: "肾经" },
          { name: "中脘", code: "CV12", meridian: "任脉" },
        ],
      },
      {
        line: "环跳足三里合谷，救却残生过险劫",
        note: "环跳宣通下肢经脉，足三里补中益气生化气血，合谷回阳大穴宣畅上焦",
        points: [
          { name: "环跳", code: "GB30", meridian: "胆经" },
          { name: "足三里", code: "ST36", meridian: "胃经" },
          { name: "合谷", code: "LI4", meridian: "大肠经" },
        ],
      },
    ],
  },
];

export default function MnemonicsView() {
  const [activeId, setActiveId] = useState(MNEMONICS[0].id);
  const cur = MNEMONICS.find((m) => m.id === activeId) ?? MNEMONICS[0];

  return (
    <div className="paper-card overflow-hidden">
      <div className="border-b border-line bg-paper-deep/40 p-4 sm:p-5">
        <h2 className="text-xl font-bold">经穴经典记忆歌诀</h2>
        <p className="mt-1 text-xs text-ink-soft sm:text-sm">
          古人将经脉临床核心要穴编为朗朗上口的韵文歌诀，便于日常背诵与临床快速选穴。点击歌诀穴位可直接进入穴位详情或 3D 铜人定位。
        </p>

        {/* 标签栏 */}
        <div className="mt-4 flex flex-wrap gap-1.5 sm:gap-2">
          {MNEMONICS.map((m) => (
            <button
              key={m.id}
              onClick={() => setActiveId(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-bold transition-colors sm:text-sm ${
                activeId === m.id
                  ? "bg-vermilion text-paper shadow-sm"
                  : "border border-line bg-card text-ink-soft hover:border-qing-soft hover:text-qing"
              }`}
            >
              {m.title.replace(/（.*）/, "")}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 md:p-8">
        <div className="flex flex-wrap items-baseline gap-2">
          <h3 className="text-2xl font-bold text-ink">{cur.title}</h3>
          <span className="text-xs text-ink-faint">【出处：{cur.source}】</span>
        </div>
        <p className="mt-2 text-sm leading-6 text-ink-soft">{cur.desc}</p>

        {/* 歌诀展示 */}
        <div className="mt-6 space-y-6">
          {cur.verses.map((v, i) => (
            <div
              key={i}
              className="rounded-lg border border-line bg-paper/60 p-4 transition-colors hover:border-qing/50 sm:p-5"
            >
              <div className="text-lg font-bold tracking-widest text-ink sm:text-xl">
                {v.line}
              </div>
              {v.note && (
                <p className="mt-2 text-xs leading-5 text-ink-faint sm:text-sm">
                  {v.note}
                </p>
              )}

              {/* 涉及穴位卡片 */}
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-ink-faint">核心穴位：</span>
                {v.points.map((p) => (
                  <div
                    key={p.code}
                    className="inline-flex items-center gap-1.5 rounded border border-line bg-card px-2.5 py-1 text-xs shadow-2xs"
                  >
                    <a
                      href={withBase(`/acupoints/${p.code}/`)}
                      className="font-bold text-ink hover:text-vermilion"
                      title={`${p.name}（${p.code}）详情`}
                    >
                      {p.name}
                      <span className="ml-1 text-[11px] font-normal text-ink-faint">
                        {p.code}
                      </span>
                    </a>
                    <a
                      href={`${withBase("/")}?focus=${p.code}#bronze3d`}
                      className="text-[11px] text-qing hover:underline"
                      title={`在 3D 铜人中查看 ${p.name}`}
                    >
                      3D定位
                    </a>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

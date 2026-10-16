# GitHub 针灸相关项目调研总结

> 调研时间：2026-10-06 · 方式：GitHub API 关键词检索（acupuncture / acupoint / meridian / 针灸 / 穴位 / 中医知识库 / 子午流注 / 倪海厦 等）+ 重点仓库页面分析

## 一、找到的相关项目

### A. 倪海厦课程整理 / 中医知识库

| 仓库 | Stars | 语言 | 定位 |
| --- | --- | --- | --- |
| jangviktor-web/nihaixia | ~3.4k | HTML | 倪海厦学术思想蒸馏的 Agent Skill（伤寒/金匮/内经/中药/针灸 + 诊断公式与医案语料） |
| JuneYaooo/nihaisha-nishi-tcm | ~2.2k | Python | 倪海厦课程 Agent Skill：课程检索、方证穴位辨析、板书截图证据索引 |
| 9527qingfeng/hantang-nihaixia-follower | ~491 | HTML | 人纪/天纪教材讲义 PDF 与自学经方笔记（MulanPSL-2.0） |
| jangviktor-web/nihaixia-app | ~229 | Dart | 安卓客户端：六经辨证、322 首经方、**408 穴针灸**、**子午流注取穴**，离线 JSON 资源 |
| YuanZHAO321/TCM.Skill | ~146 | 无 | 四部规划教材整编的知识库型 Skill |
| C0HERENCE/tcm-client | ~44 | Vue | 中医药科普知识库前端（Vue + ant-design-vue） |
| Renhuai123/nihai-renji-corpus | ~16 | Python | 《人纪》19,294 条判语结构化语料，带视频时间戳溯源 |
| xiaogege6697/tcm-db | ~12 | Python | SQLite 知识库：中药/方剂/症状/证型/穴位/医案，关联表多对多 + 证据溯源表，RAG-ready |
| jonhnsonzz/nihaisha-renji | ~11 | Python | 辨证知识系统，Skill/MCP/API 三种调用 |

### B. 穴位可视化 / 图谱 / 识别

| 仓库 | Stars | 语言 | 定位 |
| --- | --- | --- | --- |
| spacejohnlf/tcm-acupoints | ~3 | TypeScript | **Three.js 交互式 3D 经络穴位图谱**：React19+Vite，穴位坐标（acupoint-data.ts）与文本（point-texts.json）分离，Draco 压缩 GLB 人体模型（源自 Z-Anatomy，CC BY-SA），坐标自述为“教学示意” |
| yimingli99/AcuKG-Knowledge-graph-for-medical-acupuncture | ~14 | 数据集 | 针灸知识图谱：361 穴位、5 类实体、9 类关系；CSV/RDF/JSON 三格式；UBERON/SNOMED-CT/MeSH 标准化（JAMIA 论文配套） |
| ashemag/human-atlas | — | React | 浏览器 3D 人体图谱（Three.js + BodyParts3D），非针灸但可作人体可视化基础 |
| KunWang257/Acupointotopy-of-human-body | ~5 | 无 | 中英双语针灸图谱手稿（BSD-2） |
| 10969Rainy/Acupuncture | ~6 | C# | 桌面学习辅助：穴位讲解 + 模拟针刺 |
| xujk0217/SelfPointMassageApp.swiftpm | ~6 | Swift | 按症状取穴按摩指导（SwiftUI + AR） |
| Zichuana/Hand-Acupoint-Recognition-System | ~10 | CSS | MediaPipe 手部穴位识别 |
| alexislintw/Facial-Acupoint-Recognition | ~10 | Swift | 面部关键点→穴位定位 AR 展示 |

### C. 子午流注 / 取穴工具

| 仓库 | 语言 | 定位 |
| --- | --- | --- |
| oldsix902/tcm-liuzhu-calculator | JavaScript | 子午流注计算器 PWA |
| 2545022547-fengbujue/ziwuliuzhu-uniapp | Vue3+Vite+Pinia | 子午流注取穴 uni-app |
| batcatchina/huakai-ziwu | HTML | 开穴“可视化时钟” |
| pejoypan/ZiWuLiuZhu | Python | 子午流注时穴查询器 |
| davids8644/LunarClock | Kotlin | 子午流注时钟 App |

## 二、可借鉴的经验

1. **数据与视图彻底分离**。做得好的项目（tcm-acupoints、tcm-db、AcuKG）都把“穴位文本字段”与“几何坐标/关系”分开管理，文本字段高度一致：`code / name / 拼音 / 经络归属 / 定位 / 主治 / 操作 / 禁忌 / 出处`。
   → **应用**：`acupoints.json` 采用同一套字段（并加 `finding` 取穴方法与 `svg` 坐标），`meridians.json` 管经络元数据与穴位代码表。
2. **坐标允许“教学示意”级精度**。连 3D 项目都明确声明坐标非国标定位（tcm-acupoints README）。
   → **应用**：本站 SVG 坐标自定为示意级，页面明确标注“非解剖精确”，把严谨性交给文字定位字段。
3. **2D SVG 起步、3D 后置**。Three.js + GLB + 点吸附方案体验最好但体积/维护成本高（模型资产还有 CC BY-SA 传染问题）；个人学习场景下 2D SVG 零依赖、加载快、可点击，完全够用。
   → **应用**：先 2D SVG（正面/背面、按经络高亮、点击跳转），`back` 坐标字段为督脉/膀胱经预留，未来可平滑升级 3D。
4. **搜索要覆盖拼音与代码**。tcm-acupoints 提供 pinyin/code/name 三路搜索；针灸学习者常按 `LI4` 这类代码检索。
   → **应用**：搜索索引含 `name`（中文）、`nameEn`（拼音）、`code`、`indications`、`location`，加权打分 + 高亮。
5. **经络粒度取 14 条 + 国标编号排序**。nihaixia-app 按国家标准编号组织 408 穴并标记交会穴。
   → **应用**：`meridians.json` 收录 12 正经 + 任督 + 6 奇经（20 条），穴位按国标编号在 `points` 数组中排序，详情页按此序做“上/下一穴”。
6. **学习路径/进度是空白点**。多数项目是“查询工具”（检索、辨证、知识图谱），几乎没有“学习路径 + 进度追踪 + 自测”——这正是个人学习站的差异化价值。
   → **应用**：已学习标记、经络进度条、闪卡/选择题自测、首页学习路径。
7. **离线优先与静态化是共同选择**（Flutter 离线 JSON、PWA、静态站）。
   → **应用**：Astro 纯静态 + localStorage，天然离线可用。
8. **免责声明与数据溯源意识**。tcm-db 的 evidence 表、nihaixia-app 的免责声明都是好实践。
   → **应用**：全站页脚免责声明 + README 数据说明。
9. **许可注意**。教材整理类项目多为 CC BY-NC / MulanPSL / 无许可证，直接搬数据有合规风险。
   → **应用**：穴位文本自行按国标与教材整理，不直接复制他人仓库数据。

## 三、结论

生态里“知识库/Agent 语料”很热（倪海厦系列、SQLite/RAG 库），“可视化”集中在 3D 展示方向，而**面向初学者的“按经络学 + 记进度 + 能自测”的轻量静态学习站基本空缺**。本站即按此定位实现：Astro + Tailwind + React 局部水合 + 双 JSON 数据 + localStorage 个人数据，2D SVG 穴位图起步、字段设计兼容未来 3D/知识图谱扩展。

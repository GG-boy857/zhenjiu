# 针途 Zhentu · 个人针灸学习站

一个**个人用**的针灸学习静态网站：按经络系统浏览穴位、在人体图上直观查看穴位位置、快速检索定位/主治/操作、记录学习笔记与复习进度。

> ⚠️ 免责声明：本站内容按国家标准与教材整理，仅供个人学习参考，不构成医疗建议；实际针刺请在执业医师指导下进行。

## 功能

- **经络穴位浏览**：十二正经 + 奇经八脉分组；任、督二脉全量收录，冲、带、跷、维六脉收录其**交会穴**并附说明；穴位详情页含中英文名、国际代码（如 `LI4`）、标准定位（GB/T 12346 风格）、取穴方法、主治病症、针灸操作、注意事项、古籍出处
- **人体穴位图**：手绘线稿风格的 2D“针灸铜人”（含五官、发型、锁骨、髌骨、脊柱沟等结构，正面/背面双视图）；**滚轮或 ＋/− 按钮可放大缩小特写，放大后可拖拽平移**；穴位标记点悬停显示穴名，点击跳转详情页；可按经络只高亮该经穴位；**选中奇经八脉时显示虚线循行示意线与其交会穴位**；从详情页点“打开穴位图定位”会自动放大到该穴特写
- **治疗视频**：穴位详情页内嵌精选治疗/取穴视频（B 站播放器），未收录的穴位提供 B 站/YouTube 搜索直达；视频清单在 `src/data/videos.json` 中维护
- **文献知识库**：`/references` 页汇总权威资料——WHO 经穴定位标准、GB/T 12346-2021、《内经》《针灸大成》等古籍在线全文、Vickers 慢性痛荟萃分析等循证文献、视频课程与检索工具；每个穴位详情页底部自动生成 PubMed / 百度学术 / Cochrane / ctext 按名检索链接
- **学习笔记与进度**：每个穴位下方有笔记区（自动保存至浏览器 localStorage）；列表页显示“已学习/未学习”徽标；支持导出/导入备份 JSON，防止数据丢失
- **复习自测**：闪卡自测（翻面 + 自评）与定位选择题两种模式，可限定经络范围，累计成绩本地保存
- **3D 针灸铜人（主页）**：Three.js 立体铜人，可拖拽旋转、滚轮缩放、右键平移；361 穴经射线投射自动吸附于体表，悬停显示穴名、点击进入详情页；支持按经络筛选与正/背面一键转场；**默认加载解剖级真实人体网格（BodyParts3D 皮肤+肌肉系统，CC BY-SA 2.1 JP，署名见 `ATTRIBUTION.md`），并提供“皮肤 / 肌肉”图层切换——肌肉视图下皮肤半透明、65 万面肌肉系统透出；离线或加载失败时自动回退为程序化简化建模**。页面滚动到该区块时才加载（`client:visible` 懒加载）。建模与加载代码在 `src/lib/body3d.ts`、`src/lib/atlas-loader.ts`、`src/components/BronzeFigure3D.tsx`
- **全局搜索**：支持穴名、拼音、国际代码、主治病症关键词，结果按相关度排序并高亮

## 技术栈

| 层 | 选型 |
| --- | --- |
| 框架 | [Astro 5](https://astro.build)（静态生成） |
| 样式 | [Tailwind CSS 4](https://tailwindcss.com)（`@tailwindcss/vite` 插件） |
| 交互组件 | React 19（Astro React 集成，`client:load` / `client:visible` 局部水合） |
| 3D | [Three.js](https://threejs.org)（主页 3D 针灸铜人：程序化建模 + 射线投射吸附穴位，懒加载） |
| 数据 | 本地 JSON（`src/data/`），无后端 |
| 个人数据 | 浏览器 localStorage（笔记 / 学习进度 / 自测成绩） |
| 部署 | GitHub Pages（Actions 自动构建） |

## 快速开始

```bash
npm install     # 安装依赖（Node 20+）
npm run dev     # 本地开发，默认 http://localhost:4321
npm run build   # 构建静态站点到 dist/
npm run preview # 本地预览构建产物
```

开发辅助（可选，需系统安装 Edge/Chrome）：`node scripts/e2e.mjs` 会对关键页面截图到 `shots/` 并自动断言核心交互（穴位图点击跳转、笔记保存、搜索高亮、自测流程等）。

## 目录结构

```text
src/
├── data/                # 站点数据（改这里即可扩内容）
│   ├── meridians.json   # 经络：名称/代码/五行/流注时辰/循行/穴位列表/图例色
│   ├── acupoints.json   # 穴位（肺经、大肠经、胃经）
│   ├── acupoints/       # 其余经络穴位，一经一文件（spleen.json、bladder.json、du.json …），自动合并
│   ├── videos.json      # 精选治疗视频（B站/YouTube）
│   └── references.json  # 文献知识库条目
├── lib/
│   ├── data.ts          # 数据读取与查询辅助
│   ├── notes.ts         # 笔记 localStorage + 导入导出
│   ├── progress.ts      # 学习进度 localStorage
│   ├── search.ts        # 搜索索引与打分
│   └── svg-data.ts      # 人体轮廓 SVG 路径（viewBox 400×800，中轴 x=200）
├── components/          # Astro 卡片组件 + React 交互组件
├── layouts/             # BaseLayout（页头/页脚/免责声明）
├── pages/               # 路由
│   ├── index.astro           # 首页（学习路径 + 数据备份）
│   ├── meridians/index.astro # 经络列表
│   ├── meridians/[id].astro  # 单条经络穴位列表
│   ├── acupoints/[code].astro# 穴位详情（含笔记）
│   ├── atlas.astro           # 人体穴位图
│   ├── review.astro          # 复习自测
│   └── search.astro          # 搜索结果
└── styles/global.css    # Tailwind 主题（宣纸/墨色/朱砂/淡青）
```

## 如何添加新穴位数据（以脾经 SP 为例）

1. **在 `src/data/meridians.json` 中确认对应经络**（如 `id: "spleen"`），`points` 数组已按国标编号列出全部穴位代码；
2. **在 `src/data/acupoints/` 下新建或编辑该经络的 JSON 文件**（如 `spleen.json`），按键为穴位代码添加条目（新文件会被自动合并，无需注册）：
   ```json
   "SP1": {
     "code": "SP1",
     "name": "隐白",
     "nameEn": "Yinbai",
     "meridianId": "spleen",
     "location": "在足趾，大趾末节内侧，趾甲根角侧后方0.1寸（指寸）",
     "finding": "沿趾甲内侧画一直线与趾甲基底部水平线相交处取穴",
     "indications": ["腹胀", "便血", "尿血", "崩漏", "癫狂", "多梦"],
     "method": "浅刺0.1寸，或点刺出血",
     "classics": "首载于《灵枢·本输》，为脾经井穴",
     "svg": { "front": [188, 792] }
   }
   ```
3. 字段说明：
   - `location`：标准定位（建议参照 GB/T 12346《腧穴名称与定位》表述）
   - `finding`：实用取穴方法（手指同身寸、体位动作等）
   - `indications`：主治病症数组，搜索与自测都会用到
   - `method`：针刺深度/角度/灸法
   - `warning`（可选）：针刺禁忌，会在详情页以醒目样式展示
   - `classics`：首载文献与经典引文
   - `svg`：穴位图坐标（可选）。`front: [x, y]`，viewBox 为 `0 0 400 800`，身体中轴 `x=200`；数据只按**左侧**给出，右侧由站点自动镜像；背面穴（督脉、膀胱经等）用 `back: [x, y]`。人体轮廓路径集中在 `src/lib/svg-data.ts`，若调整轮廓请注意同步校对坐标
4. 保存后 `npm run dev` 即可见新穴位出现在：经络页、穴位图、搜索、自测题库中，无需其他配置。

### 添加新经络

在 `meridians.json` 追加一条记录（含 `id`、`name`、`code`、`category`、`color` 等），`points` 可先留空 `[]`。若该经不设独立穴位（如奇经六脉），可加：
- `note`：说明文字；
- `jiaohui`：交会穴代码数组（卡片显示“交会 N 穴”，详情页列出交会穴卡片区）；
- `path`：循行示意线坐标（`{ "front": [[x,y],…], "back": [[x,y],…] }`，viewBox 400×800 左半边坐标，穴位图会镜像并在选中时以虚线绘制）。

### 添加治疗视频

编辑 `src/data/videos.json`，按穴位代码添加条目即可在详情页内嵌播放器：

```json
"LI4": [
  {
    "platform": "bilibili",
    "id": "BV1jj411L7nJ",
    "title": "合谷穴：定位与主治讲解",
    "uploader": "医者正心",
    "note": "定位与功用科普"
  }
]
```

- `platform` 支持 `bilibili`（`id` 填 BV 号）与 `youtube`（`id` 填视频 ID）
- 没有条目的穴位，详情页会自动显示 B 站 / YouTube 搜索直达按钮，无需逐个配置

### 添加文献条目

编辑 `src/data/references.json`，每条含 `category`（分类）、`title`、`org`、`year`、`url`、`desc`、`tags`，保存后自动出现在 `/references` 文献知识库页。

## 学习数据备份

- 笔记与学习进度存在**浏览器 localStorage**（键：`zhentu.notes.v1`、`zhentu.progress.v1`、`zhentu.review.v1`）
- 首页“学习数据”卡片：**导出笔记 JSON / 导出学习记录 / 导入备份**（按时间合并，不覆盖较新记录）
- 每个穴位详情页也可单独导出该穴笔记

## 部署到 GitHub Pages

1. 把代码推送到 GitHub 仓库（本机未装 git 时，可用 GitHub Desktop 或安装 git 后 `git init && git add -A && git commit && git remote add origin … && git push -u origin main`）
2. 仓库 **Settings → Pages → Build and deployment → Source** 选择 **GitHub Actions**
3. 项目已含 `.github/workflows/deploy.yml`（使用 `withastro/action`），推送到 `main` 即自动构建发布
4. **重要**：若仓库名不是 `<用户名>.github.io`，需取消 `astro.config.mjs` 中 `base` 的注释并改为仓库名（如 `/zhenjiu`），否则静态资源路径 404

## 数据与许可说明

- 穴位文本内容为站点作者按国家标准与规划教材自行整理，穴位图坐标为**教学示意**级别，非解剖精确定位
- 如复用本仓库代码，请自行确认所整理数据内容的合规性；引用第三方数据集（如 AcuKG 等开源数据）时注意其原始许可

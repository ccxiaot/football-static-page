# 足球预测竞彩数据看板 - 项目归档总结

## 项目概述

基于中国竞彩网数据的足球预测静态页面，部署在 GitHub Pages 上，无需后端数据库。

**原站数据源**: `chen-1119.github.io/football-predict/`  
**本地项目路径**: `D:\WeChatProject\足球静态页面\`

---

## 项目结构

```
足球静态页面/
├── index.html                    ← 主页面 (SPA，所有逻辑在一个文件)
├── shuqian.png                   ← 书签图标
├── favicon.svg                   ← 备用图标
├── contact-qr-code.jpg           ← 微信联系二维码
│
├── assets/
│   ├── index.css                 ← 原站 CSS 样式 (67KB)
│   └── index.js                  ← 原站 JS (备用，未使用)
│
├── data/
│   ├── matches-current.json      ← 当前赛事 + 预测 (爬虫更新)
│   ├── matches-history.json      ← 历史赛果 (爬虫追加合并)
│   ├── sync-meta.json            ← 同步元数据
│   └── worldcup.json             ← 世界杯分组配置
│
├── flags/                        ← 国旗图片缓存
│
├── scraper/
│   ├── package.json              ← Node.js 依赖
│   ├── fetch-matches.js          ← 数据爬虫 (从原站拉取)
│   ├── generate-predictions.js   ← 预测生成器 (备用)
│   ├── update-data.js            ← 主更新脚本
│   └── README.md                 ← 爬虫文档
│
└── .github/workflows/
    └── update-data.yml           ← GitHub Actions (每小时自动更新)
```

---

## 页面功能清单

### 1. 赛事预测 (首页)
- 指标卡: 今日赛事/已接赔率/已出预测/高可信候选
- 数据同步条: 显示同步时间、数据源、数量
- 日期选择器 + 赛事筛选 + 时区切换
- 按联赛分组的比赛表格
- 点击赔率添加到投注单
- 点击展开内联详情
- 点击"详情"进入独立详情页
- 刷新按钮

### 2. 历史赛果
- 近一年 3000+ 场已完场记录
- 按赛事筛选下拉框 (45 个联赛)
- 分页加载 (每页 20 场)
- 比分展示 (主胜绿色/平局灰色/客胜红色)
- 刷新按钮

### 3. 投注单
- 点击赔率选比赛 (购物车模式)
- 单关/串关切换
- 选择每注金额 (5/10/20/50/100)
- 预计收益计算
- 提交为一注 (可下多注)
- 我的注单列表
- 需要登录才能保存

### 4. 命中挑战
- 每日精选 5 场比赛
- 三选一 (主胜/平局/客胜)
- 每天只能提交一次
- 比赛结束后自动结算
- 显示命中结果

### 5. 世界杯专栏
- Hero 面板 (举办地/参赛队/总场次)
- KPI 指标网格
- 12 组小组赛预测 (动态积分榜)
- 淘汰赛路径 (32强~决赛)
- 争冠路径池 (8 支候选)
- 当前推荐观察池
- 刷新按钮

### 6. 比赛详情页
- **未开始**: VS、赔率、预测推荐、概率系统、数据统计
- **已完场**: 最终比分、预测命中结果、赛果复盘
- 5 个标签页: 预测推荐/概率系统/数据统计/近期战绩/交锋历史
- 近期战绩和交锋历史从历史数据实时查询

### 7. 我的
- 登录/注册
- 命中挑战记录 (含结算结果)
- 投注单记录
- 退出登录

---

## 数据流

```
竞彩网 → 原站 GitHub Actions (每小时)
              ↓
原站 GitHub Pages (data/*.json)
              ↓
本项目 scraper/fetch-matches.js (拉取)
              ↓
data/*.json (本地)
  ├─ matches-current.json → 直接覆盖
  ├─ matches-history.json → 追加合并 (按 id 去重)
  └─ sync-meta.json → 直接覆盖
              ↓
index.html (前端 fetch 动态加载)
  ├─ 每 30 秒刷新 matches-current + sync-meta
  ├─ 首次加载刷新 matches-history
  └─ 手动刷新按钮
```

---

## 用户系统

**存储方式**: localStorage (无后端)

```
localStorage
├── fp_users: {
│     "用户名": {
│       password: "MD5哈希",
│       challenges: [{ date, selections, settled, hitCount }],
│       betslips: [{ id, createdAt, mode, stake, totalOdds, picks }]
│     }
│   }
├── fp_current_user: "用户名"
└── fp_timezone: "Asia/Shanghai"
```

**安全措施**:
- 密码 MD5 加密存储
- 用户数据按用户名隔离
- localStorage 满时有异常捕获

---

## 时区支持

| 时区 | 偏移 | 用途 |
|------|------|------|
| 🇨🇳 北京时间 | UTC+8 | 默认 |
| 🇯🇵 东京时间 | UTC+9 | 日职 |
| 🇬🇧 伦敦时间 | UTC+0 | 英超 |
| 🇩🇪 柏林时间 | UTC+1 | 德甲/西甲 |
| 🇺🇸 纽约时间 | UTC-5 | 美职联 |
| 🇺🇸 洛杉矶时间 | UTC-8 | 美西 |

---

## 已修复的 Bug

| # | 问题 | 修复 |
|---|------|------|
| 1 | switchDetailTab 只搜 matchesData | 改为搜索 matchesData \|\| historyData |
| 2 | onclick 单引号注入 (XSS) | 新增 escapeJs() 函数 |
| 3 | 未登录投注静默丢弃 | submitBetslip 未登录时弹登录框 |
| 4 | setTimeout 竞态 | 引入 homeRenderTimer 清除旧定时器 |
| 5 | 切换联赛分页未重置 | filterHistoryByLeague 中重置 historyPage |
| 6 | localStorage 满时崩溃 | saveUsers 加 try/catch |
| 7 | 历史数据无缓存破坏 | loadHistoryData 加 ?v=Date.now() |
| 8 | 国旗正则不支持 gb-wls | 修复正则支持 xx-yyy 格式 |
| 9 | crest 相对路径图片加载失败 | 改为首字显示 + onerror 回退 |
| 10 | alt 属性未转义 | getTeamBadgeHtml 中 name 加 escapeHtml |

---

## 爬虫使用

```bash
cd scraper
npm install
node update-data.js    # 拉取最新数据
```

**缓存策略**:
- matches-current.json → 直接覆盖
- matches-history.json → 追加合并 (保留本地已有 + 远程新增)
- 3 次重试，每次间隔 2 秒

---

## 备份文件

- `D:\WeChatProject\足球静态页面_backup_20260607_092815.tar.gz` (2.3MB)
- `D:\WeChatProject\足球静态页面_backup_20260607_114503.tar.gz` (2.4MB)

---

## 启动方式

```bash
# 本地预览
cd D:\WeChatProject\足球静态页面
npx serve . -p 3000

# 或用 Python
python -m http.server 3000
```

然后访问 `http://localhost:3000`

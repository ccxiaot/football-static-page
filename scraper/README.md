# 足球数据爬虫

从原站 GitHub Pages 拉取实时足球赛事数据。

## 数据源

原站 `chen-1119.github.io` 通过 GitHub Actions 每小时从中国竞彩网抓取数据并更新到 GitHub Pages。

本脚本从原站拉取最新数据到本地 `data/` 目录。

| 文件 | 说明 |
|------|------|
| `matches-current.json` | 当前/未来赛事 (含预测、赔率) |
| `matches-history.json` | 历史已完场赛事 (3000+ 场) |
| `sync-meta.json` | 同步元数据 |

## 使用方法

```bash
# 安装依赖
cd scraper
npm install

# 拉取最新数据
node update-data.js

# 启动本地服务
npx serve .. -p 3000
```

## 自动更新

项目配置了 GitHub Actions，每小时自动拉取最新数据并提交到仓库。

手动触发: GitHub → Actions → Update Football Data → Run workflow

## 数据流

```
竞彩网 → 原站 GitHub Actions (每小时) → 原站 GitHub Pages
                                              ↓
本项目 scraper/fetch-matches.js ←←←←←←←←←←←←←←
                                              ↓
                                    data/*.json (本地)
                                              ↓
                                    index.html (前端读取)
```

## 前端数据加载

前端通过 `fetch()` 从 `data/` 目录读取 JSON 文件：

- 首次加载时获取全部数据
- 每 30 秒自动刷新 `matches-current.json` 和 `sync-meta.json`
- `matches-history.json` 仅在历史页面加载时获取
- `worldcup.json` 仅在世界杯页面加载时获取

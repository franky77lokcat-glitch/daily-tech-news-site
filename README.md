# 每日科技资讯网站

这是一个每天早上自动获取科技资讯并展示的网站。主页读取 `app/data/latest-tech-news.ts`，同步保留 `app/data/latest-tech-news.json` 方便检查。更新脚本会优先从官方博客、公司 newsroom、研究发布和产品公告等一手来源抓取固定日报窗口内的内容。

每期日报覆盖以北京时间当天 08:00 为结束点、向前 36 小时的资讯。例如 `2026-07-12` 早报包含 `2026-07-10 20:00` 到 `2026-07-12 08:00` 之间发布的资讯。

## 本地运行

```bash
pnpm install
pnpm run dev
```

打开 `http://localhost:3000/` 查看网站。

## 手动更新资讯

```bash
node scripts/fetch-tech-news.mjs
```

生成指定日期早报：

```bash
node scripts/fetch-tech-news.mjs --date 2026-07-11
```

可选环境变量：

```bash
NEWS_DATE=2026-07-11 NEWS_MAX_ITEMS=16 node scripts/fetch-tech-news.mjs
```

脚本会同时更新最新数据文件，并把当期保存到 `app/data/archive/YYYY-MM-DD.json`。页面支持通过 `/?date=2026-07-11` 回看历史早报。

## 自动更新

`.github/workflows/daily-tech-news.yml` 已配置为北京时间每天早上 8 点运行。它会：

1. 抓取官方/原始科技 RSS 源。
2. 更新 `app/data/latest-tech-news.json`、`app/data/latest-tech-news.ts` 和 `app/data/archive/YYYY-MM-DD.json`。
3. 如果内容有变化，自动提交到仓库。

如果部署平台绑定了这个仓库的主分支，新的提交会触发重新部署。

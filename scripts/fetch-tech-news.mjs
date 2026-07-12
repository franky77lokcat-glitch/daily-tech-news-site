import { mkdir, readdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";

const JSON_OUTPUT_PATH = new URL("../app/data/latest-tech-news.json", import.meta.url);
const TS_OUTPUT_PATH = new URL("../app/data/latest-tech-news.ts", import.meta.url);
const ARCHIVE_DIR = new URL("../app/data/archive/", import.meta.url);
const ARCHIVE_INDEX_PATH = new URL("../app/data/archive-index.ts", import.meta.url);
const WINDOW_HOURS = 24 * 7;
const MAX_ITEMS = Number.parseInt(process.env.NEWS_MAX_ITEMS ?? "20", 10);
const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;

function readArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatBeijingDateTime(date) {
  const beijing = new Date(date.getTime() + BEIJING_OFFSET_MS);
  return `${beijing.getUTCFullYear()}-${pad(beijing.getUTCMonth() + 1)}-${pad(beijing.getUTCDate())}T${pad(beijing.getUTCHours())}:${pad(beijing.getUTCMinutes())}:00+08:00`;
}

function parseBriefDate(value) {
  if (value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error("--date must use YYYY-MM-DD");
  }

  if (value) return value;

  const now = new Date();
  const beijingNow = new Date(now.getTime() + BEIJING_OFFSET_MS);
  const briefDate = new Date(Date.UTC(
    beijingNow.getUTCFullYear(),
    beijingNow.getUTCMonth(),
    beijingNow.getUTCDate()
  ));

  if (beijingNow.getUTCHours() < 8) {
    briefDate.setUTCDate(briefDate.getUTCDate() - 1);
  }

  return `${briefDate.getUTCFullYear()}-${pad(briefDate.getUTCMonth() + 1)}-${pad(briefDate.getUTCDate())}`;
}

function getWindowForBriefDate(briefDate) {
  const [year, month, day] = briefDate.split("-").map(Number);
  const windowEndDate = new Date(Date.UTC(year, month - 1, day, 0, 0, 0));
  const windowStartDate = new Date(windowEndDate.getTime() - WINDOW_HOURS * 60 * 60 * 1000);
  const dayStartDate = new Date(windowEndDate.getTime() - 8 * 60 * 60 * 1000);

  return {
    briefDate,
    generatedAt: `${briefDate}T08:00:00+08:00`,
    windowStart: formatBeijingDateTime(windowStartDate),
    windowEnd: formatBeijingDateTime(windowEndDate),
    dayStart: formatBeijingDateTime(dayStartDate),
    dayStartDate,
    windowStartDate,
    windowEndDate
  };
}

const feeds = [
  { source: "OpenAI 官方发布", category: "AI", url: "https://openai.com/news/rss.xml" },
  { source: "Google Cloud 官方博客", category: "AI", url: "https://cloud.google.com/blog/rss" },
  { source: "Meta 官方 Newsroom", category: "今日新奇", url: "https://about.fb.com/news/feed/" },
  { source: "Microsoft 官方博客", category: "商业科技", url: "https://blogs.microsoft.com/feed/" },
  { source: "Apple Newsroom", category: "数码科技", url: "https://www.apple.com/newsroom/rss-feed.rss" },
  { source: "NVIDIA 官方博客", category: "科技信息热点", url: "https://blogs.nvidia.com/feed/" },
  { source: "Anthropic 官方发布", category: "AI", url: "https://www.anthropic.com/news/rss.xml" }
];

function decodeXml(value = "") {
  return value
    .replaceAll("<![CDATA[", "")
    .replaceAll("]]>", "")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getTag(block, tag) {
  const match = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return decodeXml(match?.[1] ?? "");
}

function getLink(block) {
  const atom = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i);
  if (atom?.[1]) return decodeXml(atom[1]);
  return getTag(block, "link");
}

function getDate(block) {
  const value = getTag(block, "pubDate") || getTag(block, "updated") || getTag(block, "published") || getTag(block, "dc:date");
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

function summarize(text) {
  const clean = decodeXml(text);
  if (!clean) return "原文未提供摘要，请打开来源查看完整内容。";
  return clean.length > 118 ? `${clean.slice(0, 116)}...` : clean;
}

function classify(title, fallback) {
  const text = title.toLowerCase();
  if (/ai|openai|model|llm|agent|gemini|claude/.test(text)) return "AI";
  if (/iphone|mac|surface|device|glass|wearable|siri|apple|pc/.test(text)) return "数码科技";
  if (/chip|nvidia|amd|semiconductor|gpu|tsmc|infrastructure|data center/.test(text)) return "科技信息热点";
  if (/security|hack|breach|vulnerability|malware|sandbox/.test(text)) return "科技信息热点";
  if (/developer|github|code|api|tool/.test(text)) return "开发者工具";
  if (/research|science|weather|earth|benchmark/.test(text)) return "研究前沿";
  if (/business|sales|enterprise|cloud|copilot/.test(text)) return "商业科技";
  return fallback;
}

function parseFeed(xml, feed) {
  const blocks = xml.match(/<item[\s\S]*?<\/item>|<entry[\s\S]*?<\/entry>/gi) ?? [];
  return blocks.map((block) => {
    const title = getTag(block, "title");
    const link = getLink(block);
    const published = getDate(block);
    const description = getTag(block, "description") || getTag(block, "summary") || getTag(block, "content:encoded");
    const id = createHash("sha1").update(`${feed.source}:${link || title}`).digest("hex").slice(0, 12);

    return {
      id,
      title,
      source: feed.source,
      category: classify(title, feed.category),
      publishedAt: published.toISOString(),
      url: link,
      summary: summarize(description),
      detail: "这条由官方渠道自动抓取。当前版本先保留原文摘要，后续可以接入二次改写流程，把它扩展成更完整的日报式解读。",
      whyItMatters: "这条动态可能影响产品路线、投资方向、开发者工作流或企业技术采购，需要结合原文继续判断。",
      verification: "官方 RSS 自动抓取；已保留一手来源链接，未进行人工复核。",
      section: classify(title, feed.category) === "今日新奇" ? "curious" : "brief"
    };
  }).filter((item) => item.title && item.url);
}

async function fetchFeed(feed) {
  const response = await fetch(feed.url, {
    headers: {
      "user-agent": "DailyTechNewsBot/1.0 (+https://example.com)"
    }
  });

  if (!response.ok) {
    throw new Error(`${feed.source} returned ${response.status}`);
  }

  return parseFeed(await response.text(), feed);
}

const briefDate = parseBriefDate(readArg("--date") ?? process.env.NEWS_DATE);
const window = getWindowForBriefDate(briefDate);
const settled = await Promise.allSettled(feeds.map(fetchFeed));
const fetchedItems = settled
  .flatMap((result) => result.status === "fulfilled" ? result.value : [])
  .filter((item) => {
    const publishedAt = new Date(item.publishedAt);
    return publishedAt >= window.windowStartDate && publishedAt < window.windowEndDate;
  })
  .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
const todayItems = fetchedItems.filter((item) => {
  const publishedAt = new Date(item.publishedAt);
    return publishedAt >= window.dayStartDate && publishedAt < window.windowEndDate;
  });
const selectedItems = todayItems.length > 0 ? todayItems : fetchedItems;
const selectionMode = todayItems.length > 0 ? "brief-date" : "fallback-7d";
const selectionNote = todayItems.length > 0
  ? "优先采用报道日期当天发布的官方资讯。"
  : "报道日期当天没有资讯，改用近一周内的资讯，允许与历史日期重复。";
const items = selectedItems.slice(0, MAX_ITEMS);

const payload = {
  briefDate: window.briefDate,
  generatedAt: window.generatedAt,
  windowStart: window.windowStart,
  windowEnd: window.windowEnd,
  dayStart: window.dayStart,
  windowHours: WINDOW_HOURS,
  selectionMode,
  selectionNote,
  sources: feeds.map((feed) => ({
    name: feed.source,
    url: new URL(feed.url).origin
  })),
  items
};

if (items.length === 0) {
  throw new Error(`No items were fetched for ${window.windowStart} to ${window.windowEnd}. Check feed URLs or choose another --date.`);
}

async function writeArchiveIndex() {
  const entries = await readdir(ARCHIVE_DIR);
  const dates = entries
    .filter((entry) => /^\d{4}-\d{2}-\d{2}\.json$/.test(entry))
    .map((entry) => entry.replace(/\.json$/, ""))
    .sort()
    .reverse();

  const imports = dates
    .map((date, index) => `import archive${index} from "./archive/${date}.json";`)
    .join("\n");
  const records = dates
    .map((date, index) => `  "${date}": archive${index}`)
    .join(",\n");

  await writeFile(
    ARCHIVE_INDEX_PATH,
    `${imports}\n\nexport const archives = {\n${records}\n} as const;\n\nexport const archiveDates = ${JSON.stringify(dates, null, 2)} as const;\n`
  );
}

await mkdir(ARCHIVE_DIR, { recursive: true });
await writeFile(new URL(`${briefDate}.json`, ARCHIVE_DIR), `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(JSON_OUTPUT_PATH, `${JSON.stringify(payload, null, 2)}\n`);
await writeFile(TS_OUTPUT_PATH, `const newsData = ${JSON.stringify(payload, null, 2)};\n\nexport default newsData;\n`);
await writeArchiveIndex();
console.log(`Wrote ${items.length} items for ${briefDate} to latest files and archive/${briefDate}.json`);

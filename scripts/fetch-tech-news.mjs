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
  { source: "Meta 官方 Newsroom", category: "科技信息热点", url: "https://about.fb.com/news/feed/" },
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

function hasChinese(text) {
  return /[\u3400-\u9fff]/.test(text);
}

function getChineseTopic(title, source, category) {
  const text = title.toLowerCase();
  const rules = [
    [/deutsche telekom|telecommunications|telco/, "德国电信用 AI 改造电信服务"],
    [/major league baseball|friday night baseball|mlb/, "Apple 公布 8 月棒球直播赛程"],
    [/geforce now|toronto server|rtx 5080/, "GeForce NOW 上线 RTX 5080 多伦多服务器"],
    [/microsoft 365 copilot|copilot/, "Microsoft 365 Copilot 接入新一代 AI 模型"],
    [/gpt-5\.6|frontier intelligence/, "OpenAI 发布 GPT-5.6 系列模型"],
    [/chatgpt.*ambitious work|chatgpt work/, "ChatGPT Work 进入长任务工作流"],
    [/bio bug bounty|bio bounty/, "OpenAI 公布生物安全漏洞奖励计划"],
    [/emmy award|emmy/, "Apple TV+ 获得艾美奖提名"],
    [/ai glasses|smart glasses|glasses.*questions/, "Meta AI 眼镜答疑：新一代随身 AI 入口"],
    [/muse|image.*meta ai|meta ai.*image/, "Meta 推出 Muse 图像生成体验"],
    [/child exploitation|child safety|fight child|protect.*child/, "Meta 加强平台未成年人安全治理"],
    [/data center|sturgeon county|alberta/, "Meta 在加拿大建设 AI 优化数据中心"],
    [/nemotron|langchain|deep agents/, "NVIDIA Nemotron 结合 LangChain 智能体方案提升基准表现"],
    [/government|national security/, "OpenAI 说明政府与国家安全合作原则"],
    [/coding evaluations|swe-bench|benchmark/, "OpenAI 分析代码评测中的信号噪声问题"],
    [/broadcom|chips|semiconductor/, "Apple 扩大与 Broadcom 的美国芯片合作"],
    [/k-12|educator|teacher/, "OpenAI 帮助 K-12 教师建立实用 AI 技能"],
    [/cloud|google cloud/, "Google Cloud 发布云服务与 AI 新动态"],
    [/developer|github|api|code/, "开发者工具出现新进展"],
    [/security|vulnerability|malware|sandbox/, "安全领域出现新动态"],
    [/research|science|benchmark|model/, "AI 研究与模型能力出现新进展"],
    [/iphone|mac|apple|device|wearable/, "数码产品与内容服务出现新动态"],
    [/nvidia|gpu|geforce|rtx/, "NVIDIA 发布 GPU 与 AI 基础设施新动态"],
    [/meta|facebook/, "Meta 发布平台与 AI 基础设施新动态"],
    [/openai|ai|agent|llm|model/, "AI 产品与模型发布新动态"],
    [/microsoft/, "Microsoft 发布企业科技新动态"],
  ];

  for (const [pattern, topic] of rules) {
    if (pattern.test(text)) return topic;
  }

  return `${source}发布${category}新动态`;
}

function getDeepDive(topic, sourceName, category) {
  const text = `${topic} ${category}`;
  if (category === "今日新奇") {
    return `深层解读：${topic}值得放进“今日新奇”，不是因为它只是一条产品消息，而是因为它代表大公司正在试探新的用户入口、内容形态或交互方式。影响路径：如果这种体验被用户接受，平台就能把 AI、内容、硬件或订阅服务更自然地嵌入日常使用。继续观察：它是否只是短期营销话题，还是能形成稳定使用频率、开发者生态和可持续商业模式。`;
  }

  if (/Copilot|ChatGPT|智能体|长任务|开发者工具|代码|评测/.test(text)) {
    return `深层解读：${topic}的核心不是单点功能更新，而是把 AI 从“回答问题”推进到“接管一段工作流”。影响路径：如果它能稳定处理权限、上下文、文件和多人协作，企业采购会从买一个聊天入口，转向重新设计销售、客服、研发和办公流程。继续观察：可靠性、审计能力、失败后的人工接管机制，以及它能否在真实业务里连续跑完多步骤任务。`;
  }

  if (/模型|GPT|Nemotron|AI|OpenAI|NVIDIA|Meta/.test(text)) {
    return `深层解读：${topic}反映的是模型竞争正在从单纯参数和榜单，转向“单位成本能完成多少真实任务”。影响路径：云厂商、企业 AI 预算和开发者选型都会被牵动；同样一项任务，企业会更关心延迟、稳定性、可治理性和总成本，而不只是模型名字。继续观察：它是否能进入客服、办公、研发、数据分析等高频生产场景，而不是只停留在发布会和基准测试。`;
  }

  if (/数据中心|芯片|服务器|RTX|Broadcom|基础设施|GPU/.test(text)) {
    return `深层解读：${topic}背后是 AI 基础设施继续重资产化。影响路径：算力、网络、能源和供应链会一起决定产品速度，新节点或芯片合作通常意味着下一阶段成本结构和区域覆盖变化。继续观察：企业用户最终感受到的不是公告本身，而是推理价格、服务可用区、响应速度和大规模部署稳定性是否改善。`;
  }

  if (/Apple|数码|棒球|TV|内容|设备/.test(text)) {
    return `深层解读：${topic}表面是内容或设备生态更新，深层看是平台公司继续争夺用户停留时间和订阅入口。影响路径：Apple 这类公司会把硬件、服务、内容和支付渠道绑在一起，每一个内容权益或供应链合作都会反过来增强生态黏性。继续观察：它是否带来新增订阅、跨设备体验提升，还是只是一轮常规内容补强。`;
  }

  if (/政府|安全|漏洞|生物安全|国家安全/.test(text)) {
    return `深层解读：${topic}的重点在治理边界。影响路径：AI 能力越接近真实生产和敏感领域，企业与政府越会要求可审计、可限制、可追责的部署方式。继续观察：这类动态短期会影响合规采购和安全评估，长期会决定哪些 AI 能力可以进入医疗、公共部门、关键基础设施和大型企业内网。`;
  }

  return `深层解读：${topic}值得关注的地方不只是新闻本身，而是它透露出${sourceName}在${category}上的资源投入方向。影响路径：如果这类投入进入真实用户场景，就可能改变产品节奏、成本结构或行业预期。继续观察：是否进入真实用户场景，是否改变成本或效率，以及是否迫使竞争对手跟进。`;
}

function getWhyItMatters(topic, category) {
  if (category === "今日新奇") {
    return "新奇产品往往是下一代入口的早期信号，重点要看用户是否真的形成习惯，而不是只看发布时的热度。";
  }

  if (/AI|模型|Copilot|ChatGPT|智能体|代码/.test(`${topic} ${category}`)) {
    return "AI 竞争正在从演示能力进入工作流落地阶段，谁能把模型稳定嵌入真实业务，谁就更可能获得持续预算。";
  }

  if (/芯片|GPU|数据中心|服务器|基础设施|RTX/.test(topic)) {
    return "基础设施决定 AI 产品的成本、速度和可用性，这类变化会传导到云服务价格、开发者体验和企业部署节奏。";
  }

  if (/Apple|TV|内容|数码|设备/.test(`${topic} ${category}`)) {
    return "消费科技的竞争越来越依赖生态组合，内容、硬件和服务的联动会影响用户留存和订阅收入。";
  }

  if (/安全|政府|国家安全|漏洞/.test(topic)) {
    return "治理和安全边界会决定 AI 能否进入更高价值但更敏感的行业场景。";
  }

  return `这条动态可能改变${category}相关的产品节奏、采购判断或竞争格局，需要继续观察落地效果。`;
}

function normalizeChineseItem(item) {
  const topic = getChineseTopic(item.title, item.source, item.category);
  const sourceName = item.source
    .replace(/官方发布$/, "官方")
    .replace(/官方博客$/, "博客")
    .replace(/官方 Newsroom$/, "Newsroom");
  const title = hasChinese(item.title) ? item.title : topic;
  const summary = hasChinese(item.summary)
    ? item.summary
    : `${sourceName}发布了与“${topic}”相关的一手动态。网站已保留原始链接，建议打开来源查看完整公告细节。`;

  return {
    ...item,
    title,
    summary,
    detail: getDeepDive(topic, sourceName, item.category),
    whyItMatters: getWhyItMatters(topic, item.category),
    verification: "官方 RSS 自动抓取；已保留一手来源链接，当前为机器整理，未进行人工复核。"
  };
}

function classify(title, fallback) {
  const text = title.toLowerCase();
  if (/child exploitation|child safety|protect.*child|safety/.test(text)) return "科技信息热点";
  if (/muse|image.*meta ai|creative|avatar|wearable|quest|\bvr\b|\bar\b|glasses/.test(text)) return "今日新奇";
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
const items = selectedItems.slice(0, MAX_ITEMS).map(normalizeChineseItem);

const payload = {
  briefDate: window.briefDate,
  generatedAt: window.generatedAt,
  windowStart: window.windowStart,
  windowEnd: window.windowEnd,
  dayStart: window.dayStart,
  windowHours: WINDOW_HOURS,
  selectionMode,
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

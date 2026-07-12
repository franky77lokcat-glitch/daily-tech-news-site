import { BeijingClock } from "./BeijingClock";
import { getNewsPayload, type NewsItem } from "./data/news";

const formatDate = new Intl.DateTimeFormat("zh-CN", {
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Shanghai",
});

const formatDay = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "Asia/Shanghai",
});

function formatTime(value: string) {
  return formatDate.format(new Date(value));
}

function formatDateOnly(value: string) {
  return formatDay.format(new Date(value)).replaceAll("/", "-");
}

function formatWindowDuration(hours: number) {
  if (hours === 24 * 7) return "近一周";
  if (hours % 24 === 0) return `${hours / 24} 天`;
  return `${hours} 小时`;
}

export default function Home() {
  const { data } = getNewsPayload();
  const focusItems = data.items.filter((item) => item.section === "focus");
  const leadItems = (focusItems.length > 0 ? focusItems : data.items).slice(0, 5);
  const curiousItems = data.items.filter((item) => item.section === "curious").slice(0, 5);
  const briefingItems = data.items;
  const groupedBriefingItems = briefingItems.reduce<Record<string, NewsItem[]>>((groups, item) => {
    groups[item.category] ??= [];
    groups[item.category].push(item);
    return groups;
  }, {});
  const categoryCount = Object.keys(groupedBriefingItems).length;
  const sourceCount = new Set(briefingItems.map((item) => item.source)).size;
  const coverageLabel = briefingItems.length > 0
    ? `${briefingItems.length} 条资讯 · ${categoryCount} 个栏目 · ${sourceCount} 个来源`
    : "暂无入选资讯";
  const briefDate = data.briefDate ?? formatDateOnly(data.generatedAt);
  const windowLabel = data.windowStart && data.windowEnd
    ? `${formatTime(data.windowStart)} - ${formatTime(data.windowEnd)}`
    : `过去 ${data.windowHours} 小时`;
  const windowDurationLabel = formatWindowDuration(data.windowHours);

  return (
    <main className="site-shell">
      <section className="hero-panel">
        <div className="signal-strip" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <div className="hero-grid">
          <div className="hero-copy">
            <nav className="topline">
              <span className="brand-mark">
                <span aria-hidden="true" />
                番茄日报
              </span>
              <BeijingClock />
            </nav>

            <div>
              <div className="brief-meta">
                <p>{briefDate} 早报</p>
                <p>覆盖窗口：{windowLabel}</p>
              </div>
              <h1 className="hero-title">
                未来早报，今日知道
              </h1>
              <p className="hero-deck">
                面向快速阅读的科技早报网站：只追踪官方博客、公司 newsroom、研究发布和产品公告等一手资料，先给结论，再展开日报式背景。
              </p>
              <div className="hero-stats" aria-label="本期概览">
                <div>
                  <span>{briefingItems.length}</span>
                  <p>入选资讯</p>
                </div>
                <div>
                  <span>{categoryCount}</span>
                  <p>覆盖栏目</p>
                </div>
                <div>
                  <span>{sourceCount}</span>
                  <p>一手来源</p>
                </div>
              </div>
            </div>

            <section className="focus-panel">
              <div className="panel-heading">
                <h2>{focusItems.length > 0 ? "今日重点" : "综合速读"}</h2>
                <span>{coverageLabel}</span>
              </div>
              <div className="lead-list">
                {leadItems.length > 0 ? leadItems.map((item, index) => (
                  <article className="lead-card" key={item.id}>
                    <div className="lead-card-inner">
                      <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                      <div>
                        <div className="lead-meta">
                          <span>{item.category}</span>
                          <span>{item.source}</span>
                          <span>{formatTime(item.publishedAt)}</span>
                        </div>
                        <h3>
                          <a href={item.url} rel="noreferrer" target="_blank">
                            <span className="news-title"><span aria-hidden="true" className="new-dot" />{item.title}</span>
                          </a>
                        </h3>
                        <p>{item.summary}</p>
                        <details className="brief-detail">
                          <summary>展开深层解读</summary>
                          <p>{item.detail}</p>
                          <dl>
                            <div>
                              <dt>为什么重要</dt>
                              <dd>{item.whyItMatters}</dd>
                            </div>
                            <div>
                              <dt>验证</dt>
                              <dd>{item.verification} <a href={item.url} rel="noreferrer" target="_blank">查看一手来源</a></dd>
                            </div>
                          </dl>
                        </details>
                      </div>
                    </div>
                  </article>
                )) : (
                  <p className="empty-state">这个{windowDurationLabel}窗口暂时没有抓取到符合条件的资讯。可以检查抓取脚本后重新生成最新一期。</p>
                )}
              </div>
            </section>
          </div>
        </div>
      </section>

      {curiousItems.length > 0 ? (
        <section className="content-band curious-band">
          <section className="content-inner">
            <div className="section-heading compact">
              <h2>今日新奇</h2>
              <span>大公司发布的创造性产品与理念</span>
            </div>
            <div className="curious-list">
              {curiousItems.map((item) => (
                <details className="brief-row compact-row" key={item.id}>
                  <summary>
                    <span className="tag">{item.category}</span>
                    <strong className="news-title"><span aria-hidden="true" className="new-dot" />{item.title}</strong>
                    <small>{item.source} · {formatTime(item.publishedAt)}</small>
                  </summary>
                  <p>{item.summary}</p>
                  <p>{item.detail}</p>
                  <dl>
                    <div>
                      <dt>为什么重要</dt>
                      <dd>{item.whyItMatters}</dd>
                    </div>
                    <div>
                      <dt>验证</dt>
                      <dd>{item.verification} <a href={item.url} rel="noreferrer" target="_blank">查看一手来源</a></dd>
                    </div>
                  </dl>
                </details>
              ))}
            </div>
        </section>
        </section>
      ) : null}

      <section className="content-band">
        <section className="content-inner">
          <div className="section-heading">
            <h2>全部早报</h2>
            <span>按栏目归档，点开看详细背景</span>
          </div>
          {briefingItems.length > 0 ? (
            <div className="category-card-grid">
            {Object.entries(groupedBriefingItems).map(([category, items]) => (
              <section className="category-card" key={category}>
                <header>
                  <h3>{category}</h3>
                  <span>{items.length} 条</span>
                </header>
                <div className="brief-list">
                  {items.map((item, index) => (
                    <details className="brief-row grouped-row" key={item.id}>
                      <summary>
                        <span className="rank">{String(index + 1).padStart(2, "0")}</span>
                        <strong className="news-title"><span aria-hidden="true" className="new-dot" />{item.title}</strong>
                        <small>{item.source} · {formatTime(item.publishedAt)}</small>
                      </summary>
                      <p>{item.summary}</p>
                      <p>{item.detail}</p>
                      <dl>
                        <div>
                          <dt>为什么重要</dt>
                          <dd>{item.whyItMatters}</dd>
                        </div>
                        <div>
                          <dt>验证</dt>
                          <dd>{item.verification} <a href={item.url} rel="noreferrer" target="_blank">查看一手来源</a></dd>
                        </div>
                      </dl>
                    </details>
                  ))}
                </div>
              </section>
            ))}
            </div>
          ) : (
            <p className="empty-state">这个{windowDurationLabel}窗口没有抓取到符合条件的资讯。</p>
          )}
        </section>
      </section>

      <section className="source-band">
        <div className="source-inner">
          <div>
            <h2>自动更新方式</h2>
            <p>
              更新脚本会优先读取官方 RSS、公司博客和产品公告。北京时间早上 08:00 前仍生成并展示前一天早报；08:00 后生成当天早报。每期收录跨度为{windowDurationLabel}，目标约 20 条资讯，并写入 <code>app/data/latest-tech-news.json</code> 和页面数据模块。
            </p>
          </div>
          <div className="source-grid">
            {data.sources.map((source) => (
              <a href={source.url} key={`${source.name}-${source.url}`} rel="noreferrer" target="_blank">{source.name}</a>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}

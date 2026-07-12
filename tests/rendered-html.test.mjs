import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the daily tech news site", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>番茄日报<\/title>/i);
  assert.match(html, /未来早报，今日知道/);
  assert.match(html, /覆盖窗口/);
  assert.match(html, /自动更新方式/);
  assert.doesNotMatch(html, /回看|历史早报/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton|Your site is taking shape/);
});

function assertItemsWithinWindow(data) {
  assert.equal(data.windowHours, 24 * 7);
  assert.equal(typeof data.briefDate, "string");
  assert.equal(typeof data.windowStart, "string");
  assert.equal(typeof data.windowEnd, "string");

  const start = new Date(data.windowStart);
  const end = new Date(data.windowEnd);
  assert.equal(end.getTime() - start.getTime(), 7 * 24 * 60 * 60 * 1000);

  for (const item of data.items) {
    const publishedAt = new Date(item.publishedAt);
    assert.ok(publishedAt >= start, `${item.title} is before the window`);
    assert.ok(publishedAt < end, `${item.title} is after the window`);
  }
}

function assertChineseBriefingText(item) {
  for (const field of ["title", "summary", "detail", "whyItMatters", "verification"]) {
    assert.match(item[field], /[\u3400-\u9fff]/, `${field} should contain Chinese text: ${item[field]}`);
  }

  assert.doesNotMatch(
    item.title,
    /[A-Za-z][A-Za-z\s,'".:;!?-]{24,}/,
    `title should not be a long English headline: ${item.title}`,
  );
}

test("keeps the news data structured", async () => {
  const raw = await readFile(new URL("../app/data/latest-tech-news.json", import.meta.url), "utf8");
  const data = JSON.parse(raw);

  assert.equal(typeof data.generatedAt, "string");
  assert.ok(Array.isArray(data.sources));
  assert.ok(data.sources.length >= 3);
  assert.ok(Array.isArray(data.items));
  assert.ok(data.sources.every((source) => typeof source.name === "string" && /^https?:\/\//.test(source.url)));
  assert.equal("selectionNote" in data, false);
  assert.doesNotMatch(raw, /报道日期当天没有资讯|允许与历史日期重复|Meta 官方 Newsroom发布今日新奇/);
  assertItemsWithinWindow(data);

  for (const item of data.items) {
    assert.equal(typeof item.title, "string");
    assert.equal(typeof item.url, "string");
    assert.match(item.url, /^https?:\/\//);
    assert.equal(typeof item.verification, "string");
    assert.equal(typeof item.detail, "string");
    assertChineseBriefingText(item);
    if (item.section === "curious") {
      assert.doesNotMatch(item.title, /发布.*新动态|今日新奇新动态/);
      assert.match(item.detail, /深层解读：/);
    }
  }
});

test("uses the previous Beijing brief before 8am", async () => {
  const { getCurrentBriefDate } = await import("../app/data/brief-date.mjs");

  assert.equal(getCurrentBriefDate(new Date("2026-07-13T21:59:00Z")), "2026-07-13");
  assert.equal(getCurrentBriefDate(new Date("2026-07-14T00:00:00Z")), "2026-07-14");
});

test("keeps archived brief data within each one-week Beijing window", async () => {
  const archiveDir = new URL("../app/data/archive/", import.meta.url);
  const entries = await readdir(archiveDir);
  const archiveFiles = entries.filter((entry) => /^\d{4}-\d{2}-\d{2}\.json$/.test(entry));
  assert.ok(archiveFiles.length >= 1);

  for (const file of archiveFiles) {
    const raw = await readFile(new URL(file, archiveDir), "utf8");
    const data = JSON.parse(raw);
    assertItemsWithinWindow(data);
  }
});

import latestNews from "./latest-tech-news";
import { archiveDates, archives } from "./archive-index";

export type NewsItem = {
  id: string;
  title: string;
  source: string;
  category: string;
  publishedAt: string;
  url: string;
  summary: string;
  detail: string;
  whyItMatters: string;
  verification: string;
  section?: "focus" | "curious" | "brief";
};

export type NewsPayload = {
  briefDate?: string;
  generatedAt: string;
  dayStart?: string;
  windowStart?: string;
  windowEnd?: string;
  windowHours: number;
  selectionMode?: "brief-date" | "fallback-7d";
  selectionNote?: string;
  sources: { name: string; url: string }[];
  items: NewsItem[];
};

export function getNewsPayload(date?: string) {
  if (date && date in archives) {
    return {
      data: archives[date as keyof typeof archives] as NewsPayload,
      requestedDate: date,
      isArchiveHit: true,
    };
  }

  return {
    data: latestNews as NewsPayload,
    requestedDate: date,
    isArchiveHit: false,
  };
}

export { archiveDates };

// Turns raw visit records into daily rollups and multi-day summaries.
// Used by the scheduled functions and the /api/ai-visits endpoint.

import { getStore, type Store } from "@netlify/blobs";
import type { BotFamily } from "./bots.ts";
import { TZ, daysEnding } from "./time.ts";

export const STORE_NAME = "ai-visits";

export interface Visit {
  t: string;
  day: string;
  category: string;
  sub: string | null;
  bot: string;
  family: BotFamily;
  ua: string;
  host: string;
  path: string;
  query: string | null;
  method: string;
  status: number;
  country: string | null;
}

export interface DailyRollup {
  day: string;
  tz: string;
  visits: number;
  byCategory: Record<string, number>; // ai-agent vs crawler (Netlify's label)
  byFamily: Record<string, number>; // ai-agent, ai-crawler, search, seo, social, other
  byBot: Record<string, number>;
  byPath: Record<string, number>;
  byStatus: Record<string, number>;
  byBotPath: Record<string, Record<string, number>>; // bot -> path -> count
  botFamily: Record<string, string>; // bot -> family, kept so summaries can group by it
  generatedAt: string;
  /** true when the day had fully ended (Malaysia time) at generation. */
  complete: boolean;
}

export interface Summary {
  period: { start: string; end: string; days: number; tz: string };
  visits: number;
  aiVisits: number; // ai-agent + ai-crawler families only
  byCategory: Record<string, number>;
  byFamily: Record<string, number>;
  byBot: Array<{ bot: string; visits: number; family?: string }>;
  byPath: Array<{ path: string; visits: number }>;
  byStatus: Record<string, number>;
  byDay: Array<{ day: string; visits: number; aiVisits: number }>;
  topPathsByBot: Record<string, Array<{ path: string; visits: number }>>;
  zeroDays: string[];
  generatedAt: string;
}

export function openStore(): Store {
  // Strong consistency so a rollup run a few minutes after midnight
  // sees every record written before midnight.
  return getStore({ name: STORE_NAME, consistency: "strong" });
}

function bump(map: Record<string, number>, key: string, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

async function inBatches<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    const batch = items.slice(i, i + size);
    out.push(...(await Promise.all(batch.map(fn))));
  }
  return out;
}

/** Read every raw visit record for one Malaysia day. */
export async function loadVisits(store: Store, day: string): Promise<Visit[]> {
  const { blobs } = await store.list({ prefix: `visits/${day}/` });
  const records = await inBatches(blobs, 40, (b) => store.get(b.key, { type: "json" }) as Promise<Visit | null>);
  return records.filter((r): r is Visit => !!r);
}

/** Build (and store) the rollup for one day from its raw records. */
export async function buildDailyRollup(store: Store, day: string, todayDay: string): Promise<DailyRollup> {
  const visits = await loadVisits(store, day);
  const rollup: DailyRollup = {
    day,
    tz: TZ,
    visits: visits.length,
    byCategory: {},
    byFamily: {},
    byBot: {},
    byPath: {},
    byStatus: {},
    byBotPath: {},
    botFamily: {},
    generatedAt: new Date().toISOString(),
    complete: day < todayDay,
  };
  for (const v of visits) {
    bump(rollup.byCategory, v.category);
    bump(rollup.byFamily, v.family);
    bump(rollup.byBot, v.bot);
    bump(rollup.byPath, v.path);
    bump(rollup.byStatus, String(v.status));
    rollup.byBotPath[v.bot] ??= {};
    bump(rollup.byBotPath[v.bot], v.path);
    rollup.botFamily[v.bot] = v.family;
  }
  // Only persist complete days. A partial "today" rollup would be stale
  // within minutes and might be mistaken for the final number.
  if (rollup.complete) await store.setJSON(`daily/${day}.json`, rollup);
  return rollup;
}

/** Fetch a stored rollup, building it if missing (or if `rebuild` is set). */
export async function getDailyRollup(store: Store, day: string, todayDay: string, rebuild = false): Promise<DailyRollup> {
  if (!rebuild && day < todayDay) {
    const existing = (await store.get(`daily/${day}.json`, { type: "json" })) as DailyRollup | null;
    if (existing) return existing;
  }
  return buildDailyRollup(store, day, todayDay);
}

function sortTop(map: Record<string, number>, limit: number) {
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
}

/** Sum the rollups for the `days` days ending on `endDay` (inclusive). */
export async function buildSummary(store: Store, endDay: string, days: number, todayDay: string): Promise<Summary> {
  const dayList = daysEnding(endDay, days);
  const rollups = await inBatches(dayList, 7, (d) => getDailyRollup(store, d, todayDay));

  const byCategory: Record<string, number> = {};
  const byFamily: Record<string, number> = {};
  const byBot: Record<string, number> = {};
  const byPath: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const byBotPath: Record<string, Record<string, number>> = {};
  const botFamily: Record<string, string> = {};
  const byDay: Summary["byDay"] = [];
  const zeroDays: string[] = [];
  let visits = 0;

  for (const r of rollups) {
    if (r.visits === 0) zeroDays.push(r.day);
    visits += r.visits;
    const aiToday = (r.byFamily["ai-agent"] ?? 0) + (r.byFamily["ai-crawler"] ?? 0);
    byDay.push({ day: r.day, visits: r.visits, aiVisits: aiToday });
    for (const [k, n] of Object.entries(r.byCategory)) bump(byCategory, k, n);
    for (const [k, n] of Object.entries(r.byFamily)) bump(byFamily, k, n);
    for (const [k, n] of Object.entries(r.byBot)) bump(byBot, k, n);
    for (const [k, n] of Object.entries(r.byPath)) bump(byPath, k, n);
    for (const [k, n] of Object.entries(r.byStatus)) bump(byStatus, k, n);
    for (const [bot, paths] of Object.entries(r.byBotPath)) {
      byBotPath[bot] ??= {};
      for (const [p, n] of Object.entries(paths)) bump(byBotPath[bot], p, n);
    }
    Object.assign(botFamily, r.botFamily ?? {});
  }

  // Top 5 pages for each of the 10 busiest bots.
  const topPathsByBot: Summary["topPathsByBot"] = {};
  for (const [bot] of sortTop(byBot, 10)) {
    topPathsByBot[bot] = sortTop(byBotPath[bot] ?? {}, 5).map(([path, n]) => ({ path, visits: n }));
  }

  return {
    period: { start: dayList[0], end: dayList[dayList.length - 1], days, tz: TZ },
    visits,
    aiVisits: (byFamily["ai-agent"] ?? 0) + (byFamily["ai-crawler"] ?? 0),
    byCategory,
    byFamily,
    byBot: sortTop(byBot, 50).map(([bot, n]) => ({ bot, visits: n, family: botFamily[bot] })),
    byPath: sortTop(byPath, 25).map(([path, n]) => ({ path, visits: n })),
    byStatus,
    byDay,
    topPathsByBot,
    zeroDays,
    generatedAt: new Date().toISOString(),
  };
}

/** A short plain-English line for messages and logs. */
export function describeSummary(s: Summary): string {
  const agents = s.byFamily["ai-agent"] ?? 0;
  const crawlers = s.byFamily["ai-crawler"] ?? 0;
  const top = s.byBot
    .filter((b) => b.family === "ai-agent" || b.family === "ai-crawler")
    .slice(0, 5)
    .map((b) => `${b.bot} ${b.visits}`)
    .join(", ");
  const pages = s.byPath.slice(0, 3).map((p) => p.path).join(", ");
  return (
    `${s.aiVisits} AI visits to bookwithkong.com from ${s.period.start} to ${s.period.end}. ` +
    `${agents} from AI agents and ${crawlers} from AI crawlers` +
    (top ? ` (${top}).` : ".") +
    (pages ? ` Most fetched pages: ${pages}.` : "") +
    (s.visits > s.aiVisits ? ` Plus ${s.visits - s.aiVisits} visits from search, SEO and other bots.` : "")
  );
}

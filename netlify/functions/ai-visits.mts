// Read-only API for the AI visit counts.
//
//   GET /api/ai-visits                    latest weekly summary (from Monday's run)
//   GET /api/ai-visits?days=7             last 7 complete days, summed live
//   GET /api/ai-visits?days=30            any number of days up to 90
//   GET /api/ai-visits?day=2026-09-22     one day's rollup (built on demand if missing)
//   GET /api/ai-visits?day=...&rebuild=1  force that day to be re-totalled from raw records
//   GET /api/ai-visits?today=1            today so far (Malaysia time), straight from raw records
//   GET /api/ai-visits?recent=20          the last N raw records, for checking it is recording
//
// Every call needs the secret from the AI_VISITS_TOKEN environment variable,
// either as  Authorization: Bearer <token>  or  ?token=<token>.

import type { Config } from "@netlify/functions";
import { buildSummary, describeSummary, getDailyRollup, loadVisits, openStore, type Summary } from "../shared/tally.ts";
import { isValidDay, myDay, shiftDay } from "../shared/time.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

function authorised(request: Request, url: URL): boolean {
  const expected = process.env.AI_VISITS_TOKEN;
  if (!expected) return false;
  const header = request.headers.get("authorization") ?? "";
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
  const supplied = bearer || url.searchParams.get("token") || "";
  return supplied.length > 0 && supplied === expected;
}

export default async (request: Request) => {
  const url = new URL(request.url);

  if (request.method !== "GET") return json({ error: "GET only" }, 405);
  if (!process.env.AI_VISITS_TOKEN) {
    return json({ error: "AI_VISITS_TOKEN is not set in the Netlify environment variables" }, 500);
  }
  if (!authorised(request, url)) return json({ error: "unauthorised" }, 401);

  const store = openStore();
  const today = myDay();
  const q = url.searchParams;

  try {
    // Recent raw records, newest first. Useful right after deploying.
    if (q.has("recent")) {
      const limit = Math.min(Math.max(parseInt(q.get("recent") || "20", 10) || 20, 1), 200);
      const records = [...(await loadVisits(store, today)), ...(await loadVisits(store, shiftDay(today, -1)))];
      records.sort((a, b) => (a.t < b.t ? 1 : -1));
      return json({ today, count: records.length, records: records.slice(0, limit) });
    }

    // Today so far, from raw records.
    if (q.get("today") === "1") {
      const rollup = await getDailyRollup(store, today, today, true);
      return json(rollup);
    }

    // One specific day.
    if (q.has("day")) {
      const day = q.get("day");
      if (!isValidDay(day)) return json({ error: "day must be YYYY-MM-DD" }, 400);
      if (day > today) return json({ error: "that day has not happened yet" }, 400);
      const rollup = await getDailyRollup(store, day, today, q.get("rebuild") === "1");
      return json(rollup);
    }

    // Last N complete days, summed live from the daily rollups.
    if (q.has("days")) {
      const days = parseInt(q.get("days") || "7", 10);
      if (!Number.isFinite(days) || days < 1 || days > 90) return json({ error: "days must be between 1 and 90" }, 400);
      const end = shiftDay(today, -1);
      const summary = await buildSummary(store, end, days, today);
      return json({ ...summary, text: describeSummary(summary) });
    }

    // Default: the latest weekly summary written by ai-visits-weekly.
    const latest = (await store.get("summaries/latest.json", { type: "json" })) as Summary | null;
    if (!latest) {
      return json(
        {
          message:
            "No weekly summary yet. The first one is written on Monday at 09:00 Malaysia time. " +
            "Use ?days=7 for a live total or ?today=1 for today so far.",
        },
        404,
      );
    }
    return json({ ...latest, text: describeSummary(latest) });
  } catch (error) {
    console.error("ai-visits: request failed", error);
    return json({ error: "something went wrong reading the visit store", detail: String(error) }, 500);
  }
};

export const config: Config = {
  path: "/api/ai-visits",
};

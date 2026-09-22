// Daily rollup. Runs at 00:20 Malaysia time (16:20 UTC) and totals the
// day that just ended, so the weekly summary and the API only ever have
// to read seven small files instead of every raw record.

import type { Config } from "@netlify/functions";
import { buildDailyRollup, openStore } from "../shared/tally.ts";
import { myDay, shiftDay } from "../shared/time.ts";

export default async () => {
  const store = openStore();
  const today = myDay();
  const yesterday = shiftDay(today, -1);

  const rollup = await buildDailyRollup(store, yesterday, today);
  console.log(
    `ai-visits-daily: ${yesterday} had ${rollup.visits} bot visits ` +
      `(${rollup.byFamily["ai-agent"] ?? 0} AI agent, ${rollup.byFamily["ai-crawler"] ?? 0} AI crawler)`,
  );

  // Also refresh the day before, in case any late records landed after
  // the previous run. Cheap at this scale.
  const dayBefore = shiftDay(today, -2);
  await buildDailyRollup(store, dayBefore, today);
};

export const config: Config = {
  // 16:20 UTC = 00:20 Asia/Kuala_Lumpur (UTC+8, no daylight saving)
  schedule: "20 16 * * *",
};

// Weekly summary. Runs Monday 09:00 Malaysia time (01:00 UTC) and sums
// the previous Monday to Sunday. Saves the result to Blobs as
//   summaries/<period end date>.json   (kept forever, one per week)
//   summaries/latest.json              (what /api/ai-visits returns by default)

import type { Config } from "@netlify/functions";
import { buildSummary, describeSummary, openStore } from "../shared/tally.ts";
import { myDay, shiftDay } from "../shared/time.ts";

export default async () => {
  const store = openStore();
  const today = myDay();
  const periodEnd = shiftDay(today, -1); // yesterday (Sunday)

  const summary = await buildSummary(store, periodEnd, 7, today);

  await store.setJSON(`summaries/${periodEnd}.json`, summary);
  await store.setJSON("summaries/latest.json", summary);

  console.log(`ai-visits-weekly: ${describeSummary(summary)}`);
};

export const config: Config = {
  // 01:00 UTC Monday = 09:00 Asia/Kuala_Lumpur Monday
  schedule: "0 1 * * 1",
};

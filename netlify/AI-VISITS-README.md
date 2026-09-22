# AI visit counter for bookwithkong.com

Counts visits from AI agents (ChatGPT, Claude, Perplexity and others answering
a live question) and AI crawlers (GPTBot, ClaudeBot and others collecting
pages in bulk), without Netlify log drains.

## Files

| File | What it does |
| --- | --- |
| `edge-functions/ai-visit-log.ts` | Runs only on requests Netlify labels `ai-agent` or `crawler`. Writes one JSON record per visit to the `ai-visits` Blobs store, then passes the request through untouched. |
| `functions/ai-visits-daily.mts` | 00:20 Malaysia time. Totals yesterday into `daily/YYYY-MM-DD.json`. |
| `functions/ai-visits-weekly.mts` | Monday 09:00 Malaysia time. Sums the previous Monday to Sunday into `summaries/latest.json` and `summaries/<sunday>.json`. |
| `functions/ai-visits.mts` | `GET /api/ai-visits`. Read-only API, protected by `AI_VISITS_TOKEN`. |
| `shared/bots.ts` | Maps user agent strings to bot names and families. Add new bots here. |
| `shared/tally.ts` | Rollup and summary logic. |
| `shared/time.ts` | Malaysia-time date helpers. |

All days are Kuala Lumpur calendar days (UTC+8).

## One-time setup

1. Commit and push. Netlify installs `@netlify/blobs` and `@netlify/functions`
   from `package.json`, bundles the edge function and the three functions.
   Check the deploy log for "1 edge function" and "3 functions".
2. In Netlify: Project configuration > Environment variables > Add a variable
   `AI_VISITS_TOKEN` with a long random value (for example the output of
   `openssl rand -hex 24`). Scope: Functions. Then redeploy once so the
   function picks it up.

## Checking it works

Trigger a fake crawler visit, then read it back:

```
curl -s -o /dev/null -A "GPTBot/1.2" https://bookwithkong.com/pricing
curl -s "https://bookwithkong.com/api/ai-visits?recent=5" -H "Authorization: Bearer YOUR_TOKEN"
```

The second call should list a record with `"bot": "GPTBot"` and the path.

## Reading the numbers

```
/api/ai-visits                 latest weekly summary
/api/ai-visits?days=7          last 7 complete days, live
/api/ai-visits?days=30         last 30 days
/api/ai-visits?today=1         today so far
/api/ai-visits?day=2026-09-22  one day
```

Every response includes a `text` field with a one-line plain-English summary.

## Notes

- Human visitors never trigger the edge function, so there is no change to
  page speed or the booking flow for customers.
- If the Blobs write fails the page is still served. Errors go to the edge
  function log in Netlify.
- Netlify's `crawler` label also covers Googlebot and Bingbot. They are
  recorded and shown under `search`, separate from `ai-crawler`, so the AI
  numbers stay clean.
- Raw records are kept indefinitely. At Kong's traffic this is tiny. If it
  ever matters, delete `visits/<old day>/` prefixes; the daily rollups keep
  the totals.
- Static assets (CSS, JS, images, fonts) are excluded so the counts are about
  pages, not the files that come with them.

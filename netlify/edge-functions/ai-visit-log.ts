// Records AI agent and crawler visits to bookwithkong.com.
//
// Netlify runs this edge function ONLY when the request carries a
// Netlify-Agent-Category header matching ai-agent or crawler (see the
// `header` matcher in `config` below). Human browser traffic never
// invokes it, so there is no cost or latency for customers.
//
// For each matching request it:
//   1. lets the request continue to the site as normal (redirects included)
//   2. writes one small JSON record to the "ai-visits" Blobs store
//   3. returns the site's response untouched
//
// If the write fails for any reason the visitor still gets the page.

import type { Config, Context } from "@netlify/edge-functions";
import { getStore } from "@netlify/blobs";
import { identifyBot } from "../shared/bots.ts";
import { myDay } from "../shared/time.ts";

export default async (request: Request, context: Context) => {
  const response = await context.next();

  try {
    const category = request.headers.get("netlify-agent-category") ?? "unknown";
    const userAgent = request.headers.get("user-agent") ?? "";
    const url = new URL(request.url);
    const now = new Date();
    const day = myDay(now);
    const { bot, family } = identifyBot(userAgent, category);
    // Netlify writes the label as "crawler; ai", so trim both parts.
    const [baseCategory, subCategory] = category.split(";").map((part) => part.trim());

    const key = `visits/${day}/${now.getTime()}-${crypto.randomUUID().slice(0, 8)}.json`;

    const store = getStore("ai-visits");
    await store.setJSON(key, {
      t: now.toISOString(),
      day,
      category: baseCategory,
      sub: subCategory || null,
      bot,
      family,
      ua: userAgent.slice(0, 300),
      host: url.host,
      path: url.pathname,
      query: url.search ? url.search.slice(0, 200) : null,
      method: request.method,
      status: response.status,
      country: context.geo?.country?.code ?? null,
    });
  } catch (error) {
    // Never let logging break the page.
    console.error("ai-visit-log: failed to record visit", error);
  }

  return response;
};

export const config: Config = {
  path: "/*",
  // Skip static assets and our own function endpoints so the counts are
  // about pages, not the CSS and images that come with them.
  excludedPath: [
    "/.netlify/*",
    "/api/*",
    "/*.css",
    "/*.js",
    "/*.map",
    "/*.png",
    "/*.jpg",
    "/*.jpeg",
    "/*.gif",
    "/*.webp",
    "/*.avif",
    "/*.svg",
    "/*.ico",
    "/*.woff",
    "/*.woff2",
    "/*.ttf",
    "/*.mp4",
    "/*.webm",
  ],
  // Only run for AI agents and crawlers. Netlify sets this header itself.
  header: { "netlify-agent-category": "(ai-agent|crawler)" },
  // If the edge function itself errors, serve the page as if it did not exist.
  onError: "bypass",
};

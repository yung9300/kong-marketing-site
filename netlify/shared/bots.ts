// Shared between the edge function (Deno) and the Node functions.
// Keep this file free of Node-only or Deno-only APIs.

export type BotFamily =
  | "ai-agent" // fetches a page live to answer one person's question
  | "ai-crawler" // bulk collection for training or an AI search index
  | "search" // classic search engines
  | "seo" // SEO tools
  | "social" // link previews and social crawlers
  | "other";

export interface BotMatch {
  bot: string;
  family: BotFamily;
}

// Order matters: the first pattern that matches wins, so the more
// specific agents (ChatGPT-User, Claude-User, Perplexity-User) sit
// above the bulk crawlers from the same company.
const KNOWN: Array<[RegExp, string, BotFamily]> = [
  // OpenAI
  [/ChatGPT-User/i, "ChatGPT", "ai-agent"],
  [/OAI-SearchBot/i, "OpenAI SearchBot", "ai-crawler"],
  [/GPTBot/i, "GPTBot", "ai-crawler"],
  // Anthropic
  [/Claude-User/i, "Claude", "ai-agent"],
  [/Claude-SearchBot/i, "Claude SearchBot", "ai-crawler"],
  [/ClaudeBot|anthropic-ai/i, "ClaudeBot", "ai-crawler"],
  // Perplexity
  [/Perplexity-User/i, "Perplexity", "ai-agent"],
  [/PerplexityBot/i, "PerplexityBot", "ai-crawler"],
  // Google
  [/Google-Extended/i, "Google-Extended", "ai-crawler"],
  [/GoogleOther/i, "GoogleOther", "ai-crawler"],
  [/Google-CloudVertexBot/i, "Google Vertex", "ai-crawler"],
  [/Googlebot|AdsBot-Google|Mediapartners-Google/i, "Googlebot", "search"],
  // Microsoft
  [/bingbot|BingPreview/i, "Bingbot", "search"],
  // Meta
  [/meta-externalfetcher/i, "Meta AI", "ai-agent"],
  [/meta-externalagent/i, "Meta crawler", "ai-crawler"],
  [/facebookexternalhit|FacebookBot/i, "Facebook", "social"],
  // Apple
  [/Applebot-Extended/i, "Applebot-Extended", "ai-crawler"],
  [/Applebot/i, "Applebot", "search"],
  // Others
  [/DuckAssistBot/i, "DuckAssist", "ai-agent"],
  [/DuckDuckBot/i, "DuckDuckGo", "search"],
  [/MistralAI-User/i, "Mistral", "ai-agent"],
  [/Bytespider|TikTokSpider/i, "Bytespider", "ai-crawler"],
  [/Amazonbot/i, "Amazonbot", "ai-crawler"],
  [/CCBot/i, "Common Crawl", "ai-crawler"],
  [/cohere-ai|cohere-training-data-crawler/i, "Cohere", "ai-crawler"],
  [/YouBot/i, "You.com", "ai-crawler"],
  [/Diffbot/i, "Diffbot", "ai-crawler"],
  [/Timpibot/i, "Timpi", "ai-crawler"],
  [/omgili|omgilibot|webzio/i, "Webz.io", "ai-crawler"],
  [/ImagesiftBot/i, "Imagesift", "ai-crawler"],
  [/PetalBot/i, "PetalBot", "search"],
  [/Yandex/i, "Yandex", "search"],
  [/Baiduspider/i, "Baidu", "search"],
  [/HubSpot/i, "HubSpot", "seo"],
  [/AhrefsBot/i, "Ahrefs", "seo"],
  [/SemrushBot/i, "Semrush", "seo"],
  [/MJ12bot/i, "Majestic", "seo"],
  [/DotBot/i, "Moz", "seo"],
  [/LinkedInBot/i, "LinkedIn", "social"],
  [/Twitterbot/i, "X (Twitter)", "social"],
  [/WhatsApp/i, "WhatsApp", "social"],
  [/TelegramBot/i, "Telegram", "social"],
  [/Slackbot/i, "Slack", "social"],
  [/Discordbot/i, "Discord", "social"],
];

const GENERIC_TOKENS =
  /^(Mozilla|AppleWebKit|KHTML|like|Gecko|Chrome|Safari|Mobile|Linux|Android|Windows|NT|Win64|WOW64|x64|x86_64|Macintosh|Intel|Mac|OS|X|X11|iPhone|iPad|CPU|Version|compatible|U|en|en-US|rv)$/i;

/** Best-effort readable name for a bot that is not in the list above. */
function guessName(ua: string): string {
  // 1. "(compatible; SomeBot/1.0; +https://...)" is the most common shape.
  const compatible = ua.match(/compatible;\s*([^;)/]+)/i);
  if (compatible) return compatible[1].trim().slice(0, 40);

  // 2. Any token that sounds like a bot.
  const tokens = ua.split(/[\s/;()]+/).filter(Boolean);
  const botty = tokens.find((t) => /bot|crawl|spider|fetch|agent|scan|preview/i.test(t) && !GENERIC_TOKENS.test(t));
  if (botty) return botty.slice(0, 40);

  // 3. Last token that is not browser boilerplate (custom names usually trail).
  const meaningful = tokens.filter((t) => !GENERIC_TOKENS.test(t) && !/^\d/.test(t));
  return (meaningful[meaningful.length - 1] ?? tokens[0] ?? "unknown").slice(0, 40);
}

/**
 * Work out which bot sent a request from its User-Agent string and the
 * Netlify-Agent-Category header (for example "ai-agent" or "crawler").
 */
export function identifyBot(userAgent: string, category: string): BotMatch {
  const ua = userAgent || "";
  for (const [pattern, bot, family] of KNOWN) {
    if (pattern.test(ua)) return { bot, family };
  }

  // Unknown bot. Try to pull a readable name out of the UA string so new
  // agents still show up sensibly instead of all being called "Mozilla".
  const name = guessName(ua);
  const base = category.split(";")[0].trim();
  if (base === "ai-agent") return { bot: `${name} (unlisted AI agent)`, family: "ai-agent" };
  return { bot: `${name} (unlisted crawler)`, family: "other" };
}

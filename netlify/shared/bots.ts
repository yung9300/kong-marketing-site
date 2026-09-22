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

/**
 * Work out which bot sent a request from its User-Agent string and the
 * Netlify-Agent-Category header (for example "ai-agent" or "crawler").
 */
export function identifyBot(userAgent: string, category: string): BotMatch {
  const ua = userAgent || "";
  for (const [pattern, bot, family] of KNOWN) {
    if (pattern.test(ua)) return { bot, family };
  }

  // Unknown bot. Fall back to the first product token of the UA string
  // so new agents still show up under a readable name.
  const token = ua.split(/[\s/;(]+/).filter(Boolean)[0] ?? "unknown";
  const name = token.slice(0, 40);
  const base = category.split(";")[0];
  if (base === "ai-agent") return { bot: `${name} (unlisted AI agent)`, family: "ai-agent" };
  return { bot: `${name} (unlisted crawler)`, family: "other" };
}

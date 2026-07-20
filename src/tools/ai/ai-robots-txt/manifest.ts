import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-robots-txt",
  name: "AI robots.txt Custom Rule Builder",
  description:
    "Build a valid, tested robots.txt from plain-language intent or a visual rule builder. Per-user-agent allow/disallow, crawl-delay, sitemap references, and modern AI-crawler control (GPTBot, Google-Extended, CCBot, PerplexityBot, ClaudeBot, Bytespider). Sample-URL tester implementing the Robots Exclusion Protocol, NL intent parser, AI-crawler presets, 'Block all AI training crawlers' one-click, multiple sitemaps, comment annotations, .robots.txt import-to-edit, and honest warnings about unsupported directives (noindex, crawl-delay). Pure-JS + optional BYO-key LLM. 100% client-side, no login, no upload.",
  category: "ai",
  keywords: [
    "robots.txt generator", "robots.txt builder", "block GPTBot robots.txt",
    "robots.txt tester", "AI crawler robots.txt", "CCBot block",
    "Google-Extended", "crawl-delay", "sitemap robots.txt",
    "private robots.txt generator",
  ],
  icon: "bot",
  requiresNetwork: false,
  seo: {
    title: "AI robots.txt Custom Rule Builder — AI-Crawler Control + Tester | UnQTools",
    faq: [
      {
        q: "How does the robots.txt builder work?",
        a: "Use the visual rule builder to add User-agent + Allow/Disallow rules per crawler, or type plain-language intent (e.g. 'block all AI training crawlers' or 'disallow /admin for everyone'). The tool assembles a valid robots.txt with sitemap references, validates syntax, and lets you test sample URLs against the rules to see exactly which rule allows or blocks each URL. Copy or download the result.",
      },
      {
        q: "Which AI crawlers are supported?",
        a: "Modern AI-crawler user agents are first-class presets: GPTBot (OpenAI), Google-Extended (Gemini training), CCBot (Common Crawl — feeds many AI datasets), PerplexityBot, ClaudeBot (Anthropic), Bytespider (ByteDance), FacebookBot, Applebot-Extended, ImagesiftBot, and OAI-SearchBot. A one-click 'Block all AI training crawlers' toggle adds Disallow:/ rules for all of them at once.",
      },
      {
        q: "How does the sample-URL tester work?",
        a: "The tester implements the Robots Exclusion Protocol (RFC 9309): it matches the longest-rule-wins algorithm against path patterns including wildcards (*) and end-of-URL anchors ($). Enter a user-agent + URL, and the tester reports 'allowed' or 'blocked' and identifies the exact rule that decided the outcome. Group rules (User-agent: *) are applied when no specific agent rule matches.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Plain-language NL intent parser (block/allow AI crawlers, disallow paths). (2) Visual per-user-agent rule builder. (3) 10+ AI-crawler presets. (4) 'Block all AI training crawlers' one-click. (5) Multiple sitemap references. (6) Crawl-delay directive (with honest warning that Googlebot ignores it). (7) Comment annotations. (8) Sample-URL tester implementing RFC 9309. (9) Syntax validator. (10) Risky-Directive warnings (Disallow: /, noindex). (11) Honest unsupported-directive notes (noindex, crawl-delay, host). (12) Import-to-edit (paste existing robots.txt). (13) History (localStorage, last 20). (14) Shareable URL. (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my robots.txt sent anywhere? Does robots.txt hide my pages?",
        a: "No — all generation, validation, and testing run locally in your browser. Nothing about your site leaves this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly to the LLM provider you choose. Honesty: robots.txt controls crawling, NOT indexing or secrecy — don't rely on it to hide sensitive pages. Use server-side auth or noindex headers for that. Google ignores noindex/crawl-delay directives inside robots.txt.",
      },
    ],
  },
  status: "done",
};

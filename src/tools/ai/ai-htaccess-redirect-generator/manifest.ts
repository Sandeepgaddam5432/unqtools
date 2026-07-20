import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-htaccess-redirect-generator",
  name: "AI .htaccess Redirect Generator",
  description:
    "Generate Apache .htaccess redirect and rewrite rules from bulk old→new URL pairs or plain-language intent. Supports 301 permanent, 302 temporary, 307, RedirectMatch, RewriteRule with regex capture groups, www/non-www canonicalization, HTTP→HTTPS, hotlink protection, custom error pages, and IP allow/block. Per-rule explanations, sample-URL tester emulating mod_rewrite, and redirect-loop detection. Pure-JS engine — optional BYO-key LLM. 100% client-side, no upload.",
  category: "ai",
  keywords: [
    "htaccess redirect generator", "301 redirect generator", "302 redirect generator",
    "bulk 301 redirect", "htaccess rewrite rule", "RedirectMatch",
    "RewriteRule", "apache redirect", "www to non-www", "http to https",
    "hotlink protection", "custom error pages", "htaccess generator",
    "redirect tester", "private htaccess generator",
  ],
  icon: "redirect",
  requiresNetwork: false,
  seo: {
    title: "AI .htaccess Redirect Generator — Bulk 301/302 + Rewrite Rules, Private | UnQTools",
    faq: [
      {
        q: "How does the AI .htaccess Redirect Generator work?",
        a: "Two modes. (1) Bulk pairs: paste 'old-url → new-url' lines (one per line), pick 301 (permanent) or 302 (temporary), and we emit one Apache directive per line plus a RewriteEngine On header. (2) Pattern: enter a regex pattern and replacement to build a RedirectMatch or RewriteRule with capture groups ($1, $2 …). Toggle www→non-www (or vice versa), HTTP→HTTPS, hotlink protection, custom error pages (404/500/etc.), and IP allow/block — each gets its own block with an explanation. Every rule is explained in plain English so you know exactly what it does.",
      },
      {
        q: "Does the tester really emulate Apache mod_rewrite?",
        a: "It emulates the common subset. We translate Apache RewriteRule patterns (anchored with ^, capture groups in parentheses, $1–$9 back-references, [R=301,L] flags) into equivalent JavaScript regex and run your sample URLs against them. The tester reports which rule matched, the resulting redirect target, and the HTTP status code. For RedirectMatch, we honor the same regex syntax. Edge cases like RewriteCond, %{HTTP_HOST}, and per-directory context are flagged — always test on staging.",
      },
      {
        q: "Can the tool detect redirect loops?",
        a: "Yes. After generating rules we run a static analysis pass that flags obvious loops: a rule whose target resolves back to a pattern it matches (e.g. /old → /old/ which then matches itself), circular chains (A→B→A), and www↔non-www rules that fight each other. We also flag rules whose source and target are identical and rules that would redirect to themselves under canonicalization.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Bulk old→new URL pairs parser. (2) 301 / 302 / 307 status codes. (3) RedirectMatch with regex capture groups. (4) RewriteRule builder with flags. (5) www→non-www and non-www→www canonicalization. (6) HTTP→HTTPS redirect. (7) Hotlink protection block. (8) Custom error pages (404/403/500/…). (9) IP allow/block. (10) Per-rule plain-English explanations. (11) Sample-URL tester emulating mod_rewrite. (12) Redirect loop detection. (13) Rule conflict detection. (14) Copy/download .htaccess. (15) Import existing .htaccess to edit. (16) History (localStorage, last 20). (17) Shareable URL. (18) Optional BYO-key LLM enhancement. (19) Deterministic — same inputs always produce the same rules.",
      },
      {
        q: "Is my URL list sent anywhere?",
        a: "No. All rule generation, testing, loop detection, and explanation logic run locally in your browser. URL lists and rule sets never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "xml-sitemap-generator",
  name: "XML Sitemap Generator",
  description:
    "Generate XML sitemaps for Google/Bing search engines. Bulk URL input, lastmod/changefreq/priority per URL, sitemap index support, robots.txt integration, and stats. 100% client-side.",
  category: "seo",
  keywords: [
    "sitemap", "xml", "google", "bing", "search engines", "crawl", "index",
    "lastmod", "changefreq", "priority", "sitemap index",
  ],
  icon: "list",
  requiresNetwork: false,
  seo: {
    title: "XML Sitemap Generator — Google/Bing Sitemaps | UnQTools",
    faq: [
      {
        q: "What is an XML sitemap?",
        a: "A sitemap is an XML file listing all the URLs on your site you want search engines to crawl and index. It speeds up discovery of new and updated pages. The format is defined at sitemaps.org.",
      },
      {
        q: "What are lastmod, changefreq, priority?",
        a: "lastmod is the date the URL was last modified (YYYY-MM-DD). changefreq hints how often the page changes (always/hourly/daily/weekly/monthly/yearly/never). priority is a 0.0–1.0 value indicating relative importance. Google mostly ignores changefreq and priority, but they remain part of the spec.",
      },
      {
        q: "What is a sitemap index?",
        a: "When you have more than 50,000 URLs or the file exceeds 50MB, you split sitemaps and list them in a sitemap index file (sitemap-index.xml). This tool generates both single sitemaps and sitemap index files.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Bulk URL input — paste a list of URLs. (2) URL counter. (3) Priority presets (0.0–1.0). (4) changefreq options. (5) lastmod date picker. (6) Sitemap index generator. (7) robots.txt integration snippet. (8) gzip note (compress before serving). (9) Stats — URL count, file size. (10) History (localStorage, last 20).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. Sitemap XML generation is pure string templating in your browser. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

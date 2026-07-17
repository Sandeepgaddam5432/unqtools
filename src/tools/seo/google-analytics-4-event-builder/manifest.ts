import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "google-analytics-4-event-builder",
  name: "GA4 Event Builder",
  description:
    "Build Google Analytics 4 event tracking code. Generate gtag.js event calls, GTM dataLayer pushes, and Measurement Protocol payloads. Presets for page_view, scroll, click, form_start, form_submit, purchase. 100% client-side.",
  category: "seo",
  keywords: [
    "ga4", "google analytics", "event tracking", "gtag", "gtm",
    "dataLayer", "measurement protocol", "analytics", "tracking",
  ],
  icon: "line-chart",
  requiresNetwork: false,
  seo: {
    title: "GA4 Event Builder — gtag.js + GTM + Measurement Protocol | UnQTools",
    faq: [
      {
        q: "What is a GA4 event?",
        a: "In Google Analytics 4, every interaction is an event — page views, scrolls, clicks, form submissions, purchases. Events have a name (e.g. 'purchase') and up to 25 parameters (e.g. value, currency, items). You collect events via gtag.js, Google Tag Manager, or the Measurement Protocol.",
      },
      {
        q: "gtag.js vs GTM dataLayer vs Measurement Protocol — when to use which?",
        a: "gtag.js is the direct GA4 snippet — call gtag('event', ...) from your site's JavaScript. GTM dataLayer is for sites using Google Tag Manager — push events to dataLayer and GTM forwards them. Measurement Protocol is for server-side tracking (offline conversions, POS systems, IoT) — POST events to Google's endpoint.",
      },
      {
        q: "What naming rules apply to GA4 events and parameters?",
        a: "Event names: must start with a letter, contain only letters/numbers/underscores, max 40 characters. Parameter names: same rules, max 40 characters. Reserved event names (page_view, scroll, click, etc.) trigger automatic collection — use them only if you're manually sending those events.",
      },
      {
        q: "How many parameters can an event have?",
        a: "Up to 25 parameters per event (was 100 in early GA4, reduced). Custom parameters must be registered in the GA4 admin (Configure → Custom definitions) to appear in reports. Event-scoped custom dimensions are recommended for any parameter you want to filter or report on.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Event name presets (page_view, scroll, click, form_start, form_submit, purchase). (2) Custom parameters (key-value pairs). (3) gtag.js code generation. (4) GTM dataLayer push code generation. (5) Measurement Protocol JSON payload. (6) Event + param name validation (length, characters). (7) Copy each code snippet. (8) Stats — param count. (9) History (localStorage, last 20). (10) Shareable URL — encode form in fragment.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All code generation is pure string manipulation. We don't send events to Google. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

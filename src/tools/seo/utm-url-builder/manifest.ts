import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "utm-url-builder",
  name: "UTM URL Builder",
  description:
    "Build UTM campaign tracking URLs for Google Analytics. Source/medium presets, campaign templates, bulk builder, URL validation, QR code of URL, and GA4 compatibility note. 100% client-side.",
  category: "seo",
  keywords: [
    "utm", "utm parameters", "campaign", "google analytics", "ga4",
    "tracking", "marketing", "utm_source", "utm_medium", "utm_campaign",
  ],
  icon: "link",
  requiresNetwork: false,
  seo: {
    title: "UTM URL Builder — Google Analytics Tracking | UnQTools",
    faq: [
      {
        q: "What are UTM parameters?",
        a: "UTM parameters are query string values (utm_source, utm_medium, utm_campaign, utm_term, utm_content) you append to a URL so Google Analytics can attribute traffic to a specific marketing campaign. They're the industry-standard way to track where your visitors came from.",
      },
      {
        q: "Which UTM parameters are required?",
        a: "utm_source (the referrer — e.g. google, facebook, newsletter), utm_medium (the marketing medium — e.g. cpc, social, email), and utm_campaign (the specific campaign name) are required. utm_term (paid keywords) and utm_content (ad variant) are optional.",
      },
      {
        q: "Are UTMs different in GA4 vs Universal Analytics?",
        a: "The parameter format is identical, but GA4 collects them automatically into the session campaign. Manual tagging is still required for non-Google ad campaigns. Google Ads auto-tagging (gclid) doesn't need UTMs.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Live URL preview. (2) Short URL note (use a shortener after building). (3) Campaign name templates (sale, launch, webinar). (4) Source/medium presets (google/cpc, facebook/social, email/newsletter). (5) Bulk builder — paste multiple URLs and apply same UTMs. (6) URL validation. (7) QR code of final URL (data URL, generated client-side). (8) History (localStorage, last 20). (9) Shareable URL — encode the form in the fragment. (10) GA4 compatibility note.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. UTM URL building is pure string manipulation in your browser. QR code generation uses a client-side SVG/data URL. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

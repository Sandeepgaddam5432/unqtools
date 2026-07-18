import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gtm-datalayer-helper",
  name: "GTM & dataLayer Helper",
  description:
    "Generate Google Tag Manager dataLayer code snippets. dataLayer.push code, custom event trigger config, GTM variable declarations, event presets (page_view, scroll, click, form_submit, purchase), JSON preview, validation, copy. History (localStorage), shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "gtm", "google tag manager", "datalayer", "data layer",
    "tag manager", "custom event", "trigger", "variable",
  ],
  icon: "tags",
  requiresNetwork: false,
  seo: {
    title: "GTM & dataLayer Helper — Push Code + Triggers + Variables | UnQTools",
    faq: [
      {
        q: "What is a dataLayer push?",
        a: "The dataLayer is a JavaScript array (window.dataLayer) that GTM reads to capture information. Pushing {event: 'xxx', ...params} to dataLayer is how you send custom events to GTM, which then fire tags based on triggers you configure.",
      },
      {
        q: "How do I use the generated custom event trigger?",
        a: "The tool outputs a JSON description of the trigger. In GTM, go to Triggers → New → Custom Event, set the Event name to match exactly (e.g. 'purchase'), and use that trigger to fire your tag (GA4 event, conversion, etc.).",
      },
      {
        q: "How do I create the dataLayer variables?",
        a: "For each parameter you push, create a matching GTM Variable: Variables → New → Data Layer Variable → set Data Layer Variable Name to the param key (e.g. 'value'). Then you can reference {{value}} in tags and triggers.",
      },
      {
        q: "What naming rules apply to events and parameters?",
        a: "Both event and parameter names must start with a letter and contain only letters, numbers, and underscores. Max 40 characters. Max 25 parameters per push (GTM warning).",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) dataLayer.push code generation. (2) Custom event trigger description (JSON). (3) GTM variable declarations. (4) Event presets (page_view, scroll, click, form_submit, purchase). (5) JSON preview. (6) Event + param validation. (7) Copy each snippet. (8) Stats — param count. (9) History (localStorage, last 20). (10) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All code generation is pure string manipulation. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

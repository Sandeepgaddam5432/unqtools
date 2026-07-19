import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-html-landing-page-generator",
  name: "AI HTML Landing Page Generator",
  description:
    "Generate a complete, responsive single-file HTML landing page from a prompt or structured inputs. Five templates (SaaS, App, Product, Event, Portfolio) with hero, features, testimonials, pricing, FAQ, and CTA sections. Inline CSS, SEO meta + Open Graph + FAQ schema baked in, dark-mode toggle, theme controls (colors, fonts, radius). Live preview, copy code, download .html. Pure-JS template engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "landing page generator", "html page generator", "ai landing page",
    "single file html", "v0 alternative", "framer alternative",
    "responsive landing page", "no login landing page",
  ],
  icon: "layout-template",
  requiresNetwork: false,
  seo: {
    title: "AI HTML Landing Page Generator — Free, Private, No Login | UnQTools",
    faq: [
      {
        q: "How does the AI HTML landing page generator work?",
        a: "Pick one of five templates (SaaS, App, Product, Event, Portfolio), enter your business name, tagline, features, CTA text, and optional testimonial / pricing / FAQ content. The template engine assembles a complete, single-file HTML document with inline CSS, SEO meta tags, Open Graph tags, JSON-LD FAQPage schema, semantic landmarks, and a dark-mode toggle. The result is shown in a live sandboxed preview and the full HTML is copyable and downloadable as a .html file. No login, no upload, no hosting lock-in.",
      },
      {
        q: "Which templates are available and what sections do they include?",
        a: "Five templates: (1) SaaS — hero + features + pricing + FAQ + CTA. (2) App — hero with phone mockup + features + testimonials + download CTA. (3) Product — hero + features + benefit grid + social proof + buy CTA. (4) Event — hero with date/location + schedule + speakers + register CTA. (5) Portfolio — hero + projects + skills + about + contact. Every template is responsive, accessible, and uses inline CSS so the output is a single self-contained file you can host anywhere.",
      },
      {
        q: "Is the output SEO-ready and accessible?",
        a: "Yes. Every page includes <title>, meta description, meta keywords, canonical link, Open Graph (og:title, og:description, og:type, og:image), Twitter Card summary tags, JSON-LD FAQPage schema when FAQ content is provided, semantic HTML5 landmarks (header/nav/main/section/footer), alt-text placeholders for images, and a skip-to-content link. The HTML is valid HTML5 and works without JavaScript.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five templates (SaaS, App, Product, Event, Portfolio). (2) Business name, tagline, features, CTA, and optional testimonial / pricing / FAQ / schedule inputs. (3) Theme controls (primary color, accent color, font family, border radius). (4) Dark-mode toggle baked into every page. (5) SEO meta + Open Graph + Twitter Card. (6) JSON-LD FAQPage schema. (7) Live sandboxed iframe preview. (8) Copy HTML. (9) Download self-contained .html. (10) Section toggles (enable/disable pricing, testimonials, FAQ). (11) Prompt-to-template matching (describe your business, we pick a template). (12) Sample prompt presets. (13) History (localStorage, last 20). (14) Shareable URL. (15) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All template matching, HTML/CSS generation, and schema building runs locally in your browser. Inputs never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose.",
      },
    ],
  },
  status: "done",
};

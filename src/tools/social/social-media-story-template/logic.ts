/**
 * Story Template Generator — pure data + lookup logic.
 * Generate story templates per platform.
 */

export type Platform = "instagram" | "snapchat" | "facebook" | "tiktok";

export interface StoryTemplate {
  id: string;
  platform: Platform;
  title: string;
  slides: { kind: "hook" | "value" | "cta"; text: string }[];
  recommendedDuration: number; // seconds per slide
  aspectRatio: string;
  tips: string[];
}

export const TEMPLATES: StoryTemplate[] = [
  {
    id: "ig-q&a",
    platform: "instagram",
    title: "Q&A Tuesday",
    slides: [
      { kind: "hook", text: "Ask me anything 👇" },
      { kind: "value", text: "Answer #1 with a single sentence + sticker" },
      { kind: "value", text: "Answer #2 — share a quick tip" },
      { kind: "cta", text: "Drop your next question in the poll 🗳️" },
    ],
    recommendedDuration: 7,
    aspectRatio: "9:16",
    tips: ["Use the Q&A sticker", "Pin answers as highlights"],
  },
  {
    id: "ig-product-launch",
    platform: "instagram",
    title: "Product launch countdown",
    slides: [
      { kind: "hook", text: "Something big is coming… 👀" },
      { kind: "value", text: "Show a teaser silhouette of the product" },
      { kind: "value", text: "Reveal one feature per slide" },
      { kind: "cta", text: "Tap the link to pre-order 🔗" },
    ],
    recommendedDuration: 5,
    aspectRatio: "9:16",
    tips: ["Use countdown sticker", "Add a link sticker"],
  },
  {
    id: "sc-behind-scenes",
    platform: "snapchat",
    title: "Behind-the-scenes",
    slides: [
      { kind: "hook", text: "POV: it'shoot day 🎬" },
      { kind: "value", text: "Show the messy studio" },
      { kind: "value", text: "Introduce the crew" },
      { kind: "cta", text: "What should we make next? Reply!" },
    ],
    recommendedDuration: 6,
    aspectRatio: "9:16",
    tips: ["Keep it raw and authentic", "Use Snapchat stickers"],
  },
  {
    id: "fb-event-promo",
    platform: "facebook",
    title: "Event promo",
    slides: [
      { kind: "hook", text: "Join us this Friday 📅" },
      { kind: "value", text: "Who, what, when, where" },
      { kind: "value", text: "Highlight a guest or activity" },
      { kind: "cta", text: "RSVP with the link below 🔗" },
    ],
    recommendedDuration: 8,
    aspectRatio: "9:16",
    tips: ["Add event link sticker", "Share to your Page"],
  },
  {
    id: "tt-tutorial",
    platform: "tiktok",
    title: "Quick tutorial",
    slides: [
      { kind: "hook", text: "Stop scrolling 🛑 — learn this in 30 seconds" },
      { kind: "value", text: "Step 1: simple action" },
      { kind: "value", text: "Step 2: build on step 1" },
      { kind: "value", text: "Step 3: the payoff" },
      { kind: "cta", text: "Follow for more tips ✅" },
    ],
    recommendedDuration: 4,
    aspectRatio: "9:16",
    tips: ["Add trending sound", "Use on-screen captions"],
  },
  {
    id: "tt-testimonial",
    platform: "tiktok",
    title: "Customer testimonial",
    slides: [
      { kind: "hook", text: "Real customer, real result 💬" },
      { kind: "value", text: "Quote from customer" },
      { kind: "value", text: "Before / after photo" },
      { kind: "cta", text: "Try it yourself — link in bio 🔗" },
    ],
    recommendedDuration: 5,
    aspectRatio: "9:16",
    tips: ["Get written permission", "Tag the customer"],
  },
];

export function byPlatform(platform: Platform): StoryTemplate[] {
  return TEMPLATES.filter((t) => t.platform === platform);
}

export function getById(id: string): StoryTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

export function allPlatforms(): Platform[] {
  return Array.from(new Set(TEMPLATES.map((t) => t.platform)));
}

export function toText(t: StoryTemplate): string {
  const lines = [
    `${t.title} (${t.platform})`,
    `Aspect ratio: ${t.aspectRatio} · ${t.recommendedDuration}s/slide`,
    "",
    ...t.slides.map((s, i) => `${i + 1}. [${s.kind}] ${s.text}`),
    "",
    "Tips:",
    ...t.tips.map((tip) => `- ${tip}`),
  ];
  return lines.join("\n");
}

export const PLATFORM_LABELS: Record<Platform, string> = {
  instagram: "Instagram",
  snapchat: "Snapchat",
  facebook: "Facebook",
  tiktok: "TikTok",
};

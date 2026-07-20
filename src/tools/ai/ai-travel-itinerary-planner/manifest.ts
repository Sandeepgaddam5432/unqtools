import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-travel-itinerary-planner",
  name: "AI Travel Itinerary Planner",
  description:
    "Plan day-by-day travel itineraries from destination, duration, pace, budget, and interests. Five trip-type templates (city break, beach, adventure, cultural, foodie) with realistic timing, travel-gap awareness, opening-hours notes, restaurants, map-ready stops, .ics calendar export, Markdown export, pace slider, day regenerate, multi-city support, and history (localStorage). Pure-JS engine — optional BYO-key LLM. 100% client-side, nothing uploaded.",
  category: "ai",
  keywords: [
    "travel itinerary", "trip planner", "day by day itinerary",
    "ai trip planner", "vacation planner", "travel planner no login",
    "itinerary generator", "mindtrip alternative", "layla alternative",
    "travel schedule", "city break planner", "beach trip planner",
  ],
  icon: "map",
  requiresNetwork: false,
  seo: {
    title: "AI Travel Itinerary Planner — Day-by-Day, Private, No Login | UnQTools",
    faq: [
      {
        q: "How does the itinerary planner work?",
        a: "Enter your destination, duration (days), pace (relaxed/balanced/packed), budget (budget/mid-range/luxury), trip type (city break, beach, adventure, cultural, foodie), and optional interests. The pure-JS engine picks activity and restaurant templates for your trip type, schedules them across each day with realistic start times, builds in travel-gap buffers between stops, and adds opening-hours notes. Each day is a timeline of stops with map links.",
      },
      {
        q: "Can I regenerate or reorder a single day?",
        a: "Yes. Use the 'Regenerate day' button to get a new variant for any day — the engine rotates through alternate templates so a regenerated day is different from the original. The pace slider lets you shift from relaxed (fewer stops, longer gaps) to packed (more stops, tighter gaps) and re-schedules the whole trip instantly.",
      },
      {
        q: "What can I export?",
        a: "Three formats: a plain-text itinerary, a Markdown itinerary (suitable for notes apps), and a .ics calendar file you can import into Google Calendar, Apple Calendar, or Outlook. Each stop also has a Google Maps directions link. Multi-city trips are supported — separate cities with '->' or 'to' (e.g. 'Paris -> Lyon').",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Five trip-type templates (city break, beach, adventure, cultural, foodie). (2) Pace control (relaxed/balanced/packed). (3) Budget levels (budget/mid-range/luxury) with per-day cost estimate. (4) Realistic timing with travel-gap buffers between stops. (5) Opening-hours notes per activity. (6) Restaurant suggestions per meal. (7) Map-ready stop list with Google Maps directions link. (8) .ics calendar export. (9) Markdown + text export. (10) Multi-city trip support. (11) Day regenerate. (12) Interests filter. (13) Local tips section per destination. (14) 'Verify before you go' honesty note. (15) History (localStorage, last 20). (16) Shareable URL. (17) Sample destination presets. (18) Optional BYO-key LLM enhancement.",
      },
      {
        q: "Is my trip data sent anywhere?",
        a: "No. All itinerary templating, scheduling, and export runs locally in your browser. Your destination, dates, and interests never leave this device. The only network call is if you paste your own LLM API key and click 'Enhance with LLM' — that request goes directly from your browser to the LLM provider you choose. Hours, prices, and transit times can change; always verify opening hours before you go. We do not take booking commissions.",
      },
    ],
  },
  status: "done",
};

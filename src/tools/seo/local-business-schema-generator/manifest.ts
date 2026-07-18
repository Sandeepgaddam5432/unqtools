import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "local-business-schema-generator",
  name: "Local Business Schema Generator",
  description:
    "Generate LocalBusiness JSON-LD schema for local SEO. Business type selector, day-by-day opening hours, geo coordinates, ratings & reviews, price range, area served, image, Google Rich Results link, history, shareable URL. 100% client-side.",
  category: "seo",
  keywords: [
    "local business schema", "json-ld", "local seo", "schema.org",
    "restaurant schema", "store schema", "opening hours", "geo coordinates",
  ],
  icon: "store",
  requiresNetwork: false,
  seo: {
    title: "Local Business Schema Generator — LocalBusiness JSON-LD | UnQTools",
    faq: [
      {
        q: "What is LocalBusiness schema?",
        a: "LocalBusiness is a Schema.org type that tells search engines about a physical business — name, address, phone, opening hours, geo coordinates, ratings, and price range. Google uses it to display rich results like the Local Business knowledge panel, opening hours in SERPs, and Google Maps listings.",
      },
      {
        q: "Which business types are supported?",
        a: "All Schema.org LocalBusiness subtypes are supported, including Restaurant, Store, MedicalBusiness, Dentist, HealthAndBeautyBusiness, AutoRepair, Electrician, Plumber, HairSalon, Hotel, FinancialService, TravelAgency, and more. The tool emits the right @type value based on your selection.",
      },
      {
        q: "How are opening hours formatted?",
        a: "Each day has an open/close time pair. Empty days are treated as closed. The tool emits a schema.org openingHoursSpecification array with dayOfWeek, opens, and closes fields. Days off can be left blank.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Business type selector (12+ subtypes). (2) Day-by-day opening hours builder. (3) Geo coordinates input. (4) Rating & review count fields. (5) Price range field. (6) Area served field. (7) Image URL field. (8) Google Rich Results test link. (9) Schema.org docs link. (10) History (localStorage, last 20). (11) Shareable URL.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. JSON-LD generation runs locally. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

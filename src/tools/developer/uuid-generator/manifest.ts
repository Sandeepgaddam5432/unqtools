import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "uuid-generator",
  name: "UUID Generator",
  description:
    "Generate RFC 4122 v4 UUIDs in bulk, with optional hyphens, uppercase, and prefix options. Uses crypto.randomUUID — 100% private.",
  category: "developer",
  keywords: ["uuid", "guid", "v4", "random uuid", "rfc 4122", "unique id", "identifier"],
  icon: "fingerprint",
  requiresNetwork: false,
  seo: {
    title: "UUID Generator — RFC 4122 v4 UUIDs in Bulk | UnQTools",
    faq: [
      {
        q: "What is a UUID?",
        a: "A Universally Unique Identifier (UUID) is a 128-bit number typically displayed as 32 hex digits in 8-4-4-4-12 format (e.g. 550e8400-e29b-41d4-a716-446655440000). RFC 4122 defines the standard.",
      },
      {
        q: "How random are these UUIDs?",
        a: "This tool uses the browser's crypto.randomUUID() API, which generates version-4 UUIDs using a cryptographically secure random number generator. The 122 random bits give ~5.3×10^36 possible UUIDs — collisions are astronomically unlikely.",
      },
      {
        q: "Are these safe to use as database primary keys?",
        a: "Yes. UUID v4 is the most common choice for distributed primary keys because no coordination is needed between generators. The trade-off vs sequential IDs is index fragmentation — if that's a concern, consider UUID v7 (time-ordered), which we may add in a future update.",
      },
    ],
  },
  status: "done",
};

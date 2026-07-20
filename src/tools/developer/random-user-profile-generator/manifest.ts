/**
 * Random User Profile Generator — Tool Manifest.
 * Tool #285 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "random-user-profile-generator",
  name: "Random User Profile Generator",
  description:
    "Generate coherent fake user profiles with 50+ correlated fields (name, email, phone, address, avatar, company, job, login, etc.). Multi-profile batch, JSON/CSV/XML export, seedable reproducibility, algorithmic (non-real) avatars. 100% client-side.",
  category: "developer",
  keywords: [
    "random user", "fake profile", "test persona", "randomuser",
    "random user generator", "fake user data", "profile generator",
    "test data generator", "persona generator", "mock user",
  ],
  icon: "user-round",
  requiresNetwork: false,
  seo: {
    title: "Random User Profile Generator — 50+ fields, JSON/CSV/XML, Seeded | UnQTools",
    faq: [
      {
        q: "How does the random user profile generator work?",
        a: "You pick a gender mix, nationality/locale, count, and optional seed. The tool generates fully correlated personas where the email/username derive from the name, the age matches the date of birth, and the location matches the chosen country. Each profile has 50+ fields including name, login, address, phone, avatar, company, and job title.",
      },
      {
        q: "Are the avatars real photos of people?",
        a: "No. Avatars are algorithmically generated SVG-style identicons via a DiceBear-style URL pattern — no real human faces are ever used, so there are zero consent or privacy concerns. The avatar is deterministic per seed, so the same seed always produces the same avatar.",
      },
      {
        q: "Can I generate thousands of profiles at once?",
        a: "Yes. The count field accepts up to 50,000 profiles per batch. Output is produced as JSON, CSV, or XML and can be downloaded as a single file. All generation happens in your browser — nothing is uploaded.",
      },
      {
        q: "Is the output reproducible?",
        a: "Yes. If you provide a seed (any string), the same seed plus the same options will always produce the exact same set of profiles. This is useful for test fixtures that need to be stable across CI runs.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) 50+ correlated fields per profile. (2) Gender mix (any, male, female). (3) 12 nationality presets with locale-matched names, cities, states, and phone formats. (4) Algorithmic avatars (DiceBear-style URL, no real faces). (5) Seedable reproducibility. (6) Custom email domain. (7) Field include/exclude filters. (8) JSON / CSV / XML / NDJSON export. (9) Batch up to 50,000. (10) localStorage history (max 20). (11) Shareable URL with config in fragment. (12) Per-profile copy.",
      },
    ],
  },
  status: "done",
};

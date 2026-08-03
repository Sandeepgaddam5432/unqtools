import type { ToolManifest } from "../../../lib/tool";
export const manifest: ToolManifest = {
  id: "argon2-hash-generator",
  name: "Argon2 Hash Generator",
  description: "Argon2 parameter calculator & hash string generator. Argon2d/i/id, strength analysis, presets, custom salt. 100% client-side.",
  category: "developer",
  keywords: ["argon2", "hash", "password hashing", "argon2id", "argon2i", "argon2d", "strength"],
  icon: "Key",
  requiresNetwork: false,
  seo: { title: "Argon2 Hash Generator — 100% Private, Offline | UnQTools",
    faq: [
      { q: "What is Argon2?", a: "Argon2 is the winner of the Password Hashing Competition (2015). It's memory-hard, making it resistant to GPU/ASIC attacks." },
      { q: "Which variant should I use?", a: "Argon2id is recommended for most use cases — it combines the benefits of Argon2i (side-channel resistance) and Argon2d (maximum GPU resistance)." },
      { q: "Is my password sent to a server?", a: "No. Everything runs 100% in your browser." },
    ],
  },
  status: "done",
};

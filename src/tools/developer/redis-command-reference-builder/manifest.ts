/**
 * Redis Command Reference & Builder — Tool Manifest.
 * Tool #279 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "redis-command-reference-builder",
  name: "Redis Command Reference & Builder",
  description:
    "Searchable Redis command reference with an interactive builder. Browse 50+ commands across STRING, LIST, SET, HASH, SORTED SET, KEY, PUB/SUB, STREAM, SERVER, CLUSTER and more. Per-command syntax, args, Big-O complexity, version, safety warnings, and one-click client code in redis-cli / node-redis / redis-py / Jedis. 100% client-side.",
  category: "developer",
  keywords: [
    "redis", "redis commands", "redis reference", "redis cheat sheet",
    "redis cli", "redis builder", "redis syntax", "redis example",
    "redis-py", "node-redis", "jedis", "redis complexity", "redis big-o",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "Redis Command Reference & Builder — Syntax, Big-O, Client Code | UnQTools",
    faq: [
      {
        q: "How many Redis commands does the reference cover?",
        a: "56 built-in commands across 14 groups: STRING, LIST, SET, HASH, SORTED SET, KEY, PUB/SUB, STREAM, CONNECTION, SERVER, TRANSACTION, SCRIPTING, HYPERLOGLOG, GEO, CLUSTER. Each entry includes syntax, arguments with types, return type, Big-O complexity, the Redis version it was introduced in, and at least one runnable example.",
      },
      {
        q: "How does the builder produce client code?",
        a: "Fill in the argument inputs for any command and the builder emits the exact redis-cli command plus client code in four languages: node-redis (.set/.get style), redis-py (r.set / r.get), Jedis (jedis.set), and the raw RESP-style CLI invocation. Argument types (key, value, integer, pattern, score) are validated before emission.",
      },
      {
        q: "What safety warnings are surfaced?",
        a: "Three badge levels: SAFE (read commands like GET/LRANGE), WARNING (potentially slow operations like KEYS, CONFIG, BGSAVE), and DANGEROUS (FLUSHDB, FLUSHALL, SHUTDOWN, KEYS in production). For KEYS specifically we recommend SCAN as the safe alternative and link it directly in the warning text.",
      },
      {
        q: "Can I search and filter commands?",
        a: "Yes. Search by name, group, or description (case-insensitive). Filter by group (e.g. show only HASH commands), by safety level (show only dangerous commands), or by minimum Redis version. Counts per group are shown in the filter bar.",
      },
      {
        q: "What extra features does this tool have versus other Redis references?",
        a: "(1) 56 built-in commands with full metadata. (2) Fuzzy substring search across name/description/group. (3) Group + safety + version filters with live counts. (4) Interactive argument builder with type-aware placeholders. (5) Four-language client code export (redis-cli, node-redis, redis-py, Jedis). (6) Big-O complexity badge per command. (7) Safety badges (SAFE / WARNING / DANGEROUS) with KEYS→SCAN advice. (8) Deprecated-command flags with replacement pointers. (9) localStorage history (max 20). (10) Shareable URL for the selected command + builder args. (11) Copy / download as .md or .txt. (12) Syntax highlight for the generated CLI command. 100% offline; no Redis instance required.",
      },
    ],
  },
  status: "done",
};

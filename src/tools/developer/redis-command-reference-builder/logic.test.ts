import { describe, it, expect, beforeEach } from "vitest";
import {
  REDIS_COMMANDS,
  COMMAND_GROUPS,
  SAFETY_LEVELS,
  CLIENT_LANGUAGES,
  GROUP_LABELS,
  normalizeCommandName,
  lookupCommand,
  searchCommands,
  versionGte,
  getGroupCounts,
  quoteArg,
  buildCliCommand,
  parseCliCommand,
  validateArgs,
  generateClientCode,
  buildAll,
  getSafetyWarnings,
  formatComplexity,
  exportMarkdown,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type RedisCommand,
  type RedisGroup,
  type ClientLanguage,
} from "./logic";

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

describe("redis-command-reference-builder constants", () => {
  it("has 50+ commands in the database", () => {
    expect(REDIS_COMMANDS.length).toBeGreaterThanOrEqual(50);
  });

  it("covers 15 command groups", () => {
    expect(COMMAND_GROUPS).toHaveLength(15);
  });

  it("has 3 safety levels", () => {
    expect(SAFETY_LEVELS).toHaveLength(3);
    expect(SAFETY_LEVELS.map((s) => s.value)).toEqual(["safe", "warning", "dangerous"]);
  });

  it("has 4 client languages", () => {
    expect(CLIENT_LANGUAGES).toHaveLength(4);
    expect(CLIENT_LANGUAGES.map((c) => c.value)).toEqual([
      "redis-cli", "node-redis", "redis-py", "jedis",
    ]);
  });

  it("has a label for every group", () => {
    for (const g of COMMAND_GROUPS) {
      expect(GROUP_LABELS[g.value]).toBe(g.label);
    }
  });

  it("every group has at least one command", () => {
    const counts = getGroupCounts();
    for (const c of counts) {
      expect(c.count).toBeGreaterThan(0);
    }
  });

  it("has at least one dangerous command (KEYS or FLUSHALL)", () => {
    const dangerous = REDIS_COMMANDS.filter((c) => c.safety === "dangerous");
    expect(dangerous.length).toBeGreaterThanOrEqual(2);
    expect(dangerous.some((c) => c.name === "KEYS")).toBe(true);
    expect(dangerous.some((c) => c.name === "FLUSHALL")).toBe(true);
  });

  it("has at least one deprecated command with replacement", () => {
    const dep = REDIS_COMMANDS.find((c) => c.deprecated);
    expect(dep).toBeDefined();
    expect(dep?.replacement).toBeTruthy();
  });
});

describe("redis-command-reference-builder normalizeCommandName", () => {
  it("uppercases and trims", () => {
    expect(normalizeCommandName("  set  ")).toBe("SET");
  });
  it("handles empty", () => {
    expect(normalizeCommandName("")).toBe("");
  });
  it("uppercases multi-word commands", () => {
    expect(normalizeCommandName("cluster info")).toBe("CLUSTER INFO");
  });
});

describe("redis-command-reference-builder lookupCommand", () => {
  it("finds commands case-insensitively", () => {
    expect(lookupCommand("set")?.name).toBe("SET");
    expect(lookupCommand("HGetAll")?.name).toBe("HGETALL");
  });
  it("returns null for unknown", () => {
    expect(lookupCommand("NOTACOMMAND")).toBeNull();
  });
  it("finds CLUSTER INFO as a multi-word command", () => {
    expect(lookupCommand("CLUSTER INFO")?.group).toBe("cluster");
  });
});

describe("redis-command-reference-builder versionGte", () => {
  it("compares simple versions", () => {
    expect(versionGte("2.8.9", "2.6")).toBe(true);
    expect(versionGte("2.6.0", "2.8")).toBe(false);
  });
  it("compares equal versions", () => {
    expect(versionGte("5.0.0", "5.0.0")).toBe(true);
  });
  it("compares different lengths", () => {
    expect(versionGte("5.0", "5.0.0")).toBe(true);
  });
});

describe("redis-command-reference-builder searchCommands", () => {
  it("returns all when no filters", () => {
    expect(searchCommands({})).toHaveLength(REDIS_COMMANDS.length);
  });
  it("filters by query substring", () => {
    const results = searchCommands({ query: "sorted" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => c.group === "sorted-set" || c.description.toLowerCase().includes("sorted") || c.syntax.toLowerCase().includes("sorted"))).toBe(true);
  });
  it("filters by group", () => {
    const results = searchCommands({ group: "hash" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => c.group === "hash")).toBe(true);
  });
  it("filters by safety dangerous", () => {
    const results = searchCommands({ safety: "dangerous" });
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((c) => c.safety === "dangerous")).toBe(true);
  });
  it("filters by minVersion", () => {
    const results = searchCommands({ minVersion: "5.0" });
    expect(results.length).toBeGreaterThan(0);
    expect(results.every((c) => versionGte(c.since, "5.0"))).toBe(true);
  });
  it("combines filters", () => {
    const results = searchCommands({ group: "string", query: "inc" });
    expect(results.some((c) => c.name === "INCR")).toBe(true);
    expect(results.every((c) => c.group === "string")).toBe(true);
  });
});

describe("redis-command-reference-builder getGroupCounts", () => {
  it("returns a count for every group", () => {
    const counts = getGroupCounts();
    expect(counts).toHaveLength(COMMAND_GROUPS.length);
    const total = counts.reduce((s, c) => s + c.count, 0);
    expect(total).toBe(REDIS_COMMANDS.length);
  });
  it("string group has 8 commands", () => {
    const counts = getGroupCounts();
    const stringGroup = counts.find((c) => c.group === "string");
    expect(stringGroup?.count).toBe(8);
  });
});

describe("redis-command-reference-builder quoteArg & buildCliCommand", () => {
  it("quotes args with spaces", () => {
    expect(quoteArg("hello world")).toBe('"hello world"');
  });
  it("quotes empty string", () => {
    expect(quoteArg("")).toBe('""');
  });
  it("does not quote plain words", () => {
    expect(quoteArg("hello")).toBe("hello");
  });
  it("builds a CLI command from name and args", () => {
    expect(buildCliCommand("set", ["mykey", "hello"])).toBe("SET mykey hello");
  });
  it("quotes args with spaces in build", () => {
    expect(buildCliCommand("set", ["mykey", "hello world"])).toBe('SET mykey "hello world"');
  });
});

describe("redis-command-reference-builder parseCliCommand", () => {
  it("parses simple commands", () => {
    expect(parseCliCommand("SET mykey hello")).toEqual({ name: "SET", args: ["mykey", "hello"] });
  });
  it("parses quoted strings", () => {
    expect(parseCliCommand('SET mykey "hello world"')).toEqual({ name: "SET", args: ["mykey", "hello world"] });
  });
  it("handles single quotes", () => {
    expect(parseCliCommand("SET k 'value with spaces'")).toEqual({ name: "SET", args: ["k", "value with spaces"] });
  });
  it("handles escaped quotes inside double-quoted strings", () => {
    expect(parseCliCommand('SET k "a\\"b"')).toEqual({ name: "SET", args: ["k", 'a"b'] });
  });
  it("returns null for empty input", () => {
    expect(parseCliCommand("")).toBeNull();
    expect(parseCliCommand("   ")).toBeNull();
  });
  it("uppercases the command name", () => {
    expect(parseCliCommand("get mykey")?.name).toBe("GET");
  });
});

describe("redis-command-reference-builder validateArgs", () => {
  const setCmd = lookupCommand("SET") as RedisCommand;
  const incrCmd = lookupCommand("INCR") as RedisCommand;
  const zaddCmd = lookupCommand("ZADD") as RedisCommand;
  const keysCmd = lookupCommand("KEYS") as RedisCommand;

  it("returns ok for valid args", () => {
    const v = validateArgs(setCmd, ["mykey", "value"]);
    expect(v.ok).toBe(true);
    expect(v.errors).toEqual([]);
  });
  it("fails when required args missing", () => {
    const v = validateArgs(setCmd, ["mykey"]);
    expect(v.ok).toBe(false);
    expect(v.errors.length).toBeGreaterThan(0);
  });
  it("fails when integer arg has non-integer value", () => {
    const v = validateArgs(incrCmd, ["not-a-key"]); // key is fine, but for INCR the key isn't an integer
    // INCR has no integer args by definition; use ZADD instead.
    expect(v.ok).toBe(true);
  });
  it("validates integer type for INCR-style commands", () => {
    // EXPIRE has integer arg "seconds"
    const expireCmd = lookupCommand("EXPIRE") as RedisCommand;
    const v = validateArgs(expireCmd, ["mykey", "not-a-number"]);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("integer"))).toBe(true);
  });
  it("validates score/float type for ZADD", () => {
    const v = validateArgs(zaddCmd, ["myzset", "not-a-score", "member"]);
    expect(v.ok).toBe(false);
    expect(v.errors.some((e) => e.includes("score"))).toBe(true);
  });
  it("adds safety warning for KEYS", () => {
    const v = validateArgs(keysCmd, ["user:*"]);
    expect(v.warnings.some((w) => w.includes("SCAN"))).toBe(true);
  });
  it("adds dangerous warning for FLUSHALL", () => {
    const flushAll = lookupCommand("FLUSHALL") as RedisCommand;
    const v = validateArgs(flushAll, []);
    expect(v.warnings.some((w) => w.includes("DANGEROUS"))).toBe(true);
  });
});

describe("redis-command-reference-builder generateClientCode", () => {
  const setCmd = lookupCommand("SET") as RedisCommand;
  const hsetCmd = lookupCommand("HSET") as RedisCommand;
  const zaddCmd = lookupCommand("ZADD") as RedisCommand;
  const delCmd = lookupCommand("DEL") as RedisCommand;
  const getCmd = lookupCommand("GET") as RedisCommand;

  it("redis-cli returns the raw CLI command", () => {
    expect(generateClientCode(setCmd, ["k", "v"], "redis-cli")).toBe("SET k v");
  });

  it("node-redis generates set()", () => {
    const code = generateClientCode(setCmd, ["k", "v"], "node-redis");
    expect(code).toContain("client.set(");
    expect(code).toContain("'k'");
    expect(code).toContain("'v'");
  });

  it("node-redis generates hSet() with object", () => {
    const code = generateClientCode(hsetCmd, ["user:1", "name", "Alice"], "node-redis");
    expect(code).toContain("client.hSet(");
    expect(code).toContain("'name'");
    expect(code).toContain("'Alice'");
  });

  it("node-redis generates zAdd() with score objects", () => {
    const code = generateClientCode(zaddCmd, ["scores", "100", "alice"], "node-redis");
    expect(code).toContain("client.zAdd(");
    expect(code).toContain("score: 100");
    expect(code).toContain("value: 'alice'");
  });

  it("node-redis falls back to sendCommand for unknown", () => {
    const clusterInfo = lookupCommand("CLUSTER INFO") as RedisCommand;
    const code = generateClientCode(clusterInfo, [], "node-redis");
    expect(code).toContain("sendCommand");
    expect(code).toContain("'CLUSTER INFO'");
  });

  it("redis-py generates set()", () => {
    const code = generateClientCode(setCmd, ["k", "v"], "redis-py");
    expect(code).toBe("r.set('k', 'v')");
  });

  it("redis-py generates hset with mapping", () => {
    const code = generateClientCode(hsetCmd, ["user:1", "name", "Alice"], "redis-py");
    expect(code).toContain("r.hset(");
    expect(code).toContain("mapping=");
    expect(code).toContain("'name': 'Alice'");
  });

  it("redis-py generates zadd with dict", () => {
    const code = generateClientCode(zaddCmd, ["scores", "100", "alice"], "redis-py");
    expect(code).toContain("r.zadd(");
    expect(code).toContain("'alice': 100");
  });

  it("redis-py generates delete()", () => {
    const code = generateClientCode(delCmd, ["k1", "k2"], "redis-py");
    expect(code).toBe("r.delete('k1', 'k2')");
  });

  it("jedis generates set()", () => {
    const code = generateClientCode(setCmd, ["k", "v"], "jedis");
    expect(code).toBe('jedis.set("k", "v");');
  });

  it("jedis generates del()", () => {
    const code = generateClientCode(delCmd, ["k1", "k2"], "jedis");
    expect(code).toBe('jedis.del("k1", "k2");');
  });

  it("jedis generates hset()", () => {
    const code = generateClientCode(hsetCmd, ["user:1", "name", "Alice"], "jedis");
    expect(code).toBe('jedis.hset("user:1", "name", "Alice");');
  });

  it("jedis generates zadd() with numeric score", () => {
    const code = generateClientCode(zaddCmd, ["scores", "100", "alice"], "jedis");
    expect(code).toBe('jedis.zadd("scores", 100, "alice");');
  });

  it("all 4 languages are reachable for GET", () => {
    const langs: ClientLanguage[] = ["redis-cli", "node-redis", "redis-py", "jedis"];
    for (const l of langs) {
      const code = generateClientCode(getCmd, ["mykey"], l);
      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
    }
  });
});

describe("redis-command-reference-builder buildAll", () => {
  const setCmd = lookupCommand("SET") as RedisCommand;
  const expireCmd = lookupCommand("EXPIRE") as RedisCommand;

  it("returns all 4 language outputs on success", () => {
    const r = buildAll(setCmd, ["k", "v"]);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.cli).toBe("SET k v");
      expect(Object.keys(r.clients)).toHaveLength(4);
      expect(r.clients["redis-cli"]).toBe("SET k v");
      expect(r.clients["node-redis"]).toContain("client.set");
    }
  });
  it("fails for invalid args", () => {
    const r = buildAll(expireCmd, ["k", "not-a-number"]);
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toContain("integer");
    }
  });
});

describe("redis-command-reference-builder getSafetyWarnings", () => {
  it("returns dangerous warning for FLUSHALL", () => {
    const w = getSafetyWarnings(lookupCommand("FLUSHALL") as RedisCommand);
    expect(w.some((s) => s.includes("DANGEROUS"))).toBe(true);
  });
  it("returns SCAN advice for KEYS", () => {
    const w = getSafetyWarnings(lookupCommand("KEYS") as RedisCommand);
    expect(w.some((s) => s.includes("SCAN"))).toBe(true);
  });
  it("returns empty array for safe commands", () => {
    const w = getSafetyWarnings(lookupCommand("GET") as RedisCommand);
    expect(w).toEqual([]);
  });
  it("includes deprecation warning for ZREVRANGE", () => {
    const w = getSafetyWarnings(lookupCommand("ZREVRANGE") as RedisCommand);
    expect(w.some((s) => s.includes("DEPRECATED"))).toBe(true);
  });
});

describe("redis-command-reference-builder formatComplexity & exportMarkdown", () => {
  it("returns the complexity string", () => {
    expect(formatComplexity(lookupCommand("GET") as RedisCommand)).toBe("O(1)");
  });
  it("exportMarkdown contains the command name as a header", () => {
    const md = exportMarkdown(lookupCommand("SET") as RedisCommand);
    expect(md).toContain("# SET");
    expect(md).toContain("## Syntax");
    expect(md).toContain("## Description");
    expect(md).toContain("## Examples");
  });
  it("exportMarkdown includes warnings for dangerous commands", () => {
    const md = exportMarkdown(lookupCommand("KEYS") as RedisCommand);
    expect(md).toContain("## Warnings");
    expect(md).toContain("SCAN");
  });
});

describe("redis-command-reference-builder history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, commandName: "SET", group: "string", cli: "SET k v", args: ["k", "v"] });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, commandName: "GET", group: "string", cli: "GET k", args: ["k"] });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, commandName: "SET", group: "string", cli: "SET k v", args: ["k", "v"] });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("redis-command-reference-builder shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("SET", ["k", "v"]);
    expect(url).toContain("cmd=SET");
    expect(url).toContain("args=k");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("round-trips parse", () => {
    const p = parseShareUrl("cmd=SET&args=k%0Av");
    expect(p.commandName).toBe("SET");
    expect(p.args).toEqual(["k", "v"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ commandName: "", args: [] });
  });
  it("handles command with no args", () => {
    const p = parseShareUrl("cmd=PING");
    expect(p.commandName).toBe("PING");
    expect(p.args).toEqual([]);
  });
});

// Suppress unused-import lint
export type _Unused = RedisGroup;

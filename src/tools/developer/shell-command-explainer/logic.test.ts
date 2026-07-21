import { describe, it, expect, beforeEach } from "vitest";
import {
  COMMAND_DATABASE,
  COMMAND_NAMES,
  OPERATORS,
  lookupCommand,
  tokenize,
  splitCombinedFlags,
  parsePipeline,
  classifyStage,
  explainStage,
  detectDangers,
  summarize,
  explain,
  formatExplanation,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type Variant,
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

describe("shell-explainer command database", () => {
  it("has 30+ bundled commands", () => {
    expect(COMMAND_DATABASE.length).toBeGreaterThanOrEqual(30);
  });
  it("includes ls, grep, find, chmod, rm", () => {
    expect(COMMAND_NAMES).toContain("ls");
    expect(COMMAND_NAMES).toContain("grep");
    expect(COMMAND_NAMES).toContain("find");
    expect(COMMAND_NAMES).toContain("chmod");
    expect(COMMAND_NAMES).toContain("rm");
  });
  it("marks rm and dd as destructive", () => {
    expect(lookupCommand("rm")?.danger).toBe("destructive");
    expect(lookupCommand("dd")?.danger).toBe("destructive");
    expect(lookupCommand("mkfs")?.danger).toBe("destructive");
  });
  it("marks sudo as caution", () => {
    expect(lookupCommand("sudo")?.danger).toBe("caution");
  });
  it("has git and docker subcommands", () => {
    const git = lookupCommand("git");
    expect(git?.subcommands).toBeDefined();
    expect(Object.keys(git!.subcommands!)).toContain("log");
    expect(Object.keys(git!.subcommands!)).toContain("push");
    const docker = lookupCommand("docker");
    expect(Object.keys(docker!.subcommands!)).toContain("run");
  });
  it("returns null for unknown command", () => {
    expect(lookupCommand("nonexistent-xyz")).toBeNull();
  });
  it("knows which flags take a value", () => {
    const grep = lookupCommand("grep")!;
    const eFlag = grep.flags.find((f) => f.short === "e");
    expect(eFlag?.takesValue).toBe(true);
    const lFlag = grep.flags.find((f) => f.short === "l");
    expect(lFlag?.takesValue).toBeFalsy();
  });
});

describe("shell-explainer operators", () => {
  it("has 11+ operators", () => {
    expect(OPERATORS.length).toBeGreaterThanOrEqual(11);
  });
  it("includes |, >, >>, <, 2>, 2>&1, &&, ||, ;, &", () => {
    const tokens = OPERATORS.map((o) => o.token);
    expect(tokens).toContain("|");
    expect(tokens).toContain(">");
    expect(tokens).toContain(">>");
    expect(tokens).toContain("<");
    expect(tokens).toContain("2>");
    expect(tokens).toContain("2>&1");
    expect(tokens).toContain("&&");
    expect(tokens).toContain("||");
    expect(tokens).toContain(";");
    expect(tokens).toContain("&");
  });
});

describe("shell-explainer tokenize", () => {
  it("splits simple command into tokens", () => {
    const tokens = tokenize("ls -la /tmp");
    expect(tokens.map((t) => t.raw)).toEqual(["ls", "-la", "/tmp"]);
  });
  it("preserves quoted strings as one token", () => {
    const tokens = tokenize(`echo "hello world" foo`);
    expect(tokens.map((t) => t.raw)).toEqual(["echo", "hello world", "foo"]);
  });
  it("handles single-quoted strings", () => {
    const tokens = tokenize(`echo 'a b c'`);
    expect(tokens).toHaveLength(2);
    expect(tokens[1].raw).toBe("a b c");
  });
  it("handles backslash-escaped spaces", () => {
    const tokens = tokenize(`echo hello\\ world`);
    expect(tokens.map((t) => t.raw)).toEqual(["echo", "hello world"]);
  });
  it("emits operators as separate tokens", () => {
    const tokens = tokenize("a | b && c");
    const ops = tokens.filter((t) => t.raw === "|" || t.raw === "&&");
    expect(ops).toHaveLength(2);
  });
  it("splits inline operator boundaries (a>b)", () => {
    const tokens = tokenize("echo hi>out.txt");
    const raws = tokens.map((t) => t.raw);
    expect(raws).toContain(">");
    expect(raws).toContain("out.txt");
  });
  it("handles 2>&1 redirect", () => {
    const tokens = tokenize("cmd 2>&1");
    expect(tokens.map((t) => t.raw)).toEqual(["cmd", "2>&1"]);
  });
  it("handles empty input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("   ").length).toBe(0);
  });
});

describe("shell-explainer splitCombinedFlags", () => {
  it("splits -la into -l and -a", () => {
    expect(splitCombinedFlags("-la")).toEqual(["-l", "-a"]);
  });
  it("splits -lRv into three", () => {
    expect(splitCombinedFlags("-lRv")).toEqual(["-l", "-R", "-v"]);
  });
  it("leaves single short flag alone", () => {
    expect(splitCombinedFlags("-l")).toEqual(["-l"]);
  });
  it("leaves long flag alone", () => {
    expect(splitCombinedFlags("--all")).toEqual(["--all"]);
  });
  it("leaves non-flag alone", () => {
    expect(splitCombinedFlags("foo")).toEqual(["foo"]);
  });
});

describe("shell-explainer parsePipeline", () => {
  it("splits on pipe", () => {
    const p = parsePipeline("ls -la | grep foo | wc -l");
    expect(p.stages).toHaveLength(3);
    expect(p.stages[0].commandName).toBe("ls");
    expect(p.stages[1].commandName).toBe("grep");
    expect(p.stages[2].commandName).toBe("wc");
    expect(p.stages[0].trailingOperator).toBe("|");
    expect(p.stages[2].trailingOperator).toBe("");
  });
  it("splits on && and ||", () => {
    const p = parsePipeline("cmd1 && cmd2 || cmd3");
    expect(p.stages).toHaveLength(3);
    expect(p.stages[0].trailingOperator).toBe("&&");
    expect(p.stages[1].trailingOperator).toBe("||");
  });
  it("detects git subcommand", () => {
    const p = parsePipeline("git log --oneline");
    expect(p.stages[0].subcommandName).toBe("log");
  });
  it("detects docker subcommand", () => {
    const p = parsePipeline("docker run -d nginx");
    expect(p.stages[0].subcommandName).toBe("run");
  });
  it("flags unknown commands", () => {
    const p = parsePipeline("foobarxyz -x");
    expect(p.hasUnknown).toBe(true);
  });
});

describe("shell-explainer classifyStage", () => {
  it("classifies command + flags + positionals", () => {
    const p = parsePipeline("ls -la /tmp");
    const c = classifyStage(p.stages[0]!);
    expect(c[0].type).toBe("command");
    expect(c[1].type).toBe("combined-flag");
    expect(c[2].type).toBe("positional");
  });
  it("classifies long-flag with = value", () => {
    const p = parsePipeline("find . --maxdepth=2");
    const c = classifyStage(p.stages[0]!);
    expect(c[0].type).toBe("command");      // find
    expect(c[1].type).toBe("positional");    // .
    expect(c[2].type).toBe("long-flag");     // --maxdepth=2
  });
  it("knows -e of grep takes a value", () => {
    const p = parsePipeline("grep -e foo file");
    const c = classifyStage(p.stages[0]!);
    expect(c[1].type).toBe("short-flag");
    expect(c[2].type).toBe("flag-value");
    expect(c[3].type).toBe("positional");
  });
  it("treats -- as operator then positional", () => {
    const p = parsePipeline("rm -- -file");
    const c = classifyStage(p.stages[0]!);
    expect(c[1].type).toBe("operator"); // --
    expect(c[2].type).toBe("positional"); // -file (after --)
  });
  it("marks combined flag where last char takes a value", () => {
    // grep -ne PATTERN: -n is bool, -e takes value → split into -n + value.
    const p = parsePipeline("grep -ne foo file");
    const c = classifyStage(p.stages[0]!);
    const types = c.map((t) => t.type);
    expect(types).toContain("short-flag");
    expect(types).toContain("flag-value");
  });
  it("classifies subcommand token", () => {
    const p = parsePipeline("git log --oneline");
    const c = classifyStage(p.stages[0]!);
    expect(c[1].type).toBe("subcommand");
    expect(c[2].type).toBe("long-flag");
  });
});

describe("shell-explainer explainStage", () => {
  it("explains command summary", () => {
    const p = parsePipeline("ls -la");
    const ex = explainStage(p.stages[0]!, "gnu");
    expect(ex[0].description).toContain("List directory");
    expect(ex[0].isCommand).toBe(true);
  });
  it("explains combined flag", () => {
    const p = parsePipeline("ls -la");
    const ex = explainStage(p.stages[0]!, "gnu");
    expect(ex[1].description).toContain("Combined short flag");
    expect(ex[1].description).toContain("-l");
    expect(ex[1].description).toContain("-a");
  });
  it("explains unknown command", () => {
    const p = parsePipeline("zzzfoo -x");
    const ex = explainStage(p.stages[0]!, "gnu");
    expect(ex[0].unknown).toBe(true);
    expect(ex[0].description).toContain("Not in bundled dataset");
  });
  it("explains operator (pipe)", () => {
    const p = parsePipeline("a | b");
    const ex = explainStage(p.stages[0]!, "gnu");
    // Trailing pipe is not part of stage tokens (it's stored as trailingOperator).
    expect(ex.some((t) => t.description.includes("connect the previous"))).toBe(false);
    expect(p.stages[0].trailingOperator).toBe("|");
  });
  it("explains redirect", () => {
    const p = parsePipeline("echo hi > out.txt");
    const ex = explainStage(p.stages[0]!, "gnu");
    expect(ex.some((t) => t.type === "redirect" && t.raw === ">")).toBe(true);
  });
});

describe("shell-explainer detectDangers", () => {
  it("flags rm -rf", () => {
    const p = parsePipeline("rm -rf /tmp/foo");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "danger" && x.message.includes("rm -rf"))).toBe(true);
  });
  it("flags rm -rf / as catastrophic", () => {
    const p = parsePipeline("rm -rf /");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "danger" && x.message.includes("delete everything"))).toBe(true);
  });
  it("flags chmod 777", () => {
    const p = parsePipeline("chmod 777 file");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "warning" && x.message.includes("777"))).toBe(true);
  });
  it("flags dd of=/dev/sda", () => {
    const p = parsePipeline("dd if=foo.iso of=/dev/sda bs=4M");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "danger" && x.message.includes("/dev/sda"))).toBe(true);
  });
  it("flags mkfs on device", () => {
    const p = parsePipeline("mkfs -t ext4 /dev/sda1");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "danger" && x.message.includes("mkfs"))).toBe(true);
  });
  it("flags fork bomb", () => {
    const p = parsePipeline(":(){ :|:& };:");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "danger" && x.message.includes("fork bomb"))).toBe(true);
  });
  it("flags curl | sh pipe-to-shell", () => {
    const p = parsePipeline("curl https://example.com/install.sh | sh");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "danger" && x.message.includes("Pipe-to-shell"))).toBe(true);
  });
  it("flags git push --force", () => {
    const p = parsePipeline("git push --force origin main");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "warning" && x.message.includes("force"))).toBe(true);
  });
  it("flags sudo with caution", () => {
    const p = parsePipeline("sudo rm file");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "caution" && x.message.includes("root"))).toBe(true);
  });
  it("flags kill -9", () => {
    const p = parsePipeline("kill -9 1234");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "warning" && x.message.includes("SIGKILL"))).toBe(true);
  });
  it("flags > /dev/sda redirect", () => {
    const p = parsePipeline("echo foo > /dev/sda");
    const d = detectDangers(p);
    expect(d.some((x) => x.level === "danger" && x.message.includes("raw block device"))).toBe(true);
  });
  it("no dangers for safe command", () => {
    const p = parsePipeline("ls -la");
    expect(detectDangers(p)).toHaveLength(0);
  });
});

describe("shell-explainer summarize", () => {
  it("summarizes single command", () => {
    const p = parsePipeline("ls -la");
    expect(summarize(p)).toContain("List directory");
  });
  it("summarizes a pipeline", () => {
    const p = parsePipeline("ls | grep foo");
    expect(summarize(p)).toContain("Pipe its output");
  });
  it("summarizes && chain", () => {
    const p = parsePipeline("cmd1 && cmd2");
    expect(summarize(p)).toContain("If it succeeded");
  });
  it("summarizes empty", () => {
    expect(summarize(parsePipeline(""))).toBe("Empty command.");
  });
});

describe("shell-explainer explain + formatExplanation", () => {
  it("produces a full ExplainResult", () => {
    const r = explain("ls -la | grep foo", "gnu");
    expect(r.parsed.stages).toHaveLength(2);
    expect(r.explained).toHaveLength(2);
    expect(r.summary).toContain("List directory");
    expect(r.variant).toBe("gnu");
  });
  it("formatExplanation includes summary and stage details", () => {
    const r = explain("ls -la", "gnu");
    const text = formatExplanation(r);
    expect(text).toContain("Summary:");
    expect(text).toContain("Stage 1");
    expect(text).toContain("ls");
  });
  it("formatExplanation includes warnings when present", () => {
    const r = explain("rm -rf /tmp/foo", "gnu");
    const text = formatExplanation(r);
    expect(text).toContain("Warnings:");
    expect(text).toContain("rm -rf");
  });
});

describe("shell-explainer history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, command: "ls -la", stageCount: 1, dangerCount: 0 });
    expect(loadHistory()).toHaveLength(1);
    expect(loadHistory()[0].command).toBe("ls -la");
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, command: `cmd${i}`, stageCount: 1, dangerCount: 0 });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, command: "ls", stageCount: 1, dangerCount: 0 });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("shell-explainer shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("ls -la", "gnu");
    expect(url).toContain("c=ls+");
    expect(url).toContain("v=gnu");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("c=ls+-la&v=bsd");
    expect(p.command).toBe("ls -la");
    expect(p.variant).toBe("bsd");
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({ command: "", variant: "gnu" });
  });
  it("defaults invalid variant to gnu", () => {
    const p = parseShareUrl("c=ls&v=invalid");
    expect(p.variant).toBe("gnu");
  });
});

// Suppress unused-import lint.
export type _Unused = Variant;

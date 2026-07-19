import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  LANGUAGES,
  BASE_IMAGE_PREFS,
  FRAMEWORKS,
  LANGUAGE_LABELS,
  BASE_IMAGE_LABELS,
  FRAMEWORK_LABELS,
  PORT_DEFAULTS,
  FRAMEWORKS_BY_LANGUAGE,
  normalizeLanguage,
  normalizeBaseImage,
  normalizeFramework,
  recommendedBaseImage,
  generateDockerfile,
  generateDockerignore,
  generateCompose,
  parseDockerfile,
  cleanLine,
  lintDockerfile,
  optimizeDockerfile,
  explainInstruction,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type Language,
  type BaseImagePref,
  type BuildOptions,
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

// Suppress unused-import lint
export type _Unused = Language | BaseImagePref | BuildOptions;

describe("ai-dockerfile constants", () => {
  it("has 6 languages", () => {
    expect(LANGUAGES).toHaveLength(6);
    expect(LANGUAGES).toContain("nodejs");
    expect(LANGUAGES).toContain("rust");
  });
  it("has 4 base image prefs", () => {
    expect(BASE_IMAGE_PREFS).toHaveLength(4);
  });
  it("has 10 frameworks", () => {
    expect(FRAMEWORKS).toHaveLength(10);
  });
  it("has labels for every language and base image", () => {
    for (const l of LANGUAGES) expect(LANGUAGE_LABELS[l]).toBeTruthy();
    for (const b of BASE_IMAGE_PREFS) expect(BASE_IMAGE_LABELS[b]).toBeTruthy();
    for (const f of FRAMEWORKS) expect(FRAMEWORK_LABELS[f]).toBeTruthy();
  });
  it("has port defaults", () => {
    expect(PORT_DEFAULTS.nodejs).toBe(3000);
    expect(PORT_DEFAULTS.python).toBe(8000);
    expect(PORT_DEFAULTS.go).toBe(8080);
  });
  it("frameworks are bucketed per language", () => {
    expect(FRAMEWORKS_BY_LANGUAGE.nodejs).toContain("nextjs");
    expect(FRAMEWORKS_BY_LANGUAGE.ruby).toContain("rails");
    expect(FRAMEWORKS_BY_LANGUAGE.go).toContain("generic");
  });
  it("exposes history key + max 20", () => {
    expect(HISTORY_KEY).toContain("ai-dockerfile-builder");
    expect(HISTORY_MAX).toBe(20);
  });
});

describe("ai-dockerfile normalize helpers", () => {
  it("normalizes language aliases", () => {
    expect(normalizeLanguage("Node.js")).toBe("nodejs");
    expect(normalizeLanguage("golang")).toBe("go");
    expect(normalizeLanguage("PY")).toBe("python");
    expect(normalizeLanguage("jvm")).toBe("java");
    expect(normalizeLanguage("rb")).toBe("ruby");
    expect(normalizeLanguage("unknown")).toBe("nodejs"); // default
  });
  it("normalizes base image prefs", () => {
    expect(normalizeBaseImage("Alpine")).toBe("alpine");
    expect(normalizeBaseImage("slim")).toBe("slim");
    expect(normalizeBaseImage("distroless")).toBe("distroless");
    expect(normalizeBaseImage("unknown")).toBe("default");
  });
  it("normalizes frameworks", () => {
    expect(normalizeFramework("nextjs")).toBe("nextjs");
    expect(normalizeFramework("FastAPI")).toBe("fastapi");
    expect(normalizeFramework("unknown")).toBe("none");
  });
});

describe("ai-dockerfile recommendedBaseImage", () => {
  it("picks scratch for Go default", () => {
    expect(recommendedBaseImage("go", "default", "runner")).toBe("scratch");
  });
  it("picks distroless for Go distroless pref", () => {
    expect(recommendedBaseImage("go", "distroless", "runner")).toContain("distroless");
  });
  it("picks alpine for Node alpine", () => {
    expect(recommendedBaseImage("nodejs", "alpine", "runner")).toBe("node:20-alpine");
  });
  it("picks distroless for Node distroless", () => {
    expect(recommendedBaseImage("nodejs", "distroless", "runner")).toContain("distroless");
  });
  it("builder is always the same regardless of pref", () => {
    expect(recommendedBaseImage("python", "default", "builder")).toBe("python:3.12-slim");
    expect(recommendedBaseImage("python", "alpine", "builder")).toBe("python:3.12-slim");
  });
  it("rust default runner is debian slim", () => {
    expect(recommendedBaseImage("rust", "default", "runner")).toBe("debian:bookworm-slim");
  });
});

describe("ai-dockerfile generateDockerfile", () => {
  it("generates a multi-stage Node.js Dockerfile", () => {
    const result = generateDockerfile({ language: "nodejs", framework: "express", port: 3000 });
    expect(result.dockerfile).toContain("# syntax=docker/dockerfile:1.7");
    expect(result.dockerfile).toMatch(/FROM node:20-alpine AS builder/);
    expect(result.dockerfile).toMatch(/FROM node:20-alpine AS runner/);
    expect(result.dockerfile).toContain("WORKDIR /app");
    expect(result.dockerfile).toContain("npm ci");
    expect(result.dockerfile).toContain("EXPOSE 3000");
    expect(result.dockerfile).toContain("HEALTHCHECK");
    expect(result.dockerfile).toContain("CMD");
  });

  it("generates Go scratch build with CGO disabled", () => {
    const result = generateDockerfile({ language: "go", port: 8080 });
    expect(result.dockerfile).toContain("CGO_ENABLED=0");
    expect(result.dockerfile).toContain("go build");
    expect(result.dockerfile).toMatch(/FROM scratch AS runner/);
  });

  it("generates Python FastAPI with venv", () => {
    const result = generateDockerfile({ language: "python", framework: "fastapi", port: 8000 });
    expect(result.dockerfile).toContain("python -m venv /opt/venv");
    expect(result.dockerfile).toContain("uvicorn");
    expect(result.dockerfile).toContain("EXPOSE 8000");
  });

  it("generates Rust with cargo build", () => {
    const result = generateDockerfile({ language: "rust", port: 8080, appName: "myapp" });
    expect(result.dockerfile).toContain("cargo build --release");
    expect(result.dockerfile).toContain("target/release/myapp");
  });

  it("generates Java Maven build", () => {
    const result = generateDockerfile({ language: "java", port: 8080 });
    expect(result.dockerfile).toContain("maven:3.9-eclipse-temurin-21");
    expect(result.dockerfile).toContain("mvn package");
    // CMD is in exec form: ["java", "-jar", "/app/app.jar"]
    expect(result.dockerfile).toContain('"java"');
    expect(result.dockerfile).toContain('"-jar"');
    expect(result.dockerfile).toContain('app.jar');
  });

  it("generates Ruby Rails build", () => {
    const result = generateDockerfile({ language: "ruby", framework: "rails", port: 3000 });
    expect(result.dockerfile).toContain("bundle install");
    // CMD is in exec form: ["bundle", "exec", "rails", "server", ...]
    expect(result.dockerfile).toContain('"rails"');
    expect(result.dockerfile).toContain('"server"');
  });

  it("includes explanations for each instruction", () => {
    const result = generateDockerfile({ language: "nodejs" });
    expect(result.explanations.length).toBeGreaterThan(5);
    const fromExpl = result.explanations.find((e) => e.keyword === "FROM");
    expect(fromExpl?.explanation).toBeTruthy();
  });

  it("parses itself cleanly", () => {
    const result = generateDockerfile({ language: "nodejs" });
    expect(result.instructions.length).toBeGreaterThan(5);
    // The parser skips the # syntax comment line, so the first instruction is FROM.
    expect(result.instructions[0].keyword).toBe("FROM");
  });

  it("runs lint on the generated Dockerfile", () => {
    const result = generateDockerfile({ language: "nodejs" });
    // Generated Dockerfiles should pass lint with at most info-level issues.
    const errors = result.lint.filter((l) => l.level === "error");
    expect(errors).toHaveLength(0);
  });

  it("uses distroless nonroot USER when distroless pref set", () => {
    const result = generateDockerfile({ language: "nodejs", baseImage: "distroless", port: 3000 });
    expect(result.dockerfile).toContain("USER nonroot");
  });

  it("respects pkgManager = yarn", () => {
    const result = generateDockerfile({ language: "nodejs", pkgManager: "yarn", port: 3000 });
    expect(result.dockerfile).toContain("yarn.lock");
    expect(result.dockerfile).toContain("yarn install");
  });

  it("respects pkgManager = pnpm", () => {
    const result = generateDockerfile({ language: "nodejs", pkgManager: "pnpm", port: 3000 });
    expect(result.dockerfile).toContain("pnpm-lock.yaml");
    expect(result.dockerfile).toContain("pnpm install");
  });
});

describe("ai-dockerfile generateDockerignore", () => {
  it("includes .git for all languages", () => {
    for (const l of LANGUAGES) {
      const di = generateDockerignore(l);
      expect(di).toContain(".git");
      expect(di).toContain(".env");
    }
  });
  it("includes node_modules for Node.js", () => {
    expect(generateDockerignore("nodejs")).toContain("node_modules/");
  });
  it("includes __pycache__ for Python", () => {
    expect(generateDockerignore("python")).toContain("__pycache__/");
  });
  it("includes target/ for Rust", () => {
    expect(generateDockerignore("rust")).toContain("target/");
  });
});

describe("ai-dockerfile generateCompose", () => {
  it("produces a valid compose file with ports + restart", () => {
    const compose = generateCompose({ language: "nodejs", port: 3000, appName: "web" });
    expect(compose).toContain("services:");
    expect(compose).toContain("web:");
    expect(compose).toContain('"3000:3000"');
    expect(compose).toContain("restart: unless-stopped");
    expect(compose).toContain("build: .");
  });
  it("uses the port for the host:container mapping", () => {
    expect(generateCompose({ language: "python", port: 8000 })).toContain('"8000:8000"');
  });
});

describe("ai-dockerfile parseDockerfile + cleanLine", () => {
  it("strips trailing comments", () => {
    expect(cleanLine("FROM node:20 # base image")).toBe("FROM node:20");
  });
  it("parses simple Dockerfile", () => {
    const text = `FROM node:20-alpine AS builder
WORKDIR /app
COPY . .
RUN npm ci
CMD ["node", "index.js"]`;
    const ins = parseDockerfile(text);
    expect(ins).toHaveLength(5);
    expect(ins[0].keyword).toBe("FROM");
    expect(ins[0].args).toBe("node:20-alpine AS builder");
    expect(ins[2].keyword).toBe("COPY");
    expect(ins[4].keyword).toBe("CMD");
  });
  it("joins continuation lines", () => {
    const text = `RUN apt-get update && \\
    apt-get install -y curl && \\
    rm -rf /var/lib/apt/lists/*`;
    const ins = parseDockerfile(text);
    expect(ins).toHaveLength(1);
    expect(ins[0].args).toContain("apt-get update");
    expect(ins[0].args).toContain("rm -rf /var/lib/apt/lists/*");
  });
  it("handles empty input", () => {
    expect(parseDockerfile("")).toEqual([]);
  });
  it("skips pure comment lines", () => {
    const ins = parseDockerfile("# just a comment\nFROM scratch");
    expect(ins).toHaveLength(1);
    expect(ins[0].keyword).toBe("FROM");
  });
});

describe("ai-dockerfile lintDockerfile", () => {
  it("flags :latest tag (DL3007)", () => {
    const lint = lintDockerfile("FROM node:latest\nCMD [\"node\"]");
    expect(lint.some((l) => l.rule === "DL3007")).toBe(true);
  });
  it("flags ADD instead of COPY (DL3020)", () => {
    const lint = lintDockerfile("FROM scratch\nADD . /app");
    expect(lint.some((l) => l.rule === "DL3020")).toBe(true);
  });
  it("flags apk add without --no-cache (DL3019)", () => {
    const lint = lintDockerfile("FROM alpine:3.20\nRUN apk add curl");
    expect(lint.some((l) => l.rule === "DL3019")).toBe(true);
  });
  it("flags apt-get install without cleanup (DL3009)", () => {
    const lint = lintDockerfile("FROM debian:bookworm-slim\nRUN apt-get update && apt-get install -y curl");
    expect(lint.some((l) => l.rule === "DL3009")).toBe(true);
  });
  it("flags pip install without --no-cache-dir (DL3013)", () => {
    const lint = lintDockerfile("FROM python:3.12-slim\nRUN pip install flask");
    expect(lint.some((l) => l.rule === "DL3013")).toBe(true);
  });
  it("flags npm install (suggests npm ci) (DL3016)", () => {
    const lint = lintDockerfile("FROM node:20-alpine\nRUN npm install");
    expect(lint.some((l) => l.rule === "DL3016")).toBe(true);
  });
  it("flags sudo usage (DL3004)", () => {
    const lint = lintDockerfile("FROM alpine:3.20\nRUN sudo apk add curl");
    expect(lint.some((l) => l.rule === "DL3004")).toBe(true);
  });
  it("flags missing USER (DL3002)", () => {
    const lint = lintDockerfile("FROM alpine:3.20\nWORKDIR /app\nCOPY . .");
    expect(lint.some((l) => l.rule === "DL3002")).toBe(true);
  });
  it("flags missing HEALTHCHECK (DL3059)", () => {
    const lint = lintDockerfile("FROM alpine:3.20\nUSER app");
    expect(lint.some((l) => l.rule === "DL3059")).toBe(true);
  });
  it("flags missing FROM (DL3006)", () => {
    const lint = lintDockerfile("WORKDIR /app");
    expect(lint.some((l) => l.rule === "DL3006" && l.level === "error")).toBe(true);
  });
  it("flags MAINTAINER (DL4007)", () => {
    const lint = lintDockerfile("FROM scratch\nMAINTAINER me@example.com");
    expect(lint.some((l) => l.rule === "DL4007")).toBe(true);
  });
  it("does NOT flag a clean Dockerfile with USER + HEALTHCHECK", () => {
    const text = `FROM node:20-alpine
WORKDIR /app
COPY . .
USER app
HEALTHCHECK CMD curl -f http://localhost/ || exit 1
CMD ["node", "index.js"]`;
    const lint = lintDockerfile(text);
    const errors = lint.filter((l) => l.level === "error" || l.level === "warning");
    expect(errors).toHaveLength(0);
  });
});

describe("ai-dockerfile optimizeDockerfile", () => {
  it("replaces ADD with COPY", () => {
    const result = optimizeDockerfile("FROM scratch\nADD . /app");
    expect(result.dockerfile).toContain("COPY . /app");
    expect(result.suggestions.some((s) => s.includes("ADD"))).toBe(true);
  });
  it("removes MAINTAINER", () => {
    const result = optimizeDockerfile("FROM scratch\nMAINTAINER me");
    expect(result.dockerfile).not.toMatch(/^MAINTAINER/m);
    expect(result.suggestions.some((s) => s.includes("MAINTAINER"))).toBe(true);
  });
  it("adds --no-cache to apk add", () => {
    const result = optimizeDockerfile("FROM alpine:3.20\nRUN apk add curl");
    expect(result.dockerfile).toContain("apk add --no-cache curl");
  });
  it("adds non-root USER when missing", () => {
    const result = optimizeDockerfile("FROM alpine:3.20\nWORKDIR /app");
    expect(result.dockerfile).toContain("USER app");
    expect(result.dockerfile).toContain("adduser -S app");
  });
  it("adds HEALTHCHECK when missing", () => {
    const result = optimizeDockerfile("FROM alpine:3.20\nUSER app");
    expect(result.dockerfile).toContain("HEALTHCHECK");
  });
});

describe("ai-dockerfile explainInstruction", () => {
  it("explains FROM", () => {
    const ins = parseDockerfile("FROM node:20-alpine")[0];
    expect(explainInstruction(ins)).toContain("base image");
  });
  it("explains COPY", () => {
    const ins = parseDockerfile("COPY . .")[0];
    expect(explainInstruction(ins)).toContain("Copy");
  });
  it("explains USER", () => {
    const ins = parseDockerfile("USER app")[0];
    expect(explainInstruction(ins)).toContain("user");
  });
  it("explains HEALTHCHECK", () => {
    const ins = parseDockerfile("HEALTHCHECK CMD curl -f http://localhost/ || exit 1")[0];
    expect(explainInstruction(ins)).toContain("healthy");
  });
  it("returns empty string for unknown keyword", () => {
    const ins = { line: 1, keyword: "UNKNOWN", args: "x", raw: "UNKNOWN x" };
    expect(explainInstruction(ins)).toBe("");
  });
});

describe("ai-dockerfile history (localStorage)", () => {
  it("loads empty initially", () => { expect(loadHistory()).toEqual([]); });
  it("saves and loads", () => {
    saveHistory({ ts: 1, language: "nodejs", framework: "none", baseImage: "default", port: 3000, dockerfile: "FROM node:20" });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, language: "nodejs", framework: "none", baseImage: "default", port: 3000, dockerfile: "" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, language: "nodejs", framework: "none", baseImage: "default", port: 3000, dockerfile: "" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-dockerfile shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({ language: "python", framework: "fastapi", baseImage: "slim", port: 8000 });
    expect(url).toContain("lang=python");
    expect(url).toContain("fw=fastapi");
    expect(url).toContain("base=slim");
    expect(url).toContain("port=8000");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const s = parseShareUrl("lang=ruby&fw=rails&base=alpine&port=3000");
    expect(s.language).toBe("ruby");
    expect(s.framework).toBe("rails");
    expect(s.baseImage).toBe("alpine");
    expect(s.port).toBe(3000);
  });
  it("uses defaults when empty", () => {
    const s = parseShareUrl("");
    expect(s.language).toBe("nodejs");
    expect(s.framework).toBe("none");
    expect(s.port).toBe(PORT_DEFAULTS.nodejs);
  });
  it("falls back to default port when invalid", () => {
    const s = parseShareUrl("lang=go&port=abc");
    expect(s.port).toBe(PORT_DEFAULTS.go);
  });
});

describe("ai-dockerfile LLM prompt + render", () => {
  it("builds an LLM prompt containing the stack", () => {
    const prompt = buildLlmPrompt({ language: "rust", port: 8080 });
    expect(prompt).toContain("Docker expert");
    expect(prompt).toContain("Rust");
    expect(prompt).toContain("Port: 8080");
  });
  it("strips markdown fences from LLM output", () => {
    const out = renderLlmResult("```dockerfile\nFROM scratch\n```");
    expect(out.dockerfile).toBe("FROM scratch");
    expect(out.dockerfile).not.toContain("```");
  });
});

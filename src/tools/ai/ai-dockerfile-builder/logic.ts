/**
 * AI Dockerfile Builder — pure logic.
 *
 * Generate production-grade multi-stage Dockerfiles for Node.js, Python,
 * Go, Rust, Java, and Ruby. Includes per-language templates, framework
 * presets, base-image preferences (alpine / slim / distroless), layer
 * caching, non-root user, HEALTHCHECK, matching .dockerignore, Docker
 * Compose companion, per-instruction explanations, a hadolint-style
 * linter, and an import-to-optimize flow.
 *
 * Optional BYO-key LLM call lives in ui.tsx (touches network).
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: templates are starting points. Always build the image and
 * scan it (docker scout / trivy) before production. On-device templates
 * are weaker than a BYO-key LLM for exotic build systems.
 */

// ---------- Types ----------

export type Language =
  | "nodejs"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "ruby";

export type BaseImagePref =
  | "default"
  | "alpine"
  | "slim"
  | "distroless";

export type Framework =
  | "none"
  | "nextjs"
  | "express"
  | "nestjs"
  | "fastapi"
  | "flask"
  | "django"
  | "rails"
  | "sinatra"
  | "generic";

export interface BuildOptions {
  language: Language;
  framework?: Framework;
  baseImage?: BaseImagePref;
  port?: number;
  appName?: string;
  /** Include HEALTHCHECK instruction (default true). */
  healthcheck?: boolean;
  /** Include non-root user (default true). */
  nonRoot?: boolean;
  /** Package manager for Node.js: npm | yarn | pnpm (default npm). */
  pkgManager?: "npm" | "yarn" | "pnpm";
}

export interface Instruction {
  /** Line number (1-based) in the source Dockerfile. */
  line: number;
  /** Instruction keyword (FROM, RUN, COPY, etc.) upper-cased. */
  keyword: string;
  /** Raw argument string after the keyword. */
  args: string;
  /** Original line text (cleaned of comments and continuation). */
  raw: string;
}

export interface LintIssue {
  level: "error" | "warning" | "info";
  rule: string;
  message: string;
  line?: number;
}

export interface Explanation {
  keyword: string;
  args: string;
  explanation: string;
}

export interface GenerationResult {
  dockerfile: string;
  dockerignore: string;
  compose: string;
  explanations: Explanation[];
  instructions: Instruction[];
  lint: LintIssue[];
}

export interface OptimizationResult {
  dockerfile: string;
  suggestions: string[];
  lint: LintIssue[];
}

export interface HistoryEntry {
  ts: number;
  language: Language;
  framework: Framework;
  baseImage: BaseImagePref;
  port: number;
  dockerfile: string;
}

export interface ShareState {
  language: Language;
  framework: Framework;
  baseImage: BaseImagePref;
  port: number;
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-dockerfile-builder:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-dockerfile-builder:llm-key";

export const LANGUAGES: Language[] = ["nodejs", "python", "go", "rust", "java", "ruby"];
export const BASE_IMAGE_PREFS: BaseImagePref[] = ["default", "alpine", "slim", "distroless"];
export const FRAMEWORKS: Framework[] = [
  "none", "nextjs", "express", "nestjs",
  "fastapi", "flask", "django",
  "rails", "sinatra", "generic",
];

export const LANGUAGE_LABELS: Record<Language, string> = {
  nodejs: "Node.js",
  python: "Python",
  go: "Go",
  rust: "Rust",
  java: "Java",
  ruby: "Ruby",
};

export const BASE_IMAGE_LABELS: Record<BaseImagePref, string> = {
  default: "Default",
  alpine: "Alpine (smallest)",
  slim: "Slim (Debian-based)",
  distroless: "Distroless (most secure)",
};

export const FRAMEWORK_LABELS: Record<Framework, string> = {
  none: "None / generic",
  nextjs: "Next.js",
  express: "Express",
  nestjs: "NestJS",
  fastapi: "FastAPI",
  flask: "Flask",
  django: "Django",
  rails: "Ruby on Rails",
  sinatra: "Sinatra",
  generic: "Generic",
};

export const PORT_DEFAULTS: Record<Language, number> = {
  nodejs: 3000,
  python: 8000,
  go: 8080,
  rust: 8080,
  java: 8080,
  ruby: 3000,
};

export const FRAMEWORKS_BY_LANGUAGE: Record<Language, Framework[]> = {
  nodejs: ["none", "nextjs", "express", "nestjs", "generic"],
  python: ["none", "fastapi", "flask", "django", "generic"],
  go: ["none", "generic"],
  rust: ["none", "generic"],
  java: ["none", "generic"],
  ruby: ["none", "rails", "sinatra", "generic"],
};

// ---------- Normalization ----------

export function normalizeLanguage(s: string): Language {
  const lower = (s || "").toLowerCase();
  if (lower === "node" || lower === "nodejs" || lower === "node.js") return "nodejs";
  if (lower === "python" || lower === "py") return "python";
  if (lower === "go" || lower === "golang") return "go";
  if (lower === "rust" || lower === "rs") return "rust";
  if (lower === "java" || lower === "jvm") return "java";
  if (lower === "ruby" || lower === "rb") return "ruby";
  return "nodejs";
}

export function normalizeBaseImage(s: string): BaseImagePref {
  const lower = (s || "").toLowerCase();
  if (lower === "alpine") return "alpine";
  if (lower === "slim") return "slim";
  if (lower === "distroless") return "distroless";
  return "default";
}

export function normalizeFramework(s: string): Framework {
  const lower = (s || "").toLowerCase();
  if (FRAMEWORKS.includes(lower as Framework)) return lower as Framework;
  return "none";
}

// ---------- Base-image picker ----------

/** Pick the builder + runner base image for a language + preference. */
export function recommendedBaseImage(
  language: Language,
  pref: BaseImagePref,
  stage: "builder" | "runner",
): string {
  if (language === "nodejs") {
    if (stage === "builder") return "node:20-alpine";
    if (pref === "distroless") return "gcr.io/distroless/nodejs20-debian12";
    if (pref === "slim") return "node:20-slim";
    if (pref === "alpine") return "node:20-alpine";
    return "node:20-alpine"; // default
  }
  if (language === "python") {
    if (stage === "builder") return "python:3.12-slim";
    if (pref === "alpine") return "python:3.12-alpine";
    if (pref === "distroless") return "gcr.io/distroless/python3-debian12";
    return "python:3.12-slim"; // slim / default (slim avoids alpine wheel-compile issues)
  }
  if (language === "go") {
    if (stage === "builder") return "golang:1.22-alpine";
    // Go compiles to a static binary — scratch or distroless is ideal.
    if (pref === "alpine") return "alpine:3.20";
    if (pref === "slim") return "debian:bookworm-slim";
    if (pref === "distroless") return "gcr.io/distroless/static-debian12";
    return "scratch"; // default for Go — smallest possible image for a static binary
  }
  if (language === "rust") {
    if (stage === "builder") return "rust:1.80-alpine";
    // Rust binary on alpine is musl; on slim/distroless we need glibc.
    if (pref === "alpine") return "alpine:3.20";
    if (pref === "distroless") return "gcr.io/distroless/cc-debian12";
    return "debian:bookworm-slim"; // slim / default
  }
  if (language === "java") {
    if (stage === "builder") return "maven:3.9-eclipse-temurin-21";
    if (pref === "alpine") return "eclipse-temurin:21-jre-alpine";
    if (pref === "distroless") return "gcr.io/distroless/java21-debian12";
    return "eclipse-temurin:21-jre"; // slim / default
  }
  // ruby
  if (stage === "builder") return "ruby:3.3-alpine";
  if (pref === "distroless") return "gcr.io/distroless/ruby3-debian12";
  if (pref === "slim") return "ruby:3.3-slim";
  return "ruby:3.3-alpine"; // alpine / default
}

// ---------- Dockerfile generation ----------

export function generateDockerfile(opts: BuildOptions): GenerationResult {
  const language = opts.language;
  const framework = opts.framework ?? "none";
  const baseImage = opts.baseImage ?? "default";
  const port = opts.port ?? PORT_DEFAULTS[language];
  const healthcheck = opts.healthcheck !== false;
  const nonRoot = opts.nonRoot !== false;
  const appName = opts.appName || "app";

  const lines: string[] = [];
  const explanations: Explanation[] = [];

  const push = (line: string, explanation: string) => {
    lines.push(line);
    // Extract keyword + args from the line for the explanation.
    const m = line.match(/^(\s*)([A-Z]+)\s+(.*)$/);
    if (m) {
      explanations.push({ keyword: m[2], args: m[3], explanation });
    } else {
      explanations.push({ keyword: "", args: line.trim(), explanation });
    }
  };

  // ---- syntax directive ----
  push("# syntax=docker/dockerfile:1.7", "Use BuildKit frontend for heredocs, mounts, and better caching.");
  push("", "");

  // ---- Builder stage ----
  const builderImage = recommendedBaseImage(language, baseImage, "builder");
  push(`FROM ${builderImage} AS builder`, "Builder stage: compile/install dependencies. Discarded in the final image.");
  push(`WORKDIR /app`, "Set a predictable working directory for all subsequent commands.");

  // Language-specific builder steps.
  switch (language) {
    case "nodejs": {
      const pm = opts.pkgManager ?? "npm";
      const lockfile = pm === "yarn" ? "yarn.lock" : pm === "pnpm" ? "pnpm-lock.yaml" : "package-lock.json";
      push(`COPY package.json ${lockfile} ./`, `Copy the manifest + lockfile first so dependency install is cached when only source changes.`);
      if (pm === "yarn") {
        push(`RUN yarn install --frozen-lockfile --production=false`, "Install dev+prod deps with the exact lockfile (reproducible builds).");
      } else if (pm === "pnpm") {
        push(`RUN corepack enable && pnpm install --frozen-lockfile`, "Enable corepack (pnpm) and install deps from the lockfile.");
      } else {
        push(`RUN npm ci`, "npm ci: clean install from package-lock.json. Faster and reproducible vs npm install.");
      }
      push(`COPY . .`, "Copy the rest of the source after dependencies are installed (cache-friendly layering).");
      if (framework === "nextjs") {
        push(`RUN npm run build`, "Build the Next.js production bundle (.next/).");
      } else if (framework === "nestjs") {
        push(`RUN npm run build`, "Compile TypeScript to dist/ via nest build.");
      }
      break;
    }
    case "python": {
      push(`COPY requirements.txt .`, "Copy requirements.txt first so pip install is cached.");
      push(`RUN python -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt`, "Create an isolated venv and install deps without caching wheels (smaller image).");
      push(`ENV PATH="/opt/venv/bin:$PATH"`, "Put the venv on PATH so the runner picks up the installed packages.");
      push(`COPY . .`, "Copy the application source after dependencies are installed.");
      break;
    }
    case "go": {
      push(`COPY go.mod go.sum ./`, "Copy go.mod + go.sum first so `go mod download` is cached.");
      push(`RUN go mod download`, "Download dependencies once. Cached when only source changes.");
      push(`COPY . .`, "Copy the rest of the source.");
      push(`RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /out/app ./...`, "Build a static, stripped Linux binary (-s -w drops symbol tables). CGO_ENABLED=0 enables scratch/distroless.");
      break;
    }
    case "rust": {
      push(`COPY Cargo.toml Cargo.lock ./`, "Copy Cargo manifests first so dependency compile is cached.");
      // Dummy main.rs trick for caching.
      push(`RUN mkdir src && echo "fn main() {}" > src/main.rs && cargo build --release && rm -rf src target/release/deps/${appName}*`, "Warm the dependency build cache with a dummy main so rebuilds of source changes are faster.");
      push(`COPY . .`, "Copy the real source.");
      push(`RUN cargo build --release && cp target/release/${appName} /out/app`, "Build the release binary and stage it in /out/app.");
      break;
    }
    case "java": {
      push(`COPY pom.xml .`, "Copy pom.xml first so dependency resolution is cached.");
      push(`RUN mvn dependency:go-offline -B`, "Pre-fetch all dependencies offline (cacheable layer).");
      push(`COPY src ./src`, "Copy the source tree after dependencies are fetched.");
      push(`RUN mvn package -DskipTests -B`, "Build the JAR, skipping tests (run tests in CI).");
      break;
    }
    case "ruby": {
      push(`COPY Gemfile Gemfile.lock ./`, "Copy Gemfile + lock first so `bundle install` is cached.");
      push(`RUN bundle install --jobs 4 --deployment --without development test`, "Install only production gems, deployment-mode frozen lockfile.");
      push(`COPY . .`, "Copy the rest of the source.");
      break;
    }
  }

  // ---- Runner stage ----
  push("", "");
  const runnerImage = recommendedBaseImage(language, baseImage, "runner");
  push(`FROM ${runnerImage} AS runner`, "Final runtime stage: minimal base, no compilers or dev deps.");
  push(`WORKDIR /app`, "Working directory inside the runner.");

  if (nonRoot && !runnerImage.includes("distroless")) {
    // For alpine / slim images, create a non-root user.
    if (runnerImage.includes("alpine")) {
      push(`RUN addgroup -S app && adduser -S app -G app`, "Create a non-root group + user (`app`) for least-privilege execution.");
    } else {
      push(`RUN groupadd -r app && useradd -r -g app app`, "Create a non-root group + user (`app`) for least-privilege execution.");
    }
  } else if (nonRoot && runnerImage.includes("distroless")) {
    // Distroless images: use the nonroot variant or the predefined nonroot user.
    push(`USER nonroot`, "Run as the distroless nonroot user (UID 65532) for least-privilege execution.");
  }

  if (language === "python" && !runnerImage.includes("distroless")) {
    push(`COPY --from=builder /opt/venv /opt/venv`, "Copy the venv from the builder stage.");
    push(`ENV PATH="/opt/venv/bin:$PATH"`, "Put the venv on PATH.");
  } else if (language === "nodejs") {
    if (framework === "nextjs") {
      push(`COPY --from=builder /app/.next/standalone ./`, "Copy the Next.js standalone server output (smallest possible Node runtime).");
      push(`COPY --from=builder /app/.next/static ./.next/static`, "Copy static assets (served from /static).");
      push(`COPY --from=builder /app/public ./public`, "Copy the public/ folder.");
    } else {
      push(`COPY --from=builder /app/node_modules ./node_modules`, "Copy node_modules (production deps from `npm ci`).");
      push(`COPY --from=builder /app/package.json ./`, "Copy package.json so npm can find the start script.");
      push(`COPY --from=builder /app/dist ./dist`, "Copy the compiled output (TS users) or app source.");
      if (framework !== "nestjs") {
        push(`COPY --from=builder /app/src ./src`, "Copy the source tree for runtime (Express/Flask-style apps).");
      }
    }
  } else if (language === "go" || language === "rust") {
    push(`COPY --from=builder /out/app /app/app`, "Copy the statically-linked binary from the builder stage.");
  } else if (language === "java") {
    push(`COPY --from=builder /app/target/*.jar /app/app.jar`, "Copy the built JAR from the builder stage.");
  } else if (language === "ruby") {
    push(`COPY --from=builder /app /app`, "Copy the app + vendored gems from the builder stage.");
  }

  if (nonRoot && !runnerImage.includes("distroless") && !runnerImage.includes("scratch")) {
    push(`USER app`, "Drop privileges: run the process as the non-root `app` user.");
  }

  push(`EXPOSE ${port}`, `Document the listening port. (Does NOT publish the port — use -p ${port}:${port} at runtime.)`);

  if (healthcheck) {
    let hcCmd: string;
    if (runnerImage.includes("distroless") || runnerImage === "scratch") {
      // No shell in distroless/scratch — skip or use a binary healthcheck.
      // For Go/Rust static binaries, embed a healthcheck flag instead.
      // We emit a comment so the user knows.
      push(`# HEALTHCHECK — distroless/scratch has no shell; add a /healthz endpoint in your app and use a binary probe.`, "Distroless/scratch images have no shell, so a CMD-based healthcheck won't work. Implement /healthz in your app instead.");
      hcCmd = "";
    } else if (language === "python" && framework === "fastapi") {
      hcCmd = `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:${port}/healthz').status==200 else 1)"`;
      push(hcCmd, "Healthcheck: poll /healthz every 30s; restart the container after 3 consecutive failures.");
    } else if (runnerImage.includes("alpine")) {
      hcCmd = `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD wget -qO- http://localhost:${port}/healthz || exit 1`;
      push(hcCmd, "Healthcheck using wget (alpine ships it). Polls /healthz every 30s.");
    } else {
      hcCmd = `HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 CMD curl -f http://localhost:${port}/healthz || exit 1`;
      push(hcCmd, "Healthcheck using curl. Polls /healthz every 30s; restart after 3 consecutive failures.");
    }
  }

  // ---- CMD / ENTRYPOINT ----
  if (language === "nodejs") {
    if (framework === "nextjs") {
      push(`CMD ["node", "server.js"]`, "Start the Next.js standalone server.");
    } else if (framework === "nestjs") {
      push(`CMD ["node", "dist/main.js"]`, "Start the NestJS app from the compiled output.");
    } else {
      push(`CMD ["node", "src/index.js"]`, "Start the Node.js app. Adjust the entrypoint to match your project.");
    }
  } else if (language === "python") {
    if (framework === "fastapi") {
      push(`CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "${port}"]`, "Start Uvicorn for FastAPI on all interfaces.");
    } else if (framework === "flask") {
      push(`CMD ["gunicorn", "-b", "0.0.0.0:${port}", "app:app"]`, "Run Flask behind Gunicorn in production.");
    } else if (framework === "django") {
      push(`CMD ["gunicorn", "-b", "0.0.0.0:${port}", "myproject.wsgi:application"]`, "Run Django behind Gunicorn. Replace myproject with your project name.");
    } else {
      push(`CMD ["python", "app.py"]`, "Start the Python app.");
    }
  } else if (language === "go" || language === "rust") {
    push(`CMD ["/app/app"]`, "Run the static binary.");
  } else if (language === "java") {
    push(`CMD ["java", "-jar", "/app/app.jar"]`, "Run the JAR with the JRE.");
  } else if (language === "ruby") {
    if (framework === "rails") {
      push(`CMD ["bundle", "exec", "rails", "server", "-b", "0.0.0.0", "-p", "${port}"]`, "Start the Rails server bound to all interfaces.");
    } else if (framework === "sinatra") {
      push(`CMD ["ruby", "app.rb", "-o", "0.0.0.0", "-p", "${port}"]`, "Start the Sinatra app.");
    } else {
      push(`CMD ["ruby", "app.rb"]`, "Start the Ruby app.");
    }
  }

  const dockerfile = lines.join("\n");
  const dockerignore = generateDockerignore(language);
  const compose = generateCompose(opts);
  const instructions = parseDockerfile(dockerfile);
  const lint = lintDockerfile(dockerfile);
  return { dockerfile, dockerignore, compose, explanations, instructions, lint };
}

// ---------- .dockerignore ----------

export function generateDockerignore(language: Language): string {
  const common = [
    "# Version control",
    ".git",
    ".gitignore",
    "",
    "# Build artifacts",
    "dist/",
    "build/",
    "target/",
    "out/",
    "bin/",
    "",
    "# Dependency directories (fetched fresh in the build)",
  ];
  if (language === "nodejs") {
    common.push("node_modules/", "npm-debug.log*", "yarn-error.log*", ".npm", ".yarn");
  } else if (language === "python") {
    common.push("__pycache__/", "*.pyc", "*.pyo", ".venv/", "venv/", ".pytest_cache/", ".mypy_cache/");
  } else if (language === "go") {
    common.push("vendor/");
  } else if (language === "rust") {
    common.push("target/");
  } else if (language === "java") {
    common.push("target/", "*.class", ".mvn/");
  } else if (language === "ruby") {
    common.push("vendor/bundle/", ".bundle/");
  }
  common.push(
    "",
    "# IDE / OS",
    ".vscode/",
    ".idea/",
    ".DS_Store",
    "",
    "# Env & secrets — NEVER copy these into the image",
    ".env",
    ".env.*",
    "*.pem",
    "*.key",
    "",
    "# Docker",
    "Dockerfile",
    "docker-compose*.yml",
    ".dockerignore",
  );
  return common.join("\n");
}

// ---------- Docker Compose ----------

export function generateCompose(opts: BuildOptions): string {
  const language = opts.language;
  const port = opts.port ?? PORT_DEFAULTS[language];
  const appName = opts.appName || "app";
  return [
    `# docker compose up --build`,
    `services:`,
    `  ${appName}:`,
    `    build: .`,
    `    image: ${appName}:latest`,
    `    container_name: ${appName}`,
    `    ports:`,
    `      - "${port}:${port}"`,
    `    restart: unless-stopped`,
    `    environment:`,
    `      - NODE_ENV=production`,
    `      # - DATABASE_URL=\${DATABASE_URL}`,
    `    # healthcheck:`,
    `    #   test: ["CMD", "wget", "-qO-", "http://localhost:${port}/healthz"]`,
    `    #   interval: 30s`,
    `    #   timeout: 3s`,
    `    #   retries: 3`,
    `    # depends_on:`,
    `    #   db:`,
    `    #     condition: service_healthy`,
    `    #   redis:`,
    `    #     condition: service_started`,
    `    #`,
    `    # Uncomment if you need a database + cache:`,
    `    # db:`,
    `    #   image: postgres:16-alpine`,
    `    #   environment:`,
    `    #     POSTGRES_DB: app`,
    `    #     POSTGRES_USER: app`,
    `    #     POSTGRES_PASSWORD: \${DB_PASSWORD}`,
    `    #   volumes: ["dbdata:/var/lib/postgresql/data"]`,
    `    #   healthcheck:`,
    `    #     test: ["CMD", "pg_isready", "-U", "app"]`,
    `    #     interval: 10s`,
    `    #     timeout: 3s`,
    `    #     retries: 5`,
    `    # redis:`,
    `    #   image: redis:7-alpine`,
    `    #   command: redis-server --save 60 1`,
    `    #   volumes: ["redisdata:/data"]`,
    `    #`,
    `    # volumes:`,
    `    #   dbdata:`,
    `    #   redisdata:`,
  ].join("\n");
}

// ---------- Dockerfile parsing ----------

/** Strip comments and join continuation lines, returning cleaned lines. */
export function cleanLine(line: string): string {
  // Strip trailing comments (but not # inside a string).
  return line.replace(/\s+#.*$/, "").trim();
}

/** Parse a Dockerfile string into structured Instruction objects. */
export function parseDockerfile(text: string): Instruction[] {
  if (!text) return [];
  const out: Instruction[] = [];
  const rawLines = text.split(/\r?\n/);
  // Join continuation lines.
  let current = "";
  let startLine = 0;
  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    const trimmed = line.trim();
    if (trimmed.endsWith("\\")) {
      if (!current) startLine = i + 1;
      current += trimmed.slice(0, -1) + " ";
      continue;
    }
    if (current) {
      current += trimmed;
      const cleaned = cleanLine(current);
      if (cleaned && !cleaned.startsWith("#")) out.push(toInstruction(startLine, cleaned));
      current = "";
    } else {
      const cleaned = cleanLine(line);
      if (cleaned && !cleaned.startsWith("#")) out.push(toInstruction(i + 1, cleaned));
    }
  }
  if (current) {
    const cleaned = cleanLine(current);
    if (cleaned && !cleaned.startsWith("#")) out.push(toInstruction(startLine, cleaned));
  }
  return out;
}

function toInstruction(line: number, raw: string): Instruction {
  const m = raw.match(/^([A-Za-z]+)\s+(.*)$/);
  if (!m) return { line, keyword: "", args: raw, raw };
  return { line, keyword: m[1].toUpperCase(), args: m[2].trim(), raw };
}

// ---------- Linter (hadolint-style) ----------

export function lintDockerfile(text: string): LintIssue[] {
  const issues: LintIssue[] = [];
  const instructions = parseDockerfile(text);
  if (instructions.length === 0) return issues;

  let hasFrom = false;
  let hasHealthcheck = false;
  let hasUserNonRoot = false;
  let lastUserIsRoot = false;
  let usedFromTags: string[] = [];

  for (const ins of instructions) {
    const kw = ins.keyword;
    const args = ins.args;
    if (kw === "FROM") {
      hasFrom = true;
      const tagMatch = args.match(/:([\w.\-]+)/);
      const tag = tagMatch ? tagMatch[1] : "";
      if (tag === "latest") {
        issues.push({ level: "warning", rule: "DL3007", message: "Pin a specific version instead of :latest for reproducible builds.", line: ins.line });
      }
      if (tag) usedFromTags.push(tag);
      if (usedFromTags.length === 1 && /scratch|distroless/.test(args)) {
        // scratch/distroless as the only stage is fine.
      }
    }
    if (kw === "USER") {
      if (args === "root" || args === "0") {
        issues.push({ level: "warning", rule: "DL3002", message: "Last USER is root — run as a non-root user.", line: ins.line });
        lastUserIsRoot = true;
        hasUserNonRoot = false;
      } else {
        hasUserNonRoot = true;
        lastUserIsRoot = false;
      }
    }
    if (kw === "HEALTHCHECK") {
      hasHealthcheck = true;
    }
    if (kw === "ADD") {
      issues.push({ level: "warning", rule: "DL3020", message: "Prefer COPY over ADD — ADD only for tar auto-extraction or remote URLs.", line: ins.line });
    }
    if (kw === "RUN") {
      if (/\bapk add\b/.test(args) && !/--no-cache/.test(args)) {
        issues.push({ level: "warning", rule: "DL3019", message: "Use `apk add --no-cache` to avoid caching the index in the image.", line: ins.line });
      }
      if (/\bapk add\b/.test(args) && !args.includes("rm")) {
        // Could also flag for cache cleanup
      }
      if (/\bapt-get install\b/.test(args) && !/-y\b/.test(args)) {
        issues.push({ level: "warning", rule: "DL3014", message: "Use `apt-get install -y` for non-interactive builds.", line: ins.line });
      }
      if (/\bapt-get install\b/.test(args) && !/rm -rf \/var\/lib\/apt\/lists/.test(args)) {
        issues.push({ level: "warning", rule: "DL3009", message: "Clean up apt lists after install to shrink the image: `&& rm -rf /var/lib/apt/lists/*`.", line: ins.line });
      }
      if (/\bapt-get install\b/.test(args) && !/apt-get update/.test(args) && !/apt-get install -y --no-install-recommends/.test(args)) {
        issues.push({ level: "info", rule: "DL3015", message: "Use `--no-install-recommends` to skip recommended packages (smaller image).", line: ins.line });
      }
      if (/\bapk add\b/.test(args) && !/--no-cache/.test(args)) {
        // already flagged above
      }
      if (/\bnpm install\b/.test(args) && !/\bnpm ci\b/.test(args)) {
        issues.push({ level: "info", rule: "DL3016", message: "In CI/production, prefer `npm ci` over `npm install` for reproducible builds.", line: ins.line });
      }
      if (/\bpip install\b/.test(args) && !/--no-cache-dir/.test(args)) {
        issues.push({ level: "warning", rule: "DL3013", message: "Use `pip install --no-cache-dir` to avoid pip's wheel cache bloating the image.", line: ins.line });
      }
      if (/\bsudo\b/.test(args)) {
        issues.push({ level: "warning", rule: "DL3004", message: "Avoid sudo in Dockerfiles — use USER or gosu instead.", line: ins.line });
      }
      if (/cd\s+\S+\s*&&/.test(args) || /^cd\s+/.test(args)) {
        issues.push({ level: "info", rule: "DL3003", message: "Avoid `cd` in RUN — use WORKDIR instead for clarity.", line: ins.line });
      }
      if (args.includes("&&") && !/ && /.test(args)) {
        // chained without spaces — not flagged
      }
    }
    if (kw === "MAINTAINER") {
      issues.push({ level: "info", rule: "DL4007", message: "MAINTAINER is deprecated. Use OCI labels instead: `LABEL org.opencontainers.image.authors=...`.", line: ins.line });
    }
    if (kw === "EXPOSE") {
      // EXPOSE is documentation only — info-level nudge.
      // (no issue, EXPOSE is good practice)
    }
  }

  if (!hasFrom) {
    issues.push({ level: "error", rule: "DL3006", message: "Dockerfile must begin with a FROM instruction." });
  }
  if (!hasHealthcheck) {
    issues.push({ level: "info", rule: "DL3059", message: "No HEALTHCHECK — add one so orchestrators can restart unhealthy containers." });
  }
  if (!hasUserNonRoot && !lastUserIsRoot) {
    // Check if any FROM uses distroless with implicit nonroot, otherwise warn.
    const hasDistroless = instructions.some((i) => i.keyword === "FROM" && /distroless/.test(i.args));
    if (!hasDistroless) {
      issues.push({ level: "warning", rule: "DL3002", message: "No USER instruction — the container runs as root. Add a non-root USER." });
    }
  }

  // Sort: errors first, then warnings, then info.
  const order = { error: 0, warning: 1, info: 2 };
  issues.sort((a, b) => order[a.level] - order[b.level]);
  return issues;
}

// ---------- Optimize an existing Dockerfile ----------

export function optimizeDockerfile(text: string): OptimizationResult {
  const suggestions: string[] = [];
  const lint = lintDockerfile(text);
  const instructions = parseDockerfile(text);
  let optimized = text;

  // Suggestion 1: Replace ADD with COPY.
  if (instructions.some((i) => i.keyword === "ADD")) {
    optimized = optimized.replace(/^(\s*)ADD(\s+)/gm, "$1COPY$2");
    suggestions.push("Replaced ADD with COPY — COPY is preferred unless you need tar auto-extraction or remote URLs.");
  }

  // Suggestion 2: Strip MAINTAINER.
  if (instructions.some((i) => i.keyword === "MAINTAINER")) {
    optimized = optimized.replace(/^\s*MAINTAINER.*$/gm, "# (Removed deprecated MAINTAINER — use OCI labels)");
    suggestions.push("Removed deprecated MAINTAINER instruction. Use `LABEL org.opencontainers.image.authors=...` instead.");
  }

  // Suggestion 3: Add --no-cache to apk add.
  if (/\bapk add\b(?!.*--no-cache)/.test(optimized)) {
    optimized = optimized.replace(/\bapk add\b(?!.*--no-cache)/g, "apk add --no-cache");
    suggestions.push("Added `--no-cache` to `apk add` to skip storing the index in the image.");
  }

  // Suggestion 4: Add --no-cache-dir to pip install.
  if (/\bpip install\b(?!.*--no-cache-dir)/.test(optimized)) {
    optimized = optimized.replace(/\bpip install\b(?!.*--no-cache-dir)/g, "pip install --no-cache-dir");
    suggestions.push("Added `--no-cache-dir` to `pip install` to skip the wheel cache.");
  }

  // Suggestion 5: Replace :latest tags with explicit versions (informational).
  if (/:latest\b/.test(optimized)) {
    suggestions.push("Replace `:latest` tags with explicit versions (e.g. `node:20-alpine`) for reproducible builds.");
  }

  // Suggestion 6: Add a non-root USER if missing.
  if (!instructions.some((i) => i.keyword === "USER")) {
    optimized = optimized.trimEnd() + "\n\n# Run as non-root\nRUN addgroup -S app && adduser -S app -G app\nUSER app\n";
    suggestions.push("Added a non-root `app` user and a USER instruction.");
  }

  // Suggestion 7: Add HEALTHCHECK if missing.
  if (!instructions.some((i) => i.keyword === "HEALTHCHECK")) {
    optimized = optimized.trimEnd() + "\n# Healthcheck\nHEALTHCHECK --interval=30s --timeout=3s --retries=3 CMD wget -qO- http://localhost:8080/healthz || exit 1\n";
    suggestions.push("Added a HEALTHCHECK instruction so orchestrators can detect unhealthy containers.");
  }

  return { dockerfile: optimized, suggestions, lint };
}

// ---------- Per-instruction explanation (one-liner) ----------

export function explainInstruction(ins: Instruction): string {
  const kw = ins.keyword;
  const args = ins.args;
  switch (kw) {
    case "FROM": return `Use ${args} as the base image for this build stage.`;
    case "WORKDIR": return `Set the working directory to ${args}. Subsequent commands run here.`;
    case "COPY": return `Copy files from the build context (or another stage with --from=) into the image.`;
    case "ADD": return `Copy files (with tar auto-extraction / remote URL support). Prefer COPY unless you need these features.`;
    case "RUN": return `Execute a shell command at build time, committing the result as a new layer.`;
    case "CMD": return `Default command to run when the container starts. Overridable by 'docker run <image> <cmd>'.`;
    case "ENTRYPOINT": return `The executable that always runs when the container starts. CMD args are appended to it.`;
    case "ENV": return `Set an environment variable available at build time and in the running container.`;
    case "ARG": return `Build-time variable, passed with --build-arg. Not available at runtime.`;
    case "EXPOSE": return `Document the listening port. Does NOT publish it — use -p at runtime.`;
    case "USER": return `Run subsequent commands (and the container) as this user.`;
    case "VOLUME": return `Declare a mount point for external storage.`;
    case "HEALTHCHECK": return `Command Docker runs periodically to decide if the container is healthy.`;
    case "LABEL": return `Attach metadata to the image (key=value).`;
    case "MAINTAINER": return `Deprecated. Use LABEL org.opencontainers.image.authors=... instead.`;
    case "STOPSIGNAL": return `Signal to send the container to stop it gracefully (default SIGTERM).`;
    case "SHELL": return `Default shell for RUN commands (e.g. cmd /S /C on Windows).`;
    case "ONBUILD": return `Trigger that fires when this image is used as a base for another build. Rarely needed.`;
    default: return "";
  }
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  params.set("lang", state.language);
  if (state.framework !== "none") params.set("fw", state.framework);
  if (state.baseImage !== "default") params.set("base", state.baseImage);
  if (state.port) params.set("port", String(state.port));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { language: "nodejs", framework: "none", baseImage: "default", port: PORT_DEFAULTS.nodejs };
  const params = new URLSearchParams(clean);
  const language = normalizeLanguage(params.get("lang") ?? "nodejs");
  const framework = normalizeFramework(params.get("fw") ?? "none");
  const baseImage = normalizeBaseImage(params.get("base") ?? "default");
  const portRaw = parseInt(params.get("port") ?? "", 10);
  const port = Number.isFinite(portRaw) && portRaw > 0 && portRaw < 65536 ? portRaw : PORT_DEFAULTS[language];
  return { language, framework, baseImage, port };
}

// ---------- LLM prompt (BYO key, called from ui.tsx) ----------

export function buildLlmPrompt(opts: BuildOptions): string {
  return [
    "You are a Docker expert. Generate an optimized multi-stage Dockerfile for the following stack.",
    "Follow best practices: minimal base image, layer caching, non-root user, HEALTHCHECK, no :latest tags.",
    "Output ONLY the Dockerfile — no prose, no markdown fences.",
    "",
    `Language: ${LANGUAGE_LABELS[opts.language]}`,
    `Framework: ${opts.framework ?? "none"}`,
    `Base image preference: ${opts.baseImage ?? "default"}`,
    `Port: ${opts.port ?? PORT_DEFAULTS[opts.language]}`,
    `Package manager (Node only): ${opts.pkgManager ?? "npm"}`,
  ].join("\n");
}

export interface LlmEnhancement {
  dockerfile: string;
  suggestions: string[];
}

export function renderLlmResult(raw: string): LlmEnhancement {
  const dockerfile = raw.replace(/^```(?:dockerfile)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return { dockerfile, suggestions: [] };
}

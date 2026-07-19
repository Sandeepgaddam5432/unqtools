import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-dockerfile-builder",
  name: "AI Dockerfile Builder — Multi-Stage & Optimized",
  description:
    "Describe your stack (language, framework, port) and get an optimized multi-stage Dockerfile with minimal base image, layer caching, non-root user, healthcheck, plus a matching .dockerignore, per-instruction explanations, hadolint-style security/size lint, Docker Compose companion, and an import-to-optimize flow. Templates for Node.js, Python, Go, Rust, Java, and Ruby. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "dockerfile", "dockerfile generator", "multi-stage dockerfile",
    "ai dockerfile builder", "docker best practices",
    "docker gordon alternative", "dockerfile optimizer",
    "hadolint", "non-root container", "slim image",
    "docker compose", "containerize",
  ],
  icon: "container",
  requiresNetwork: false,
  seo: {
    title: "AI Dockerfile Builder — Multi-Stage & Optimized Generator | UnQTools",
    faq: [
      {
        q: "How does the Dockerfile builder work?",
        a: "Pick your language (Node.js, Python, Go, Rust, Java, or Ruby), optional framework, port, and base-image preference (alpine / slim / distroless / default). The generator emits a production-grade multi-stage Dockerfile with a builder stage for compilation/install and a minimal runner stage, plus non-root user, WORKDIR, HEALTHCHECK, layer-cached COPY of manifests before source, and a matching .dockerignore. Each instruction has a tooltip-style explanation and the linter flags security/size issues (hadolint-style).",
      },
      {
        q: "Which languages and frameworks are supported?",
        a: "Six first-class templates: Node.js (npm/yarn/pnpm, with optional Next.js / Express / NestJS presets), Python (pip, with FastAPI / Flask / Django presets), Go (modules, CGO-free build → scratch/distroless), Rust (cargo, release build → debian-slim), Java (Maven build → JRE runtime), and Ruby (bundler, with Rails/Sinatra presets). Each template chooses the right base image, build command, and runtime entrypoint for the chosen base-image preference.",
      },
      {
        q: "What best practices are baked into the generated Dockerfiles?",
        a: "Multi-stage builds (builder + runner), minimal base images (alpine, slim, or distroless), dependency manifests copied before source for layer caching, a non-root system user created in the runner stage, EXPOSE for the chosen port, a HEALTHCHECK using curl or wget, .dockerignore companion that excludes node_modules, .git, build artifacts, and a Docker Compose companion with restart policy and a healthcheck condition. The linter flags :latest tags, root users, missing HEALTHCHECK, apk add without --no-cache, apt-get without rm of apt lists, ADD instead of COPY, and more.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Six per-language templates (Node.js, Python, Go, Rust, Java, Ruby). (2) Framework presets (Next.js, Express, NestJS, FastAPI, Flask, Django, Rails, Sinatra). (3) Three base-image preferences (alpine, slim, distroless, default). (4) Multi-stage build with layer-cached manifest copy. (5) Non-root user + HEALTHCHECK + EXPOSE. (6) Matching .dockerignore per language. (7) Docker Compose companion. (8) Per-instruction explanation tooltips. (9) Hadolint-style lint (20+ rules: DL3008, DL3018, DL3059, etc.). (10) Import existing Dockerfile to lint + optimize. (11) Local history (last 20). (12) Shareable URL with options encoded. (13) Copy / download Dockerfile / .dockerignore / compose.yaml. (14) Optional BYO-key LLM polish (OpenAI/Anthropic). (15) Honesty disclaimers (always build & scan with trivy/docker scout before production).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All Dockerfile generation, linting, parsing, and optimization run locally in your browser. Your stack description and any Dockerfile you import for optimization never leave this device. The only network call is if you paste your own LLM API key and click 'Polish with LLM' — that request goes directly from your browser to OpenAI or Anthropic.",
      },
    ],
  },
  status: "done",
};

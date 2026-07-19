import { describe, it, expect, beforeEach } from "vitest";
import {
  HISTORY_KEY,
  HISTORY_MAX,
  RESOURCE_TYPES,
  RESOURCE_LABELS,
  SERVICE_TYPES,
  APP_NAME_PRESETS,
  IMAGE_PRESETS,
  NAMESPACE_PRESETS,
  DEFAULT_RESOURCES,
  DEFAULT_SECURITY_CONTEXT,
  normalizeAppName,
  normalizeImage,
  normalizeNamespace,
  validateImage,
  parsePort,
  parseSchedule,
  base64Encode,
  base64Decode,
  emitYaml,
  buildDeployment,
  buildService,
  buildIngress,
  buildConfigMap,
  buildSecret,
  buildPod,
  buildJob,
  buildCronJob,
  buildHpa,
  generateResource,
  generateAll,
  emitDocument,
  explainManifest,
  lintManifests,
  renderKustomize,
  renderHelmValues,
  parseExistingYaml,
  reSerializeManifests,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  buildLlmPrompt,
  renderLlmResult,
  type ResourceType,
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

const baseOpts = (overrides: Partial<BuildOptions> = {}): BuildOptions => ({
  appName: "api-gateway",
  image: "ghcr.io/acme/api:1.2.3",
  tag: "1.2.3",
  port: 8080,
  replicas: 3,
  namespace: "production",
  serviceType: "ClusterIP",
  ingressHost: "api.example.com",
  ingressPath: "/",
  ingressTLS: true,
  resources: ["deployment", "service", "ingress", "configmap", "secret", "hpa"],
  cronSchedule: "0 */6 * * *",
  hpaMaxReplicas: 10,
  hpaCpuTarget: 70,
  format: "yaml",
  ...overrides,
});

describe("ai-k8s constants", () => {
  it("exposes 9 resource types", () => {
    expect(RESOURCE_TYPES).toHaveLength(9);
    expect(RESOURCE_TYPES).toContain("deployment");
    expect(RESOURCE_TYPES).toContain("cronjob");
    expect(RESOURCE_TYPES).toContain("hpa");
  });
  it("has labels for all resource types", () => {
    for (const t of RESOURCE_TYPES) {
      expect(RESOURCE_LABELS[t]).toBeTruthy();
    }
  });
  it("has 3 service types", () => {
    expect(SERVICE_TYPES).toEqual(["ClusterIP", "NodePort", "LoadBalancer"]);
  });
  it("exposes presets", () => {
    expect(APP_NAME_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(IMAGE_PRESETS.length).toBeGreaterThanOrEqual(3);
    expect(NAMESPACE_PRESETS).toContain("production");
  });
  it("has sensible defaults", () => {
    expect(DEFAULT_RESOURCES.cpuRequest).toMatch(/^[\d]+m$/);
    expect(DEFAULT_SECURITY_CONTEXT.runAsNonRoot).toBe(true);
    expect(DEFAULT_SECURITY_CONTEXT.runAsUser).toBeGreaterThan(0);
  });
  it("uses HISTORY_MAX = 20 and a stable key", () => {
    expect(HISTORY_MAX).toBe(20);
    expect(HISTORY_KEY).toBe("unqtools:ai-k8s-manifest-generator:history");
  });
});

describe("ai-k8s normalizeAppName", () => {
  it("lowercases and kebab-cases", () => {
    expect(normalizeAppName("API Gateway")).toBe("api-gateway");
  });
  it("strips leading/trailing non-alnum", () => {
    expect(normalizeAppName("---foo---")).toBe("foo");
  });
  it("returns empty for empty input", () => {
    expect(normalizeAppName("")).toBe("");
  });
  it("truncates to 63 chars (DNS-1123)", () => {
    const long = "a".repeat(100);
    expect(normalizeAppName(long).length).toBe(63);
  });
});

describe("ai-k8s normalizeImage", () => {
  it("trims whitespace", () => {
    expect(normalizeImage("  nginx:1.27  ")).toBe("nginx:1.27");
  });
  it("removes internal whitespace", () => {
    expect(normalizeImage("nginx : 1.27")).toBe("nginx:1.27");
  });
});

describe("ai-k8s normalizeNamespace", () => {
  it("lowercases and dashes", () => {
    expect(normalizeNamespace("My App")).toBe("my-app");
  });
  it("truncates to 63 chars", () => {
    expect(normalizeNamespace("a".repeat(100)).length).toBe(63);
  });
});

describe("ai-k8s validateImage", () => {
  it("flags :latest tag", () => {
    const issues = validateImage("nginx:latest");
    expect(issues.some((i) => i.rule === "IMG002")).toBe(true);
  });
  it("flags missing tag", () => {
    const issues = validateImage("nginx");
    expect(issues.some((i) => i.rule === "IMG003")).toBe(true);
  });
  it("passes pinned tag", () => {
    const issues = validateImage("nginx:1.27-alpine");
    expect(issues).toHaveLength(0);
  });
  it("errors on empty image", () => {
    const issues = validateImage("");
    expect(issues.some((i) => i.level === "error" && i.rule === "IMG001")).toBe(true);
  });
});

describe("ai-k8s parsePort", () => {
  it("parses valid port", () => {
    expect(parsePort("8080")).toBe(8080);
    expect(parsePort(443)).toBe(443);
  });
  it("rejects out-of-range", () => {
    expect(parsePort("0")).toBeNull();
    expect(parsePort("70000")).toBeNull();
  });
  it("rejects NaN", () => {
    expect(parsePort("abc")).toBeNull();
  });
});

describe("ai-k8s parseSchedule", () => {
  it("accepts 5-field cron", () => {
    expect(parseSchedule("0 */6 * * *")).toBe("0 */6 * * *");
  });
  it("rejects wrong field count", () => {
    expect(parseSchedule("0 6 * *")).toBeNull();
  });
  it("rejects invalid chars", () => {
    expect(parseSchedule("0 abc * * *")).toBeNull();
  });
  it("returns null for empty", () => {
    expect(parseSchedule("")).toBeNull();
  });
});

describe("ai-k8s base64 encode/decode round-trip", () => {
  it("round-trips ASCII", () => {
    expect(base64Decode(base64Encode("hello world"))).toBe("hello world");
  });
  it("round-trips UTF-8", () => {
    expect(base64Decode(base64Encode("héllo wörld 🚀"))).toBe("héllo wörld 🚀");
  });
  it("encodes 'replace-me' deterministically", () => {
    expect(base64Encode("replace-me")).toBe("cmVwbGFjZS1tZQ==");
  });
});

describe("ai-k8s emitYaml", () => {
  it("emits a simple map", () => {
    const y = emitYaml({ a: 1, b: "two" });
    expect(y).toContain("a: 1");
    expect(y).toContain("b: two");
  });
  it("quotes numeric-looking strings", () => {
    const y = emitYaml({ port: "8080" });
    expect(y).toContain('port: "8080"');
  });
  it("emits nested objects with 2-space indent", () => {
    const y = emitYaml({ spec: { replicas: 3 } });
    expect(y).toContain("spec:\n  replicas: 3");
  });
  it("emits arrays with - prefix", () => {
    const y = emitYaml({ items: [1, 2, 3] });
    expect(y).toContain("items:\n  - 1\n  - 2\n  - 3");
  });
  it("emits array of objects with first-key inline", () => {
    const y = emitYaml({ ports: [{ name: "http", port: 80 }] });
    expect(y).toContain("- name: http");
    expect(y).toContain("  port: 80");
  });
  it("emits empty array as []", () => {
    expect(emitYaml({ a: [] })).toContain("a: []");
  });
  it("quotes strings with special chars", () => {
    const y = emitYaml({ url: "https://example.com" });
    expect(y).toContain('url: "https://example.com"');
  });
});

describe("ai-k8s buildDeployment", () => {
  it("sets apiVersion and kind", () => {
    const d = buildDeployment(baseOpts());
    expect(d.apiVersion).toBe("apps/v1");
    expect(d.kind).toBe("Deployment");
  });
  it("honors replicas and namespace", () => {
    const d = buildDeployment(baseOpts({ replicas: 5, namespace: "staging" }));
    const spec = d.spec as Record<string, unknown>;
    expect(spec.replicas).toBe(5);
    const meta = d.metadata as Record<string, unknown>;
    expect(meta.namespace).toBe("staging");
  });
  it("includes resource requests and limits", () => {
    const d = buildDeployment(baseOpts());
    const spec = d.spec as Record<string, unknown>;
    const template = spec.template as Record<string, unknown>;
    const podSpec = template.spec as Record<string, unknown>;
    const containers = podSpec.containers as Record<string, unknown>[];
    const resources = containers[0]!.resources as Record<string, unknown>;
    expect(resources.requests).toBeDefined();
    expect(resources.limits).toBeDefined();
  });
  it("includes readiness and liveness probes", () => {
    const d = buildDeployment(baseOpts());
    const spec = d.spec as Record<string, unknown>;
    const template = spec.template as Record<string, unknown>;
    const podSpec = template.spec as Record<string, unknown>;
    const containers = podSpec.containers as Record<string, unknown>[];
    expect(containers[0]!.readinessProbe).toBeDefined();
    expect(containers[0]!.livenessProbe).toBeDefined();
  });
  it("runs as non-root with dropped capabilities", () => {
    const d = buildDeployment(baseOpts());
    const spec = d.spec as Record<string, unknown>;
    const template = spec.template as Record<string, unknown>;
    const podSpec = template.spec as Record<string, unknown>;
    const podSec = podSpec.securityContext as Record<string, unknown>;
    expect(podSec.runAsNonRoot).toBe(true);
    expect(podSec.runAsUser).toBe(10001);
  });
});

describe("ai-k8s buildService", () => {
  it("honors service type", () => {
    const s = buildService(baseOpts({ serviceType: "NodePort" }));
    const spec = s.spec as Record<string, unknown>;
    expect(spec.type).toBe("NodePort");
  });
  it("selects pods by app label", () => {
    const s = buildService(baseOpts());
    const spec = s.spec as Record<string, unknown>;
    expect(spec.selector).toEqual({ app: "api-gateway" });
  });
});

describe("ai-k8s buildIngress", () => {
  it("uses provided host and path", () => {
    const ing = buildIngress(baseOpts({ ingressHost: "acme.io", ingressPath: "/api" }));
    const spec = ing.spec as Record<string, unknown>;
    const rules = spec.rules as Record<string, unknown>[];
    expect(rules[0]!.host).toBe("acme.io");
  });
  it("includes TLS by default", () => {
    const ing = buildIngress(baseOpts());
    const spec = ing.spec as Record<string, unknown>;
    expect(spec.tls).toBeDefined();
  });
  it("disables TLS when asked", () => {
    const ing = buildIngress(baseOpts({ ingressTLS: false }));
    const spec = ing.spec as Record<string, unknown>;
    expect(spec.tls).toBeUndefined();
  });
});

describe("ai-k8s buildConfigMap and buildSecret", () => {
  it("ConfigMap stores plaintext data", () => {
    const cm = buildConfigMap(baseOpts({ configMapData: { LOG_LEVEL: "debug" } }));
    const data = cm.data as Record<string, string>;
    expect(data.LOG_LEVEL).toBe("debug");
  });
  it("Secret base64-encodes data", () => {
    const sec = buildSecret(baseOpts({ secretData: { API_KEY: "replace-me" } }));
    const data = sec.data as Record<string, string>;
    expect(data.API_KEY).toBe("cmVwbGFjZS1tZQ==");
  });
  it("Secret defaults to Opaque type", () => {
    const sec = buildSecret(baseOpts());
    expect(sec.type).toBe("Opaque");
  });
});

describe("ai-k8s buildPod, buildJob, buildCronJob, buildHpa", () => {
  it("Pod uses restartPolicy Never", () => {
    const p = buildPod(baseOpts());
    const spec = p.spec as Record<string, unknown>;
    expect(spec.restartPolicy).toBe("Never");
  });
  it("Job sets backoffLimit and ttlSecondsAfterFinished", () => {
    const j = buildJob(baseOpts());
    const spec = j.spec as Record<string, unknown>;
    expect(spec.backoffLimit).toBe(3);
    expect(spec.ttlSecondsAfterFinished).toBe(600);
  });
  it("CronJob uses provided schedule", () => {
    const c = buildCronJob(baseOpts({ cronSchedule: "*/15 * * * *" }));
    const spec = c.spec as Record<string, unknown>;
    expect(spec.schedule).toBe("*/15 * * * *");
  });
  it("CronJob falls back to default on bad schedule", () => {
    const c = buildCronJob(baseOpts({ cronSchedule: "bad" }));
    const spec = c.spec as Record<string, unknown>;
    expect(spec.schedule).toBe("0 */6 * * *");
  });
  it("HPA sets min/max replicas", () => {
    const h = buildHpa(baseOpts({ replicas: 2, hpaMaxReplicas: 8 }));
    const spec = h.spec as Record<string, unknown>;
    expect(spec.minReplicas).toBe(2);
    expect(spec.maxReplicas).toBe(8);
  });
  it("HPA clamps max to >= min", () => {
    const h = buildHpa(baseOpts({ replicas: 5, hpaMaxReplicas: 1 }));
    const spec = h.spec as Record<string, unknown>;
    expect(spec.maxReplicas as number).toBeGreaterThanOrEqual(spec.minReplicas as number);
  });
});

describe("ai-k8s generateResource", () => {
  it("wraps YAML in a --- document", () => {
    const f = generateResource("deployment", baseOpts());
    expect(f.yaml.startsWith("---\n")).toBe(true);
    expect(f.yaml).toContain("kind: Deployment");
  });
  it("attaches explanations for known fields", () => {
    const f = generateResource("deployment", baseOpts());
    expect(f.explanations.length).toBeGreaterThan(0);
    expect(f.explanations.some((e) => e.line.startsWith("replicas:"))).toBe(true);
  });
});

describe("ai-k8s generateAll", () => {
  it("produces one file per selected resource", () => {
    const r = generateAll(baseOpts());
    expect(r.files).toHaveLength(6);
    expect(r.files.map((f) => f.type).sort()).toEqual(
      ["configmap", "deployment", "hpa", "ingress", "secret", "service"],
    );
  });
  it("joins files into allInOne with --- separator", () => {
    const r = generateAll(baseOpts());
    expect(r.allInOne.split(/^---$/m).length).toBeGreaterThanOrEqual(6);
  });
  it("emits kustomize output when format = kustomize", () => {
    const r = generateAll(baseOpts({ format: "kustomize" }));
    expect(r.kustomize).toBeDefined();
    expect(r.kustomize).toContain("Kustomization");
  });
  it("emits helm values when format = helm", () => {
    const r = generateAll(baseOpts({ format: "helm" }));
    expect(r.helmValues).toBeDefined();
    expect(r.helmValues).toContain("replicaCount");
  });
});

describe("ai-k8s emitDocument", () => {
  it("prefixes with --- separator", () => {
    const doc = emitDocument({ apiVersion: "v1", kind: "Pod" });
    expect(doc.startsWith("---\n")).toBe(true);
    expect(doc).toContain("kind: Pod");
  });
});

describe("ai-k8s explainManifest", () => {
  it("returns an explanation for the replicas field", () => {
    const d = buildDeployment(baseOpts());
    const explanations = explainManifest(d);
    const replicasExp = explanations.find((e) => e.line.startsWith("replicas:"));
    expect(replicasExp).toBeDefined();
    expect(replicasExp!.explanation).toMatch(/Number of pod copies/i);
  });
});

describe("ai-k8s lintManifests", () => {
  it("flags :latest image", () => {
    const r = generateAll(baseOpts({ image: "nginx:latest" }));
    expect(r.lint.some((i) => i.rule === "IMG002")).toBe(true);
  });
  it("passes clean manifests with no warnings", () => {
    const r = generateAll(baseOpts());
    // Clean image + all defaults: no errors/warnings (info may be present)
    const errorsAndWarnings = r.lint.filter((i) => i.level === "error" || i.level === "warning");
    expect(errorsAndWarnings).toHaveLength(0);
  });
  it("detects privileged: true", () => {
    const f = generateResource("pod", baseOpts());
    // Tamper with the YAML to inject privileged
    const tampered: typeof f = {
      ...f,
      yaml: f.yaml.replace("securityContext:", "privileged: true\n      securityContext:"),
    };
    const issues = lintManifests([tampered], baseOpts());
    expect(issues.some((i) => i.rule === "SEC001")).toBe(true);
  });
  it("detects hostNetwork: true", () => {
    const f = generateResource("pod", baseOpts());
    const tampered: typeof f = {
      ...f,
      yaml: f.yaml + "      hostNetwork: true\n",
    };
    const issues = lintManifests([tampered], baseOpts());
    expect(issues.some((i) => i.rule === "SEC002")).toBe(true);
  });
  it("warns on missing resources when not set", () => {
    // Manually craft a Deployment manifest without resources
    const f: import("./logic").ManifestFile = {
      type: "deployment",
      filename: "deployment",
      yaml: "---\napiVersion: apps/v1\nkind: Deployment\nmetadata:\n  name: x\nspec:\n  template:\n    spec:\n      containers:\n        - name: x\n          image: nginx:1.27\n",
      explanations: [],
    };
    const issues = lintManifests([f], baseOpts());
    expect(issues.some((i) => i.rule === "RES001")).toBe(true);
  });
});

describe("ai-k8s renderKustomize", () => {
  it("references each file by name", () => {
    const r = generateAll(baseOpts());
    const k = renderKustomize(r.files);
    expect(k).toContain("deployment.yaml");
    expect(k).toContain("service.yaml");
    expect(k).toContain("Kustomization");
  });
});

describe("ai-k8s renderHelmValues", () => {
  it("emits appName, image, replicaCount", () => {
    const v = renderHelmValues(baseOpts());
    expect(v).toContain("appName: api-gateway");
    expect(v).toContain("repository:");
    expect(v).toContain("replicaCount: 3");
  });
  it("splits image into repository and tag", () => {
    const v = renderHelmValues(baseOpts({ image: "nginx:1.27" }));
    expect(v).toContain("repository: nginx");
    expect(v).toContain("tag: \"1.27\"");
  });
});

describe("ai-k8s parseExistingYaml", () => {
  it("parses a single document", () => {
    const yaml = "---\napiVersion: v1\nkind: Service\nmetadata:\n  name: my-svc\n";
    const r = parseExistingYaml(yaml);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifests).toHaveLength(1);
      expect(r.manifests[0]!.kind).toBe("Service");
      expect(r.manifests[0]!.name).toBe("my-svc");
    }
  });
  it("parses multiple documents separated by ---", () => {
    const yaml = "---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: a\n---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: b\n";
    const r = parseExistingYaml(yaml);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.manifests).toHaveLength(2);
  });
  it("errors on empty input", () => {
    const r = parseExistingYaml("");
    expect(r.ok).toBe(false);
  });
  it("errors when no kind found", () => {
    const r = parseExistingYaml("---\nfoo: bar\n");
    expect(r.ok).toBe(false);
  });
});

describe("ai-k8s reSerializeManifests", () => {
  it("joins manifests back with ---", () => {
    const yaml = "---\napiVersion: v1\nkind: Pod\nmetadata:\n  name: a\n";
    const r = parseExistingYaml(yaml);
    expect(r.ok).toBe(true);
    if (r.ok) {
      const out = reSerializeManifests(r.manifests);
      expect(out).toContain("kind: Pod");
    }
  });
});

describe("ai-k8s history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({
      ts: 1,
      appName: "api-gateway",
      image: "nginx:1.27",
      port: 8080,
      replicas: 3,
      resources: ["deployment"],
      fileCount: 1,
    });
    expect(loadHistory()).toHaveLength(1);
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({
        ts: i,
        appName: `app-${i}`,
        image: "nginx:1.27",
        port: 8080,
        replicas: 1,
        resources: ["deployment"],
        fileCount: 1,
      });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears history", () => {
    saveHistory({
      ts: 1, appName: "x", image: "x:1", port: 80, replicas: 1,
      resources: ["pod"], fileCount: 1,
    });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("ai-k8s shareable URL", () => {
  it("builds share URL with all params", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl({
      appName: "api-gateway",
      image: "nginx:1.27",
      port: 8080,
      replicas: 3,
      namespace: "production",
      serviceType: "ClusterIP",
      ingressHost: "api.example.com",
      resources: ["deployment", "service"],
    });
    expect(url).toContain("app=api-gateway");
    expect(url).toContain("img=nginx");
    expect(url).toContain("p=8080");
    expect(url).toContain("r=3");
    expect(url).toContain("ns=production");
    expect(url).toContain("res=deployment%2Cservice");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("app=api-gateway&img=nginx%3A1.27&p=8080&r=3&ns=production&st=ClusterIP&host=api.example.com&res=deployment%2Cservice");
    expect(p.appName).toBe("api-gateway");
    expect(p.image).toBe("nginx:1.27");
    expect(p.port).toBe(8080);
    expect(p.replicas).toBe(3);
    expect(p.namespace).toBe("production");
    expect(p.serviceType).toBe("ClusterIP");
    expect(p.ingressHost).toBe("api.example.com");
    expect(p.resources).toEqual(["deployment", "service"]);
  });
  it("filters unknown resource types", () => {
    const p = parseShareUrl("res=deployment%2Cunknown-cat");
    expect(p.resources).toEqual(["deployment"]);
  });
  it("handles empty hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
});

describe("ai-k8s LLM prompt + result rendering", () => {
  it("builds a prompt referencing the app", () => {
    const prompt = buildLlmPrompt(baseOpts());
    expect(prompt).toContain("api-gateway");
    expect(prompt).toContain("ghcr.io/acme/api:1.2.3");
    expect(prompt.toLowerCase()).toContain("non-root");
  });
  it("parses a YAML response into manifests", () => {
    const response = [
      "```yaml",
      "---",
      "apiVersion: v1",
      "kind: Service",
      "metadata:",
      "  name: my-svc",
      "spec:",
      "  type: ClusterIP",
      "```",
    ].join("\n");
    const r = renderLlmResult(response);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.manifests).toHaveLength(1);
      expect(r.manifests[0]!.kind).toBe("Service");
    }
  });
  it("errors on empty response", () => {
    const r = renderLlmResult("");
    expect(r.ok).toBe(false);
  });
});

// Suppress unused-import lint for types re-exported above
export type _Unused = ResourceType;

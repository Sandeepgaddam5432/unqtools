/**
 * AI Kubernetes Manifest Generator — pure logic.
 *
 * Generate production-ready Kubernetes manifests for Deployment, Service,
 * Ingress, ConfigMap, Secret, Pod, Job, CronJob, and HPA from a small set
 * of app inputs. Includes resource limits, readiness/liveness probes, and
 * non-root securityContext defaults; a security linter; Kustomize/Helm
 * output; an import-to-edit flow; local history; and a shareable URL.
 *
 * Optional BYO-key LLM call lives in ui.tsx (touches network).
 *
 * Pure functions only — no DOM, no network.
 *
 * Honesty: templates are starting points. Always run
 * `kubectl apply --dry-run=server` and review manifests before deploying.
 * On-device templates are weaker than a BYO-key LLM for exotic CRDs.
 */

// ---------- Types ----------

export type ResourceType =
  | "deployment"
  | "service"
  | "ingress"
  | "configmap"
  | "secret"
  | "pod"
  | "job"
  | "cronjob"
  | "hpa";

export type ServiceType = "ClusterIP" | "NodePort" | "LoadBalancer";

export type ProbeType = "http" | "tcp" | "exec";

export type OutputFormat = "yaml" | "kustomize" | "helm";

export interface ProbeSpec {
  type: ProbeType;
  /** HTTP path (only used when type = "http"). */
  path?: string;
  /** TCP port (used for http and tcp). */
  port: number;
  /** Command (only used when type = "exec"). */
  command?: string[];
  initialDelaySeconds: number;
  periodSeconds: number;
  timeoutSeconds: number;
  failureThreshold: number;
}

export interface ResourceSpec {
  /** CPU request, e.g. "250m". */
  cpuRequest: string;
  /** Memory request, e.g. "256Mi". */
  memoryRequest: string;
  /** CPU limit, e.g. "500m". */
  cpuLimit: string;
  /** Memory limit, e.g. "512Mi". */
  memoryLimit: string;
}

export interface SecurityContextSpec {
  runAsNonRoot: boolean;
  runAsUser: number;
  runAsGroup: number;
  readOnlyRootFilesystem: boolean;
  allowPrivilegeEscalation: boolean;
  capabilitiesDropAll: boolean;
}

export interface BuildOptions {
  appName: string;
  image: string;
  tag?: string;
  port: number;
  replicas: number;
  namespace?: string;
  serviceType?: ServiceType;
  ingressHost?: string;
  ingressPath?: string;
  ingressTLS?: boolean;
  /** Resources to include. */
  resources: ResourceType[];
  /** ConfigMap key/values (only used when "configmap" in resources). */
  configMapData?: Record<string, string>;
  /** Secret key/values (only used when "secret" in resources). */
  secretData?: Record<string, string>;
  /** CronJob schedule (only used when "cronjob" in resources). */
  cronSchedule?: string;
  /** HPA max replicas (only used when "hpa" in resources). */
  hpaMaxReplicas?: number;
  /** HPA CPU target utilization percentage. */
  hpaCpuTarget?: number;
  /** Probe spec for readiness. */
  readinessProbe?: ProbeSpec;
  /** Probe spec for liveness. */
  livenessProbe?: ProbeSpec;
  /** Resource spec (requests + limits). */
  resourceSpec?: ResourceSpec;
  /** Security context spec. */
  securityContext?: SecurityContextSpec;
  /** Include env vars referencing ConfigMap/Secret when present. */
  envFromRefs?: boolean;
  /** Output format. */
  format?: OutputFormat;
}

export interface ManifestFile {
  /** Resource type. */
  type: ResourceType;
  /** Filename without extension, e.g. "deployment". */
  filename: string;
  /** YAML content. */
  yaml: string;
  /** Per-field explanations. */
  explanations: Explanation[];
}

export interface Explanation {
  /** YAML line text (trimmed). */
  line: string;
  /** Human-readable explanation. */
  explanation: string;
}

export interface LintIssue {
  level: "error" | "warning" | "info";
  rule: string;
  message: string;
  /** YAML line number (1-based, optional). */
  line?: number;
}

export interface GenerationResult {
  files: ManifestFile[];
  allInOne: string;
  lint: LintIssue[];
  kustomize?: string;
  helmValues?: string;
}

export interface HistoryEntry {
  ts: number;
  appName: string;
  image: string;
  port: number;
  replicas: number;
  resources: ResourceType[];
  fileCount: number;
}

export interface ShareState {
  appName: string;
  image: string;
  port: number;
  replicas: number;
  namespace: string;
  serviceType: ServiceType;
  ingressHost: string;
  resources: ResourceType[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-k8s-manifest-generator:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-k8s-manifest-generator:llm-key";

export const RESOURCE_TYPES: ResourceType[] = [
  "deployment", "service", "ingress", "configmap",
  "secret", "pod", "job", "cronjob", "hpa",
];

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  deployment: "Deployment",
  service: "Service",
  ingress: "Ingress",
  configmap: "ConfigMap",
  secret: "Secret",
  pod: "Pod",
  job: "Job",
  cronjob: "CronJob",
  hpa: "HorizontalPodAutoscaler",
};

export const SERVICE_TYPES: ServiceType[] = ["ClusterIP", "NodePort", "LoadBalancer"];

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  ClusterIP: "ClusterIP (internal)",
  NodePort: "NodePort (expose on node port)",
  LoadBalancer: "LoadBalancer (cloud LB)",
};

export const APP_NAME_PRESETS: string[] = [
  "api-gateway", "web-frontend", "worker", "scheduler",
  "auth-service", "billing-service", "notification-service",
];

export const IMAGE_PRESETS: string[] = [
  "nginx:1.27-alpine",
  "node:20-alpine",
  "python:3.12-slim",
  "redis:7-alpine",
  "postgres:16-alpine",
];

export const NAMESPACE_PRESETS: string[] = [
  "default", "production", "staging", "development",
  "kube-system", "monitoring",
];

export const DEFAULT_RESOURCES: ResourceSpec = {
  cpuRequest: "250m",
  memoryRequest: "256Mi",
  cpuLimit: "500m",
  memoryLimit: "512Mi",
};

export const DEFAULT_PROBES: ProbeSpec = {
  type: "http",
  path: "/healthz",
  port: 8080,
  initialDelaySeconds: 5,
  periodSeconds: 10,
  timeoutSeconds: 3,
  failureThreshold: 3,
};

export const DEFAULT_SECURITY_CONTEXT: SecurityContextSpec = {
  runAsNonRoot: true,
  runAsUser: 10001,
  runAsGroup: 10001,
  readOnlyRootFilesystem: true,
  allowPrivilegeEscalation: false,
  capabilitiesDropAll: true,
};

// ---------- Normalization ----------

/** Normalize app name (lowercase, kebab-case, DNS-1123 compliant). */
export function normalizeAppName(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9.-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "")
    .slice(0, 63);
}

/** Normalize container image: split image:tag, trim. */
export function normalizeImage(s: string): string {
  return (s || "").trim().replace(/\s+/g, "");
}

/** Normalize namespace (DNS-1123 label). */
export function normalizeNamespace(s: string): string {
  return (s || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/^[^a-z0-9]+/, "")
    .replace(/[^a-z0-9]+$/, "")
    .slice(0, 63);
}

/** Validate an image string; return issues (latest tag, missing tag). */
export function validateImage(image: string): LintIssue[] {
  const issues: LintIssue[] = [];
  if (!image) {
    issues.push({ level: "error", rule: "IMG001", message: "Image is required." });
    return issues;
  }
  // Strip registry host if present (anything before first / that contains . or :)
  const parts = image.split("/");
  const last = parts[parts.length - 1] ?? image;
  if (last.endsWith(":latest")) {
    issues.push({
      level: "warning",
      rule: "IMG002",
      message: `Image "${image}" uses :latest tag. Pin a specific version for reproducible deployments.`,
    });
  }
  // Tag detection: a colon after the last slash
  const tagMatch = last.match(/:([^:/]+)$/);
  if (!tagMatch) {
    issues.push({
      level: "warning",
      rule: "IMG003",
      message: `Image "${image}" has no explicit tag. Kubernetes defaults to :latest which is not reproducible.`,
    });
  }
  return issues;
}

/** Parse a port from string (1-65535). Returns null if invalid. */
export function parsePort(s: string | number): number | null {
  const n = typeof s === "number" ? s : parseInt(String(s), 10);
  if (!Number.isFinite(n) || n < 1 || n > 65535) return null;
  return n;
}

/** Validate a 5-field cron schedule. Returns the schedule or null. */
export function parseSchedule(s: string): string | null {
  const v = (s || "").trim();
  if (!v) return null;
  // Allow */N, digits, ranges, lists, and ?
  const fields = v.split(/\s+/);
  if (fields.length !== 5) return null;
  const ok = fields.every((f) => /^[\d*/,-?]+$/.test(f));
  return ok ? v : null;
}

/** Base64-encode a UTF-8 string. */
export function base64Encode(s: string): string {
  // Use Buffer when available (Node/test env); fall back to btoa.
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "utf-8").toString("base64");
  }
  if (typeof btoa === "function") {
    return btoa(unescape(encodeURIComponent(s)));
  }
  return s;
}

/** Base64-decode a UTF-8 string. */
export function base64Decode(s: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(s, "base64").toString("utf-8");
  }
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(s)));
  }
  return s;
}

// ---------- YAML emitter ----------

/**
 * Minimal YAML emitter for K8s manifests. Accepts a JS object tree whose
 * values are: string | number | boolean | null | array | object.
 *
 * Strings that look like numbers, booleans, contain special chars, or are
 * empty are quoted to avoid ambiguity. Lists use `- ` items. Nested maps
 * use 2-space indentation.
 */
export function emitYaml(value: unknown, indent = 0): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) return `${pad}null\n`;
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}[]\n`;
    let out = "";
    for (const item of value) {
      if (item !== null && typeof item === "object" && !Array.isArray(item)) {
        const obj = item as Record<string, unknown>;
        const keys = Object.keys(obj);
        if (keys.length === 0) {
          out += `${pad}- {}\n`;
        } else {
          // Emit the first key inline with `- `; remaining keys at indent+1
          const first = keys[0] as string;
          const firstVal = obj[first];
          out += emitListItem(first, firstVal, indent);
          for (const k of keys.slice(1)) {
            out += emitField(k, obj[k], indent + 1);
          }
        }
      } else {
        out += `${pad}- ${yamlScalar(item)}\n`;
      }
    }
    return out;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return `${pad}{}\n`;
    let out = "";
    for (const k of keys) {
      out += emitField(k, obj[k], indent);
    }
    return out;
  }
  return `${pad}${yamlScalar(value)}\n`;
}

function emitListItem(key: string, value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) {
    return `${pad}- ${key}: null\n`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}- ${key}: []\n`;
    return `${pad}- ${key}:\n${emitYaml(value, indent + 2)}`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return `${pad}- ${key}: {}\n`;
    return `${pad}- ${key}:\n${emitYaml(obj, indent + 2)}`;
  }
  return `${pad}- ${key}: ${yamlScalar(value)}\n`;
}

function emitField(key: string, value: unknown, indent: number): string {
  const pad = "  ".repeat(indent);
  if (value === null || value === undefined) {
    return `${pad}${key}: null\n`;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return `${pad}${key}: []\n`;
    return `${pad}${key}:\n${emitYaml(value, indent + 1)}`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 0) return `${pad}${key}: {}\n`;
    return `${pad}${key}:\n${emitYaml(obj, indent + 1)}`;
  }
  return `${pad}${key}: ${yamlScalar(value)}\n`;
}

function yamlScalar(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "null";
  const s = String(value);
  if (s === "") return '""';
  // Quote if: looks like number, looks like bool, has special chars, leading/trailing space, or is a known YAML reserved word
  if (/^-?\d+(\.\d+)?$/.test(s)) return JSON.stringify(s);
  if (s === "true" || s === "false" || s === "null" || s === "yes" || s === "no" || s === "~") {
    return JSON.stringify(s);
  }
  if (/[:#?,&*!|>'"%@`{}[\]]/.test(s) || /^\s|\s$/.test(s) || /\n/.test(s)) {
    return JSON.stringify(s);
  }
  return s;
}

// ---------- Per-resource generators ----------

/** Build a Deployment manifest object. */
export function buildDeployment(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const image = normalizeImage(opts.image) || "nginx:1.27-alpine";
  const port = opts.port || 8080;
  const replicas = Math.max(1, opts.replicas || 1);
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const resources = opts.resourceSpec ?? DEFAULT_RESOURCES;
  const sec = opts.securityContext ?? DEFAULT_SECURITY_CONTEXT;
  const readiness = opts.readinessProbe ?? { ...DEFAULT_PROBES, port };
  const liveness = opts.livenessProbe ?? { ...DEFAULT_PROBES, port };
  const labels = {
    app: appName,
    "app.kubernetes.io/name": appName,
    "app.kubernetes.io/managed-by": "unqtools",
  };
  const container: Record<string, unknown> = {
    name: appName,
    image,
    ports: [{ containerPort: port, name: "http", protocol: "TCP" }],
    resources: {
      requests: { cpu: resources.cpuRequest, memory: resources.memoryRequest },
      limits: { cpu: resources.cpuLimit, memory: resources.memoryLimit },
    },
    readinessProbe: buildProbe(readiness),
    livenessProbe: buildProbe(liveness),
    securityContext: buildSecurityContext(sec),
  };
  if (opts.envFromRefs) {
    const envFrom: Record<string, unknown>[] = [];
    if (opts.configMapData && Object.keys(opts.configMapData).length > 0) {
      envFrom.push({ configMapRef: { name: `${appName}-config` } });
    }
    if (opts.secretData && Object.keys(opts.secretData).length > 0) {
      envFrom.push({ secretRef: { name: `${appName}-secret` } });
    }
    if (envFrom.length > 0) (container as Record<string, unknown>).envFrom = envFrom;
  }
  return {
    apiVersion: "apps/v1",
    kind: "Deployment",
    metadata: {
      name: appName,
      namespace,
      labels,
    },
    spec: {
      replicas,
      selector: { matchLabels: { app: appName } },
      strategy: {
        type: "RollingUpdate",
        rollingUpdate: { maxSurge: 1, maxUnavailable: 0 },
      },
      template: {
        metadata: { labels },
        spec: {
          securityContext: {
            runAsNonRoot: sec.runAsNonRoot,
            runAsUser: sec.runAsUser,
            runAsGroup: sec.runAsGroup,
            fsGroup: sec.runAsGroup,
          },
          containers: [container],
        },
      },
    },
  };
}

function buildProbe(p: ProbeSpec): Record<string, unknown> {
  if (p.type === "http") {
    return {
      httpGet: { path: p.path || "/healthz", port: p.port },
      initialDelaySeconds: p.initialDelaySeconds,
      periodSeconds: p.periodSeconds,
      timeoutSeconds: p.timeoutSeconds,
      failureThreshold: p.failureThreshold,
    };
  }
  if (p.type === "tcp") {
    return {
      tcpSocket: { port: p.port },
      initialDelaySeconds: p.initialDelaySeconds,
      periodSeconds: p.periodSeconds,
      timeoutSeconds: p.timeoutSeconds,
      failureThreshold: p.failureThreshold,
    };
  }
  return {
    exec: { command: p.command ?? ["sh", "-c", "echo ok"] },
    initialDelaySeconds: p.initialDelaySeconds,
    periodSeconds: p.periodSeconds,
    timeoutSeconds: p.timeoutSeconds,
    failureThreshold: p.failureThreshold,
  };
}

function buildSecurityContext(sec: SecurityContextSpec): Record<string, unknown> {
  const ctx: Record<string, unknown> = {
    runAsNonRoot: sec.runAsNonRoot,
    allowPrivilegeEscalation: sec.allowPrivilegeEscalation,
  };
  if (sec.readOnlyRootFilesystem) ctx.readOnlyRootFilesystem = true;
  if (sec.capabilitiesDropAll) ctx.capabilities = { drop: ["ALL"] };
  return ctx;
}

/** Build a Service manifest object. */
export function buildService(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const port = opts.port || 8080;
  const serviceType = opts.serviceType ?? "ClusterIP";
  return {
    apiVersion: "v1",
    kind: "Service",
    metadata: {
      name: appName,
      namespace,
      labels: { app: appName, "app.kubernetes.io/name": appName },
    },
    spec: {
      type: serviceType,
      selector: { app: appName },
      ports: [
        {
          name: "http",
          port: 80,
          targetPort: port,
          protocol: "TCP",
          ...(serviceType === "NodePort" ? { nodePort: 30080 } : {}),
        },
      ],
    },
  };
}

/** Build an Ingress manifest object. */
export function buildIngress(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const host = (opts.ingressHost || `${appName}.example.com`).trim();
  const path = opts.ingressPath || "/";
  const tls = opts.ingressTLS ?? true;
  const spec: Record<string, unknown> = {
    ingressClassName: "nginx",
    rules: [
      {
        host,
        http: {
          paths: [
            { path, pathType: "Prefix", backend: { service: { name: appName, port: { number: 80 } } } },
          ],
        },
      },
    ],
  };
  if (tls) {
    spec.tls = [{ hosts: [host], secretName: `${appName}-tls` }];
  }
  return {
    apiVersion: "networking.k8s.io/v1",
    kind: "Ingress",
    metadata: {
      name: appName,
      namespace,
      labels: { app: appName, "app.kubernetes.io/name": appName },
      annotations: {
        "cert-manager.io/cluster-issuer": "letsencrypt-prod",
        "nginx.ingress.kubernetes.io/ssl-redirect": "true",
      },
    },
    spec,
  };
}

/** Build a ConfigMap manifest object. */
export function buildConfigMap(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const data = opts.configMapData && Object.keys(opts.configMapData).length > 0
    ? opts.configMapData
    : { LOG_LEVEL: "info", ENV: "production" };
  return {
    apiVersion: "v1",
    kind: "ConfigMap",
    metadata: {
      name: `${appName}-config`,
      namespace,
      labels: { app: appName, "app.kubernetes.io/name": appName },
    },
    data,
  };
}

/** Build a Secret manifest object (data is base64-encoded stubs). */
export function buildSecret(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const raw = opts.secretData && Object.keys(opts.secretData).length > 0
    ? opts.secretData
    : { API_KEY: "replace-me", DATABASE_URL: "postgres://user:pass@host:5432/db" };
  const data: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) data[k] = base64Encode(v);
  return {
    apiVersion: "v1",
    kind: "Secret",
    metadata: {
      name: `${appName}-secret`,
      namespace,
      labels: { app: appName, "app.kubernetes.io/name": appName },
    },
    type: "Opaque",
    data,
  };
}

/** Build a Pod manifest object (single-container, ad-hoc). */
export function buildPod(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const image = normalizeImage(opts.image) || "nginx:1.27-alpine";
  const port = opts.port || 8080;
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const sec = opts.securityContext ?? DEFAULT_SECURITY_CONTEXT;
  return {
    apiVersion: "v1",
    kind: "Pod",
    metadata: {
      name: `${appName}-pod`,
      namespace,
      labels: { app: appName, "app.kubernetes.io/name": appName },
    },
    spec: {
      restartPolicy: "Never",
      securityContext: {
        runAsNonRoot: sec.runAsNonRoot,
        runAsUser: sec.runAsUser,
        runAsGroup: sec.runAsGroup,
        fsGroup: sec.runAsGroup,
      },
      containers: [
        {
          name: appName,
          image,
          ports: [{ containerPort: port, name: "http", protocol: "TCP" }],
          securityContext: buildSecurityContext(sec),
        },
      ],
    },
  };
}

/** Build a Job manifest object. */
export function buildJob(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const image = normalizeImage(opts.image) || "busybox:1.36";
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const sec = opts.securityContext ?? DEFAULT_SECURITY_CONTEXT;
  return {
    apiVersion: "batch/v1",
    kind: "Job",
    metadata: {
      name: `${appName}-job`,
      namespace,
      labels: { app: appName, "app.kubernetes.io/name": appName },
    },
    spec: {
      backoffLimit: 3,
      ttlSecondsAfterFinished: 600,
      template: {
        metadata: { labels: { app: appName } },
        spec: {
          restartPolicy: "OnFailure",
          securityContext: {
            runAsNonRoot: sec.runAsNonRoot,
            runAsUser: sec.runAsUser,
            runAsGroup: sec.runAsGroup,
          },
          containers: [
            {
              name: appName,
              image,
              command: ["sh", "-c", "echo hello && exit 0"],
              securityContext: buildSecurityContext(sec),
            },
          ],
        },
      },
    },
  };
}

/** Build a CronJob manifest object. */
export function buildCronJob(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const image = normalizeImage(opts.image) || "busybox:1.36";
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const schedule = parseSchedule(opts.cronSchedule || "") || "0 */6 * * *";
  const sec = opts.securityContext ?? DEFAULT_SECURITY_CONTEXT;
  return {
    apiVersion: "batch/v1",
    kind: "CronJob",
    metadata: {
      name: `${appName}-cron`,
      namespace,
      labels: { app: appName, "app.kubernetes.io/name": appName },
    },
    spec: {
      schedule,
      concurrencyPolicy: "Forbid",
      successfulJobsHistoryLimit: 3,
      failedJobsHistoryLimit: 1,
      jobTemplate: {
        spec: {
          backoffLimit: 2,
          template: {
            metadata: { labels: { app: appName } },
            spec: {
              restartPolicy: "OnFailure",
              securityContext: {
                runAsNonRoot: sec.runAsNonRoot,
                runAsUser: sec.runAsUser,
                runAsGroup: sec.runAsGroup,
              },
              containers: [
                {
                  name: appName,
                  image,
                  command: ["sh", "-c", "echo running cron job && exit 0"],
                  securityContext: buildSecurityContext(sec),
                },
              ],
            },
          },
        },
      },
    },
  };
}

/** Build an HPA manifest object. */
export function buildHpa(opts: BuildOptions): Record<string, unknown> {
  const appName = normalizeAppName(opts.appName) || "app";
  const namespace = normalizeNamespace(opts.namespace || "") || "default";
  const min = Math.max(1, opts.replicas || 1);
  const max = Math.max(min, opts.hpaMaxReplicas ?? Math.max(min * 3, 5));
  const cpuTarget = Math.min(100, Math.max(1, opts.hpaCpuTarget ?? 70));
  return {
    apiVersion: "autoscaling/v2",
    kind: "HorizontalPodAutoscaler",
    metadata: {
      name: `${appName}-hpa`,
      namespace,
      labels: { app: appName, "app.kubernetes.io/name": appName },
    },
    spec: {
      scaleTargetRef: {
        apiVersion: "apps/v1",
        kind: "Deployment",
        name: appName,
      },
      minReplicas: min,
      maxReplicas: max,
      metrics: [
        {
          type: "Resource",
          resource: {
            name: "cpu",
            target: { type: "Utilization", averageUtilization: cpuTarget },
          },
        },
      ],
    },
  };
}

// ---------- Orchestration ----------

const RESOURCE_BUILDERS: Record<ResourceType, (o: BuildOptions) => Record<string, unknown>> = {
  deployment: buildDeployment,
  service: buildService,
  ingress: buildIngress,
  configmap: buildConfigMap,
  secret: buildSecret,
  pod: buildPod,
  job: buildJob,
  cronjob: buildCronJob,
  hpa: buildHpa,
};

const RESOURCE_FILENAMES: Record<ResourceType, string> = {
  deployment: "deployment",
  service: "service",
  ingress: "ingress",
  configmap: "configmap",
  secret: "secret",
  pod: "pod",
  job: "job",
  cronjob: "cronjob",
  hpa: "hpa",
};

/** Generate a single resource's YAML manifest. */
export function generateResource(type: ResourceType, opts: BuildOptions): ManifestFile {
  const builder = RESOURCE_BUILDERS[type];
  const obj = builder(opts);
  const yaml = emitDocument(obj);
  return {
    type,
    filename: RESOURCE_FILENAMES[type],
    yaml,
    explanations: explainManifest(obj),
  };
}

/** Generate all selected resources as separate files plus an all-in-one doc. */
export function generateAll(opts: BuildOptions): GenerationResult {
  const files: ManifestFile[] = (opts.resources || []).map((t) => generateResource(t, opts));
  const allInOne = files.map((f) => f.yaml).join("---\n");
  const lint = lintManifests(files, opts);
  const format = opts.format ?? "yaml";
  const kustomize = format === "kustomize" ? renderKustomize(files) : undefined;
  const helmValues = format === "helm" ? renderHelmValues(opts) : undefined;
  return { files, allInOne, lint, kustomize, helmValues };
}

/** Emit a single YAML document with leading `---` separator. */
export function emitDocument(obj: Record<string, unknown>): string {
  return `---\n${emitYaml(obj)}`;
}

// ---------- Per-field explanations ----------

const FIELD_EXPLANATIONS: Record<string, string> = {
  "apiVersion": "API version this resource uses. apps/v1 is the stable Deployment API.",
  "kind": "Resource type (Deployment, Service, etc.).",
  "metadata": "Identity metadata: name, namespace, labels.",
  "name": "Resource name — must be DNS-1123 compliant (lowercase, dashes).",
  "namespace": "Kubernetes namespace. 'default' is used when not specified.",
  "labels": "Key-value tags for selecting and grouping resources.",
  "spec": "Desired state of the resource.",
  "replicas": "Number of pod copies to run. At least 2 for availability.",
  "matchLabels": "Label selector — pods with these labels are managed by this Deployment.",
  "strategy": "Rollout strategy. RollingUpdate gives zero-downtime deploys.",
  "maxSurge": "Max extra pods created during rollout. 1 = one at a time.",
  "maxUnavailable": "Max pods that can be unavailable during rollout. 0 = never go below replicas.",
  "template": "Pod template — every pod is created from this spec.",
  "containers": "List of containers in the pod.",
  "image": "Container image:tag. Always pin a specific tag, never :latest.",
  "ports": "Container ports exposed.",
  "containerPort": "Port the container listens on.",
  "resources": "CPU/memory requests and limits. Prevents noisy-neighbor issues.",
  "requests": "Guaranteed minimum resources. Used for scheduling.",
  "limits": "Maximum resources. Pod is throttled or killed above this.",
  "cpu": "CPU units. 1000m = 1 CPU. 250m = 0.25 CPU.",
  "memory": "Memory units. Mi = mebibytes. 256Mi ≈ 268 MB.",
  "readinessProbe": "When this passes, the pod receives traffic. Use a health endpoint.",
  "livenessProbe": "When this fails, the pod is restarted. Use a separate liveliness endpoint.",
  "httpGet": "HTTP GET probe. 2xx/3xx = healthy.",
  "tcpSocket": "TCP connect probe. Successful connect = healthy.",
  "exec": "Exec probe. Exit 0 = healthy. Slower than http/tcp.",
  "initialDelaySeconds": "Wait this long before first probe. Set above app startup time.",
  "periodSeconds": "How often to probe.",
  "timeoutSeconds": "Probe timeout. Short = fast failure detection.",
  "failureThreshold": "Consecutive failures before pod is marked unhealthy/restarted.",
  "securityContext": "Pod/container security settings. Run non-root, drop capabilities.",
  "runAsNonRoot": "Kubelet refuses to start the container as UID 0.",
  "runAsUser": "Non-root UID to run as. 10001 avoids conflict with common system users.",
  "runAsGroup": "Primary GID for the container process.",
  "fsGroup": "GID that owns mounted volumes.",
  "readOnlyRootFilesystem": "Root filesystem is read-only. Mount tmpfs for writes.",
  "allowPrivilegeEscalation": "If false, the container cannot gain more privileges than its parent.",
  "capabilities": "Linux capabilities. drop: [ALL] removes all dangerous caps.",
  "type": "Service type (ClusterIP / NodePort / LoadBalancer) or Secret type (Opaque).",
  "selector": "Selects pods by label. Used by Deployment (match) and Service (route).",
  "targetPort": "Container port to forward traffic to.",
  "ingressClassName": "Which Ingress controller handles this Ingress.",
  "rules": "Host/path routing rules.",
  "host": "DNS name this Ingress responds to.",
  "path": "URL path prefix. '/' matches everything.",
  "pathType": "Prefix = prefix match, Exact = exact match.",
  "backend": "Where to send traffic: a Service by name + port.",
  "tls": "TLS certificates. Requires cert-manager or manual secrets.",
  "data": "ConfigMap key-value data (plaintext) or Secret base64-encoded data.",
  "schedule": "Cron schedule (5 fields: minute hour day month weekday).",
  "concurrencyPolicy": "Forbid = don't start a new job if one is already running.",
  "backoffLimit": "Max retries before the Job is marked failed.",
  "ttlSecondsAfterFinished": "Auto-delete finished Jobs after this many seconds.",
  "scaleTargetRef": "Which Deployment this HPA scales.",
  "minReplicas": "Minimum pod count the HPA will scale down to.",
  "maxReplicas": "Maximum pod count the HPA will scale up to.",
  "metrics": "Metrics the HPA watches to decide scaling.",
  "averageUtilization": "Target CPU utilization percentage. Scale up above, down below.",
};

/** Explain each line of a YAML manifest. */
export function explainManifest(obj: Record<string, unknown>): Explanation[] {
  const yaml = emitYaml(obj);
  const out: Explanation[] = [];
  for (const raw of yaml.split("\n")) {
    if (!raw.trim()) continue;
    const m = raw.match(/^\s*([A-Za-z][A-Za-z0-9_.-]*):/);
    if (!m) continue;
    const key = m[1] as string;
    const last = key.split(".").pop() ?? key;
    const explanation = FIELD_EXPLANATIONS[last] ?? FIELD_EXPLANATIONS[key];
    if (explanation) {
      out.push({ line: raw.trim(), explanation });
    }
  }
  return out;
}

// ---------- Security lint ----------

/** Lint generated manifests for security issues. */
export function lintManifests(files: ManifestFile[], opts: BuildOptions): LintIssue[] {
  const issues: LintIssue[] = [];
  // Image checks
  issues.push(...validateImage(opts.image));
  // Per-file checks
  for (const f of files) {
    const lines = f.yaml.split("\n");
    lines.forEach((line, i) => {
      const trimmed = line.trim();
      if (trimmed.includes("privileged: true")) {
        issues.push({
          level: "error",
          rule: "SEC001",
          message: "Privileged container detected. This bypasses most isolation.",
          line: i + 1,
        });
      }
      if (trimmed.includes("hostNetwork: true")) {
        issues.push({
          level: "warning",
          rule: "SEC002",
          message: "hostNetwork: true gives the pod the node's network. Avoid unless required.",
          line: i + 1,
        });
      }
      if (trimmed.includes("hostPID: true")) {
        issues.push({
          level: "warning",
          rule: "SEC003",
          message: "hostPID: true lets the pod see node processes. Avoid unless required.",
          line: i + 1,
        });
      }
      if (trimmed.includes("hostPath:")) {
        issues.push({
          level: "warning",
          rule: "SEC004",
          message: "hostPath mounts a node filesystem path. Use a PersistentVolume instead.",
          line: i + 1,
        });
      }
      if (trimmed.includes("runAsNonRoot: false")) {
        issues.push({
          level: "warning",
          rule: "SEC005",
          message: "runAsNonRoot: false allows root. Set to true and pick a non-zero UID.",
          line: i + 1,
        });
      }
    });
    // Resource-level checks
    if (f.type === "deployment" || f.type === "pod" || f.type === "job" || f.type === "cronjob") {
      if (!f.yaml.includes("resources:")) {
        issues.push({
          level: "warning",
          rule: "RES001",
          message: `${f.type}: missing resources requests/limits. The pod can starve neighbors or be OOM-killed.`,
        });
      }
      if (!f.yaml.includes("livenessProbe:") && (f.type === "deployment" || f.type === "pod")) {
        issues.push({
          level: "info",
          rule: "PRB001",
          message: `${f.type}: no livenessProbe. Kubelet won't auto-restart hung processes.`,
        });
      }
      if (!f.yaml.includes("readinessProbe:") && f.type === "deployment") {
        issues.push({
          level: "info",
          rule: "PRB002",
          message: `${f.type}: no readinessProbe. Traffic may hit pods that aren't ready.`,
        });
      }
      if (!f.yaml.includes("securityContext:")) {
        issues.push({
          level: "warning",
          rule: "SEC006",
          message: `${f.type}: no securityContext. Add non-root + capabilities drop.`,
        });
      }
    }
  }
  return issues;
}

// ---------- Kustomize / Helm output ----------

/** Render a kustomization.yaml referencing the given files. */
export function renderKustomize(files: ManifestFile[]): string {
  const resources = files
    .filter((f) => f.type !== "hpa") // HPA is a separate concern
    .map((f) => `${f.filename}.yaml`)
    .sort();
  const obj = {
    apiVersion: "kustomize.config.k8s.io/v1beta1",
    kind: "Kustomization",
    commonLabels: {
      "app.kubernetes.io/managed-by": "kustomize",
    },
    resources,
  };
  return `---\n${emitYaml(obj)}`;
}

/** Render a Helm values.yaml for the given options. */
export function renderHelmValues(opts: BuildOptions): string {
  const appName = normalizeAppName(opts.appName) || "app";
  const obj = {
    appName,
    image: {
      repository: normalizeImage(opts.image).split(":")[0] || "nginx",
      tag: normalizeImage(opts.image).split(":")[1] || "stable",
      pullPolicy: "IfNotPresent",
    },
    replicaCount: Math.max(1, opts.replicas || 1),
    service: {
      type: opts.serviceType ?? "ClusterIP",
      port: 80,
    },
    ingress: {
      enabled: opts.resources.includes("ingress"),
      host: opts.ingressHost || `${appName}.example.com`,
      tls: opts.ingressTLS ?? true,
    },
    resources: {
      requests: { cpu: DEFAULT_RESOURCES.cpuRequest, memory: DEFAULT_RESOURCES.memoryRequest },
      limits: { cpu: DEFAULT_RESOURCES.cpuLimit, memory: DEFAULT_RESOURCES.memoryLimit },
    },
    autoscaling: {
      enabled: opts.resources.includes("hpa"),
      minReplicas: Math.max(1, opts.replicas || 1),
      maxReplicas: opts.hpaMaxReplicas ?? 5,
      targetCPUUtilizationPercentage: opts.hpaCpuTarget ?? 70,
    },
    namespace: normalizeNamespace(opts.namespace || "") || "default",
  };
  return `---\n${emitYaml(obj)}`;
}

// ---------- Import-to-edit (parse existing YAML) ----------

/**
 * Parse existing YAML for import-to-edit. This is a tolerant line-based
 * parser sufficient for the manifests we emit. Returns the detected
 * resources and any parse errors.
 */
export interface ParsedManifest {
  kind: string;
  name: string;
  apiVersion: string;
  /** Raw YAML text of this document. */
  raw: string;
}

export function parseExistingYaml(text: string): { ok: true; manifests: ParsedManifest[] } | { ok: false; error: string } {
  if (!text || !text.trim()) {
    return { ok: false, error: "No YAML provided." };
  }
  // Split on `---` at column 0
  const docs = text.split(/^---\s*$/m).map((d) => d.trim()).filter(Boolean);
  if (docs.length === 0) {
    return { ok: false, error: "No YAML documents found." };
  }
  const out: ParsedManifest[] = [];
  for (const doc of docs) {
    let apiVersion = "";
    let kind = "";
    let name = "";
    for (const line of doc.split("\n")) {
      const m = line.match(/^apiVersion:\s*(\S+)/);
      if (m) apiVersion = m[1] as string;
      const k = line.match(/^kind:\s*(\S+)/);
      if (k) kind = k[1] as string;
      // Look for name under metadata (indent-sensitive)
      const n = line.match(/^\s{2}name:\s*(\S+)/);
      if (n && !name) name = n[1] as string;
      if (apiVersion && kind && name) break;
    }
    if (kind) {
      out.push({ kind, name, apiVersion, raw: `---\n${doc}\n` });
    }
  }
  if (out.length === 0) {
    return { ok: false, error: "No Kubernetes resources found. Each document needs apiVersion + kind." };
  }
  return { ok: true, manifests: out };
}

/** Re-serialize parsed manifests back to a single YAML stream. */
export function reSerializeManifests(manifests: ParsedManifest[]): string {
  return manifests.map((m) => m.raw).join("---\n");
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
  if (state.appName) params.set("app", state.appName);
  if (state.image) params.set("img", state.image);
  if (state.port) params.set("p", String(state.port));
  if (state.replicas) params.set("r", String(state.replicas));
  if (state.namespace) params.set("ns", state.namespace);
  if (state.serviceType) params.set("st", state.serviceType);
  if (state.ingressHost) params.set("host", state.ingressHost);
  if (state.resources.length > 0) params.set("res", state.resources.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ShareState> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ShareState> = {};
  const app = params.get("app");
  if (app) out.appName = app;
  const img = params.get("img");
  if (img) out.image = img;
  const p = params.get("p");
  if (p) {
    const n = parsePort(p);
    if (n) out.port = n;
  }
  const r = params.get("r");
  if (r) {
    const n = parseInt(r, 10);
    if (Number.isFinite(n) && n > 0) out.replicas = n;
  }
  const ns = params.get("ns");
  if (ns) out.namespace = ns;
  const st = params.get("st") as ServiceType | null;
  if (st && SERVICE_TYPES.includes(st)) out.serviceType = st;
  const host = params.get("host");
  if (host) out.ingressHost = host;
  const res = params.get("res");
  if (res) {
    const valid = RESOURCE_TYPES;
    out.resources = res
      .split(",")
      .filter((t) => valid.includes(t as ResourceType)) as ResourceType[];
  }
  return out;
}

// ---------- LLM prompt builder (optional BYO-key enhancement) ----------

export function buildLlmPrompt(opts: BuildOptions): string {
  const appName = normalizeAppName(opts.appName) || "app";
  const image = normalizeImage(opts.image) || "nginx:1.27-alpine";
  return [
    "You are a Kubernetes expert who generates production-ready manifests.",
    `App name: ${appName}.`,
    `Container image: ${image}.`,
    `Port: ${opts.port}.`,
    `Replicas: ${opts.replicas}.`,
    `Namespace: ${opts.namespace || "default"}.`,
    `Resources to generate: ${(opts.resources || []).join(", ")}.`,
    "",
    "Hard constraints:",
    "- Every Deployment and Pod MUST run as a non-root user (runAsNonRoot: true, runAsUser: 10001).",
    "- Every container MUST have resource requests and limits.",
    "- Every Deployment MUST have readinessProbe and livenessProbe.",
    "- Pin the image tag — never use :latest.",
    "- Drop ALL Linux capabilities and set readOnlyRootFilesystem where possible.",
    "",
    "For each resource, output a YAML document separated by `---`.",
    "Output ONLY YAML — no markdown fences, no commentary.",
  ].join("\n");
}

export interface LlmManifest {
  kind: string;
  name: string;
  yaml: string;
}

export function renderLlmResult(rawText: string):
  | { ok: true; manifests: LlmManifest[] }
  | { ok: false; error: string } {
  const text = (rawText || "").trim();
  if (!text) return { ok: false, error: "Empty LLM response." };
  // Strip markdown fences if present
  const cleaned = text.replace(/^```(?:ya?ml)?\s*/i, "").replace(/\s*```$/, "").trim();
  const parsed = parseExistingYaml(cleaned);
  if (!parsed.ok) return parsed;
  const manifests: LlmManifest[] = parsed.manifests.map((m) => ({
    kind: m.kind,
    name: m.name,
    yaml: m.raw,
  }));
  if (manifests.length === 0) {
    return { ok: false, error: "LLM output contained no Kubernetes resources." };
  }
  return { ok: true, manifests };
}

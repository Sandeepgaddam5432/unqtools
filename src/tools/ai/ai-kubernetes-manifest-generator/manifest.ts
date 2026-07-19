import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ai-kubernetes-manifest-generator",
  name: "AI Kubernetes Manifest Generator — Secure Deployment YAML",
  description:
    "Describe your app (name, image, port, replicas) and get production-ready Kubernetes manifests: Deployment, Service, Ingress, ConfigMap, Secret, Pod, Job, CronJob, and HPA — with resource limits, readiness/liveness probes, and non-root securityContext baked in. Per-field explanations, security lint (privileged, latest tag, missing limits), YAML validation, Kustomize/Helm output, import-to-edit, history (last 20), shareable URL, and optional BYO-key LLM polish. 100% client-side — nothing uploaded.",
  category: "ai",
  keywords: [
    "kubernetes manifest generator", "k8s yaml generator", "k8syaml alternative",
    "deployment service ingress generator", "kubectl yaml generator",
    "no login k8s generator", "private kubernetes yaml", "helm values generator",
    "kustomize generator", "hpa generator", "k8s security context",
  ],
  icon: "ship",
  requiresNetwork: false,
  seo: {
    title: "AI Kubernetes Manifest Generator — Secure Deployment YAML, Private | UnQTools",
    faq: [
      {
        q: "How does the Kubernetes Manifest Generator work?",
        a: "Enter your app name, container image, port, replica count, and namespace. The generator emits production-ready YAML for the resources you pick — Deployment, Service, Ingress, ConfigMap, Secret, Pod, Job, CronJob, and HPA — each with resource limits, readiness/liveness probes, and a non-root securityContext baked in. Every field has a tooltip-style explanation, and the security linter flags :latest tags, privileged containers, missing limits, and missing probes so you can harden before applying.",
      },
      {
        q: "Which Kubernetes resources are supported?",
        a: "Eight first-class resource templates: Deployment (with rolling update strategy, resource requests/limits, liveness/readiness probes, non-root securityContext, and env from ConfigMap/Secret), Service (ClusterIP / NodePort / LoadBalancer), Ingress (with host, path, and TLS), ConfigMap (key-value data), Secret (base64 stub data), Pod (single-container for ad-hoc jobs), Job (with backoffLimit and ttlSecondsAfterFinished), CronJob (with schedule and concurrencyPolicy), and HPA (with min/max replicas and CPU/memory targets). All are generated from the same app inputs for consistency.",
      },
      {
        q: "What security defaults are baked into the generated manifests?",
        a: "Every Deployment and Pod runs as a non-root user with runAsNonRoot: true, readOnlyRootFilesystem where possible, allowPrivilegeEscalation: false, and dropped ALL capabilities. Resource requests and limits are populated with sensible defaults (250m CPU / 256Mi request, 500m / 512Mi limit). Readiness and liveness probes use HTTP GET or TCP socket against your port. The linter then flags any remaining issues: :latest tag, privileged: true, missing limits, missing probes, missing securityContext, and insecure image registries.",
      },
      {
        q: "Can I generate Kustomize or Helm output instead of plain YAML?",
        a: "Yes. Toggle Kustomize output to get a kustomization.yaml referencing your resources, or Helm output to get a values.yaml + templated manifests with {{ .Values.appName }} placeholders. You can also import existing YAML to lint and re-serialize, and download each resource as its own file or as a single all-in-one YAML document.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Eight resource templates (Deployment, Service, Ingress, ConfigMap, Secret, Pod, Job, CronJob, HPA). (2) App-name + image + port + replicas input. (3) Resource limits + probes + non-root securityContext defaults. (4) Per-field explanation tooltips. (5) Security lint (12+ rules: latest tag, privileged, missing limits, missing probes, missing securityContext, hostNetwork, hostPID, hostPath, etc.). (6) YAML validation (parse + re-serialize). (7) Kustomize output (kustomization.yaml). (8) Helm output (values.yaml + templated manifests). (9) Import-to-edit (paste YAML, lint + re-serialize). (10) Download per-resource or all-in-one. (11) Local history (last 20). (12) Shareable URL with options encoded. (13) Copy to clipboard. (14) Optional BYO-key LLM polish (OpenAI/Anthropic). (15) Honesty disclaimers (always kubectl apply --dry-run and review; on-device templates are weaker than BYO-key for exotic CRDs).",
      },
    ],
  },
  status: "done",
};

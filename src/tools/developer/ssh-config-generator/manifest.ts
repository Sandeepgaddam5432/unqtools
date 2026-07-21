/**
 * SSH Config Generator — Tool Manifest.
 * Tool #338 — Category 4 (Developer & Code).
 *
 * Visually build `~/.ssh/config` host entries — HostName, User, Port,
 * IdentityFile, ProxyJump, ForwardAgent, ServerAlive, port forwarding,
 * wildcards, Match blocks, and Include directives — from templates
 * (basic server, jump host, GitHub, AWS EC2, wildcard). Includes a
 * security linter, ed25519 keygen helper, import of existing config,
 * and bulk-add via JSON. 100% client-side — never handles private keys.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "ssh-config-generator",
  name: "SSH Config Generator",
  description:
    "Visually build ~/.ssh/config host entries — HostName, User, Port, IdentityFile, IdentitiesOnly, ProxyJump/bastion, ForwardAgent, ServerAlive, Compression, LocalForward/RemoteForward/DynamicForward, StrictHostKeyChecking, Match blocks, and Include directives. Templates (basic server, jump host, GitHub, AWS EC2, wildcard), security linter (warns on StrictHostKeyChecking no / broad ForwardAgent), ed25519 keygen helper per host, import existing config, bulk-add via JSON, first-match-wins reordering, history (localStorage), and shareable URL. 100% client-side — never handles private keys. No ads.",
  category: "developer",
  keywords: [
    "ssh config", "ssh config generator", "~/.ssh/config",
    "ssh proxyjump", "ssh bastion", "ssh config github",
    "ssh config aws ec2", "ssh port forwarding", "ssh identityfile",
    "ssh config example", "ssh config template", "ssh jump host",
  ],
  icon: "server",
  requiresNetwork: false,
  seo: {
    title: "SSH Config Generator — ~/.ssh/config Templates + ProxyJump + Linter | UnQTools",
    faq: [
      {
        q: "How does the SSH Config Generator work?",
        a: "Add Host entries with a visual form (alias, HostName, User, Port, IdentityFile, IdentitiesOnly, ProxyJump, ForwardAgent, ServerAlive, Compression, port forwards, StrictHostKeyChecking, etc.) and the tool emits a clean `~/.ssh/config` you can paste or download. Start from a template (basic server, jump host, GitHub, AWS EC2, wildcard) and customize. Each host gets a `# ssh <alias>` connect-hint comment so you remember the command.",
      },
      {
        q: "What is ProxyJump and how do I configure a bastion host?",
        a: "ProxyJump (`-J`) chains an SSH connection through one or more intermediate hosts. Set `ProxyJump bastion` on your internal-host entry and SSH will first connect to `bastion`, then tunnel to the target — no manual double-hop needed. For chains use commas: `ProxyJump hop1,hop2`. This tool generates a dedicated `jump-host` template and lets you set ProxyJump per entry.",
      },
      {
        q: "What does the security linter warn about?",
        a: "The linter flags (1) `StrictHostKeyChecking no` (susceptible to MITM), (2) `ForwardAgent yes` on broad Host patterns (agent-key exfiltration risk if the bastion is compromised), (3) missing `IdentitiesOnly yes` when an `IdentityFile` is set (avoids offering all your keys), (4) missing `chmod 600` reminder for any new IdentityFile path, and (5) `Host *` blocks with overly-permissive options. Each warning links to the offending host.",
      },
      {
        q: "Can I import my existing ~/.ssh/config?",
        a: "Yes. Paste your current `~/.ssh/config` and the parser extracts every `Host` block (with all standard options, plus `LocalForward`/`RemoteForward`/`DynamicForward`), `Match` blocks (preserved as raw text), and `Include` directives. Imported hosts are then editable in the visual editor and re-emitted in a consistent style.",
      },
      {
        q: "What extra features does this tool have versus hand-editing?",
        a: "(1) Five templates (basic server, jump host, GitHub, AWS EC2, wildcard). (2) Full option coverage including ProxyJump, ForwardAgent, ServerAlive, port forwards (Local/Remote/Dynamic), StrictHostKeyChecking, ControlMaster/Path/Persist. (3) Match blocks and Include directives. (4) Security linter with five rule classes. (5) ed25519 keygen command helper per host. (6) Import existing config. (7) Bulk-add via JSON. (8) First-match-wins reordering (specific hosts before wildcards). (9) Per-host connect-hint comments. (10) Dedupe by Host alias. (11) Live config preview with copy/download. (12) History (localStorage, last 20). (13) Shareable URL (non-sensitive fields only). 100% client-side — your private keys are never touched. No ads.",
      },
    ],
  },
  status: "done",
};

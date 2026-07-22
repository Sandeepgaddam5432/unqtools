/**
 * Well-Known / Common Ports Reference — Tool Manifest.
 * Tool #395 — Category 4 (Developer & Code).
 *
 * Per blueprint: Well-known common ports reference. Pure-JS: 100+ common
 * ports (HTTP 80, HTTPS 443, SSH 22, FTP 21, SMTP 25, DNS 53, etc.).
 * Searchable by port number, service name, or protocol. Show protocol,
 * description, security notes. 100% client-side — the entire port/service
 * database is bundled and runs offline.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "well-known-common-ports-reference",
  name: "Well-Known / Common Ports Reference",
  description:
    "Instant, offline-searchable reference of 100+ common TCP/UDP ports and their services (HTTP 80, HTTPS 443, SSH 22, FTP 21, SMTP 25, DNS 53, RDP 3389, MySQL 3306, PostgreSQL 5432, Redis 6379, MongoDB 27017, …). Two-way search by port number or service name, TCP/UDP/both filter, well-known (0–1023) / registered (1024–49151) / dynamic (49152–65535) grouping, category tags (web, mail, db, remote, file-transfer, …), security notes for risky ports (Telnet 23, RDP 3389, SMB 445), encrypted-alternative hints (FTP → FTPS, HTTP → HTTPS, Telnet → SSH), range view, and copy/export a custom cheat sheet. 100% client-side — the IANA/Wikipedia-derived dataset is bundled and runs entirely offline.",
  category: "developer",
  keywords: [
    "common ports", "well known ports", "tcp ports", "udp ports",
    "port number lookup", "what port does", "iana port registry",
    "tcp udp reference", "service port", "ssh port 22", "http port 80",
    "https port 443", "smtp port 25", "dns port 53", "rdp port 3389",
    "mysql port 3306", "redis port 6379", "mongodb port 27017",
    "ftp port 21", "telnet port 23", "snmp port 161",
  ],
  icon: "network",
  requiresNetwork: false,
  seo: {
    title: "Well-Known & Common Ports Reference — TCP/UDP Lookup (100+ Ports) | UnQTools",
    faq: [
      {
        q: "How do I look up a port?",
        a: "Type either the port number (e.g. 443) or the service name (e.g. https) into the search box. The tool filters instantly in both directions — port → service and service → port. You can also narrow by protocol (TCP, UDP, or both) and by category (web, mail, database, remote, file-transfer, name-resolution, security, messaging, network, media). The dataset covers well-known (0–1023), registered (1024–49151), and common dynamic ports (49152–65535).",
      },
      {
        q: "What's in the dataset and where does it come from?",
        a: "100+ ports derived from the IANA Service Name & Port Registry and the Wikipedia TCP/UDP port list, curated to the ports you actually encounter in ops and security work. Each entry includes the canonical service name, alternate aliases, a short description, the protocol (TCP/UDP/both), the IANA range (well-known / registered / dynamic), a category tag, an encryption flag (with the encrypted alternative when one exists — e.g. Telnet → SSH, FTP → FTPS, HTTP → HTTPS), a security note for risky ports, and a 'commonly exploited' flag for ports that show up frequently in attack traffic (SMB 445, RDP 3389, Telnet 23, …). The dataset's source and snapshot date are shown in the UI.",
      },
      {
        q: "Can I filter by risk or by encrypted protocols?",
        a: "Yes. Click the 'commonly exploited' chip to surface ports that attackers target most (23 Telnet, 445 SMB, 3389 RDP, 1433 MSSQL, …) with security advice for each. Toggle the 'encrypted only' chip to see only ports that speak TLS or another encryption layer (443 HTTPS, 993 IMAPS, 636 LDAPS, 990 FTPS, 22 SSH, …). Each non-encrypted entry shows its encrypted alternative inline.",
      },
      {
        q: "Can I view a range of ports?",
        a: "Yes. The 'range view' lets you enter a start and end port (e.g. 8000–9000) and the tool lists every port in that range from the bundled dataset. This is useful when you're scoping a firewall change or inventorying a network for the first time.",
      },
      {
        q: "Is the dataset sent anywhere? Can I export a cheat sheet?",
        a: "No — the entire port/service database is bundled with the page and runs 100% client-side. No lookup leaves your device. You can copy any individual row to the clipboard, or export the current filtered view as plain text, Markdown, or CSV for your own cheat sheet. The dataset's source (IANA + Wikipedia) and snapshot date are shown in the UI so you know how current it is.",
      },
    ],
  },
  status: "done",
};

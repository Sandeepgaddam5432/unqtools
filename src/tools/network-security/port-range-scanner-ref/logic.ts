/**
 * Port Range Scanner Reference — pure logic.
 * Reference table of well-known ports (RFC 1700 / IANA). No network access.
 */

export interface PortInfo {
  port: number;
  protocol: "tcp" | "udp" | "both";
  service: string;
  description: string;
  encrypted: boolean;
}

const PORTS: readonly PortInfo[] = [
  { port: 20, protocol: "tcp", service: "FTP-DATA", description: "File Transfer Protocol (data channel)", encrypted: false },
  { port: 21, protocol: "tcp", service: "FTP", description: "File Transfer Protocol (control)", encrypted: false },
  { port: 22, protocol: "tcp", service: "SSH", description: "Secure Shell", encrypted: true },
  { port: 23, protocol: "tcp", service: "Telnet", description: "Telnet (unencrypted remote login)", encrypted: false },
  { port: 25, protocol: "tcp", service: "SMTP", description: "Simple Mail Transfer Protocol", encrypted: false },
  { port: 53, protocol: "both", service: "DNS", description: "Domain Name System", encrypted: false },
  { port: 80, protocol: "tcp", service: "HTTP", description: "Hypertext Transfer Protocol", encrypted: false },
  { port: 110, protocol: "tcp", service: "POP3", description: "Post Office Protocol v3", encrypted: false },
  { port: 123, protocol: "udp", service: "NTP", description: "Network Time Protocol", encrypted: false },
  { port: 143, protocol: "tcp", service: "IMAP", description: "Internet Message Access Protocol", encrypted: false },
  { port: 161, protocol: "udp", service: "SNMP", description: "Simple Network Management Protocol", encrypted: false },
  { port: 162, protocol: "udp", service: "SNMP-TRAP", description: "SNMP Trap", encrypted: false },
  { port: 389, protocol: "tcp", service: "LDAP", description: "Lightweight Directory Access Protocol", encrypted: false },
  { port: 443, protocol: "tcp", service: "HTTPS", description: "HTTP over TLS/SSL", encrypted: true },
  { port: 465, protocol: "tcp", service: "SMTPS", description: "SMTP over SSL", encrypted: true },
  { port: 587, protocol: "tcp", service: "SMTP-SUBMISSION", description: "Mail submission (modern SMTP)", encrypted: true },
  { port: 636, protocol: "tcp", service: "LDAPS", description: "LDAP over SSL", encrypted: true },
  { port: 993, protocol: "tcp", service: "IMAPS", description: "IMAP over SSL", encrypted: true },
  { port: 995, protocol: "tcp", service: "POP3S", description: "POP3 over SSL", encrypted: true },
  { port: 3306, protocol: "tcp", service: "MySQL", description: "MySQL database server", encrypted: false },
];

export const ALL_PORTS: readonly PortInfo[] = PORTS;

export function getAllPorts(): PortInfo[] {
  return [...PORTS];
}

export function lookupByPort(port: number): PortInfo | null {
  if (!Number.isInteger(port) || port < 0 || port > 65535) return null;
  return PORTS.find((p) => p.port === port) ?? null;
}

export function lookupByService(name: string): PortInfo[] {
  const q = name.trim().toLowerCase();
  if (!q) return [];
  return PORTS.filter((p) => p.service.toLowerCase().includes(q));
}

export function searchPorts(query: string): PortInfo[] {
  const q = query.trim().toLowerCase();
  if (!q) return [...PORTS];
  return PORTS.filter((p) =>
    p.service.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    String(p.port) === q ||
    p.protocol.includes(q)
  );
}

export function filterByProtocol(protocol: "tcp" | "udp"): PortInfo[] {
  return PORTS.filter((p) => p.protocol === protocol || p.protocol === "both");
}

export function filterEncrypted(encrypted: boolean): PortInfo[] {
  return PORTS.filter((p) => p.encrypted === encrypted);
}

export interface PortRange {
  range: string;
  category: string;
  description: string;
}

export const PORT_RANGES: readonly PortRange[] = [
  { range: "0-1023", category: "Well-known", description: "System ports assigned by IANA." },
  { range: "1024-49151", category: "Registered", description: "User ports, registered with IANA." },
  { range: "49152-65535", category: "Dynamic/Private", description: "Ephemeral ports for outbound connections." },
];

export function classifyPort(port: number): PortRange | null {
  if (!Number.isInteger(port) || port < 0 || port > 65535) return null;
  for (const r of PORT_RANGES) {
    const [lo, hi] = r.range.split("-").map(Number);
    if (port >= lo && port <= hi) return r;
  }
  return null;
}

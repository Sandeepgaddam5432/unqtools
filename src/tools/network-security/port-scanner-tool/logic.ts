/**
 * Port Scanner — pure logic (reference tool, no actual network scanning).
 * Provides port reference database, nmap command generation, and port info.
 */

export interface PortInfo {
  port: number;
  protocol: "tcp" | "udp" | "both";
  service: string;
  description: string;
  isWellKnown: boolean;
  isRegistered: boolean;
  isDynamic: boolean;
}

export interface ScanConfig {
  target: string;
  ports: number[];
  scanType: "connect" | "syn" | "udp" | "fin" | "xmas";
  timeout: number;
}

const PORT_DB: PortInfo[] = [
  { port: 20, protocol: "tcp", service: "FTP-DATA", description: "File Transfer Protocol (data)", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 21, protocol: "tcp", service: "FTP", description: "File Transfer Protocol (control)", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 22, protocol: "tcp", service: "SSH", description: "Secure Shell", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 23, protocol: "tcp", service: "Telnet", description: "Telnet (insecure)", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 25, protocol: "tcp", service: "SMTP", description: "Simple Mail Transfer Protocol", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 53, protocol: "both", service: "DNS", description: "Domain Name System", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 80, protocol: "tcp", service: "HTTP", description: "HyperText Transfer Protocol", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 110, protocol: "tcp", service: "POP3", description: "Post Office Protocol v3", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 143, protocol: "tcp", service: "IMAP", description: "Internet Message Access Protocol", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 443, protocol: "tcp", service: "HTTPS", description: "HTTP Secure (TLS/SSL)", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 445, protocol: "tcp", service: "SMB", description: "Server Message Block (file sharing)", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 993, protocol: "tcp", service: "IMAPS", description: "IMAP over SSL", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 995, protocol: "tcp", service: "POP3S", description: "POP3 over SSL", isWellKnown: true, isRegistered: false, isDynamic: false },
  { port: 1433, protocol: "tcp", service: "MSSQL", description: "Microsoft SQL Server", isWellKnown: false, isRegistered: true, isDynamic: false },
  { port: 3306, protocol: "tcp", service: "MySQL", description: "MySQL Database", isWellKnown: false, isRegistered: true, isDynamic: false },
  { port: 3389, protocol: "tcp", service: "RDP", description: "Remote Desktop Protocol", isWellKnown: false, isRegistered: true, isDynamic: false },
  { port: 5432, protocol: "tcp", service: "PostgreSQL", description: "PostgreSQL Database", isWellKnown: false, isRegistered: true, isDynamic: false },
  { port: 5900, protocol: "tcp", service: "VNC", description: "Virtual Network Computing", isWellKnown: false, isRegistered: true, isDynamic: false },
  { port: 6379, protocol: "tcp", service: "Redis", description: "Redis key-value store", isWellKnown: false, isRegistered: true, isDynamic: false },
  { port: 8080, protocol: "tcp", service: "HTTP-ALT", description: "HTTP Alternate (common proxy)", isWellKnown: false, isRegistered: true, isDynamic: false },
  { port: 8443, protocol: "tcp", service: "HTTPS-ALT", description: "HTTPS Alternate", isWellKnown: false, isRegistered: true, isDynamic: false },
  { port: 27017, protocol: "tcp", service: "MongoDB", description: "MongoDB Database", isWellKnown: false, isRegistered: true, isDynamic: false },
];

export function lookupPort(port: number): PortInfo | null {
  return PORT_DB.find((p) => p.port === port) || null;
}

export function lookupService(service: string): PortInfo[] {
  const s = service.toLowerCase();
  return PORT_DB.filter((p) => p.service.toLowerCase().includes(s) || p.description.toLowerCase().includes(s));
}

export function getPortCategory(port: number): string {
  if (port >= 0 && port <= 1023) return "Well-known";
  if (port >= 1024 && port <= 49151) return "Registered";
  return "Dynamic/Private";
}

export function generateNmapCommand(config: ScanConfig): string {
  const flags: string[] = ["nmap"];
  switch (config.scanType) {
    case "syn": flags.push("-sS"); break;
    case "connect": flags.push("-sT"); break;
    case "udp": flags.push("-sU"); break;
    case "fin": flags.push("-sF"); break;
    case "xmas": flags.push("-sX"); break;
  }
  if (config.timeout > 0) flags.push(`--max-rtt-timeout ${config.timeout}ms`);
  if (config.ports.length > 0) {
    if (config.ports.length <= 10) flags.push("-p " + config.ports.join(","));
    else flags.push("-p " + Math.min(...config.ports) + "-" + Math.max(...config.ports));
  }
  flags.push(config.target);
  return flags.join(" ");
}

export function generateNmapCommon(target: string, preset: "quick" | "standard" | "intense" | "stealth"): string {
  switch (preset) {
    case "quick": return `nmap -T4 -F ${target}`;
    case "standard": return `nmap -T4 -A -v ${target}`;
    case "intense": return `nmap -T4 -A -v -PE -PS22,25,80 -PA21,23,80,3389 ${target}`;
    case "stealth": return `nmap -sS -sV -O --version-intensity 5 -T2 ${target}`;
  }
}

export function getCommonPorts(): PortInfo[] {
  return PORT_DB;
}

export function getWellKnownPorts(): PortInfo[] {
  return PORT_DB.filter((p) => p.isWellKnown);
}

export function parsePortRange(range: string): number[] {
  const ports: number[] = [];
  for (const part of range.split(",")) {
    const trimmed = part.trim();
    if (trimmed.includes("-")) {
      const [start, end] = trimmed.split("-").map(Number);
      for (let i = start; i <= end; i++) ports.push(i);
    } else {
      ports.push(parseInt(trimmed, 10));
    }
  }
  return ports.filter((p) => p >= 0 && p <= 65535);
}

export function getPortRisk(port: number): "high" | "medium" | "low" {
  const info = lookupPort(port);
  if (!info) return "low";
  if ([23, 21, 445, 1433, 3389].includes(port)) return "high";
  if ([22, 25, 80, 110, 143, 8080].includes(port)) return "medium";
  return "low";
}

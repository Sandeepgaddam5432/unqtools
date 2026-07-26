/**
 * Email Header Analyzer — pure logic.
 * RFC 5322 email header parsing.
 */

export interface ParsedHeader {
  name: string;
  value: string;
}

export interface ReceivedHop {
  raw: string;
  from: string;
  by: string;
  with: string;
  id: string;
  for: string;
  timestamp: string;
  delayMs?: number; // delay from previous hop
}

export interface AuthResults {
  spf: { result: string; detail: string };
  dkim: { result: string; detail: string };
  dmarc: { result: string; detail: string };
}

export interface EmailAnalysis {
  headers: ParsedHeader[];
  from: string;
  to: string[];
  cc: string[];
  bcc: string[];
  replyTo: string;
  subject: string;
  date: string;
  messageId: string;
  inReplyTo: string;
  references: string[];
  receivedHops: ReceivedHop[];
  auth: AuthResults;
  totalDelayMs: number;
  suspicious: string[];
  error?: string;
}

function unfoldHeaders(raw: string): string {
  // RFC 5322 continuation lines start with whitespace
  return raw.replace(/\r?\n([ \t])/g, "$1");
}

function decodeEncodedWord(s: string): string {
  // RFC 2047: =?charset?encoding?text?=
  return s.replace(/=\?([^?]+)\?([BbQq])\?([^?]+)\?=/g, (_, charset, encoding, text) => {
    try {
      if (encoding.toUpperCase() === "B") {
        // Base64
        const decoded = atob(text);
        if (charset.toUpperCase().startsWith("UTF-8")) {
          return decodeURIComponent(escape(decoded));
        }
        return decoded;
      } else {
        // Q-encoded
        const qDecoded = text.replace(/_/g, " ").replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        if (charset.toUpperCase().startsWith("UTF-8")) {
          return decodeURIComponent(escape(qDecoded));
        }
        return qDecoded;
      }
    } catch {
      return text;
    }
  });
}

function extractAddress(header: string): string {
  // Match "Name" <email> or just email
  const m = header.match(/<([^>]+)>/);
  if (m) return m[1];
  const emailMatch = header.match(/[^\s<>]+@[^\s<>]+/);
  return emailMatch ? emailMatch[0] : header.trim();
}

function extractDisplayName(header: string): string {
  const m = header.match(/^"([^"]+)"/);
  if (m) return decodeEncodedWord(m[1]);
  if (header.includes("<")) {
    const before = header.split("<")[0].trim().replace(/"$/, "");
    return before ? decodeEncodedWord(before) : "";
  }
  return "";
}

function splitAddresses(value: string): string[] {
  return value.split(",").map((s) => s.trim()).filter(Boolean);
}

function parseReceivedHops(receivedHeaders: string[]): ReceivedHop[] {
  return receivedHeaders.map((raw, idx) => {
    const fromMatch = raw.match(/from\s+([^\s]+(?:\s+\([^)]+\))?)/i);
    const byMatch = raw.match(/by\s+([^\s]+(?:\s+\([^)]+\))?)/i);
    const withMatch = raw.match(/with\s+([A-Za-z0-9/\s.()-]+)/i);
    const idMatch = raw.match(/id\s+<([^>]+)>/i);
    const forMatch = raw.match(/for\s+<([^>]+)>/i);
    const dateMatch = raw.match(/;\s*(.+)$/);

    return {
      raw,
      from: fromMatch ? fromMatch[1].trim() : "",
      by: byMatch ? byMatch[1].trim() : "",
      with: withMatch ? withMatch[1].trim() : "",
      id: idMatch ? idMatch[1] : "",
      for: forMatch ? forMatch[1] : "",
      timestamp: dateMatch ? dateMatch[1].trim() : "",
    };
  });
}

function calculateDelays(hops: ReceivedHop[]): ReceivedHop[] {
  // Hops are usually listed newest → oldest. Compute delay from previous (older) hop.
  const reversed = [...hops].reverse();
  for (let i = 1; i < reversed.length; i++) {
    const prev = reversed[i - 1];
    const cur = reversed[i];
    if (prev.timestamp && cur.timestamp) {
      const prevTime = Date.parse(prev.timestamp);
      const curTime = Date.parse(cur.timestamp);
      if (!isNaN(prevTime) && !isNaN(curTime)) {
        reversed[i] = { ...cur, delayMs: curTime - prevTime };
      }
    }
  }
  return reversed.reverse();
}

function parseAuthResults(headers: ParsedHeader[]): AuthResults {
  const result: AuthResults = {
    spf: { result: "none", detail: "" },
    dkim: { result: "none", detail: "" },
    dmarc: { result: "none", detail: "" },
  };

  for (const h of headers) {
    const name = h.name.toLowerCase();
    const value = h.value;

    if (name === "received-spf") {
      const m = value.match(/^(pass|fail|softfail|neutral|none|temperror|permerror)/i);
      result.spf.result = m ? m[1].toLowerCase() : "unknown";
      result.spf.detail = value;
    } else if (name === "authentication-results") {
      const spfMatch = value.match(/spf=(pass|fail|softfail|neutral|none|temperror|permerror)/i);
      if (spfMatch) {
        result.spf.result = spfMatch[1].toLowerCase();
        const detailMatch = value.match(/spf=[^\s]+\s+([^;\n]+)/i);
        if (detailMatch) result.spf.detail = detailMatch[1];
      }
      const dkimMatch = value.match(/dkim=(pass|fail|neutral|none|temperror|permerror|policy)/i);
      if (dkimMatch) {
        result.dkim.result = dkimMatch[1].toLowerCase();
        const detailMatch = value.match(/dkim=[^\s]+\s+([^;\n]+)/i);
        if (detailMatch) result.dkim.detail = detailMatch[1];
      }
      const dmarcMatch = value.match(/dmarc=(pass|fail|quarantine|reject|none|temperror|permerror)/i);
      if (dmarcMatch) {
        result.dmarc.result = dmarcMatch[1].toLowerCase();
        const detailMatch = value.match(/dmarc=[^\s]+\s+([^;\n]+)/i);
        if (detailMatch) result.dmarc.detail = detailMatch[1];
      }
    } else if (name === "dkim-signature") {
      // Just mark that DKIM is signed
      if (result.dkim.result === "none") result.dkim.result = "signed";
      result.dkim.detail = result.dkim.detail || value.slice(0, 100);
    }
  }

  return result;
}

function findSuspicious(analysis: EmailAnalysis): string[] {
  const issues: string[] = [];
  // From vs Return-Path mismatch
  const returnPath = analysis.headers.find((h) => h.name.toLowerCase() === "return-path")?.value || "";
  if (returnPath && analysis.from) {
    const returnAddr = extractAddress(returnPath);
    if (returnAddr.toLowerCase() !== analysis.from.toLowerCase()) {
      issues.push(`From address (${analysis.from}) does not match Return-Path (${returnAddr})`);
    }
  }
  // No SPF/DKIM/DMARC
  if (analysis.auth.spf.result === "fail") issues.push("SPF authentication failed");
  if (analysis.auth.dkim.result === "fail") issues.push("DKIM signature verification failed");
  if (analysis.auth.dmarc.result === "fail") issues.push("DMARC check failed");
  // Unusual number of hops
  if (analysis.receivedHops.length > 8) issues.push(`Unusually high number of Received hops (${analysis.receivedHops.length})`);
  // Long delay
  if (analysis.totalDelayMs > 24 * 60 * 60 * 1000) issues.push("Total transmission time exceeds 24 hours");
  return issues;
}

export function parseEmailHeaders(raw: string): EmailAnalysis {
  if (!raw || !raw.trim()) {
    return {
      headers: [], from: "", to: [], cc: [], bcc: [], replyTo: "", subject: "",
      date: "", messageId: "", inReplyTo: "", references: [], receivedHops: [],
      auth: { spf: { result: "none", detail: "" }, dkim: { result: "none", detail: "" }, dmarc: { result: "none", detail: "" } },
      totalDelayMs: 0, suspicious: [], error: "Empty input.",
    };
  }

  const unfolded = unfoldHeaders(raw);
  const lines = unfolded.split(/\r?\n/);

  const headers: ParsedHeader[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const name = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    if (name) headers.push({ name, value });
  }

  const findFirst = (n: string) => headers.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";
  const findAll = (n: string) => headers.filter((h) => h.name.toLowerCase() === n.toLowerCase()).map((h) => h.value);

  const receivedHops = calculateDelays(parseReceivedHops(findAll("received")));
  const auth = parseAuthResults(headers);

  const totalDelayMs = receivedHops.reduce((sum, h) => sum + (h.delayMs || 0), 0);

  const from = extractAddress(findFirst("from"));
  const to = splitAddresses(findFirst("to")).map(extractAddress);
  const cc = splitAddresses(findFirst("cc")).map(extractAddress);
  const bcc = splitAddresses(findFirst("bcc")).map(extractAddress);
  const subject = decodeEncodedWord(findFirst("subject"));

  const analysis: EmailAnalysis = {
    headers,
    from,
    to,
    cc,
    bcc,
    replyTo: extractAddress(findFirst("reply-to")),
    subject,
    date: findFirst("date"),
    messageId: findFirst("message-id"),
    inReplyTo: findFirst("in-reply-to"),
    references: splitAddresses(findFirst("references")),
    receivedHops,
    auth,
    totalDelayMs,
    suspicious: [],
  };
  analysis.suspicious = findSuspicious(analysis);
  return analysis;
}

export function exportAnalysis(analysis: EmailAnalysis, format: "json" | "csv"): string {
  if (format === "json") return JSON.stringify(analysis, null, 2);
  // CSV summary
  const rows = [
    ["Field", "Value"],
    ["From", analysis.from],
    ["To", analysis.to.join("; ")],
    ["Subject", analysis.subject],
    ["Date", analysis.date],
    ["Message-ID", analysis.messageId],
    ["Hops", String(analysis.receivedHops.length)],
    ["SPF", analysis.auth.spf.result],
    ["DKIM", analysis.auth.dkim.result],
    ["DMARC", analysis.auth.dmarc.result],
    ["Total delay (ms)", String(analysis.totalDelayMs)],
    ["Suspicious", analysis.suspicious.join("; ")],
  ];
  return rows.map((r) => r.map((c) => c.includes(",") || c.includes('"') ? `"${c.replace(/"/g, '""')}"` : c).join(",")).join("\n");
}

export function formatDelay(ms: number): string {
  if (ms < 0) return `-${formatDelay(-ms)}`;
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  if (ms < 3600000) return `${(ms / 60000).toFixed(1)}m`;
  return `${(ms / 3600000).toFixed(1)}h`;
}

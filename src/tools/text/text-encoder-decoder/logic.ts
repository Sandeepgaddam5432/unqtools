/** Text Encoder/Decoder — pure logic. */

export type Encoding = "base64" | "url" | "html" | "hex" | "rot13" | "binary";

export interface EncodeOptions {
  encoding: Encoding;
}

export interface EncodeResult {
  output: string;
  warnings: string[];
}

function textToBytes(s: string): number[] {
  return Array.from(new TextEncoder().encode(s));
}

function bytesToText(bytes: number[]): string {
  return new TextDecoder().decode(new Uint8Array(bytes));
}

function toBase64(s: string): string {
  const bytes = textToBytes(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

function fromBase64(s: string): string {
  const bin = atob(s.replace(/\s/g, ""));
  const bytes = new Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytesToText(bytes);
}

function toHex(s: string): string {
  return textToBytes(s).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function fromHex(s: string): string {
  const clean = s.replace(/\s/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < clean.length; i += 2) bytes.push(parseInt(clean.slice(i, i + 2), 16));
  return bytesToText(bytes);
}

function toBinary(s: string): string {
  return textToBytes(s).map((b) => b.toString(2).padStart(8, "0")).join(" ");
}

function fromBinary(s: string): string {
  const parts = s.trim().split(/\s+/);
  return bytesToText(parts.map((p) => parseInt(p, 2)));
}

function rot13(s: string): string {
  return s.replace(/[a-zA-Z]/g, (c) => {
    const base = c <= "Z" ? 65 : 97;
    return String.fromCharCode(((c.charCodeAt(0) - base + 13) % 26) + base);
  });
}

const HTML_ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const HTML_UNESCAPES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&#x27;": "'" };

export function encode(input: string, options: EncodeOptions): EncodeResult | { error: string } {
  const warnings: string[] = [];
  try {
    let output: string;
    switch (options.encoding) {
      case "base64": output = toBase64(input); break;
      case "url": output = encodeURIComponent(input); break;
      case "html": output = input.replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]!); break;
      case "hex": output = toHex(input); break;
      case "rot13": output = rot13(input); break;
      case "binary": output = toBinary(input); break;
      default: return { error: `Unknown encoding: ${options.encoding}` };
    }
    return { output, warnings };
  } catch (e) {
    return { error: `Encode failed: ${(e as Error).message}` };
  }
}

export function decode(input: string, options: EncodeOptions): EncodeResult | { error: string } {
  const warnings: string[] = [];
  try {
    let output: string;
    switch (options.encoding) {
      case "base64": output = fromBase64(input); break;
      case "url": output = decodeURIComponent(input); break;
      case "html": output = input.replace(/&(?:amp|lt|gt|quot|#39|x27);/g, (m) => HTML_UNESCAPES[m] ?? m); break;
      case "hex": output = fromHex(input); break;
      case "rot13": output = rot13(input); break;
      case "binary": output = fromBinary(input); break;
      default: return { error: `Unknown encoding: ${options.encoding}` };
    }
    return { output, warnings };
  } catch (e) {
    return { error: `Decode failed: ${(e as Error).message}` };
  }
}

export function batchEncode(inputs: string[], options: EncodeOptions): (EncodeResult | { error: string })[] {
  return inputs.map((i) => encode(i, options));
}

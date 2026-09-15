"use client";

/**
 * Three tiny first-party utilities used by the Quick Tools widget:
 *   - PasswordTool (Web Crypto backed strong password)
 *   - UuidTool     (RFC 4122 v4 UUIDs in bulk)
 *   - Base64Tool   (UTF-8 safe encode / decode, file support)
 *
 * These run entirely in-browser with zero network and are stable enough
 * to live in the dashboard so users can launch them without leaving home.
 */

import { useEffect, useMemo, useState } from "react";
import { Binary, Copy, Dice5, Fingerprint, KeyRound, RefreshCcw } from "lucide-react";
import CopyButton from "./ui/CopyButton";
import { cn } from "@/lib/template-utils";

/* ----------------------------------------------------------------- */
/*  PasswordTool                                                      */
/* ----------------------------------------------------------------- */

const DEFAULT_LENGTH = 16;

function genPassword(length: number): string {
  // Lowercase + uppercase + digit — wide character pool keeps entropy high.
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const buf = new Uint32Array(length);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < length; i++) out += chars[buf[i] % chars.length];
  return out;
}

export function PasswordTool({ compact = false }: { compact?: boolean }) {
  const [pw, setPw] = useState<string>(() => genPassword(DEFAULT_LENGTH));
  const [length, setLength] = useState(DEFAULT_LENGTH);

  const regenerate = () => setPw(genPassword(length));
  // If the slider is moved, regenerate on the next render.
  useEffect(() => {
    setPw(genPassword(length));
  }, [length]);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.08] bg-black/40 px-3 py-2 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)]">
        <KeyRound className="size-4 shrink-0 text-cyan-300" />
        <code className="min-w-0 flex-1 truncate font-mono text-[12px] text-white/90">{pw}</code>
        <CopyButton
          getText={() => pw}
          iconOnly
          className="border-cyan-400/25 bg-cyan-400/[0.08] text-cyan-200 hover:bg-cyan-400/[0.18]"
        />
        <button
          type="button"
          onClick={regenerate}
          aria-label="Regenerate password"
          className="flex size-7 cursor-pointer items-center justify-center rounded-xl border border-white/[0.1] bg-white/[0.06] text-white/65 transition-colors hover:bg-white/[0.12]"
        >
          <RefreshCcw className="size-3.5" />
        </button>
      </div>
      {!compact && (
        <label className="flex items-center gap-2 text-[11px] text-white/45">
          <span className="shrink-0">Length</span>
          <input
            type="range"
            min={8}
            max={32}
            value={length}
            onChange={(e) => setLength(Number(e.target.value))}
            className="flex-1"
          />
          <span className="tabular w-6 text-right font-bold text-white/75">{length}</span>
        </label>
      )}
      <p className="flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1.5 text-[10.5px] text-emerald-300">
        <Dice5 className="size-3" /> WebCrypto-backed — zero upload
      </p>
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  UuidTool                                                          */
/* ----------------------------------------------------------------- */

function genUuid(): string {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  // Manual fallback for older runtimes.
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
  return (
    hex.slice(0, 8) +
    "-" +
    hex.slice(8, 12) +
    "-" +
    hex.slice(12, 16) +
    "-" +
    hex.slice(16, 20) +
    "-" +
    hex.slice(20)
  );
}

export function UuidTool() {
  const [count, setCount] = useState(3);
  const [items, setItems] = useState<string[]>(() =>
    Array.from({ length: 3 }, genUuid)
  );
  const [caps, setCaps] = useState(false);

  const visible = useMemo(
    () => items.map((u) => (caps ? u.toUpperCase() : u)),
    [items, caps]
  );

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setItems(Array.from({ length: count }, genUuid))}
          className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-violet-400/25 bg-violet-400/[0.1] py-1.5 text-[11px] font-bold text-violet-200 transition-colors hover:bg-violet-400/[0.18]"
        >
          <Fingerprint className="size-3.5" />
          Generate {count}
        </button>
        <input
          type="number"
          min={1}
          max={50}
          value={count}
          onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
          className="w-14 rounded-xl border border-white/[0.08] bg-black/40 px-2 py-1.5 text-center text-[12px] text-white shadow-[inset_0_2px_6px_rgba(0,0,0,0.4)] outline-none focus:border-violet-400/30"
          aria-label="How many UUIDs"
        />
        <label className="flex cursor-pointer select-none items-center gap-1 rounded-xl border border-white/[0.08] bg-white/[0.05] px-2 py-1.5 text-[10.5px] font-bold text-white/65 transition-colors hover:bg-white/[0.1]">
          <input
            type="checkbox"
            checked={caps}
            onChange={(e) => setCaps(e.target.checked)}
            className="size-3 accent-cyan-400"
          />
          ABC
        </label>
      </div>
      <div className="flex max-h-28 flex-col gap-1 overflow-y-auto rounded-2xl border border-white/[0.07] bg-black/40 p-2 font-mono text-[10.5px] text-white/85 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]">
        {visible.map((u, i) => (
          <button
            key={i}
            type="button"
            onClick={() => navigator.clipboard?.writeText(u)}
            className="cursor-pointer rounded-md px-1.5 py-0.5 text-left transition-colors hover:bg-white/[0.07]"
            title="Click to copy"
          >
            {u}
          </button>
        ))}
      </div>
      <CopyButton
        getText={() => visible.join("\n")}
        iconOnly
        className="ml-auto !px-2"
      />
    </div>
  );
}

/* ----------------------------------------------------------------- */
/*  Base64Tool                                                        */
/* ----------------------------------------------------------------- */

function utf8Encode(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}
function utf8Decode(b: Uint8Array): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(b);
  } catch {
    return new TextDecoder().decode(b);
  }
}

export function Base64Tool({ compact = false }: { compact?: boolean }) {
  const [input, setInput] = useState("hello privacy");
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const encode = () => {
    setErr("");
    try {
      const bytes = utf8Encode(input);
      let bin = "";
      const CHUNK = 0x8000;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        bin += String.fromCharCode.apply(
          null,
          Array.from(bytes.subarray(i, i + CHUNK))
        );
      }
      setOut(btoa(bin));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Encode failed");
      setOut(null);
    }
  };

  const decode = () => {
    setErr("");
    try {
      // Be permissive: strip whitespace and url-safe chars.
      const cleaned = input.replace(/\s+/g, "").replace(/-/g, "+").replace(/_/g, "/");
      const bin = atob(cleaned);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      setOut(utf8Decode(bytes));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Decode failed");
      setOut(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={2}
        spellCheck={false}
        placeholder="Type or paste text…"
        className={cn(
          "w-full resize-none rounded-2xl border border-white/[0.08] bg-black/40 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-white/85 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)] placeholder:text-white/25 focus:border-cyan-400/30 focus:outline-none",
          compact && "text-[11px]"
        )}
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={encode}
          className="flex-1 cursor-pointer rounded-xl border border-emerald-400/25 bg-emerald-400/[0.1] py-1.5 text-[11px] font-bold text-emerald-200 transition-colors hover:bg-emerald-400/[0.18]"
        >
          Encode
        </button>
        <button
          type="button"
          onClick={decode}
          className="flex-1 cursor-pointer rounded-xl border border-white/[0.1] bg-white/[0.06] py-1.5 text-[11px] font-bold text-white/75 transition-colors hover:bg-white/[0.12]"
        >
          Decode
        </button>
        <CopyButton
          getText={() => out ?? ""}
          iconOnly
          className={cn("ml-auto", !out && "pointer-events-none opacity-30")}
          label="Copy output"
        />
      </div>
      {err && (
        <p className="truncate rounded-xl border border-red-400/20 bg-red-400/[0.07] px-2.5 py-1.5 text-[10.5px] text-red-300">
          {err}
        </p>
      )}
      {out && (
        <pre className="max-h-24 overflow-auto rounded-2xl border border-white/[0.07] bg-black/40 p-2.5 font-mono text-[10.5px] leading-relaxed text-cyan-200/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]">
{out}
        </pre>
      )}
      {!out && !err && (
        <p className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10.5px] text-white/30">
          UTF-8 safe encode/decode.
        </p>
      )}
    </div>
  );
}

export type { }; // keep TS happy

"use client";

import { Check, RefreshCw, Wand2 } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { ComponentType } from "react";
import CopyButton from "@/components/ui/CopyButton";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Password Generator — real WebCrypto randomness                     */
/* ------------------------------------------------------------------ */

const SETS = {
  lower: "abcdefghijklmnopqrstuvwxyz",
  upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
  digits: "0123456789",
  symbols: "!@#$%^&*()-_=+[]{}<>?",
};

function randomPassword(length: number, pools: string[]) {
  const chars = pools.join("");
  const arr = new Uint32Array(length);
  crypto.getRandomValues(arr);
  return Array.from(arr, (n) => chars[n % chars.length]).join("");
}

const STRENGTH = [
  { label: "Weak", color: "bg-red-400" },
  { label: "Fair", color: "bg-orange-400" },
  { label: "Good", color: "bg-amber-300" },
  { label: "Strong", color: "bg-emerald-400" },
  { label: "Elite", color: "bg-cyan-300" },
];

export function PasswordTool({ compact = false }: { compact?: boolean }) {
  const [length, setLength] = useState(18);
  const [pools, setPools] = useState<string[]>([SETS.lower, SETS.upper, SETS.digits, SETS.symbols]);
  const [password, setPassword] = useState("unq•tools•stay•local");
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    setPassword(randomPassword(18, Object.values(SETS)));
  }, []);

  const regenerate = (len = length, pl = pools) => {
    if (!pl.length) return;
    setPassword(randomPassword(len, pl));
    setSpin((s) => s + 1);
  };

  const togglePool = (pool: string) => {
    setPools((prev) => {
      const next = prev.includes(pool) ? prev.filter((p) => p !== pool) : [...prev, pool];
      if (next.length) regenerate(length, next);
      return next.length ? next : prev;
    });
  };

  const score = Math.min(
    4,
    Math.floor(((length >= 10 ? 1 : 0) + (length >= 14 ? 1 : 0) + (length >= 18 ? 1 : 0) + pools.length - 1))
  );
  const s = STRENGTH[Math.max(0, score)];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2.5">
        <span className="min-w-0 flex-1 truncate font-mono text-[13px] tracking-wide text-cyan-100">
          {password}
        </span>
        <motion.button
          type="button"
          whileTap={{ scale: 0.85 }}
          onClick={() => regenerate()}
          className="inline-flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-xl border border-white/10 bg-white/[0.06] text-white/70 transition-colors hover:bg-white/[0.12] hover:text-white"
          aria-label="Regenerate password"
        >
          <motion.span
            animate={{ rotate: spin * 180 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            className="inline-flex"
          >
            <RefreshCw className="size-3.5" />
          </motion.span>
        </motion.button>
        <CopyButton text={password} iconOnly />
      </div>

      <div className="flex items-center gap-3">
        <span className="tabular w-10 text-[11px] font-medium text-white/50">{length} ch</span>
        <input
          type="range"
          min={8}
          max={40}
          value={length}
          onChange={(e) => {
            const len = Number(e.target.value);
            setLength(len);
            regenerate(len);
          }}
          className="h-1 flex-1"
          aria-label="Password length"
        />
        <div className="flex w-24 items-center justify-end gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.span
              key={i}
              initial={false}
              animate={{ scale: i <= score ? 1 : 0.85 }}
              className={cn(
                "h-1.5 w-3.5 rounded-full transition-colors",
                i <= score ? s.color : "bg-white/[0.08]"
              )}
            />
          ))}
        </div>
      </div>

      {!compact && (
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["a-z", SETS.lower],
              ["A-Z", SETS.upper],
              ["0-9", SETS.digits],
              ["#$&", SETS.symbols],
            ] as const
          ).map(([label, pool]) => {
            const active = pools.includes(pool);
            return (
              <button
                key={label}
                type="button"
                onClick={() => togglePool(pool)}
                className={cn(
                  "cursor-pointer rounded-full border px-2.5 py-1 font-mono text-[10.5px] font-semibold transition-all",
                  active
                    ? "border-cyan-400/30 bg-cyan-400/15 text-cyan-200"
                    : "border-white/[0.08] bg-white/[0.03] text-white/40 hover:text-white/70"
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Base64 — unicode-safe encode / decode                              */
/* ------------------------------------------------------------------ */

const b64encode = (s: string) => {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
};
const b64decode = (s: string) => {
  const bin = atob(s.trim());
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
};

export function Base64Tool({ compact = false }: { compact?: boolean }) {
  const [mode, setMode] = useState<"encode" | "decode">("encode");
  const [input, setInput] = useState("Privacy is a feature.");

  const { output, error } = useMemo(() => {
    try {
      return { output: input ? (mode === "encode" ? b64encode(input) : b64decode(input)) : "", error: "" };
    } catch {
      return { output: "", error: "Invalid Base64 input" };
    }
  }, [input, mode]);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex overflow-hidden rounded-full border border-white/[0.08] bg-black/30 p-0.5">
        {(["encode", "decode"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={cn(
              "flex-1 cursor-pointer rounded-full py-1 text-[11px] font-semibold capitalize transition-colors",
              mode === m ? "bg-white/[0.12] text-white" : "text-white/40 hover:text-white/70"
            )}
          >
            {m}
          </button>
        ))}
      </div>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={compact ? 1 : 2}
        spellCheck={false}
        placeholder={mode === "encode" ? "Text to encode…" : "Base64 to decode…"}
        className="w-full resize-none rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2 font-mono text-[12px] text-white/85 placeholder:text-white/25 focus:border-cyan-400/30 focus:outline-none"
      />
      <div className="flex items-start gap-2 rounded-2xl border border-white/[0.07] bg-black/20 px-3 py-2">
        <span
          className={cn(
            "min-h-4 min-w-0 flex-1 break-all font-mono text-[12px]",
            error ? "text-red-300" : "text-emerald-200/90"
          )}
        >
          {error || output || "—"}
        </span>
        <CopyButton text={output} iconOnly className={cn("px-2 py-1", !output && "pointer-events-none opacity-30")} />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  UUID v4 — crypto.randomUUID + batch                                */
/* ------------------------------------------------------------------ */

export function UuidTool() {
  const [ids, setIds] = useState<string[]>(["00000000-0000-4000-8000-000000000000"]);

  useEffect(() => {
    setIds([crypto.randomUUID()]);
  }, []);

  const next = () => setIds((prev) => [crypto.randomUUID(), ...prev].slice(0, 3));

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        {ids.map((id, i) => (
          <motion.div
            key={id}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: i === 0 ? 1 : 0.4, y: 0 }}
            className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2"
          >
            <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-cyan-100/90">{id}</span>
            {i === 0 && <CopyButton text={id} iconOnly className="px-2 py-1" />}
          </motion.div>
        ))}
      </div>
      <motion.button
        type="button"
        whileTap={{ scale: 0.97 }}
        onClick={next}
        className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl border border-cyan-400/25 bg-cyan-400/10 py-2 text-[12px] font-semibold text-cyan-200 transition-colors hover:bg-cyan-400/20"
      >
        <Wand2 className="size-3.5" /> Generate v4 UUID
      </motion.button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  JSON Formatter — validate, prettify, minify                        */
/* ------------------------------------------------------------------ */

const SAMPLE = `{"suite":"unq-tools","tools":1679,"offline":true,"categories":["pdf","dev","security","ai","calc"],"uploads":0}`;

export function JsonTool() {
  const [input, setInput] = useState(SAMPLE);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null);

  const run = (indent: number | 0) => {
    try {
      const parsed = JSON.parse(input);
      setOutput(JSON.stringify(parsed, null, indent === 0 ? 0 : indent));
      const keys = Object.keys(parsed as object).length;
      setStatus({ ok: true, msg: `Valid JSON · ${keys} top-level key${keys === 1 ? "" : "s"}` });
    } catch (e) {
      setStatus({ ok: false, msg: e instanceof Error ? e.message : "Invalid JSON" });
      setOutput("");
    }
  };

  return (
    <div className="flex flex-col gap-2.5">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={4}
        spellCheck={false}
        className="w-full resize-y rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2 font-mono text-[12px] leading-relaxed text-white/85 placeholder:text-white/25 focus:border-emerald-400/30 focus:outline-none"
        placeholder="Paste JSON here…"
      />
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => run(2)}
          className="cursor-pointer rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[12px] font-semibold text-emerald-200 transition-colors hover:bg-emerald-400/20"
        >
          Format
        </button>
        <button
          type="button"
          onClick={() => run(0)}
          className="cursor-pointer rounded-xl border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[12px] font-semibold text-white/80 transition-colors hover:bg-white/[0.12]"
        >
          Minify
        </button>
        <button
          type="button"
          onClick={() => setInput(SAMPLE)}
          className="ml-auto cursor-pointer rounded-xl px-2.5 py-1.5 text-[11px] font-medium text-white/40 transition-colors hover:text-white/70"
        >
          Load sample
        </button>
      </div>
      {status && (
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-[11.5px] font-medium",
            status.ok
              ? "border-emerald-400/20 bg-emerald-400/[0.07] text-emerald-300"
              : "border-red-400/20 bg-red-400/[0.07] text-red-300"
          )}
        >
          {status.ok && <Check className="size-3.5" />}
          <span className="truncate">{status.msg}</span>
        </div>
      )}
      {output && (
        <div className="relative">
          <pre className="max-h-44 overflow-auto rounded-2xl border border-white/[0.07] bg-black/40 p-3 font-mono text-[11.5px] leading-relaxed text-emerald-100/90">
            {output}
          </pre>
          <CopyButton text={output} className="absolute right-2 top-2" iconOnly />
        </div>
      )}
    </div>
  );
}

/** Registry: tool id → working mini-tool component (used by cards & modal). */
export const MINI_TOOLS: Record<string, ComponentType> = {
  "password-generator": PasswordTool,
  "base64-encoder": Base64Tool,
  "uuid-generator": UuidTool,
  "json-formatter": JsonTool,
};

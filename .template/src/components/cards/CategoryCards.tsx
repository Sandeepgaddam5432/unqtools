"use client";

import {
  BadgeCheck,
  CheckCircle2,
  Delete,
  FileText,
  Gauge,
  HardDrive,
  Merge,
  Minimize2,
  PenLine,
  ScanText,
  Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import type { Category } from "@/lib/tools-data";
import { findTool } from "@/lib/tools-data";
import { cn, formatBytes } from "@/lib/utils";

/* ----------------------------- helpers ----------------------------- */

function CardHead({ cat }: { cat: Category }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105",
          cat.iconTile,
          cat.iconShadow
        )}
      >
        <cat.icon className="size-4.5 text-white" />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-[15px] font-bold tracking-tight">{cat.label}</h3>
        <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-white/40">{cat.tagline}</p>
      </div>
      <div className="text-right">
        <div className={cn("tabular text-[19px] font-extrabold leading-none", cat.text)}>
          {cat.count}
        </div>
        <div className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-white/35">
          tools
        </div>
      </div>
    </div>
  );
}

function Chips({
  cat,
  ids,
  onLaunch,
}: {
  cat: Category;
  ids: string[];
  onLaunch: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {ids.map((id) => {
        const tool = findTool(id);
        if (!tool) return null;
        return (
          <motion.button
            key={id}
            type="button"
            whileTap={{ scale: 0.92 }}
            onClick={() => onLaunch(id)}
            className={cn(
              "inline-flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold text-white/75 transition-all hover:brightness-125",
              cat.chipBorder,
              cat.chipBg
            )}
          >
            <tool.icon className="size-3" />
            {tool.name}
          </motion.button>
        );
      })}
    </div>
  );
}

const body = "flex h-full flex-col gap-3.5 p-5 sm:p-6";

/* ------------------------------- PDF ------------------------------- */

export function PdfCard({ cat, onLaunch }: { cat: Category; onLaunch: (id: string) => void }) {
  const quick = [
    { id: "pdf-merge", icon: Merge, label: "Merge" },
    { id: "pdf-compress", icon: Minimize2, label: "Compress" },
    { id: "pdf-sign", icon: PenLine, label: "Sign" },
    { id: "pdf-ocr", icon: ScanText, label: "OCR" },
  ];
  return (
    <div className={body}>
      <CardHead cat={cat} />
      <div className="grid grid-cols-4 gap-1.5">
        {quick.map((q, i) => (
          <motion.button
            key={q.id}
            type="button"
            initial={{ opacity: 0, y: 8 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 + i * 0.05 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => onLaunch(q.id)}
            className="flex cursor-pointer flex-col items-center gap-1.5 rounded-2xl border border-white/[0.06] bg-black/25 py-2.5 transition-colors hover:border-orange-400/25 hover:bg-orange-400/[0.08]"
          >
            <q.icon className="size-4 text-orange-300" />
            <span className="text-[9.5px] font-semibold text-white/55">{q.label}</span>
          </motion.button>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2 rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-2">
        <span className="relative flex size-7 shrink-0 items-center justify-center">
          <FileText className="absolute size-5 -rotate-6 text-orange-400/50" />
          <FileText className="absolute size-5 rotate-3 text-orange-300" />
        </span>
        <span className="text-[10.5px] leading-snug text-white/45">
          Trending this week: <span className="font-semibold text-white/80">PDF Compressor</span> —
          4.2M runs
        </span>
      </div>
    </div>
  );
}

/* ---------------------------- Developer ---------------------------- */

export function DevCard({ cat, onLaunch }: { cat: Category; onLaunch: (id: string) => void }) {
  return (
    <div className={body}>
      <CardHead cat={cat} />
      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-black/50">
        <div className="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
          <span className="size-2 rounded-full bg-red-400/70" />
          <span className="size-2 rounded-full bg-amber-400/70" />
          <span className="size-2 rounded-full bg-emerald-400/70" />
          <span className="ml-2 font-mono text-[9px] text-white/30">unq://terminal</span>
        </div>
        <div className="px-3 py-2.5 font-mono text-[10.5px] leading-[1.7]">
          <div className="text-white/35">$ unq format ./notes.json --pretty</div>
          <div>
            <span className="text-white/50">{"{"}</span>
          </div>
          <div className="pl-3">
            <span className="text-sky-300">&quot;suite&quot;</span>
            <span className="text-white/50">: </span>
            <span className="text-emerald-300">&quot;unq-tools&quot;</span>
            <span className="text-white/50">,</span>
          </div>
          <div className="pl-3">
            <span className="text-sky-300">&quot;offline&quot;</span>
            <span className="text-white/50">: </span>
            <span className="text-violet-300">true</span>
          </div>
          <div>
            <span className="text-white/50">{"}"}</span>
            <span className="blink-caret ml-1.5 inline-block h-3 w-[7px] translate-y-0.5 rounded-[2px] bg-emerald-300" />
          </div>
        </div>
      </div>
      <div className="mt-auto">
        <Chips cat={cat} ids={["json-formatter", "regex-tester", "diff-checker"]} onLaunch={onLaunch} />
      </div>
    </div>
  );
}

/* ---------------------------- Security ----------------------------- */

export function SecurityCard({ cat, onLaunch }: { cat: Category; onLaunch: (id: string) => void }) {
  return (
    <div className={body}>
      <CardHead cat={cat} />
      <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold uppercase tracking-wider text-white/35">
            Vault integrity
          </span>
          <span className="tabular text-[11px] font-extrabold text-cyan-300">91 bits · Elite</span>
        </div>
        <div className="mt-2 flex gap-1">
          {Array.from({ length: 8 }).map((_, i) => (
            <motion.span
              key={i}
              initial={{ scaleY: 0, opacity: 0 }}
              whileInView={{ scaleY: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: 0.15 + i * 0.06, type: "spring", stiffness: 300, damping: 20 }}
              className={cn(
                "h-2 flex-1 origin-bottom rounded-full",
                i < 7 ? "bg-gradient-to-t from-cyan-500 to-blue-400" : "bg-white/[0.08]"
              )}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-white/40">
          <Gauge className="size-3 text-cyan-300/70" />
          Est. crack time: <span className="font-semibold text-white/70">4.1B years</span>
        </div>
      </div>
      <div className="mt-auto">
        <Chips cat={cat} ids={["password-generator", "hash-generator", "aes-encryptor"]} onLaunch={onLaunch} />
      </div>
    </div>
  );
}

/* -------------------------------- AI ------------------------------- */

export function AiCard({ cat, onLaunch }: { cat: Category; onLaunch: (id: string) => void }) {
  return (
    <div className={body}>
      <CardHead cat={cat} />
      <div className="relative overflow-hidden rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
        <Sparkles className="float-y absolute -right-1 -top-1 size-12 text-fuchsia-400/20" />
        <div className="text-[13px] font-semibold leading-snug">
          <span className="bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
            Models run on-device.
          </span>
        </div>
        <p className="mt-1 text-[10.5px] leading-snug text-white/40">
          WebGPU + WASM inference. Prompts never leave your machine.
        </p>
        <span className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-fuchsia-400/25 bg-fuchsia-400/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-fuchsia-300">
          <span className="size-1 animate-pulse rounded-full bg-fuchsia-300" /> WebGPU ready
        </span>
      </div>
      <div className="mt-auto">
        <Chips cat={cat} ids={["ai-summarizer", "ai-local-llm", "ai-speech"]} onLaunch={onLaunch} />
      </div>
    </div>
  );
}

/* ---------------------------- Calculators -------------------------- */
/*  Fully working inline mini-calculator — safe two-pass evaluation    */

function fmtNum(v: number): string | null {
  if (!isFinite(v)) return null;
  const r = Math.round(v * 1e10) / 1e10;
  const s = String(r);
  return s.length > 14 ? r.toExponential(6) : s;
}

function compute(raw: string): number | null {
  const s = raw;
  if (!s || s === "-") return null;
  const nums: number[] = [];
  const ops: string[] = [];
  let i = 0;
  let expectNum = true;
  while (i < s.length) {
    if (expectNum) {
      let str = "";
      if (s[i] === "-") {
        str = "-";
        i++;
      } else if (s[i] === "+") {
        i++;
      }
      const m = /^\d+\.?\d*/.exec(s.slice(i));
      if (!m) return null;
      str += m[0];
      i += m[0].length;
      let v = parseFloat(str);
      if (s[i] === "%") {
        v = v / 100;
        i++;
      }
      nums.push(v);
      expectNum = false;
    } else {
      const ch = s[i];
      if (ch !== "+" && ch !== "-" && ch !== "*" && ch !== "/") return null;
      ops.push(ch);
      i++;
      expectNum = true;
    }
  }
  if (expectNum || nums.length === 0) return null; // trailing operator

  const ns = [nums[0]];
  const os: string[] = [];
  for (let k = 0; k < ops.length; k++) {
    if (ops[k] === "*") ns[ns.length - 1] = ns[ns.length - 1] * nums[k + 1];
    else if (ops[k] === "/") {
      if (nums[k + 1] === 0) return null;
      ns[ns.length - 1] = ns[ns.length - 1] / nums[k + 1];
    } else {
      os.push(ops[k]);
      ns.push(nums[k + 1]);
    }
  }
  let res = ns[0];
  for (let k = 0; k < os.length; k++) res = os[k] === "+" ? res + ns[k + 1] : res - ns[k + 1];
  return res;
}

const prettyExpr = (s: string) =>
  s.replaceAll("*", "×").replaceAll("/", "÷").replaceAll("-", "−");

type KeyKind = "digit" | "op" | "util" | "eq";
const KEY_STYLE: Record<KeyKind, string> = {
  digit:
    "border-white/[0.07] bg-white/[0.05] text-white/90 hover:bg-white/[0.12] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  op: "border-amber-400/25 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  util: "border-white/[0.06] bg-black/30 text-white/55 hover:bg-white/[0.08]",
  eq: "border-transparent bg-gradient-to-b from-amber-400 to-orange-500 text-[#1a1204] shadow-[0_8px_20px_-6px_rgba(245,158,11,0.55),inset_0_1px_0_rgba(255,255,255,0.45)]",
};
const KEY_ROWS: { k: string; kind: KeyKind }[][] = [
  [
    { k: "C", kind: "util" },
    { k: "back", kind: "util" },
    { k: "%", kind: "op" },
    { k: "/", kind: "op" },
  ],
  [
    { k: "7", kind: "digit" },
    { k: "8", kind: "digit" },
    { k: "9", kind: "digit" },
    { k: "*", kind: "op" },
  ],
  [
    { k: "4", kind: "digit" },
    { k: "5", kind: "digit" },
    { k: "6", kind: "digit" },
    { k: "-", kind: "op" },
  ],
  [
    { k: "1", kind: "digit" },
    { k: "2", kind: "digit" },
    { k: "3", kind: "digit" },
    { k: "+", kind: "op" },
  ],
  [
    { k: "±", kind: "digit" },
    { k: "0", kind: "digit" },
    { k: ".", kind: "digit" },
    { k: "=", kind: "eq" },
  ],
];

export function CalcCard({ cat }: { cat: Category; onLaunch: (id: string) => void }) {
  const [expr, setExpr] = useState("128+64");
  const [justEval, setJustEval] = useState(false);

  const preview = useMemo(() => {
    const cleaned = expr.replace(/[+\-*/]+$/, "");
    if (!cleaned) return null;
    const v = compute(cleaned);
    return v === null ? null : fmtNum(v);
  }, [expr]);

  const press = (k: string) => {
    if (k === "=") {
      const cleaned = expr.replace(/[+\-*/]+$/, "");
      const v = cleaned ? compute(cleaned) : null;
      const f = v === null ? null : fmtNum(v);
      if (f !== null) {
        setExpr(f);
        setJustEval(true);
      }
      return;
    }
    setExpr((prev0) => {
      const prev = justEval && /[\d.]/.test(k) ? "" : prev0;
      if (k === "C") return "";
      if (k === "back") return prev.slice(0, -1);
      if (k === "%") return /\d$/.test(prev) ? prev + "%" : prev;
      if (k === "±") {
        const m = /-?\d+\.?\d*$/.exec(prev);
        if (!m) return prev;
        const head = prev.slice(0, m.index);
        return m[0].startsWith("-") ? head + m[0].slice(1) : head + "-" + m[0];
      }
      if (k === ".") {
        const seg = /\d*\.?\d*$/.exec(prev)?.[0] ?? "";
        if (seg.includes(".")) return prev;
        return prev === "" || /[+\-*/%]$/.test(prev) ? prev + "0." : prev + ".";
      }
      if (k === "+" || k === "-" || k === "*" || k === "/") {
        if (prev === "") return k === "-" ? "-" : prev;
        if (/[+\-*/]$/.test(prev)) return prev.slice(0, -1) + k;
        return prev + k;
      }
      return prev + k;
    });
    setJustEval(false);
  };

  return (
    <div className={body}>
      <CardHead cat={cat} />

      {/* display */}
      <div className="rounded-2xl border border-white/[0.07] bg-black/45 px-3 py-2 text-right shadow-[inset_0_2px_10px_rgba(0,0,0,0.55)]">
        <div className="min-h-4 truncate font-mono text-[11px] text-white/45">
          {expr ? prettyExpr(expr) : "0"}
        </div>
        <motion.div
          key={preview ?? "idle"}
          initial={{ opacity: 0.4, y: 3 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 26 }}
          className="tabular mt-0.5 truncate text-2xl font-extrabold tracking-tight text-amber-300"
          style={{ textShadow: "0 0 18px rgba(251,191,36,0.35)" }}
        >
          {preview ?? "Ready"}
        </motion.div>
      </div>

      {/* keypad */}
      <div className="grid flex-1 grid-cols-4 content-stretch gap-1.5">
        {KEY_ROWS.flat().map((key) => (
          <motion.button
            key={key.k}
            type="button"
            whileTap={{ scale: 0.84 }}
            whileHover={{ y: -1 }}
            transition={{ type: "spring", stiffness: 520, damping: 24 }}
            onClick={() => press(key.k)}
            className={cn(
              "flex h-9 cursor-pointer items-center justify-center rounded-xl border text-[13.5px] font-bold transition-colors",
              KEY_STYLE[key.kind]
            )}
            aria-label={key.k === "back" ? "Backspace" : key.k}
          >
            {key.k === "back" ? <Delete className="size-4" /> : prettyExpr(key.k)}
          </motion.button>
        ))}
      </div>

      <div className="text-center text-[8.5px] font-bold uppercase tracking-[0.18em] text-white/25">
        Instant · on-device arithmetic
      </div>
    </div>
  );
}

/* ------------------------------ Image ------------------------------ */

export function ImageCard({ cat, onLaunch }: { cat: Category; onLaunch: (id: string) => void }) {
  return (
    <div className={body}>
      <CardHead cat={cat} />
      <div className="relative h-[74px] overflow-hidden rounded-2xl border border-white/[0.07] bg-[linear-gradient(120deg,rgba(244,63,94,0.25),rgba(14,165,233,0.18),rgba(139,92,246,0.2))]">
        <div className="absolute inset-2 rounded-lg border border-dashed border-white/30" />
        {["left-1 top-1", "right-1 top-1", "bottom-1 left-1", "bottom-1 right-1"].map((pos) => (
          <span key={pos} className={cn("absolute size-1.5 rounded-[2px] bg-white shadow", pos)} />
        ))}
        <span className="absolute inset-0 grid place-items-center">
          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[9.5px] font-bold text-white/80 backdrop-blur">
            4096 → 1024 px · −82% size
          </span>
        </span>
      </div>
      <div className="mt-auto">
        <Chips cat={cat} ids={["image-resizer", "image-compressor", "exif-remover"]} onLaunch={onLaunch} />
      </div>
    </div>
  );
}

/* ------------------------------ Text ------------------------------- */

export function TextCard({ cat, onLaunch }: { cat: Category; onLaunch: (id: string) => void }) {
  return (
    <div className={body}>
      <CardHead cat={cat} />
      <div className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
        <span className="float-y text-3xl font-black tracking-tighter text-sky-400/70">Aa</span>
        <div className="text-[10.5px] leading-snug text-white/45">
          <span className="tabular text-[13px] font-bold text-white/85">128 MB</span> of text
          processed locally this month — searchable, sortable, never sent.
        </div>
      </div>
      <div className="mt-auto">
        <Chips cat={cat} ids={["word-counter", "case-converter", "slug-generator"]} onLaunch={onLaunch} />
      </div>
    </div>
  );
}

/* ------------------------------- SEO ------------------------------- */

const BARS = [42, 68, 54, 88, 73, 95];

export function SeoCard({ cat, onLaunch }: { cat: Category; onLaunch: (id: string) => void }) {
  return (
    <div className={body}>
      <CardHead cat={cat} />
      <div className="flex items-end gap-2 rounded-2xl border border-white/[0.06] bg-black/25 px-3 pb-2.5 pt-3">
        <div className="flex h-14 flex-1 items-end gap-1.5">
          {BARS.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              whileInView={{ height: `${h}%` }}
              viewport={{ once: true }}
              transition={{ delay: 0.1 + i * 0.06, type: "spring", stiffness: 160, damping: 20 }}
              className={cn(
                "flex-1 rounded-t-md bg-gradient-to-t from-lime-500/40 to-lime-300",
                i === BARS.length - 1 && "shadow-[0_0_12px_rgba(163,230,53,0.4)]"
              )}
            />
          ))}
        </div>
        <div className="text-right">
          <div className="tabular text-[15px] font-extrabold text-lime-300">#3</div>
          <div className="text-[9px] font-semibold uppercase tracking-wider text-white/35">
            avg. rank
          </div>
        </div>
      </div>
      <div className="mt-auto">
        <Chips cat={cat} ids={["meta-preview", "sitemap-gen", "schema-builder"]} onLaunch={onLaunch} />
      </div>
    </div>
  );
}

/* --------------------------- Offline Vault -------------------------- */

const VAULT_ROWS = [
  { label: "Service worker", value: "Active" },
  { label: "IndexedDB", value: "Ready" },
  { label: "Cache storage", value: "Warm" },
];

export function VaultCard() {
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null);

  useEffect(() => {
    let alive = true;
    navigator.storage
      ?.estimate?.()
      .then((e) => {
        if (alive) setStorage({ usage: e.usage ?? 0, quota: e.quota ?? 0 });
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);

  const pct = storage && storage.quota > 0 ? Math.min(100, Math.max(2.5, (storage.usage / storage.quota) * 100)) : 2.5;

  return (
    <div className={body} id="vault">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 shadow-lg shadow-slate-500/25 transition-transform duration-300 group-hover:-rotate-6">
          <HardDrive className="size-4.5 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold tracking-tight">Offline Vault</h3>
          <p className="mt-0.5 text-[11px] text-white/40">
            Everything cached for flight mode — inspect it yourself.
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-emerald-300">
          <BadgeCheck className="size-3" /> PWA
        </span>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-2.5">
        <div className="flex items-center justify-between text-[10px] font-semibold">
          <span className="uppercase tracking-wider text-white/35">Local storage</span>
          <span className="tabular text-white/70">
            {storage ? formatBytes(storage.usage) : "…"} used{" "}
            <span className="text-white/30">
              / {storage && storage.quota ? formatBytes(storage.quota) : ""}
            </span>
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ type: "spring", stiffness: 120, damping: 22 }}
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-emerald-400"
          />
        </div>
        <div className="mt-2 text-[9.5px] text-white/30">
          Live read from your browser&apos;s storage API
        </div>
      </div>

      <div className="mt-auto grid grid-cols-3 gap-1.5">
        {VAULT_ROWS.map((r) => (
          <div
            key={r.label}
            className="flex flex-col items-center gap-1 rounded-2xl border border-white/[0.06] bg-black/25 px-1 py-2"
          >
            <CheckCircle2 className="size-3.5 text-emerald-300" />
            <span className="text-center text-[8.5px] font-semibold leading-tight text-white/45">
              {r.label}
            </span>
            <span className="text-[9px] font-bold uppercase tracking-wide text-emerald-300/90">
              {r.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

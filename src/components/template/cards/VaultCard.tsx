"use client";

import { Database, HardDrive, Layers, ShieldCheck } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { CATEGORIES, TOTAL_TOOLS } from "@/lib/template-data";
import { useOnline } from "@/lib/template-hooks";
import { cn, formatNumber } from "@/lib/template-utils";

/* Use the Storage API when available so we can show *real* cached size. */
function useStorageEstimate(): { usage?: number; quota?: number } {
  const [v, setV] = useState<{ usage?: number; quota?: number }>({});
  useEffect(() => {
    if (typeof navigator === "undefined") return;
    const nav = navigator as Navigator & {
      storage?: { estimate?: () => Promise<{ usage?: number; quota?: number }> };
    };
    if (nav.storage?.estimate) {
      nav.storage
        .estimate()
        .then((est) => setV({ usage: est.usage, quota: est.quota }))
        .catch(() => setV({}));
    }
  }, []);
  return v;
}

function formatBytes(b?: number) {
  if (!b) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function VaultCard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const online = useOnline();
  const storage = useStorageEstimate();

  const usedPct = storage.quota && storage.usage ? Math.min(100, (storage.usage / storage.quota) * 100) : null;

  return (
    <div ref={ref} className="flex h-full flex-col gap-3.5 p-5 sm:p-6">
      <div className="flex items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-slate-400 to-slate-600 shadow-[0_8px_18px_-6px_rgba(148,163,184,0.5),inset_0_1px_0_rgba(255,255,255,0.35)]">
          <HardDrive className="size-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold tracking-tight">Offline Vault</h3>
          <p className="text-[11px] text-white/40">
            Service worker keeps tools ready, signed in or signed out
          </p>
        </div>
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
            online
              ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300"
              : "border-amber-400/30 bg-amber-400/[0.08] text-amber-300"
          )}
        >
          <ShieldCheck className="size-3" />
          {online ? "cache online" : "cache live"}
        </span>
      </div>

      {/* storage ring */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-4 rounded-2xl border border-white/[0.07] bg-black/30 px-3.5 py-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="relative grid size-[78px] place-items-center">
          <svg viewBox="0 0 100 100" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              fill="none"
              stroke="url(#vaultGrad)"
              strokeWidth="9"
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: (usedPct ?? 14) / 100 } : {}}
              transition={{ duration: 1.4, ease: "easeOut" }}
              style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.5))" }}
            />
            <defs>
              <linearGradient id="vaultGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22d3ee" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
          </svg>
          <div className="text-center">
            <div className="tabular text-[15px] font-extrabold leading-none">
              {usedPct !== null ? `${usedPct.toFixed(1)}%` : "—"}
            </div>
            <div className="mt-0.5 text-[8px] font-bold uppercase tracking-wider text-white/40">
              filled
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[10.5px]">
          <Row label="in use" value={formatBytes(storage.usage)} />
          <Row label="quota" value={formatBytes(storage.quota)} />
          <Row label="tools" value={formatNumber(TOTAL_TOOLS)} />
          <Row label="categories" value={formatNumber(CATEGORIES.length)} />
        </div>
      </div>

      {/* category chips */}
      <div className="flex flex-wrap items-center gap-1.5">
        {CATEGORIES.slice(0, 6).map((c) => {
          const Icon = c.icon;
          return (
            <span
              key={c.id}
              className="inline-flex items-center gap-1 rounded-full border border-white/[0.07] bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-white/55"
            >
              <Icon className="size-3" />
              {c.short}
              <span className="tabular text-white/35">{formatNumber(c.count)}</span>
            </span>
          );
        })}
        <span className="inline-flex items-center gap-1 rounded-full border border-white/[0.05] bg-white/[0.03] px-2 py-0.5 text-[10px] font-medium text-white/35">
          <Database className="size-3" /> <Layers className="size-3" /> +{Math.max(CATEGORIES.length - 6, 0)} more
        </span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-1.5">
      <span className="text-white/40">{label}</span>
      <span className="tabular font-bold text-white/85">{value}</span>
    </div>
  );
}

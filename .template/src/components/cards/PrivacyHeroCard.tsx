"use client";

import { EyeOff, HardDrive, ShieldCheck, Upload, Wifi, WifiOff } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import type { ReactNode } from "react";
import { TOTAL_TOOLS } from "@/lib/tools-data";
import { useCountUp, useOnline } from "@/lib/hooks";
import { cn, formatNumber } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/*  Iconic Samsung Health concentric tri-ring tracker                  */
/*  ─ Outer (emerald): Privacy core — zero network telemetry           */
/*  ─ Middle (cyan):   1,679 tools cached & offline-ready              */
/*  ─ Inner  (violet): 0 KB data sent — in-memory processing           */
/* ------------------------------------------------------------------ */

const RINGS = [
  { id: "heroG1", r: 68, c1: "#10b981", c2: "#6ee7b7", glow: "rgba(16,185,129,0.55)", pct: 1, dur: 1.7 },
  { id: "heroG2", r: 52, c1: "#06b6d4", c2: "#67e8f9", glow: "rgba(34,211,238,0.55)", pct: 1, dur: 1.95 },
  { id: "heroG3", r: 36, c1: "#8b5cf6", c2: "#d8b4fe", glow: "rgba(167,139,250,0.55)", pct: 1, dur: 2.2 },
];

function TriRings({ run }: { run: boolean }) {
  return (
    <svg viewBox="0 0 160 160" className="absolute inset-0 size-full -rotate-90">
      <defs>
        {RINGS.map((r) => (
          <linearGradient key={r.id} id={r.id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={r.c1} />
            <stop offset="100%" stopColor={r.c2} />
          </linearGradient>
        ))}
      </defs>
      {RINGS.map((r) => (
        <g key={r.id}>
          <circle
            cx="80"
            cy="80"
            r={r.r}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth="10"
          />
          <motion.circle
            cx="80"
            cy="80"
            r={r.r}
            fill="none"
            stroke={`url(#${r.id})`}
            strokeWidth="10"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={run ? { pathLength: r.pct } : {}}
            transition={{ duration: r.dur, ease: [0.65, 0, 0.35, 1] }}
            style={{ filter: `drop-shadow(0 0 7px ${r.glow})` }}
          />
        </g>
      ))}
    </svg>
  );
}

const LEGEND = [
  { color: "bg-emerald-300", ring: "ring-emerald-300/40", label: "Privacy core", value: "100%" },
  { color: "bg-cyan-300", ring: "ring-cyan-300/40", label: "Tools cached", value: formatNumber(TOTAL_TOOLS) },
  { color: "bg-violet-300", ring: "ring-violet-300/40", label: "Data sent", value: "0 KB" },
];

function Stat({
  icon,
  value,
  label,
  accent,
}: {
  icon: ReactNode;
  value: string;
  label: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-1.5 text-white/40">
        {icon}
        <span className="text-[9.5px] font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <div className={cn("tabular mt-1 text-[15px] font-bold", accent)}>{value}</div>
    </div>
  );
}

export default function PrivacyHeroCard() {
  const online = useOnline();
  const ringRef = useRef<HTMLDivElement>(null);
  const inView = useInView(ringRef, { once: true, margin: "-60px" });
  const tools = useCountUp(TOTAL_TOOLS, inView, 1900);

  return (
    <div className="flex h-full flex-col justify-between gap-4 p-5 sm:p-6">
      {/* top row */}
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-300 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-300" />
          </span>
          Privacy Engine
        </span>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
            online
              ? "border-cyan-400/25 bg-cyan-400/10 text-cyan-300"
              : "border-amber-400/25 bg-amber-400/10 text-amber-300"
          )}
        >
          {online ? <Wifi className="size-3" /> : <WifiOff className="size-3" />}
          {online ? "Online" : "Offline — fully covered"}
        </span>
      </div>

      {/* middle: rings + copy/legend */}
      <div className="grid grid-cols-[auto_1fr] items-center gap-5">
        <div
          ref={ringRef}
          className="relative grid size-[136px] place-items-center sm:size-[152px]"
        >
          {/* ambient glow + pulse rings behind the tracker */}
          <span className="absolute inset-6 rounded-full bg-emerald-500/15 blur-2xl" />
          <span className="pulse-ring pointer-events-none absolute inset-4 rounded-full border border-emerald-400/25" />
          <span className="pulse-ring-slow pointer-events-none absolute inset-4 rounded-full border border-cyan-400/20" />
          <TriRings run={inView} />
          <div className="relative text-center">
            <div className="tabular text-[24px] font-extrabold leading-none tracking-tight sm:text-[27px]">
              100<span className="align-top text-[14px]">%</span>
            </div>
            <div className="mt-1 text-[8.5px] font-bold uppercase tracking-[0.2em] text-white/40">
              On-device
            </div>
          </div>
        </div>

        <div className="min-w-0">
          <h2 className="text-balance text-xl font-bold leading-tight tracking-tight sm:text-[22px]">
            Your data never{" "}
            <span className="bg-gradient-to-r from-emerald-300 via-cyan-300 to-violet-300 bg-clip-text text-transparent">
              leaves this tab.
            </span>
          </h2>
          <div className="mt-3 flex flex-col gap-2">
            {LEGEND.map((l, i) => (
              <motion.div
                key={l.label}
                initial={{ opacity: 0, x: 12 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.25 + i * 0.12 }}
                className="flex items-center gap-2 text-[11px]"
              >
                <span className={cn("size-2 rounded-full ring-2", l.color, l.ring)} />
                <span className="flex-1 truncate text-white/45">{l.label}</span>
                <span className="tabular font-bold text-white/90">{l.value}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="grid grid-cols-3 gap-2">
        <Stat
          icon={<ShieldCheck className="size-3" />}
          value={inView ? formatNumber(tools) : "0"}
          label="tools ready"
          accent="text-white"
        />
        <Stat
          icon={<EyeOff className="size-3" />}
          value="0"
          label="trackers"
          accent="text-emerald-300"
        />
        <Stat
          icon={<Upload className="size-3" />}
          value="0 bytes"
          label="uploaded"
          accent="text-emerald-300"
        />
      </div>

      {/* cache strip */}
      <div className="flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <span className="flex size-7 items-center justify-center rounded-lg bg-gradient-to-br from-emerald-400 to-cyan-600 shadow-[0_6px_16px_-4px_rgba(16,185,129,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]">
          <HardDrive className="size-3.5 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-white/75">Offline vault cache</span>
            <span className="tabular text-[10px] font-bold uppercase tracking-wider text-emerald-300">
              Ready
            </span>
          </div>
          <div className="relative mt-1.5 h-1 overflow-hidden rounded-full bg-white/[0.08]">
            <div className="absolute inset-y-0 left-0 w-full rounded-full bg-gradient-to-r from-emerald-500/70 via-cyan-500/70 to-violet-500/70" />
            <div className="shimmer-x absolute inset-y-0 w-1/3 rounded-full bg-gradient-to-r from-transparent via-white/50 to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}

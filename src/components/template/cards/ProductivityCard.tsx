"use client";

import { Activity, Clock, Timer, Zap } from "lucide-react";
import { motion, useInView } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { TOTAL_TOOLS, CATEGORIES } from "@/lib/template-data";
import { useCountUp } from "@/lib/template-hooks";
import { cn, formatNumber } from "@/lib/template-utils";

const SECOND = 1_000;
const MINUTE = 60 * SECOND;

/** A small "live-ish" activity strip. Pure decoration. */
function useFakeTicker(intervalMs: number) {
  const [v, setV] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setV((x) => x + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return v;
}

export default function ProductivityCard() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const toolsCount = useCountUp(TOTAL_TOOLS, inView, 1800);
  const catCount = useCountUp(CATEGORIES.length, inView, 1400);

  const t = useFakeTicker(2200);
  const angle = (t * 7) % 360;

  const speedBars = [40, 65, 35, 80, 55, 90, 70, 50, 75, 60, 88, 42];
  const peak = Math.max(...speedBars);

  return (
    <div
      ref={ref}
      className="flex h-full flex-col justify-between gap-4 p-5 sm:p-6"
    >
      {/* heading row */}
      <div className="flex items-center gap-2.5">
        <span
          className="flex size-9 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 shadow-[0_10px_24px_-6px_rgba(139,92,246,0.55),inset_0_1px_0_rgba(255,255,255,0.4)]"
        >
          <Activity className="size-4 text-white" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-[15px] font-bold tracking-tight">Productivity Index</h3>
          <p className="text-[11px] text-white/40">Live pulse across the dashboard</p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/[0.08] px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-300">
          <span className="size-1 animate-pulse rounded-full bg-emerald-300" />
          steady
        </span>
      </div>

      {/* big numbers */}
      <div className="grid grid-cols-2 gap-2">
        <StatBig
          label="tools ready"
          value={formatNumber(toolsCount)}
          accent="from-sky-300 to-violet-400"
        />
        <StatBig
          label="categories"
          value={formatNumber(catCount)}
          accent="from-emerald-300 to-cyan-300"
        />
      </div>

      {/* speed / activity strip */}
      <div className="rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
        <div className="mb-1.5 flex items-center justify-between text-[10.5px] font-semibold text-white/45">
          <span className="flex items-center gap-1">
            <Zap className="size-3 text-cyan-300" /> Throughput
          </span>
          <span className="tabular text-emerald-300">{peak} ops/s</span>
        </div>
        <div className="flex h-9 items-end gap-[3px]">
          {speedBars.map((h, i) => (
            <motion.span
              key={i}
              initial={{ height: 0 }}
              animate={inView ? { height: `${h}%` } : {}}
              transition={{ duration: 0.5, delay: 0.05 * i, ease: "easeOut" }}
              className={cn(
                "block w-2 rounded-sm bg-gradient-to-t from-cyan-400/30 to-violet-400/70",
                i % 5 === 0 && "from-emerald-400/40 to-cyan-400"
              )}
            />
          ))}
        </div>
      </div>

      {/* mini stats */}
      <div className="grid grid-cols-3 gap-2 text-[10.5px]">
        <Mini icon={<Timer className="size-3 text-amber-300" />} value="<60ms" label="start time" />
        <Mini icon={<Clock className="size-3 text-cyan-300" />} value="24h" label="ttl cache" />
        <Mini
          icon={<Zap className="size-3 text-violet-300" />}
          value="100%"
          label="client-side"
        />
      </div>

      {/* rotating dial (subtle flair) */}
      <div
        aria-hidden="true"
        style={{ transform: `rotate(${angle}deg)` }}
        className="pointer-events-none absolute right-4 top-4 size-10 rounded-full border border-white/[0.06] border-t-cyan-300/60 transition-transform"
      />
    </div>
  );
}

function StatBig({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className={cn("tabular bg-gradient-to-r bg-clip-text text-[22px] font-extrabold leading-none tracking-tight text-transparent", accent)}>
        {value}
      </div>
      <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/40">
        {label}
      </div>
    </div>
  );
}

function Mini({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <div className="rounded-xl border border-white/[0.07] bg-black/30 px-2.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
      <div className="flex items-center gap-1 text-white/55">{icon}<span className="tabular font-bold text-white/85">{value}</span></div>
      <div className="text-[9px] font-semibold uppercase tracking-wider text-white/35">{label}</div>
    </div>
  );
}

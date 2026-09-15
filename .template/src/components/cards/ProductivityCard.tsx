"use client";

import { Activity, TrendingUp } from "lucide-react";
import { motion } from "framer-motion";

const AXES = ["Tools", "Speed", "Data", "Focus", "Streak"];
const VALUES = [0.82, 0.9, 0.74, 0.66, 0.96];
const C = 100;
const R = 66;

function pt(i: number, v: number, radius = R) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / AXES.length;
  return [C + Math.cos(a) * radius * v, C + Math.sin(a) * radius * v] as const;
}
const polygon = (vs: number[], radius = R) => vs.map((v, i) => pt(i, v, radius).join(",")).join(" ");

const LEGEND = [
  { label: "Tools used", value: "46", dot: "bg-cyan-300" },
  { label: "Data kept local", value: "128 MB", dot: "bg-violet-300" },
  { label: "Time saved", value: "3.4 h", dot: "bg-emerald-300" },
];

export default function ProductivityCard() {
  return (
    <div className="flex h-full flex-col gap-4 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-violet-500 shadow-lg shadow-violet-500/25 transition-transform duration-300 group-hover:-rotate-6">
          <Activity className="size-4.5 text-white" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-tight">Productivity Index</h3>
          <p className="text-[11px] text-white/40">Your local efficiency radar</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
          <TrendingUp className="size-3" /> +12%
        </span>
      </div>

      <div className="flex flex-1 items-center gap-4">
        {/* radar */}
        <svg viewBox="0 0 200 200" className="size-36 shrink-0 sm:size-40">
          <defs>
            <linearGradient id="radarGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#22d3ee" />
              <stop offset="100%" stopColor="#a78bfa" />
            </linearGradient>
          </defs>

          {[1, 0.66, 0.33].map((k) => (
            <polygon
              key={k}
              points={polygon(AXES.map(() => k))}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
            />
          ))}
          {AXES.map((_, i) => {
            const [x, y] = pt(i, 1);
            return (
              <line key={i} x1={C} y1={C} x2={x} y2={y} stroke="rgba(255,255,255,0.06)" />
            );
          })}

          <motion.polygon
            points={polygon(VALUES)}
            fill="url(#radarGrad)"
            fillOpacity={0.22}
            stroke="url(#radarGrad)"
            strokeWidth={2}
            strokeLinejoin="round"
            initial={{ scale: 0.4, opacity: 0 }}
            whileInView={{ scale: 1, opacity: 1 }}
            viewport={{ once: true, margin: "-40px" }}
            transition={{ type: "spring", stiffness: 120, damping: 16, delay: 0.15 }}
            style={{ transformOrigin: "100px 100px" }}
          />
          {VALUES.map((v, i) => {
            const [x, y] = pt(i, v);
            return (
              <motion.circle
                key={i}
                cx={x}
                cy={y}
                r={2.6}
                fill="#22d3ee"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: 0.35 + i * 0.06, type: "spring", stiffness: 400, damping: 16 }}
                style={{ transformOrigin: `${x}px ${y}px` }}
              />
            );
          })}

          {AXES.map((label, i) => {
            const [x, y] = pt(i, 1.24);
            return (
              <text
                key={label}
                x={x}
                y={y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={9}
                fontWeight={600}
                fill="rgba(255,255,255,0.4)"
              >
                {label}
              </text>
            );
          })}
        </svg>

        {/* score + legend */}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className="tabular bg-gradient-to-r from-cyan-300 to-violet-300 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              92
            </span>
            <span className="text-[11px] font-semibold text-white/35">/ 100</span>
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {LEGEND.map((l) => (
              <div key={l.label} className="flex items-center gap-2 text-[11px]">
                <span className={`size-1.5 rounded-full ${l.dot}`} />
                <span className="flex-1 truncate text-white/45">{l.label}</span>
                <span className="tabular font-bold text-white/85">{l.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-white/[0.06] bg-black/25 px-3 py-2 text-[10.5px] leading-relaxed text-white/40">
        Telemetry is computed <span className="font-semibold text-white/70">on-device</span> — even
        your stats stay private.
      </div>
    </div>
  );
}

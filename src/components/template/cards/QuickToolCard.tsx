"use client";

import { Binary, Braces, Check, Fingerprint, KeyRound, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";

import { Base64Tool, PasswordTool, UuidTool } from "@/components/template/mini-tools";
import CopyButton from "@/components/template/ui/CopyButton";
import { cn } from "@/lib/template-utils";

/* Compact JSON prettifier for the Quick Tools widget. */
function JsonMini() {
  const [input, setInput] = useState('{"privacy":"default","offline":true,"tools":1679}');
  const [out, setOut] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const run = (minify: boolean) => {
    try {
      const v = JSON.parse(input);
      setOut(JSON.stringify(v, null, minify ? 0 : 2));
      setErr("");
    } catch (e) {
      setOut(null);
      setErr(e instanceof Error ? e.message.split(" at ")[0] : "Invalid JSON");
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={2}
        spellCheck={false}
        placeholder="Paste JSON…"
        className="w-full resize-none rounded-2xl border border-white/[0.08] bg-black/40 px-3 py-2 font-mono text-[11.5px] leading-relaxed text-white/85 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)] placeholder:text-white/25 focus:border-emerald-400/40 focus:outline-none"
      />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => run(false)}
          className="cursor-pointer rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-2.5 py-1.5 text-[11px] font-bold text-emerald-200 transition-colors hover:bg-emerald-400/20"
        >
          Format
        </button>
        <button
          type="button"
          onClick={() => run(true)}
          className="cursor-pointer rounded-xl border border-white/[0.1] bg-white/[0.06] px-2.5 py-1.5 text-[11px] font-bold text-white/75 transition-colors hover:bg-white/[0.12]"
        >
          Minify
        </button>
        <CopyButton
          text={out ?? ""}
          iconOnly
          className={cn("ml-auto px-2 py-1.5", !out && "pointer-events-none opacity-30")}
        />
      </div>
      {err ? (
        <div className="truncate rounded-xl border border-red-400/20 bg-red-400/[0.07] px-2.5 py-1.5 text-[10.5px] font-medium text-red-300">
          {err}
        </div>
      ) : out ? (
        <div className="flex items-center gap-1.5 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-2.5 py-1.5 text-[10.5px] font-medium text-emerald-300">
          <Check className="size-3" /> Valid JSON — copy ready
        </div>
      ) : (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[10.5px] text-white/30">
          Prettify or compress instantly — nothing leaves the tab.
        </div>
      )}
      <AnimatePresence>
        {out && (
          <motion.pre
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="max-h-24 overflow-auto rounded-2xl border border-white/[0.07] bg-black/40 p-2.5 font-mono text-[10.5px] leading-relaxed text-emerald-100/90 shadow-[inset_0_2px_6px_rgba(0,0,0,0.45)]"
          >
            {out}
          </motion.pre>
        )}
      </AnimatePresence>
    </div>
  );
}

const TABS = [
  { id: "password", label: "Password", icon: KeyRound },
  { id: "base64", label: "Base64", icon: Binary },
  { id: "uuid", label: "UUID", icon: Fingerprint },
  { id: "json", label: "JSON", icon: Braces },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function QuickToolCard() {
  const [tab, setTab] = useState<TabId>("password");

  return (
    <div className="flex h-full flex-col gap-3.5 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_10px_24px_-6px_rgba(34,211,238,0.55),inset_0_1px_0_rgba(255,255,255,0.4)] transition-transform duration-300 group-hover:-rotate-6">
          <Zap className="size-4.5 text-white" fill="currentColor" />
        </span>
        <div className="min-w-0">
          <h3 className="text-[15px] font-bold tracking-tight">Quick Tools</h3>
          <p className="text-[11px] text-white/40">Live utilities · zero network</p>
        </div>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-white/[0.09] bg-white/[0.05] px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider text-white/45 shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]">
          <span className="size-1 animate-pulse rounded-full bg-cyan-300" />
          live
        </span>
      </div>

      {/* segmented control */}
      <div className="relative flex rounded-2xl border border-white/[0.08] bg-black/40 p-1 shadow-[inset_0_2px_8px_rgba(0,0,0,0.45)]">
        {TABS.map(({ id, label, icon: Icon }) => {
          const active = tab === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={cn(
                "relative flex flex-1 cursor-pointer items-center justify-center gap-1 rounded-xl py-1.5 text-[10.5px] font-semibold transition-colors",
                active ? "text-white" : "text-white/40 hover:text-white/75"
              )}
            >
              {active && (
                <motion.span
                  layoutId="qt-active-tab"
                  className="absolute inset-0 rounded-xl border border-cyan-400/25 bg-gradient-to-b from-cyan-400/25 to-blue-500/10 shadow-[0_4px_16px_-4px_rgba(34,211,238,0.45),inset_0_1px_0_rgba(255,255,255,0.15)]"
                  transition={{ type: "spring", stiffness: 430, damping: 32 }}
                />
              )}
              <Icon className="relative size-3.5" />
              <span className="relative hidden min-[400px]:inline">{label}</span>
            </button>
          );
        })}
      </div>

      {/* body */}
      <div className="relative min-h-[168px] flex-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -8, filter: "blur(4px)" }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {tab === "password" && <PasswordTool compact />}
            {tab === "base64" && <Base64Tool compact />}
            {tab === "uuid" && <UuidTool />}
            {tab === "json" && <JsonMini />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

"use client";

import { ShieldCheck, Star, WifiOff, X, Zap } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";
import { MINI_TOOLS } from "@/components/mini-tools";
import type { FlatTool } from "@/lib/tools-data";
import { cn } from "@/lib/utils";

const LIVE_FEATURES = [
  { icon: WifiOff, text: "Fully offline — no network calls" },
  { icon: ShieldCheck, text: "Zero uploads, zero tracking" },
  { icon: Zap, text: "Instant compute via WASM / WebCrypto" },
];

export default function ToolModal({
  tool,
  onClose,
  isFav,
  onToggleFav,
}: {
  tool: FlatTool | null;
  onClose: () => void;
  isFav: boolean;
  onToggleFav: (id: string) => void;
}) {
  const [launched, setLaunched] = useState(false);
  useEffect(() => setLaunched(false), [tool?.id]);

  const Mini = tool ? MINI_TOOLS[tool.id] : undefined;

  return (
    <AnimatePresence>
      {tool && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ type: "spring", stiffness: 360, damping: 30 }}
            className={cn(
              "relative max-h-[85dvh] w-full max-w-md overflow-y-auto rounded-[28px] border border-white/[0.09] bg-[#0D1322]/95 p-5 shadow-[0_40px_90px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl"
            )}
          >
            {/* glow */}
            <div
              className={cn(
                "pointer-events-none absolute -right-16 -top-16 size-44 rounded-full opacity-70 blur-3xl",
                tool.category.blob
              )}
            />

            {/* header */}
            <div className="relative flex items-start gap-3">
              <span
                className={cn(
                  "flex size-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br shadow-lg",
                  tool.category.iconTile,
                  tool.category.iconShadow
                )}
              >
                <tool.icon className="size-5 text-white" />
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-bold leading-tight tracking-tight">{tool.name}</h2>
                <span
                  className={cn(
                    "mt-1 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9.5px] font-bold uppercase tracking-wider",
                    tool.category.chipBorder,
                    tool.category.chipBg,
                    tool.category.text
                  )}
                >
                  <span className={cn("size-1 rounded-full", tool.category.dot)} />
                  {tool.category.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onToggleFav(tool.id)}
                aria-label="Toggle favorite"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] transition-colors hover:bg-white/[0.12]"
              >
                <motion.span
                  key={String(isFav)}
                  initial={{ scale: 0.4, rotate: -40 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 500, damping: 20 }}
                  className="inline-flex"
                >
                  <Star
                    className={cn(
                      "size-4 transition-colors",
                      isFav ? "fill-amber-300 text-amber-300" : "text-white/45"
                    )}
                  />
                </motion.span>
              </button>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* body */}
            <div className="relative mt-4">
              {Mini ? (
                <Mini />
              ) : (
                <div className="flex flex-col gap-3">
                  <p className="text-[12.5px] leading-relaxed text-white/55">{tool.blurb}.</p>
                  <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.06] bg-black/25 p-3">
                    {LIVE_FEATURES.map((f) => (
                      <div key={f.text} className="flex items-center gap-2.5 text-[11.5px] text-white/60">
                        <f.icon className={cn("size-3.5", tool.category.text)} />
                        {f.text}
                      </div>
                    ))}
                  </div>
                  <div className="rounded-2xl border border-dashed border-white/[0.12] px-4 py-3 text-center text-[10.5px] leading-relaxed text-white/35">
                    This template ships 4 fully-live demo tools.
                    <br />
                    The other 1,675 run inside the full UnQTools suite.
                  </div>
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.97 }}
                    onClick={() => {
                      setLaunched(true);
                      setTimeout(() => onClose(), 750);
                    }}
                    className={cn(
                      "flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-gradient-to-r py-2.5 text-[12.5px] font-bold text-white shadow-lg",
                      tool.category.iconTile,
                      tool.category.iconShadow
                    )}
                  >
                    {launched ? "Added to vault" : "Add to offline vault"}
                  </motion.button>
                </div>
              )}
            </div>

            <p className="relative mt-4 flex items-center justify-center gap-1.5 text-center text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/25">
              <ShieldCheck className="size-3" /> runs 100% on your device
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

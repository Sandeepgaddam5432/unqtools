"use client";

import { Check, Copy } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export default function CopyButton({
  text,
  label,
  className,
  iconOnly = false,
}: {
  text: string | (() => string);
  label?: string;
  className?: string;
  iconOnly?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const copy = async () => {
    const value = typeof text === "function" ? text() : text;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      try {
        const ta = document.createElement("textarea");
        ta.value = value;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        ta.remove();
      } catch {
        /* noop */
      }
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1400);
  };

  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={copy}
      aria-live="polite"
      className={cn(
        "inline-flex shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-[12px] font-medium text-white/80 transition-colors hover:bg-white/[0.12] hover:text-white",
        copied && "border-emerald-400/30 bg-emerald-400/10 text-emerald-300 hover:text-emerald-300",
        iconOnly && "px-2.5",
        className
      )}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "check" : "copy"}
          initial={{ scale: 0.5, opacity: 0, rotate: -30 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ scale: 0.5, opacity: 0, rotate: 30 }}
          transition={{ type: "spring", stiffness: 500, damping: 26 }}
          className="inline-flex"
        >
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
        </motion.span>
      </AnimatePresence>
      {!iconOnly && (copied ? "Copied" : label ?? "Copy")}
    </motion.button>
  );
}

"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { ReactNode } from "react";
import { cn } from "@/lib/template-utils";

interface Props {
  open: boolean;
  onClose: () => void;
  title?: string;
  side?: "bottom" | "right";
  children: ReactNode;
  className?: string;
}

/** A lightweight bottom-sheet / right-drawer used for overlays. */
export default function Sheet({
  open,
  onClose,
  title,
  side = "bottom",
  children,
  className,
}: Props) {
  // Lock body scroll while open.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const isBottom = side === "bottom";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="scrim"
            className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            aria-hidden="true"
          />
          <motion.div
            key="sheet"
            initial={isBottom ? { y: "100%" } : { x: "100%" }}
            animate={isBottom ? { y: 0 } : { x: 0 }}
            exit={isBottom ? { y: "100%" } : { x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 36 }}
            className={cn(
              "fixed z-50 bg-[#0e1320]/95 text-white shadow-[0_24px_60px_-20px_rgba(0,0,0,0.85)] backdrop-blur-2xl",
              isBottom
                ? "bottom-0 left-0 right-0 max-h-[88vh] overflow-hidden rounded-t-[28px] border-t border-white/[0.08]"
                : "top-0 right-0 bottom-0 w-full max-w-md overflow-y-auto border-l border-white/[0.08]",
              className
            )}
            role="dialog"
            aria-modal="true"
            aria-label={title}
          >
            {title && (
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-3.5">
                <h2 className="text-[14.5px] font-semibold tracking-tight">{title}</h2>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/65 transition-colors hover:bg-white/[0.1]"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            )}
            {children}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

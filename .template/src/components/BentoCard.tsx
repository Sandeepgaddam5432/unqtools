"use client";

import { GripHorizontal, Minus } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { ReactNode, Ref } from "react";
import { cn } from "@/lib/utils";

export interface BentoCardProps {
  children: ReactNode;
  className?: string;
  tint?: string;
  blob?: string;
  editMode?: boolean;
  onRemove?: () => void;
  index?: number;
  ref?: Ref<HTMLDivElement>;
}

/**
 * Signature One UI bento squircle: a tactile frosted-glass "pebble" with
 * specular rim lighting, ambient category glow blobs and spring physics.
 * Doubles as an AnimatePresence (popLayout) child via the forwarded ref.
 */
export default function BentoCard({
  children,
  className,
  tint,
  blob = "bg-cyan-500/20",
  editMode = false,
  onRemove,
  index = 0,
  ref,
}: BentoCardProps) {
  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, y: 26, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.18 } }}
      whileHover={editMode ? undefined : { scale: 1.018, y: -4 }}
      whileTap={editMode ? undefined : { scale: 0.975 }}
      transition={{ type: "spring", stiffness: 320, damping: 27 }}
      className={cn(
        "specular-pebble group relative overflow-hidden rounded-[32px] border border-white/[0.07]",
        "bg-[#111726]/85 backdrop-blur-2xl transition-colors duration-300",
        !editMode && "hover:border-white/[0.13]",
        editMode && "ring-1 ring-white/[0.12]",
        className
      )}
    >
      {/* specular dome — soft top-down light across the glass */}
      <div className="specular-dome pointer-events-none absolute inset-0" />

      {/* top rim light — the single hairline that makes it feel lit */}
      <span className="pointer-events-none absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-white/30 to-transparent" />

      {/* category tint layer */}
      {tint && <div className={cn("pointer-events-none absolute inset-0", tint)} />}

      {/* radiant ambient blobs */}
      <div
        className={cn(
          "pointer-events-none absolute -right-14 -top-16 size-52 rounded-full opacity-70 blur-[90px] transition-all duration-700 group-hover:scale-110 group-hover:opacity-100",
          blob
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute -bottom-20 -left-16 size-44 rounded-full opacity-30 blur-[100px] transition-opacity duration-700 group-hover:opacity-60",
          blob
        )}
      />

      {/* specular sheen sweep on hover */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[32px]">
        <div className="absolute inset-y-[-45%] left-0 w-1/3 -translate-x-[180%] rotate-12 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent transition-transform duration-[1100ms] ease-out group-hover:translate-x-[480%]" />
      </div>

      {/* content (jiggles in edit mode) */}
      <div
        className={cn("relative h-full", editMode && "jiggle")}
        style={editMode ? { animationDelay: `${(index % 5) * 70}ms` } : undefined}
      >
        {children}
      </div>

      {/* edit chrome: remove badge */}
      <AnimatePresence>
        {editMode && onRemove && (
          <motion.button
            key="remove"
            type="button"
            initial={{ scale: 0, rotate: -120, opacity: 0 }}
            animate={{ scale: 1, rotate: 0, opacity: 1 }}
            exit={{ scale: 0, rotate: 120, opacity: 0 }}
            transition={{ type: "spring", stiffness: 480, damping: 22 }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.85 }}
            onClick={onRemove}
            aria-label="Remove widget"
            className="absolute left-3 top-3 z-30 flex size-7 cursor-pointer items-center justify-center rounded-full bg-gradient-to-b from-red-400 to-red-600 text-white shadow-[0_6px_16px_-2px_rgba(239,68,68,0.6),inset_0_1px_0_rgba(255,255,255,0.35)]"
          >
            <Minus className="size-3.5" strokeWidth={3.2} />
          </motion.button>
        )}
      </AnimatePresence>

      {/* edit chrome: drag handle */}
      <AnimatePresence>
        {editMode && (
          <motion.div
            key="grip"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="pointer-events-none absolute bottom-2 left-1/2 z-30 -translate-x-1/2 rounded-full border border-white/[0.08] bg-white/[0.06] px-2 py-0.5 backdrop-blur-md"
          >
            <GripHorizontal className="size-3.5 text-white/45" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

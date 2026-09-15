"use client";

import { X } from "lucide-react";
import { AnimatePresence, motion, useDragControls } from "framer-motion";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A Samsung-style bottom sheet (centered card on desktop) with drag-to-dismiss. */
export default function Sheet({
  open,
  onClose,
  title,
  subtitle,
  headerRight,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
  wide?: boolean;
}) {
  const controls = useDragControls();

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: "110%", opacity: 0.6 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "110%", opacity: 0.6 }}
            transition={{ type: "spring", stiffness: 340, damping: 34 }}
            drag="y"
            dragListener={false}
            dragControls={controls}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (info.offset.y > 110 || info.velocity.y > 650) onClose();
            }}
            className={cn(
              "relative flex max-h-[84dvh] w-full flex-col overflow-hidden rounded-t-[28px] border border-white/[0.08] bg-[#0E1320]/95 shadow-[0_-18px_60px_-20px_rgba(0,0,0,0.8)] backdrop-blur-2xl sm:max-h-[80dvh] sm:rounded-[28px] sm:shadow-2xl",
              wide ? "sm:max-w-2xl" : "sm:max-w-lg"
            )}
          >
            {/* drag handle */}
            <div
              className="grid shrink-0 cursor-grab touch-none place-items-center pb-1 pt-2.5 active:cursor-grabbing"
              onPointerDown={(e) => controls.start(e)}
            >
              <span className="h-1 w-10 rounded-full bg-white/15" />
            </div>

            <div className="flex shrink-0 items-center gap-3 px-5 pb-3 pt-1">
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-bold tracking-tight">{title}</h2>
                {subtitle && <p className="mt-0.5 text-[11.5px] text-white/40">{subtitle}</p>}
              </div>
              {headerRight}
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-white/60 transition-colors hover:bg-white/[0.12] hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

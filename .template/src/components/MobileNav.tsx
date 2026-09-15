"use client";

import { Home, Layers3, LayoutGrid, Plus, Settings2, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";
import { useState } from "react";
import { cn } from "@/lib/utils";

const ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "tools", label: "All Tools", icon: LayoutGrid },
  { id: "categories", label: "Categories", icon: Layers3 },
  { id: "vault", label: "Vault", icon: ShieldCheck },
  { id: "settings", label: "Settings", icon: Settings2 },
];

export default function MobileNav({
  onNavigate,
  onQuickAdd,
}: {
  onNavigate: (id: string) => void;
  onQuickAdd: () => void;
}) {
  const [active, setActive] = useState("home");

  return (
    <>
      {/* bottom bar (mobile) */}
      <nav className="fixed inset-x-3 bottom-3 z-40 md:hidden">
        <div className="flex items-stretch justify-between rounded-[26px] border border-white/[0.08] bg-[#0E1320]/85 p-1.5 shadow-[0_18px_50px_-12px_rgba(0,0,0,0.8)] backdrop-blur-2xl">
          {ITEMS.map((item) => {
            const isActive = active === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  setActive(item.id);
                  onNavigate(item.id);
                }}
                className={cn(
                  "relative flex flex-1 cursor-pointer flex-col items-center gap-0.5 rounded-[20px] py-2 transition-colors",
                  isActive ? "text-cyan-300" : "text-white/40"
                )}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-pill"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                    className="absolute inset-0 rounded-[20px] border border-cyan-400/[0.16] bg-cyan-400/[0.08]"
                  />
                )}
                <item.icon className="relative size-[18px]" />
                <span className="relative text-[9px] font-semibold leading-none">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* floating quick-add (all breakpoints) */}
      <motion.button
        type="button"
        onClick={onQuickAdd}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.9, rotate: 90 }}
        transition={{ type: "spring", stiffness: 400, damping: 22 }}
        aria-label="Quick add tool"
        className="fixed bottom-24 right-4 z-40 flex size-13 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_14px_40px_-8px_rgba(34,211,238,0.55)] md:bottom-6 md:right-6"
      >
        <span className="absolute inset-0 animate-ping rounded-full bg-cyan-400/30 [animation-duration:2.4s]" />
        <Plus className="relative size-6" strokeWidth={2.5} />
      </motion.button>
    </>
  );
}

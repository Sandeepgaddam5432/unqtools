"use client";

import { Compass, Grid3x3, Home, Plus, Search, Settings as SettingsIcon } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/template-utils";

interface Props {
  onNavigate: (id: "home" | "tools" | "categories" | "vault" | "settings") => void;
  onQuickAdd: () => void;
  active?: "home" | "tools" | "categories" | "vault" | "settings";
}

export default function MobileNav({ onNavigate, onQuickAdd, active = "home" }: Props) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.06] bg-[#090D16]/85 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 backdrop-blur-2xl md:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-between gap-1">
        <Item icon={Home} label="Home" active={active === "home"} onClick={() => onNavigate("home")} />
        <Item icon={Compass} label="Tools" active={active === "tools"} onClick={() => onNavigate("tools")} />
        <li>
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Quick add"
            className="relative mx-auto -mt-7 flex size-12 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_12px_28px_-8px_rgba(34,211,238,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-95"
          >
            <Plus className="size-5" strokeWidth={2.6} />
          </button>
        </li>
        <Item
          icon={Grid3x3}
          label="Categories"
          active={active === "categories"}
          onClick={() => onNavigate("categories")}
        />
        <Item
          icon={SettingsIcon}
          label="Settings"
          active={active === "settings"}
          onClick={() => onNavigate("settings")}
        />
      </ul>
    </nav>
  );
}

function Item({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <motion.button
        type="button"
        whileTap={{ scale: 0.92 }}
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex w-14 cursor-pointer flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
          active ? "text-white" : "text-white/45 hover:text-white/80"
        )}
      >
        <Icon className="size-[18px]" />
        <span>{label}</span>
      </motion.button>
    </li>
  );
}

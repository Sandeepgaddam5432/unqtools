"use client";

import {
  Activity,
  Calculator,
  Code2,
  FileText,
  HardDrive,
  History,
  Image,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Type,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import BentoCard from "@/components/BentoCard";
import Header from "@/components/Header";
import CategorySwitcher from "@/components/CategorySwitcher";
import MobileNav from "@/components/MobileNav";
import Directory from "@/components/Directory";
import CommandPalette from "@/components/overlays/CommandPalette";
import QuickAddSheet from "@/components/overlays/QuickAddSheet";
import EditSheet from "@/components/overlays/EditSheet";
import type { WidgetMeta } from "@/components/overlays/EditSheet";
import ToolModal from "@/components/overlays/ToolModal";

import PrivacyHeroCard from "@/components/cards/PrivacyHeroCard";
import QuickToolCard from "@/components/cards/QuickToolCard";
import RecentCard from "@/components/cards/RecentCard";
import ProductivityCard from "@/components/cards/ProductivityCard";
import {
  AiCard,
  CalcCard,
  DevCard,
  ImageCard,
  PdfCard,
  SecurityCard,
  SeoCard,
  TextCard,
  VaultCard,
} from "@/components/cards/CategoryCards";

import { CATEGORIES, findTool } from "@/lib/tools-data";
import { useLocalStorage } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/* ------------------------------ registry ------------------------------ */

type Launch = (id: string) => void;

interface WidgetDef {
  id: string;
  name: string;
  size: string;
  icon: LucideIcon;
  tile: string;
  core?: boolean;
  cats: string[];
  span: string;
  tint?: string;
  blob?: string;
  minH: string;
  render: (launch: Launch) => ReactNode;
}

const tileOf = (id: string) => CATEGORIES.find((c) => c.id === id)?.iconTile ?? "from-slate-400 to-slate-600";
const blobOf = (id: string) => CATEGORIES.find((c) => c.id === id)?.blob ?? "bg-slate-500/20";
const tintOf = (id: string) => CATEGORIES.find((c) => c.id === id)?.cardTint;
const catOf = (id: string) => CATEGORIES.find((c) => c.id === id);

const HALF = "sm:col-span-1 lg:col-span-2";
const WIDE_MIN = "min-h-[300px]";
const SQ_MIN = "min-h-[264px]";

const WIDGETS: WidgetDef[] = [
  {
    id: "hero",
    name: "Privacy & Offline Engine",
    size: "Wide · 4×2",
    icon: ShieldCheck,
    tile: "from-cyan-500 to-emerald-500",
    core: true,
    cats: [],
    span: "sm:col-span-2",
    tint: "bg-[linear-gradient(120deg,rgba(6,182,212,0.1),rgba(16,185,129,0.05)_50%,transparent_80%)]",
    blob: "bg-cyan-500/[0.14]",
    minH: WIDE_MIN,
    render: () => <PrivacyHeroCard />,
  },
  {
    id: "quick",
    name: "Quick Tools",
    size: "Wide · 4×2",
    icon: Zap,
    tile: "from-cyan-500 to-blue-600",
    core: true,
    cats: [],
    span: "sm:col-span-2",
    tint: "bg-[linear-gradient(120deg,rgba(6,182,212,0.09),transparent_60%)]",
    blob: "bg-blue-500/[0.14]",
    minH: WIDE_MIN,
    render: () => <QuickToolCard />,
  },
  {
    id: "recent",
    name: "Pinned & Recent",
    size: "Strip · 4×1",
    icon: History,
    tile: "from-slate-400 to-slate-600",
    core: true,
    cats: [],
    span: "sm:col-span-2 lg:col-span-4",
    minH: "",
    render: (launch) => <RecentCard onLaunch={launch} />,
  },
  {
    id: "pdf",
    name: "PDF & Documents",
    size: "Square · 2×2",
    icon: FileText,
    tile: tileOf("pdf"),
    cats: ["pdf"],
    span: HALF,
    tint: tintOf("pdf"),
    blob: blobOf("pdf"),
    minH: SQ_MIN,
    render: (launch) => <PdfCard cat={catOf("pdf")!} onLaunch={launch} />,
  },
  {
    id: "dev",
    name: "Developer Arsenal",
    size: "Square · 2×2",
    icon: Code2,
    tile: tileOf("dev"),
    cats: ["dev"],
    span: HALF,
    tint: tintOf("dev"),
    blob: blobOf("dev"),
    minH: SQ_MIN,
    render: (launch) => <DevCard cat={catOf("dev")!} onLaunch={launch} />,
  },
  {
    id: "security",
    name: "Security & Vault",
    size: "Square · 2×2",
    icon: ShieldCheck,
    tile: tileOf("security"),
    cats: ["security"],
    span: HALF,
    tint: tintOf("security"),
    blob: blobOf("security"),
    minH: SQ_MIN,
    render: (launch) => <SecurityCard cat={catOf("security")!} onLaunch={launch} />,
  },
  {
    id: "ai",
    name: "AI Lab",
    size: "Square · 2×2",
    icon: Sparkles,
    tile: tileOf("ai"),
    cats: ["ai"],
    span: HALF,
    tint: tintOf("ai"),
    blob: blobOf("ai"),
    minH: SQ_MIN,
    render: (launch) => <AiCard cat={catOf("ai")!} onLaunch={launch} />,
  },
  {
    id: "productivity",
    name: "Productivity Index",
    size: "Wide · 4×2",
    icon: Activity,
    tile: "from-sky-400 to-violet-500",
    core: true,
    cats: [],
    span: HALF,
    tint: "bg-[linear-gradient(120deg,rgba(14,165,233,0.08),rgba(139,92,246,0.06)_55%,transparent_80%)]",
    blob: "bg-violet-500/[0.14]",
    minH: SQ_MIN,
    render: () => <ProductivityCard />,
  },
  {
    id: "calc",
    name: "Calculators & Math",
    size: "Square · 2×2",
    icon: Calculator,
    tile: tileOf("calc"),
    cats: ["calc"],
    span: HALF,
    tint: tintOf("calc"),
    blob: blobOf("calc"),
    minH: SQ_MIN,
    render: (launch) => <CalcCard cat={catOf("calc")!} onLaunch={launch} />,
  },
  {
    id: "image",
    name: "Image Studio",
    size: "Square · 2×2",
    icon: Image,
    tile: tileOf("image"),
    cats: ["image"],
    span: HALF,
    tint: tintOf("image"),
    blob: blobOf("image"),
    minH: SQ_MIN,
    render: (launch) => <ImageCard cat={catOf("image")!} onLaunch={launch} />,
  },
  {
    id: "text",
    name: "Text & Writing",
    size: "Square · 2×2",
    icon: Type,
    tile: tileOf("text"),
    cats: ["text"],
    span: HALF,
    tint: tintOf("text"),
    blob: blobOf("text"),
    minH: SQ_MIN,
    render: (launch) => <TextCard cat={catOf("text")!} onLaunch={launch} />,
  },
  {
    id: "seo",
    name: "SEO & Web",
    size: "Square · 2×2",
    icon: TrendingUp,
    tile: tileOf("seo"),
    cats: ["seo"],
    span: HALF,
    tint: tintOf("seo"),
    blob: blobOf("seo"),
    minH: SQ_MIN,
    render: (launch) => <SeoCard cat={catOf("seo")!} onLaunch={launch} />,
  },
  {
    id: "vault",
    name: "Offline Vault",
    size: "Wide · 4×2",
    icon: HardDrive,
    tile: "from-slate-400 to-slate-600",
    core: true,
    cats: [],
    span: HALF,
    tint: "bg-[linear-gradient(120deg,rgba(148,163,184,0.08),transparent_60%)]",
    blob: "bg-slate-400/[0.12]",
    minH: SQ_MIN,
    render: () => <VaultCard />,
  },
];

const DEFAULT_ORDER = WIDGETS.map((w) => w.id);

/* ------------------------------ dashboard ------------------------------ */

export default function Dashboard() {
  const [activeCat, setActiveCat] = useState("all");
  const [editMode, setEditMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [hiddenLS, setHiddenLS] = useLocalStorage<string[]>("unq:hidden-widgets", []);
  const [orderLS, setOrderLS] = useLocalStorage<string[]>("unq:widget-order", DEFAULT_ORDER);
  const [favs, setFavs] = useLocalStorage<string[]>("unq:favorites", ["json-formatter"]);

  /* derived ordering (tolerates stale stored ids) */
  const order = useMemo(
    () =>
      [...DEFAULT_ORDER].sort((a, b) => {
        const ia = orderLS.indexOf(a);
        const ib = orderLS.indexOf(b);
        return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
      }),
    [orderLS]
  );
  const hidden = useMemo(() => new Set(hiddenLS), [hiddenLS]);

  const visibleWidgets = order.filter((id) => {
    const def = WIDGETS.find((w) => w.id === id);
    if (!def || hidden.has(id)) return false;
    if (activeCat === "all") return true;
    return def.core || def.cats.includes(activeCat);
  });

  /* actions */
  const launch = useCallback((id: string) => {
    setSelectedId(id);
    setPaletteOpen(false);
    setQuickAddOpen(false);
  }, []);

  const toggleWidget = useCallback(
    (id: string) =>
      setHiddenLS((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setHiddenLS]
  );

  const moveWidget = useCallback(
    (id: string, dir: -1 | 1) => {
      const idx = order.indexOf(id);
      const swap = idx + dir;
      if (idx === -1 || swap < 0 || swap >= order.length) return;
      const next = [...order];
      [next[idx], next[swap]] = [next[swap], next[idx]];
      setOrderLS(next);
    },
    [order, setOrderLS]
  );

  const resetLayout = useCallback(() => {
    setHiddenLS([]);
    setOrderLS(DEFAULT_ORDER);
  }, [setHiddenLS, setOrderLS]);

  const toggleEdit = () => {
    const next = !editMode;
    setEditMode(next);
    setEditSheetOpen(next); // entering edit mode opens the "Edit home" drawer
  };

  const toggleFav = useCallback(
    (id: string) =>
      setFavs((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])),
    [setFavs]
  );

  /* keyboard: ⌘K / Ctrl+K */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  /* body scroll lock while palette open */
  useEffect(() => {
    document.body.style.overflow = paletteOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [paletteOpen]);

  const scrollTo = (selector: string) =>
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });

  const onNavigate = (id: string) => {
    if (id === "home") window.scrollTo({ top: 0, behavior: "smooth" });
    else if (id === "tools") scrollTo("#tools");
    else if (id === "categories") scrollTo("#categories");
    else if (id === "vault") scrollTo("#vault");
    else if (id === "settings") setEditSheetOpen(true);
  };

  const sheetWidgets: WidgetMeta[] = order
    .map((id) => {
      const def = WIDGETS.find((w) => w.id === id);
      if (!def) return null;
      return { id, name: def.name, size: def.size, icon: def.icon, tile: def.tile, hidden: hidden.has(id) };
    })
    .filter((w): w is WidgetMeta => w !== null);

  const selectedTool = selectedId ? findTool(selectedId) ?? null : null;

  return (
    <div className="relative min-h-dvh">
      {/* ambient background */}
      <div className="noise-bg pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-48 left-1/4 size-[620px] rounded-full bg-cyan-500/[0.07] blur-[140px]" />
        <div className="absolute right-[-140px] top-1/3 size-[480px] rounded-full bg-violet-500/[0.06] blur-[140px]" />
        <div className="absolute bottom-[-180px] left-[-100px] size-[540px] rounded-full bg-blue-600/[0.06] blur-[140px]" />
      </div>

      <Header
        editMode={editMode}
        onToggleEdit={toggleEdit}
        onOpenSearch={() => setPaletteOpen(true)}
        onQuickAdd={() => setQuickAddOpen(true)}
      />
      <CategorySwitcher active={activeCat} onChange={setActiveCat} />

      <main className="mx-auto max-w-7xl px-3 pb-32 pt-4 sm:px-6 sm:pt-6 md:pb-16">
        {/* dashboard grid */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <AnimatePresence mode="popLayout" initial={false}>
            {visibleWidgets.map((id, i) => {
              const def = WIDGETS.find((w) => w.id === id)!;
              return (
                <BentoCard
                  key={id}
                  index={i}
                  tint={def.tint}
                  blob={def.blob}
                  editMode={editMode}
                  onRemove={() => toggleWidget(id)}
                  className={cn(def.span, def.minH)}
                >
                  {def.render(launch)}
                </BentoCard>
              );
            })}
          </AnimatePresence>
        </div>

        <Directory activeCat={activeCat} onSelect={launch} />

        {/* footer */}
        <footer className="mt-16 border-t border-white/[0.05] py-8 text-center">
          <p className="text-[12px] font-semibold text-white/50">
            UnQ<span className="text-cyan-300">Tools</span> — privacy is the product.
          </p>
          <p className="mt-1.5 text-[10.5px] text-white/25">
            1,679 tools · 0 trackers · 0 uploads · works 35,000 ft above the nearest server
          </p>
        </footer>
      </main>

      <MobileNav onNavigate={onNavigate} onQuickAdd={() => setQuickAddOpen(true)} />

      {/* overlays */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onSelect={launch} />
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onSelect={launch} />
      <EditSheet
        open={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        widgets={sheetWidgets}
        onMove={moveWidget}
        onToggle={toggleWidget}
        onReset={resetLayout}
      />
      <ToolModal
        tool={selectedTool}
        onClose={() => setSelectedId(null)}
        isFav={selectedId ? favs.includes(selectedId) : false}
        onToggleFav={toggleFav}
      />
    </div>
  );
}

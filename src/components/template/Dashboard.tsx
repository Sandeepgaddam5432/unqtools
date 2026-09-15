"use client";

import {
  Activity,
  Calculator,
  Code2,
  FileText,
  HardDrive,
  History,
  Image as ImageIcon,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Type,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import BentoCard from "@/components/template/BentoCard";
import Header from "@/components/template/Header";
import CategorySwitcher from "@/components/template/CategorySwitcher";
import MobileNav from "@/components/template/MobileNav";
import Directory from "@/components/template/Directory";
import CommandPalette from "@/components/template/overlays/CommandPalette";
import QuickAddSheet from "@/components/template/overlays/QuickAddSheet";
import EditSheet from "@/components/template/overlays/EditSheet";
import ToolModal from "@/components/template/overlays/ToolModal";
import type { WidgetMeta } from "@/components/template/overlays/EditSheet";

import PrivacyHeroCard from "@/components/template/cards/PrivacyHeroCard";
import QuickToolCard from "@/components/template/cards/QuickToolCard";
import RecentCard from "@/components/template/cards/RecentCard";
import ProductivityCard from "@/components/template/cards/ProductivityCard";
import CategoryCard from "@/components/template/cards/CategoryCards";
import VaultCard from "@/components/template/cards/VaultCard";

import { CATEGORIES, type Category } from "@/lib/template-data";
import { useLocalStorage } from "@/lib/template-hooks";
import { cn } from "@/lib/template-utils";
import type { ToolCategory } from "@/lib/tool";

/* ------------------------------ registry ------------------------------ */

type Launch = (id: string) => void;
type WidgetId =
  | "hero"
  | "quick"
  | "recent"
  | "productivity"
  | "vault"
  | "pdf"
  | "dev"
  | "security"
  | "ai"
  | "calc"
  | "image"
  | "text"
  | "seo";

interface WidgetDef {
  id: WidgetId;
  name: string;
  size: string;
  icon: LucideIcon;
  tile: string;
  core?: boolean;
  cats: ToolCategory[];
  span: string;
  minH: string;
  tint?: string;
  blob?: string;
  render: (launch: Launch) => React.ReactNode;
}

const HALF = "sm:col-span-1 lg:col-span-2";
const WIDE_MIN = "min-h-[300px]";
const SQ_MIN = "min-h-[264px]";

function findCategory(id: ToolCategory): Category {
  return CATEGORIES.find((c) => c.id === id)!;
}

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
    tile: "from-orange-500 to-amber-500",
    cats: ["pdf"],
    span: HALF,
    tint: "bg-[linear-gradient(135deg,rgba(249,115,22,0.14),rgba(234,88,12,0.05)_45%,transparent_75%)]",
    blob: "bg-orange-500/20",
    minH: SQ_MIN,
    render: (launch) => <CategoryCard cat={findCategory("pdf")} onLaunch={launch} />,
  },
  {
    id: "dev",
    name: "Developer Arsenal",
    size: "Square · 2×2",
    icon: Code2,
    tile: "from-emerald-500 to-teal-500",
    cats: ["developer"],
    span: HALF,
    tint: "bg-[linear-gradient(135deg,rgba(16,185,129,0.13),rgba(13,148,136,0.05)_45%,transparent_75%)]",
    blob: "bg-emerald-500/20",
    minH: SQ_MIN,
    render: (launch) => <CategoryCard cat={findCategory("developer")} onLaunch={launch} />,
  },
  {
    id: "security",
    name: "Security & Vault",
    size: "Square · 2×2",
    icon: ShieldCheck,
    tile: "from-cyan-500 to-blue-600",
    cats: ["network-security"],
    span: HALF,
    tint: "bg-[linear-gradient(135deg,rgba(6,182,212,0.13),rgba(37,99,235,0.06)_45%,transparent_75%)]",
    blob: "bg-cyan-500/20",
    minH: SQ_MIN,
    render: (launch) => <CategoryCard cat={findCategory("network-security")} onLaunch={launch} />,
  },
  {
    id: "ai",
    name: "AI Lab",
    size: "Square · 2×2",
    icon: Sparkles,
    tile: "from-violet-500 to-fuchsia-500",
    cats: ["ai"],
    span: HALF,
    tint: "bg-[linear-gradient(135deg,rgba(139,92,246,0.14),rgba(217,70,239,0.06)_45%,transparent_78%)]",
    blob: "bg-fuchsia-500/20",
    minH: SQ_MIN,
    render: (launch) => <CategoryCard cat={findCategory("ai")} onLaunch={launch} />,
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
    tile: "from-amber-500 to-yellow-400",
    cats: ["calculators"],
    span: HALF,
    tint: "bg-[linear-gradient(135deg,rgba(245,158,11,0.13),rgba(234,179,8,0.05)_45%,transparent_75%)]",
    blob: "bg-amber-500/20",
    minH: SQ_MIN,
    render: (launch) => <CategoryCard cat={findCategory("calculators")} onLaunch={launch} />,
  },
  {
    id: "image",
    name: "Image Studio",
    size: "Square · 2×2",
    icon: ImageIcon,
    tile: "from-rose-500 to-red-400",
    cats: ["image"],
    span: HALF,
    tint: "bg-[linear-gradient(135deg,rgba(244,63,94,0.13),rgba(225,29,72,0.05)_45%,transparent_75%)]",
    blob: "bg-rose-500/20",
    minH: SQ_MIN,
    render: (launch) => <CategoryCard cat={findCategory("image")} onLaunch={launch} />,
  },
  {
    id: "text",
    name: "Text & Writing",
    size: "Square · 2×2",
    icon: Type,
    tile: "from-sky-500 to-indigo-500",
    cats: ["text"],
    span: HALF,
    tint: "bg-[linear-gradient(135deg,rgba(14,165,233,0.13),rgba(99,102,241,0.05)_45%,transparent_75%)]",
    blob: "bg-sky-500/20",
    minH: SQ_MIN,
    render: (launch) => <CategoryCard cat={findCategory("text")} onLaunch={launch} />,
  },
  {
    id: "seo",
    name: "SEO & Web",
    size: "Square · 2×2",
    icon: TrendingUp,
    tile: "from-lime-500 to-green-500",
    cats: ["seo"],
    span: HALF,
    tint: "bg-[linear-gradient(135deg,rgba(132,204,22,0.12),rgba(34,197,94,0.05)_45%,transparent_75%)]",
    blob: "bg-lime-500/20",
    minH: SQ_MIN,
    render: (launch) => <CategoryCard cat={findCategory("seo")} onLaunch={launch} />,
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

const DEFAULT_ORDER: WidgetId[] = WIDGETS.map((w) => w.id);

/* ------------------------------ dashboard ------------------------------ */

export default function Dashboard() {
  const router = useRouter();
  const [activeCat, setActiveCat] = useState<ToolCategory | "all">("all");
  const [editMode, setEditMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editSheetOpen, setEditSheetOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [hiddenLS, setHiddenLS] = useLocalStorage<string[]>("unq:hidden-widgets", []);
  const [orderLS, setOrderLS] = useLocalStorage<string[]>(
    "unq:widget-order",
    DEFAULT_ORDER as unknown as string[]
  );
  const [favs, setFavs] = useLocalStorage<string[]>("unq:favorites", ["json-formatter"]);
  const [activeNav, setActiveNav] = useState<"home" | "tools" | "categories" | "vault" | "settings">("home");

  /* derived ordering (tolerates stale stored ids) */
  const order = useMemo(
    () =>
      ([...DEFAULT_ORDER] as string[]).sort((a, b) => {
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
    setOrderLS(DEFAULT_ORDER as unknown as string[]);
  }, [setHiddenLS, setOrderLS]);

  const toggleEdit = () => {
    const next = !editMode;
    setEditMode(next);
    setEditSheetOpen(next);
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
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setQuickAddOpen(false);
        setEditSheetOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Resolve selected tool metadata at render-time so the modal can read latest data.
  // Categorised tools are tiny (≤ 12 per cat × 13 cats), so a plain linear
  // scan is cheaper than memo bookkeeping here.
  const selectedMeta = (() => {
    if (!selectedId) return null;
    for (const c of CATEGORIES) {
      const t = c.tools.find((t) => t.id === selectedId);
      if (t) {
        return { ...t, category: c, href: `/tools/${t.id}` };
      }
    }
    return null;
  })();

  const scrollTo = (selector: string) => {
    if (typeof document === "undefined") return;
    document.querySelector(selector)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const onNavigate = (id: "home" | "tools" | "categories" | "vault" | "settings") => {
    setActiveNav(id);
    if (id === "home") window.scrollTo({ top: 0, behavior: "smooth" });
    else if (id === "tools") {
      // Send the user to the canonical /tools page for full search.
      router.push("/tools");
    } else if (id === "categories") {
      scrollTo("#categories");
    } else if (id === "vault") {
      scrollTo("#tools");
    } else if (id === "settings") {
      setEditSheetOpen(true);
    }
  };

  const sheetWidgets: WidgetMeta[] = order
    .map((id) => {
      const def = WIDGETS.find((w) => w.id === id);
      if (!def) return null;
      return { id, name: def.name, size: def.size, icon: def.icon, tile: def.tile, hidden: hidden.has(id) };
    })
    .filter((w): w is WidgetMeta => w !== null);

  return (
    <div className="dashboard-root relative min-h-dvh text-white">
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

        <Directory onSelect={launch} />

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

      <MobileNav
        onNavigate={onNavigate}
        onQuickAdd={() => setQuickAddOpen(true)}
        active={activeNav}
      />

      {/* overlays */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} onSelect={launch} />
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} onSelect={(id) => router.push(`/category/${id}`)} />
      <EditSheet
        open={editSheetOpen}
        onClose={() => setEditSheetOpen(false)}
        widgets={sheetWidgets}
        onMove={moveWidget}
        onToggle={toggleWidget}
        onReset={resetLayout}
      />
      <ToolModal
        tool={selectedMeta}
        onClose={() => setSelectedId(null)}
        isFav={selectedId ? favs.includes(selectedId) : false}
        onToggleFav={() => selectedId && toggleFav(selectedId)}
      />
    </div>
  );
}

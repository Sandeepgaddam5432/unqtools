"use client";

import { useEffect, useState } from "react";
import { AnimatePresence } from "framer-motion";
import {
  Calculator,
  Code2,
  Compass,
  Database,
  FileText,
  GraduationCap,
  HardDrive,
  Image as ImageIcon,
  Share2,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Type,
  Music,
  FolderTree,
  Briefcase,
  Home,
  Layers,
  ChevronRight,
  Search,
} from "lucide-react";

import Header from "@/components/template/Header";
import CommandPalette from "@/components/template/overlays/CommandPalette";
import QuickAddSheet from "@/components/template/overlays/QuickAddSheet";
import { useLocalStorage } from "@/lib/template-hooks";
import {
  ALL_SEARCHABLE_TOOLS,
  CATEGORIES,
  TOTAL_TOOLS,
} from "@/lib/template-data";
import { cn } from "@/lib/template-utils";
import type { ToolCategory } from "@/lib/tool";

/* ------------------------------------------------------------- */
/*  Icons                                                        */
/* ------------------------------------------------------------- */

const CATEGORY_ICON: Record<ToolCategory, typeof Code2> = {
  pdf: FileText,
  developer: Code2,
  "network-security": ShieldCheck,
  ai: Sparkles,
  calculators: Calculator,
  image: ImageIcon,
  text: Type,
  seo: TrendingUp,
  "audio-video": Music,
  file: FolderTree,
  business: Briefcase,
  education: GraduationCap,
  social: Share2,
};

/* ------------------------------------------------------------- */
/*  TemplateShell — wraps any route in the bento look            */
/* ------------------------------------------------------------- */

interface Props {
  children: React.ReactNode;
  /** Optional right-side / below-content region — usually a Footer. */
  footer?: React.ReactNode;
}

export default function TemplateShell({ children, footer }: Props) {
  /* ⌘K opens the global command palette on every page. */
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Track what category is "active" based on URL — used by the bottom nav highlight.
  const [activeNav, setActiveNav] = useState<
    "home" | "tools" | "categories" | "vault" | "settings"
  >("home");

  useEffect(() => {
    if (typeof window === "undefined") return;
    const path = window.location.pathname;
    if (path === "/") setActiveNav("home");
    else if (path.startsWith("/tools")) setActiveNav("tools");
    else if (path.startsWith("/category")) setActiveNav("categories");
    else if (path.startsWith("/vault")) setActiveNav("vault");
    else setActiveNav("home");

    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      } else if (e.key === "Escape") {
        setPaletteOpen(false);
        setQuickAddOpen(false);
        setMobileNavOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onMobileNavigate = (id: "home" | "tools" | "categories" | "vault" | "settings") => {
    setActiveNav(id);
    setMobileNavOpen(false);
    if (id === "home") window.location.href = "/";
    else if (id === "tools") window.location.href = "/tools";
    else if (id === "categories") window.location.href = "/category/pdf";
    else if (id === "vault") window.location.href = "/tools?view=favorites";
  };

  return (
    <div className="dashboard-root relative min-h-dvh text-white">
      {/* Ambient blobs */}
      <div className="noise-bg pointer-events-none fixed inset-0 -z-10">
        <div className="absolute -top-48 left-1/4 size-[620px] rounded-full bg-cyan-500/[0.07] blur-[140px]" />
        <div className="absolute right-[-140px] top-1/3 size-[480px] rounded-full bg-violet-500/[0.06] blur-[140px]" />
        <div className="absolute bottom-[-180px] left-[-100px] size-[540px] rounded-full bg-blue-600/[0.06] blur-[140px]" />
      </div>

      {/* Top header (template-style) */}
      <Header
        editMode={false}
        onToggleEdit={() => undefined}
        onOpenSearch={() => setPaletteOpen(true)}
        onQuickAdd={() => setQuickAddOpen(true)}
      />

      {/* Category strip — links to each /category/<id> route */}
      <CategoryBar />

      {/* Page content */}
      <main className="dashboard-main">{children}</main>

      {footer}

      {/* Mobile bottom nav + drawer — replaces old sidebar entirely */}
      <MobileBottomNav
        active={activeNav}
        onNavigate={onMobileNavigate}
        onQuickAdd={() => setQuickAddOpen(true)}
      />

      {/* Drawer overlay for categories — slides up from bottom */}
      <AnimatePresence>
        {mobileNavOpen && (
          <NavDrawer onClose={() => setMobileNavOpen(false)} />
        )}
      </AnimatePresence>

      {/* Overlays */}
      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <QuickAddSheet open={quickAddOpen} onClose={() => setQuickAddOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------- */
/*  CategoryBar — quick category strip below the header          */
/* ------------------------------------------------------------- */

function CategoryBar() {
  const [pathname, setPathname] = useState<string>("");
  useEffect(() => {
    setPathname(window.location.pathname);
    const onPop = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const items: { id: string; label: string; href: string; Icon: typeof Code2; gradient: string }[] = [
    {
      id: "all",
      label: "All",
      href: "/tools",
      Icon: Layers,
      gradient: "from-slate-300 to-slate-500",
    },
    ...CATEGORIES.map((c) => ({
      id: c.id,
      label: c.short,
      href: `/category/${c.id}`,
      Icon: c.icon,
      gradient: c.iconTile,
    })),
  ];

  return (
    <nav
      className="sticky top-16 z-30 border-b border-white/[0.04] bg-[#090D16]/80 backdrop-blur-lg"
      aria-label="Categories"
    >
      <div className="no-scrollbar mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
        {items.map((it) => {
          const active = pathname.startsWith(it.href) && it.href !== "/tools"
            ? true
            : it.href === "/tools" && pathname === "/tools";
          return (
            <a
              key={it.id}
              href={it.href}
              className={cn(
                "flex shrink-0 items-center gap-2 rounded-full py-1.5 pl-1.5 pr-3.5 transition-colors",
                active
                  ? "border border-white/[0.15] bg-white/[0.08] text-white"
                  : "text-white/55 hover:text-white/85"
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  active
                    ? `bg-gradient-to-br ${it.gradient} text-white shadow-lg ring-1 ring-white/30`
                    : "bg-white/[0.06] text-white/55"
                )}
              >
                <it.Icon className="size-3.5" />
              </span>
              <span className="text-[12.5px] font-semibold">{it.label}</span>
            </a>
          );
        })}
      </div>
    </nav>
  );
}

/* ------------------------------------------------------------- */
/*  MobileBottomNav — replaces the old sidebar entirely          */
/* ------------------------------------------------------------- */

function MobileBottomNav({
  active,
  onNavigate,
  onQuickAdd,
}: {
  active: "home" | "tools" | "categories" | "vault" | "settings";
  onNavigate: (id: "home" | "tools" | "categories" | "vault" | "settings") => void;
  onQuickAdd: () => void;
}) {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.06] bg-[#090D16]/85 px-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] pt-2 backdrop-blur-2xl md:hidden"
      aria-label="Primary"
    >
      <ul className="mx-auto flex max-w-md items-stretch justify-between gap-1">
        <NavItem icon={Home} label="Home" active={active === "home"} onClick={() => onNavigate("home")} />
        <NavItem
          icon={Compass}
          label="Tools"
          active={active === "tools"}
          onClick={() => onNavigate("tools")}
        />
        <li>
          <button
            type="button"
            onClick={onQuickAdd}
            aria-label="Quick add"
            className="relative mx-auto -mt-7 flex size-12 cursor-pointer items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-white shadow-[0_12px_28px_-8px_rgba(34,211,238,0.6),inset_0_1px_1px_rgba(255,255,255,0.4)] active:scale-95"
          >
            <span className="pulse-ring absolute inset-1 rounded-full border border-cyan-300/50" aria-hidden="true" />
            <Layers className="relative size-5" />
          </button>
        </li>
        <NavItem
          icon={Sparkles}
          label="Categories"
          active={active === "categories"}
          onClick={() => onNavigate("categories")}
        />
        <NavItem
          icon={HardDrive}
          label="Favorites"
          active={active === "vault"}
          onClick={() => onNavigate("vault")}
        />
      </ul>
    </nav>
  );
}

function NavItem({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className={cn(
          "flex w-14 cursor-pointer flex-col items-center gap-0.5 rounded-xl py-2 text-[10px] font-medium transition-colors",
          active ? "text-white" : "text-white/45 hover:text-white/80"
        )}
      >
        <Icon className="size-[18px]" />
        <span>{label}</span>
      </button>
    </li>
  );
}

/* ------------------------------------------------------------- */
/*  NavDrawer — categorised tool directory (mobile fly-out)      */
/* ------------------------------------------------------------- */

function NavDrawer({ onClose }: { onClose: () => void }) {
  return (
    <>
      <button
        type="button"
        aria-label="Close menu"
        onClick={onClose}
        className="fixed inset-0 z-40 cursor-default bg-black/60 backdrop-blur-sm"
      />
      <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-3xl border-t border-white/[0.08] bg-[#0e1320]/95 px-4 pb-8 pt-4 shadow-[0_30px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl">
        <div className="mx-auto mb-4 h-1 w-12 rounded-full bg-white/20" />
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-[15px] font-semibold tracking-tight">Browse</h2>
          <a
            href="/tools"
            className="text-[11.5px] text-cyan-300 hover:underline"
          >
            All {TOTAL_TOOLS.toLocaleString()} →
          </a>
        </div>
        <ul className="grid grid-cols-2 gap-2">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <li key={c.id}>
                <a
                  href={`/category/${c.id}`}
                  onClick={onClose}
                  className={cn(
                    "group relative flex w-full cursor-pointer flex-col items-start gap-2 overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-3.5 text-left transition-all",
                    "hover:-translate-y-0.5 hover:border-white/[0.18] hover:bg-white/[0.07]"
                  )}
                  style={{ boxShadow: "inset 0 1px 0 rgba(255,255,255,0.07)" }}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      "pointer-events-none absolute -right-12 -top-10 size-32 rounded-full opacity-60 blur-3xl transition-opacity group-hover:opacity-100",
                      c.blob
                    )}
                  />
                  <span
                    className={cn(
                      "relative flex size-9 items-center justify-center rounded-xl text-white shadow-md ring-1 ring-white/20 bg-gradient-to-br",
                      c.iconTile
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="relative text-[13px] font-semibold">{c.short}</span>
                  <span className="relative -mt-1.5 line-clamp-2 text-[11px] text-white/45">
                    {c.tagline}
                  </span>
                </a>
              </li>
            );
          })}
        </ul>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- */
/*  PageFooter — full footer with privacy / links                */
/* ------------------------------------------------------------- */

export function TemplateFooter() {
  return (
    <footer className="dashboard-footer mt-16 border-t border-white/[0.05] py-10 text-center">
      <p className="text-[12px] font-semibold text-white/50">
        UnQ<span className="text-cyan-300">Tools</span> — privacy is the product.
      </p>
      <p className="mt-1.5 text-[10.5px] text-white/25">
        {TOTAL_TOOLS.toLocaleString()} tools · 0 trackers · 0 uploads · works
        35,000 ft above the nearest server
      </p>
      <ul className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[10px]">
        <FooterLink href="/tools">All tools</FooterLink>
        <FooterLink href="/tools?view=favorites">Favorites</FooterLink>
        <FooterLink href="/tools?view=recent">Recently viewed</FooterLink>
        <FooterLink href="https://github.com/Sandeepgaddam5432/unqtools" external>
          GitHub
        </FooterLink>
      </ul>
      <p className="mt-6 text-[10px] text-white/20">
        © {new Date().getFullYear()} Sandeep Gaddam · Built with privacy & love
      </p>
    </footer>
  );
}

function FooterLink({
  href,
  children,
  external,
}: {
  href: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  const cls =
    "rounded-full border border-white/[0.07] bg-white/[0.03] px-2.5 py-1 text-white/55 hover:border-white/[0.18] hover:text-white/85";
  if (external) {
    return (
      <li>
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={cls}
        >
          {children}
        </a>
      </li>
    );
  }
  return (
    <li>
      <a href={href} className={cls}>
        {children}
      </a>
    </li>
  );
}

/* Helpful when consumers want to know how many tools are indexed. */
export { TOTAL_TOOLS, CATEGORIES, ALL_SEARCHABLE_TOOLS };

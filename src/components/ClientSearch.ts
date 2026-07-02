/**
 * ClientSearch — pure-DOM client-side fuzzy search mounted on the SearchBar's
 * root element. Uses src/lib/search.ts for scoring.
 */
import { searchTools } from "../lib/search";
import type { ToolManifest } from "../lib/tool";

type SearchEntry = Pick<ToolManifest, "id" | "name" | "description" | "category" | "keywords"> & {
  categoryLabel?: string;
};

export function ClientSearch(root: HTMLElement, tools: SearchEntry[]): void {
  const input = root.querySelector<HTMLInputElement>("[data-search-input]");
  const results = root.querySelector<HTMLUListElement>("[data-search-results]");
  if (!input || !results) return;

  let timer: ReturnType<typeof setTimeout> | null = null;
  let activeIndex = -1;
  let currentResults: SearchEntry[] = [];

  function escapeHtml(s: string): string {
    return s.replace(/[&<>"']/g, (c) => {
      const m: Record<string, string> = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      };
      return m[c] ?? c;
    });
  }

  function render(entries: SearchEntry[]): void {
    currentResults = entries;
    activeIndex = -1;
    if (entries.length === 0) {
      results!.classList.add("hidden");
      results!.innerHTML = "";
      return;
    }
    results!.classList.remove("hidden");
    results!.innerHTML = entries
      .map(
        (t, i) => `
        <li role="option" data-idx="${i}" class="group">
          <a href="/tools/${t.id}" class="flex items-start gap-3 px-4 py-3 hover:bg-surface-2 transition-colors duration-150">
            <div class="flex-1 min-w-0">
              <div class="font-medium text-sm text-fg">${escapeHtml(t.name)}</div>
              <div class="text-xs text-fg-muted truncate">${escapeHtml(t.description)}</div>
            </div>
            <div class="text-[10px] uppercase tracking-wide text-fg-subtle shrink-0 mt-0.5">
              ${escapeHtml(t.categoryLabel ?? t.category)}
            </div>
          </a>
        </li>`,
      )
      .join("");
  }

  input.addEventListener("input", () => {
    const q = input.value;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      const out = searchTools(q, tools, 25).map((r) => r.tool);
      render(out);
    }, 60);
  });

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    const items = results!.querySelectorAll<HTMLLIElement>("[data-idx]");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      activeIndex = Math.min(activeIndex + 1, items.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      activeIndex = Math.max(activeIndex - 1, 0);
    } else if (e.key === "Enter") {
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        e.preventDefault();
        window.location.href = `/tools/${currentResults[activeIndex].id}`;
      }
      return;
    } else if (e.key === "Escape") {
      input.value = "";
      render([]);
      return;
    } else {
      return;
    }
    items.forEach((el, i) => {
      const link = el.querySelector("a");
      if (i === activeIndex) {
        el.style.backgroundColor = "var(--unq-surface-hover)";
        link?.focus();
      } else {
        el.style.backgroundColor = "";
      }
    });
  });

  // Close on outside click
  document.addEventListener("click", (e) => {
    if (!root.contains(e.target as Node)) {
      results!.classList.add("hidden");
    }
  });
}

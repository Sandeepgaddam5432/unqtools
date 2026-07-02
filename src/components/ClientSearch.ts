/**
 * ClientSearch — pure-DOM client-side fuzzy search mounted on the SearchBar's
 * root element. Uses src/lib/search.ts for scoring.
 *
 * Kept as direct DOM manipulation (not Preact) so the homepage search input
 * stays tiny — the heavier Preact islands only load when a tool page opens.
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
        <li role="option" data-idx="${i}">
          <a href="/tools/${t.id}" class="block px-4 py-3 hover:bg-unq-surface transition-colors">
            <div class="font-medium">${escapeHtml(t.name)}</div>
            <div class="text-xs text-unq-muted truncate">${escapeHtml(t.description)}</div>
            <div class="text-[10px] uppercase tracking-wide text-unq-muted mt-1">${escapeHtml(t.categoryLabel ?? t.category)}</div>
          </a>
        </li>`,
      )
      .join("");
  }

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
        el.style.backgroundColor = "var(--unq-color-surface)";
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

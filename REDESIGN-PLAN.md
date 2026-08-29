# UnQTools — Apple-Style Redesign (DONE)

> Direction: **Apple design language for the web** (user choice).
> Skills followed: `apple-design`, `emil-design-eng`, `animate` (from emilkowalski/skills).
> Branch: `apple-redesign`. Verified light + dark + mobile via Playwright screenshots.

## Review table — what changed and why

| Before | After | Why |
| --- | --- | --- |
| `#b5562d` copper primary, warm cream `#faf9f5` bg | `#0071e3` Apple blue, `#f5f5f7` light / `#000000`+`#1d1d1f` dark | Apple system palette; dark = true black with raised-surface hierarchy |
| Hardcoded `dark:!bg-[#bb5435]` in Button | Removed, single `bg-primary` | Hardcoded hex overrides fork the token system |
| `rounded-md` buttons | `rounded-[10px]`, CTAs `rounded-full` pill | Apple's continuous corner radius |
| No press feedback on buttons | `not-disabled:active:scale-[0.97]` 160ms ease-out | Feedback on pointer-down, instant (Apple §1) |
| `transition-all duration-200` everywhere | Explicit `transition-[background-color,color,...]` per element | `transition-all` animates accidental properties; exact props only |
| Framer-motion headers (0.6–0.8s, `ease [0.25,0.4,0.25,1]`) — category/tools pages rendered blank until JS hydrated | CSS `.unq-animate-fade-in-up` 250ms + `.unq-stagger-*` 50/100/150/200ms | CSS runs off the JS load path (<300ms rule); fixes blank-header bug seen in screenshots |
| Grid stagger 25ms steps capped 500ms | 40ms steps capped 320ms (home/other grids use `nth-child` 45ms steps ≤315ms) | Stagger 30–80ms; long delays feel slow |
| Card hover `translateY(-3px)` + heavy glow shadow, ungated | `translateY(-2px)` + soft shadow, gated `@media (hover:hover) and (pointer:fine)`, 250ms custom ease-out | Touch devices fire false hovers; restraint over decoration |
| Gradient text (copper→amber) on headlines | Solid `--primary` via `.unq-gradient-text` | Single-accent discipline; gradients on text = decoration without purpose |
| Amber featured badges, multi-color feature icons (emerald/amber/rose), gradient `from-primary to-amber-500` pills | All → single blue accent (`bg-primary/10 text-primary`, solid `bg-primary`) | One accent = one meaning; Apple uses color sparingly |
| Hero: gradient orbs (amber/rose) + dot grid, left-aligned | One faint blue wash; centered Apple-style hero, pill search (Spotlight-style), pill CTA + quiet text link | Simplicity — type carries the page, not decoration |
| Sidebar active row: gradient fill + amber indicator bar | Solid `bg-primary/12` row + 3px solid `--primary` indicator | No gradients in chrome UI; familiar, predictable (Apple: familiarity) |
| `.unq-glass` blur(14px) | blur(20px) saturate(180%) + bright top edge in dark + `prefers-reduced-transparency` fallback | Apple material: translucency with a light-catching edge |
| Radius base `0.5rem` | `0.75rem` (cards `1.25rem`/`2xl`) | Apple's larger radii |
| Reduced-motion: animations hard-killed | Opacity fades kept, transforms removed, stagger delays zeroed | Gentler, not zero — comprehension aids stay |
| Typography: default tracking | Size-specific tracking: h1 `-0.022em`, h2 `-0.018em`, body `-0.003em`, small `+0.01em`; tight leading on display | Optical sizing discipline (Apple §15) |
| Easing: built-in `ease-out` | Tokens `--ease-out: cubic-bezier(0.23,1,0.32,1)`, `--ease-drawer: cubic-bezier(0.32,0.72,0,1)` | Built-in easings are too weak; iOS drawer curve |

## Files changed

`globals.css` (tokens/components/typography/stagger), `button.tsx`, `badge.tsx`, `card.tsx`,
`sidebar.tsx`, `footer-section.tsx`, `switch.tsx`, `toast.tsx`, `home-page-client.tsx`,
`category-page-client.tsx`, `tools-page-client.tsx`, `tool-page-client.tsx`, `next.config.ts` (allowedDevOrigins).

## Known remaining (future phases)

- ~60 `transition-all` inside individual tool implementations (`src/tools/*/*/ui.tsx`) — tool-internal, not site chrome.
- `framer-motion` still in `package.json` for any tool-internal usage; site chrome no longer imports it.
- Tool page visual check in dev is expensive (generateStaticParams compiles all 1,679 tools) — verify on a production build.

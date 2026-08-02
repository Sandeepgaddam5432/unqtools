"use client"

/**
 * Text Sorter — UI half of the 100x rebuild.
 *
 * Copy to: src/tools/text/text-sorter/ui.tsx
 * Requires: CODE-1-ENGINE.ts copied to ./logic
 *
 * Imports only react, lucide-react and ./logic. No project imports, no new deps.
 */

import { AlertTriangle, ArrowDownUp, Check, Copy, Download, Eraser, FileUp, Info, Keyboard, Lightbulb, Link2, Pin, Redo2, RotateCcw, ShieldCheck, SquareStack, Trash2, Undo2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
        ALIASES, ASSUMPTIONS, CHUNK_THRESHOLD, DEFAULT_OPTIONS, EMPTY_RESULT, FAQ, HOW_TO, LOCALES, MAX_CHARS, MAX_FILE_BYTES, MIME, PRESETS, RELATED, RENDER_LIMIT, SAMPLES, SHORTCUTS, WARN_CHARS,
        clearAllStorage, detectDelimiter, detectLineEnding, download, isValidLocale, serialize, sortText, sortTextChunked, stamp, statsToCsv, useDebounced, useDraft, useHistory, usePersisted, useUndoRedo,
        type Direction, type ExportFormat, type SortBy, type SortKey, type SortOptions, type SortUnit,
} from "./logic"

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const BOX = "rounded-lg border bg-card p-4"
const CHIP = `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted ${FOCUS}`
const INPUT = `w-full rounded-md border bg-background px-2 py-1.5 text-sm ${FOCUS}`

const UNITS: ReadonlyArray<{ v: SortUnit; label: string }> = [
        { v: "lines", label: "Lines" }, { v: "words", label: "Words" }, { v: "paragraphs", label: "Paragraphs" },
        { v: "sentences", label: "Sentences" }, { v: "list", label: "Comma or semicolon list" },
        { v: "pattern", label: "Blocks split by a pattern" }, { v: "csv-column", label: "CSV rows, by a column" },
]

const KEYS: ReadonlyArray<{ v: SortBy; label: string }> = [
        { v: "alphabetical", label: "Alphabetical" }, { v: "numeric", label: "Numeric" }, { v: "natural", label: "Natural (item2 before item10)" },
        { v: "version", label: "Version number" }, { v: "length", label: "Length in characters" }, { v: "wordCount", label: "Number of words" },
        { v: "date", label: "Date" }, { v: "lastWord", label: "Last word (surnames)" }, { v: "pattern", label: "A pattern's first capture group" },
        { v: "random", label: "Random (shuffle)" }, { v: "reverse", label: "Reverse the current order" }, { v: "none", label: "Do not reorder" },
]

function Button({ children, onClick, variant = "ghost", title, disabled }: { children: React.ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger"; title?: string; disabled?: boolean }) {
        const v = variant === "primary" ? "bg-primary text-primary-foreground hover:opacity-90" : variant === "danger" ? "border border-destructive text-destructive hover:bg-destructive/10" : "border hover:bg-muted"
        return <button type="button" onClick={onClick} title={title} disabled={disabled} className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm disabled:opacity-40 ${v} ${FOCUS}`}>{children}</button>
}

function CopyButton({ text, label = "Copy", onDone }: { text: string; label?: string; onDone?: (m: string) => void }) {
        const [ok, setOk] = useState(false)
        return <Button onClick={() => { if (!text) return; void navigator.clipboard.writeText(text).then(() => { setOk(true); onDone?.(`${label} done`); setTimeout(() => setOk(false), 1400) }) }} title={label} disabled={text.length === 0}>{ok ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}{label}</Button>
}

function Toggle({ id, checked, onChange, label, hint }: { id: string; checked: boolean; onChange: (v: boolean) => void; label: string; hint?: string }) {
        return <div className="flex items-start gap-2"><input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={`mt-1 size-4 ${FOCUS}`} /><label htmlFor={id} className="text-sm leading-tight">{label}{hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}</label></div>
}

function Dialog({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
        const ref = useRef<HTMLDivElement>(null)
        const opener = useRef<Element | null>(null)
        useEffect(() => {
                if (!open) return
                opener.current = document.activeElement
                ref.current?.focus()
                const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
                window.addEventListener("keydown", onKey)
                return () => { window.removeEventListener("keydown", onKey); (opener.current as HTMLElement | null)?.focus?.() }
        }, [open, onClose])
        if (!open) return null
        return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="presentation" onClick={onClose}><div ref={ref} tabIndex={-1} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} className={`max-h-[80vh] w-full max-w-lg overflow-auto rounded-lg border bg-card p-4 ${FOCUS}`}><div className="mb-3 flex items-center justify-between"><h3 className="font-medium">{title}</h3><Button onClick={onClose}><X className="size-4" aria-hidden />Close</Button></div>{children}</div></div>
}

export default function TextSorterUI() {
        const [input, setInput] = useState("")
        const [opts, setOpts] = usePersisted<SortOptions>("options", DEFAULT_OPTIONS)
        const [customLocale, setCustomLocale] = useState("")
        const [showBefore, setShowBefore] = usePersisted<boolean>("showBefore", false)
        const [shareInput, setShareInput] = usePersisted<boolean>("shareInput", false)
        const [saved, setSaved] = usePersisted<Array<{ id: string; label: string; values: SortOptions }>>("presets", [])
        const [live, setLive] = useState("")
        const [busy, setBusy] = useState(false)
        const [progress, setProgress] = useState(0)
        const [heavyResult, setHeavyResult] = useState<ReturnType<typeof sortText> | null>(null)
        const [nonce, setNonce] = useState(0)
        const [dialog, setDialog] = useState<"none" | "shortcuts" | "history">("none")
        const cancelRef = useRef(false)
        const history = useHistory()
        const { draft, dismiss } = useDraft(input)
        const undo = useUndoRedo(input, setInput)
        const debounced = useDebounced(input)

        const tooBig = input.length > MAX_CHARS
        const heavy = input.length > CHUNK_THRESHOLD
        const set = useCallback((patch: Partial<SortOptions>) => setOpts({ ...opts, ...patch }), [opts, setOpts])
        const localeInvalid = customLocale.trim().length > 0 && !isValidLocale(customLocale)

        useEffect(() => {
                if (typeof window === "undefined") return
                const p = new URLSearchParams(window.location.search)
                const patch: Partial<SortOptions> = {}
                const by = p.get("by")
                if (by && KEYS.some((k) => k.v === by)) patch.by = by as SortBy
                const unit = p.get("u")
                if (unit && UNITS.some((u) => u.v === unit)) patch.unit = unit as SortUnit
                const dir = p.get("d")
                if (dir === "asc" || dir === "desc") patch.direction = dir
                if (p.get("ci") === "1") patch.caseInsensitive = true
                if (p.get("rd") === "1") patch.removeDuplicates = true
                const seed = p.get("sd")
                if (seed) patch.seed = seed
                if (Object.keys(patch).length > 0) set(patch)
                const i = p.get("i")
                if (i) setInput(i)
                // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])

        /* F057 — live preview, no button to press. */
        const quick = useMemo(() => (tooBig || heavy ? EMPTY_RESULT : sortText(debounced, opts)), [debounced, opts, tooBig, heavy, nonce])
        const result = heavy ? (heavyResult ?? EMPTY_RESULT) : quick

        const runHeavy = useCallback(async () => {
                if (tooBig) return
                cancelRef.current = false
                setBusy(true)
                const res = await sortTextChunked(debounced, opts, setProgress, () => cancelRef.current)
                setHeavyResult(res.result)
                setBusy(false)
                setLive(res.cancelled ? "Sorting stopped." : res.result.summary)
        }, [debounced, opts, tooBig])

        useEffect(() => { if (heavy && !tooBig) void runHeavy() }, [heavy, tooBig, runHeavy])
        useEffect(() => { if (!heavy && result.outputCount > 0) setLive(result.summary) }, [heavy, result.summary, result.outputCount])

        useEffect(() => {
                const onKey = (e: KeyboardEvent) => {
                        const mod = e.ctrlKey || e.metaKey
                        if (mod && e.key === "Enter") { e.preventDefault(); setNonce((n) => n + 1); setLive("Sorted again.") }
                        else if (mod && e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); void navigator.clipboard.writeText(result.output); setLive("Result copied.") }
                        else if (mod && e.shiftKey && e.key.toLowerCase() === "r") { e.preventDefault(); set({ by: "reverse" }); setLive("Order reversed.") }
                        else if (mod && e.shiftKey && e.key.toLowerCase() === "d") { e.preventDefault(); set({ removeDuplicates: !opts.removeDuplicates }) }
                        else if (e.key === "?" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLInputElement)) { e.preventDefault(); setDialog("shortcuts") }
                }
                window.addEventListener("keydown", onKey)
                return () => window.removeEventListener("keydown", onKey)
        }, [result.output, opts.removeDuplicates, set])

        const loadFile = (file: File | undefined) => {
                if (!file) return
                if (file.size > MAX_FILE_BYTES) { setLive(`That file is ${(file.size / 1_000_000).toFixed(1)} MB, over the 5 MB limit.`); return }
                const reader = new FileReader()
                reader.onload = () => {
                        const text = String(reader.result ?? "")
                        setInput(text)
                        if (/\.(csv|tsv)$/iu.test(file.name)) set({ unit: "csv-column", csvDelimiter: detectDelimiter(text) })
                        setLive(`Loaded ${file.name}.`)
                }
                reader.readAsText(file)
        }

        const shareLink = (): string => {
                if (typeof window === "undefined") return ""
                const p = new URLSearchParams()
                p.set("u", opts.unit)
                p.set("by", opts.by)
                p.set("d", opts.direction ?? "asc")
                if (opts.caseInsensitive) p.set("ci", "1")
                if (opts.removeDuplicates) p.set("rd", "1")
                if ((opts.seed ?? "").length > 0) p.set("sd", opts.seed ?? "")
                if (shareInput && input.length <= 1500) p.set("i", input)
                return `${window.location.origin}${window.location.pathname}?${p.toString()}`
        }

        const extraKeys = opts.keys ?? []
        const setKey = (i: number, patch: Partial<SortKey>) => set({ keys: extraKeys.map((k, n) => (n === i ? { ...k, ...patch } : k)) })
        const shown = result.items.slice(0, RENDER_LIMIT)
        const numberedOutput = result.items.map((it, i) => `${i + 1}. ${it.text}`).join("\n")

        return (
                <div className="space-y-6" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); loadFile(e.dataTransfer.files[0]) }}>
                        <a href="#sorter-result" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">Skip to the result</a>
                        <div aria-live="polite" aria-atomic="true" className="sr-only">{live}</div>

                        {draft ? <div className={`${BOX} flex flex-wrap items-center gap-2 text-sm`}><Info className="size-4 shrink-0" aria-hidden /><span>A saved draft from this browser is available.</span><Button variant="primary" onClick={() => { setInput(draft); dismiss() }}>Restore it</Button><Button onClick={dismiss}>Dismiss</Button></div> : null}

                        {/* Input */}
                        <section className={BOX} aria-label="Your list">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <label htmlFor="sorter-input" className="text-sm font-medium">Your list</label>
                                        <div className="flex flex-wrap items-center gap-1">
                                                <label className={CHIP}><FileUp className="size-3" aria-hidden />Load a file<input type="file" accept=".txt,.csv,.tsv,.md,.json,.log" className="sr-only" onChange={(e) => loadFile(e.target.files?.[0])} /></label>
                                                <Button onClick={undo.undo} disabled={!undo.canUndo} title="Undo"><Undo2 className="size-4" aria-hidden /></Button>
                                                <Button onClick={undo.redo} disabled={!undo.canRedo} title="Redo"><Redo2 className="size-4" aria-hidden /></Button>
                                                <Button onClick={() => { setInput(""); setHeavyResult(null); setLive("Cleared.") }} disabled={input.length === 0}><Eraser className="size-4" aria-hidden />Clear</Button>
                                        </div>
                                </div>
                                <textarea id="sorter-input" value={input} onChange={(e) => setInput(e.target.value)} onPaste={(e) => { const t = e.clipboardData.getData("text/plain"); if (t) { e.preventDefault(); setInput(t) } }} rows={10} spellCheck={false} placeholder="Paste your list here, one item per line, or drop a file anywhere on this page" className={`w-full resize-y rounded-md border bg-background p-2 font-mono text-sm ${FOCUS}`} />
                                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                        <span>{input.length === 0 ? 0 : input.split(/\r\n|\r|\n/u).length} lines</span>
                                        <span>{(input.match(/[\p{L}\p{N}]+/gu) ?? []).length} words</span>
                                        <span>{input.length.toLocaleString()} characters</span>
                                        <span>Line endings: {detectLineEnding(input)}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Samples:</span>
                                        {SAMPLES.map((s) => <button key={s.label} type="button" className={CHIP} title={s.hint} onClick={() => { setInput(s.text); if (s.options) set(s.options); setLive(`Loaded the ${s.label} sample.`) }}><Lightbulb className="size-3" aria-hidden />{s.label}</button>)}
                                </div>
                        </section>

                        {tooBig ? <p className="rounded-md border border-destructive p-3 text-sm text-destructive"><AlertTriangle className="mr-1 inline size-4" aria-hidden />This tool handles up to {MAX_CHARS.toLocaleString()} characters. Sort a smaller section.</p> : input.length > WARN_CHARS ? <p className="rounded-md border p-3 text-sm text-muted-foreground"><Info className="mr-1 inline size-4" aria-hidden />This is a large list, so it is processed in stages and can be stopped.</p> : null}

                        {busy ? <div className={`${BOX} flex items-center gap-3 text-sm`}><span>Sorting… {Math.round(progress * 100)}%</span><div className="h-2 flex-1 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></div><Button variant="danger" onClick={() => { cancelRef.current = true }}>Stop</Button></div> : null}

                        {/* Settings */}
                        <section className={BOX} aria-label="Sort settings">
                                <div className="mb-3 flex flex-wrap items-center gap-2">
                                        {PRESETS.map((p) => <button key={p.id} type="button" className={CHIP} title={p.description} onClick={() => { set(p.values); setLive(`${p.label} preset applied.`) }}>{p.label}</button>)}
                                        {saved.map((p) => <button key={p.id} type="button" className={CHIP} onClick={() => setOpts(p.values)}>{p.label}</button>)}
                                        <Button onClick={() => { const label = window.prompt("Name for this preset"); if (label) setSaved([{ id: String(Date.now()), label, values: opts }, ...saved].slice(0, 12)) }}>Save preset</Button>
                                        <Button onClick={() => { setOpts(DEFAULT_OPTIONS); setLive("Settings reset.") }}><RotateCcw className="size-4" aria-hidden />Reset</Button>
                                        <Button onClick={() => { void navigator.clipboard.writeText(shareLink()); setLive("Share link copied.") }}><Link2 className="size-4" aria-hidden />Copy link</Button>
                                </div>

                                <div className="grid gap-4 md:grid-cols-3">
                                        <div className="space-y-3">
                                                <div><label htmlFor="sorter-unit" className="text-sm font-medium">What to sort</label><select id="sorter-unit" value={opts.unit} onChange={(e) => set({ unit: e.target.value as SortUnit })} className={INPUT}>{UNITS.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}</select></div>
                                                <div><label htmlFor="sorter-by" className="text-sm font-medium">Order</label><select id="sorter-by" value={opts.by} onChange={(e) => set({ by: e.target.value as SortBy })} className={INPUT}>{KEYS.map((k) => <option key={k.v} value={k.v}>{k.label}</option>)}</select></div>
                                                <div><label htmlFor="sorter-dir" className="text-sm font-medium">Direction</label><select id="sorter-dir" value={opts.direction ?? "asc"} onChange={(e) => set({ direction: e.target.value as Direction, reverse: e.target.value === "desc" })} disabled={opts.by === "random" || opts.by === "reverse" || opts.by === "none"} className={INPUT}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div>
                                                {opts.by === "random" ? <div><label htmlFor="sorter-seed" className="text-sm font-medium">Shuffle seed</label><input id="sorter-seed" value={opts.seed ?? ""} onChange={(e) => set({ seed: e.target.value })} placeholder="leave empty for a different order each time" className={INPUT} /><p className="mt-1 text-xs text-muted-foreground">The same seed always gives the same order, so a draw can be repeated.</p></div> : null}
                                                {opts.by === "pattern" ? <div><label htmlFor="sorter-keypat" className="text-sm font-medium">Sort key pattern</label><input id="sorter-keypat" value={opts.keyPattern ?? ""} onChange={(e) => set({ keyPattern: e.target.value })} placeholder="^(\w+)" className={INPUT} /></div> : null}
                                                {opts.unit === "pattern" ? <div><label htmlFor="sorter-splitpat" className="text-sm font-medium">Split pattern</label><input id="sorter-splitpat" value={opts.splitPattern ?? ""} onChange={(e) => set({ splitPattern: e.target.value })} placeholder="\n---\n" className={INPUT} /></div> : null}
                                        </div>

                                        <div className="space-y-3">
                                                <div>
                                                        <label htmlFor="sorter-locale" className="text-sm font-medium">Language for alphabetical order</label>
                                                        <select id="sorter-locale" value={LOCALES.some((l) => l.tag === opts.locale) ? opts.locale ?? "" : "custom"} onChange={(e) => { if (e.target.value === "custom") set({ locale: customLocale }); else set({ locale: e.target.value }) }} className={INPUT}>{LOCALES.map((l) => <option key={l.tag || "auto"} value={l.tag}>{l.label}</option>)}<option value="custom">Another language tag…</option></select>
                                                        <div className="mt-2"><label htmlFor="sorter-locale-custom" className="text-xs text-muted-foreground">Custom BCP-47 tag</label><input id="sorter-locale-custom" value={customLocale} onChange={(e) => { setCustomLocale(e.target.value); if (isValidLocale(e.target.value)) set({ locale: e.target.value }) }} placeholder="pt-BR" aria-invalid={localeInvalid} aria-describedby="sorter-locale-help" className={INPUT} /><p id="sorter-locale-help" className={`mt-1 text-xs ${localeInvalid ? "text-destructive" : "text-muted-foreground"}`}>{localeInvalid ? "That is not a language tag the browser recognises, so it is being ignored. Tags look like en, en-GB or pt-BR." : "Languages disagree about order: in Swedish \u00e4 comes after z, in German it sorts with a."}</p></div>
                                                </div>
                                                <Toggle id="sorter-ci" checked={opts.caseInsensitive ?? false} onChange={(v) => set({ caseInsensitive: v })} label="Ignore upper and lower case" />
                                                <Toggle id="sorter-acc" checked={opts.ignoreAccents ?? false} onChange={(v) => set({ ignoreAccents: v })} label="Ignore accents" hint="é sorts with e." />
                                                <Toggle id="sorter-numcoll" checked={opts.numericCollation ?? true} onChange={(v) => set({ numericCollation: v })} label="Read digits inside words as numbers" />
                                                <Toggle id="sorter-lead" checked={opts.ignoreLeading ?? false} onChange={(v) => set({ ignoreLeading: v })} label="Ignore indentation and bullets when comparing" />
                                        </div>

                                        <div className="space-y-3">
                                                <Toggle id="sorter-trim" checked={opts.trimItems ?? true} onChange={(v) => set({ trimItems: v })} label="Trim each item" />
                                                <Toggle id="sorter-empty" checked={opts.keepEmpty ?? false} onChange={(v) => set({ keepEmpty: v })} label="Keep empty items" />
                                                <Toggle id="sorter-dup" checked={opts.removeDuplicates ?? false} onChange={(v) => set({ removeDuplicates: v, duplicatesOnly: false })} label="Remove duplicates" />
                                                <Toggle id="sorter-duponly" checked={opts.duplicatesOnly ?? false} onChange={(v) => set({ duplicatesOnly: v, removeDuplicates: false })} label="Show only the duplicates" hint="With a count of how often each appears." />
                                                <Toggle id="sorter-markers" checked={opts.stripMarkers ?? false} onChange={(v) => set({ stripMarkers: v })} label="Ignore bullets and numbering" hint="Restored after sorting." />
                                                <Toggle id="sorter-renum" checked={opts.renumber ?? false} onChange={(v) => set({ renumber: v })} label="Renumber the list afterwards" />
                                                <div><label htmlFor="sorter-skip" className="text-sm font-medium">Leave the first N lines alone</label><input id="sorter-skip" type="number" min={0} value={opts.skipFirst ?? 0} onChange={(e) => set({ skipFirst: Math.max(0, Number(e.target.value)) })} className={INPUT} /></div>
                                                {opts.unit === "csv-column" ? <>
                                                        <div><label htmlFor="sorter-col" className="text-sm font-medium">Column, counting from 0</label><input id="sorter-col" type="number" min={0} value={opts.csvColumn ?? 0} onChange={(e) => set({ csvColumn: Math.max(0, Number(e.target.value)) })} className={INPUT} /></div>
                                                        <div><label htmlFor="sorter-delim" className="text-sm font-medium">Delimiter</label><div className="flex gap-2"><input id="sorter-delim" value={opts.csvDelimiter ?? ","} onChange={(e) => set({ csvDelimiter: e.target.value })} className={INPUT} /><Button onClick={() => { const d = detectDelimiter(input); set({ csvDelimiter: d }); setLive(`Delimiter detected as ${d === "\t" ? "tab" : d}.`) }}>Detect</Button></div></div>
                                                        <Toggle id="sorter-header" checked={opts.csvHasHeader ?? true} onChange={(v) => set({ csvHasHeader: v })} label="First row is a header" hint="It stays at the top." />
                                                </> : null}
                                        </div>
                                </div>

                                {/* F039 — extra sort levels */}
                                <div className="mt-4 border-t pt-3">
                                        <div className="mb-2 flex flex-wrap items-center gap-2"><h3 className="text-sm font-medium">Then sort by</h3><Button onClick={() => set({ keys: [...extraKeys, { by: "alphabetical" as const, direction: "asc" as const }].slice(0, 2) })} disabled={extraKeys.length >= 2}>Add a level</Button><span className="text-xs text-muted-foreground">Used when the first key is a tie.</span></div>
                                        {extraKeys.map((k, i) => <div key={i} className="mb-2 flex flex-wrap items-end gap-2">
                                                <div><label htmlFor={`sorter-k${i}`} className="text-xs text-muted-foreground">Level {i + 2} key</label><select id={`sorter-k${i}`} value={k.by} onChange={(e) => setKey(i, { by: e.target.value as SortBy })} className={INPUT}>{KEYS.filter((x) => x.v !== "random" && x.v !== "reverse" && x.v !== "none").map((x) => <option key={x.v} value={x.v}>{x.label}</option>)}</select></div>
                                                <div><label htmlFor={`sorter-kd${i}`} className="text-xs text-muted-foreground">Direction</label><select id={`sorter-kd${i}`} value={k.direction} onChange={(e) => setKey(i, { direction: e.target.value as Direction })} className={INPUT}><option value="asc">Ascending</option><option value="desc">Descending</option></select></div>
                                                <Button variant="danger" onClick={() => set({ keys: extraKeys.filter((_, n) => n !== i) })}><X className="size-4" aria-hidden />Remove</Button>
                                        </div>)}
                                </div>
                        </section>

                        {/* Statistics */}
                        {result.inputCount > 0 ? <section className={BOX} aria-label="Summary">
                                <p className="mb-3 text-sm">{result.summary}</p>
                                <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
                                        {([["Items in", result.inputCount], ["Items out", result.outputCount], ["Blank removed", result.blanksRemoved], ["Duplicates removed", result.duplicatesRemoved], ["Changed position", result.movedCount], ["Unreadable keys", result.unparsedCount], ["Longest item", `${result.longest.length} ch`]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-mono text-lg">{typeof v === "number" ? v.toLocaleString() : v}</dd></div>)}
                                </dl>
                                {result.warnings.length > 0 ? <ul className="mt-3 space-y-1">{result.warnings.map((w) => <li key={w} className="text-xs text-muted-foreground"><Info className="mr-1 inline size-3" aria-hidden />{w}</li>)}</ul> : null}
                        </section> : null}

                        {/* Result */}
                        <section id="sorter-result" className={BOX} aria-label="The sorted result">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                        <h3 className="text-sm font-medium">Result</h3>
                                        <div className="flex flex-wrap gap-2">
                                                <Toggle id="sorter-before" checked={showBefore} onChange={setShowBefore} label="Show before and after" />
                                                <CopyButton text={result.output} label="Copy" onDone={setLive} />
                                                <CopyButton text={numberedOutput} label="Copy numbered" onDone={setLive} />
                                                <Button onClick={() => history.add(input, result.summary)} disabled={input.length === 0}><Pin className="size-4" aria-hidden />Save</Button>
                                                <Button onClick={() => setDialog("history")}><SquareStack className="size-4" aria-hidden />History ({history.entries.length})</Button>
                                                <Button onClick={() => setDialog("shortcuts")}><Keyboard className="size-4" aria-hidden />Shortcuts</Button>
                                        </div>
                                </div>
                                {result.outputCount === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Paste a list above and the sorted version appears here as you type.</p> : result.alreadySorted ? <p className="mb-2 rounded-md border p-2 text-sm"><Check className="mr-1 inline size-4" aria-hidden />This list is already in the order you asked for, so nothing moved.</p> : null}
                                {result.outputCount > 0 ? <div className="overflow-auto rounded border">
                                        <table className="w-full border-collapse text-sm">
                                                <caption className="sr-only">The sorted items, with the position each one held before sorting.</caption>
                                                <thead className="bg-muted/40 text-left text-xs"><tr><th scope="col" className="w-14 px-2 py-1">#</th>{showBefore ? <th scope="col" className="w-14 px-2 py-1">Was</th> : null}<th scope="col" className="px-2 py-1">Item</th></tr></thead>
                                                <tbody>
                                                        {result.header.map((h, i) => <tr key={`h${i}`} className="bg-muted/30"><td className="px-2 py-1 text-xs text-muted-foreground">header</td>{showBefore ? <td className="px-2 py-1" /> : null}<td className="whitespace-pre-wrap break-words px-2 py-1 font-mono">{h}</td></tr>)}
                                                        {shown.map((it, i) => <tr key={`${it.origin}-${i}`} className={it.origin !== i ? "bg-amber-500/5" : ""}>
                                                                <td className="px-2 py-1 text-xs text-muted-foreground">{i + 1}</td>
                                                                {showBefore ? <td className="px-2 py-1 text-xs text-muted-foreground">{it.origin + 1}{it.origin !== i ? <span className="sr-only"> moved</span> : null}</td> : null}
                                                                <td className="whitespace-pre-wrap break-words px-2 py-1 font-mono">{it.text || "\u00a0"}{it.count && it.count > 1 ? <span className="ml-2 rounded bg-muted px-1 text-xs">×{it.count}</span> : null}{it.unparsed ? <span className="ml-2 rounded bg-amber-500/20 px-1 text-xs">not readable as a {opts.by}</span> : null}</td>
                                                        </tr>)}
                                                </tbody>
                                        </table>
                                </div> : null}
                                {result.items.length > RENDER_LIMIT ? <p className="mt-2 text-xs text-muted-foreground">Showing the first {RENDER_LIMIT.toLocaleString()} of {result.items.length.toLocaleString()} items to keep the page responsive. Copy or download to get all of them.</p> : null}
                                {result.outputCount > 0 ? <div className="mt-3 flex flex-wrap gap-2">
                                        {(["txt", "md", "json", "csv", "html"] as ExportFormat[]).map((f) => <Button key={f} onClick={() => { download(`sorted-${stamp()}.${f}`, serialize(f, result, opts), MIME[f]); setLive(`Downloaded the ${f.toUpperCase()} file.`) }}><Download className="size-4" aria-hidden />{f === "html" ? "HTML report" : f.toUpperCase()}</Button>)}
                                        <Button onClick={() => download(`sort-stats-${stamp()}.csv`, statsToCsv(result, opts), MIME.csv)}><Download className="size-4" aria-hidden />Stats CSV</Button>
                                        <Button onClick={() => { setInput(result.output); setLive("The result is now the input.") }}><ArrowDownUp className="size-4" aria-hidden />Use the result as the input</Button>
                                </div> : null}
                                <div className="mt-3"><Toggle id="sorter-shareinput" checked={shareInput} onChange={setShareInput} label="Include the list in the share link" hint="Off by default. Only for short, non-sensitive lists." /></div>
                        </section>

                        {/* Privacy */}
                        <section className={BOX} aria-label="Privacy">
                                <h3 className="mb-1 flex items-center gap-2 text-sm font-medium"><ShieldCheck className="size-4" aria-hidden />Your list stays here</h3>
                                <p className="text-sm text-muted-foreground">Sorting happens in this browser tab. Nothing is uploaded, and the tool works offline. Settings, history and drafts are stored only in this browser, and you can delete them now.</p>
                                <div className="mt-2"><Button variant="danger" onClick={() => { clearAllStorage(); history.clearAll(); setLive("Everything stored by this tool was deleted.") }}><Trash2 className="size-4" aria-hidden />Delete everything stored</Button></div>
                        </section>

                        {/* Help */}
                        <section className={BOX} aria-label="Help">
                                <h3 className="mb-2 text-sm font-medium">How to use it</h3>
                                <ol className="mb-4 list-decimal space-y-1 pl-5 text-sm">{HOW_TO.map((s) => <li key={s.name}><strong>{s.name}.</strong> {s.text}</li>)}</ol>
                                <h3 className="mb-2 text-sm font-medium">Questions</h3>
                                <div className="mb-4 space-y-2">{FAQ.map((f) => <details key={f.question} className="rounded border p-2"><summary className={`cursor-pointer text-sm font-medium ${FOCUS}`}>{f.question}</summary><p className="mt-1 text-sm text-muted-foreground">{f.answer}</p></details>)}</div>
                                <h3 className="mb-1 text-sm font-medium">What it assumes</h3>
                                <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
                                <h3 className="mb-1 text-sm font-medium">Related tools</h3>
                                <ul className="mb-4 space-y-1 text-sm">{RELATED.map((r) => <li key={r.id}><a href={`/tools/${r.id}`} className={`underline ${FOCUS}`}>{r.label}</a> <span className="text-muted-foreground">— {r.why}</span></li>)}</ul>
                                <p className="text-xs text-muted-foreground">Also known as: {ALIASES.join(", ")}.</p>
                        </section>

                        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
                                "@context": "https://schema.org",
                                "@graph": [
                                        { "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
                                        { "@type": "HowTo", name: "How to sort a list of text", step: HOW_TO.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) },
                                ],
                        }) }} />

                        <Dialog open={dialog === "shortcuts"} onClose={() => setDialog("none")} title="Keyboard shortcuts">
                                <table className="w-full text-sm"><caption className="sr-only">Keyboard shortcuts</caption><thead><tr><th scope="col" className="text-left">Keys</th><th scope="col" className="text-left">Action</th></tr></thead><tbody>{SHORTCUTS.map((s) => <tr key={s.keys}><td className="py-1 pr-4 font-mono text-xs">{s.keys}</td><td className="py-1">{s.label}</td></tr>)}</tbody></table>
                        </Dialog>

                        <Dialog open={dialog === "history"} onClose={() => setDialog("none")} title="Recent lists">
                                {history.entries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing saved yet. Use Save to keep a list you may want again.</p> : <ul className="space-y-2">{history.entries.map((e) => <li key={e.id} className="rounded border p-2 text-sm"><p className="mb-1 text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}</p><p className="mb-2">{e.summary}</p><div className="flex flex-wrap gap-2"><Button onClick={() => { setInput(e.input); setDialog("none") }}>Load</Button><Button onClick={() => history.togglePin(e.id)}><Pin className="size-4" aria-hidden />{e.pinned ? "Unpin" : "Pin"}</Button><Button variant="danger" onClick={() => history.remove(e.id)}><Trash2 className="size-4" aria-hidden />Remove</Button></div></li>)}</ul>}
                                {history.entries.length > 0 ? <div className="mt-3"><Button variant="danger" onClick={() => history.clearAll()}>Clear all history</Button></div> : null}
                        </Dialog>
                </div>
        )
}

"use client"

/**
 * Lorem Ipsum Generator — UI half of the 100x rebuild.
 *
 * Copy to: src/tools/text/lorem-ipsum-generator/ui.tsx
 * Requires: CODE-1-ENGINE.ts copied to ./logic
 *
 * Imports only react, lucide-react and ./logic. No project imports, no new deps.
 */

import { AlertTriangle, Check, Copy, Download, Eraser, Info, Keyboard, Lightbulb, Link2, Pin, RotateCcw, Shuffle, SquareStack, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
	ALIASES, ASSUMPTIONS, CHUNK_THRESHOLD, DEFAULT_OPTIONS, EMPTY_RESULT, FAQ, FORMATS, HOW_TO, LIMITS, PRESETS, RELATED, RENDER_LIMIT, SHORTCUTS, UNITS, VARIANTS,
	clearAllStorage, download, formatMeta, generateChunked, generateFull, randomSeed, serialize, stamp, useDebounced, useHistory, usePersisted, useSavedWordLists,
	type GenerateOptions, type GenerateResult, type OutputFormat, type Unit, type Variant,
} from "./logic"

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const BOX = "rounded-lg border bg-card p-4"
const CHIP = `inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs hover:bg-muted ${FOCUS}`
const INPUT = `w-full rounded-md border bg-background px-2 py-1.5 text-sm ${FOCUS}`

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

function Num({ id, label, value, onChange, min = 0, max, invalid, help }: { id: string; label: string; value: number; onChange: (n: number) => void; min?: number; max?: number; invalid?: boolean; help?: string }) {
	return <div>
		<label htmlFor={id} className="text-sm font-medium">{label}</label>
		<input id={id} type="number" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-invalid={invalid} aria-describedby={help ? `${id}-help` : undefined} className={INPUT} />
		{help ? <p id={`${id}-help`} className={`mt-1 text-xs ${invalid ? "text-destructive" : "text-muted-foreground"}`}>{help}</p> : null}
	</div>
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

export default function LoremIpsumGenerator() {
	const [opts, setOpts] = usePersisted<GenerateOptions>("options", DEFAULT_OPTIONS)
	const [customWordsInput, setCustomWordsInput] = usePersisted<string>("customWords", "")
	const [saved, setSaved] = usePersisted<Array<{ id: string; label: string; values: GenerateOptions }>>("presets", [])
	const [showSource, setShowSource] = usePersisted<boolean>("showSource", false)
	const [live, setLive] = useState("")
	const [busy, setBusy] = useState(false)
	const [progress, setProgress] = useState(0)
	const [heavyResult, setHeavyResult] = useState<GenerateResult | null>(null)
	const [nonce, setNonce] = useState(0)
	const [dialog, setDialog] = useState<"none" | "shortcuts" | "history" | "lists">("none")
	const cancelRef = useRef(false)
	const history = useHistory()
	const lists = useSavedWordLists()

	const set = useCallback((patch: Partial<GenerateOptions>) => setOpts({ ...opts, ...patch }), [opts, setOpts])

	const customWords = useMemo(() => customWordsInput.split(/[\s,]+/u).filter(Boolean), [customWordsInput])
	const effective = useMemo<GenerateOptions>(() => ({ ...opts, customWords }), [opts, customWords])
	const debounced = useDebounced(effective)
	const heavy = opts.count > CHUNK_THRESHOLD
	const limit = LIMITS[opts.unit] ?? 1000
	const overLimit = opts.count > limit
	const wordsInvalid = opts.minWordsPerSentence > opts.maxWordsPerSentence
	const sentInvalid = opts.minSentencesPerParagraph > opts.maxSentencesPerParagraph
	const customTooShort = opts.variant === "custom" && customWords.length < 5

	useEffect(() => {
		if (typeof window === "undefined") return
		const p = new URLSearchParams(window.location.search)
		const patch: Partial<GenerateOptions> = {}
		const v = p.get("v")
		if (v && VARIANTS.some((x) => x.v === v)) patch.variant = v as Variant
		const u = p.get("u")
		if (u && UNITS.some((x) => x.v === u)) patch.unit = u as Unit
		const f = p.get("f")
		if (f && FORMATS.some((x) => x.v === f)) patch.format = f as OutputFormat
		const c = Number(p.get("c"))
		if (Number.isFinite(c) && c > 0) patch.count = c
		const s = p.get("sd")
		if (s) patch.seed = s
		if (Object.keys(patch).length > 0) set(patch)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	/* F057 — live preview. The old tool showed nothing until a button was pressed. */
	const quick = useMemo(() => (heavy ? EMPTY_RESULT : generateFull(debounced)), [debounced, heavy, nonce])
	const result = heavy ? (heavyResult ?? EMPTY_RESULT) : quick

	const runHeavy = useCallback(async () => {
		cancelRef.current = false
		setBusy(true)
		const res = await generateChunked(debounced, setProgress, () => cancelRef.current)
		setHeavyResult(res.result)
		setBusy(false)
		setLive(res.cancelled ? "Generation stopped." : `Generated ${res.result.words.toLocaleString()} words.`)
	}, [debounced])

	useEffect(() => { if (heavy) void runHeavy() }, [heavy, runHeavy])
	useEffect(() => { if (!heavy && result.words > 0) setLive(`Generated ${result.words.toLocaleString()} words in ${result.paragraphs || result.blocks.length} block${(result.paragraphs || result.blocks.length) === 1 ? "" : "s"}.`) }, [heavy, result.words, result.paragraphs, result.blocks.length])

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const mod = e.ctrlKey || e.metaKey
			if (mod && e.key === "Enter") { e.preventDefault(); setNonce((n) => n + 1); if (heavy) void runHeavy(); setLive("Generated again.") }
			else if (mod && e.shiftKey && e.key.toLowerCase() === "c") { e.preventDefault(); void navigator.clipboard.writeText(result.output); setLive("Result copied.") }
			else if (mod && e.shiftKey && e.key.toLowerCase() === "s") { e.preventDefault(); const s = randomSeed(); set({ seed: s }); setLive(`New seed ${s}.`) }
			else if (mod && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); const i = FORMATS.findIndex((f) => f.v === opts.format); const nextF = FORMATS[(i + 1) % FORMATS.length]; if (nextF) { set({ format: nextF.v }); setLive(`Format is now ${nextF.label}.`) } }
			else if (e.key === "?" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) { e.preventDefault(); setDialog("shortcuts") }
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [result.output, opts.format, heavy, runHeavy, set])

	const shareLink = (): string => {
		if (typeof window === "undefined") return ""
		const p = new URLSearchParams({ v: opts.variant, u: opts.unit, f: opts.format, c: String(opts.count) })
		if ((opts.seed ?? "").length > 0) p.set("sd", opts.seed ?? "")
		return `${window.location.origin}${window.location.pathname}?${p.toString()}`
	}

	const meta = formatMeta(opts.format)
	const isHtmlish = opts.format === "html" || opts.format === "ul" || opts.format === "ol"
	const shownBlocks = result.blocks.slice(0, RENDER_LIMIT)

	return (
		<div className="space-y-6">
			<a href="#lorem-result" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-card focus:px-3 focus:py-2">Skip to the generated text</a>
			<div aria-live="polite" aria-atomic="true" className="sr-only">{live}</div>

			{/* Settings */}
			<section className={BOX} aria-label="Generator settings">
				<div className="mb-3 flex flex-wrap items-center gap-2">
					{PRESETS.map((p) => <button key={p.id} type="button" className={CHIP} title={p.description} onClick={() => { set(p.values); setLive(`${p.label} preset applied.`) }}><Lightbulb className="size-3" aria-hidden />{p.label}</button>)}
					{saved.map((p) => <button key={p.id} type="button" className={CHIP} onClick={() => setOpts(p.values)}>{p.label}</button>)}
					<Button onClick={() => { const label = window.prompt("Name for this preset"); if (label) setSaved([{ id: String(Date.now()), label, values: opts }, ...saved].slice(0, 12)) }}>Save preset</Button>
					<Button onClick={() => { setOpts(DEFAULT_OPTIONS); setLive("Settings reset.") }}><RotateCcw className="size-4" aria-hidden />Reset</Button>
					<Button onClick={() => { void navigator.clipboard.writeText(shareLink()); setLive("Share link copied.") }}><Link2 className="size-4" aria-hidden />Copy link</Button>
				</div>

				<div className="grid gap-4 md:grid-cols-4">
					<div><label htmlFor="lorem-variant" className="text-sm font-medium">Flavour</label><select id="lorem-variant" value={opts.variant} onChange={(e) => set({ variant: e.target.value as Variant })} className={INPUT}>{VARIANTS.map((v) => <option key={v.v} value={v.v}>{v.label}</option>)}</select></div>
					<div><label htmlFor="lorem-unit" className="text-sm font-medium">Measure in</label><select id="lorem-unit" value={opts.unit} onChange={(e) => set({ unit: e.target.value as Unit })} className={INPUT}>{UNITS.map((u) => <option key={u.v} value={u.v}>{u.label}</option>)}</select></div>
					<Num id="lorem-count" label="How many" value={opts.count} onChange={(n) => set({ count: n })} min={1} max={limit} invalid={overLimit} help={overLimit ? `The most for ${opts.unit} is ${limit.toLocaleString()}.` : `Up to ${limit.toLocaleString()}.`} />
					<div><label htmlFor="lorem-format" className="text-sm font-medium">Output format</label><select id="lorem-format" value={opts.format} onChange={(e) => set({ format: e.target.value as OutputFormat })} className={INPUT}>{FORMATS.map((f) => <option key={f.v} value={f.v}>{f.label}</option>)}</select></div>
				</div>

				{opts.variant === "custom" ? <div className="mt-4">
					<label htmlFor="lorem-custom" className="text-sm font-medium">Your words, separated by spaces or commas</label>
					<textarea id="lorem-custom" value={customWordsInput} onChange={(e) => setCustomWordsInput(e.target.value)} rows={2} aria-invalid={customTooShort} aria-describedby="lorem-custom-help" placeholder="alpha beta gamma delta epsilon" className={`${INPUT} font-mono`} />
					<p id="lorem-custom-help" className={`mt-1 text-xs ${customTooShort ? "text-destructive" : "text-muted-foreground"}`}>{customTooShort ? `At least five words are needed. You have ${customWords.length}. Until then the classic Lorem Ipsum words are used.` : `${customWords.length} words. Your words are never mixed with Latin.`}</p>
					<div className="mt-2 flex flex-wrap gap-2">
						<Button onClick={() => { const label = window.prompt("Name for this word list"); if (label && customWords.length >= 5) { lists.save(label, customWords); setLive("Word list saved.") } }}>Save this list</Button>
						<Button onClick={() => setDialog("lists")}>Saved lists ({lists.lists.length})</Button>
					</div>
				</div> : null}

				<div className="mt-4 grid gap-4 md:grid-cols-4">
					<Num id="lorem-wmin" label="Words per sentence, least" value={opts.minWordsPerSentence} onChange={(n) => set({ minWordsPerSentence: n })} min={1} invalid={wordsInvalid} help={wordsInvalid ? "The least is larger than the most, so they will be swapped." : undefined} />
					<Num id="lorem-wmax" label="Words per sentence, most" value={opts.maxWordsPerSentence} onChange={(n) => set({ maxWordsPerSentence: n })} min={1} invalid={wordsInvalid} />
					<Num id="lorem-smin" label="Sentences per paragraph, least" value={opts.minSentencesPerParagraph} onChange={(n) => set({ minSentencesPerParagraph: n })} min={1} invalid={sentInvalid} help={sentInvalid ? "The least is larger than the most, so they will be swapped." : undefined} />
					<Num id="lorem-smax" label="Sentences per paragraph, most" value={opts.maxSentencesPerParagraph} onChange={(n) => set({ maxSentencesPerParagraph: n })} min={1} invalid={sentInvalid} />
				</div>

				<div className="mt-4 grid gap-4 md:grid-cols-4">
					<Num id="lorem-heading" label="Heading every N paragraphs" value={opts.headingEvery ?? 0} onChange={(n) => set({ headingEvery: n })} help="0 means none." />
					<Num id="lorem-list" label="List every N paragraphs" value={opts.listEvery ?? 0} onChange={(n) => set({ listEvery: n })} help="0 means none." />
					<Num id="lorem-quote" label="Quote every N paragraphs" value={opts.quoteEvery ?? 0} onChange={(n) => set({ quoteEvery: n })} help="0 means none." />
					<Num id="lorem-wrap" label="Wrap at column" value={opts.wrapAt ?? 0} onChange={(n) => set({ wrapAt: n })} help="0 means do not wrap." />
					<Num id="lorem-emph" label="Bold and italic density %" value={opts.emphasisDensity ?? 0} onChange={(n) => set({ emphasisDensity: n })} max={100} help="Applies to HTML, Markdown and JSX." />
					<Num id="lorem-link" label="Link density %" value={opts.linkDensity ?? 0} onChange={(n) => set({ linkDensity: n })} max={100} />
					<Num id="lorem-comma" label="Comma density %" value={opts.commaDensity ?? 0} onChange={(n) => set({ commaDensity: n })} max={100} />
					<Num id="lorem-question" label="Questions %" value={opts.questionRatio ?? 0} onChange={(n) => set({ questionRatio: n })} max={100} />
				</div>

				<div className="mt-4 grid gap-4 md:grid-cols-2">
					<div>
						<label htmlFor="lorem-seed" className="text-sm font-medium">Seed</label>
						<div className="flex gap-2"><input id="lorem-seed" value={opts.seed ?? ""} onChange={(e) => set({ seed: e.target.value })} placeholder="leave empty for a new draw each time" aria-describedby="lorem-seed-help" className={INPUT} /><Button onClick={() => { const s = randomSeed(); set({ seed: s }); setLive(`New seed ${s}.`) }} title="New random seed"><Shuffle className="size-4" aria-hidden /></Button></div>
						<p id="lorem-seed-help" className="mt-1 text-xs text-muted-foreground">With a seed, the same settings always give exactly the same text, so a mock can be recreated later.</p>
					</div>
					<div className="space-y-2 pt-1">
						<Toggle id="lorem-canonical" checked={opts.startWithLorem} onChange={(v) => set({ startWithLorem: v })} label="Start with this flavour's classic opening" hint={opts.variant === "custom" ? "Not used with your own word list." : `For example: "${(VARIANTS.find((v) => v.v === opts.variant)?.opening ?? "").slice(0, 48)}…"`} />
						<Toggle id="lorem-title" checked={opts.titleCase ?? false} onChange={(v) => set({ titleCase: v })} label="Title case the output" />
						<Toggle id="lorem-indent" checked={opts.indent !== false} onChange={(v) => set({ indent: v })} label="Indent HTML, JSX and XML" />
						<Toggle id="lorem-source" checked={showSource} onChange={setShowSource} label="Show the raw source instead of the rendered preview" hint="Only affects the HTML formats." />
					</div>
				</div>
			</section>

			{busy ? <div className={`${BOX} flex items-center gap-3 text-sm`}><span>Generating… {Math.round(progress * 100)}%</span><div className="h-2 flex-1 overflow-hidden rounded bg-muted"><div className="h-full bg-primary" style={{ width: `${Math.round(progress * 100)}%` }} /></div><Button variant="danger" onClick={() => { cancelRef.current = true }}>Stop</Button></div> : null}

			{result.warnings.length > 0 ? <ul className={`${BOX} space-y-1`}>{result.warnings.map((w) => <li key={w} className="text-xs text-muted-foreground"><AlertTriangle className="mr-1 inline size-3" aria-hidden />{w}</li>)}</ul> : null}

			{/* Counts */}
			{result.words > 0 ? <section className={BOX} aria-label="Counts">
				<p className="mb-3 text-sm text-muted-foreground">These counts describe the text itself, not the markup around it.</p>
				<dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
					{([["Words", result.words], ["Characters", result.characters], ["Sentences", result.sentences], ["Paragraphs", result.paragraphs], ["Bytes (UTF-8)", result.bytes], ["Reading time", `${result.readingMinutes} min`], ["Off target", `${result.targetOff > 0 ? "+" : ""}${result.targetOff}%`]] as const).map(([k, v]) => <div key={k}><dt className="text-xs text-muted-foreground">{k}</dt><dd className="font-mono text-lg">{typeof v === "number" ? v.toLocaleString() : v}</dd></div>)}
				</dl>
				{result.seedUsed.length > 0 ? <p className="mt-3 text-xs text-muted-foreground">Seed <code className="rounded bg-muted px-1">{result.seedUsed}</code> — these exact words will come back with the same settings.</p> : <p className="mt-3 text-xs text-muted-foreground">No seed, so this draw cannot be repeated. Add one if you need it again.</p>}
			</section> : null}

			{/* Result */}
			<section id="lorem-result" className={BOX} aria-label="The generated text">
				<div className="mb-2 flex flex-wrap items-center justify-between gap-2">
					<h3 className="text-sm font-medium">Generated text</h3>
					<div className="flex flex-wrap gap-2">
						<Button variant="primary" onClick={() => { setNonce((n) => n + 1); if (heavy) void runHeavy(); setLive("Generated again.") }}><Shuffle className="size-4" aria-hidden />Generate again</Button>
						<CopyButton text={result.output} label="Copy" onDone={setLive} />
						<CopyButton text={result.plain} label="Copy plain" onDone={setLive} />
						<Button onClick={() => history.add(opts, result.seedUsed, `${result.words} words, ${opts.variant}`)} disabled={result.words === 0}><Pin className="size-4" aria-hidden />Save</Button>
						<Button onClick={() => setDialog("history")}><SquareStack className="size-4" aria-hidden />History ({history.entries.length})</Button>
						<Button onClick={() => setDialog("shortcuts")}><Keyboard className="size-4" aria-hidden />Shortcuts</Button>
					</div>
				</div>

				{result.words === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">Choose your settings above and the text appears here immediately.</p> : isHtmlish && !showSource ? (
					/* F053 — a rendered preview, so tags are not mistaken for content. The
					   source is escaped in the engine before it reaches this point. */
					<div className="max-h-[420px] space-y-3 overflow-auto rounded border p-4 text-sm leading-relaxed">
						{shownBlocks.map((b, i) => {
							if (b.kind === "heading") return <h4 key={i} className="font-semibold">{b.text}</h4>
							if (b.kind === "quote") return <blockquote key={i} className="border-l-2 pl-3 italic text-muted-foreground">{b.text}</blockquote>
							if (b.kind === "list-item") return <p key={i} className="pl-4">• {b.text}</p>
							return <p key={i}>{b.text}</p>
						})}
					</div>
				) : (
					/* Prose is prose. Only the code-shaped formats get a monospace face. */
					<div className={`max-h-[420px] overflow-auto whitespace-pre-wrap break-words rounded border bg-muted/30 p-4 text-sm ${opts.format === "text" || opts.format === "markdown" ? "leading-relaxed" : "font-mono"}`}>{result.output}</div>
				)}

				{result.blocks.length > RENDER_LIMIT ? <p className="mt-2 text-xs text-muted-foreground">Showing the first {RENDER_LIMIT} of {result.blocks.length.toLocaleString()} blocks to keep the page responsive. Copy or download for all of them.</p> : null}

				{result.words > 0 ? <div className="mt-3 space-y-2">
					<div className="flex flex-wrap gap-2">
						<Button variant="primary" onClick={() => { download(`lorem-ipsum-${stamp()}.${meta.ext}`, serialize(opts.format, result, opts), meta.mime); setLive(`Downloaded the ${meta.label} file.`) }}><Download className="size-4" aria-hidden />Download {meta.label} (.{meta.ext})</Button>
						{FORMATS.filter((f) => f.v !== opts.format).map((f) => <Button key={f.v} onClick={() => { download(`lorem-ipsum-${stamp()}.${f.ext}`, serialize(f.v, result, opts), f.mime); setLive(`Downloaded the ${f.label} file.`) }}><Download className="size-4" aria-hidden />{f.label}</Button>)}
					</div>
					<p className="text-xs text-muted-foreground">Each download uses the right extension and type for its format.</p>
				</div> : null}

				{/* F059 — copy one block on its own */}
				{result.blocks.length > 1 && result.blocks.length <= RENDER_LIMIT ? <details className="mt-3 rounded border p-2">
					<summary className={`cursor-pointer text-sm font-medium ${FOCUS}`}>Copy a single block</summary>
					<ul className="mt-2 space-y-1">{result.blocks.map((b, i) => <li key={i} className="flex items-start gap-2 text-sm"><CopyButton text={b.text} label={`#${i + 1}`} onDone={setLive} /><span className="line-clamp-1 text-muted-foreground">{b.text}</span></li>)}</ul>
				</details> : null}
			</section>

			{/* Privacy */}
			<section className={BOX} aria-label="Privacy">
				<h3 className="mb-1 text-sm font-medium">Nothing leaves your browser</h3>
				<p className="text-sm text-muted-foreground">Every word is generated in this tab. There is no network request in this tool and it works offline. Your settings, presets, saved word lists and history are stored only in this browser.</p>
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
					{ "@type": "HowTo", name: "How to generate placeholder text", step: HOW_TO.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) },
				],
			}) }} />

			<Dialog open={dialog === "shortcuts"} onClose={() => setDialog("none")} title="Keyboard shortcuts">
				<table className="w-full text-sm"><caption className="sr-only">Keyboard shortcuts</caption><thead><tr><th scope="col" className="text-left">Keys</th><th scope="col" className="text-left">Action</th></tr></thead><tbody>{SHORTCUTS.map((s) => <tr key={s.keys}><td className="py-1 pr-4 font-mono text-xs">{s.keys}</td><td className="py-1">{s.label}</td></tr>)}</tbody></table>
			</Dialog>

			<Dialog open={dialog === "history"} onClose={() => setDialog("none")} title="Recent generations">
				{history.entries.length === 0 ? <p className="text-sm text-muted-foreground">Nothing saved yet. Use Save to keep a setup, together with its seed, so the same text can be recreated.</p> : <ul className="space-y-2">{history.entries.map((e) => <li key={e.id} className="rounded border p-2 text-sm"><p className="mb-1 text-xs text-muted-foreground">{new Date(e.at).toLocaleString()}{e.seed ? ` — seed ${e.seed}` : " — no seed"}</p><p className="mb-2">{e.summary}</p><div className="flex flex-wrap gap-2"><Button onClick={() => { setOpts(e.options); setDialog("none"); setLive("Settings restored.") }}>Restore</Button><Button onClick={() => history.togglePin(e.id)}><Pin className="size-4" aria-hidden />{e.pinned ? "Unpin" : "Pin"}</Button><Button variant="danger" onClick={() => history.remove(e.id)}><Trash2 className="size-4" aria-hidden />Remove</Button></div></li>)}</ul>}
				{history.entries.length > 0 ? <div className="mt-3"><Button variant="danger" onClick={() => history.clearAll()}><Eraser className="size-4" aria-hidden />Clear all history</Button></div> : null}
			</Dialog>

			<Dialog open={dialog === "lists"} onClose={() => setDialog("none")} title="Saved word lists">
				{lists.lists.length === 0 ? <p className="text-sm text-muted-foreground">No saved lists yet. Type at least five words, then use Save this list.</p> : <ul className="space-y-2">{lists.lists.map((l) => <li key={l.id} className="rounded border p-2 text-sm"><p className="mb-1 font-medium">{l.label} <span className="text-xs text-muted-foreground">({l.words.length} words)</span></p><p className="mb-2 line-clamp-2 text-xs text-muted-foreground">{l.words.join(" ")}</p><div className="flex gap-2"><Button onClick={() => { setCustomWordsInput(l.words.join(" ")); set({ variant: "custom" }); setDialog("none") }}>Use it</Button><Button variant="danger" onClick={() => lists.remove(l.id)}><Trash2 className="size-4" aria-hidden />Delete</Button></div></li>)}</ul>}
				<p className="mt-3 text-xs text-muted-foreground"><Info className="mr-1 inline size-3" aria-hidden />Saved lists live in this browser only.</p>
			</Dialog>
		</div>
	)
}

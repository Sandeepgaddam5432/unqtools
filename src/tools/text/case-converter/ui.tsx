"use client"

/**
 * Text Case Converter — UI half of the 100x rebuild.
 *
 * Copy to: src/tools/text/case-converter/ui.tsx
 * Needs:   CODE-1-ENGINE.ts copied to src/tools/text/case-converter/logic.ts
 *
 * Imports only react, lucide-react and ./logic. Nothing else in the repo changes.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import {
	AlertTriangle, Check, Copy, Download, Eraser, FileUp, Info, Keyboard,
	Lightbulb, Link2, Redo2, RotateCcw, ShieldCheck, Trash2, Undo2, X,
} from "lucide-react"
import {
	ALIASES, ASSUMPTIONS, BY_ID, CHUNK_THRESHOLD, DEFAULTS, FAQ, HOW_TO, MAX_CHARS,
	MAX_HISTORY, MAX_PRESETS, MIME, PRESETS, RELATED, RENDER_LIMIT, SAMPLES, SHORTCUTS,
	STYLE_GROUPS, STYLES, WARN_CHARS, buildReceipt, clearAllStorage, convertChunked,
	convertSync, countGraphemes, countWords, csvCell, detectCurrentStyle, detectScripts,
	diffSummary, download, hasCase, isBadPattern, serialize, splitLines,
	type ExportFormat, type NumberHandling, type Options, type Preset, type StyleId,
} from "./logic"
import { useDraft, useHistory, usePersisted, useUndoRedo } from "./logic"

/* ===== UI atoms ===== */

const FOCUS = "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
const CHIP = `rounded-full border border-border px-3 py-1 text-xs hover:bg-muted ${FOCUS}`
const INPUT = `w-full rounded-md border border-border bg-background px-3 py-2 text-sm ${FOCUS}`
const BTN = `inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-50 motion-reduce:transition-none ${FOCUS}`
const BOX = "max-h-72 overflow-auto rounded-md border border-border bg-muted/30 p-3 text-sm"

function Button({ onClick, children, disabled, title, ariaLabel }: { onClick: () => void; children: ReactNode; disabled?: boolean; title?: string; ariaLabel?: string }) {
	return <button type="button" onClick={onClick} disabled={disabled} title={title} aria-label={ariaLabel} className={BTN}>{children}</button>
}

/** F014 — copy with a confirmed state. */
function CopyButton({ getText, label = "Copy" }: { getText: () => string; label?: string }) {
	const [copied, setCopied] = useState(false)
	const onCopy = () => {
		const text = getText()
		if (text.length === 0) return
		void navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
	}
	return (
		<Button onClick={onCopy} ariaLabel={label}>
			{copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
			<span>{copied ? "Copied" : label}</span>
		</Button>
	)
}

function Toggle({ id, label, help, checked, onChange }: { id: string; label: string; help?: string; checked: boolean; onChange: (v: boolean) => void }) {
	return (
		<div className="flex items-start gap-2">
			<input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-describedby={help ? `${id}-help` : undefined} className={`mt-1 size-4 rounded border-border ${FOCUS}`} />
			<div>
				<label htmlFor={id} className="text-sm font-medium">{label}</label>
				{help ? <p id={`${id}-help`} className="text-xs text-muted-foreground">{help}</p> : null}
			</div>
		</div>
	)
}

/** F066, F067 — modal with Escape, focus capture and focus return. */
function Dialog({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
	const ref = useRef<HTMLDivElement | null>(null)
	useEffect(() => {
		const previous = document.activeElement as HTMLElement | null
		ref.current?.focus()
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
		window.addEventListener("keydown", onKey)
		return () => { window.removeEventListener("keydown", onKey); previous?.focus() }
	}, [onClose])
	return (
		<div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-24">
			<div ref={ref} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} className="max-h-[70vh] w-full max-w-lg overflow-auto rounded-lg border border-border bg-background p-4 shadow-xl">
				<div className="mb-3 flex items-center justify-between">
					<h2 className="text-base font-semibold">{title}</h2>
					<Button onClick={onClose} ariaLabel="Close"><X className="size-4" aria-hidden /></Button>
				</div>
				{children}
			</div>
		</div>
	)
}

/** F067 — Ctrl+K style search, arrow keys, combobox semantics. */
function StylePalette({ onPick, onClose }: { onPick: (id: StyleId) => void; onClose: () => void }) {
	const [query, setQuery] = useState("")
	const [active, setActive] = useState(0)
	const matches = useMemo(() => {
		const n = query.trim().toLowerCase()
		return n.length === 0 ? STYLES : STYLES.filter((s) => s.label.toLowerCase().includes(n) || s.example.toLowerCase().includes(n) || s.group.toLowerCase().includes(n))
	}, [query])
	return (
		<Dialog title="Choose a style" onClose={onClose}>
			<input
				autoFocus type="text" value={query} className={INPUT} placeholder="Type to filter 30 styles…"
				role="combobox" aria-expanded="true" aria-controls="cc-style-list"
				aria-activedescendant={matches[active] ? `cc-style-${matches[active].id}` : undefined}
				onChange={(e) => { setQuery(e.target.value); setActive(0) }}
				onKeyDown={(e) => {
					if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, matches.length - 1)) }
					if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)) }
					if (e.key === "Enter") { const p = matches[active]; if (p) onPick(p.id) }
				}}
			/>
			<ul id="cc-style-list" role="listbox" className="mt-2 max-h-72 overflow-auto">
				{matches.map((s, i) => (
					<li key={s.id} id={`cc-style-${s.id}`} role="option" aria-selected={i === active}>
						<button type="button" onClick={() => onPick(s.id)} className={`flex w-full items-center justify-between rounded px-2 py-2 text-left text-sm ${i === active ? "bg-muted" : ""} ${FOCUS}`}>
							<span className="font-medium">{s.label}</span>
							<span className="font-mono text-xs text-muted-foreground">{s.example}</span>
						</button>
					</li>
				))}
				{matches.length === 0 ? <li className="px-2 py-4 text-sm text-muted-foreground">No style matches that.</li> : null}
			</ul>
		</Dialog>
	)
}

/* ===== The tool ===== */

export default function CaseConverterTool() {
	const [input, setInput] = useState("")
	const [debounced, setDebounced] = useState("")
	const [options, setOptions] = usePersisted<Options>("options", DEFAULTS)
	const [saved, setSaved] = usePersisted<Preset[]>("presets", [])
	const [output, setOutput] = useState("")
	const [progress, setProgress] = useState(1)
	const [running, setRunning] = useState(false)
	const [wrap, setWrap] = useState(true)
	const [showLines, setShowLines] = useState(false)
	const [compare, setCompare] = useState(false)
	const [showGrid, setShowGrid] = useState(false)
	const [dialog, setDialog] = useState<"none" | "palette" | "shortcuts" | "history">("none")
	const [fileError, setFileError] = useState<string | null>(null)
	const [note, setNote] = useState<string | null>(null)

	const cancelRef = useRef(false)
	const fileRef = useRef<HTMLInputElement | null>(null)
	const areaRef = useRef<HTMLTextAreaElement | null>(null)
	const memo = useRef(new Map<string, string>())

	const history = useHistory()
	const { draft, dismiss } = useDraft(input)
	const { undo, redo, canUndo, canRedo } = useUndoRedo(input, setInput)
	const style = BY_ID.get(options.style) ?? STYLES[0]
	const close = useCallback(() => setDialog("none"), [])

	// F047 — restore settings from a shared link.
	useEffect(() => {
		if (typeof window === "undefined") return
		const p = new URLSearchParams(window.location.search)
		const next: Partial<Options> = {}
		const s = p.get("s")
		if (s && BY_ID.has(s as StyleId)) next.style = s as StyleId
		if (p.get("pl") === "1") next.perLine = true
		if (p.get("ac") === "0") next.preserveAcronyms = false
		const lc = p.get("lc")
		if (lc) next.locale = lc
		if (Object.keys(next).length > 0) setOptions({ ...DEFAULTS, ...next })
		const i = p.get("i")
		if (i) setInput(i)
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [])

	// F097 — one debounce.
	useEffect(() => {
		const t = setTimeout(() => setDebounced(input), 160)
		return () => clearTimeout(t)
	}, [input])

	const stats = useMemo(() => ({
		chars: countGraphemes(debounced),
		words: countWords(debounced),
		lines: debounced.length === 0 ? 0 : splitLines(debounced).length,
		bytes: new TextEncoder().encode(debounced).length,
	}), [debounced])

	const tooBig = debounced.length > MAX_CHARS
	const badPattern = useMemo(() => isBadPattern(options.protectPattern), [options.protectPattern])

	// F013, F030, F031, F099 — the conversion.
	useEffect(() => {
		if (debounced.length === 0 || tooBig) { setOutput(""); return }
		const key = `${JSON.stringify(options)}|${debounced.length}|${debounced.slice(0, 200)}`
		const cached = memo.current.get(key)
		if (cached !== undefined) { setOutput(cached); return }
		if (debounced.length < CHUNK_THRESHOLD) {
			const result = convertSync(debounced, options)
			if (memo.current.size > 8) memo.current.clear()
			memo.current.set(key, result.text)
			setOutput(result.text)
			setProgress(1)
			return
		}
		cancelRef.current = false
		setRunning(true)
		setProgress(0)
		void convertChunked(debounced, { ...options, perLine: true }, setProgress, () => cancelRef.current).then((r) => {
			setRunning(false)
			if (!r.cancelled) setOutput(r.text)
		})
	}, [debounced, options, tooBig])

	const diff = useMemo(() => diffSummary(debounced, output), [debounced, output])
	const scripts = useMemo(() => detectScripts(debounced), [debounced])
	const caseless = scripts.length > 0 && !hasCase(scripts)
	const detected = useMemo(() => detectCurrentStyle(debounced), [debounced])
	const changedCount = useMemo(() => (Object.keys(DEFAULTS) as Array<keyof Options>).filter((k) => options[k] !== DEFAULTS[k]).length, [options])

	const setOption = useCallback(<K extends keyof Options>(key: K, value: Options[K]) => { setOptions({ ...options, [key]: value }) }, [options, setOptions])

	const useResult = useCallback(() => {
		if (output.length === 0) return
		setInput(output)
		history.add(output, options.style)
	}, [history, options.style, output])

	// F026 — convert only the selection.
	const convertSelection = useCallback(() => {
		const area = areaRef.current
		if (!area || area.selectionStart === area.selectionEnd) return
		const { selectionStart: a, selectionEnd: b } = area
		setInput(`${input.slice(0, a)}${convertSync(input.slice(a, b), options).text}${input.slice(b)}`)
	}, [input, options])

	const exportAs = useCallback((format: ExportFormat) => {
		if (output.length === 0) return
		const stamp = new Date().toISOString().slice(0, 10)
		download(`case-converter-${options.style}-${stamp}.${format}`, serialize(format, debounced, output, options), MIME[format])
	}, [debounced, options, output])

	// F029 — the whole grid as CSV.
	const exportGrid = useCallback(() => {
		const rows = ["style,result"]
		for (const m of STYLES) rows.push([csvCell(m.label), csvCell(convertSync(debounced, { ...options, style: m.id }).text)].join(","))
		download("case-converter-all-styles.csv", rows.join("\n"), MIME.csv)
	}, [debounced, options])

	// F047, F048 — settings always; the text only when short and opted in.
	const share = useCallback(() => {
		if (typeof window === "undefined") return
		const p = new URLSearchParams()
		p.set("s", options.style)
		if (options.perLine) p.set("pl", "1")
		if (!options.preserveAcronyms) p.set("ac", "0")
		if (options.locale !== "auto") p.set("lc", options.locale)
		const withInput = options.shareInput && input.length > 0 && input.length <= 1500
		if (withInput) p.set("i", input)
		const url = `${window.location.origin}${window.location.pathname}?${p.toString()}`
		void navigator.clipboard.writeText(url).then(() => {
			setNote(withInput ? "Link copied, including your text." : options.shareInput ? "Link copied with your settings. Your text was too long to include." : "Link copied with your settings only. Your text was not included.")
			setTimeout(() => setNote(null), 5000)
		})
	}, [input, options])

	// F002–F004, F009, F010 — file loading that names its refusals.
	const readFiles = useCallback(async (files: FileList | null) => {
		if (!files || files.length === 0) return
		setFileError(null)
		const parts: string[] = []
		for (const file of Array.from(files)) {
			const textual = file.type.startsWith("text/") || /\.(txt|md|csv|tsv|json|ts|tsx|js|jsx|html|css|ya?ml|log)$/iu.test(file.name)
			if (!textual) { setFileError(`“${file.name}” does not look like a text file, so it was skipped. Text, Markdown, CSV, JSON and source files work.`); continue }
			const text = await file.text()
			if (text.includes("\u0000")) { setFileError(`“${file.name}” appears to be binary, so it was skipped.`); continue }
			parts.push(files.length > 1 ? `# ${file.name}\n${text}` : text)
		}
		if (parts.length > 0) setInput(parts.join("\n\n"))
	}, [])

	// F065, F068 — shortcuts that do not fight the textarea.
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			const mod = e.metaKey || e.ctrlKey
			const t = e.target as HTMLElement | null
			const typing = !!t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)
			const k = e.key.toLowerCase()
			if (mod && k === "k") { e.preventDefault(); setDialog("palette"); return }
			if (mod && e.shiftKey && k === "c") { e.preventDefault(); if (output.length > 0) void navigator.clipboard.writeText(output); return }
			if (mod && e.shiftKey && k === "x") { e.preventDefault(); useResult(); return }
			if (mod && e.shiftKey && k === "z") { e.preventDefault(); redo(); return }
			if (mod && k === "z") { e.preventDefault(); undo(); return }
			if (!typing && e.key === "?") { e.preventDefault(); setDialog("shortcuts") }
		}
		window.addEventListener("keydown", onKey)
		return () => window.removeEventListener("keydown", onKey)
	}, [output, redo, undo, useResult])

	const rendered = output.length > RENDER_LIMIT ? output.slice(0, RENDER_LIMIT) : output

	// F095 — structured data built from the same arrays rendered below.
	const jsonLd = useMemo(() => JSON.stringify({
		"@context": "https://schema.org",
		"@graph": [
			{ "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.question, acceptedAnswer: { "@type": "Answer", text: f.answer } })) },
			{ "@type": "HowTo", name: "How to change text case", step: HOW_TO.map((s) => ({ "@type": "HowToStep", name: s.name, text: s.text })) },
		],
	}), [])

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6">
			{/* F074 */}
			<a href="#cc-main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-background focus:px-3 focus:py-2">Skip to the tool</a>

			<header className="space-y-1">
				<h1 className="text-2xl font-semibold">Text Case Converter</h1>
				<p className="text-sm text-muted-foreground">Thirty case styles that keep accents, Telugu, Hindi, emoji and acronyms intact. Everything runs in your browser.</p>
			</header>

			{/* F070 — one live region for the whole tool. */}
			<p className="sr-only" aria-live="polite" aria-atomic="true">
				{running ? `Converting, ${Math.round(progress * 100)} percent` : output.length > 0 ? `Converted to ${style.label}. ${diff.chars} characters changed.` : ""}
			</p>

			<main id="cc-main" className="space-y-6">
				{/* ---------- Input ---------- */}
				<section className="space-y-3" aria-label="Input">
					<div className="flex flex-wrap items-center gap-2">
						<Button onClick={() => fileRef.current?.click()}><FileUp className="size-4" aria-hidden /> Load a file</Button>
						<Button onClick={() => setInput("")} disabled={input.length === 0}><Eraser className="size-4" aria-hidden /> Clear</Button>
						<Button onClick={undo} disabled={!canUndo}><Undo2 className="size-4" aria-hidden /> Undo</Button>
						<Button onClick={redo} disabled={!canRedo}><Redo2 className="size-4" aria-hidden /> Redo</Button>
						<Button onClick={convertSelection}>Convert selection</Button>
						<Button onClick={() => setDialog("history")}>Recent</Button>
						<Button onClick={() => setDialog("shortcuts")} ariaLabel="Keyboard shortcuts"><Keyboard className="size-4" aria-hidden /></Button>
					</div>

					<input ref={fileRef} type="file" multiple className="sr-only" accept=".txt,.md,.csv,.tsv,.json,.ts,.tsx,.js,.jsx,.html,.css,.yml,.yaml,.log,text/*" onChange={(e) => void readFiles(e.target.files)} />

					{/* F005 */}
					<div className="flex flex-wrap gap-2">
						{SAMPLES.map((s) => <button key={s.label} type="button" title={s.hint} onClick={() => setInput(s.text)} className={CHIP}>{s.label}</button>)}
					</div>

					{/* F012 — offered, never auto-applied. */}
					{draft ? (
						<div className="flex flex-wrap items-center gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
							<Info className="size-4 shrink-0" aria-hidden />
							<span>An unsaved draft from a previous visit is available.</span>
							<Button onClick={() => { setInput(draft); dismiss() }}><RotateCcw className="size-4" aria-hidden /> Restore it</Button>
							<Button onClick={dismiss}>Dismiss</Button>
						</div>
					) : null}

					<label htmlFor="cc-input" className="block text-sm font-medium">Your text</label>
					<textarea
						id="cc-input" ref={areaRef} value={input} rows={8} spellCheck={false}
						placeholder="Type or paste your text, or drop a file here…"
						className={`w-full rounded-md border border-border bg-background p-3 font-mono text-sm ${FOCUS}`}
						onChange={(e) => setInput(e.target.value)}
						onDrop={(e) => { e.preventDefault(); void readFiles(e.dataTransfer.files) }}
						onDragOver={(e) => e.preventDefault()}
					/>

					{fileError ? <p role="alert" className="flex items-start gap-2 text-sm text-destructive"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />{fileError}</p> : null}

					{/* F006, F085, F089 */}
					<dl className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
						<div><dt className="inline font-medium">Characters: </dt><dd className="inline">{stats.chars.toLocaleString()}</dd></div>
						<div><dt className="inline font-medium">Words: </dt><dd className="inline">{stats.words.toLocaleString()}</dd></div>
						<div><dt className="inline font-medium">Lines: </dt><dd className="inline">{stats.lines.toLocaleString()}</dd></div>
						<div><dt className="inline font-medium">Size: </dt><dd className="inline">{(stats.bytes / 1024).toFixed(1)} KB</dd></div>
						{scripts.length > 0 ? <div><dt className="inline font-medium">Script: </dt><dd className="inline">{scripts.join(", ")}</dd></div> : null}
					</dl>

					{/* F007 */}
					{debounced.length > WARN_CHARS && !tooBig ? (
						<p className="flex items-start gap-2 text-sm text-amber-600 dark:text-amber-400">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
							That is a large input. Conversion is chunked so the page stays responsive, and the preview below is shortened. Copy and download always use the full result.
						</p>
					) : null}

					{/* F008 */}
					{tooBig ? (
						<p role="alert" className="flex items-start gap-2 text-sm text-destructive">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
							That input is {debounced.length.toLocaleString()} characters, over the {MAX_CHARS.toLocaleString()} character limit. Split it into smaller parts — nothing has been lost.
						</p>
					) : null}

					{/* F030, F031 */}
					{running ? (
						<div className="flex items-center gap-3">
							<progress value={progress} max={1} className="h-2 w-40" aria-label="Conversion progress" />
							<span className="text-xs text-muted-foreground">{Math.round(progress * 100)}%</span>
							<Button onClick={() => { cancelRef.current = true }}>Stop</Button>
						</div>
					) : null}
				</section>

				{/* ---------- Presets: F043–F048 ---------- */}
				<section className="space-y-2" aria-label="Presets">
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm font-medium">Presets</span>
						{PRESETS.map((p) => <button key={p.id} type="button" title={p.description} onClick={() => setOptions({ ...DEFAULTS, ...p.values })} className={CHIP}>{p.label}</button>)}
						{saved.map((p) => (
							<span key={p.id} className="inline-flex items-center gap-1">
								<button type="button" onClick={() => setOptions({ ...DEFAULTS, ...p.values })} className={`rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs ${FOCUS}`}>{p.label}</button>
								<button type="button" aria-label={`Delete preset ${p.label}`} onClick={() => setSaved(saved.filter((x) => x.id !== p.id))} className={`rounded p-1 hover:bg-muted ${FOCUS}`}><Trash2 className="size-3" aria-hidden /></button>
							</span>
						))}
						<Button
							disabled={saved.length >= MAX_PRESETS}
							title={saved.length >= MAX_PRESETS ? `You have reached the limit of ${MAX_PRESETS} saved presets.` : "Save the current settings"}
							onClick={() => setSaved([...saved, { id: `saved-${Date.now()}`, label: `${style.label} (mine)`, description: "Saved from the current settings.", values: options }])}
						>Save current</Button>
						<Button onClick={share}><Link2 className="size-4" aria-hidden /> Copy a link</Button>
					</div>
					{note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
				</section>

				{/* ---------- Settings: F037–F042 ---------- */}
				<section className="space-y-4 rounded-lg border border-border p-4" aria-label="Settings">
					<div className="flex items-center justify-between">
						<h2 className="text-sm font-semibold">Settings</h2>
						<div className="flex items-center gap-2">
							{changedCount > 0 ? <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{changedCount} changed</span> : null}
							<Button onClick={() => setOptions(DEFAULTS)} disabled={changedCount === 0}>Reset</Button>
						</div>
					</div>

					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-1">
							<label htmlFor="cc-style" className="text-sm font-medium">Style</label>
							<select id="cc-style" value={options.style} onChange={(e) => setOption("style", e.target.value as StyleId)} className={INPUT}>
								{STYLE_GROUPS.map((group) => (
									<optgroup key={group} label={group}>
										{STYLES.filter((s) => s.group === group).map((s) => <option key={s.id} value={s.id}>{s.label} — {s.example}</option>)}
									</optgroup>
								))}
							</select>
							<p className="text-xs text-muted-foreground">Press Ctrl+K to search all 30 styles.</p>
						</div>
						<div className="space-y-1">
							<label htmlFor="cc-locale" className="text-sm font-medium">Language rules</label>
							<select id="cc-locale" value={options.locale} onChange={(e) => setOption("locale", e.target.value)} className={INPUT}>
								<option value="auto">Automatic</option>
								<option value="en">English</option>
								<option value="tr">Turkish</option>
								<option value="az">Azerbaijani</option>
								<option value="de">German</option>
								<option value="el">Greek</option>
								<option value="lt">Lithuanian</option>
								<option value="nl">Dutch</option>
							</select>
							<p className="text-xs text-muted-foreground">Turkish uppercases i to İ. German uppercases ß to SS.</p>
						</div>
					</div>

					<div className="grid gap-3 sm:grid-cols-2">
						<Toggle id="cc-perline" label="Convert each line separately" help="Use this for lists, column names and code names." checked={options.perLine} onChange={(v) => setOption("perLine", v)} />
						{/* F040 — hidden, not merely disabled. */}
						{options.perLine ? <Toggle id="cc-skip" label="Leave lines that already match" help="Nothing is rewritten if it is already correct." checked={options.skipUnchanged} onChange={(v) => setOption("skipUnchanged", v)} /> : null}
						<Toggle id="cc-acr" label="Keep acronyms uppercase" help="NASA API guide becomes NASA API Guide, not Nasa Api Guide." checked={options.preserveAcronyms} onChange={(v) => setOption("preserveAcronyms", v)} />
						<Toggle id="cc-braces" label="Protect {{placeholders}}" help="Leaves {{name}} and ${value} exactly as they are." checked={options.protectBraces} onChange={(v) => setOption("protectBraces", v)} />
						<Toggle id="cc-quoted" label="Protect quoted text" help="Leaves quoted and backticked text untouched." checked={options.protectQuoted} onChange={(v) => setOption("protectQuoted", v)} />
						<Toggle id="cc-trim" label="Trim trailing spaces" checked={options.trimLines} onChange={(v) => setOption("trimLines", v)} />
						<Toggle id="cc-collapse" label="Collapse repeated spaces" checked={options.collapseSpaces} onChange={(v) => setOption("collapseSpaces", v)} />
						<Toggle id="cc-shareinput" label="Include my text in shared links" help="Only if it is under 1,500 characters. Off by default." checked={options.shareInput} onChange={(v) => setOption("shareInput", v)} />
					</div>

					{/* F038 — advanced collapsed. */}
					<details className="rounded-md border border-border p-3">
						<summary className={`cursor-pointer text-sm font-medium ${FOCUS}`}>Advanced</summary>
						<div className="mt-3 space-y-3">
							<div className="space-y-1">
								<label htmlFor="cc-acrlist" className="text-sm font-medium">Acronyms to keep uppercase</label>
								<textarea id="cc-acrlist" rows={2} value={options.acronymList} onChange={(e) => setOption("acronymList", e.target.value)} className={INPUT} />
								<p className="text-xs text-muted-foreground">Separate with spaces or commas.</p>
							</div>
							<div className="space-y-1">
								<label htmlFor="cc-small" className="text-sm font-medium">Small words kept lowercase in Title Case</label>
								<textarea id="cc-small" rows={2} value={options.smallWords} onChange={(e) => setOption("smallWords", e.target.value)} className={INPUT} />
							</div>
							<div className="space-y-1">
								<label htmlFor="cc-pattern" className="text-sm font-medium">Protect anything matching this pattern</label>
								<input id="cc-pattern" type="text" value={options.protectPattern} onChange={(e) => setOption("protectPattern", e.target.value)} aria-invalid={badPattern} aria-describedby={badPattern ? "cc-pattern-error" : undefined} placeholder="For example: #\w+" className={INPUT} />
								{badPattern ? <p id="cc-pattern-error" role="alert" className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="size-3" aria-hidden /> That is not a valid regular expression, so it is being ignored.</p> : null}
							</div>
							<div className="grid gap-3 sm:grid-cols-2">
								<div className="space-y-1">
									<label htmlFor="cc-numbers" className="text-sm font-medium">Numbers</label>
									<select id="cc-numbers" value={options.numberHandling} onChange={(e) => setOption("numberHandling", e.target.value as NumberHandling)} className={INPUT}>
										<option value="keep">Keep with the word</option>
										<option value="separate">Treat as a separate word</option>
										<option value="strip">Remove them</option>
									</select>
								</div>
								{/* F084 — a visible seed keeps random output reproducible. */}
								{options.style === "random" || options.style === "sponge" ? (
									<div className="space-y-1">
										<label htmlFor="cc-seed" className="text-sm font-medium">Randomness seed</label>
										<input id="cc-seed" type="number" min={1} value={options.seed} onChange={(e) => setOption("seed", Number(e.target.value) || 1)} className={INPUT} />
										<p className="text-xs text-muted-foreground">Same seed, same result every time.</p>
									</div>
								) : null}
							</div>
						</div>
					</details>
				</section>

				{/* ---------- Output: F013–F024, F052–F054 ---------- */}
				<section className="space-y-3" aria-label="Result">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="mr-auto text-sm font-semibold">Result — {style.label}</h2>
						<CopyButton getText={() => output} />
						<Button onClick={useResult} disabled={output.length === 0}>Use as input</Button>
						<Button onClick={() => setWrap(!wrap)}>{wrap ? "No wrap" : "Wrap"}</Button>
						<Button onClick={() => setShowLines(!showLines)}>{showLines ? "Hide line numbers" : "Line numbers"}</Button>
						<Button onClick={() => setCompare(!compare)}>{compare ? "Hide original" : "Compare"}</Button>
					</div>

					<div className={compare ? "grid gap-3 md:grid-cols-2" : ""}>
						{compare ? (
							<div>
								<p className="mb-1 text-xs font-medium text-muted-foreground">Original</p>
								<pre className={`${BOX} whitespace-pre-wrap break-words font-mono`}>{debounced.slice(0, RENDER_LIMIT)}</pre>
							</div>
						) : null}
						<div>
							{compare ? <p className="mb-1 text-xs font-medium text-muted-foreground">Converted</p> : null}
							{output.length === 0 ? (
								<p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Add some text above and the result appears here.</p>
							) : showLines ? (
								<ol className={BOX}>
									{splitLines(rendered).map((line, i) => (
										<li key={`${i}-${line.slice(0, 12)}`} className="flex gap-3 font-mono">
											<span className="select-none text-right text-muted-foreground" style={{ minWidth: "3ch" }}>{i + 1}</span>
											<span className="whitespace-pre-wrap break-words">{line}</span>
										</li>
									))}
								</ol>
							) : (
								<pre className={`${BOX} font-mono ${wrap ? "whitespace-pre-wrap break-words" : "whitespace-pre"}`}>{rendered}</pre>
							)}
						</div>
					</div>

					{/* F018 */}
					{output.length > RENDER_LIMIT ? (
						<p className="text-xs text-muted-foreground">Showing the first {RENDER_LIMIT.toLocaleString()} of {output.length.toLocaleString()} characters. Copy and download use the whole result.</p>
					) : null}

					{/* F019–F023 */}
					<div className="flex flex-wrap items-center gap-2">
						<span className="text-sm font-medium">Download</span>
						{(["txt", "md", "json", "csv", "html"] as ExportFormat[]).map((f) => (
							<Button key={f} onClick={() => exportAs(f)} disabled={output.length === 0} ariaLabel={`Download as ${f.toUpperCase()}`}><Download className="size-4" aria-hidden /> {f.toUpperCase()}</Button>
						))}
					</div>
					{/* F024 */}
					<details>
						<summary className={`cursor-pointer text-xs font-medium ${FOCUS}`}>Settings used for this result</summary>
						<pre className="mt-2 whitespace-pre-wrap rounded-md border border-border p-3 text-xs text-muted-foreground">{buildReceipt(options)}</pre>
					</details>
				</section>

				{/* ---------- Insights: F055, F082, F088–F091 ---------- */}
				{debounced.length > 0 ? (
					<section className="space-y-2 rounded-lg border border-border p-4" aria-label="What happened">
						<h2 className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="size-4" aria-hidden /> What happened</h2>
						<ul className="space-y-1 text-sm text-muted-foreground">
							<li>{diff.chars.toLocaleString()} characters and {diff.words.toLocaleString()} words differ from your original.</li>
							{output === debounced ? <li>Nothing changed — your text is already in this style.</li> : null}
							{detected && detected !== options.style ? <li>Your input looks like {BY_ID.get(detected)?.label ?? detected} already.</li> : null}
							{caseless ? (
								<li className="flex items-start gap-2 text-amber-600 dark:text-amber-400">
									<Info className="mt-0.5 size-4 shrink-0" aria-hidden />
									This script has no upper or lower case, so the case styles leave it unchanged. Splitting styles like snake_case still work.
								</li>
							) : null}
							{style.lossy ? (
								<li className="flex items-start gap-2"><AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden /> This conversion cannot be reversed from its own output. Keep your original, or use Undo.</li>
							) : <li>This style is reversible — applying it twice returns your original.</li>}
						</ul>
						{/* F083 */}
						<details className="pt-1">
							<summary className={`cursor-pointer text-xs font-medium ${FOCUS}`}>What this tool does not promise</summary>
							<ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">{ASSUMPTIONS.map((a) => <li key={a}>{a}</li>)}</ul>
						</details>
					</section>
				) : null}

				{/* ---------- All 30 styles: F027–F029 ---------- */}
				<section className="space-y-2" aria-label="Every style">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="mr-auto text-sm font-semibold">Every style at once</h2>
						<Button onClick={() => setShowGrid(!showGrid)}>{showGrid ? "Hide" : "Show all 30"}</Button>
						{showGrid ? <Button onClick={exportGrid} disabled={debounced.length === 0}><Download className="size-4" aria-hidden /> CSV</Button> : null}
					</div>
					{showGrid ? (debounced.length === 0 ? (
						<p className="text-sm text-muted-foreground">Add some text to see all 30 styles side by side.</p>
					) : (
						<ul className="divide-y divide-border rounded-md border border-border">
							{STYLES.map((meta) => {
								const value = convertSync(debounced.slice(0, 2000), { ...options, style: meta.id }).text
								return (
									<li key={meta.id} className="flex flex-wrap items-center gap-2 p-2">
										<button type="button" onClick={() => setOption("style", meta.id)} className={`w-44 shrink-0 text-left text-sm font-medium hover:underline ${FOCUS}`}>{meta.label}</button>
										<code className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">{value}</code>
										<CopyButton getText={() => value} />
									</li>
								)
							})}
						</ul>
					)) : null}
				</section>

				{/* ---------- Privacy: F077–F081 ---------- */}
				<section className="space-y-2 rounded-lg border border-border p-4" aria-label="Privacy">
					<h2 className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="size-4" aria-hidden /> Your text never leaves this device</h2>
					<p className="text-sm text-muted-foreground">
						There is no upload, no account and no analytics. The tool works with the internet switched off. Stored in this browser only:
						your settings, your saved presets, your last {MAX_HISTORY} results and one autosaved draft.
					</p>
					<Button onClick={() => { clearAllStorage(); history.clearAll(); setNote("Everything this tool stored has been deleted.") }}>
						<Trash2 className="size-4" aria-hidden /> Delete everything stored
					</Button>
				</section>

				{/* ---------- Help: F092–F096 ---------- */}
				<section className="space-y-4" aria-label="Help">
					<div>
						<h2 className="mb-2 text-sm font-semibold">How to change text case</h2>
						<ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
							{HOW_TO.map((s) => <li key={s.name}><strong className="font-medium">{s.name}.</strong> {s.text}</li>)}
						</ol>
					</div>
					<div>
						<h2 className="mb-2 text-sm font-semibold">Questions</h2>
						<dl className="space-y-2">
							{FAQ.map((item) => (
								<div key={item.question} className="rounded-md border border-border p-3">
									<dt className="text-sm font-medium">{item.question}</dt>
									<dd className="mt-1 text-sm text-muted-foreground">{item.answer}</dd>
								</div>
							))}
						</dl>
					</div>
					<div>
						<h2 className="mb-2 text-sm font-semibold">Related tools</h2>
						<ul className="space-y-1 text-sm">
							{RELATED.map((tool) => (
								<li key={tool.id}>
									<a href={`/tools/${tool.id}`} className={`font-medium underline ${FOCUS}`}>{tool.label}</a>
									<span className="text-muted-foreground"> — {tool.why}</span>
								</li>
							))}
						</ul>
					</div>
					{/* F096 — the words users actually type. */}
					<p className="text-xs text-muted-foreground">Also known as: {ALIASES.join(", ")}.</p>
				</section>
			</main>

			{/* ---------- Dialogs ---------- */}
			{dialog === "palette" ? <StylePalette onClose={close} onPick={(id) => { setOption("style", id); close() }} /> : null}

			{dialog === "shortcuts" ? (
				<Dialog title="Keyboard shortcuts" onClose={close}>
					<dl className="space-y-2">
						{SHORTCUTS.map((s) => (
							<div key={s.keys} className="flex items-center justify-between gap-4">
								<dt className="text-sm">{s.label}</dt>
								<dd><kbd className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs">{s.keys}</kbd></dd>
							</div>
						))}
					</dl>
				</Dialog>
			) : null}

			{/* F058–F061 */}
			{dialog === "history" ? (
				<Dialog title="Recent results" onClose={close}>
					{history.entries.length === 0 ? (
						<p className="text-sm text-muted-foreground">Nothing yet. Results you reuse are listed here, stored only in this browser.</p>
					) : (
						<>
							<ul className="space-y-2">
								{history.entries.map((entry) => (
									<li key={entry.id} className="flex items-start gap-2 rounded-md border border-border p-2">
										<div className="min-w-0 flex-1">
											<p className="truncate font-mono text-xs">{entry.snippet}</p>
											<p className="text-xs text-muted-foreground">{BY_ID.get(entry.style)?.label ?? entry.style}{entry.pinned ? " · pinned" : ""}</p>
										</div>
										<Button onClick={() => { setInput(entry.snippet); close() }}>Restore</Button>
										<Button onClick={() => history.togglePin(entry.id)} ariaLabel={entry.pinned ? "Unpin" : "Pin"}>{entry.pinned ? "Unpin" : "Pin"}</Button>
										<Button onClick={() => history.remove(entry.id)} ariaLabel="Remove"><Trash2 className="size-4" aria-hidden /></Button>
									</li>
								))}
							</ul>
							<div className="mt-3"><Button onClick={history.clearAll}>Clear all</Button></div>
						</>
					)}
				</Dialog>
			) : null}

			{/* F095 */}
			{/* eslint-disable-next-line react/no-danger */}
			<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />
		</div>
	)
}

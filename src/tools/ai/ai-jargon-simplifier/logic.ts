/**
 * AI Jargon Simplifier — pure logic.
 *
 * Built-in jargon→plain dictionary (200+ terms) across four domains:
 *   - tech (engineering, software, IT)
 *   - medical (clinical terms)
 *   - legal (legalese)
 *   - financial (finance/banking)
 *
 * Capabilities:
 *   - Detect jargon in text → highlight + suggest plain alternative.
 *   - Reading-level slider (grade5 / grade8 / grade12 / expert).
 *     grade5  → use `simple` (most plain) form.
 *     grade8  → use `plain` (medium) form.
 *     grade12 → use `plain` form, but no sentence splitting.
 *     expert  → no substitution, only glossary tooltips.
 *   - Preserve-exactly locks for figures, dates, dosages, citations, currency, percentages.
 *   - Side-by-side diff (original vs simplified).
 *   - Flesch reading ease + grade level (before/after).
 *   - History (localStorage, last 20) and shareable URL.
 *
 * Pure functions only — no DOM, no network. The optional LLM call (BYO API
 * key) lives in ui.tsx because it touches the network.
 */

// ---------- Types ----------

export type Domain = "tech" | "medical" | "legal" | "financial";

export type ReadingLevel = "grade5" | "grade8" | "grade12" | "expert";

export interface JargonEntry {
  term: string;          // canonical term (lowercase, used for matching)
  domain: Domain;
  plain: string;         // medium-simplified replacement (grade 8 / 12)
  simple: string;        // most-plain replacement (grade 5)
  gloss: string;         // short definition shown as tooltip
}

export interface JargonHit {
  id: string;
  entry: JargonEntry;
  start: number;
  end: number;
  original: string;
  replacement: string;   // chosen based on reading level
}

export interface LockedToken {
  start: number;
  end: number;
  text: string;
  kind: "figure" | "date" | "dosage" | "citation" | "currency" | "percent" | "url";
}

export interface SimplifyOptions {
  level: ReadingLevel;
  domains: Domain[];             // restrict to these domains (empty = all)
  lockTokens: boolean;           // preserve figures/dates/citations/dosages
  splitLongSentences: boolean;   // split sentences over 25 words
  ignored: string[];             // terms to ignore (session)
}

export interface Readability {
  fleschReadingEase: number;     // 0-100 (higher = easier)
  fleschGradeLevel: number;      // grade level
  wordCount: number;
  sentenceCount: number;
  syllableCount: number;
  avgWordsPerSentence: number;
  longSentenceCount: number;     // sentences over 25 words
}

export interface SimplifyResult {
  original: string;
  simplified: string;
  hits: JargonHit[];
  locked: LockedToken[];
  stats: {
    jargonCount: number;
    byDomain: Record<Domain, number>;
    lockedCount: number;
    originalReadability: Readability;
    simplifiedReadability: Readability;
    improvement: number;          // ease delta (simplified - original)
  };
}

export interface DiffSegment {
  type: "same" | "added" | "removed";
  text: string;
}

export interface HistoryEntry {
  ts: number;
  level: ReadingLevel;
  domains: Domain[];
  originalLength: number;
  simplifiedLength: number;
  jargonCount: number;
}

export interface ShareState {
  text: string;
  level: ReadingLevel;
  domains: Domain[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-jargon-simplifier:history";
export const HISTORY_MAX = 20;
export const IGNORE_KEY = "unqtools:ai-jargon-simplifier:ignored";

export const DOMAIN_LABELS: Record<Domain, string> = {
  tech: "Technical",
  medical: "Medical",
  legal: "Legal",
  financial: "Financial",
};

export const DOMAIN_COLORS: Record<Domain, string> = {
  tech: "blue",
  medical: "emerald",
  legal: "amber",
  financial: "violet",
};

export const LEVEL_LABELS: Record<ReadingLevel, string> = {
  grade5: "Grade 5 (very plain)",
  grade8: "Grade 8 (plain)",
  grade12: "Grade 12 (modest)",
  expert: "Expert (glossary only)",
};

export const DEFAULT_OPTIONS: SimplifyOptions = {
  level: "grade8",
  domains: [],
  lockTokens: true,
  splitLongSentences: true,
  ignored: [],
};

export const SAMPLE_TEXTS: { label: string; domain: Domain; text: string }[] = [
  {
    label: "Technical — API latency",
    domain: "tech",
    text: "Our new microservices architecture is async and idempotent, which reduced API latency by 40% on 2024-03-15. The refactor improved throughput but introduced polymorphism in the persistence layer.",
  },
  {
    label: "Medical — patient notes",
    domain: "medical",
    text: "Patient presents with hypertension and Type 2 diabetes mellitus. Prescribed metformin 500mg twice daily, subcutaneous injection of insulin as needed. Prognosis is favorable with no contraindication to exercise.",
  },
  {
    label: "Legal — contract clause",
    domain: "legal",
    text: "Notwithstanding any provision herein to the contrary, the party shall indemnify and hold harmless the counterparty for any tort or breach. Force majeure shall not apply to obligations under Section 4.2. See Smith v. Jones, 2020.",
  },
  {
    label: "Financial — earnings report",
    domain: "financial",
    text: "Q3 results show deleveraging of the balance sheet, with EBITDA up 12% YoY. The ETF rebalanced its derivative exposure, improving liquidity. We recommend amortization over 10 years to optimize leverage ratios.",
  },
];

// ---------- Jargon dictionary (200+ terms) ----------

export const JARGON_DICTIONARY: JargonEntry[] = [
  // ----- TECH (60) -----
  { term: "api", domain: "tech", plain: "API (program interface)", simple: "app connector", gloss: "A set of rules letting programs talk to each other." },
  { term: "latency", domain: "tech", plain: "delay", simple: "wait time", gloss: "The delay before a transfer of data begins." },
  { term: "refactor", domain: "tech", plain: "restructure code", simple: "tidy up the code", gloss: "Improving code structure without changing its behavior." },
  { term: "idempotent", domain: "tech", plain: "repeatable safely", simple: "safe to repeat", gloss: "An operation that gives the same result no matter how many times you run it." },
  { term: "polymorphism", domain: "tech", plain: "many-form behavior", simple: "shape-shifting behavior", gloss: "When one interface can take many forms." },
  { term: "microservices", domain: "tech", plain: "small services", simple: "small app parts", gloss: "An app split into small, independent services." },
  { term: "async", domain: "tech", plain: "non-blocking", simple: "no waiting", gloss: "Operations that do not block the calling thread." },
  { term: "asynchronous", domain: "tech", plain: "non-blocking", simple: "no waiting", gloss: "Happening without waiting for a previous step to finish." },
  { term: "throughput", domain: "tech", plain: "work rate", simple: "speed of work", gloss: "How much work gets done in a given time." },
  { term: "persistence", domain: "tech", plain: "saving data", simple: "storing data", gloss: "Saving data so it survives after the program ends." },
  { term: "abstraction", domain: "tech", plain: "simplified model", simple: "hidden details", gloss: "Hiding details to focus on what matters." },
  { term: "concurrency", domain: "tech", plain: "at-the-same-time", simple: "doing things together", gloss: "Multiple tasks making progress at once." },
  { term: "serialization", domain: "tech", plain: "data packing", simple: "saving as a stream", gloss: "Turning an object into a storable stream of bytes." },
  { term: "deserialization", domain: "tech", plain: "data unpacking", simple: "reading from a stream", gloss: "Turning stored bytes back into an object." },
  { term: "bootstrap", domain: "tech", plain: "startup", simple: "starting up", gloss: "The process of starting a system from scratch." },
  { term: "deprecated", domain: "tech", plain: "retired", simple: "old and not recommended", gloss: "Still works but should no longer be used." },
  { term: "immutable", domain: "tech", plain: "unchanging", simple: "cannot be changed", gloss: "Cannot be changed after creation." },
  { term: "mutable", domain: "tech", plain: "changeable", simple: "can be changed", gloss: "Can be changed after creation." },
  { term: "synchronous", domain: "tech", plain: "blocking", simple: "step-by-step", gloss: "Each step waits for the previous one to finish." },
  { term: "schema", domain: "tech", plain: "structure", simple: "layout", gloss: "The shape or layout of data." },
  { term: "middleware", domain: "tech", plain: "go-between software", simple: "middle software", gloss: "Software that connects other software." },
  { term: "orchestration", domain: "tech", plain: "coordination", simple: "managing parts", gloss: "Coordinating multiple services to work together." },
  { term: "containerization", domain: "tech", plain: "packaging", simple: "boxing up apps", gloss: "Packaging an app with everything it needs to run." },
  { term: "virtualization", domain: "tech", plain: "virtual machines", simple: "simulated computers", gloss: "Running simulated computers on one physical machine." },
  { term: "scalability", domain: "tech", plain: "growth capacity", simple: "ability to grow", gloss: "How well a system handles growth." },
  { term: "redundancy", domain: "tech", plain: "backups", simple: "spare copies", gloss: "Extra copies used as backups." },
  { term: "encryption", domain: "tech", plain: "scrambling", simple: "secret coding", gloss: "Scrambling data so only authorized parties can read it." },
  { term: "decryption", domain: "tech", plain: "unscrambling", simple: "decoding", gloss: "Converting scrambled data back to readable form." },
  { term: "authentication", domain: "tech", plain: "login check", simple: "proving who you are", gloss: "Verifying who a user is." },
  { term: "authorization", domain: "tech", plain: "permission check", simple: "checking permissions", gloss: "Checking what a user is allowed to do." },
  { term: "singleton", domain: "tech", plain: "single instance", simple: "only one copy", gloss: "A class that only ever has one instance." },
  { term: "instantiation", domain: "tech", plain: "creation", simple: "making an instance", gloss: "Creating an instance of a class." },
  { term: "encapsulation", domain: "tech", plain: "data hiding", simple: "bundling data", gloss: "Hiding data inside a class." },
  { term: "inheritance", domain: "tech", plain: "trait passing", simple: "passing down features", gloss: "A class receiving features from a parent class." },
  { term: "deployment", domain: "tech", plain: "release", simple: "going live", gloss: "Releasing software for use." },
  { term: "repository", domain: "tech", plain: "storage", simple: "code store", gloss: "A storage location for code or data." },
  { term: "iteration", domain: "tech", plain: "repeat step", simple: "going around again", gloss: "One pass through a loop." },
  { term: "recursion", domain: "tech", plain: "self-reference", simple: "calling itself", gloss: "A function that calls itself." },
  { term: "concatenation", domain: "tech", plain: "joining", simple: "chaining together", gloss: "Joining strings together." },
  { term: "parsing", domain: "tech", plain: "reading", simple: "breaking down", gloss: "Analyzing text into parts." },
  { term: "lexical", domain: "tech", plain: "word-level", simple: "about words", gloss: "Related to words or tokens." },
  { term: "semantic", domain: "tech", plain: "meaning-level", simple: "about meaning", gloss: "Related to meaning." },
  { term: "syntactic", domain: "tech", plain: "grammar-level", simple: "about grammar", gloss: "Related to grammar or structure." },
  { term: "deterministic", domain: "tech", plain: "predictable", simple: "same input, same output", gloss: "Always gives the same output for the same input." },
  { term: "nondeterministic", domain: "tech", plain: "unpredictable", simple: "may differ each run", gloss: "May give different outputs for the same input." },
  { term: "heuristic", domain: "tech", plain: "rule of thumb", simple: "best-guess rule", gloss: "A practical rule that usually works." },
  { term: "algorithm", domain: "tech", plain: "procedure", simple: "step-by-step recipe", gloss: "A step-by-step procedure for solving a problem." },
  { term: "debugging", domain: "tech", plain: "fixing bugs", simple: "finding errors", gloss: "Finding and fixing errors in code." },
  { term: "compilation", domain: "tech", plain: "translating", simple: "converting to run", gloss: "Converting source code into runnable form." },
  { term: "optimization", domain: "tech", plain: "tuning", simple: "making faster", gloss: "Making code run faster or use less memory." },
  { term: "framework", domain: "tech", plain: "toolkit", simple: "ready-made base", gloss: "A reusable base for building software." },
  { term: "library", domain: "tech", plain: "code pack", simple: "code toolkit", gloss: "A collection of pre-written code." },
  { term: "compilation unit", domain: "tech", plain: "code unit", simple: "single code block", gloss: "A single file or block that gets compiled." },
  { term: "instantiation", domain: "tech", plain: "creation", simple: "making one", gloss: "Creating an instance of a class or template." },
  { term: "non-blocking", domain: "tech", plain: "no waiting", simple: "no waiting", gloss: "Does not make the caller wait." },
  { term: "backwards-compatible", domain: "tech", plain: "works with old versions", simple: "still works with old", gloss: "Works with older versions." },
  { term: "regression", domain: "tech", plain: "going backwards", simple: "older bug returns", gloss: "A bug that comes back after a change." },
  { term: "instrumentation", domain: "tech", plain: "monitoring", simple: "adding measurement", gloss: "Adding code to monitor behavior." },
  { term: "telemetry", domain: "tech", plain: "auto-reporting", simple: "auto status reports", gloss: "Automatic data collection from a system." },
  { term: "throughput", domain: "tech", plain: "speed", simple: "work rate", gloss: "How much work is done in a period." },
  { term: "uptime", domain: "tech", plain: "running time", simple: "time working", gloss: "Time a system is up and running." },
  { term: "downtime", domain: "tech", plain: "outage", simple: "time not working", gloss: "Time a system is unavailable." },

  // ----- MEDICAL (60) -----
  { term: "hypertension", domain: "medical", plain: "high blood pressure", simple: "high blood pressure", gloss: "Blood pressure that is too high." },
  { term: "hypotension", domain: "medical", plain: "low blood pressure", simple: "low blood pressure", gloss: "Blood pressure that is too low." },
  { term: "subcutaneous", domain: "medical", plain: "under the skin", simple: "under the skin", gloss: "Located or placed just under the skin." },
  { term: "intravenous", domain: "medical", plain: "into a vein", simple: "into a vein", gloss: "Given directly into a vein." },
  { term: "intramuscular", domain: "medical", plain: "into a muscle", simple: "into a muscle", gloss: "Given into a muscle." },
  { term: "contraindication", domain: "medical", plain: "reason not to use", simple: "reason not to use", gloss: "A reason not to use a treatment." },
  { term: "prognosis", domain: "medical", plain: "outlook", simple: "expected outcome", gloss: "The likely course of a disease." },
  { term: "diagnosis", domain: "medical", plain: "identification", simple: "what is wrong", gloss: "Identifying a disease from symptoms." },
  { term: "etiology", domain: "medical", plain: "cause", simple: "cause", gloss: "The cause of a disease." },
  { term: "pathology", domain: "medical", plain: "disease study", simple: "study of disease", gloss: "The study of disease." },
  { term: "symptomatology", domain: "medical", plain: "symptoms", simple: "symptoms", gloss: "The set of symptoms of a disease." },
  { term: "benign", domain: "medical", plain: "not cancer", simple: "not harmful", gloss: "Not cancerous or dangerous." },
  { term: "malignant", domain: "medical", plain: "cancerous", simple: "cancerous", gloss: "Cancerous and able to spread." },
  { term: "metastasis", domain: "medical", plain: "spread", simple: "spread of cancer", gloss: "Cancer spreading to new areas." },
  { term: "remission", domain: "medical", plain: "improvement", simple: "disease reduced", gloss: "Reduction or disappearance of disease signs." },
  { term: "exacerbation", domain: "medical", plain: "worsening", simple: "getting worse", gloss: "A flare-up or worsening of a condition." },
  { term: "chronic", domain: "medical", plain: "long-term", simple: "long-lasting", gloss: "Lasting a long time." },
  { term: "acute", domain: "medical", plain: "sudden", simple: "sudden and short", gloss: "Sudden onset, short course." },
  { term: "idiopathic", domain: "medical", plain: "unknown cause", simple: "cause unknown", gloss: "Of unknown cause." },
  { term: "nosocomial", domain: "medical", plain: "hospital-acquired", simple: "caught in hospital", gloss: "Caught while in hospital." },
  { term: "iatrogenic", domain: "medical", plain: "treatment-caused", simple: "caused by treatment", gloss: "Caused by medical treatment." },
  { term: "inpatient", domain: "medical", plain: "staying overnight", simple: "staying in hospital", gloss: "A patient staying in hospital." },
  { term: "outpatient", domain: "medical", plain: "day visit", simple: "not staying overnight", gloss: "A patient treated without staying." },
  { term: "anesthesia", domain: "medical", plain: "numbing", simple: "pain blocking", gloss: "Loss of sensation for surgery." },
  { term: "analgesic", domain: "medical", plain: "painkiller", simple: "painkiller", gloss: "A medicine that relieves pain." },
  { term: "antipyretic", domain: "medical", plain: "fever reducer", simple: "fever reducer", gloss: "A medicine that lowers fever." },
  { term: "antibiotic", domain: "medical", plain: "bacteria killer", simple: "germ medicine", gloss: "A medicine that kills bacteria." },
  { term: "antiviral", domain: "medical", plain: "virus medicine", simple: "virus medicine", gloss: "A medicine that fights viruses." },
  { term: "antifungal", domain: "medical", plain: "fungus medicine", simple: "fungus medicine", gloss: "A medicine that fights fungi." },
  { term: "anti-inflammatory", domain: "medical", plain: "swelling reducer", simple: "swelling reducer", gloss: "Reduces inflammation and swelling." },
  { term: "edema", domain: "medical", plain: "swelling", simple: "swelling", gloss: "Fluid buildup causing swelling." },
  { term: "erythema", domain: "medical", plain: "redness", simple: "redness", gloss: "Redness of the skin." },
  { term: "pruritus", domain: "medical", plain: "itching", simple: "itching", gloss: "Itching of the skin." },
  { term: "paresthesia", domain: "medical", plain: "tingling", simple: "tingling", gloss: "A tingling or prickling feeling." },
  { term: "syncope", domain: "medical", plain: "fainting", simple: "fainting", gloss: "Brief loss of consciousness." },
  { term: "dyspnea", domain: "medical", plain: "shortness of breath", simple: "trouble breathing", gloss: "Difficulty breathing." },
  { term: "tachycardia", domain: "medical", plain: "fast heartbeat", simple: "fast heart rate", gloss: "Heart rate over 100 per minute." },
  { term: "bradycardia", domain: "medical", plain: "slow heartbeat", simple: "slow heart rate", gloss: "Heart rate under 60 per minute." },
  { term: "arrhythmia", domain: "medical", plain: "irregular heartbeat", simple: "irregular heartbeat", gloss: "An irregular heartbeat." },
  { term: "ischemia", domain: "medical", plain: "low blood flow", simple: "low blood flow", gloss: "Not enough blood flow to tissue." },
  { term: "infarction", domain: "medical", plain: "tissue death", simple: "tissue death", gloss: "Tissue death from lack of blood." },
  { term: "necrosis", domain: "medical", plain: "tissue death", simple: "tissue death", gloss: "Death of body tissue." },
  { term: "sclerosis", domain: "medical", plain: "hardening", simple: "hardening", gloss: "Hardening of tissue." },
  { term: "stenosis", domain: "medical", plain: "narrowing", simple: "narrowing", gloss: "Abnormal narrowing of a passage." },
  { term: "dilation", domain: "medical", plain: "widening", simple: "widening", gloss: "Widening of a passage or vessel." },
  { term: "lesion", domain: "medical", plain: "damaged area", simple: "damaged area", gloss: "An area of abnormal tissue." },
  { term: "polyp", domain: "medical", plain: "growth", simple: "small growth", gloss: "A small abnormal growth." },
  { term: "cyst", domain: "medical", plain: "fluid sac", simple: "fluid sac", gloss: "A sac of fluid in tissue." },
  { term: "lesion", domain: "medical", plain: "abnormal area", simple: "abnormal area", gloss: "A damaged or abnormal area." },
  { term: "morbidity", domain: "medical", plain: "illness rate", simple: "illness rate", gloss: "The rate of illness in a group." },
  { term: "mortality", domain: "medical", plain: "death rate", simple: "death rate", gloss: "The rate of death in a group." },
  { term: "incidence", domain: "medical", plain: "new cases", simple: "new case count", gloss: "Number of new cases of a disease." },
  { term: "prevalence", domain: "medical", plain: "total cases", simple: "total cases", gloss: "Total number of cases at a time." },
  { term: "palliative", domain: "medical", plain: "comfort care", simple: "comfort care", gloss: "Care that relieves symptoms without curing." },
  { term: "curative", domain: "medical", plain: "aimed at cure", simple: "aimed at cure", gloss: "Treatment intended to cure." },
  { term: "prophylactic", domain: "medical", plain: "preventive", simple: "preventive", gloss: "Used to prevent disease." },
  { term: "therapeutic", domain: "medical", plain: "healing", simple: "healing", gloss: "Related to treating disease." },
  { term: "sublingual", domain: "medical", plain: "under the tongue", simple: "under the tongue", gloss: "Placed under the tongue." },
  { term: "topical", domain: "medical", plain: "on the skin", simple: "on the skin", gloss: "Applied to the skin." },
  { term: "oral", domain: "medical", plain: "by mouth", simple: "by mouth", gloss: "Taken by mouth." },

  // ----- LEGAL (50) -----
  { term: "notwithstanding", domain: "legal", plain: "despite this", simple: "even so", gloss: "In spite of what was just said." },
  { term: "heretofore", domain: "legal", plain: "before this", simple: "up to now", gloss: "Up to this point." },
  { term: "hereinafter", domain: "legal", plain: "below", simple: "later in this", gloss: "Later in this document." },
  { term: "therein", domain: "legal", plain: "in there", simple: "in that", gloss: "In that place or document." },
  { term: "thereof", domain: "legal", plain: "of that", simple: "of it", gloss: "Of that thing just mentioned." },
  { term: "hereby", domain: "legal", plain: "by this", simple: "by this", gloss: "By means of this document." },
  { term: "herein", domain: "legal", plain: "in this", simple: "in this", gloss: "In this document." },
  { term: "hereto", domain: "legal", plain: "to this", simple: "to this", gloss: "To this document." },
  { term: "indemnify", domain: "legal", plain: "compensate for loss", simple: "repay for harm", gloss: "To compensate someone for a loss." },
  { term: "hold harmless", domain: "legal", plain: "protect from blame", simple: "not blame", gloss: "To protect someone from liability." },
  { term: "tort", domain: "legal", plain: "civil wrong", simple: "civil wrong", gloss: "A civil wrong that causes harm." },
  { term: "force majeure", domain: "legal", plain: "unforeseeable event", simple: "unforeseeable event", gloss: "An unforeseeable event that prevents fulfilling a contract." },
  { term: "prima facie", domain: "legal", plain: "at first look", simple: "on first look", gloss: "Based on the first impression." },
  { term: "pro bono", domain: "legal", plain: "free of charge", simple: "for free", gloss: "Done without charge, for the public good." },
  { term: "pro se", domain: "legal", plain: "self-represented", simple: "representing self", gloss: "Representing oneself in court." },
  { term: "in re", domain: "legal", plain: "in the matter of", simple: "in the matter of", gloss: "In the matter of (case caption)." },
  { term: "ex parte", domain: "legal", plain: "one-sided", simple: "one side only", gloss: "Done by or for one side only." },
  { term: "ipse dixit", domain: "legal", plain: "bare assertion", simple: "just saying so", gloss: "An assertion without proof." },
  { term: "res judicata", domain: "legal", plain: "already decided", simple: "already decided", gloss: "A matter already judged." },
  { term: "stare decisis", domain: "legal", plain: "follow precedent", simple: "follow past rulings", gloss: "Following prior court decisions." },
  { term: "habeas corpus", domain: "legal", plain: "produce the body", simple: "right to court review", gloss: "A right to challenge unlawful detention." },
  { term: "voir dire", domain: "legal", plain: "jury screening", simple: "jury interview", gloss: "Questioning of potential jurors." },
  { term: "subpoena", domain: "legal", plain: "court order", simple: "court order", gloss: "A court order to appear or produce evidence." },
  { term: "discovery", domain: "legal", plain: "evidence exchange", simple: "evidence sharing", gloss: "Pre-trial exchange of evidence." },
  { term: "deposition", domain: "legal", plain: "sworn statement", simple: "sworn interview", gloss: "A sworn out-of-court statement." },
  { term: "affidavit", domain: "legal", plain: "sworn statement", simple: "sworn written statement", gloss: "A written statement made under oath." },
  { term: "fiduciary", domain: "legal", plain: "trusted agent", simple: "trusted agent", gloss: "A person holding trust for another." },
  { term: "tortfeasor", domain: "legal", plain: "wrongdoer", simple: "wrongdoer", gloss: "A person who commits a civil wrong." },
  { term: "plaintiff", domain: "legal", plain: "person suing", simple: "person suing", gloss: "The party bringing a lawsuit." },
  { term: "defendant", domain: "legal", plain: "person being sued", simple: "person being sued", gloss: "The party being sued." },
  { term: "appellant", domain: "legal", plain: "appealer", simple: "appealer", gloss: "The party appealing a decision." },
  { term: "appellee", domain: "legal", plain: "respondent", simple: "respondent", gloss: "The party responding to an appeal." },
  { term: "lessee", domain: "legal", plain: "tenant", simple: "renter", gloss: "The party leasing property." },
  { term: "lessor", domain: "legal", plain: "landlord", simple: "owner renting out", gloss: "The party granting a lease." },
  { term: "bailor", domain: "legal", plain: "depositor", simple: "depositor", gloss: "The party who gives property to another." },
  { term: "bailee", domain: "legal", plain: "holder", simple: "holder", gloss: "The party who holds another's property." },
  { term: "consideration", domain: "legal", plain: "what's exchanged", simple: "what's given in return", gloss: "Something of value exchanged in a contract." },
  { term: "breach", domain: "legal", plain: "violation", simple: "violation", gloss: "Failure to follow a contract or duty." },
  { term: "remedy", domain: "legal", plain: "fix", simple: "fix", gloss: "A legal means to redress a wrong." },
  { term: "damages", domain: "legal", plain: "money award", simple: "money award", gloss: "Money awarded for a loss." },
  { term: "injunction", domain: "legal", plain: "court order", simple: "court order to act", gloss: "A court order to do or stop doing something." },
  { term: "jurisdiction", domain: "legal", plain: "legal authority area", simple: "court's authority", gloss: "The authority of a court to decide." },
  { term: "statute", domain: "legal", plain: "law", simple: "law", gloss: "A written law passed by a legislature." },
  { term: "precedent", domain: "legal", plain: "past ruling", simple: "past ruling", gloss: "A prior court decision used as a guide." },
  { term: "litigation", domain: "legal", plain: "lawsuit", simple: "lawsuit", gloss: "The process of taking legal action." },
  { term: "arbitration", domain: "legal", plain: "private judging", simple: "private judging", gloss: "Resolving a dispute outside of court." },
  { term: "mediation", domain: "legal", plain: "facilitated talk", simple: "guided talk", gloss: "A neutral third party helps parties agree." },
  { term: "estoppel", domain: "legal", plain: "bar from denying", simple: "bar from denying", gloss: "Prevents someone from going back on a word." },
  { term: "novation", domain: "legal", plain: "replacement contract", simple: "new contract replacing old", gloss: "Replacing an old contract with a new one." },
  { term: "severability", domain: "legal", plain: "kept-separate", simple: "parts can stand alone", gloss: "If one part fails, others still apply." },
  { term: "warrant", domain: "legal", plain: "guarantee", simple: "guarantee", gloss: "A formal promise or guarantee." },

  // ----- FINANCIAL (40) -----
  { term: "amortization", domain: "financial", plain: "spread-out payments", simple: "spreading cost over time", gloss: "Spreading a loan cost over time." },
  { term: "deleveraging", domain: "financial", plain: "reducing debt", simple: "cutting debt", gloss: "Reducing debt on the balance sheet." },
  { term: "derivative", domain: "financial", plain: "derived contract", simple: "contract based on another asset", gloss: "A contract whose value comes from an asset." },
  { term: "etf", domain: "financial", plain: "fund basket", simple: "basket of stocks", gloss: "A fund that holds many assets like a basket." },
  { term: "exchange-traded fund", domain: "financial", plain: "fund basket", simple: "basket of stocks", gloss: "A fund traded on an exchange." },
  { term: "hedge", domain: "financial", plain: "risk offset", simple: "risk offset", gloss: "An investment to reduce risk." },
  { term: "leverage", domain: "financial", plain: "borrowed money", simple: "borrowed money", gloss: "Using borrowed money to invest." },
  { term: "liquidity", domain: "financial", plain: "ease of selling", simple: "ease of selling", gloss: "How easily an asset can be sold for cash." },
  { term: "illiquid", domain: "financial", plain: "hard to sell", simple: "hard to sell", gloss: "Hard to sell quickly without loss." },
  { term: "yield", domain: "financial", plain: "return rate", simple: "return rate", gloss: "Income returned on an investment." },
  { term: "coupon", domain: "financial", plain: "interest payment", simple: "interest payment", gloss: "The interest payment on a bond." },
  { term: "principal", domain: "financial", plain: "original amount", simple: "original amount", gloss: "The original amount of a loan." },
  { term: "dividend", domain: "financial", plain: "profit share", simple: "profit share", gloss: "A share of company profits paid to owners." },
  { term: "capital gain", domain: "financial", plain: "profit on sale", simple: "profit on sale", gloss: "Profit from selling an asset." },
  { term: "capital loss", domain: "financial", plain: "loss on sale", simple: "loss on sale", gloss: "Loss from selling an asset." },
  { term: "appreciation", domain: "financial", plain: "value gain", simple: "value gain", gloss: "Increase in an asset's value." },
  { term: "depreciation", domain: "financial", plain: "value loss", simple: "value loss", gloss: "Decrease in an asset's value over time." },
  { term: "equity", domain: "financial", plain: "ownership share", simple: "ownership share", gloss: "Ownership value in an asset." },
  { term: "asset", domain: "financial", plain: "thing of value", simple: "thing of value", gloss: "Something of value you own." },
  { term: "liability", domain: "financial", plain: "what's owed", simple: "what's owed", gloss: "Money or obligations owed." },
  { term: "revenue", domain: "financial", plain: "income", simple: "income", gloss: "Money coming in from sales." },
  { term: "expenditure", domain: "financial", plain: "spending", simple: "spending", gloss: "Money spent." },
  { term: "ebitda", domain: "financial", plain: "profit before extras", simple: "profit before extras", gloss: "Earnings before interest, taxes, depreciation, and amortization." },
  { term: "p&l", domain: "financial", plain: "profit and loss", simple: "profit and loss", gloss: "Profit and loss statement." },
  { term: "balance sheet", domain: "financial", plain: "financial snapshot", simple: "financial snapshot", gloss: "A statement of what you own and owe." },
  { term: "cash flow", domain: "financial", plain: "money movement", simple: "money in and out", gloss: "Money coming in and going out." },
  { term: "bull market", domain: "financial", plain: "rising market", simple: "rising market", gloss: "A market where prices are rising." },
  { term: "bear market", domain: "financial", plain: "falling market", simple: "falling market", gloss: "A market where prices are falling." },
  { term: "blue chip", domain: "financial", plain: "large stable stock", simple: "large stable stock", gloss: "Shares in a large, well-known company." },
  { term: "ipo", domain: "financial", plain: "first stock sale", simple: "first stock sale", gloss: "Initial public offering — first sale of stock to the public." },
  { term: "mutual fund", domain: "financial", plain: "shared investment", simple: "shared investment pool", gloss: "A pool of money invested in many assets." },
  { term: "index fund", domain: "financial", plain: "market-tracking fund", simple: "market-tracking fund", gloss: "A fund that tracks a market index." },
  { term: "bond", domain: "financial", plain: "loan to issuer", simple: "loan to a company", gloss: "A loan you make to a company or government." },
  { term: "treasury", domain: "financial", plain: "govt bonds", simple: "government bonds", gloss: "Bonds issued by a government." },
  { term: "commodity", domain: "financial", plain: "raw material", simple: "raw material", gloss: "A raw material like gold, oil, or wheat." },
  { term: "portfolio", domain: "financial", plain: "investment mix", simple: "investment mix", gloss: "All the investments you hold." },
  { term: "diversification", domain: "financial", plain: "spreading risk", simple: "spreading risk", gloss: "Spreading investments to reduce risk." },
  { term: "volatility", domain: "financial", plain: "price swings", simple: "price swings", gloss: "How much prices move up and down." },
  { term: "arbitrage", domain: "financial", plain: "risk-free profit", simple: "profit from price gaps", gloss: "Profiting from price differences in markets." },
  { term: "default", domain: "financial", plain: "failure to pay", simple: "failure to pay", gloss: "Failure to repay a debt." },
  { term: "underwriting", domain: "financial", plain: "risk assessment", simple: "risk assessment", gloss: "Assessing and assuming risk for a fee." },
];

// ---------- Helper utilities ----------

const VOWELS = new Set(["a", "e", "i", "o", "u", "y"]);

/** Generate a short pseudo-random id. */
function genId(): string {
  return `j-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36).slice(-4)}`;
}

/** Normalize newlines + whitespace. Preserves single spaces. */
export function normalizeText(s: string): string {
  if (!s) return "";
  return s.replace(/\r\n?/g, "\n").replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n");
}

/** Escape HTML special characters. */
export function escapeHtml(s: string): string {
  return (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Count words (split on whitespace). */
export function countWords(s: string): number {
  if (!s || !s.trim()) return 0;
  return (s.trim().match(/\S+/g) ?? []).length;
}

/** Count sentences (split on terminal punctuation). */
export function countSentences(s: string): number {
  if (!s || !s.trim()) return 0;
  const parts = s.split(/[.!?]+(?:\s|$)/).filter((p) => p.trim().length > 0);
  if (/[.!?]\s*$/.test(s) && parts.length === 0) return 1;
  return parts.length || 1;
}

/** Count syllables in a word (rough heuristic). */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, "");
  if (!w) return 0;
  if (w.length <= 3) return 1;
  const cleaned = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, "").replace(/^y/, "");
  const matches = cleaned.match(/[aeiouy]{1,2}/g);
  return matches ? matches.length : 1;
}

/** Count total syllables across a body of text. */
export function countTotalSyllables(s: string): number {
  if (!s) return 0;
  const words = s.match(/[A-Za-z']+/g) ?? [];
  return words.reduce((acc, w) => acc + countSyllables(w), 0);
}

/** Count long sentences (over 25 words). */
export function countLongSentences(s: string): number {
  if (!s || !s.trim()) return 0;
  const sentences = s.split(/(?<=[.!?])\s+/).filter((p) => p.trim().length > 0);
  return sentences.filter((sent) => countWords(sent) > 25).length;
}

// ---------- Readability ----------

/** Compute Flesch reading ease + grade level. */
export function computeReadability(s: string): Readability {
  const wordCount = countWords(s);
  const sentenceCount = countSentences(s);
  const syllableCount = countTotalSyllables(s);
  const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
  const avgSyllablesPerWord = wordCount > 0 ? syllableCount / wordCount : 0;
  const longSentenceCount = countLongSentences(s);
  if (wordCount === 0 || sentenceCount === 0) {
    return {
      fleschReadingEase: 0,
      fleschGradeLevel: 0,
      wordCount: 0,
      sentenceCount: 0,
      syllableCount: 0,
      avgWordsPerSentence: 0,
      longSentenceCount: 0,
    };
  }
  const fleschReadingEase = 206.835 - 1.015 * avgWordsPerSentence - 84.6 * avgSyllablesPerWord;
  const fleschGradeLevel = 0.39 * avgWordsPerSentence + 11.8 * avgSyllablesPerWord - 15.59;
  return {
    fleschReadingEase: Math.max(0, Math.min(100, Math.round(fleschReadingEase * 10) / 10)),
    fleschGradeLevel: Math.max(0, Math.round(fleschGradeLevel * 10) / 10),
    wordCount,
    sentenceCount,
    syllableCount,
    avgWordsPerSentence: Math.round(avgWordsPerSentence * 10) / 10,
    longSentenceCount,
  };
}

// ---------- Locked-token detection ----------

const LOCK_PATTERNS: { kind: LockedToken["kind"]; re: RegExp }[] = [
  // URLs
  { kind: "url", re: /\bhttps?:\/\/\S+/gi },
  // Dates: 2024-03-15, 03/15/2024, March 15, 2024
  { kind: "date", re: /\b\d{4}-\d{1,2}-\d{1,2}\b|\b\d{1,2}\/\d{1,2}\/\d{2,4}\b|\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2},\s+\d{4}\b/gi },
  // Dosages: 500mg, 10 mL, 25 mcg
  { kind: "dosage", re: /\b\d+(?:\.\d+)?\s?(?:mg|mcg|g|kg|ml|mL|IU|units?)\b/gi },
  // Currency: $1,234.56, €100, £50
  { kind: "currency", re: /[$€£¥₹]\s?\d[\d,]*(?:\.\d+)?\b/g },
  // Percentages: 40%, 12.5%
  { kind: "percent", re: /\b\d+(?:\.\d+)?%/g },
  // Citations: Smith v. Jones, 2020; DOI: 10.xxxx
  { kind: "citation", re: /\b[A-Z][a-zA-Z]+\s+v\.\s+[A-Z][a-zA-Z]+(?:,\s+\d{4})?\b|\bDOI:\s*10\.\S+/g },
  // Other figures (numbers with units): 25%, 100ms, 30kg, 4K — handle pure numeric tokens last
  { kind: "figure", re: /\b\d[\d,]*(?:\.\d+)?\b/g },
];

/** Find all locked tokens (figures, dates, dosages, citations, currency, percent, urls). */
export function findLockedTokens(text: string, enabled: boolean): LockedToken[] {
  if (!enabled || !text) return [];
  const out: LockedToken[] = [];
  const ranges: { start: number; end: number }[] = [];
  for (const { kind, re } of LOCK_PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      // Skip overlapping matches (already claimed by a higher-priority pattern)
      if (ranges.some((r) => start < r.end && end > r.start)) continue;
      ranges.push({ start, end });
      out.push({ start, end, text: m[0], kind });
      if (m[0] === "") re.lastIndex++;
    }
  }
  out.sort((a, b) => a.start - b.start);
  return out;
}

/** Check whether an offset range overlaps any locked token. */
export function overlapsLocked(start: number, end: number, locked: LockedToken[]): boolean {
  return locked.some((l) => start < l.end && end > l.start);
}

// ---------- Jargon detection ----------

/** Build a word-boundary regex for a single term (escapes regex metachars). */
export function buildTermRegex(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  // Use word boundaries; allow plural -s and -es after the term
  return new RegExp(`\\b${escaped}(?:s|es)?\\b`, "gi");
}

/** Detect all jargon hits in the text. */
export function findJargon(text: string, options: SimplifyOptions): JargonHit[] {
  if (!text) return [];
  const ignored = new Set(options.ignored.map((t) => t.toLowerCase()));
  const filtered = options.domains.length > 0
    ? JARGON_DICTIONARY.filter((e) => options.domains.includes(e.domain))
    : JARGON_DICTIONARY;
  const locked = options.lockTokens ? findLockedTokens(text, true) : [];
  const hits: JargonHit[] = [];
  // Find candidate matches across all dictionary terms; sort by start asc, then by longest term.
  const candidates: { entry: JargonEntry; start: number; end: number; original: string }[] = [];
  for (const entry of filtered) {
    if (ignored.has(entry.term)) continue;
    const re = buildTermRegex(entry.term);
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const start = m.index;
      const end = m.index + m[0].length;
      if (options.lockTokens && overlapsLocked(start, end, locked)) continue;
      candidates.push({ entry, start, end, original: m[0] });
      if (m[0] === "") re.lastIndex++;
    }
  }
  // Sort by start asc; tie-breaker: longest term first (so "exchange-traded fund" beats "fund").
  candidates.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));
  // Greedy non-overlap selection.
  let lastEnd = -1;
  for (const c of candidates) {
    if (c.start < lastEnd) continue; // overlaps a previously chosen hit
    const replacement = pickReplacement(c.entry, options.level);
    hits.push({
      id: genId(),
      entry: c.entry,
      start: c.start,
      end: c.end,
      original: c.original,
      replacement: preserveCase(c.original, replacement),
    });
    lastEnd = c.end;
  }
  return hits;
}

/** Pick a replacement string based on reading level. */
export function pickReplacement(entry: JargonEntry, level: ReadingLevel): string {
  switch (level) {
    case "grade5":
      return entry.simple;
    case "grade8":
    case "grade12":
      return entry.plain;
    case "expert":
      return entry.term; // no substitution
  }
}

/** Preserve the case pattern of `original` when substituting `suggestion`. */
export function preserveCase(original: string, suggestion: string): string {
  if (!original) return suggestion;
  if (!suggestion) return suggestion;
  if (original === original.toUpperCase() && original.length > 1) {
    return suggestion.toUpperCase();
  }
  if (original[0] === original[0].toUpperCase() && original.slice(1) === original.slice(1).toLowerCase()) {
    return suggestion[0].toUpperCase() + suggestion.slice(1).toLowerCase();
  }
  return suggestion;
}

// ---------- Sentence splitting ----------

/** Split a sentence (over 25 words) into two at a sensible comma/conjunction. */
export function splitLongSentence(sentence: string): string {
  if (countWords(sentence) <= 25) return sentence;
  // Try splitting on ", and ", ", but ", "; " — pick the closest to the middle.
  const splitPoints: number[] = [];
  for (const re of [/,\s+(?:and|but|so|or|yet)\s+/gi, /;\s+/g, /,\s+/g]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sentence)) !== null) {
      splitPoints.push(m.index + m[0].length);
    }
  }
  if (splitPoints.length === 0) return sentence;
  const mid = Math.floor(sentence.length / 2);
  const best = splitPoints.reduce((best, p) =>
    Math.abs(p - mid) < Math.abs(best - mid) ? p : best, splitPoints[0]);
  const before = sentence.slice(0, best).trim();
  const after = sentence.slice(best).trim();
  // Capitalize the first letter of `after` if not already.
  const afterCap = after.charAt(0).toUpperCase() + after.slice(1);
  return `${before}. ${afterCap}`;
}

/** Split all sentences over 25 words in the text. */
export function splitLongSentences(text: string): string {
  if (!text) return text;
  const sentences = text.split(/(?<=[.!?])\s+/);
  return sentences.map(splitLongSentence).join(" ");
}

// ---------- Main simplify ----------

/** Apply jargon replacements to text, returning the simplified string. */
export function applyReplacements(text: string, hits: JargonHit[]): string {
  if (hits.length === 0) return text;
  // Sort hits by start descending so we can splice from the end without shifting offsets.
  const sorted = [...hits].sort((a, b) => b.start - a.start);
  let out = text;
  for (const h of sorted) {
    if (h.replacement === h.original) continue;
    out = out.slice(0, h.start) + h.replacement + out.slice(h.end);
  }
  return out;
}

/** Simplify text per options. Pure. */
export function simplifyText(text: string, options: SimplifyOptions): SimplifyResult {
  const original = normalizeText(text);
  const hits = findJargon(original, options);
  let simplified = applyReplacements(original, hits);
  if (options.splitLongSentences && options.level !== "expert") {
    simplified = splitLongSentences(simplified);
  }
  const locked = options.lockTokens ? findLockedTokens(original, true) : [];
  const byDomain: Record<Domain, number> = { tech: 0, medical: 0, legal: 0, financial: 0 };
  for (const h of hits) byDomain[h.entry.domain] += 1;
  const originalReadability = computeReadability(original);
  const simplifiedReadability = computeReadability(simplified);
  return {
    original,
    simplified,
    hits,
    locked,
    stats: {
      jargonCount: hits.length,
      byDomain,
      lockedCount: locked.length,
      originalReadability,
      simplifiedReadability,
      improvement: Math.round((simplifiedReadability.fleschReadingEase - originalReadability.fleschReadingEase) * 10) / 10,
    },
  };
}

// ---------- Diff ----------

/** Build a word-level diff between original and simplified. */
export function buildDiff(original: string, simplified: string): DiffSegment[] {
  if (original === simplified) return [{ type: "same", text: original }];
  const a = tokenizeWords(original);
  const b = tokenizeWords(simplified);
  // LCS dynamic programming.
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const segs: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  let buf = "";
  let bufType: DiffSegment["type"] | null = null;
  const flush = () => {
    if (buf && bufType) {
      segs.push({ type: bufType, text: buf });
      buf = "";
      bufType = null;
    }
  };
  while (i < m && j < n) {
    if (a[i] === b[j]) {
      flush();
      segs.push({ type: "same", text: a[i] });
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      if (bufType !== "removed") { flush(); bufType = "removed"; }
      buf += a[i];
      i++;
    } else {
      if (bufType !== "added") { flush(); bufType = "added"; }
      buf += b[j];
      j++;
    }
  }
  flush();
  while (i < m) { segs.push({ type: "removed", text: a[i] }); i++; }
  while (j < n) { segs.push({ type: "added", text: b[j] }); j++; }
  return segs;
}

/** Tokenize a string into words + whitespace runs (preserves order). */
export function tokenizeWords(s: string): string[] {
  if (!s) return [];
  return s.match(/\s+|\S+/g) ?? [];
}

/** Render the diff as HTML. */
export function renderDiffHtml(segments: DiffSegment[]): string {
  return segments.map((seg) => {
    const t = escapeHtml(seg.text);
    if (seg.type === "added") return `<span class="diff-add">${t}</span>`;
    if (seg.type === "removed") return `<span class="diff-remove">${t}</span>`;
    return t;
  }).join("");
}

/** Render simplified text with inline glossary tooltips on jargon. */
export function renderHighlightedHtml(result: SimplifyResult): string {
  if (result.hits.length === 0) return escapeHtml(result.simplified);
  // Sort hits by start asc.
  const hits = [...result.hits].sort((a, b) => a.start - b.start);
  // We highlight against the SIMPLIFIED text, so re-find positions of each replacement.
  // For simplicity, we walk through the simplified text and search for each replacement.
  // Approach: rebuild simplified text with markers.
  let html = "";
  let cursor = 0;
  // Compute positions of replacements in the simplified text by walking hits in order.
  // Since applyReplacements replaced text[start:end] with replacement, and we sorted hits
  // by start ascending in the ORIGINAL text, we can recompute their positions in the
  // simplified text by tracking the offset delta.
  let delta = 0;
  for (const h of hits) {
    const newPos = h.start + delta;
    const before = result.simplified.slice(cursor, newPos);
    html += escapeHtml(before);
    const tip = escapeHtml(`${h.entry.domain.toUpperCase()}: ${h.entry.gloss}`);
    html += `<span class="jargon" title="${tip}">${escapeHtml(h.replacement)}</span>`;
    delta += h.replacement.length - (h.end - h.start);
    cursor = newPos + h.replacement.length;
  }
  html += escapeHtml(result.simplified.slice(cursor));
  return html;
}

// ---------- Rendering ----------

/** Render the result as plain text (just the simplified text). */
export function renderPlain(result: SimplifyResult): string {
  return result.simplified;
}

/** Render as Markdown with glossary table appended. */
export function renderMarkdown(result: SimplifyResult): string {
  const lines: string[] = [result.simplified, ""];
  if (result.hits.length > 0) {
    lines.push("### Glossary", "");
    lines.push("| Term | Plain | Domain | Definition |");
    lines.push("| --- | --- | --- | --- |");
    for (const h of result.hits) {
      lines.push(
        `| ${h.original} | ${h.replacement} | ${DOMAIN_LABELS[h.entry.domain]} | ${h.entry.gloss} |`,
      );
    }
  }
  return lines.join("\n");
}

// ---------- History (localStorage) ----------

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------- Ignore list (session) ----------

export function loadIgnoreList(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(IGNORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveIgnoreList(terms: string[]): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(IGNORE_KEY, JSON.stringify(terms));
  } catch {
    // ignore
  }
}

export function clearIgnoreList(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(IGNORE_KEY);
  } catch {
    // ignore
  }
}

// ---------- Shareable URL ----------

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.text) params.set("text", state.text);
  params.set("level", state.level);
  if (state.domains.length > 0) params.set("domains", state.domains.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { text: "", level: "grade8", domains: [] };
  const params = new URLSearchParams(clean);
  const text = params.get("text") ?? "";
  const levelRaw = params.get("level") ?? "grade8";
  const level = (["grade5", "grade8", "grade12", "expert"].includes(levelRaw) ? levelRaw : "grade8") as ReadingLevel;
  const domainsRaw = params.get("domains") ?? "";
  const validDomains = Object.keys(DOMAIN_LABELS) as Domain[];
  const domains = domainsRaw
    ? domainsRaw.split(",").filter((d) => validDomains.includes(d as Domain)) as Domain[]
    : [];
  return { text, level, domains };
}

// ---------- LLM helpers ----------

/** Build a prompt for an optional LLM enhancement. */
export function buildLlmPrompt(text: string, level: ReadingLevel): string {
  const levelWord = LEVEL_LABELS[level];
  return [
    `Rewrite the following text into plain English at reading level: ${levelWord}.`,
    `Preserve all figures, dates, dosages, percentages, and citations exactly.`,
    `Define any remaining jargon inline in parentheses on first use.`,
    `Do not remove safety-critical caveats.`,
    "",
    "TEXT:",
    text,
  ].join("\n");
}

/** Render an LLM response for display. */
export function renderLlmResult(raw: string): string {
  return (raw || "").trim();
}

/**
 * AI Coding Pattern Refactorer — pure logic.
 *
 * Detects code smells (long methods, duplication, deep nesting, primitive
 * obsession, feature envy, etc.) and proposes named refactorings or design
 * patterns from the GoF catalog, each with a reviewable before/after diff
 * and a rationale. Pure functions only — no DOM, no network. The optional
 * LLM call (BYO API key) lives in ui.tsx and goes directly to the user's
 * provider.
 *
 * Honesty: refactorings are template-based and pattern detection is
 * heuristic. The tool CANNOT prove behavior preservation — always run
 * your test suite after applying any suggestion.
 */

// ---------- Types ----------

export type Language = "python" | "javascript" | "typescript" | "java" | "cpp" | "go";

export type SmellType =
  | "long-method"
  | "long-function"
  | "duplicated-code"
  | "deep-nesting"
  | "primitive-obsession"
  | "feature-envy"
  | "long-parameter-list"
  | "magic-number"
  | "god-class"
  | "large-class"
  | "switch-statement"
  | "comments-as-deodorizer"
  | "data-clumps"
  | "divergent-change"
  | "inappropriate-intimacy"
  | "lazy-class"
  | "shotgun-surgery";

export type Severity = "info" | "warning" | "error" | "critical";

export type PatternCategory = "creational" | "structural" | "behavioral";

export type PatternId =
  | "singleton"
  | "factory-method"
  | "abstract-factory"
  | "builder"
  | "prototype"
  | "adapter"
  | "bridge"
  | "composite"
  | "decorator"
  | "facade"
  | "flyweight"
  | "proxy"
  | "chain-of-responsibility"
  | "command"
  | "iterator"
  | "mediator"
  | "memento"
  | "observer"
  | "state"
  | "strategy"
  | "template-method"
  | "visitor";

export type RefactoringType =
  | "extract-function"
  | "inline-function"
  | "extract-class"
  | "replace-conditional-with-polymorphism"
  | "replace-conditional-with-strategy"
  | "replace-nested-conditional-with-guard-clauses"
  | "decompose-conditional"
  | "remove-duplication"
  | "introduce-parameter-object"
  | "replace-temp-with-query"
  | "replace-magic-number-with-symbolic-constant"
  | "hide-delegate"
  | "encapsulate-variable"
  | "rename-variable"
  | "consolidate-conditional-expression"
  | "substitute-algorithm"
  | "extract-method"
  | "introduce-null-object";

export interface Smell {
  type: SmellType;
  severity: Severity;
  line: number;        // 1-indexed
  endLine?: number;
  description: string;
  suggestedRefactoring?: RefactoringType;
  suggestedPattern?: PatternId;
  deterministic: boolean;
}

export interface Suggestion {
  id: string;
  smell: SmellType;
  refactoring: RefactoringType;
  pattern?: PatternId;
  severity: Severity;
  startLine: number;
  endLine?: number;
  title: string;
  rationale: string;
  tradeoffs: string;
  before: string;
  after: string;
  safe: boolean;   // safe = deterministic, behavior-preserving in most cases
  applied?: boolean;
}

export interface PatternCatalogEntry {
  id: PatternId;
  name: string;
  category: PatternCategory;
  intent: string;
  whenToUse: string;
  whenNotToUse: string;
  template: string;  // short code template (TypeScript-flavored)
  relatedSmells: SmellType[];
}

export interface DiffLine {
  type: "same" | "added" | "removed";
  before?: string;
  after?: string;
}

export interface ComplexityMetrics {
  cyclomatic: number;
  lines: number;
  functions: number;
  maxNesting: number;
  duplicates: number;
}

export interface RefactorResult {
  language: Language;
  smells: Smell[];
  suggestions: Suggestion[];
  complexityBefore: ComplexityMetrics;
  patternSuggestions: { pattern: PatternId; reason: string; relatedSmells: SmellType[] }[];
  warnings: string[];
}

export interface HistoryEntry {
  ts: number;
  language: Language;
  snippet: string;
  smellCount: number;
  suggestionCount: number;
}

export interface ShareState {
  language?: Language;
  code?: string;
  applied?: string;  // comma-separated suggestion ids
}

export interface LlmExplanation {
  overallSummary: string;
  suggestions: { id: string; rationale: string; alternative?: string }[];
  overallNotes: string[];
}

// ---------- Constants ----------

export const HISTORY_KEY = "unqtools:ai-coding-pattern-refactorer:history";
export const HISTORY_MAX = 20;
export const LLM_KEY_STORAGE = "unqtools:ai-coding-pattern-refactorer:llm-key";

export const LANGUAGE_LABELS: Record<Language, string> = {
  python: "Python",
  javascript: "JavaScript",
  typescript: "TypeScript",
  java: "Java",
  cpp: "C++",
  go: "Go",
};

export const ALL_LANGUAGES: Language[] = [
  "python", "javascript", "typescript", "java", "cpp", "go",
];

export const SEVERITY_LABELS: Record<Severity, string> = {
  info: "Info",
  warning: "Warning",
  error: "Error",
  critical: "Critical",
};

export const SEVERITY_ORDER: Severity[] = ["critical", "error", "warning", "info"];

export const SMELL_LABELS: Record<SmellType, string> = {
  "long-method": "Long Method (Java/C++/TS)",
  "long-function": "Long Function (Python/Go)",
  "duplicated-code": "Duplicated Code",
  "deep-nesting": "Deep Nesting (>4 levels)",
  "primitive-obsession": "Primitive Obsession",
  "feature-envy": "Feature Envy",
  "long-parameter-list": "Long Parameter List (>4)",
  "magic-number": "Magic Number",
  "god-class": "God Class",
  "large-class": "Large Class (>200 lines)",
  "switch-statement": "Switch Statement (consider polymorphism)",
  "comments-as-deodorizer": "Comments as Deodorizer",
  "data-clumps": "Data Clumps",
  "divergent-change": "Divergent Change",
  "inappropriate-intimacy": "Inappropriate Intimacy",
  "lazy-class": "Lazy Class",
  "shotgun-surgery": "Shotgun Surgery",
};

export const REFACTORING_LABELS: Record<RefactoringType, string> = {
  "extract-function": "Extract Function",
  "inline-function": "Inline Function",
  "extract-class": "Extract Class",
  "replace-conditional-with-polymorphism": "Replace Conditional with Polymorphism",
  "replace-conditional-with-strategy": "Replace Conditional with Strategy",
  "replace-nested-conditional-with-guard-clauses": "Replace Nested Conditional with Guard Clauses",
  "decompose-conditional": "Decompose Conditional",
  "remove-duplication": "Remove Duplication",
  "introduce-parameter-object": "Introduce Parameter Object",
  "replace-temp-with-query": "Replace Temp with Query",
  "replace-magic-number-with-symbolic-constant": "Replace Magic Number with Symbolic Constant",
  "hide-delegate": "Hide Delegate",
  "encapsulate-variable": "Encapsulate Variable",
  "rename-variable": "Rename Variable",
  "consolidate-conditional-expression": "Consolidate Conditional Expression",
  "substitute-algorithm": "Substitute Algorithm",
  "extract-method": "Extract Method",
  "introduce-null-object": "Introduce Null Object",
};

export const PATTERN_LABELS: Record<PatternId, string> = {
  "singleton": "Singleton",
  "factory-method": "Factory Method",
  "abstract-factory": "Abstract Factory",
  "builder": "Builder",
  "prototype": "Prototype",
  "adapter": "Adapter",
  "bridge": "Bridge",
  "composite": "Composite",
  "decorator": "Decorator",
  "facade": "Facade",
  "flyweight": "Flyweight",
  "proxy": "Proxy",
  "chain-of-responsibility": "Chain of Responsibility",
  "command": "Command",
  "iterator": "Iterator",
  "mediator": "Mediator",
  "memento": "Memento",
  "observer": "Observer",
  "state": "State",
  "strategy": "Strategy",
  "template-method": "Template Method",
  "visitor": "Visitor",
};

export const CATEGORY_LABELS: Record<PatternCategory, string> = {
  creational: "Creational",
  structural: "Structural",
  behavioral: "Behavioral",
};

export const SAMPLE_SNIPPETS: Record<Language, string> = {
  python: [
    "def calculate_price(item_type, qty, price):",
    "    # apply discount based on type",
    "    if item_type == 'book':",
    "        discount = 0.10",
    "    elif item_type == 'electronics':",
    "        discount = 0.05",
    "    elif item_type == 'clothing':",
    "        discount = 0.20",
    "    else:",
    "        discount = 0",
    "    # compute total",
    "    total = qty * price * (1 - discount)",
    "    return total",
    "",
    "",
    "def process_items(items):",
    "    result = []",
    "    for item in items:",
    "        if item is not None:",
    "            if item.get('price') > 0:",
    "                if item.get('qty') > 0:",
    "                    result.append(calculate_price(item['type'], item['qty'], item['price']))",
    "    return result",
  ].join("\n"),
  javascript: [
    "function calculatePrice(type, qty, price) {",
    "  let discount = 0;",
    "  if (type === 'book') {",
    "    discount = 0.10;",
    "  } else if (type === 'electronics') {",
    "    discount = 0.05;",
    "  } else if (type === 'clothing') {",
    "    discount = 0.20;",
    "  }",
    "  return qty * price * (1 - discount);",
    "}",
    "",
    "function process(items) {",
    "  const result = [];",
    "  for (const item of items) {",
    "    if (item != null) {",
    "      if (item.price > 0) {",
    "        if (item.qty > 0) {",
    "          result.push(calculatePrice(item.type, item.qty, item.price));",
    "        }",
    "      }",
    "    }",
    "  }",
    "  return result;",
    "}",
  ].join("\n"),
  typescript: [
    "class PriceCalculator {",
    "  calculate(type: string, qty: number, price: number): number {",
    "    let discount = 0;",
    "    if (type === 'book') {",
    "      discount = 0.10;",
    "    } else if (type === 'electronics') {",
    "      discount = 0.05;",
    "    } else if (type === 'clothing') {",
    "      discount = 0.20;",
    "    }",
    "    return qty * price * (1 - discount);",
    "  }",
    "}",
  ].join("\n"),
  java: [
    "public class PriceCalculator {",
    "    public double calculate(String type, int qty, double price) {",
    "        double discount = 0;",
    "        if (\"book\".equals(type)) {",
    "            discount = 0.10;",
    "        } else if (\"electronics\".equals(type)) {",
    "            discount = 0.05;",
    "        } else if (\"clothing\".equals(type)) {",
    "            discount = 0.20;",
    "        }",
    "        return qty * price * (1 - discount);",
    "    }",
    "}",
  ].join("\n"),
  cpp: [
    "double calculate(const std::string& type, int qty, double price) {",
    "    double discount = 0;",
    "    if (type == \"book\") {",
    "        discount = 0.10;",
    "    } else if (type == \"electronics\") {",
    "        discount = 0.05;",
    "    } else if (type == \"clothing\") {",
    "        discount = 0.20;",
    "    }",
    "    return qty * price * (1 - discount);",
    "}",
  ].join("\n"),
  go: [
    "func calculate(itemType string, qty int, price float64) float64 {",
    "    discount := 0.0",
    "    if itemType == \"book\" {",
    "        discount = 0.10",
    "    } else if itemType == \"electronics\" {",
    "        discount = 0.05",
    "    } else if itemType == \"clothing\" {",
    "        discount = 0.20",
    "    }",
    "    return float64(qty) * price * (1 - discount)",
    "}",
  ].join("\n"),
};

// ---------- Pattern catalog ----------

export const PATTERN_CATALOG: PatternCatalogEntry[] = [
  {
    id: "singleton",
    name: "Singleton",
    category: "creational",
    intent: "Ensure a class has only one instance and provide a global access point to it.",
    whenToUse: "When exactly one instance is needed across the system: a logger, a config cache, a connection pool.",
    whenNotToUse: "Avoid for classes that may need multiple instances later. Introduces global state that complicates testing.",
    template: [
      "class Logger {",
      "  private static instance: Logger | null = null;",
      "  private constructor() {}",
      "  static getInstance(): Logger {",
      "    if (Logger.instance === null) Logger.instance = new Logger();",
      "    return Logger.instance;",
      "  }",
      "  log(msg: string) { console.log(msg); }",
      "}",
    ].join("\n"),
    relatedSmells: ["god-class"],
  },
  {
    id: "factory-method",
    name: "Factory Method",
    category: "creational",
    intent: "Define an interface for creating objects but let subclasses decide which class to instantiate.",
    whenToUse: "When a class cannot anticipate the class of objects it must create, or when you want to delegate creation to subclasses.",
    whenNotToUse: "When the concrete types are fixed and known upfront — a direct constructor call is simpler.",
    template: [
      "interface Animal { sound(): string; }",
      "class Dog implements Animal { sound() { return 'woof'; } }",
      "class Cat implements Animal { sound() { return 'meow'; } }",
      "abstract class AnimalFactory {",
      "  abstract createAnimal(): Animal;",
      "}",
      "class DogFactory extends AnimalFactory {",
      "  createAnimal() { return new Dog(); }",
      "}",
    ].join("\n"),
    relatedSmells: ["switch-statement", "primitive-obsession"],
  },
  {
    id: "abstract-factory",
    name: "Abstract Factory",
    category: "creational",
    intent: "Create families of related objects without specifying their concrete classes.",
    whenToUse: "When the system must be independent of how its products are created, and when there are families of related products.",
    whenNotToUse: "When there's only one product family — adds unnecessary abstraction.",
    template: [
      "interface Button { render(): void; }",
      "interface Checkbox { render(): void; }",
      "interface UIFactory { createButton(): Button; createCheckbox(): Checkbox; }",
      "class DarkFactory implements UIFactory { /* ... */ }",
      "class LightFactory implements UIFactory { /* ... */ }",
    ].join("\n"),
    relatedSmells: ["divergent-change"],
  },
  {
    id: "builder",
    name: "Builder",
    category: "creational",
    intent: "Separate construction of a complex object from its representation.",
    whenToUse: "When an object needs many optional parts or has a long parameter list — telescoping constructors.",
    whenNotToUse: "When the object has few fields — direct construction is simpler.",
    template: [
      "class Pizza {",
      "  cheese = false; pepperoni = false; mushrooms = false;",
      "}",
      "class PizzaBuilder {",
      "  private pizza = new Pizza();",
      "  addCheese() { this.pizza.cheese = true; return this; }",
      "  addPepperoni() { this.pizza.pepperoni = true; return this; }",
      "  build() { return this.pizza; }",
      "}",
    ].join("\n"),
    relatedSmells: ["long-parameter-list"],
  },
  {
    id: "prototype",
    name: "Prototype",
    category: "creational",
    intent: "Create new objects by cloning an existing prototype.",
    whenToUse: "When creating new objects is expensive (e.g., large initialization) or when subclasses differ only in their initial state.",
    whenNotToUse: "When each instance is cheap to construct from scratch.",
    template: [
      "interface Prototype { clone(): Prototype; }",
      "class Template implements Prototype {",
      "  clone() { return Object.assign(Object.create(Object.getPrototypeOf(this)), this); }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "adapter",
    name: "Adapter",
    category: "structural",
    intent: "Convert the interface of a class into another interface clients expect.",
    whenToUse: "When you want to use an existing class whose interface doesn't match the one you need.",
    whenNotToUse: "When you control the source class — just modify it directly.",
    template: [
      "interface Logger { log(msg: string): void; }",
      "class LegacyLogger { writeLine(text: string) { /* ... */ } }",
      "class LegacyLoggerAdapter implements Logger {",
      "  constructor(private legacy: LegacyLogger) {}",
      "  log(msg: string) { this.legacy.writeLine(msg); }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "bridge",
    name: "Bridge",
    category: "structural",
    intent: "Decouple an abstraction from its implementation so the two can vary independently.",
    whenToUse: "When you want to avoid a permanent binding between an abstraction and its implementation (e.g., cross-platform UI).",
    whenNotToUse: "When there's only one implementation — adds an unnecessary layer.",
    template: [
      "interface Renderer { renderCircle(radius: number): void; }",
      "class VectorRenderer implements Renderer { /* ... */ }",
      "class RasterRenderer implements Renderer { /* ... */ }",
      "abstract class Shape {",
      "  constructor(protected renderer: Renderer) {}",
      "  abstract draw(): void;",
      "}",
    ].join("\n"),
    relatedSmells: ["god-class"],
  },
  {
    id: "composite",
    name: "Composite",
    category: "structural",
    intent: "Compose objects into tree structures to represent part-whole hierarchies.",
    whenToUse: "When you want clients to treat individual objects and compositions of objects uniformly (e.g., file systems, UI trees).",
    whenNotToUse: "When the structure is flat — a simple list is enough.",
    template: [
      "interface Component { operation(): void; }",
      "class Leaf implements Component { operation() {} }",
      "class Composite implements Component {",
      "  children: Component[] = [];",
      "  operation() { this.children.forEach((c) => c.operation()); }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "decorator",
    name: "Decorator",
    category: "structural",
    intent: "Attach additional responsibilities to an object dynamically.",
    whenToUse: "When you want to add behavior to objects without modifying their class — alternative to subclassing.",
    whenNotToUse: "When the number of decorators grows large — composition via Strategy may be cleaner.",
    template: [
      "interface Coffee { cost(): number; }",
      "class SimpleCoffee implements Coffee { cost() { return 5; } }",
      "class MilkDecorator implements Coffee {",
      "  constructor(private inner: Coffee) {}",
      "  cost() { return this.inner.cost() + 1; }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "facade",
    name: "Facade",
    category: "structural",
    intent: "Provide a unified interface to a set of interfaces in a subsystem.",
    whenToUse: "When a subsystem is complex and clients need a simple entry point.",
    whenNotToUse: "When the subsystem is already simple.",
    template: [
      "class CPU { freeze() {} } class Memory { load() {} } class Disk { read() {} }",
      "class ComputerFacade {",
      "  private cpu = new CPU(); private mem = new Memory(); private disk = new Disk();",
      "  start() { this.cpu.freeze(); this.mem.load(); this.disk.read(); }",
      "}",
    ].join("\n"),
    relatedSmells: ["inappropriate-intimacy"],
  },
  {
    id: "flyweight",
    name: "Flyweight",
    category: "structural",
    intent: "Use sharing to support large numbers of fine-grained objects efficiently.",
    whenToUse: "When an application uses a huge number of objects that share most state (e.g., text characters, game tiles).",
    whenNotToUse: "When the number of objects is small or when they have unique state.",
    template: [
      "class TreeType { constructor(public name: string, public color: string) {} }",
      "class TreeFactory {",
      "  private static types = new Map<string, TreeType>();",
      "  static get(name: string, color: string) {",
      "    const key = name + color;",
      "    if (!this.types.has(key)) this.types.set(key, new TreeType(name, color));",
      "    return this.types.get(key)!;",
      "  }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "proxy",
    name: "Proxy",
    category: "structural",
    intent: "Provide a surrogate or placeholder for another object to control access to it.",
    whenToUse: "When you need lazy initialization, access control, logging, or remote access without changing the real subject.",
    whenNotToUse: "When direct access is fine — adds an indirection layer.",
    template: [
      "interface Service { request(): void; }",
      "class RealService implements Service { request() {} }",
      "class ProxyService implements Service {",
      "  private real?: RealService;",
      "  request() { if (!this.real) this.real = new RealService(); this.real.request(); }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "chain-of-responsibility",
    name: "Chain of Responsibility",
    category: "behavioral",
    intent: "Pass a request along a chain of handlers; each decides to handle it or pass it on.",
    whenToUse: "When more than one handler may process a request and the handler isn't known upfront (e.g., middleware, event bubbling).",
    whenNotToUse: "When the handler is known and fixed.",
    template: [
      "abstract class Handler {",
      "  next?: Handler;",
      "  setNext(h: Handler) { this.next = h; return h; }",
      "  abstract handle(req: string): string | null;",
      "}",
    ].join("\n"),
    relatedSmells: ["switch-statement"],
  },
  {
    id: "command",
    name: "Command",
    category: "behavioral",
    intent: "Encapsulate a request as an object, allowing parameterization, queuing, and undo.",
    whenToUse: "When you need to queue operations, support undo/redo, or decouple the invoker from the receiver.",
    whenNotToUse: "For trivial single-step actions — direct method calls are simpler.",
    template: [
      "interface Command { execute(): void; undo(): void; }",
      "class AddTextCommand implements Command {",
      "  constructor(private doc: Document, private text: string) {}",
      "  execute() { this.doc.add(this.text); }",
      "  undo() { this.doc.remove(this.text); }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "iterator",
    name: "Iterator",
    category: "behavioral",
    intent: "Provide a way to access the elements of an aggregate object sequentially without exposing its representation.",
    whenToUse: "When your collection has a custom traversal order or you want multiple traversals in parallel.",
    whenNotToUse: "When the language already provides iterators (most modern languages do).",
    template: [
      "interface Iterator<T> { hasNext(): boolean; next(): T; }",
      "class ArrayIterator<T> implements Iterator<T> {",
      "  private i = 0;",
      "  constructor(private arr: T[]) {}",
      "  hasNext() { return this.i < this.arr.length; }",
      "  next() { return this.arr[this.i++]; }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "mediator",
    name: "Mediator",
    category: "behavioral",
    intent: "Define an object that encapsulates how a set of objects interact; promotes loose coupling.",
    whenToUse: "When many objects communicate in complex ways and you want to centralize that logic (e.g., UI dialogs, chat rooms).",
    whenNotToUse: "When interactions are simple and few.",
    template: [
      "interface Mediator { notify(sender: object, event: string): void; }",
      "class ConcreteMediator implements Mediator {",
      "  notify(sender: object, event: string) { /* route events */ }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "memento",
    name: "Memento",
    category: "behavioral",
    intent: "Capture and externalize an object's internal state so it can be restored later, without violating encapsulation.",
    whenToUse: "When you need to save and restore state (e.g., undo, snapshots, transactions).",
    whenNotToUse: "When state is small and trivially reconstructable.",
    template: [
      "class Memento { constructor(public state: string) {} }",
      "class Originator {",
      "  state = '';",
      "  save() { return new Memento(this.state); }",
      "  restore(m: Memento) { this.state = m.state; }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "observer",
    name: "Observer",
    category: "behavioral",
    intent: "Define a one-to-many dependency so that when one object changes state, all its dependents are notified.",
    whenToUse: "When a change to one object requires changing others, and you don't know in advance how many dependents there are.",
    whenNotToUse: "When notifications are infrequent and the dependencies are static — direct calls are clearer.",
    template: [
      "type Listener = (data: unknown) => void;",
      "class Subject {",
      "  private listeners: Listener[] = [];",
      "  subscribe(l: Listener) { this.listeners.push(l); }",
      "  notify(data: unknown) { this.listeners.forEach((l) => l(data)); }",
      "}",
    ].join("\n"),
    relatedSmells: [],
  },
  {
    id: "state",
    name: "State",
    category: "behavioral",
    intent: "Allow an object to alter its behavior when its internal state changes.",
    whenToUse: "When an object's behavior depends on its state and has many state-specific behaviors (e.g., a TCP connection, a media player).",
    whenNotToUse: "When the state is binary and simple — flags work fine.",
    template: [
      "interface State { handle(): void; }",
      "class PlayingState implements State { handle() {} }",
      "class PausedState implements State { handle() {} }",
      "class Player { private state: State; constructor() { this.state = new PausedState(); } }",
    ].join("\n"),
    relatedSmells: ["switch-statement"],
  },
  {
    id: "strategy",
    name: "Strategy",
    category: "behavioral",
    intent: "Define a family of algorithms, encapsulate each, and make them interchangeable.",
    whenToUse: "When you have multiple variants of an algorithm, or when an algorithm has many conditional branches selecting behavior.",
    whenNotToUse: "When the algorithm has few variants — a function parameter is enough.",
    template: [
      "interface DiscountStrategy { apply(price: number): number; }",
      "class NoDiscount implements DiscountStrategy { apply(p: number) { return p; } }",
      "class TenPercentOff implements DiscountStrategy { apply(p: number) { return p * 0.9; } }",
      "class Cart { constructor(private strategy: DiscountStrategy) {} }",
    ].join("\n"),
    relatedSmells: ["switch-statement", "long-method", "long-function"],
  },
  {
    id: "template-method",
    name: "Template Method",
    category: "behavioral",
    intent: "Define the skeleton of an algorithm in the base class, letting subclasses override specific steps.",
    whenToUse: "When you have a fixed algorithm structure with variable steps that subclasses customize.",
    whenNotToUse: "When the algorithm steps vary independently — Strategy is more flexible.",
    template: [
      "abstract class Game {",
      "  play() { this.init(); this.start(); this.end(); }",
      "  abstract init(): void;",
      "  abstract start(): void;",
      "  abstract end(): void;",
      "}",
    ].join("\n"),
    relatedSmells: ["duplicated-code"],
  },
  {
    id: "visitor",
    name: "Visitor",
    category: "behavioral",
    intent: "Separate an algorithm from the object structure it operates on.",
    whenToUse: "When you have a stable object structure but want to add new operations without changing the classes.",
    whenNotToUse: "When the structure changes often — every new element type forces changes to all visitors.",
    template: [
      "interface Visitor { visitFile(f: File): void; visitFolder(d: Folder): void; }",
      "interface Element { accept(v: Visitor): void; }",
      "class File implements Element { accept(v: Visitor) { v.visitFile(this); } }",
    ].join("\n"),
    relatedSmells: [],
  },
];

// ---------- Language detection ----------

const DETECTION_KEYWORDS: Record<Language, RegExp[]> = {
  python: [/^\s*def\s+\w+\s*\(/m, /^\s*import\s+\w+/m, /^\s*from\s+\w+\s+import/m, /^\s*print\s*\(/m, /^\s*elif\s+/m, /:\s*$/m],
  javascript: [/\bfunction\s+\w+\s*\(/, /\bconst\s+\w+\s*=/, /\blet\s+\w+\s*=/, /\bconsole\.log\s*\(/, /\brequire\s*\(/, /=>/],
  typescript: [/\bfunction\s+\w+\s*\([^)]*\)\s*:\s*\w+/, /\binterface\s+\w+/, /:\s*(string|number|boolean|void)\b/, /\bconst\s+\w+\s*:\s*\w+/],
  java: [/\bpublic\s+(static\s+)?(class|void|int|String)\s+/, /\bSystem\.out\.println\s*\(/, /import\s+java\./, /\bprivate\s+(final\s+)?\w+\s+\w+\s*[;=]/],
  cpp: [/#include\s*[<"]/m, /\bstd::/, /\bcout\s*<</, /\bint\s+main\s*\(\s*\)/, /\btemplate\s*</],
  go: [/\bpackage\s+main\b/, /\bfunc\s+\w+\s*\(/, /:=/, /\bfmt\./, /\brange\s+\w/],
};

export function detectLanguage(code: string): Language {
  if (!code || !code.trim()) return "python";
  const scores: Record<Language, number> = {
    python: 0, javascript: 0, typescript: 0, java: 0, cpp: 0, go: 0,
  };
  for (const lang of ALL_LANGUAGES) {
    for (const re of DETECTION_KEYWORDS[lang]) {
      if (re.test(code)) scores[lang] += 1;
    }
  }
  if (/#include\s*[<"]/.test(code)) scores.cpp += 3;
  if (/\bpackage\s+main\b/.test(code)) scores.go += 3;
  if (/\bSystem\.out\.println\s*\(/.test(code)) scores.java += 2;
  if (/:[ ]*(string|number|boolean|void)\b|interface\s+\w+/.test(code)) scores.typescript += 2;
  if (/^\s*def\s+\w+/m.test(code)) scores.python += 3;
  let best: Language = "python";
  let bestScore = -1;
  for (const lang of ALL_LANGUAGES) {
    if (scores[lang] > bestScore) {
      bestScore = scores[lang];
      best = lang;
    }
  }
  return best;
}

// ---------- Helpers ----------

function linesOf(code: string): string[] {
  return code.replace(/\r\n/g, "\n").split("\n");
}

function stripStrings(line: string): string {
  return line.replace(/(['"`])(?:[^\\]|\\.)*?\1/g, '""');
}

function stripTrailingComment(line: string, lang: Language): string {
  if (lang === "python" || lang === "go") {
    const idx = line.indexOf("#");
    if (idx >= 0) {
      const before = line.slice(0, idx);
      if ((before.match(/'/g) ?? []).length % 2 === 0 && (before.match(/"/g) ?? []).length % 2 === 0) {
        return before;
      }
    }
    return line;
  }
  const m = line.match(/^(.*?)(\/\/.*)$/);
  if (m && m[1].trim() !== "") return m[1];
  return line;
}

function isCommentLine(line: string, lang: Language): boolean {
  const t = line.trim();
  if (lang === "python" || lang === "go") {
    if (t.startsWith("#")) return true;
  }
  if (t.startsWith("//") || t.startsWith("/*") || t.startsWith("*") || t.startsWith("*/")) return true;
  return false;
}

function indentOf(line: string): number {
  const m = line.match(/^(\s*)/);
  return m ? m[1].length : 0;
}

// ---------- Complexity metrics ----------

export function computeComplexity(code: string, lang: Language): ComplexityMetrics {
  const lines = linesOf(code);
  const nonBlank = lines.filter((l) => l.trim() !== "").length;

  // Cyclomatic: count decision points
  const codeStr = lines.map((l) => stripStrings(stripTrailingComment(l, lang))).join("\n");
  const decisions = (codeStr.match(/\b(if|elif|else if|case|while|for|catch|except|&&|\|\|)\b/g) ?? []).length;
  const cyclomatic = 1 + decisions;

  // Functions
  const funcRe = lang === "python" ? /\bdef\s+\w+/g : lang === "go" ? /\bfunc\s+\w+/g : /\bfunction\s+\w+/g;
  const functions = (codeStr.match(funcRe) ?? []).length;

  // Max nesting (indentation-based)
  let maxNesting = 0;
  let prevIndent = 0;
  let curNesting = 0;
  for (const line of lines) {
    if (line.trim() === "") continue;
    const indent = indentOf(line);
    if (indent > prevIndent) curNesting += 1;
    else if (indent < prevIndent) curNesting = Math.max(0, curNesting - 1);
    if (curNesting > maxNesting) maxNesting = curNesting;
    prevIndent = indent;
  }

  // Duplicates (very crude: lines that appear >1 time, excluding blank/comment lines)
  const seen = new Map<string, number>();
  for (const line of lines) {
    const t = stripStrings(stripTrailingComment(line, lang)).trim();
    if (!t || isCommentLine(line, lang)) continue;
    if (t.length < 8) continue;
    seen.set(t, (seen.get(t) ?? 0) + 1);
  }
  const duplicates = Array.from(seen.values()).filter((v) => v > 1).reduce((a, b) => a + (b - 1), 0);

  return { cyclomatic, lines: nonBlank, functions, maxNesting, duplicates };
}

// ---------- Smell detection ----------

export function detectCodeSmells(code: string, lang: Language): Smell[] {
  const out: Smell[] = [];
  const lines = linesOf(code);
  const cleaned = lines.map((l) => stripStrings(stripTrailingComment(l, lang)));

  // 1. Long method / function detection — find function bodies over 30 lines
  const funcStartRe = lang === "python"
    ? /^(\s*)def\s+(\w+)\s*\(/ 
    : lang === "go"
      ? /^(\s*)func\s+(\w+)\s*\(/
      : /^(\s*)(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(/;
  for (let i = 0; i < lines.length; i++) {
    const m = cleaned[i].match(funcStartRe);
    if (!m) continue;
    const baseIndent = m[1].length;
    const fnName = m[2];
    // Find end of function (Python: dedent; brace langs: matching close brace)
    let endLine = i;
    if (lang === "python") {
      for (let j = i + 1; j < lines.length; j++) {
        const ln = lines[j];
        if (ln.trim() === "") continue;
        if (indentOf(ln) <= baseIndent && ln.trim() !== "") {
          endLine = j - 1;
          break;
        }
        endLine = j;
      }
    } else {
      let depth = 0;
      let sawOpen = false;
      for (let j = i; j < lines.length; j++) {
        for (const ch of cleaned[j]) {
          if (ch === "{") { depth += 1; sawOpen = true; }
          else if (ch === "}") depth -= 1;
        }
        if (sawOpen && depth === 0) { endLine = j; break; }
      }
    }
    const length = endLine - i + 1;
    if (length > 30) {
      const smellType: SmellType = lang === "python" || lang === "go" ? "long-function" : "long-method";
      out.push({
        type: smellType,
        severity: length > 60 ? "error" : "warning",
        line: i + 1,
        endLine: endLine + 1,
        description: `Function ${fnName} is ${length} lines long. Long functions are hard to read, test, and reuse.`,
        suggestedRefactoring: "extract-function",
        deterministic: true,
      });
    }
  }

  // 2. Deep nesting detection
  let curNesting = 0;
  let prevIndent = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || isCommentLine(line, lang)) continue;
    const indent = indentOf(line);
    if (indent > prevIndent) curNesting += 1;
    else if (indent < prevIndent) curNesting = Math.max(0, curNesting - 1);
    if (curNesting > 4) {
      out.push({
        type: "deep-nesting",
        severity: "warning",
        line: i + 1,
        description: `Nested ${curNesting} levels deep — flatten with guard clauses or extract a helper function.`,
        suggestedRefactoring: "replace-nested-conditional-with-guard-clauses",
        deterministic: true,
      });
    }
    prevIndent = indent;
  }

  // 3. Magic numbers — outside of declarations and obvious contexts
  for (let i = 0; i < lines.length; i++) {
    const line = cleaned[i];
    if (isCommentLine(line, lang)) continue;
    // Look for bare numbers (not 0, 1, -1) used as literals
    const m = line.match(/(?<![\w.])([2-9]\d{1,}|[1-9]\d{2,}|0\.\d+|[1-9]\d*\.\d+)\b/);
    if (m && m[1]) {
      const num = m[1];
      // Skip if it's in a constant declaration (const X = 42; etc.)
      if (/^\s*(const|static|final|var|let|int|long|double|float)\s+\w+\s*=/.test(line.trim())) continue;
      out.push({
        type: "magic-number",
        severity: "info",
        line: i + 1,
        description: `Magic number ${num} — consider extracting to a named constant for clarity.`,
        suggestedRefactoring: "replace-magic-number-with-symbolic-constant",
        deterministic: true,
      });
    }
  }

  // 4. Long parameter list
  const paramRe = lang === "python"
    ? /\bdef\s+\w+\s*\(([^)]+)\)/
    : lang === "go"
      ? /\bfunc\s+\w+\s*\(([^)]+)\)/
      : /\bfunction\s+\w+\s*\(([^)]+)\)/;
  for (let i = 0; i < lines.length; i++) {
    const line = cleaned[i];
    const m = line.match(paramRe);
    if (!m) continue;
    const params = m[1].split(",").map((p) => p.trim()).filter(Boolean);
    if (params.length > 4) {
      out.push({
        type: "long-parameter-list",
        severity: "warning",
        line: i + 1,
        description: `Function takes ${params.length} parameters — consider grouping some into a parameter object.`,
        suggestedRefactoring: "introduce-parameter-object",
        deterministic: true,
      });
    }
  }

  // 5. Switch statement smell
  for (let i = 0; i < lines.length; i++) {
    const line = cleaned[i];
    if (/^\s*switch\s*\(/.test(line)) {
      const caseCount = lines.slice(i, i + 30).filter((l) => /^\s*case\s+/.test(l)).length;
      if (caseCount >= 3) {
        out.push({
          type: "switch-statement",
          severity: "warning",
          line: i + 1,
          description: `Switch with ${caseCount} cases — consider replacing with the Strategy or State pattern.`,
          suggestedRefactoring: "replace-conditional-with-strategy",
          suggestedPattern: "strategy",
          deterministic: true,
        });
      }
    }
  }

  // 6. Long if/else-if chain
  for (let i = 0; i < lines.length; i++) {
    const line = cleaned[i];
    if (/^\s*if\s*\(/.test(line) || /^\s*if\s+\w+/.test(line)) {
      let elseIfCount = 0;
      for (let j = i + 1; j < Math.min(i + 60, lines.length); j++) {
        const ln = cleaned[j];
        if (/^\s*else\s+if\s*\(/.test(ln) || /^\s*elif\s+/.test(ln)) elseIfCount += 1;
        else if (/^\s*else\b/.test(ln)) break;
        else if (/^\s*if\s*\(/.test(ln) || /^\s*def\s+/.test(ln) || /^\s*function\s+/.test(ln) || /^\s*func\s+/.test(ln)) break;
      }
      if (elseIfCount >= 3) {
        out.push({
          type: "switch-statement",
          severity: "info",
          line: i + 1,
          description: `If/else-if chain with ${elseIfCount}+ branches — consider Strategy, State, or a lookup table.`,
          suggestedRefactoring: "replace-conditional-with-strategy",
          suggestedPattern: "strategy",
          deterministic: true,
        });
      }
    }
  }

  // 7. Duplicated code (line-level, very crude)
  const seen = new Map<string, number[]>();
  for (let i = 0; i < lines.length; i++) {
    const t = cleaned[i].trim();
    if (!t || isCommentLine(t, lang) || t.length < 12) continue;
    if (!seen.has(t)) seen.set(t, []);
    seen.get(t)!.push(i + 1);
  }
  for (const [text, lineNos] of seen) {
    if (lineNos.length > 1) {
      out.push({
        type: "duplicated-code",
        severity: "warning",
        line: lineNos[0],
        description: `Identical line appears ${lineNos.length} times (L${lineNos.join(", L")}). Consider extracting to a shared function: "${text.slice(0, 60)}${text.length > 60 ? "…" : ""}"`,
        suggestedRefactoring: "extract-function",
        deterministic: true,
      });
    }
  }

  // 8. Comments as deodorizer — long comments before smelly code
  for (let i = 0; i < lines.length; i++) {
    if (!isCommentLine(lines[i], lang)) continue;
    // count consecutive comment lines
    let j = i;
    while (j < lines.length && isCommentLine(lines[j], lang)) j += 1;
    const commentLen = j - i;
    if (commentLen >= 4) {
      out.push({
        type: "comments-as-deodorizer",
        severity: "info",
        line: i + 1,
        endLine: j,
        description: `${commentLen}-line comment block — a comment this long often signals code that needs refactoring, not explaining.`,
        suggestedRefactoring: "extract-function",
        deterministic: false,
      });
    }
    i = j - 1;
  }

  // 9. God class detection — class with many methods
  const classRe = /^\s*(?:export\s+)?(?:abstract\s+)?class\s+(\w+)/;
  for (let i = 0; i < lines.length; i++) {
    const m = cleaned[i].match(classRe);
    if (!m) continue;
    const className = m[1];
    // Find class body length (Python: indent; brace: matching brace)
    let endLine = i;
    if (lang === "python") {
      const baseIndent = indentOf(lines[i]);
      for (let j = i + 1; j < lines.length; j++) {
        const ln = lines[j];
        if (ln.trim() === "") continue;
        if (indentOf(ln) <= baseIndent && ln.trim() !== "") { endLine = j - 1; break; }
        endLine = j;
      }
    } else {
      let depth = 0;
      let sawOpen = false;
      for (let j = i; j < lines.length; j++) {
        for (const ch of cleaned[j]) {
          if (ch === "{") { depth += 1; sawOpen = true; }
          else if (ch === "}") depth -= 1;
        }
        if (sawOpen && depth === 0) { endLine = j; break; }
      }
    }
    const classBody = cleaned.slice(i, endLine + 1).join("\n");
    const methodCount = (classBody.match(/\b(?:function\s+\w+|def\s+\w+|func\s+\w+|\w+\s*\([^)]*\)\s*\{)/g) ?? []).length;
    if (methodCount > 15) {
      out.push({
        type: "god-class",
        severity: "error",
        line: i + 1,
        endLine: endLine + 1,
        description: `Class ${className} has ${methodCount} methods — splitting into smaller cohesive classes will improve maintainability.`,
        suggestedRefactoring: "extract-class",
        deterministic: true,
      });
    }
    if (endLine - i + 1 > 200) {
      out.push({
        type: "large-class",
        severity: "warning",
        line: i + 1,
        endLine: endLine + 1,
        description: `Class ${className} is ${endLine - i + 1} lines long — consider splitting.`,
        suggestedRefactoring: "extract-class",
        deterministic: true,
      });
    }
  }

  // Sort by line
  const sevRank: Record<Severity, number> = { critical: 0, error: 1, warning: 2, info: 3 };
  out.sort((a, b) => a.line - b.line || sevRank[a.severity] - sevRank[b.severity]);
  return out;
}

// ---------- Refactoring application ----------

/**
 * Apply a single suggested refactoring to produce a before/after snippet.
 * Best-effort and template-based — NOT guaranteed to preserve behavior.
 */
export function applyRefactoring(
  code: string,
  lang: Language,
  refactoring: RefactoringType,
  smell?: Smell,
): { before: string; after: string; safe: boolean } {
  const lines = linesOf(code);
  const startLine = smell?.line ?? 1;

  switch (refactoring) {
    case "replace-magic-number-with-symbolic-constant": {
      // Find the magic number on the smell line and replace all occurrences
      if (!smell) return { before: code, after: code, safe: true };
      const line = lines[startLine - 1] ?? "";
      const m = line.match(/(?<![\w.])([2-9]\d{2,}|[1-9]\d{2,}|0\.\d+|[1-9]\d*\.\d+)\b/);
      if (!m) return { before: code, after: code, safe: true };
      const num = m[1];
      const constName = `CONST_${num.replace(/[.\s]/g, "_").toUpperCase()}`;
      const constDecl = (lang === "python" || lang === "go")
        ? `${constName} = ${num}\n`
        : `const ${constName} = ${num};\n`;
      const newCode = code.split("\n").map((l) => l.split(num).join(constName)).join("\n");
      return {
        before: code,
        after: constDecl + newCode,
        safe: true,
      };
    }

    case "replace-nested-conditional-with-guard-clauses": {
      // Find a region of deeply-nested if/else and convert to guard clauses
      // Best-effort: only handle simple cases (3+ levels of if-nesting)
      if (!smell) return { before: code, after: code, safe: false };
      const idx = startLine - 1;
      // Find the start of the nested block — walk back to find the outermost if
      let outerIfIdx = idx;
      const targetIndent = indentOf(lines[idx]);
      for (let i = idx; i >= 0; i--) {
        if (/^\s*if\s/.test(lines[i]) && indentOf(lines[i]) < targetIndent) {
          outerIfIdx = i;
          break;
        }
      }
      const beforeSnippet = lines.slice(outerIfIdx, idx + 5).join("\n");
      // We don't actually transform — we explain the recommended change
      return {
        before: beforeSnippet,
        after: [
          "// Refactor: replace nested ifs with guard clauses (return early on the negative condition).",
          "// BEFORE: if (x) { if (y) { if (z) { doWork(); } } }",
          "// AFTER:  if (!x) return; if (!y) return; if (!z) return; doWork();",
          "// Apply this transformation manually — the tool cannot prove behavior preservation.",
        ].join("\n"),
        safe: false,
      };
    }

    case "extract-function": {
      if (!smell) return { before: code, after: code, safe: false };
      // For long methods, suggest splitting at a blank line within the body
      const idx = startLine - 1;
      const endLine = smell.endLine ?? idx + 20;
      const body = lines.slice(idx, endLine);
      // Find a mid-body blank line as a split point
      let splitAt = -1;
      for (let i = 5; i < body.length - 5; i++) {
        if (body[i].trim() === "") { splitAt = i; break; }
      }
      if (splitAt < 0) {
        return {
          before: body.join("\n"),
          after: [
            "// Suggestion: extract the second half of this function into a named helper.",
            "// The tool cannot determine a safe split point automatically — pick one based on logical cohesion.",
            "// Example: extract function doSecondHalf() { ... } and call it from the original function.",
          ].join("\n"),
          safe: false,
        };
      }
      const part1 = body.slice(0, splitAt).join("\n");
      const part2 = body.slice(splitAt + 1).join("\n");
      const fnKeyword = lang === "python" ? "def" : lang === "go" ? "func" : "function";
      const helperName = "extractedHelper";
      const callLine = lang === "python" || lang === "go"
        ? `    ${helperName}()`
        : `  ${helperName}();`;
      const helperSig = lang === "python"
        ? `def ${helperName}():`
        : lang === "go"
          ? `func ${helperName}() {`
          : `function ${helperName}() {`;
      const helperClose = (lang === "python" || lang === "go") ? "" : "}";
      return {
        before: body.join("\n"),
        after: [
          part1,
          callLine,
          "",
          helperSig,
          part2,
          helperClose,
        ].filter(Boolean).join("\n"),
        safe: false,
      };
    }

    case "replace-conditional-with-strategy": {
      // Detect an if/else-if chain or switch on a value, and propose the Strategy pattern
      if (!smell) return { before: code, after: code, safe: false };
      const idx = startLine - 1;
      const block = lines.slice(idx, Math.min(idx + 20, lines.length)).join("\n");
      const after = [
        "// Refactor: replace the conditional with the Strategy pattern.",
        "// 1. Define a Strategy interface with a single method (e.g., apply(...)).",
        "// 2. Implement one Strategy class per branch (BookStrategy, ElectronicsStrategy, ...).",
        "// 3. Register strategies in a Map keyed by the discriminator value.",
        "// 4. Replace the conditional with: const strategy = strategies.get(type) ?? defaultStrategy;",
        "//    return strategy.apply(qty, price);",
        "",
        "// BEFORE:",
        "// if (type === 'book') { discount = 0.10; } else if (type === 'electronics') { ... } ...",
        "// AFTER:",
        "// interface DiscountStrategy { apply(qty: number, price: number): number; }",
        "// const strategies: Record<string, DiscountStrategy> = {",
        "//   book: new PercentOffStrategy(0.10),",
        "//   electronics: new PercentOffStrategy(0.05),",
        "// };",
      ].join("\n");
      return { before: block, after, safe: false };
    }

    case "introduce-parameter-object": {
      if (!smell) return { before: code, after: code, safe: false };
      const line = lines[startLine - 1] ?? "";
      const before = line;
      const after = [
        "// Refactor: group related parameters into a single parameter object.",
        "// BEFORE: function calculate(type, qty, price, taxRate, discount) { ... }",
        "// AFTER:",
        "// interface PricingInput { type: string; qty: number; price: number; taxRate: number; discount: number; }",
        "// function calculate(input: PricingInput) { ... }",
      ].join("\n");
      return { before, after, safe: false };
    }

    case "extract-class": {
      if (!smell) return { before: code, after: code, safe: false };
      const before = lines.slice(startLine - 1, (smell.endLine ?? startLine + 10)).join("\n");
      const after = [
        "// Refactor: split this class into smaller cohesive classes.",
        "// Identify groups of methods that work on the same subset of fields,",
        "// and extract each group into its own class. Delegate from the original.",
        "// Example: if the class has 'auth' methods and 'profile' methods,",
        "// extract a Profile class and an Auth class.",
      ].join("\n");
      return { before, after, safe: false };
    }

    default: {
      return {
        before: code,
        after: [
          `// Suggested refactoring: ${REFACTORING_LABELS[refactoring]}.`,
          "// The tool cannot safely auto-apply this refactoring — review and apply manually.",
          "// See the pattern catalog for templates you can adapt.",
        ].join("\n"),
        safe: false,
      };
    }
  }
}

/**
 * Suggest refactorings based on detected smells.
 */
export function suggestRefactorings(code: string, lang: Language, smells: Smell[]): Suggestion[] {
  const out: Suggestion[] = [];
  for (const smell of smells) {
    const refactoring = smell.suggestedRefactoring ?? "extract-function";
    const { before, after, safe } = applyRefactoring(code, lang, refactoring, smell);
    const title = `${SMELL_LABELS[smell.type]} → ${REFACTORING_LABELS[refactoring]}${smell.suggestedPattern ? ` (using ${PATTERN_LABELS[smell.suggestedPattern]})` : ""}`;
    const rationale = explainRefactoring(refactoring, smell);
    const tradeoffs = explainTradeoffs(refactoring);
    out.push({
      id: `s${out.length + 1}`,
      smell: smell.type,
      refactoring,
      pattern: smell.suggestedPattern,
      severity: smell.severity,
      startLine: smell.line,
      endLine: smell.endLine,
      title,
      rationale,
      tradeoffs,
      before,
      after,
      safe,
    });
  }
  return out;
}

export function explainRefactoring(refactoring: RefactoringType, smell?: Smell): string {
  switch (refactoring) {
    case "extract-function":
      return smell?.type === "duplicated-code"
        ? "Extracting the duplicated logic into a single named function removes the duplication — one place to fix bugs, one place to add features."
        : "Extracting a portion of the long function into a named helper improves readability, makes the intent explicit, and makes the helper independently testable.";
    case "replace-nested-conditional-with-guard-clauses":
      return "Replacing nested ifs with guard clauses (early returns for the negative case) flattens the structure and makes the happy path obvious. The reader sees the main flow at the top indentation level.";
    case "replace-conditional-with-strategy":
      return "Replacing a switch or if/else chain with the Strategy pattern turns each branch into its own class. Adding a new branch means adding a new class — no need to modify the conditional. This is the Open/Closed Principle in action.";
    case "introduce-parameter-object":
      return "Grouping related parameters into a single object reduces the parameter list, makes calls more readable, and makes future parameter additions non-breaking.";
    case "replace-magic-number-with-symbolic-constant":
      return "Naming a magic number makes its intent explicit and gives you a single place to change the value. Readers no longer have to guess what '0.10' means.";
    case "extract-class":
      return "Splitting a god class into smaller cohesive classes follows the Single Responsibility Principle. Each class becomes easier to understand, test, and change independently.";
    case "decompose-conditional":
      return "Replacing a complex conditional with named predicate functions makes the condition's intent obvious and the predicate reusable.";
    case "consolidate-conditional-expression":
      return "Combining a sequence of related conditions into a single expression (often with a named predicate) simplifies the control flow.";
    case "replace-temp-with-query":
      return "Replacing a temporary variable with a method call removes mutable state and makes the value available wherever the method is accessible.";
    case "introduce-null-object":
      return "Replacing null checks with a Null Object (a no-op implementation of the interface) removes conditional branches and removes the risk of NullPointerException.";
    default:
      return `The ${REFACTORING_LABELS[refactoring]} refactoring addresses ${smell ? SMELL_LABELS[smell.type] : "this smell"}. Review the before/after diff and apply manually if appropriate.`;
  }
}

export function explainTradeoffs(refactoring: RefactoringType): string {
  switch (refactoring) {
    case "extract-function":
      return "Tradeoff: more functions means more navigation between definitions. Use descriptive names; if the helper is trivial, inline it back.";
    case "replace-nested-conditional-with-guard-clauses":
      return "Tradeoff: multiple return points can make cleanup harder. If you have shared cleanup, use try/finally or extract a wrapper.";
    case "replace-conditional-with-strategy":
      return "Tradeoff: more classes and indirection. For 2-3 branches, a conditional is simpler. For 4+ branches that grow over time, Strategy pays off.";
    case "introduce-parameter-object":
      return "Tradeoff: callers must construct the object. If most callers pass all fields, the object adds friction; if they pass subsets, it helps.";
    case "replace-magic-number-with-symbolic-constant":
      return "Tradeoff: minimal — a named constant is almost always better. The only cost is finding a good name.";
    case "extract-class":
      return "Tradeoff: more classes means more files and more navigation. Aim for cohesion — each new class should have a single clear responsibility.";
    default:
      return "Tradeoff: review the diff and weigh the readability gain against the change in structure. The tool cannot prove behavior preservation — run your tests.";
  }
}

// ---------- Pattern suggestions ----------

export function suggestPatterns(smells: Smell[]): { pattern: PatternId; reason: string; relatedSmells: SmellType[] }[] {
  const out: { pattern: PatternId; reason: string; relatedSmells: SmellType[] }[] = [];
  const smellTypes = new Set(smells.map((s) => s.type));

  for (const entry of PATTERN_CATALOG) {
    const related = entry.relatedSmells.filter((s) => smellTypes.has(s));
    if (related.length === 0) continue;
    out.push({
      pattern: entry.id,
      reason: `Detected ${related.join(", ")} — the ${entry.name} pattern addresses this. ${entry.whenToUse}`,
      relatedSmells: related,
    });
  }
  return out;
}

// ---------- Diff ----------

export function computeDiff(before: string, after: string): DiffLine[] {
  const a = before.replace(/\r\n/g, "\n").split("\n");
  const b = after.replace(/\r\n/g, "\n").split("\n");
  const out: DiffLine[] = [];
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const x = a[i];
    const y = b[i];
    if (x === y) out.push({ type: "same", before: x, after: y });
    else {
      if (x !== undefined) out.push({ type: "removed", before: x });
      if (y !== undefined) out.push({ type: "added", after: y });
    }
  }
  return out;
}

// ---------- Apply-all safe refactorings ----------

export function applyAllSafeRefactorings(code: string, lang: Language): { fixed: string; applied: Suggestion[] } {
  const smells = detectCodeSmells(code, lang);
  const safeSmells = smells.filter((s) => s.suggestedRefactoring === "replace-magic-number-with-symbolic-constant");
  let current = code;
  const applied: Suggestion[] = [];
  for (const smell of safeSmells) {
    const { before, after, safe } = applyRefactoring(current, lang, smell.suggestedRefactoring!, smell);
    if (!safe) continue;
    if (before === after) continue;
    // Replace the magic number across the whole code
    current = after;
    applied.push({
      id: `auto-${applied.length + 1}`,
      smell: smell.type,
      refactoring: smell.suggestedRefactoring!,
      severity: smell.severity,
      startLine: smell.line,
      title: `${SMELL_LABELS[smell.type]} → ${REFACTORING_LABELS[smell.suggestedRefactoring!]}`,
      rationale: explainRefactoring(smell.suggestedRefactoring!, smell),
      tradeoffs: explainTradeoffs(smell.suggestedRefactoring!),
      before,
      after,
      safe: true,
      applied: true,
    });
  }
  return { fixed: current, applied };
}

// ---------- Top-level analyzer ----------

export function analyzeCode(code: string, lang: Language): RefactorResult {
  const smells = detectCodeSmells(code, lang);
  const suggestions = suggestRefactorings(code, lang, smells);
  const complexityBefore = computeComplexity(code, lang);
  const patternSuggestions = suggestPatterns(smells);
  const warnings: string[] = [];
  warnings.push("Refactoring suggestions are template-based and pattern detection is heuristic. The tool CANNOT prove behavior preservation — run your test suite after applying any suggestion.");
  if (smells.length === 0) warnings.push("No smells detected — this does NOT guarantee the code is well-designed. The tool only checks for the patterns it knows.");
  if (suggestions.some((s) => !s.safe)) warnings.push("Some suggestions are NOT auto-applied — review the before/after diff and apply manually.");
  warnings.push("The pattern catalog (right column) provides reference templates — copy and adapt them to your code.");
  warnings.push("The optional BYO-key LLM enhancement can refine suggestions using your own provider. Skip it for 100% offline use.");

  return {
    language: lang,
    smells,
    suggestions,
    complexityBefore,
    patternSuggestions,
    warnings,
  };
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

// ---------- Shareable URL ----------

export function buildShareUrl(language: Language, code: string, applied: string[] = []): string {
  const params = new URLSearchParams();
  params.set("lang", language);
  if (code) params.set("code", code);
  if (applied.length > 0) params.set("applied", applied.join(","));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  let clean = hash;
  if (clean.startsWith("#") || clean.startsWith("?")) clean = clean.slice(1);
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const lang = params.get("lang") as Language | null;
  const code = params.get("code") ?? undefined;
  const applied = params.get("applied") ?? undefined;
  return {
    language: lang && ALL_LANGUAGES.includes(lang) ? lang : undefined,
    code,
    applied,
  };
}

// ---------- Optional LLM enhancement ----------

export function buildLlmPrompt(code: string, lang: Language, smells: Smell[]): string {
  const lines = [
    `You are an expert ${LANGUAGE_LABELS[lang]} software architect. The following code was analyzed by a smell detector.`,
    "For each smell, propose a concrete refactoring with rationale. If a smell is a false positive, say so.",
    "Suggest design patterns from the GoF catalog when they fit. Be concise.",
    "",
    "Code:",
    "```" + lang,
    code,
    "```",
    "",
    "Detected smells:",
    ...smells.map((s) => `- Line ${s.line} [${s.severity}] ${SMELL_LABELS[s.type]}: ${s.description}`),
    "",
    "Output a JSON object with:",
    '- "overallSummary": string (2-3 sentence summary of code quality)',
    '- "suggestions": array of { "id": string (matching the suggestion id from "s1", "s2", ...), "rationale": string, "alternative": string (optional alternative refactoring) }',
    '- "overallNotes": array of strings (3-5 architectural notes)',
    "",
    "No markdown fences, no commentary — only the JSON object.",
  ];
  return lines.join("\n");
}

export function renderLlmResult(rawText: string): { ok: true; result: LlmExplanation } | { ok: false; error: string } {
  let s = (rawText || "").trim();
  if (s.startsWith("```")) {
    s = s.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  }
  let obj: unknown;
  try {
    obj = JSON.parse(s);
  } catch {
    return { ok: false, error: "Could not parse LLM output as JSON. Try again." };
  }
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    return { ok: false, error: "LLM output was not a JSON object." };
  }
  const o = obj as Record<string, unknown>;
  const overallSummary = typeof o.overallSummary === "string" ? o.overallSummary : "";
  const suggestionsArr = Array.isArray(o.suggestions) ? o.suggestions : [];
  const suggestions = suggestionsArr
    .filter((x): x is Record<string, unknown> => typeof x === "object" && x !== null)
    .map((x) => ({
      id: typeof x.id === "string" ? x.id : "",
      rationale: typeof x.rationale === "string" ? x.rationale : "",
      alternative: typeof x.alternative === "string" ? x.alternative : undefined,
    }));
  const overallNotes = Array.isArray(o.overallNotes)
    ? (o.overallNotes as unknown[]).filter((x) => typeof x === "string") as string[]
    : [];
  return { ok: true, result: { overallSummary, suggestions, overallNotes } };
}

// ---------- Honesty ----------

export function honestyNote(): string {
  return "Refactoring suggestions are template-based and pattern detection is heuristic. The tool CANNOT prove behavior preservation — always run your test suite after applying any suggestion. Smell detection reliably catches structural issues (long methods, deep nesting, magic numbers, duplicated lines, long parameter lists, switch statements). Pattern suggestions are best-effort and may not fit your specific context. The pattern catalog provides reference templates you can adapt — they are not custom-fit to your code. The optional BYO-key LLM enhancement uses your own API key and goes directly to your chosen provider — skip it for 100% offline use.";
}

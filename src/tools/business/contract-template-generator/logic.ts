/**
 * Contract Template Generator — pure logic.
 *
 * Generate common business contracts (NDA, freelance, service agreement,
 * MSA, SOW, etc.). Pure functions only — no DOM, no network.
 */

// ---- Types ----

export type ContractType =
  | "nda-mutual"
  | "nda-one-way"
  | "freelance"
  | "service-agreement"
  | "independent-contractor"
  | "consulting"
  | "msa-master-service"
  | "sow-statement-of-work";

export type ContractDuration =
  | "6-months"
  | "1-year"
  | "2-years"
  | "indefinite"
  | "project-based";

export type PaymentTerms =
  | "net-15"
  | "net-30"
  | "net-60"
  | "on-completion"
  | "milestone-based";

export interface ContractInput {
  contractType: ContractType;
  partyAName: string;
  partyAAddress: string;
  partyBName: string;
  partyBAddress: string;
  effectiveDate: string; // YYYY-MM-DD
  contractDuration: ContractDuration;
  projectDescription: string;
  compensationAmount: number;
  paymentTerms: PaymentTerms;
  governingState: string;
  additionalClauses: string;
}

export interface ContractSection {
  number: number;
  title: string;
  body: string;
}

export interface ContractStats {
  type: ContractType;
  typeLabel: string;
  duration: ContractDuration;
  durationLabel: string;
  effectiveDateLong: string;
  endDate: string;
  endDateLong: string;
  compensationFormatted: string;
  paymentTermsLabel: string;
  sectionCount: number;
  additionalClauseCount: number;
  hasMissing: boolean;
  missingFields: string[];
}

export interface ContractHistoryEntry {
  ts: number;
  contractType: ContractType;
  partyAName: string;
  partyBName: string;
  effectiveDate: string;
  sectionCount: number;
}

// ---- Constants / Presets ----

export const CONTRACT_TYPES: ContractType[] = [
  "nda-mutual",
  "nda-one-way",
  "freelance",
  "service-agreement",
  "independent-contractor",
  "consulting",
  "msa-master-service",
  "sow-statement-of-work",
];

export const CONTRACT_TYPE_LABELS: Record<ContractType, string> = {
  "nda-mutual": "NDA — Mutual",
  "nda-one-way": "NDA — One-Way",
  "freelance": "Freelance Agreement",
  "service-agreement": "Service Agreement",
  "independent-contractor": "Independent Contractor Agreement",
  "consulting": "Consulting Agreement",
  "msa-master-service": "MSA — Master Service Agreement",
  "sow-statement-of-work": "SOW — Statement of Work",
};

export const DURATIONS: ContractDuration[] = [
  "6-months",
  "1-year",
  "2-years",
  "indefinite",
  "project-based",
];

export const DURATION_LABELS: Record<ContractDuration, string> = {
  "6-months": "6 Months",
  "1-year": "1 Year",
  "2-years": "2 Years",
  "indefinite": "Indefinite",
  "project-based": "Project-Based",
};

export const PAYMENT_TERMS_LIST: PaymentTerms[] = [
  "net-15",
  "net-30",
  "net-60",
  "on-completion",
  "milestone-based",
];

export const PAYMENT_TERMS_LABELS: Record<PaymentTerms, string> = {
  "net-15": "Net 15 — payment due 15 days after invoice",
  "net-30": "Net 30 — payment due 30 days after invoice",
  "net-60": "Net 60 — payment due 60 days after invoice",
  "on-completion": "On Completion — due upon project completion",
  "milestone-based": "Milestone-Based — paid per milestone",
};

// ---- Format helpers ----

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** Format a YYYY-MM-DD date in long form: "July 13, 2026". */
export function formatDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr);
  if (!m) return dateStr;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return dateStr;
  return `${MONTH_NAMES[month - 1]} ${day}, ${year}`;
}

/** Add months to a UTC date, clamping the day to the last valid day of the
 * resulting month (e.g. Feb 29 + 1 year → Feb 28 in a non-leap year). */
function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const targetDay = d.getUTCDate();
  d.setUTCDate(1); // Avoid overflow when changing month.
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(targetDay, lastDay));
  return d;
}

/** Calculate the contract end date based on effective date and duration. */
export function calculateEndDate(effectiveDate: string, duration: ContractDuration): string {
  if (!effectiveDate) return "";
  if (duration === "indefinite" || duration === "project-based") return "";
  const d = new Date(effectiveDate + "T00:00:00Z");
  if (isNaN(d.getTime())) return "";
  let result: Date;
  if (duration === "6-months") {
    result = addMonthsUtc(d, 6);
  } else if (duration === "1-year") {
    result = addMonthsUtc(d, 12);
  } else if (duration === "2-years") {
    result = addMonthsUtc(d, 24);
  } else {
    return "";
  }
  return result.toISOString().slice(0, 10);
}

/** Format a compensation number as "$5,000.00 USD". */
export function formatCompensation(amount: number): string {
  if (!Number.isFinite(amount) || amount === 0) return "";
  const n = Math.abs(amount);
  const formatted = n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const sign = amount < 0 ? "-" : "";
  return `${sign}$${formatted} USD`;
}

/** Format payment terms in a human-readable form. */
export function formatPaymentTerms(terms: PaymentTerms): string {
  return PAYMENT_TERMS_LABELS[terms] ?? terms;
}

/** Parse additional clauses textarea — one clause per line. */
export function parseAdditionalClauses(text: string): string[] {
  if (!text) return [];
  return text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Combine boilerplate sections with additional clauses as new numbered sections. */
export function combineClauses(
  boilerplate: ContractSection[],
  additional: string[],
): ContractSection[] {
  const out = [...boilerplate];
  let next = boilerplate.length + 1;
  for (const clause of additional) {
    out.push({ number: next, title: "Additional Provision", body: clause });
    next++;
  }
  return out;
}

// ---- Section builders ----

function partiesSection(input: ContractInput): ContractSection {
  const eff = formatDateLong(input.effectiveDate) || input.effectiveDate || "[Effective Date]";
  const body = [
    `This ${CONTRACT_TYPE_LABELS[input.contractType]} (the "Agreement") is entered into and made effective as of ${eff} (the "Effective Date"), by and between:`,
    ``,
    `Party A: ${input.partyAName || "[Party A Name]"}`,
    input.partyAAddress ? `Address: ${input.partyAAddress.replace(/\n/g, ", ")}` : `Address: [Party A Address]`,
    ``,
    `and`,
    ``,
    `Party B: ${input.partyBName || "[Party B Name]"}`,
    input.partyBAddress ? `Address: ${input.partyBAddress.replace(/\n/g, ", ")}` : `Address: [Party B Address]`,
    ``,
    `Each of Party A and Party B may be referred to individually as a "Party" and collectively as the "Parties."`,
  ].join("\n");
  return { number: 1, title: "Parties and Effective Date", body };
}

function termSection(input: ContractInput): ContractSection {
  const eff = formatDateLong(input.effectiveDate) || "[Effective Date]";
  const end = calculateEndDate(input.effectiveDate, input.contractDuration);
  const endLong = end ? formatDateLong(end) : "";
  let body: string;
  if (input.contractDuration === "indefinite") {
    body = `The term of this Agreement shall commence on the Effective Date (${eff}) and shall continue indefinitely until terminated in accordance with Section ${0} (Termination).`;
  } else if (input.contractDuration === "project-based") {
    body = `The term of this Agreement shall commence on the Effective Date (${eff}) and shall continue until the project described herein has been completed and accepted by both Parties, or until earlier terminated in accordance with Section ${0} (Termination).`;
  } else {
    body = `The term of this Agreement shall commence on the Effective Date (${eff}) and shall continue for a period of ${DURATION_LABELS[input.contractDuration]}, ending on ${endLong || "[End Date]"}, unless earlier terminated in accordance with the Termination section.`;
  }
  return { number: 0, title: "Term", body };
}

function terminationSection(): ContractSection {
  const body = [
    `Either Party may terminate this Agreement for convenience upon thirty (30) days' prior written notice to the other Party.`,
    ``,
    `Either Party may terminate this Agreement immediately upon written notice if the other Party: (a) materially breaches this Agreement and fails to cure such breach within ten (10) days after receipt of written notice; (b) becomes insolvent, files for bankruptcy, or makes an assignment for the benefit of creditors; or (c) ceases to do business.`,
    ``,
    `Upon termination, each Party shall return or destroy all Confidential Information of the other Party in its possession, and any accrued but unpaid obligations shall become immediately due and payable.`,
  ].join("\n");
  return { number: 0, title: "Termination", body };
}

function governingLawSection(input: ContractInput): ContractSection {
  const state = input.governingState || "[Governing State]";
  const body = [
    `This Agreement shall be governed by and construed in accordance with the laws of the State of ${state}, without regard to its conflict of law provisions.`,
    ``,
    `The Parties consent to the exclusive jurisdiction and venue of the state and federal courts located in ${state} for any dispute arising out of or relating to this Agreement.`,
  ].join("\n");
  return { number: 0, title: "Governing Law and Jurisdiction", body };
}

function miscellaneousSection(): ContractSection {
  const body = [
    `Entire Agreement. This Agreement, including any exhibits or attachments, constitutes the entire agreement between the Parties regarding its subject matter and supersedes all prior or contemporaneous understandings.`,
    ``,
    `Amendment. No amendment or modification of this Agreement shall be valid unless in writing and signed by both Parties.`,
    ``,
    `Assignment. Neither Party may assign this Agreement without the prior written consent of the other Party, except in connection with a merger, acquisition, or sale of all or substantially all of its assets.`,
    ``,
    `Notices. All notices under this Agreement shall be in writing and sent to the addresses set forth above, or as otherwise designated in writing.`,
    ``,
    `Severability. If any provision of this Agreement is held invalid or unenforceable, the remaining provisions shall remain in full force and effect.`,
    ``,
    `Counterparts. This Agreement may be executed in counterparts, each of which shall be deemed an original and all of which together shall constitute one instrument.`,
  ].join("\n");
  return { number: 0, title: "Miscellaneous", body };
}

function ndaConfidentialitySection(mutual: boolean): ContractSection {
  const body = mutual ? [
    `For purposes of this Agreement, "Confidential Information" means any non-public information disclosed by either Party to the other that is marked as confidential or that a reasonable person would understand to be confidential, including trade secrets, business plans, customer information, financial data, and technical information.`,
    ``,
    `Each Party (as "Receiving Party") agrees to: (a) hold the Confidential Information of the other Party (as "Disclosing Party") in strict confidence; (b) use such Confidential Information solely for the purpose of evaluating or pursuing a potential business relationship; (c) not disclose such Confidential Information to any third party without prior written consent; and (d) protect such Confidential Information using at least the same degree of care it uses to protect its own confidential information, but no less than a reasonable degree of care.`,
    ``,
    `The obligations under this Section shall not apply to information that: (a) is or becomes publicly available without breach of this Agreement; (b) was known to the Receiving Party prior to disclosure; (c) is independently developed without reference to the Confidential Information; or (d) is rightfully received from a third party without a duty of confidentiality.`,
    ``,
    `Upon the Disclosing Party's request, the Receiving Party shall promptly return or destroy all Confidential Information in its possession or control and certify such return or destruction in writing.`,
    ``,
    `The confidentiality obligations set forth in this Agreement shall survive for a period of three (3) years following the termination of this Agreement.`,
  ].join("\n") : [
    `For purposes of this Agreement, "Confidential Information" means any non-public information disclosed by Party A to Party B that is marked as confidential or that a reasonable person would understand to be confidential, including trade secrets, business plans, customer information, financial data, and technical information.`,
    ``,
    `Party B (as "Receiving Party") agrees to: (a) hold the Confidential Information of Party A (as "Disclosing Party") in strict confidence; (b) use such Confidential Information solely for the purpose of evaluating or pursuing a potential business relationship with Party A; (c) not disclose such Confidential Information to any third party without prior written consent; and (d) protect such Confidential Information using at least the same degree of care it uses to protect its own confidential information, but no less than a reasonable degree of care.`,
    ``,
    `The obligations under this Section shall not apply to information that: (a) is or becomes publicly available without breach of this Agreement; (b) was known to Party B prior to disclosure; (c) is independently developed without reference to the Confidential Information; or (d) is rightfully received from a third party without a duty of confidentiality.`,
    ``,
    `Upon Party A's request, Party B shall promptly return or destroy all Confidential Information in its possession or control and certify such return or destruction in writing.`,
    ``,
    `The confidentiality obligations set forth in this Agreement shall survive for a period of three (3) years following the termination of this Agreement.`,
  ].join("\n");
  return { number: 0, title: "Confidential Information", body };
}

function scopeOfServicesSection(input: ContractInput): ContractSection {
  const desc = input.projectDescription?.trim() || "[Insert detailed description of services, deliverables, milestones, and acceptance criteria]";
  const body = [
    `Party B shall perform the services described below (the "Services") in a professional and workmanlike manner, using personnel with appropriate skill and experience.`,
    ``,
    `Scope of Services:`,
    desc,
    ``,
    `Any change to the scope of Services must be agreed upon in writing by both Parties as a Change Order, which shall reference this Agreement and describe the changed scope, schedule, and any adjustment to compensation.`,
  ].join("\n");
  return { number: 0, title: "Scope of Services", body };
}

function compensationSection(input: ContractInput): ContractSection {
  const comp = formatCompensation(input.compensationAmount);
  const compStr = comp || "[Insert compensation amount]";
  const termsStr = formatPaymentTerms(input.paymentTerms);
  const body = [
    `In consideration for the Services performed under this Agreement, Party A shall pay Party B the total amount of ${compStr}.`,
    ``,
    `Payment Terms: ${termsStr}.`,
    ``,
    `Party B shall submit invoices to Party A for services rendered. Each invoice shall describe the services performed, the period covered, and the amount due. Party A shall pay all undisputed invoices in accordance with the payment terms above.`,
    ``,
    `Party B is responsible for all taxes, withholdings, and similar obligations associated with the compensation paid hereunder.`,
  ].join("\n");
  return { number: 0, title: "Compensation and Payment", body };
}

function independentContractorSection(): ContractSection {
  const body = [
    `Party B is an independent contractor and not an employee, agent, partner, or joint venturer of Party A. Nothing in this Agreement shall be construed to create an employment, agency, partnership, or joint venture relationship between the Parties.`,
    ``,
    `Party B shall be solely responsible for: (a) paying all federal, state, and local income and self-employment taxes; (b) obtaining any required business licenses or permits; (c) providing its own tools, equipment, and workspace (except as otherwise agreed in writing); and (d) determining the means and methods by which the Services are performed.`,
    ``,
    `Party B shall not be entitled to any benefits provided by Party A to its employees, including health insurance, retirement benefits, or paid time off.`,
  ].join("\n");
  return { number: 0, title: "Independent Contractor Status", body };
}

function intellectualPropertySection(): ContractSection {
  const body = [
    `All work product, deliverables, and inventions created by Party B specifically for Party A under this Agreement (the "Work Product") shall be deemed "work made for hire" owned by Party A, to the fullest extent permitted by law.`,
    ``,
    `To the extent any Work Product does not qualify as a work made for hire, Party B hereby assigns to Party A all right, title, and interest, including all intellectual property rights, in and to the Work Product, upon creation.`,
    ``,
    `Party B retains all rights to any pre-existing materials, methodologies, or know-how used in performing the Services ("Background IP"). Party A is granted a non-exclusive, royalty-free, perpetual, worldwide license to use any Background IP incorporated into the Work Product.`,
    ``,
    `Party B warrants that the Work Product does not infringe the intellectual property rights of any third party.`,
  ].join("\n");
  return { number: 0, title: "Intellectual Property", body };
}

function warrantiesSection(): ContractSection {
  const body = [
    `Party B warrants that: (a) the Services will be performed in a professional and workmanlike manner consistent with industry standards; (b) it has the necessary skill, experience, and authority to perform the Services; (c) the Work Product will not infringe the rights of any third party; and (d) it will comply with all applicable laws and regulations.`,
    ``,
    `EXCEPT AS EXPRESSLY SET FORTH IN THIS AGREEMENT, PARTY B DISCLAIMS ALL OTHER WARRANTIES, EXPRESS OR IMPLIED, INCLUDING ANY IMPLIED WARRANTIES OF MERCHANTABILITY OR FITNESS FOR A PARTICULAR PURPOSE.`,
    ``,
    `Each Party (the "Indemnifying Party") shall indemnify, defend, and hold harmless the other Party and its officers, directors, employees, and agents from and against any third-party claims, damages, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or relating to: (a) the Indemnifying Party's breach of this Agreement; (b) the Indemnifying Party's negligence or willful misconduct; or (c) any allegation that the Indemnifying Party's materials infringe the rights of a third party.`,
  ].join("\n");
  return { number: 0, title: "Warranties and Indemnification", body };
}

function msaSpecificSections(): ContractSection[] {
  return [
    {
      number: 0,
      title: "Statements of Work",
      body: [
        `This Agreement establishes the general terms under which Party A may engage Party B to perform services. Specific services, deliverables, schedules, and fees shall be set forth in one or more mutually-signed Statements of Work ("SOWs") that reference this Agreement.`,
        ``,
        `In the event of any conflict between this Agreement and a SOW, the terms of the SOW shall control with respect to the subject matter of that SOW.`,
      ].join("\n"),
    },
    {
      number: 0,
      title: "Change Orders",
      body: [
        `Any change to a SOW (including scope, schedule, or fees) must be documented in a written Change Order signed by both Parties.`,
        ``,
        `No work outside the scope of a SOW shall be performed until a Change Order is signed, unless Party A expressly authorizes such work in writing.`,
      ].join("\n"),
    },
    {
      number: 0,
      title: "Limitation of Liability",
      body: [
        `EXCEPT FOR (a) BREACH OF CONFIDENTIALITY OBLIGATIONS, (b) INFRINGEMENT OF INTELLECTUAL PROPERTY, (c) INDEMNIFICATION OBLIGATIONS, OR (d) A PARTY'S GROSS NEGLIGENCE OR WILLFUL MISCONDUCT, NEITHER PARTY SHALL BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, OR CONSEQUENTIAL DAMAGES, OR FOR ANY LOSS OF PROFITS, REVENUE, OR DATA, ARISING OUT OF OR RELATING TO THIS AGREEMENT.`,
        ``,
        `EXCEPT FOR THE EXCLUDED ITEMS ABOVE, EACH PARTY'S TOTAL LIABILITY UNDER THIS AGREEMENT SHALL NOT EXCEED THE TOTAL AMOUNTS PAID OR PAYABLE BY PARTY A TO PARTY B UNDER THIS AGREEMENT IN THE TWELVE (12) MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM.`,
      ].join("\n"),
    },
  ];
}

function sowSpecificSections(input: ContractInput): ContractSection[] {
  const desc = input.projectDescription?.trim() || "[Insert project description, objectives, and detailed scope]";
  const end = calculateEndDate(input.effectiveDate, input.contractDuration);
  const endLong = end ? formatDateLong(end) : "[Project Completion Date]";
  return [
    {
      number: 0,
      title: "Project Description and Scope",
      body: [
        `This Statement of Work ("SOW") is entered into pursuant to the Master Service Agreement between the Parties and incorporates by reference all terms of that Agreement. In the event of a conflict, this SOW controls with respect to its subject matter.`,
        ``,
        `Project Description:`,
        desc,
      ].join("\n"),
    },
    {
      number: 0,
      title: "Deliverables and Milestones",
      body: [
        `Party B shall deliver the following milestones to Party A:`,
        ``,
        `1. Milestone One — Initial draft / discovery — due within fourteen (14) days of the Effective Date.`,
        `2. Milestone Two — Revised draft / iteration — due within thirty (30) days of the Effective Date.`,
        `3. Milestone Three — Final deliverable — due on or before ${endLong}.`,
        ``,
        `Party A shall review each deliverable within five (5) business days of receipt and either accept or provide written change requests. A deliverable shall be deemed accepted if no written objection is received within ten (10) business days.`,
      ].join("\n"),
    },
    {
      number: 0,
      title: "Acceptance Criteria",
      body: [
        `Acceptance criteria for the final deliverable shall be defined in writing by the Parties prior to commencement of work. If no criteria are specified, the deliverable shall conform to industry-standard quality for the type of service provided.`,
        ``,
        `If a deliverable fails to meet acceptance criteria, Party B shall, at no additional cost, use reasonable efforts to correct the deficiencies within ten (10) business days and resubmit for acceptance.`,
      ].join("\n"),
    },
  ];
}

/** Build the sections for a contract based on its type. */
export function buildSections(input: ContractInput): ContractSection[] {
  const sections: ContractSection[] = [];
  const t = input.contractType;
  sections.push(partiesSection(input));

  if (t === "nda-mutual" || t === "nda-one-way") {
    sections.push(ndaConfidentialitySection(t === "nda-mutual"));
    sections.push(termSection(input));
    sections.push(terminationSection());
  } else if (t === "freelance" || t === "service-agreement" || t === "independent-contractor" || t === "consulting") {
    sections.push(scopeOfServicesSection(input));
    sections.push(compensationSection(input));
    sections.push(termSection(input));
    sections.push(independentContractorSection());
    sections.push(intellectualPropertySection());
    sections.push(warrantiesSection());
    sections.push(terminationSection());
  } else if (t === "msa-master-service") {
    sections.push(...msaSpecificSections());
    sections.push(compensationSection(input));
    sections.push(termSection(input));
    sections.push(independentContractorSection());
    sections.push(intellectualPropertySection());
    sections.push(warrantiesSection());
    sections.push(terminationSection());
  } else if (t === "sow-statement-of-work") {
    sections.push(...sowSpecificSections(input));
    sections.push(compensationSection(input));
    sections.push(termSection(input));
    sections.push(terminationSection());
  }

  sections.push(governingLawSection(input));
  sections.push(miscellaneousSection());

  // Re-number sections.
  return sections.map((s, i) => ({ ...s, number: i + 1 }));
}

/** Build full contract sections including additional clauses. */
export function buildFullSections(input: ContractInput): ContractSection[] {
  const boilerplate = buildSections(input);
  const additional = parseAdditionalClauses(input.additionalClauses);
  return combineClauses(boilerplate, additional);
}

// ---- Renderers ----

/** Render the contract as plain text. */
export function renderText(input: ContractInput): string {
  const sections = buildFullSections(input);
  const L: string[] = [];
  L.push(CONTRACT_TYPE_LABELS[input.contractType].toUpperCase());
  L.push("=".repeat(70));
  L.push("");
  for (const s of sections) {
    L.push(`${s.number}. ${s.title}`);
    L.push("-".repeat(70));
    L.push(s.body);
    L.push("");
  }
  L.push("");
  L.push(generateDisclaimer());
  L.push("");
  L.push("SIGNATURES");
  L.push("-".repeat(70));
  L.push("");
  L.push("By signing below, each Party acknowledges that it has read and agreed to this Agreement.");
  L.push("");
  L.push(`Party A: ${input.partyAName || "[Party A Name]"}`);
  L.push("");
  L.push("Signature: ____________________________");
  L.push("Name / Title: ____________________________");
  L.push("Date: ____________________________");
  L.push("");
  L.push(`Party B: ${input.partyBName || "[Party B Name]"}`);
  L.push("");
  L.push("Signature: ____________________________");
  L.push("Name / Title: ____________________________");
  L.push("Date: ____________________________");
  return L.join("\n");
}

/** Render the contract as markdown. */
export function renderMarkdown(input: ContractInput): string {
  const sections = buildFullSections(input);
  const L: string[] = [];
  L.push(`# ${CONTRACT_TYPE_LABELS[input.contractType]}`);
  L.push("");
  for (const s of sections) {
    L.push(`## ${s.number}. ${s.title}`);
    L.push("");
    L.push(s.body);
    L.push("");
  }
  L.push("---");
  L.push("");
  L.push(`> ${generateDisclaimer()}`);
  L.push("");
  L.push("## Signatures");
  L.push("");
  L.push("By signing below, each Party acknowledges that it has read and agreed to this Agreement.");
  L.push("");
  L.push(`**Party A: ${input.partyAName || "[Party A Name]"}**`);
  L.push("");
  L.push("- Signature: ____________________________");
  L.push("- Name / Title: ____________________________");
  L.push("- Date: ____________________________");
  L.push("");
  L.push(`**Party B: ${input.partyBName || "[Party B Name]"}**`);
  L.push("");
  L.push("- Signature: ____________________________");
  L.push("- Name / Title: ____________________________");
  L.push("- Date: ____________________________");
  return L.join("\n");
}

/** Render the contract as printable HTML with inline CSS. */
export function renderHtml(input: ContractInput): string {
  const sections = buildFullSections(input);
  const esc = (s: string) =>
    (s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const sectionHtml = sections
    .map(
      (s) =>
        `<section class="contract-section"><h2>${s.number}. ${esc(s.title)}</h2><div class="section-body">${esc(s.body).replace(/\n/g, "<br/>")}</div></section>`,
    )
    .join("");
  const title = esc(CONTRACT_TYPE_LABELS[input.contractType]);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>
<style>
  body{font-family:Georgia,"Times New Roman",serif;color:#1a1a1a;margin:48px auto;max-width:820px;line-height:1.6;font-size:14px}
  h1{font-size:24px;text-align:center;margin:0 0 6px;letter-spacing:.05em}
  hr.divider{border:none;border-top:1px solid #ccc;margin:8px 0 24px}
  .contract-section{margin:24px 0}
  .contract-section h2{font-size:15px;margin:0 0 8px;font-weight:bold}
  .section-body{font-size:13px;color:#222}
  .disclaimer{margin:32px 0 24px;padding:12px 16px;background:#fff8e1;border-left:4px solid #f5a623;font-size:12px;color:#5a4500;font-style:italic}
  .signatures{margin-top:40px;padding-top:24px;border-top:1px solid #ccc}
  .sig-block{margin:24px 0;font-size:13px}
  .sig-block strong{font-size:14px}
  .sig-line{margin-top:18px;color:#444}
  @media print{body{margin:24px}button{display:none}}
</style></head><body>
<h1>${title}</h1>
<hr class="divider"/>
${sectionHtml}
<div class="disclaimer">${esc(generateDisclaimer())}</div>
<div class="signatures">
  <p>By signing below, each Party acknowledges that it has read and agreed to this Agreement.</p>
  <div class="sig-block">
    <strong>Party A: ${esc(input.partyAName || "[Party A Name]")}</strong>
    <div class="sig-line">Signature: ____________________________</div>
    <div class="sig-line">Name / Title: ____________________________</div>
    <div class="sig-line">Date: ____________________________</div>
  </div>
  <div class="sig-block">
    <strong>Party B: ${esc(input.partyBName || "[Party B Name]")}</strong>
    <div class="sig-line">Signature: ____________________________</div>
    <div class="sig-line">Name / Title: ____________________________</div>
    <div class="sig-line">Date: ____________________________</div>
  </div>
</div>
</body></html>`;
}

// ---- Summary stats ----

/** Compute summary stats for a contract. */
export function computeStats(input: ContractInput): ContractStats {
  const sections = buildFullSections(input);
  const missing = validateClauses(input);
  const end = calculateEndDate(input.effectiveDate, input.contractDuration);
  return {
    type: input.contractType,
    typeLabel: CONTRACT_TYPE_LABELS[input.contractType],
    duration: input.contractDuration,
    durationLabel: DURATION_LABELS[input.contractDuration],
    effectiveDateLong: formatDateLong(input.effectiveDate),
    endDate: end,
    endDateLong: end ? formatDateLong(end) : (input.contractDuration === "indefinite" ? "Indefinite" : input.contractDuration === "project-based" ? "On project completion" : ""),
    compensationFormatted: formatCompensation(input.compensationAmount) || "—",
    paymentTermsLabel: formatPaymentTerms(input.paymentTerms),
    sectionCount: sections.length,
    additionalClauseCount: parseAdditionalClauses(input.additionalClauses).length,
    hasMissing: missing.length > 0,
    missingFields: missing,
  };
}

// ---- Clause validator ----

/** Validate the contract input and return a list of missing required fields. */
export function validateClauses(input: ContractInput): string[] {
  const missing: string[] = [];
  if (!input.partyAName?.trim()) missing.push("Party A name");
  if (!input.partyBName?.trim()) missing.push("Party B name");
  if (!input.effectiveDate?.trim()) missing.push("Effective date");

  // SOW / freelance / service / consulting / independent contractor need a project description.
  const needsScope = [
    "freelance",
    "service-agreement",
    "independent-contractor",
    "consulting",
    "sow-statement-of-work",
  ].includes(input.contractType);
  if (needsScope && !input.projectDescription?.trim()) {
    missing.push("Project description (required for this contract type)");
  }

  // Compensation needed for everything except NDAs.
  const needsComp = !input.contractType.startsWith("nda-");
  if (needsComp && (!Number.isFinite(input.compensationAmount) || input.compensationAmount <= 0)) {
    missing.push("Compensation amount (required for non-NDA contracts)");
  }

  if (!input.governingState?.trim()) missing.push("Governing state");
  return missing;
}

// ---- Disclaimer generator ----

/** Generate the legal disclaimer appended to every contract. */
export function generateDisclaimer(): string {
  return "This document is a template generated for general informational purposes only and is not legal advice. The templates are starting points and may not address your specific situation or applicable jurisdiction. Have a qualified attorney licensed in your jurisdiction review any contract before signing. Use of this tool does not create an attorney-client relationship.";
}

// ---- Section counter ----

/** Count the number of sections in the rendered contract. */
export function countSections(input: ContractInput): number {
  return buildFullSections(input).length;
}

// ---- History (localStorage) ----

const HISTORY_KEY = "unqtools:contract-template-generator:history";
const HISTORY_MAX = 20;

export function loadHistory(): ContractHistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ContractHistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: ContractHistoryEntry): ContractHistoryEntry[] {
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

// ---- Shareable URL ----

export function buildShareUrl(input: Partial<ContractInput>): string {
  const params = new URLSearchParams();
  if (input.contractType) params.set("type", input.contractType);
  if (input.partyAName) params.set("pa", input.partyAName);
  if (input.partyAAddress) params.set("paa", input.partyAAddress);
  if (input.partyBName) params.set("pb", input.partyBName);
  if (input.partyBAddress) params.set("pbb", input.partyBAddress);
  if (input.effectiveDate) params.set("eff", input.effectiveDate);
  if (input.contractDuration) params.set("dur", input.contractDuration);
  if (input.projectDescription) params.set("desc", input.projectDescription);
  if (Number.isFinite(input.compensationAmount) && input.compensationAmount !== 0) {
    params.set("comp", String(input.compensationAmount));
  }
  if (input.paymentTerms) params.set("pt", input.paymentTerms);
  if (input.governingState) params.set("st", input.governingState);
  if (input.additionalClauses) params.set("add", input.additionalClauses);
  if (typeof window === "undefined") return `#${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): Partial<ContractInput> {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const out: Partial<ContractInput> = {};
  const type = params.get("type") as ContractType | null;
  if (type && CONTRACT_TYPES.includes(type)) out.contractType = type;
  if (params.get("pa")) out.partyAName = params.get("pa")!;
  if (params.get("paa")) out.partyAAddress = params.get("paa")!;
  if (params.get("pb")) out.partyBName = params.get("pb")!;
  if (params.get("pbb")) out.partyBAddress = params.get("pbb")!;
  if (params.get("eff")) out.effectiveDate = params.get("eff")!;
  const dur = params.get("dur") as ContractDuration | null;
  if (dur && DURATIONS.includes(dur)) out.contractDuration = dur;
  if (params.get("desc")) out.projectDescription = params.get("desc")!;
  const comp = params.get("comp");
  if (comp !== null) {
    const n = Number(comp);
    if (Number.isFinite(n)) out.compensationAmount = n;
  }
  const pt = params.get("pt") as PaymentTerms | null;
  if (pt && PAYMENT_TERMS_LIST.includes(pt)) out.paymentTerms = pt;
  if (params.get("st")) out.governingState = params.get("st")!;
  if (params.get("add")) out.additionalClauses = params.get("add")!;
  return out;
}

import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "contract-template-generator",
  name: "Contract Template Generator",
  description:
    "Generate common business contract templates — NDA (mutual/one-way), freelance, service agreement, independent contractor, consulting, MSA and SOW. Substitute party names, dates, compensation, payment terms and additional clauses. Render as printable HTML, plain text or markdown. 18 extra features: 8 contract type templates, 5 duration presets, 5 payment term presets, effective-date formatter, end-date calculator, compensation formatter, payment-terms formatter, additional-clause combiner, text/HTML/markdown renderers, section counter, clause validator, disclaimer generator, summary stats, history (localStorage), shareable URL. 100% client-side.",
  category: "business",
  keywords: [
    "contract", "contract template", "nda",
    "non-disclosure agreement", "freelance contract",
    "service agreement", "independent contractor",
    "consulting agreement", "msa", "master service agreement",
    "sow", "statement of work", "legal template",
  ],
  icon: "file-signature",
  requiresNetwork: false,
  seo: {
    title: "Contract Template Generator — NDA, Freelance, MSA, SOW | UnQTools",
    faq: [
      {
        q: "How does the contract template generator work?",
        a: "Pick a contract type (NDA mutual/one-way, freelance, service agreement, independent contractor, consulting, MSA, or SOW), fill in party names and addresses, effective date, duration, optional compensation and payment terms, governing state, and any additional clauses (one per line). The tool substitutes your values into a structured template and renders it as printable HTML, plain text, or markdown that you can copy or download.",
      },
      {
        q: "Which contract types are supported?",
        a: "Eight types: (1) Mutual NDA, (2) One-Way NDA, (3) Freelance Agreement, (4) Service Agreement, (5) Independent Contractor Agreement, (6) Consulting Agreement, (7) Master Service Agreement (MSA), and (8) Statement of Work (SOW). Each comes with appropriate boilerplate sections like scope, compensation, IP, term, termination, and governing law.",
      },
      {
        q: "Can I add my own clauses?",
        a: "Yes. Use the additional-clauses textarea — one clause per line. Each non-empty line is appended to the contract as a numbered additional provision, after the standard boilerplate.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) 8 contract type templates with structured sections. (2) 5 contract duration presets (6-months, 1-year, 2-years, indefinite, project-based). (3) 5 payment term presets (Net 15/30/60, on-completion, milestone-based). (4) Effective-date formatter (long form: 'July 13, 2026'). (5) Contract end-date calculator. (6) Compensation formatter (currency). (7) Payment-terms human-readable formatter. (8) Additional-clause combiner. (9) Plain-text renderer. (10) Printable HTML renderer (inline CSS). (11) Markdown renderer. (12) Section counter. (13) Clause validator (warns on missing required fields). (14) Disclaimer generator ('not legal advice'). (15) Summary stats card. (16) History (localStorage, last 20). (17) Shareable URL (encoded in hash). (18) Copy + Download .txt + Download HTML + Download MD.",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All contract generation runs 100% locally in your browser. No data is uploaded. History is stored in localStorage on this device only.",
      },
    ],
  },
  status: "done",
};

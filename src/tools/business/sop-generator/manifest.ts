import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sop-generator",
  name: "SOP Generator",
  description:
    "Generate Standard Operating Procedure (SOP) documents — purpose, scope, roles & responsibilities, process steps, tools, troubleshooting, and references. Auto-calc next review date (1 year after last reviewed), sum total process duration, validate required fields, suggest SOP IDs by department, render as text / printable HTML / Markdown, and generate a one-page quick reference card. 18 extra features: roles parser, process step parser, tools list parser, troubleshooting parser, references parser, next-review-date calculator, total duration calculator, 8 department presets, SOP ID auto-suggester, multi-format renderers, quick reference card generator, copy + download .txt/.html/.md, history (localStorage), shareable URL, summary stats, required-field validator. 100% client-side.",
  category: "business",
  keywords: [
    "sop", "standard operating procedure", "sop generator",
    "sop template", "process documentation", "procedure",
    "work instructions", "operations manual", "playbook",
  ],
  icon: "clipboard-list",
  requiresNetwork: false,
  seo: {
    title: "SOP Generator — Standard Operating Procedure Maker | UnQTools",
    faq: [
      {
        q: "How does the SOP generator work?",
        a: "Enter the SOP title, ID, version, department, last reviewed date, purpose, and scope. Then add roles as `role,responsibility` per line, process steps as `step_number,action,duration_minutes` per line, tools (one per line), troubleshooting as `issue,solution` per line, and references (one per line). The tool auto-calculates the next review date (1 year after last reviewed), sums total process duration, validates required fields, and renders the SOP as text, printable HTML, or Markdown plus a one-page quick reference card.",
      },
      {
        q: "What format are the CSV-style fields in?",
        a: "Roles use `role,responsibility` per line (e.g. `Manager,Approves final deliverable`). Process steps use `step_number,action,duration_minutes` per line (e.g. `1,Gather requirements,30`). Troubleshooting uses `issue,solution` per line. Tools and references are one per line. The parsers strip surrounding quotes, skip blank lines, and report per-line errors for malformed rows.",
      },
      {
        q: "How is the next review date calculated?",
        a: "If you set the Last Reviewed date (YYYY-MM-DD), the tool auto-fills Next Review Date as exactly one year later. This keeps your SOP library on a predictable annual review cadence. You can still override it manually.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Roles parser (CSV: role, responsibility). (2) Process steps parser (CSV: step, action, duration). (3) Tools list parser. (4) Troubleshooting parser (CSV: issue, solution). (5) References parser. (6) Next review date calculator (+1 year). (7) Total process duration calculator. (8) Text SOP renderer. (9) Printable HTML SOP renderer (inline CSS). (10) Markdown SOP renderer. (11) Quick reference card generator (one-page summary). (12) Copy + Download .txt/.html/.md. (13) History (localStorage, last 20). (14) Shareable URL (encode inputs in hash). (15) Summary stats (step count, total duration, role count, tool count). (16) SOP ID auto-suggester (department + sequence). (17) Required field validator. (18) 8 department presets (Engineering, HR, Finance, Operations, Sales, Marketing, IT, Legal).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All SOP parsing, duration calculation, date math, and rendering happen 100% locally in your browser. History is stored in localStorage on this device only. Nothing is uploaded.",
      },
    ],
  },
  status: "done",
};

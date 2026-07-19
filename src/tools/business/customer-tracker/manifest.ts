import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "customer-tracker",
  name: "Customer Tracker",
  description:
    "Track customers and follow-ups — contact info, last-contact date, status, value. Compute days since last contact, total and average customer value, status breakdown, overdue follow-ups, and a follow-up priority list (oldest first). 100% client-side with email + phone validation, CSV/text export, history, and shareable URLs.",
  category: "business",
  keywords: [
    "customer tracker", "crm", "follow up",
    "customer relationship", "contact log", "customer value",
    "overdue follow up", "sales follow up", "customer status",
    "lead tracking", "churn tracking",
  ],
  icon: "users",
  requiresNetwork: false,
  seo: {
    title: "Customer Tracker — CRM Follow-ups, Status, Value | UnQTools",
    faq: [
      {
        q: "How does the customer tracker work?",
        a: "Enter customers one per line in the form name,email,phone,company,last_contact_date,status,value. The tool parses each row, validates email and phone formats, computes days since last contact, filters by status or overdue follow-ups, totals customer value, and produces a follow-up priority list sorted oldest-contact-first.",
      },
      {
        q: "What status types are supported?",
        a: "Five statuses: active, inactive, lead, churned, and prospect. Filter the customer list by any single status or view all. Status breakdown shows counts and total value per status.",
      },
      {
        q: "How is follow-up urgency classified?",
        a: "Customers not contacted in over 30 days are flagged urgent, 14–30 days are normal, and under 14 days are recent. Use the days-since-contact filter to surface only customers who need attention.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "(1) Customer parser with email + phone validation. (2) 5 status type presets (active, inactive, lead, churned, prospect). (3) Days-since-last-contact calculator. (4) Status filter. (5) Days-since-contact filter (overdue follow-ups). (6) Total customer value calculator. (7) Average value per customer. (8) Status breakdown counter. (9) Follow-up priority list (oldest first). (10) Text report grouped by status. (11) CSV export with days_since column. (12) Copy + Download .txt + Download CSV. (13) History (localStorage, last 20). (14) Shareable URL. (15) Summary stats (total customers, total value, avg value, status breakdown, overdue count). (16) Follow-up urgency classifier (urgent/normal/recent). (17) Email validator (basic regex). (18) Phone number formatter (normalize to +1-XXX-XXX-XXXX).",
      },
      {
        q: "Is my data sent anywhere?",
        a: "No. All parsing, filtering, and calculations run locally in your browser. History is stored in localStorage on this device only. Share links encode your inputs in the URL hash which never leaves the device unless you copy and send it yourself.",
      },
    ],
  },
  status: "done",
};

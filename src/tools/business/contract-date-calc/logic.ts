/**
 * Contract Date Calculator — pure logic.
 * Compute contract milestones, deadlines, notice periods from a start date.
 */

export interface ContractConfig {
  startDate: string; // ISO yyyy-mm-dd
  durationDays: number;
  noticePeriodDays: number;
  renewalLeadDays: number; // days before expiry to send renewal notice
  paymentNetDays: number; // invoice payment terms
  milestones: { label: string; offsetDays: number }[];
}

export interface Milestone {
  label: string;
  date: string;
  daysFromStart: number;
}

export interface ContractResult {
  startDate: string;
  endDate: string;
  noticeDate: string;       // last day to give notice of non-renewal
  renewalNoticeDate: string; // day to send renewal notice
  firstPaymentDate: string;
  milestones: Milestone[];
  errors: string[];
}

function parseISO(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? null : d;
}

function toISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, days: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + days);
  return r;
}

export function computeMilestones(config: ContractConfig): ContractResult {
  const errors: string[] = [];
  const start = parseISO(config.startDate);
  if (!start) errors.push("Start date must be in yyyy-mm-dd format");
  if (config.durationDays <= 0) errors.push("Duration must be positive");
  if (config.noticePeriodDays < 0) errors.push("Notice period cannot be negative");
  if (config.renewalLeadDays < 0) errors.push("Renewal lead days cannot be negative");
  if (config.paymentNetDays < 0) errors.push("Payment NET days cannot be negative");

  if (errors.length > 0 || !start) {
    return {
      startDate: config.startDate,
      endDate: "",
      noticeDate: "",
      renewalNoticeDate: "",
      firstPaymentDate: "",
      milestones: [],
      errors,
    };
  }

  const end = addDays(start, config.durationDays);
  const notice = addDays(end, -config.noticePeriodDays);
  const renewalNotice = addDays(end, -config.renewalLeadDays);
  const firstPayment = addDays(start, config.paymentNetDays);

  const milestones: Milestone[] = config.milestones.map((m) => ({
    label: m.label,
    daysFromStart: m.offsetDays,
    date: toISO(addDays(start, m.offsetDays)),
  }));

  return {
    startDate: toISO(start),
    endDate: toISO(end),
    noticeDate: toISO(notice),
    renewalNoticeDate: toISO(renewalNotice),
    firstPaymentDate: toISO(firstPayment),
    milestones,
    errors,
  };
}

export function toMarkdown(r: ContractResult): string {
  const lines = [
    "# Contract milestones",
    "",
    `- Start: ${r.startDate}`,
    `- End: ${r.endDate}`,
    `- Notice of non-renewal due: ${r.noticeDate}`,
    `- Renewal notice due: ${r.renewalNoticeDate}`,
    `- First payment due: ${r.firstPaymentDate}`,
    "",
    "## Milestones",
    "",
    "| Label | Date | Days from start |",
    "| --- | --- | --- |",
    ...r.milestones.map((m) => `| ${m.label} | ${m.date} | ${m.daysFromStart} |`),
  ];
  return lines.join("\n");
}

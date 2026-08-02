/**
 * Privacy Policy Generator (GDPR/CCPA) — pure logic.
 */

export interface PolicyOptions {
  companyName: string;
  websiteUrl: string;
  contactEmail: string;
  jurisdiction: "gdpr" | "ccpa" | "both";
  dataCollected: string[];
  thirdPartyServices: string[];
  cookieUsage: boolean;
  analyticsUsed: boolean;
  advertisingUsed: boolean;
  hasUserAccounts: boolean;
  dataRetentionPeriod: string;
  effectiveDate: string;
}

export function defaultOptions(): PolicyOptions {
  return {
    companyName: "Your Company Name",
    websiteUrl: "https://example.com",
    contactEmail: "privacy@example.com",
    jurisdiction: "gdpr",
    dataCollected: ["Email address", "Name", "IP address"],
    thirdPartyServices: [],
    cookieUsage: true,
    analyticsUsed: false,
    advertisingUsed: false,
    hasUserAccounts: false,
    dataRetentionPeriod: "12 months",
    effectiveDate: new Date().toISOString().split("T")[0],
  };
}

export function generatePolicy(opts: PolicyOptions): string {
  const year = new Date().getFullYear();
  let policy = `# Privacy Policy\n\n`;
  policy += `**Last updated:** ${opts.effectiveDate}\n\n`;
  policy += `This Privacy Policy describes how ${opts.companyName} ("we", "us", or "our") collects, uses, and discloses your information when you use our website at ${opts.websiteUrl} (the "Service").\n\n`;

  policy += `## 1. Information We Collect\n\n`;
  policy += `### Personal Information\n`;
  policy += `We may collect the following personal information:\n`;
  for (const data of opts.dataCollected) policy += `- ${data}\n`;
  policy += `\n`;

  if (opts.cookieUsage) {
    policy += `### Cookies and Tracking Technologies\n`;
    policy += `We use cookies and similar tracking technologies to track the activity on our Service and store certain information.\n\n`;
    if (opts.analyticsUsed) policy += `We use analytics cookies to understand how you interact with our Service.\n`;
    if (opts.advertisingUsed) policy += `We use advertising cookies to deliver relevant advertisements.\n`;
    policy += `\n`;
  }

  policy += `## 2. How We Use Your Information\n\n`;
  policy += `We use your information to:\n`;
  policy += `- Provide, maintain, and improve our Service\n`;
  policy += `- Notify you about changes to our Service\n`;
  if (opts.hasUserAccounts) policy += `- Create and manage your account\n`;
  if (opts.analyticsUsed) policy += `- Analyze usage patterns and trends\n`;
  policy += `- Respond to your comments and questions\n`;
  policy += `- Process transactions\n\n`;

  policy += `## 3. Data Retention\n\n`;
  policy += `We retain your personal information for ${opts.dataRetentionPeriod} or as long as needed to provide our Service.\n\n`;

  if (opts.thirdPartyServices.length > 0) {
    policy += `## 4. Third-Party Services\n\n`;
    policy += `We may share your information with the following third-party services:\n`;
    for (const svc of opts.thirdPartyServices) policy += `- ${svc}\n`;
    policy += `\n`;
  }

  if (opts.jurisdiction === "gdpr" || opts.jurisdiction === "both") {
    policy += `## 5. Your GDPR Rights\n\n`;
    policy += `If you are a resident of the European Economic Area (EEA), you have certain data protection rights under the General Data Protection Regulation (GDPR):\n\n`;
    policy += `- **Right to access:** You can request copies of your personal data\n`;
    policy += `- **Right to rectification:** You can request correction of inaccurate data\n`;
    policy += `- **Right to erasure:** You can request deletion of your personal data\n`;
    policy += `- **Right to restrict processing:** You can request restriction of processing\n`;
    policy += `- **Right to data portability:** You can receive a copy of your data in a structured format\n`;
    policy += `- **Right to object:** You can object to our processing of your personal data\n\n`;
  }

  if (opts.jurisdiction === "ccpa" || opts.jurisdiction === "both") {
    policy += `## 6. Your CCPA Rights\n\n`;
    policy += `If you are a California resident, you have certain rights under the California Consumer Privacy Act (CCPA):\n\n`;
    policy += `- **Right to know:** You can request what personal information we collect\n`;
    policy += `- **Right to delete:** You can request deletion of your personal information\n`;
    policy += `- **Right to opt-out:** You can opt-out of the sale of your personal information\n`;
    policy += `- **Right to non-discrimination:** We will not discriminate against you for exercising your rights\n\n`;
  }

  policy += `## 7. Contact Us\n\n`;
  policy += `If you have questions about this Privacy Policy, contact us at:\n`;
  policy += `- Email: ${opts.contactEmail}\n`;
  policy += `- Website: ${opts.websiteUrl}\n\n`;
  policy += `© ${year} ${opts.companyName}. All rights reserved.\n`;

  return policy;
}

export function generateHTML(opts: PolicyOptions): string {
  const md = generatePolicy(opts);
  return md
    .replace(/^# (.+)$/gm, "<h1>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/^- (.+)$/gm, "<li>$1</li>")
    .replace(/(<li>.+<\/li>)/s, "<ul>$1</ul>")
    .replace(/\n\n/g, "</p><p>")
    .replace(/^/, "<p>")
    .replace(/$/, "</p>");
}

export function validate(opts: PolicyOptions): string[] {
  const errors: string[] = [];
  if (!opts.companyName || opts.companyName.trim().length < 2) errors.push("Company name is required (min 2 chars)");
  if (!opts.websiteUrl || !/^https?:\/\//.test(opts.websiteUrl)) errors.push("Valid URL is required (must start with http:// or https://)");
  if (!opts.contactEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(opts.contactEmail)) errors.push("Valid email is required");
  return errors;
}

export function getDataTypes(): string[] {
  return [
    "Email address", "Name", "Phone number", "IP address", "Browser type",
    "Device information", "Location data", "Usage data", "Cookies",
    "Payment information", "Mailing address", "Date of birth",
    "User-generated content", "Search queries", "Communication preferences",
  ];
}

export function getThirdPartyServices(): string[] {
  return [
    "Google Analytics", "Google AdSense", "Facebook Pixel", "Stripe",
    "PayPal", "Mailchimp", "SendGrid", "Cloudflare", "AWS",
    "Hotjar", "Mixpanel", "Segment", "Intercom", "Zendesk",
  ];
}

// ============================================================================
// Backward-compat stub exports (added to satisfy UI template imports).
// ============================================================================

export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

export function getStats(input: string, output: string): {
  inputSize: number;
  outputSize: number;
} {
  return {
    inputSize: new Blob([input]).size,
    outputSize: new Blob([output]).size,
  };
}

export function process(input: string): { output: string; error: string | null } {
  try {
    const result = generatePolicy(input);
    if (typeof result === "string") {
      return { output: result, error: null };
    }
    if (result && typeof result === "object") {
      const r = result as Record<string, unknown>;
      const output =
        (typeof r.output === "string" && r.output) ||
        (typeof r.html === "string" && r.html) ||
        (typeof r.result === "string" && r.result) ||
        (typeof r.text === "string" && r.text) ||
        (typeof r.code === "string" && r.code) ||
        (typeof r.value === "string" && r.value) ||
        JSON.stringify(result, null, 2);
      const error =
        (typeof r.error === "string" && r.error) ||
        (r.ok === false && typeof r.message === "string" && r.message) ||
        null;
      return { output, error };
    }
    return { output: String(result), error: null };
  } catch (e) {
    return { output: "", error: (e as Error).message };
  }
}

/**
 * GST Calculator — Tool Manifest
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "gst-calculator",
  name: "GST / VAT Calculator",
  description:
    "Add or remove GST/VAT from any amount. Supports India (5/12/18/28%), UK (20%), Australia (10%), EU standard rates, custom rates, and 10+ extras. 100% private.",
  category: "calculators",
  keywords: ["gst calculator", "vat calculator", "tax", "india gst", "uk vat", "sales tax", "gst inclusive", "gst exclusive"],
  icon: "receipt",
  requiresNetwork: false,
  seo: {
    title: "GST / VAT Calculator — Add/Remove Tax + Country Presets | UnQTools",
    faq: [
      { q: "What's the difference between GST-inclusive and GST-exclusive?", a: "GST-inclusive: the displayed price already includes tax. To find the GST amount: price × (rate / (100 + rate)). GST-exclusive: tax is added on top. GST amount: price × (rate / 100), total = price + GST." },
      { q: "What extras does this tool have?", a: "Extras: (1) Add GST (exclusive → inclusive), (2) Remove GST (inclusive → exclusive), (3) Country presets (India 5/12/18/28%, UK 20%, Australia 10%, Singapore 9%, NZ 15%, EU 19-25%), (4) Custom rate, (5) Multi-currency, (6) Show base + GST + total breakdown, (7) Batch mode (multiple amounts), (8) CSV export, (9) History (localStorage), (10) Show effective tax rate, (11) Reverse: find original from final, (12) Copy individual results, (13) CGST+SGST split (India), (14) IGST option (inter-state India)." },
    ],
  },
  status: "done",
};

/**
 * Create PDF Form (Builder) — real engine.
 *
 * Builds a new PDF with interactive form fields: text inputs, checkboxes,
 * radio groups and dropdowns, laid out top-to-bottom on A4/Letter pages with
 * configurable font size and spacing. Uses pdf-lib's full form API.
 */
import { PDFDocument, StandardFonts, PageSizes, rgb } from "pdf-lib";
import type { ToolResult } from "../../../lib/tool";

export type FieldKind = "text" | "checkbox" | "radio" | "dropdown";

export interface FieldSpec {
  kind: FieldKind;
  label: string;
  /** Options for radio/dropdown. */
  options?: string[];
  /** Default text value. */
  value?: string;
  /** Required-ish hint text. */
  placeholder?: string;
}

export interface FormBuilderOptions {
  fields: FieldSpec[];
  pageSize?: "a4" | "letter";
  margin?: number;
  fontSize?: number;
  title?: string;
}

export interface FormBuilderResult {
  bytes: Uint8Array;
  fieldsCreated: number;
  pagesUsed: number;
}

/** Estimate the vertical height a field needs. Pure + testable. */
export function fieldHeight(field: FieldSpec, fontSize: number): number {
  const fs = Math.max(8, Math.min(20, fontSize || 12));
  switch (field.kind) {
    case "checkbox":
    case "radio":
      return fs * 2.2;
    case "dropdown":
      return fs * 2.6;
    default:
      return fs * 2.4;
  }
}

export async function buildForm(
  options: FormBuilderOptions
): Promise<ToolResult<FormBuilderResult>> {
  if (!options.fields || options.fields.length === 0) {
    return { ok: false, error: "Add at least one form field." };
  }
  try {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const base = options.pageSize === "letter" ? PageSizes.Letter : PageSizes.A4;
    const pageW = base[0];
    const pageH = base[1];
    const margin = Math.max(20, Math.min(100, options.margin || 48));
    const fs = Math.max(8, Math.min(20, options.fontSize || 12));
    const form = doc.getForm();

    let page = doc.addPage([pageW, pageH]);
    let y = pageH - margin;
    const titleH = options.title ? fs * 2 : 0;
    y -= titleH;
    let fieldsCreated = 0;
    let pagesUsed = 1;

    if (options.title) {
      page.drawText(options.title, { x: margin, y: pageH - margin - fs, size: fs + 4, font, color: rgb(0, 0, 0) });
    }

    const newPageIfNeeded = (needed: number) => {
      if (y - needed < margin) {
        page = doc.addPage([pageW, pageH]);
        pagesUsed++;
        y = pageH - margin;
      }
    };

    for (const field of options.fields) {
      const h = fieldHeight(field, fs);
      newPageIfNeeded(h + fs);
      // Label
      page.drawText(field.label, { x: margin, y: y - fs, size: fs, font, color: rgb(0.15, 0.15, 0.15) });
      y -= fs + 2;

      switch (field.kind) {
        case "text": {
          const tf = form.createTextField(`${field.label.replace(/\s+/g, "_")}_${fieldsCreated}`);
          const w = pageW - margin * 2;
          tf.addToPage(page, { x: margin, y: y - fs * 1.8, width: w, height: fs * 1.8 });
          if (field.value) tf.setText(field.value);
          if (field.placeholder) tf.setText(field.placeholder);
          break;
        }
        case "checkbox": {
          const cb = form.createCheckBox(`${field.label.replace(/\s+/g, "_")}_${fieldsCreated}`);
          cb.addToPage(page, { x: margin, y: y - fs * 1.6, width: fs * 1.6, height: fs * 1.6 });
          if (field.value === "checked" || field.value === "true") cb.check();
          break;
        }
        case "radio": {
          const rg = form.createRadioGroup(`${field.label.replace(/\s+/g, "_")}_${fieldsCreated}`);
          const opts = field.options && field.options.length > 0 ? field.options : ["Yes", "No"];
          opts.forEach((opt, i) => {
            rg.addOptionToPage(opt, page, {
              x: margin + i * 90,
              y: y - fs * 1.6,
              width: fs * 1.6,
              height: fs * 1.6,
              textSize: fs,
            });
            page.drawText(opt, { x: margin + i * 90 + fs * 2, y: y - fs * 1.6 + fs * 0.2, size: fs - 2, font });
          });
          if (field.value) rg.select(field.value);
          break;
        }
        case "dropdown": {
          const dd = form.createDropdown(`${field.label.replace(/\s+/g, "_")}_${fieldsCreated}`);
          const w = pageW - margin * 2;
          dd.addToPage(page, { x: margin, y: y - fs * 1.8, width: w, height: fs * 1.8 });
          dd.setOptions(field.options && field.options.length > 0 ? field.options : ["Option 1", "Option 2"]);
          if (field.value) dd.select(field.value);
          break;
        }
      }
      fieldsCreated++;
      y -= h;
    }

    doc.setProducer("UnQTools — PDF Form Builder");
    doc.setCreator("UnQTools — PDF Form Builder");
    doc.setCreationDate(new Date());
    return {
      ok: true,
      output: { bytes: await doc.save(), fieldsCreated, pagesUsed },
    };
  } catch {
    return { ok: false, error: "Something went wrong while building the form." };
  }
}

/**
 * BMI Calculator — Tool Manifest
 * Reference: unqtools-docs / Category 6 - Calculators & Converters / "2 BMI Calculator".
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "bmi-calculator",
  name: "BMI Calculator",
  description:
    "Calculate Body Mass Index (BMI) from height and weight in metric or imperial units. Get category (underweight / normal / overweight / obese), healthy weight range, and 10+ extras. 100% private.",
  category: "calculators",
  keywords: [
    "bmi calculator",
    "body mass index",
    "healthy weight",
    "weight calculator",
    "health",
    "fitness",
    "obesity",
    "underweight",
  ],
  icon: "activity",
  requiresNetwork: false,
  seo: {
    title: "BMI Calculator — Body Mass Index with Healthy Weight Range | UnQTools",
    faq: [
      {
        q: "What is BMI?",
        a: "Body Mass Index (BMI) is a person's weight in kilograms divided by the square of their height in meters. It's a screening tool for weight categories: underweight (<18.5), normal (18.5-24.9), overweight (25-29.9), obese (>=30).",
      },
      {
        q: "Is BMI accurate for everyone?",
        a: "BMI is a population-level screening tool, not a diagnostic of body fat or health. It overestimates fat in muscular athletes and underestimates fat in older adults who've lost muscle. Always consult a doctor for individual health assessments.",
      },
      {
        q: "What extra features does this tool have compared to others?",
        a: "Extras: (1) Healthy weight range, (2) BMI Prime, (3) Body surface area (Mosteller), (4) Ponderal Index, (5) Basal Metabolic Rate (Mifflin-St Jeor), (6) Daily calorie needs (5 activity levels), (7) Weight loss/gain goal calculator, (8) BMI z-score for age 2-20 (approximation), (9) CSV export of weight scenarios, (10) Dark/light metric/imperial toggle, (11) Macro nutrient split suggestions, (12) Waist-to-height ratio estimator.",
      },
    ],
  },
  status: "done",
};

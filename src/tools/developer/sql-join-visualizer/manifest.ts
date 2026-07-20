/**
 * SQL Join Visualizer — Tool Manifest.
 * Tool #266 — Category 4 (Developer & Code).
 *
 * Visualizes SQL JOINs interactively with row-level matching (not the
 * misleading Venn diagram), live result preview, and copyable SQL —
 * covering INNER, LEFT, RIGHT, FULL OUTER, CROSS, and anti/semi joins.
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "sql-join-visualizer",
  name: "SQL Join Visualizer",
  description:
    "Visualize SQL JOINs interactively — INNER, LEFT, RIGHT, FULL OUTER, CROSS, anti-join, semi-join, and self-join — with row-accurate matching (not misleading Venn diagrams), live result preview, NULL-handling demonstration, duplicate-row multiplication explainer, step-through animation, and copyable generated SQL. 100% client-side, no DB required.",
  category: "developer",
  keywords: [
    "sql join visualizer", "sql joins explained", "inner vs left join",
    "join diagram", "sql join types", "left join", "right join",
    "full outer join", "cross join", "anti join", "semi join",
    "self join", "sql join tutorial", "join animation",
  ],
  icon: "git-merge",
  requiresNetwork: false,
  seo: {
    title: "SQL Join Visualizer — INNER, LEFT, RIGHT, FULL, CROSS, Anti, Semi Joins | UnQTools",
    faq: [
      {
        q: "How does the SQL Join Visualizer work?",
        a: "Pick a join type (INNER, LEFT, RIGHT, FULL OUTER, CROSS, LEFT ANTI, LEFT SEMI, or self-join), choose two sample tables, set the ON condition, and the tool runs the join live in your browser — no database needed. The visualization shows exactly which rows match (a row-level 'checkered flag' style), how unmatched rows are NULL-filled, and how duplicate keys multiply rows in the result. You can edit the sample data and the join condition, and the result updates instantly.",
      },
      {
        q: "Why a row-accurate visualization instead of a Venn diagram?",
        a: "Coding Horror and many DB educators have shown that Venn diagrams misrepresent JOINs: they imply set union/intersection, but JOINs actually multiply rows (a single left row with N matching right rows produces N result rows), and they hide NULL behaviour (NULL join keys never match, not even to other NULLs). This tool shows the actual row-by-row matching so you can see exactly how the result is built, including row explosion and NULL handling.",
      },
      {
        q: "Which join types and edge cases are covered?",
        a: "INNER, LEFT [OUTER], RIGHT [OUTER], FULL [OUTER], CROSS, LEFT ANTI (left rows with no match), LEFT SEMI (left rows with at least one match, right columns dropped), and SELF JOIN (the same table aliased twice). Edge cases: NULLs in join keys never match, duplicate keys multiply rows, composite-key joins (multiple AND-ed conditions), and non-equi joins (e.g. t1.x < t2.y).",
      },
      {
        q: "Can I run the join on my own sample data?",
        a: "Yes. Both tables are editable — change column names, add or remove rows, and the join re-runs instantly. The result grid is shown side-by-side with the matched/unmatched rows color-coded so you can see exactly which rows contributed to each result row. The generated SQL is shown beneath and can be copied for use in your own database.",
      },
      {
        q: "What extras does this visualizer offer versus others?",
        a: "(1) Eight join types: INNER, LEFT, RIGHT, FULL, CROSS, LEFT ANTI, LEFT SEMI, SELF. (2) Row-accurate matching visualization (not Venn). (3) Live result preview that updates as you edit. (4) NULL-handling demonstration (NULL keys never match). (5) Duplicate-row multiplication explainer. (6) Composite-key joins. (7) Non-equi joins (<, <=, >, >=, <>). (8) Step-through animation of the matching process. (9) Color-coded matched/unmatched rows. (10) Three preset datasets (users+orders, departments+employees self-ref, tags many-to-many). (11) Editable sample tables. (12) Copyable generated SQL with proper identifier quoting. (13) localStorage history (max 20). (14) Shareable URL with base64-encoded state. (15) Honest educational notes ('Venn diagrams mislead; here's why').",
      },
    ],
  },
  status: "done",
};

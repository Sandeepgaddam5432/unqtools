/**
 * MongoDB Aggregation Pipeline Builder — Tool Manifest.
 * Tool #278 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mongodb-aggregation-pipeline-builder",
  name: "MongoDB Aggregation Pipeline Builder",
  description:
    "Build MongoDB aggregation pipelines stage-by-stage with $match, $project, $group, $sort, $limit, $skip, $unwind, $lookup, $addFields, $count, and $facet. Per-stage live preview on pasted sample documents. Accumulators ($sum, $avg, $push, $first, $last, $max, $min, $count) and expressions ($cond, $switch, $concat, $toUpper, $toLower, $add, $subtract, $multiply, $divide, $dateToString, $ifNull, $literal). Export pipeline JSON + driver code for mongosh, Node, Python, Java, C#, and PHP. Stage enable/disable toggle, drag-reorder, shareable URL, history. 100% client-side.",
  category: "developer",
  keywords: [
    "mongodb", "aggregation pipeline", "mongodb aggregation",
    "aggregation builder", "$match $group $sort", "$lookup builder",
    "mongo pipeline generator", "pymongo aggregate",
    "mongodb $facet", "mongo $unwind $project", "mongodb driver code",
    "aggregation $sum $avg", "mongo $cond $switch",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "MongoDB Aggregation Pipeline Builder — Visual Stage Editor + Driver Code Export | UnQTools",
    faq: [
      {
        q: "Which aggregation stages does this builder support?",
        a: "Eleven stages: $match (MQL filter), $project (reshape/select fields), $group (group + accumulate), $sort, $limit, $skip, $unwind (explode arrays), $lookup (join another collection), $addFields (add computed fields), $count (count → single field), and $facet (parallel sub-pipelines). Each stage can be enabled/disabled for debugging and reordered via the up/down buttons.",
      },
      {
        q: "What accumulators and expressions are supported?",
        a: "Eight accumulators in $group: $sum, $avg, $push, $first, $last, $max, $min, $count. Twenty expressions: $cond, $switch, $concat, $toUpper, $toLower, $add, $subtract, $multiply, $divide, $dateToString, $ifNull, $literal, $eq, $ne, $gt, $lt, $gte, $lte, $and, $or. The in-browser engine evaluates them against your sample documents in real time.",
      },
      {
        q: "Can I see what each stage does to my data?",
        a: "Yes. Paste a JSON array of sample documents and the in-browser aggregation engine runs each stage in order, showing the document count and a row-level preview after every stage. Disabled stages pass through unchanged. The engine supports $match filtering, $project with expressions, $group with all accumulators, $sort, $limit, $skip, $unwind (with preserveNullAndEmptyArrays), $lookup (joins against the same sample docs), $addFields, $count, and $facet (with nested sub-pipelines).",
      },
      {
        q: "What does the tool export?",
        a: "Pipeline JSON (the array of stage objects), plus driver code for six targets: mongosh (db.coll.aggregate(...)), Node.js (MongoClient + .aggregate().toArray()), Python (PyMongo collection.aggregate(pipeline)), Java (Arrays.asList(Document.parse(...))), C# (.NET BsonDocument.Parse(...)), and PHP ($collection->aggregate($pipeline)). The exported pipeline runs unchanged against a real MongoDB.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) 11 stage types with per-stage JSON spec editor. (2) Stage enable/disable toggle for debugging. (3) Reorder stages up/down. (4) 8 accumulators + 20 expressions evaluated in-browser. (5) Per-stage live preview on pasted sample docs (intermediate output shown). (6) 6 driver code exports. (7) Stage validation per type (object / integer / string / path). (8) Pipeline-level validation with stageId pinpointing errors. (9) Field-path autocomplete extracted from sample docs. (10) Dot-notation field access (including array-of-objects). (11) $facet sub-pipeline execution. (12) $unwind preserveNullAndEmptyArrays option. (13) localStorage history (max 20). (14) Shareable URL with full pipeline state. (15) Load sample documents button.",
      },
    ],
  },
  status: "done",
};

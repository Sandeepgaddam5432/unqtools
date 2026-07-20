/**
 * MongoDB Query Builder — Tool Manifest.
 * Tool #277 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "mongodb-query-builder",
  name: "MongoDB Query Builder",
  description:
    "Build MongoDB queries visually with AND/OR/NOR grouping, $eq/$ne/$gt/$gte/$lt/$lte/$in/$nin/$regex/$exists/$type/$size/$mod/$not operators, projection, sort, limit, skip, and operation modes (find / findOne / insertOne / updateMany / updateOne / replaceOne / deleteMany / deleteOne). Generates MQL JSON, mongosh, and driver code for Node, Python, Java, C#, and PHP. Runs an in-browser MQL filter engine against pasted sample documents. 100% client-side.",
  category: "developer",
  keywords: [
    "mongodb", "mongo query", "mql builder", "mongodb query builder",
    "find generator", "mongosh generator", "mongodb driver code",
    "pymongo generator", "mongo regex builder", "mongo $and $or",
    "mongo $in $nin", "mongo $elemMatch", "mongodb filter builder",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "MongoDB Query Builder — Visual MQL Generator + Driver Code Export | UnQTools",
    faq: [
      {
        q: "Which MongoDB operators does this builder support?",
        a: "All common comparison operators ($eq, $ne, $gt, $gte, $lt, $lte), array operators ($in, $nin, $all via $in), $regex, $exists, $type, $size, $mod, $not, plus $and / $or / $nor logical grouping with unlimited nesting. Each condition is type-aware — strings, numbers, booleans, null, ObjectId (24-hex), and ISODate are emitted as proper Extended JSON ($oid / $date) and mongosh literals (ObjectId(...) / ISODate(...)).",
      },
      {
        q: "What does the tool export?",
        a: "Six formats: (1) clean MQL JSON (filter + projection + sort + limit + skip); (2) mongosh one-liner; (3) Node.js driver code with MongoClient; (4) Python (PyMongo) with sort/limit/skip chained; (5) Java driver code using Document.parse; (6) C# .NET with BsonDocument.Parse; (7) PHP driver code. All of find, findOne, insertOne, updateMany/One, replaceOne, deleteMany/One are covered.",
      },
      {
        q: "Can I test my query against sample documents?",
        a: "Yes. Paste an array of JSON documents into the sample-documents panel and the in-browser MQL filter engine runs your filter against them in real time. The engine supports dot-notation field access (including array-of-objects), $and/$or/$nor, and all the comparison operators. Matched documents are highlighted; counts and per-doc errors are shown.",
      },
      {
        q: "Are my queries or sample documents uploaded anywhere?",
        a: "No. This is a 100% client-side tool — your queries, sample documents, and history never leave the browser. History (last 20 builds) is stored in localStorage on this device only, and the shareable-URL encodes the full query state in the URL fragment (after #), which browsers never send to servers.",
      },
      {
        q: "What extra features does this tool have versus others?",
        a: "(1) 14 query operators + 3 logical groupings with unlimited nesting. (2) 8 operation modes (find / findOne / insertOne / updateMany / updateOne / replaceOne / deleteMany / deleteOne). (3) 6 driver code exports. (4) Type-aware values (string / number / boolean / null / ObjectId / ISODate) with Extended JSON + mongosh literals. (5) Projection (include/exclude). (6) Multi-field sort. (7) Limit + skip. (8) In-browser MQL filter engine on pasted sample docs. (9) Dot-notation field access. (10) Field autocomplete extracted from sample docs. (11) Field-name validation. (12) JSON doc validation for inserts/updates. (13) localStorage history (max 20). (14) Shareable URL with full state. (15) Update-operator doc editor ($set, $unset, $inc, $push, $pull).",
      },
    ],
  },
  status: "done",
};

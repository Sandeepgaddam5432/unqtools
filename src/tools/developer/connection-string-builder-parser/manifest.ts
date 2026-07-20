/**
 * Connection String Builder & Parser — Tool Manifest.
 * Tool #280 — Category 4 (Developer & Code).
 */
import type { ToolManifest } from "../../../lib/tool";

export const manifest: ToolManifest = {
  id: "connection-string-builder-parser",
  name: "Connection String Builder & Parser",
  description:
    "Build and parse database connection strings for PostgreSQL, MySQL, MongoDB, Redis, SQL Server, and SQLite. Convert between URI, key/value, and JDBC formats with correct percent-encoding of user, password, and parameters. Validate, mask passwords, multi-host, and SSL params. 100% client-side — secrets never leave the browser.",
  category: "developer",
  keywords: [
    "connection string", "connection string builder", "parse connection string",
    "postgres connection string", "mysql connection string", "mongodb uri",
    "redis url", "sql server connection", "jdbc url", "percent encoding",
    "database url", "datasource url",
  ],
  icon: "database",
  requiresNetwork: false,
  seo: {
    title: "Connection String Builder & Parser — Postgres, MySQL, Mongo, Redis, JDBC | UnQTools",
    faq: [
      {
        q: "Which database connection string formats are supported?",
        a: "Six databases: PostgreSQL (postgres:// / postgresql://), MySQL (mysql://), MongoDB (mongodb:// / mongodb+srv://), Redis (redis:// / rediss://), SQL Server (sqlserver:// or Server=…;Database=… key/value), and SQLite (file:). Each can be built and parsed in URI form, key/value form (where applicable), and JDBC form (where applicable).",
      },
      {
        q: "How are special characters in passwords handled?",
        a: "All user, password, and query-parameter values are percent-encoded when building and percent-decoded when parsing, per RFC 3986. Characters like '@', ':', '/', '?', '#', and '%' are correctly handled so a password such as 'p@ss/w:rd' round-trips losslessly without breaking the URI structure.",
      },
      {
        q: "Can I convert between URI, key/value, and JDBC formats?",
        a: "Yes. Paste any supported connection string and the parser auto-detects the database type and format. You can then convert to any other supported format with one click. For example, parse 'postgres://user:pass@host:5432/db' and emit the JDBC form 'jdbc:postgresql://host:5432/db?user=user&password=pass', or the libpq key/value form 'host=host port=5432 dbname=db user=user password=pass'.",
      },
      {
        q: "Does this tool handle multi-host / replica sets?",
        a: "Yes. The structured ConnParts model accepts an array of {host, port} pairs. MongoDB connection strings emit 'host1:port1,host2:port2', PostgreSQL emits 'host=host1,host2 port=port1,port2', and SQL Server emits 'host1,port1;host2,port2'. Default ports are applied per database when omitted.",
      },
      {
        q: "What extra features does this tool have versus other connection string tools?",
        a: "(1) Six DB types in one tool with auto-detection. (2) Three output formats: URI, key/value, JDBC. (3) Correct RFC 3986 percent-encoding of user/password/params. (4) Multi-host / replica set support. (5) Default ports per DB type. (6) SSL/TLS parameter helpers. (7) Password masking with reveal toggle. (8) Per-parameter tooltips and driver hints (Prisma/SQLAlchemy/Spring). (9) Validation with specific error messages. (10) localStorage history (max 20). (11) Shareable URL with masked password. (12) Copy buttons per format. 100% offline; secrets never transmitted.",
      },
    ],
  },
  status: "done",
};

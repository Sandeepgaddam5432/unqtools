/**
 * Redis Command Reference & Builder — pure logic.
 *
 * Bundled Redis command metadata (60 commands across 15 groups) with
 * per-command syntax, arguments, return type, Big-O complexity, version,
 * safety warnings, and a CLI/command builder that emits four client
 * languages (redis-cli, node-redis, redis-py, Jedis). 100% client-side;
 * no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type RedisGroup =
  | "string"
  | "list"
  | "set"
  | "hash"
  | "sorted-set"
  | "key"
  | "pubsub"
  | "stream"
  | "connection"
  | "server"
  | "transaction"
  | "scripting"
  | "hyperloglog"
  | "geo"
  | "cluster";

export type SafetyLevel = "safe" | "warning" | "dangerous";

export type ClientLanguage = "redis-cli" | "node-redis" | "redis-py" | "jedis";

export type ArgType =
  | "key"
  | "value"
  | "integer"
  | "float"
  | "pattern"
  | "score"
  | "field"
  | "channel"
  | "string"
  | "cursor";

export interface CommandArg {
  name: string;
  type: ArgType;
  optional?: boolean;
  variadic?: boolean;
  description: string;
}

export interface CommandExample {
  command: string;
  description: string;
}

export interface RedisCommand {
  name: string;
  group: RedisGroup;
  syntax: string;
  args: CommandArg[];
  returns: string;
  complexity: string;
  since: string;
  description: string;
  examples: CommandExample[];
  safety: SafetyLevel;
  deprecated?: boolean;
  replacement?: string;
}

export interface SearchFilters {
  query?: string;
  group?: RedisGroup | "";
  safety?: SafetyLevel | "";
  minVersion?: string;
}

export interface ParseResult {
  name: string;
  args: string[];
}

export type BuildResult =
  | {
      ok: true;
      cli: string;
      clients: Record<ClientLanguage, string>;
      warnings: string[];
    }
  | { ok: false; error: string };

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Constants — groups, safety, languages
// ---------------------------------------------------------------------------

export const COMMAND_GROUPS: ReadonlyArray<{ value: RedisGroup; label: string }> = [
  { value: "string", label: "String" },
  { value: "list", label: "List" },
  { value: "set", label: "Set" },
  { value: "hash", label: "Hash" },
  { value: "sorted-set", label: "Sorted Set" },
  { value: "key", label: "Key" },
  { value: "pubsub", label: "Pub/Sub" },
  { value: "stream", label: "Stream" },
  { value: "connection", label: "Connection" },
  { value: "server", label: "Server" },
  { value: "transaction", label: "Transaction" },
  { value: "scripting", label: "Scripting" },
  { value: "hyperloglog", label: "HyperLogLog" },
  { value: "geo", label: "Geo" },
  { value: "cluster", label: "Cluster" },
];

export const SAFETY_LEVELS: ReadonlyArray<{
  value: SafetyLevel;
  label: string;
  description: string;
}> = [
  { value: "safe", label: "Safe", description: "Read-only or constant-time operation." },
  { value: "warning", label: "Warning", description: "Potentially slow on large datasets." },
  { value: "dangerous", label: "Dangerous", description: "Destructive — avoid on production." },
];

export const CLIENT_LANGUAGES: ReadonlyArray<{ value: ClientLanguage; label: string }> = [
  { value: "redis-cli", label: "redis-cli" },
  { value: "node-redis", label: "node-redis (JS)" },
  { value: "redis-py", label: "redis-py (Python)" },
  { value: "jedis", label: "Jedis (Java)" },
];

export const GROUP_LABELS: Record<RedisGroup, string> = COMMAND_GROUPS.reduce(
  (acc, g) => ({ ...acc, [g.value]: g.label }),
  {} as Record<RedisGroup, string>,
);

// ---------------------------------------------------------------------------
// Command database (60 commands)
// ---------------------------------------------------------------------------

function cmd(c: RedisCommand): RedisCommand { return c; }

export const REDIS_COMMANDS: RedisCommand[] = [
  // ----- STRING (8) -----
  cmd({
    name: "SET",
    group: "string",
    syntax: "SET key value [EX seconds|PX milliseconds|KEEPTTL] [NX|XX]",
    args: [
      { name: "key", type: "key", description: "The key to set." },
      { name: "value", type: "value", description: "The value to store." },
      { name: "condition", type: "string", optional: true, description: "NX (only if not exists) or XX (only if exists)." },
      { name: "expiry", type: "string", optional: true, description: "EX seconds, PX milliseconds, or KEEPTTL." },
    ],
    returns: "OK on success; nil if NX/XX condition not met.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Set the string value of a key, with optional expiry and existence conditions.",
    examples: [
      { command: 'SET mykey "hello"', description: "Set mykey to 'hello'." },
      { command: 'SET mykey "new" EX 60 NX', description: "Set only if missing, with 60s TTL." },
    ],
    safety: "safe",
  }),
  cmd({
    name: "GET",
    group: "string",
    syntax: "GET key",
    args: [{ name: "key", type: "key", description: "The key to retrieve." }],
    returns: "The stored value, or nil if the key does not exist.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Get the string value of a key.",
    examples: [{ command: "GET mykey", description: "Retrieve mykey." }],
    safety: "safe",
  }),
  cmd({
    name: "MSET",
    group: "string",
    syntax: "MSET key value [key value ...]",
    args: [
      { name: "key", type: "key", variadic: true, description: "Pairs of key and value." },
      { name: "value", type: "value", variadic: true, description: "Pairs of key and value." },
    ],
    returns: "OK",
    complexity: "O(N) where N is the number of keys to set.",
    since: "1.0.1",
    description: "Atomically set multiple key/value pairs.",
    examples: [{ command: 'MSET k1 "v1" k2 "v2"', description: "Set k1 and k2 in one call." }],
    safety: "safe",
  }),
  cmd({
    name: "MGET",
    group: "string",
    syntax: "MGET key [key ...]",
    args: [{ name: "key", type: "key", variadic: true, description: "One or more keys to fetch." }],
    returns: "Array of values (nil for missing keys).",
    complexity: "O(N) where N is the number of keys.",
    since: "1.0.0",
    description: "Get the values of all specified keys.",
    examples: [{ command: "MGET k1 k2 k3", description: "Fetch three keys." }],
    safety: "safe",
  }),
  cmd({
    name: "SETNX",
    group: "string",
    syntax: "SETNX key value",
    args: [
      { name: "key", type: "key", description: "The key to set." },
      { name: "value", type: "value", description: "The value to store." },
    ],
    returns: "1 if the key was set; 0 if the key already exists.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Set value only if the key does not exist (atomic).",
    examples: [{ command: 'SETNX lock "owner1"', description: "Acquire a simple lock." }],
    safety: "safe",
  }),
  cmd({
    name: "INCR",
    group: "string",
    syntax: "INCR key",
    args: [{ name: "key", type: "key", description: "The key holding an integer." }],
    returns: "The value after the increment.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Increment the integer value of a key by one.",
    examples: [{ command: "INCR counter", description: "Increment counter." }],
    safety: "safe",
  }),
  cmd({
    name: "DECR",
    group: "string",
    syntax: "DECR key",
    args: [{ name: "key", type: "key", description: "The key holding an integer." }],
    returns: "The value after the decrement.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Decrement the integer value of a key by one.",
    examples: [{ command: "DECR counter", description: "Decrement counter." }],
    safety: "safe",
  }),
  cmd({
    name: "APPEND",
    group: "string",
    syntax: "APPEND key value",
    args: [
      { name: "key", type: "key", description: "The key to append to." },
      { name: "value", type: "value", description: "The value to append." },
    ],
    returns: "Length of the string after appending.",
    complexity: "O(1)",
    since: "2.0.0",
    description: "Append a value to a key, creating it if missing.",
    examples: [{ command: 'APPEND msg " world"', description: "Append ' world' to msg." }],
    safety: "safe",
  }),

  // ----- LIST (6) -----
  cmd({
    name: "LPUSH",
    group: "list",
    syntax: "LPUSH key value [value ...]",
    args: [
      { name: "key", type: "key", description: "The list key." },
      { name: "value", type: "value", variadic: true, description: "Values to push to head." },
    ],
    returns: "Length of list after push.",
    complexity: "O(1) per element added.",
    since: "1.0.0",
    description: "Insert all specified values at the head of the list.",
    examples: [{ command: 'LPUSH jobs "j1" "j2"', description: "Push j1, j2 to head." }],
    safety: "safe",
  }),
  cmd({
    name: "RPUSH",
    group: "list",
    syntax: "RPUSH key value [value ...]",
    args: [
      { name: "key", type: "key", description: "The list key." },
      { name: "value", type: "value", variadic: true, description: "Values to push to tail." },
    ],
    returns: "Length of list after push.",
    complexity: "O(1) per element added.",
    since: "1.0.0",
    description: "Insert all specified values at the tail of the list.",
    examples: [{ command: 'RPUSH jobs "j1" "j2"', description: "Push j1, j2 to tail." }],
    safety: "safe",
  }),
  cmd({
    name: "LRANGE",
    group: "list",
    syntax: "LRANGE key start stop",
    args: [
      { name: "key", type: "key", description: "The list key." },
      { name: "start", type: "integer", description: "Zero-based start index (negative = from end)." },
      { name: "stop", type: "integer", description: "Zero-based stop index (inclusive)." },
    ],
    returns: "Array of elements in the specified range.",
    complexity: "O(S+N) where S is the distance from head.",
    since: "1.0.0",
    description: "Get a range of elements from a list.",
    examples: [{ command: "LRANGE jobs 0 -1", description: "Get entire list." }],
    safety: "safe",
  }),
  cmd({
    name: "LLEN",
    group: "list",
    syntax: "LLEN key",
    args: [{ name: "key", type: "key", description: "The list key." }],
    returns: "Length of the list at key, or 0 if it does not exist.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Get the length of a list.",
    examples: [{ command: "LLEN jobs", description: "Count jobs." }],
    safety: "safe",
  }),
  cmd({
    name: "LPOP",
    group: "list",
    syntax: "LPOP key [count]",
    args: [
      { name: "key", type: "key", description: "The list key." },
      { name: "count", type: "integer", optional: true, description: "Number of elements to pop." },
    ],
    returns: "The popped element (or array if count given).",
    complexity: "O(N) where N is count.",
    since: "1.0.0",
    description: "Remove and return the first element(s) of a list.",
    examples: [{ command: "LPOP jobs", description: "Pop next job from head." }],
    safety: "safe",
  }),
  cmd({
    name: "RPOP",
    group: "list",
    syntax: "RPOP key [count]",
    args: [
      { name: "key", type: "key", description: "The list key." },
      { name: "count", type: "integer", optional: true, description: "Number of elements to pop." },
    ],
    returns: "The popped element (or array if count given).",
    complexity: "O(N) where N is count.",
    since: "1.0.0",
    description: "Remove and return the last element(s) of a list.",
    examples: [{ command: "RPOP jobs", description: "Pop from tail." }],
    safety: "safe",
  }),

  // ----- SET (6) -----
  cmd({
    name: "SADD",
    group: "set",
    syntax: "SADD key member [member ...]",
    args: [
      { name: "key", type: "key", description: "The set key." },
      { name: "member", type: "value", variadic: true, description: "Members to add." },
    ],
    returns: "Number of new members added (excluding existing).",
    complexity: "O(1) per element added.",
    since: "1.0.0",
    description: "Add one or more members to a set.",
    examples: [{ command: 'SADD tags "redis" "db"', description: "Add two tags." }],
    safety: "safe",
  }),
  cmd({
    name: "SREM",
    group: "set",
    syntax: "SREM key member [member ...]",
    args: [
      { name: "key", type: "key", description: "The set key." },
      { name: "member", type: "value", variadic: true, description: "Members to remove." },
    ],
    returns: "Number of members removed.",
    complexity: "O(1) per element removed.",
    since: "1.0.0",
    description: "Remove one or more members from a set.",
    examples: [{ command: 'SREM tags "redis"', description: "Remove 'redis' tag." }],
    safety: "safe",
  }),
  cmd({
    name: "SMEMBERS",
    group: "set",
    syntax: "SMEMBERS key",
    args: [{ name: "key", type: "key", description: "The set key." }],
    returns: "Array of all members of the set.",
    complexity: "O(N) where N is the set cardinality.",
    since: "1.0.0",
    description: "Get all members of a set. Prefer SSCAN for large sets.",
    examples: [{ command: "SMEMBERS tags", description: "List all tags." }],
    safety: "warning",
  }),
  cmd({
    name: "SISMEMBER",
    group: "set",
    syntax: "SISMEMBER key member",
    args: [
      { name: "key", type: "key", description: "The set key." },
      { name: "member", type: "value", description: "The member to test." },
    ],
    returns: "1 if member exists; 0 otherwise.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Test whether a member exists in a set.",
    examples: [{ command: 'SISMEMBER tags "redis"', description: "Check membership." }],
    safety: "safe",
  }),
  cmd({
    name: "SCARD",
    group: "set",
    syntax: "SCARD key",
    args: [{ name: "key", type: "key", description: "The set key." }],
    returns: "Cardinality (count) of the set.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Get the number of members in a set.",
    examples: [{ command: "SCARD tags", description: "Count tags." }],
    safety: "safe",
  }),
  cmd({
    name: "SINTER",
    group: "set",
    syntax: "SINTER key [key ...]",
    args: [{ name: "key", type: "key", variadic: true, description: "Two or more set keys." }],
    returns: "Array of members in the intersection.",
    complexity: "O(N*M) where N is the smallest set; M is the number of sets.",
    since: "1.0.0",
    description: "Intersect multiple sets.",
    examples: [{ command: "SINTER s1 s2", description: "Common members of s1, s2." }],
    safety: "safe",
  }),

  // ----- HASH (6) -----
  cmd({
    name: "HSET",
    group: "hash",
    syntax: "HSET key field value [field value ...]",
    args: [
      { name: "key", type: "key", description: "The hash key." },
      { name: "field", type: "field", variadic: true, description: "Pairs of field and value." },
      { name: "value", type: "value", variadic: true, description: "Pairs of field and value." },
    ],
    returns: "Number of new fields added (excluding existing).",
    complexity: "O(1) per field/value pair.",
    since: "2.0.0",
    description: "Set one or more field/value pairs in a hash.",
    examples: [{ command: 'HSET user:1 name "Alice" age 30', description: "Set two fields." }],
    safety: "safe",
  }),
  cmd({
    name: "HGET",
    group: "hash",
    syntax: "HGET key field",
    args: [
      { name: "key", type: "key", description: "The hash key." },
      { name: "field", type: "field", description: "The field to retrieve." },
    ],
    returns: "The field value, or nil if field does not exist.",
    complexity: "O(1)",
    since: "2.0.0",
    description: "Get the value of a hash field.",
    examples: [{ command: "HGET user:1 name", description: "Get 'name' field." }],
    safety: "safe",
  }),
  cmd({
    name: "HGETALL",
    group: "hash",
    syntax: "HGETALL key",
    args: [{ name: "key", type: "key", description: "The hash key." }],
    returns: "Flat array of field/value pairs.",
    complexity: "O(N) where N is the hash size.",
    since: "2.0.0",
    description: "Get all fields and values of a hash. Prefer HSCAN for large hashes.",
    examples: [{ command: "HGETALL user:1", description: "Read entire user hash." }],
    safety: "warning",
  }),
  cmd({
    name: "HDEL",
    group: "hash",
    syntax: "HDEL key field [field ...]",
    args: [
      { name: "key", type: "key", description: "The hash key." },
      { name: "field", type: "field", variadic: true, description: "Fields to remove." },
    ],
    returns: "Number of fields removed.",
    complexity: "O(1) per field removed.",
    since: "2.0.0",
    description: "Delete one or more hash fields.",
    examples: [{ command: "HDEL user:1 age", description: "Remove 'age' field." }],
    safety: "safe",
  }),
  cmd({
    name: "HLEN",
    group: "hash",
    syntax: "HLEN key",
    args: [{ name: "key", type: "key", description: "The hash key." }],
    returns: "Number of fields in the hash.",
    complexity: "O(1)",
    since: "2.0.0",
    description: "Get the number of fields in a hash.",
    examples: [{ command: "HLEN user:1", description: "Count fields." }],
    safety: "safe",
  }),
  cmd({
    name: "HEXISTS",
    group: "hash",
    syntax: "HEXISTS key field",
    args: [
      { name: "key", type: "key", description: "The hash key." },
      { name: "field", type: "field", description: "The field to test." },
    ],
    returns: "1 if the field exists; 0 otherwise.",
    complexity: "O(1)",
    since: "2.0.0",
    description: "Test whether a hash field exists.",
    examples: [{ command: "HEXISTS user:1 email", description: "Check 'email' field." }],
    safety: "safe",
  }),

  // ----- SORTED SET (7) -----
  cmd({
    name: "ZADD",
    group: "sorted-set",
    syntax: "ZADD key [NX|XX] [GT|LT] [CH] [INCR] score member [score member ...]",
    args: [
      { name: "key", type: "key", description: "The sorted set key." },
      { name: "score", type: "score", variadic: true, description: "Pairs of score and member." },
      { name: "member", type: "value", variadic: true, description: "Pairs of score and member." },
    ],
    returns: "Number of new members added (excluding existing).",
    complexity: "O(log(N)) per element added.",
    since: "1.2.0",
    description: "Add one or more members to a sorted set, or update their scores.",
    examples: [{ command: 'ZADD scores 100 "alice" 85 "bob"', description: "Add two scored members." }],
    safety: "safe",
  }),
  cmd({
    name: "ZRANGE",
    group: "sorted-set",
    syntax: "ZRANGE key start stop [BYSCORE|BYLEX] [REV] [LIMIT offset count] [WITHSCORES]",
    args: [
      { name: "key", type: "key", description: "The sorted set key." },
      { name: "start", type: "integer", description: "Start rank (or score if BYSCORE)." },
      { name: "stop", type: "integer", description: "Stop rank (or score if BYSCORE)." },
      { name: "opts", type: "string", optional: true, description: "WITHSCORES, REV, BYSCORE, BYLEX, LIMIT." },
    ],
    returns: "Array of members (and scores if WITHSCORES).",
    complexity: "O(log(N)+M) where M is the returned count.",
    since: "1.2.0",
    description: "Return a range of members by rank, score, or lex.",
    examples: [{ command: "ZRANGE scores 0 -1 WITHSCORES", description: "All members with scores." }],
    safety: "safe",
  }),
  cmd({
    name: "ZREVRANGE",
    group: "sorted-set",
    syntax: "ZREVRANGE key start stop [WITHSCORES]",
    args: [
      { name: "key", type: "key", description: "The sorted set key." },
      { name: "start", type: "integer", description: "Start rank (highest first)." },
      { name: "stop", type: "integer", description: "Stop rank (highest first)." },
      { name: "withscores", type: "string", optional: true, description: "Include scores." },
    ],
    returns: "Array of members in descending order.",
    complexity: "O(log(N)+M).",
    since: "1.2.0",
    description: "Return a range of members in reverse order. Deprecated in favor of ZRANGE REV.",
    examples: [{ command: "ZREVRANGE scores 0 9", description: "Top 10 by score." }],
    safety: "safe",
    deprecated: true,
    replacement: "ZRANGE with REV option",
  }),
  cmd({
    name: "ZSCORE",
    group: "sorted-set",
    syntax: "ZSCORE key member",
    args: [
      { name: "key", type: "key", description: "The sorted set key." },
      { name: "member", type: "value", description: "The member to look up." },
    ],
    returns: "The score as a string, or nil.",
    complexity: "O(1)",
    since: "1.2.0",
    description: "Get the score of a member in a sorted set.",
    examples: [{ command: 'ZSCORE scores "alice"', description: "Get alice's score." }],
    safety: "safe",
  }),
  cmd({
    name: "ZREM",
    group: "sorted-set",
    syntax: "ZREM key member [member ...]",
    args: [
      { name: "key", type: "key", description: "The sorted set key." },
      { name: "member", type: "value", variadic: true, description: "Members to remove." },
    ],
    returns: "Number of members removed.",
    complexity: "O(M*log(N)) where M is removed count.",
    since: "1.2.0",
    description: "Remove one or more members from a sorted set.",
    examples: [{ command: 'ZREM scores "bob"', description: "Remove bob." }],
    safety: "safe",
  }),
  cmd({
    name: "ZCARD",
    group: "sorted-set",
    syntax: "ZCARD key",
    args: [{ name: "key", type: "key", description: "The sorted set key." }],
    returns: "Cardinality of the sorted set.",
    complexity: "O(1)",
    since: "1.2.0",
    description: "Get the number of members in a sorted set.",
    examples: [{ command: "ZCARD scores", description: "Count scored members." }],
    safety: "safe",
  }),
  cmd({
    name: "ZINCRBY",
    group: "sorted-set",
    syntax: "ZINCRBY key increment member",
    args: [
      { name: "key", type: "key", description: "The sorted set key." },
      { name: "increment", type: "float", description: "Score increment (can be negative)." },
      { name: "member", type: "value", description: "The member to update." },
    ],
    returns: "New score of the member.",
    complexity: "O(log(N))",
    since: "1.2.0",
    description: "Increment the score of a member by the given amount.",
    examples: [{ command: 'ZINCRBY scores 5 "alice"', description: "Add 5 to alice." }],
    safety: "safe",
  }),

  // ----- KEY (8) -----
  cmd({
    name: "DEL",
    group: "key",
    syntax: "DEL key [key ...]",
    args: [{ name: "key", type: "key", variadic: true, description: "Keys to delete." }],
    returns: "Number of keys that were removed.",
    complexity: "O(N) where N is the number of keys.",
    since: "1.0.0",
    description: "Delete one or more keys.",
    examples: [{ command: "DEL k1 k2", description: "Delete two keys." }],
    safety: "safe",
  }),
  cmd({
    name: "EXISTS",
    group: "key",
    syntax: "EXISTS key [key ...]",
    args: [{ name: "key", type: "key", variadic: true, description: "Keys to test." }],
    returns: "Number of keys that exist.",
    complexity: "O(N) where N is the number of keys.",
    since: "1.0.0",
    description: "Check existence of one or more keys.",
    examples: [{ command: "EXISTS mykey", description: "Test single key." }],
    safety: "safe",
  }),
  cmd({
    name: "EXPIRE",
    group: "key",
    syntax: "EXPIRE key seconds [NX|XX|GT|LT]",
    args: [
      { name: "key", type: "key", description: "The key to expire." },
      { name: "seconds", type: "integer", description: "TTL in seconds." },
      { name: "condition", type: "string", optional: true, description: "NX/XX/GT/LT condition." },
    ],
    returns: "1 if the timeout was set; 0 otherwise.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Set a key's time-to-live in seconds.",
    examples: [{ command: "EXPIRE session 3600", description: "Expire in 1 hour." }],
    safety: "safe",
  }),
  cmd({
    name: "TTL",
    group: "key",
    syntax: "TTL key",
    args: [{ name: "key", type: "key", description: "The key to inspect." }],
    returns: "TTL in seconds; -1 if no expiry; -2 if key does not exist.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Get the remaining time-to-live of a key in seconds.",
    examples: [{ command: "TTL session", description: "Check TTL." }],
    safety: "safe",
  }),
  cmd({
    name: "PERSIST",
    group: "key",
    syntax: "PERSIST key",
    args: [{ name: "key", type: "key", description: "The key to make persistent." }],
    returns: "1 if the timeout was removed; 0 otherwise.",
    complexity: "O(1)",
    since: "2.2.0",
    description: "Remove the TTL from a key, making it persistent.",
    examples: [{ command: "PERSIST session", description: "Remove TTL." }],
    safety: "safe",
  }),
  cmd({
    name: "KEYS",
    group: "key",
    syntax: "KEYS pattern",
    args: [{ name: "pattern", type: "pattern", description: "Glob-style pattern." }],
    returns: "Array of matching keys.",
    complexity: "O(N) where N is the number of keys in the database.",
    since: "1.0.0",
    description: "Return all keys matching a glob pattern. Avoid in production — prefer SCAN.",
    examples: [
      { command: "KEYS user:*", description: "Find all user keys." },
      { command: "KEYS *", description: "List every key (very slow on large DBs)." },
    ],
    safety: "dangerous",
  }),
  cmd({
    name: "SCAN",
    group: "key",
    syntax: "SCAN cursor [MATCH pattern] [COUNT count] [TYPE type]",
    args: [
      { name: "cursor", type: "cursor", description: "Iteration cursor (0 to start)." },
      { name: "match", type: "pattern", optional: true, description: "MATCH pattern." },
      { name: "count", type: "integer", optional: true, description: "COUNT hint." },
      { name: "type", type: "string", optional: true, description: "TYPE filter (e.g. list, hash)." },
    ],
    returns: "Two-element array: [nextCursor, [keys...]].",
    complexity: "O(1) per call; O(N) total across iterations.",
    since: "2.8.0",
    description: "Incrementally iterate over the key space. Production-safe replacement for KEYS.",
    examples: [{ command: "SCAN 0 MATCH user:* COUNT 100", description: "Iterate user keys safely." }],
    safety: "safe",
  }),
  cmd({
    name: "TYPE",
    group: "key",
    syntax: "TYPE key",
    args: [{ name: "key", type: "key", description: "The key to inspect." }],
    returns: "Type string: string, list, set, zset, hash, stream, none.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Get the data type of a key.",
    examples: [{ command: "TYPE mykey", description: "Check type." }],
    safety: "safe",
  }),

  // ----- PUB/SUB (3) -----
  cmd({
    name: "PUBLISH",
    group: "pubsub",
    syntax: "PUBLISH channel message",
    args: [
      { name: "channel", type: "channel", description: "The channel name." },
      { name: "message", type: "value", description: "The message body." },
    ],
    returns: "Number of clients that received the message.",
    complexity: "O(N+M) where N is subscribers and M is pattern subscriptions.",
    since: "2.0.0",
    description: "Post a message to a channel.",
    examples: [{ command: 'PUBLISH news "hello"', description: "Broadcast hello on news." }],
    safety: "safe",
  }),
  cmd({
    name: "SUBSCRIBE",
    group: "pubsub",
    syntax: "SUBSCRIBE channel [channel ...]",
    args: [{ name: "channel", type: "channel", variadic: true, description: "Channels to subscribe to." }],
    returns: "Subscribes the client; enters a listening mode.",
    complexity: "O(N) where N is the number of channels.",
    since: "2.0.0",
    description: "Listen for messages published to the given channels.",
    examples: [{ command: "SUBSCRIBE news", description: "Subscribe to news." }],
    safety: "safe",
  }),
  cmd({
    name: "UNSUBSCRIBE",
    group: "pubsub",
    syntax: "UNSUBSCRIBE [channel ...]",
    args: [{ name: "channel", type: "channel", optional: true, variadic: true, description: "Channels to leave; omit for all." }],
    returns: "Confirms unsubscribed channels.",
    complexity: "O(N) where N is the number of channels.",
    since: "2.0.0",
    description: "Stop listening for messages posted to channels.",
    examples: [{ command: "UNSUBSCRIBE news", description: "Leave news channel." }],
    safety: "safe",
  }),

  // ----- STREAM (3) -----
  cmd({
    name: "XADD",
    group: "stream",
    syntax: "XADD key [NOMKSTREAM] [MAXLEN|MINID [~|=] threshold [LIMIT count]] *|ID field value [field value ...]",
    args: [
      { name: "key", type: "key", description: "The stream key." },
      { name: "id", type: "string", description: "Entry ID (* for auto)." },
      { name: "fields", type: "field", variadic: true, description: "Field/value pairs." },
    ],
    returns: "The ID of the added entry.",
    complexity: "O(1) when no trimming; O(N) with MAXLEN trimming.",
    since: "5.0.0",
    description: "Append a new entry to a stream.",
    examples: [{ command: 'XADD events * type "login" user 42', description: "Add login event." }],
    safety: "safe",
  }),
  cmd({
    name: "XLEN",
    group: "stream",
    syntax: "XLEN key",
    args: [{ name: "key", type: "key", description: "The stream key." }],
    returns: "Number of entries in the stream.",
    complexity: "O(1)",
    since: "5.0.0",
    description: "Get the length of a stream.",
    examples: [{ command: "XLEN events", description: "Count stream entries." }],
    safety: "safe",
  }),
  cmd({
    name: "XRANGE",
    group: "stream",
    syntax: "XRANGE key start end [COUNT count]",
    args: [
      { name: "key", type: "key", description: "The stream key." },
      { name: "start", type: "string", description: "Start ID (- for oldest)." },
      { name: "end", type: "string", description: "End ID (+ for newest)." },
      { name: "count", type: "integer", optional: true, description: "Limit number of entries." },
    ],
    returns: "Array of entries with IDs and field/value pairs.",
    complexity: "O(N) where N is the number of entries returned.",
    since: "5.0.0",
    description: "Get stream entries within an ID range.",
    examples: [{ command: "XRANGE events - + COUNT 10", description: "First 10 entries." }],
    safety: "safe",
  }),

  // ----- CONNECTION (3) -----
  cmd({
    name: "AUTH",
    group: "connection",
    syntax: "AUTH [username] password",
    args: [
      { name: "username", type: "string", optional: true, description: "Username (ACL, Redis 6+)." },
      { name: "password", type: "value", description: "The password." },
    ],
    returns: "OK on success; error on failure.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Authenticate to the server.",
    examples: [{ command: 'AUTH default "secret"', description: "Authenticate as default user." }],
    safety: "warning",
  }),
  cmd({
    name: "PING",
    group: "connection",
    syntax: "PING [message]",
    args: [{ name: "message", type: "value", optional: true, description: "Optional message echoed back." }],
    returns: "PONG, or the message if provided.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Test server reachability.",
    examples: [{ command: "PING", description: "Health check." }],
    safety: "safe",
  }),
  cmd({
    name: "SELECT",
    group: "connection",
    syntax: "SELECT index",
    args: [{ name: "index", type: "integer", description: "Database index (0-15 by default)." }],
    returns: "OK",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Change the selected database for the current connection.",
    examples: [{ command: "SELECT 1", description: "Switch to DB 1." }],
    safety: "safe",
  }),

  // ----- SERVER (5) -----
  cmd({
    name: "INFO",
    group: "server",
    syntax: "INFO [section ...]",
    args: [{ name: "section", type: "string", optional: true, variadic: true, description: "server, clients, memory, stats, etc." }],
    returns: "Textual report of server state.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Get information and statistics about the server.",
    examples: [{ command: "INFO memory", description: "Show memory stats." }],
    safety: "warning",
  }),
  cmd({
    name: "DBSIZE",
    group: "server",
    syntax: "DBSIZE",
    args: [],
    returns: "Number of keys in the current database.",
    complexity: "O(1)",
    since: "1.0.0",
    description: "Return the number of keys in the current database.",
    examples: [{ command: "DBSIZE", description: "Count keys in current DB." }],
    safety: "safe",
  }),
  cmd({
    name: "FLUSHDB",
    group: "server",
    syntax: "FLUSHDB [ASYNC|SYNC]",
    args: [{ name: "mode", type: "string", optional: true, description: "ASYNC or SYNC flushing." }],
    returns: "OK",
    complexity: "O(N) where N is the number of keys in the database.",
    since: "1.0.0",
    description: "Remove all keys from the current database. Destructive — use with care.",
    examples: [{ command: "FLUSHDB ASYNC", description: "Async flush current DB." }],
    safety: "dangerous",
  }),
  cmd({
    name: "FLUSHALL",
    group: "server",
    syntax: "FLUSHALL [ASYNC|SYNC]",
    args: [{ name: "mode", type: "string", optional: true, description: "ASYNC or SYNC flushing." }],
    returns: "OK",
    complexity: "O(N) where N is the total number of keys across all databases.",
    since: "1.0.0",
    description: "Remove all keys from ALL databases. Highly destructive — never run in production.",
    examples: [{ command: "FLUSHALL", description: "Wipe every DB." }],
    safety: "dangerous",
  }),
  cmd({
    name: "BGSAVE",
    group: "server",
    syntax: "BGSAVE [SCHEDULE]",
    args: [{ name: "schedule", type: "string", optional: true, description: "SCHEDULE to defer if a save is in progress." }],
    returns: "Background saving started.",
    complexity: "O(1) to start; O(N) for the actual save.",
    since: "1.0.0",
    description: "Asynchronously save the dataset to disk in the background.",
    examples: [{ command: "BGSAVE", description: "Trigger background save." }],
    safety: "warning",
  }),

  // ----- TRANSACTION (3) -----
  cmd({
    name: "MULTI",
    group: "transaction",
    syntax: "MULTI",
    args: [],
    returns: "OK",
    complexity: "O(1)",
    since: "1.2.0",
    description: "Mark the start of a transaction block. Subsequent commands are queued.",
    examples: [{ command: "MULTI", description: "Start a transaction." }],
    safety: "safe",
  }),
  cmd({
    name: "EXEC",
    group: "transaction",
    syntax: "EXEC",
    args: [],
    returns: "Array of replies for all queued commands.",
    complexity: "Depends on queued commands.",
    since: "1.2.0",
    description: "Execute all queued commands in a transaction.",
    examples: [{ command: "EXEC", description: "Run queued commands." }],
    safety: "safe",
  }),
  cmd({
    name: "WATCH",
    group: "transaction",
    syntax: "WATCH key [key ...]",
    args: [{ name: "key", type: "key", variadic: true, description: "Keys to watch for changes." }],
    returns: "OK",
    complexity: "O(1)",
    since: "2.2.0",
    description: "Watch keys to conditionally execute a transaction (optimistic locking).",
    examples: [{ command: "WATCH mykey", description: "Watch mykey for changes." }],
    safety: "safe",
  }),

  // ----- SCRIPTING (2) -----
  cmd({
    name: "EVAL",
    group: "scripting",
    syntax: "EVAL script numkeys [key ...] [arg ...]",
    args: [
      { name: "script", type: "value", description: "The Lua script source." },
      { name: "numkeys", type: "integer", description: "Number of keys passed." },
      { name: "key", type: "key", optional: true, variadic: true, description: "Keys available via KEYS[1..N]." },
      { name: "arg", type: "value", optional: true, variadic: true, description: "Args available via ARGV[1..N]." },
    ],
    returns: "Whatever the script returns.",
    complexity: "Depends on the script.",
    since: "2.6.0",
    description: "Execute a Lua script server-side.",
    examples: [{ command: 'EVAL "return 1" 0', description: "Run a trivial script." }],
    safety: "warning",
  }),
  cmd({
    name: "SCRIPT FLUSH",
    group: "scripting",
    syntax: "SCRIPT FLUSH [ASYNC|SYNC]",
    args: [{ name: "mode", type: "string", optional: true, description: "ASYNC or SYNC." }],
    returns: "OK",
    complexity: "O(N) where N is the number of cached scripts.",
    since: "2.6.0",
    description: "Flush the Lua script cache.",
    examples: [{ command: "SCRIPT FLUSH", description: "Clear script cache." }],
    safety: "warning",
  }),

  // ----- HYPERLOGLOG (2) -----
  cmd({
    name: "PFADD",
    group: "hyperloglog",
    syntax: "PFADD key [element [element ...]]",
    args: [
      { name: "key", type: "key", description: "The HLL key." },
      { name: "element", type: "value", optional: true, variadic: true, description: "Elements to add." },
    ],
    returns: "1 if at least one HyperLogLog register was altered; 0 otherwise.",
    complexity: "O(1) per call.",
    since: "2.8.9",
    description: "Add elements to a HyperLogLog (probabilistic cardinality estimator).",
    examples: [{ command: 'PFADD uniques "user1" "user2"', description: "Add two uniques." }],
    safety: "safe",
  }),
  cmd({
    name: "PFCOUNT",
    group: "hyperloglog",
    syntax: "PFCOUNT key [key ...]",
    args: [{ name: "key", type: "key", variadic: true, description: "HLL key(s)." }],
    returns: "Approximate cardinality of the set(s).",
    complexity: "O(1) per single HLL; O(N) when merging multiple.",
    since: "2.8.9",
    description: "Get the approximate cardinality of one or more HyperLogLogs.",
    examples: [{ command: "PFCOUNT uniques", description: "Count unique visitors." }],
    safety: "safe",
  }),

  // ----- GEO (2) -----
  cmd({
    name: "GEOADD",
    group: "geo",
    syntax: "GEOADD key [NX|XX] [CH] longitude latitude member [longitude latitude member ...]",
    args: [
      { name: "key", type: "key", description: "The geo set key." },
      { name: "longitude", type: "float", variadic: true, description: "Pairs of (lng, lat, member)." },
      { name: "latitude", type: "float", variadic: true, description: "Pairs of (lng, lat, member)." },
      { name: "member", type: "value", variadic: true, description: "Pairs of (lng, lat, member)." },
    ],
    returns: "Number of new elements added.",
    complexity: "O(log(N)) per element added.",
    since: "3.2.0",
    description: "Add geospatial items (lng, lat, name) to a sorted set, indexed via geohash.",
    examples: [{ command: 'GEOADD places -122.41 37.78 "SF"', description: "Add San Francisco." }],
    safety: "safe",
  }),
  cmd({
    name: "GEODIST",
    group: "geo",
    syntax: "GEODIST key member1 member2 [m|km|ft|mi]",
    args: [
      { name: "key", type: "key", description: "The geo set key." },
      { name: "member1", type: "value", description: "First member." },
      { name: "member2", type: "value", description: "Second member." },
      { name: "unit", type: "string", optional: true, description: "m, km, ft, mi." },
    ],
    returns: "Distance as a string, or nil if missing.",
    complexity: "O(log(N))",
    since: "3.2.0",
    description: "Get the distance between two members of a geospatial set.",
    examples: [{ command: 'GEODIST places "SF" "LA" km', description: "Distance in km." }],
    safety: "safe",
  }),

  // ----- CLUSTER (2) -----
  cmd({
    name: "CLUSTER INFO",
    group: "cluster",
    syntax: "CLUSTER INFO",
    args: [],
    returns: "Cluster state, slot assignment, and stats as text.",
    complexity: "O(1)",
    since: "3.0.0",
    description: "Provide info about Redis Cluster vital parameters.",
    examples: [{ command: "CLUSTER INFO", description: "Check cluster health." }],
    safety: "safe",
  }),
  cmd({
    name: "CLUSTER NODES",
    group: "cluster",
    syntax: "CLUSTER NODES",
    args: [],
    returns: "Cluster topology as a text table.",
    complexity: "O(N) where N is the number of nodes.",
    since: "3.0.0",
    description: "Get cluster configuration for the node's view of the cluster.",
    examples: [{ command: "CLUSTER NODES", description: "List all nodes." }],
    safety: "safe",
  }),
];

// ---------------------------------------------------------------------------
// Lookup & search
// ---------------------------------------------------------------------------

export function normalizeCommandName(s: string): string {
  return (s ?? "").trim().toUpperCase();
}

export function lookupCommand(name: string): RedisCommand | null {
  const upper = normalizeCommandName(name);
  return REDIS_COMMANDS.find((c) => c.name === upper) ?? null;
}

export function searchCommands(filters: SearchFilters = {}): RedisCommand[] {
  const q = (filters.query ?? "").trim().toLowerCase();
  const group = filters.group ?? "";
  const safety = filters.safety ?? "";
  const minVersion = filters.minVersion?.trim();

  return REDIS_COMMANDS.filter((c) => {
    if (group && c.group !== group) return false;
    if (safety && c.safety !== safety) return false;
    if (minVersion && !versionGte(c.since, minVersion)) return false;
    if (q) {
      const hay = `${c.name} ${c.description} ${c.group} ${c.syntax}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

/** Compare two dotted version strings like "2.8.9" >= "2.6". */
export function versionGte(actual: string, required: string): boolean {
  const a = actual.split(".").map((x) => parseInt(x, 10) || 0);
  const b = required.split(".").map((x) => parseInt(x, 10) || 0);
  const max = Math.max(a.length, b.length);
  for (let i = 0; i < max; i++) {
    const av = a[i] ?? 0;
    const bv = b[i] ?? 0;
    if (av > bv) return true;
    if (av < bv) return false;
  }
  return true;
}

export interface GroupCount {
  group: RedisGroup;
  label: string;
  count: number;
}

export function getGroupCounts(commands: RedisCommand[] = REDIS_COMMANDS): GroupCount[] {
  const map = new Map<RedisGroup, number>();
  for (const c of commands) {
    map.set(c.group, (map.get(c.group) ?? 0) + 1);
  }
  return COMMAND_GROUPS.map((g) => ({
    group: g.value,
    label: g.label,
    count: map.get(g.value) ?? 0,
  }));
}

// ---------------------------------------------------------------------------
// CLI quoting & parsing
// ---------------------------------------------------------------------------

export function quoteArg(value: string | number): string {
  const s = String(value ?? "");
  if (s === "") return '""';
  if (/[\s"']/.test(s)) {
    return '"' + s.replace(/"/g, '\\"') + '"';
  }
  return s;
}

export function buildCliCommand(name: string, args: (string | number)[]): string {
  const upper = normalizeCommandName(name);
  const parts = [upper, ...args.map((a) => quoteArg(a))];
  return parts.join(" ");
}

export function parseCliCommand(input: string): ParseResult | null {
  const s = (input ?? "").trim();
  if (!s) return null;

  const tokens: string[] = [];
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /\s/.test(s[i])) i++;
    if (i >= s.length) break;
    const ch = s[i];
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let t = "";
      while (i < s.length && s[i] !== quote) {
        if (s[i] === "\\" && i + 1 < s.length) {
          t += s[i + 1];
          i += 2;
        } else {
          t += s[i];
          i++;
        }
      }
      i++;
      tokens.push(t);
    } else {
      let t = "";
      while (i < s.length && !/\s/.test(s[i])) {
        t += s[i];
        i++;
      }
      tokens.push(t);
    }
  }
  if (tokens.length === 0) return null;
  return { name: normalizeCommandName(tokens[0]), args: tokens.slice(1) };
}

// ---------------------------------------------------------------------------
// Argument validation
// ---------------------------------------------------------------------------

export function validateArgs(command: RedisCommand, args: string[]): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const required = command.args.filter((a) => !a.optional);
  const requiredCount = required.length;

  // For variadic args, the count of "slots" can be flexible. We treat
  // the last variadic positional slot as the rest.
  if (args.length < requiredCount) {
    errors.push(
      `Missing required arguments: expected at least ${requiredCount} but got ${args.length}.`,
    );
  }

  // Type checks against declared arg types — best-effort.
  for (let i = 0; i < args.length; i++) {
    const decl = command.args[Math.min(i, command.args.length - 1)];
    if (!decl) continue;
    const v = args[i];

    if (decl.type === "integer" && !/^-?\d+$/.test(v)) {
      errors.push(`Argument '${decl.name}' (position ${i + 1}) must be an integer; got '${v}'.`);
    }
    if (decl.type === "float" && !/^-?\d+(\.\d+)?$/.test(v)) {
      errors.push(`Argument '${decl.name}' (position ${i + 1}) must be a number; got '${v}'.`);
    }
    if (decl.type === "score" && !/^-?\d+(\.\d+)?$/.test(v)) {
      errors.push(`Argument '${decl.name}' (position ${i + 1}) must be a score (number); got '${v}'.`);
    }
  }

  // Safety warnings.
  if (command.safety === "dangerous") {
    warnings.push(
      `DANGEROUS: ${command.name} can cause data loss. Avoid in production.`,
    );
  } else if (command.safety === "warning") {
    warnings.push(`${command.name} may be slow or risky on large datasets.`);
  }
  if (command.name === "KEYS") {
    warnings.push("Prefer SCAN over KEYS in production — KEYS blocks the server.");
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ---------------------------------------------------------------------------
// Client code generation
// ---------------------------------------------------------------------------

function jsString(s: string | number): string {
  return "'" + String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

function pyString(s: string | number): string {
  return "'" + String(s ?? "").replace(/\\/g, "\\\\").replace(/'/g, "\\'") + "'";
}

function javaString(s: string | number): string {
  return '"' + String(s ?? "").replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
}

export function generateClientCode(
  command: RedisCommand,
  args: string[],
  language: ClientLanguage,
): string {
  const cli = buildCliCommand(command.name, args);

  if (language === "redis-cli") return cli;

  if (language === "node-redis") {
    return generateNodeRedis(command, args);
  }
  if (language === "redis-py") {
    return generateRedisPy(command, args);
  }
  // jedis
  return generateJedis(command, args);
}

function generateNodeRedis(command: RedisCommand, args: string[]): string {
  const name = command.name;
  const a = args;

  switch (name) {
    case "SET":
      if (a.length >= 2) return `await client.set(${jsString(a[0])}, ${jsString(a[1])});`;
      break;
    case "GET":
      if (a.length >= 1) return `await client.get(${jsString(a[0])});`;
      break;
    case "MSET":
      if (a.length >= 2 && a.length % 2 === 0) {
        const pairs: string[] = [];
        for (let i = 0; i < a.length; i += 2) pairs.push(`${jsString(a[i])}, ${jsString(a[i + 1])}`);
        return `await client.mSet(${pairs.join(", ")});`;
      }
      break;
    case "MGET":
      if (a.length >= 1) return `await client.mGet([${a.map(jsString).join(", ")}]);`;
      break;
    case "SETNX":
      if (a.length >= 2) return `await client.setNX(${jsString(a[0])}, ${jsString(a[1])});`;
      break;
    case "INCR":
      if (a.length >= 1) return `await client.incr(${jsString(a[0])});`;
      break;
    case "DECR":
      if (a.length >= 1) return `await client.decr(${jsString(a[0])});`;
      break;
    case "APPEND":
      if (a.length >= 2) return `await client.append(${jsString(a[0])}, ${jsString(a[1])});`;
      break;
    case "LPUSH":
      if (a.length >= 2) return `await client.lPush(${jsString(a[0])}, [${a.slice(1).map(jsString).join(", ")}]);`;
      break;
    case "RPUSH":
      if (a.length >= 2) return `await client.rPush(${jsString(a[0])}, [${a.slice(1).map(jsString).join(", ")}]);`;
      break;
    case "LRANGE":
      if (a.length >= 3) return `await client.lRange(${jsString(a[0])}, ${a[1]}, ${a[2]});`;
      break;
    case "LLEN":
      if (a.length >= 1) return `await client.lLen(${jsString(a[0])});`;
      break;
    case "LPOP":
      if (a.length >= 1) return `await client.lPop(${jsString(a[0])}${a.length >= 2 ? `, ${a[1]}` : ""});`;
      break;
    case "RPOP":
      if (a.length >= 1) return `await client.rPop(${jsString(a[0])}${a.length >= 2 ? `, ${a[1]}` : ""});`;
      break;
    case "SADD":
      if (a.length >= 2) return `await client.sAdd(${jsString(a[0])}, [${a.slice(1).map(jsString).join(", ")}]);`;
      break;
    case "SREM":
      if (a.length >= 2) return `await client.sRem(${jsString(a[0])}, [${a.slice(1).map(jsString).join(", ")}]);`;
      break;
    case "SMEMBERS":
      if (a.length >= 1) return `await client.sMembers(${jsString(a[0])});`;
      break;
    case "SISMEMBER":
      if (a.length >= 2) return `await client.sIsMember(${jsString(a[0])}, ${jsString(a[1])});`;
      break;
    case "SCARD":
      if (a.length >= 1) return `await client.sCard(${jsString(a[0])});`;
      break;
    case "SINTER":
      if (a.length >= 1) return `await client.sInter([${a.map(jsString).join(", ")}]);`;
      break;
    case "HSET":
      if (a.length >= 3 && a.length % 2 === 1) {
        const pairs: string[] = [];
        for (let i = 1; i < a.length; i += 2) pairs.push(`${jsString(a[i])}: ${jsString(a[i + 1])}`);
        return `await client.hSet(${jsString(a[0])}, { ${pairs.join(", ")} });`;
      }
      break;
    case "HGET":
      if (a.length >= 2) return `await client.hGet(${jsString(a[0])}, ${jsString(a[1])});`;
      break;
    case "HGETALL":
      if (a.length >= 1) return `await client.hGetAll(${jsString(a[0])});`;
      break;
    case "HDEL":
      if (a.length >= 2) return `await client.hDel(${jsString(a[0])}, [${a.slice(1).map(jsString).join(", ")}]);`;
      break;
    case "HLEN":
      if (a.length >= 1) return `await client.hLen(${jsString(a[0])});`;
      break;
    case "HEXISTS":
      if (a.length >= 2) return `await client.hExists(${jsString(a[0])}, ${jsString(a[1])});`;
      break;
    case "ZADD":
      if (a.length >= 3 && a.length % 2 === 1) {
        const pairs: string[] = [];
        for (let i = 1; i < a.length; i += 2) pairs.push(`{ score: ${a[i]}, value: ${jsString(a[i + 1])} }`);
        return `await client.zAdd(${jsString(a[0])}, [${pairs.join(", ")}]);`;
      }
      break;
    case "ZRANGE":
      if (a.length >= 3) return `await client.zRange(${jsString(a[0])}, ${a[1]}, ${a[2]}${a.includes("WITHSCORES") ? ", { withScores: true }" : ""});`;
      break;
    case "ZSCORE":
      if (a.length >= 2) return `await client.zScore(${jsString(a[0])}, ${jsString(a[1])});`;
      break;
    case "ZREM":
      if (a.length >= 2) return `await client.zRem(${jsString(a[0])}, [${a.slice(1).map(jsString).join(", ")}]);`;
      break;
    case "ZCARD":
      if (a.length >= 1) return `await client.zCard(${jsString(a[0])});`;
      break;
    case "ZINCRBY":
      if (a.length >= 3) return `await client.zIncrBy(${jsString(a[0])}, ${a[1]}, ${jsString(a[2])});`;
      break;
    case "DEL":
      if (a.length >= 1) return `await client.del([${a.map(jsString).join(", ")}]);`;
      break;
    case "EXISTS":
      if (a.length >= 1) return `await client.exists([${a.map(jsString).join(", ")}]);`;
      break;
    case "EXPIRE":
      if (a.length >= 2) return `await client.expire(${jsString(a[0])}, ${a[1]});`;
      break;
    case "TTL":
      if (a.length >= 1) return `await client.ttl(${jsString(a[0])});`;
      break;
    case "PERSIST":
      if (a.length >= 1) return `await client.persist(${jsString(a[0])});`;
      break;
    case "KEYS":
      if (a.length >= 1) return `await client.keys(${jsString(a[0])});`;
      break;
    case "SCAN":
      return `// SCAN is iterative in node-redis; use for await (const k of client.scanIterator({ MATCH: ${a[1] ? jsString(a[1]) : '"*"'}, COUNT: ${a[3] ?? 100} })) console.log(k);`;
    case "TYPE":
      if (a.length >= 1) return `await client.type(${jsString(a[0])});`;
      break;
    case "PUBLISH":
      if (a.length >= 2) return `await client.publish(${jsString(a[0])}, ${jsString(a[1])});`;
      break;
    case "XADD":
      if (a.length >= 2) {
        const fields: string[] = [];
        for (let i = 2; i < a.length; i += 2) {
          if (a[i] && a[i + 1]) fields.push(`${jsString(a[i])}: ${jsString(a[i + 1])}`);
        }
        return `await client.xAdd(${jsString(a[0])}, ${jsString(a[1])}, { ${fields.join(", ")} });`;
      }
      break;
    case "XLEN":
      if (a.length >= 1) return `await client.xLen(${jsString(a[0])});`;
      break;
    case "PING":
      return `await client.ping();`;
    case "DBSIZE":
      return `await client.dbSize();`;
    case "FLUSHDB":
      return `await client.flushDb();`;
    case "FLUSHALL":
      return `await client.flushAll();`;
    default:
      break;
  }

  // Fallback: sendCommand with raw tokens.
  const tokens = [jsString(name), ...args.map(jsString)];
  return `await client.sendCommand([${tokens.join(", ")}]);`;
}

function generateRedisPy(command: RedisCommand, args: string[]): string {
  const name = command.name;
  const a = args;
  const pyArgs = a.map(pyString).join(", ");

  switch (name) {
    case "SET":
      if (a.length >= 2) return `r.set(${pyString(a[0])}, ${pyString(a[1])})`;
      break;
    case "GET":
      if (a.length >= 1) return `r.get(${pyString(a[0])})`;
      break;
    case "MSET":
      if (a.length >= 2 && a.length % 2 === 0) {
        const d: string[] = [];
        for (let i = 0; i < a.length; i += 2) d.push(`${pyString(a[i])}: ${pyString(a[i + 1])}`);
        return `r.mset({${d.join(", ")}})`;
      }
      break;
    case "MGET":
      if (a.length >= 1) return `r.mget([${a.map(pyString).join(", ")}])`;
      break;
    case "SETNX":
      if (a.length >= 2) return `r.setnx(${pyString(a[0])}, ${pyString(a[1])})`;
      break;
    case "INCR":
      if (a.length >= 1) return `r.incr(${pyString(a[0])})`;
      break;
    case "DECR":
      if (a.length >= 1) return `r.decr(${pyString(a[0])})`;
      break;
    case "APPEND":
      if (a.length >= 2) return `r.append(${pyString(a[0])}, ${pyString(a[1])})`;
      break;
    case "LPUSH":
      if (a.length >= 2) return `r.lpush(${pyString(a[0])}, ${a.slice(1).map(pyString).join(", ")})`;
      break;
    case "RPUSH":
      if (a.length >= 2) return `r.rpush(${pyString(a[0])}, ${a.slice(1).map(pyString).join(", ")})`;
      break;
    case "LRANGE":
      if (a.length >= 3) return `r.lrange(${pyString(a[0])}, ${a[1]}, ${a[2]})`;
      break;
    case "LLEN":
      if (a.length >= 1) return `r.llen(${pyString(a[0])})`;
      break;
    case "LPOP":
      if (a.length >= 1) return `r.lpop(${pyString(a[0])}${a.length >= 2 ? `, ${a[1]}` : ""})`;
      break;
    case "RPOP":
      if (a.length >= 1) return `r.rpop(${pyString(a[0])}${a.length >= 2 ? `, ${a[1]}` : ""})`;
      break;
    case "SADD":
      if (a.length >= 2) return `r.sadd(${pyString(a[0])}, ${a.slice(1).map(pyString).join(", ")})`;
      break;
    case "SREM":
      if (a.length >= 2) return `r.srem(${pyString(a[0])}, ${a.slice(1).map(pyString).join(", ")})`;
      break;
    case "SMEMBERS":
      if (a.length >= 1) return `r.smembers(${pyString(a[0])})`;
      break;
    case "SISMEMBER":
      if (a.length >= 2) return `r.sismember(${pyString(a[0])}, ${pyString(a[1])})`;
      break;
    case "SCARD":
      if (a.length >= 1) return `r.scard(${pyString(a[0])})`;
      break;
    case "SINTER":
      if (a.length >= 1) return `r.sinter(${a.map(pyString).join(", ")})`;
      break;
    case "HSET":
      if (a.length >= 3 && a.length % 2 === 1) {
        const d: string[] = [];
        for (let i = 1; i < a.length; i += 2) d.push(`${pyString(a[i])}: ${pyString(a[i + 1])}`);
        return `r.hset(${pyString(a[0])}, mapping={${d.join(", ")}})`;
      }
      break;
    case "HGET":
      if (a.length >= 2) return `r.hget(${pyString(a[0])}, ${pyString(a[1])})`;
      break;
    case "HGETALL":
      if (a.length >= 1) return `r.hgetall(${pyString(a[0])})`;
      break;
    case "HDEL":
      if (a.length >= 2) return `r.hdel(${pyString(a[0])}, ${a.slice(1).map(pyString).join(", ")})`;
      break;
    case "HLEN":
      if (a.length >= 1) return `r.hlen(${pyString(a[0])})`;
      break;
    case "HEXISTS":
      if (a.length >= 2) return `r.hexists(${pyString(a[0])}, ${pyString(a[1])})`;
      break;
    case "ZADD":
      if (a.length >= 3 && a.length % 2 === 1) {
        const d: string[] = [];
        for (let i = 1; i < a.length; i += 2) d.push(`${pyString(a[i + 1])}: ${a[i]}`);
        return `r.zadd(${pyString(a[0])}, {${d.join(", ")}})`;
      }
      break;
    case "ZRANGE":
      if (a.length >= 3) return `r.zrange(${pyString(a[0])}, ${a[1]}, ${a[2]}${a.includes("WITHSCORES") ? ", withscores=True" : ""})`;
      break;
    case "ZSCORE":
      if (a.length >= 2) return `r.zscore(${pyString(a[0])}, ${pyString(a[1])})`;
      break;
    case "ZREM":
      if (a.length >= 2) return `r.zrem(${pyString(a[0])}, ${a.slice(1).map(pyString).join(", ")})`;
      break;
    case "ZCARD":
      if (a.length >= 1) return `r.zcard(${pyString(a[0])})`;
      break;
    case "ZINCRBY":
      if (a.length >= 3) return `r.zincrby(${pyString(a[0])}, ${a[1]}, ${pyString(a[2])})`;
      break;
    case "DEL":
      if (a.length >= 1) return `r.delete(${a.map(pyString).join(", ")})`;
      break;
    case "EXISTS":
      if (a.length >= 1) return `r.exists(${a.map(pyString).join(", ")})`;
      break;
    case "EXPIRE":
      if (a.length >= 2) return `r.expire(${pyString(a[0])}, ${a[1]})`;
      break;
    case "TTL":
      if (a.length >= 1) return `r.ttl(${pyString(a[0])})`;
      break;
    case "PERSIST":
      if (a.length >= 1) return `r.persist(${pyString(a[0])})`;
      break;
    case "KEYS":
      if (a.length >= 1) return `r.keys(${pyString(a[0])})`;
      break;
    case "SCAN":
      return `# Use scan_iter in redis-py\nfor key in r.scan_iter(match=${a[1] ? pyString(a[1]) : '"*"'}, count=${a[3] ?? 100}):\n    print(key)`;
    case "TYPE":
      if (a.length >= 1) return `r.type(${pyString(a[0])})`;
      break;
    case "PUBLISH":
      if (a.length >= 2) return `r.publish(${pyString(a[0])}, ${pyString(a[1])})`;
      break;
    case "XADD":
      if (a.length >= 2) {
        const d: string[] = [];
        for (let i = 2; i < a.length; i += 2) {
          if (a[i] && a[i + 1]) d.push(`${pyString(a[i])}: ${pyString(a[i + 1])}`);
        }
        return `r.xadd(${pyString(a[0])}, {${d.join(", ")}}, id=${pyString(a[1])})`;
      }
      break;
    case "XLEN":
      if (a.length >= 1) return `r.xlen(${pyString(a[0])})`;
      break;
    case "PING":
      return `r.ping()`;
    case "DBSIZE":
      return `r.dbsize()`;
    case "FLUSHDB":
      return `r.flushdb()`;
    case "FLUSHALL":
      return `r.flushall()`;
    default:
      break;
  }

  // Fallback.
  return `r.execute_command(${pyString(name)}${a.length > 0 ? ", " + a.map(pyString).join(", ") : ""})`;
}

function generateJedis(command: RedisCommand, args: string[]): string {
  const name = command.name;
  const a = args;
  const jArgs = a.map(javaString).join(", ");

  switch (name) {
    case "SET":
      if (a.length >= 2) return `jedis.set(${javaString(a[0])}, ${javaString(a[1])});`;
      break;
    case "GET":
      if (a.length >= 1) return `jedis.get(${javaString(a[0])});`;
      break;
    case "MSET":
      if (a.length >= 2 && a.length % 2 === 0) return `jedis.mset(${jArgs});`;
      break;
    case "MGET":
      if (a.length >= 1) return `jedis.mget(${jArgs});`;
      break;
    case "SETNX":
      if (a.length >= 2) return `jedis.setnx(${javaString(a[0])}, ${javaString(a[1])});`;
      break;
    case "INCR":
      if (a.length >= 1) return `jedis.incr(${javaString(a[0])});`;
      break;
    case "DECR":
      if (a.length >= 1) return `jedis.decr(${javaString(a[0])});`;
      break;
    case "APPEND":
      if (a.length >= 2) return `jedis.append(${javaString(a[0])}, ${javaString(a[1])});`;
      break;
    case "LPUSH":
      if (a.length >= 2) return `jedis.lpush(${javaString(a[0])}, ${a.slice(1).map(javaString).join(", ")});`;
      break;
    case "RPUSH":
      if (a.length >= 2) return `jedis.rpush(${javaString(a[0])}, ${a.slice(1).map(javaString).join(", ")});`;
      break;
    case "LRANGE":
      if (a.length >= 3) return `jedis.lrange(${javaString(a[0])}, ${a[1]}, ${a[2]});`;
      break;
    case "LLEN":
      if (a.length >= 1) return `jedis.llen(${javaString(a[0])});`;
      break;
    case "LPOP":
      if (a.length >= 1) return `jedis.lpop(${javaString(a[0])});`;
      break;
    case "RPOP":
      if (a.length >= 1) return `jedis.rpop(${javaString(a[0])});`;
      break;
    case "SADD":
      if (a.length >= 2) return `jedis.sadd(${javaString(a[0])}, ${a.slice(1).map(javaString).join(", ")});`;
      break;
    case "SREM":
      if (a.length >= 2) return `jedis.srem(${javaString(a[0])}, ${a.slice(1).map(javaString).join(", ")});`;
      break;
    case "SMEMBERS":
      if (a.length >= 1) return `jedis.smembers(${javaString(a[0])});`;
      break;
    case "SISMEMBER":
      if (a.length >= 2) return `jedis.sismember(${javaString(a[0])}, ${javaString(a[1])});`;
      break;
    case "SCARD":
      if (a.length >= 1) return `jedis.scard(${javaString(a[0])});`;
      break;
    case "SINTER":
      if (a.length >= 1) return `jedis.sinter(${a.map(javaString).join(", ")});`;
      break;
    case "HSET":
      if (a.length >= 3) return `jedis.hset(${javaString(a[0])}, ${javaString(a[1])}, ${javaString(a[2])});`;
      break;
    case "HGET":
      if (a.length >= 2) return `jedis.hget(${javaString(a[0])}, ${javaString(a[1])});`;
      break;
    case "HGETALL":
      if (a.length >= 1) return `jedis.hgetAll(${javaString(a[0])});`;
      break;
    case "HDEL":
      if (a.length >= 2) return `jedis.hdel(${javaString(a[0])}, ${a.slice(1).map(javaString).join(", ")});`;
      break;
    case "HLEN":
      if (a.length >= 1) return `jedis.hlen(${javaString(a[0])});`;
      break;
    case "HEXISTS":
      if (a.length >= 2) return `jedis.hexists(${javaString(a[0])}, ${javaString(a[1])});`;
      break;
    case "ZADD":
      if (a.length >= 3) return `jedis.zadd(${javaString(a[0])}, ${a[1]}, ${javaString(a[2])});`;
      break;
    case "ZRANGE":
      if (a.length >= 3) return `jedis.zrange(${javaString(a[0])}, ${a[1]}, ${a[2]});`;
      break;
    case "ZSCORE":
      if (a.length >= 2) return `jedis.zscore(${javaString(a[0])}, ${javaString(a[1])});`;
      break;
    case "ZREM":
      if (a.length >= 2) return `jedis.zrem(${javaString(a[0])}, ${a.slice(1).map(javaString).join(", ")});`;
      break;
    case "ZCARD":
      if (a.length >= 1) return `jedis.zcard(${javaString(a[0])});`;
      break;
    case "ZINCRBY":
      if (a.length >= 3) return `jedis.zincrby(${javaString(a[0])}, ${a[1]}, ${javaString(a[2])});`;
      break;
    case "DEL":
      if (a.length >= 1) return `jedis.del(${a.map(javaString).join(", ")});`;
      break;
    case "EXISTS":
      if (a.length >= 1) return `jedis.exists(${a.map(javaString).join(", ")});`;
      break;
    case "EXPIRE":
      if (a.length >= 2) return `jedis.expire(${javaString(a[0])}, ${a[1]});`;
      break;
    case "TTL":
      if (a.length >= 1) return `jedis.ttl(${javaString(a[0])});`;
      break;
    case "PERSIST":
      if (a.length >= 1) return `jedis.persist(${javaString(a[0])});`;
      break;
    case "KEYS":
      if (a.length >= 1) return `jedis.keys(${javaString(a[0])});`;
      break;
    case "TYPE":
      if (a.length >= 1) return `jedis.type(${javaString(a[0])});`;
      break;
    case "PUBLISH":
      if (a.length >= 2) return `jedis.publish(${javaString(a[0])}, ${javaString(a[1])});`;
      break;
    case "PING":
      return `jedis.ping();`;
    case "DBSIZE":
      return `jedis.dbSize();`;
    case "FLUSHDB":
      return `jedis.flushDB();`;
    case "FLUSHALL":
      return `jedis.flushAll();`;
    default:
      break;
  }

  // Fallback: sendCommand with raw tokens.
  const tokens = [javaString(name), ...args.map(javaString)];
  return `jedis.sendCommand(Protocol.Command.${name.replace(/\s+/g, "_")}, ${tokens.slice(1).join(", ")});`;
}

// ---------------------------------------------------------------------------
// High-level build entry point
// ---------------------------------------------------------------------------

export function buildAll(
  command: RedisCommand,
  args: string[],
): BuildResult {
  const v = validateArgs(command, args);
  if (!v.ok) return { ok: false, error: v.errors.join(" ") };

  const cli = buildCliCommand(command.name, args);
  const clients: Record<ClientLanguage, string> = {
    "redis-cli": cli,
    "node-redis": generateClientCode(command, args, "node-redis"),
    "redis-py": generateClientCode(command, args, "redis-py"),
    "jedis": generateClientCode(command, args, "jedis"),
  };
  return { ok: true, cli, clients, warnings: v.warnings };
}

// ---------------------------------------------------------------------------
// Safety helpers
// ---------------------------------------------------------------------------

export function getSafetyWarnings(command: RedisCommand): string[] {
  const out: string[] = [];
  if (command.safety === "dangerous") {
    out.push(`DANGEROUS: ${command.name} can cause data loss or service interruption. Avoid in production.`);
  } else if (command.safety === "warning") {
    out.push(`WARNING: ${command.name} may be slow or risky on large datasets.`);
  }
  if (command.name === "KEYS") {
    out.push("Prefer SCAN over KEYS in production — KEYS blocks the Redis server.");
  }
  if (command.deprecated) {
    out.push(`DEPRECATED: ${command.name} is deprecated; use ${command.replacement ?? "the recommended alternative"}.`);
  }
  return out;
}

export function formatComplexity(command: RedisCommand): string {
  return command.complexity;
}

// ---------------------------------------------------------------------------
// Markdown export
// ---------------------------------------------------------------------------

export function exportMarkdown(command: RedisCommand): string {
  const lines: string[] = [];
  lines.push(`# ${command.name}`);
  lines.push("");
  lines.push(`**Group:** ${GROUP_LABELS[command.group]}`);
  lines.push(`**Since:** ${command.since}`);
  lines.push(`**Complexity:** ${command.complexity}`);
  lines.push(`**Safety:** ${command.safety}`);
  lines.push("");
  lines.push(`## Syntax`);
  lines.push("");
  lines.push("```");
  lines.push(command.syntax);
  lines.push("```");
  lines.push("");
  lines.push(`## Description`);
  lines.push("");
  lines.push(command.description);
  lines.push("");
  if (command.args.length > 0) {
    lines.push(`## Arguments`);
    lines.push("");
    for (const a of command.args) {
      const flags = [a.optional ? "optional" : "required", a.variadic ? "variadic" : ""].filter(Boolean).join(", ");
      lines.push(`- \`${a.name}\` (${a.type}, ${flags}) — ${a.description}`);
    }
    lines.push("");
  }
  lines.push(`## Returns`);
  lines.push("");
  lines.push(command.returns);
  lines.push("");
  if (command.examples.length > 0) {
    lines.push(`## Examples`);
    lines.push("");
    for (const e of command.examples) {
      lines.push(`- ${e.description}`);
      lines.push("  ```");
      lines.push(`  ${e.command}`);
      lines.push("  ```");
    }
    lines.push("");
  }
  const warnings = getSafetyWarnings(command);
  if (warnings.length > 0) {
    lines.push(`## Warnings`);
    lines.push("");
    for (const w of warnings) lines.push(`> ${w}`);
    lines.push("");
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:redis-command-reference-builder:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  commandName: string;
  group: RedisGroup;
  cli: string;
  args: string[];
}

export function loadHistory(): HistoryEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(arr) ? arr.slice(0, HISTORY_MAX) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, HISTORY_MAX);
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearHistory(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Shareable URL
// ---------------------------------------------------------------------------

export function buildShareUrl(commandName: string, args: string[]): string {
  const params = new URLSearchParams();
  if (commandName) params.set("cmd", commandName);
  if (args.length > 0) params.set("args", args.join("\n"));
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export interface ParsedShare {
  commandName: string;
  args: string[];
}

export function parseShareUrl(hash: string): ParsedShare {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { commandName: "", args: [] };
  const params = new URLSearchParams(clean);
  const commandName = params.get("cmd") ?? "";
  const argsStr = params.get("args") ?? "";
  const args = argsStr ? argsStr.split("\n").map((s) => s).filter((s, i, arr) => s !== "" || i < arr.length - 1) : [];
  // Trim trailing empties.
  while (args.length > 0 && args[args.length - 1] === "") args.pop();
  return { commandName, args };
}

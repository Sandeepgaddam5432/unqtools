/**
 * man Page / TLDR Command Reference — pure logic.
 *
 * Bundled example-first TLDR pages for 60+ common CLI commands,
 * with command + task search, platform filter, see-also links,
 * favorites, recent history, and a deep-link to man7.org.
 *
 * Pure functions only — no DOM, no network.
 */

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type Platform = "common" | "linux" | "osx" | "windows" | "sunos";

export type CommandCategory =
  | "files"
  | "text"
  | "network"
  | "process"
  | "system"
  | "archive"
  | "package"
  | "user"
  | "git"
  | "misc";

export interface TldrExample {
  /** Code snippet (shell). */
  code: string;
  /** One-line plain-English explanation. */
  description: string;
  /** Optional platform override (defaults to the command's platforms). */
  platform?: Platform;
}

export interface TldrCommand {
  name: string;
  oneLine: string;
  category: CommandCategory;
  platforms: Platform[];
  examples: TldrExample[];
  seeAlso: string[];
  /** Task keywords used by `searchByTask` (e.g. 'compress', 'archive', 'download'). */
  keywords: string[];
}

export interface SearchOptions {
  platform?: Platform | "";
  category?: CommandCategory | "";
  /** Limit number of results. */
  limit?: number;
}

export interface GroupedCommands {
  category: CommandCategory;
  label: string;
  commands: TldrCommand[];
}

export interface CorpusStats {
  totalCommands: number;
  byCategory: Record<CommandCategory, number>;
  byPlatform: Record<Platform, number>;
  totalExamples: number;
  favoritesCount: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const PLATFORMS: Platform[] = ["common", "linux", "osx", "windows", "sunos"];

export const PLATFORM_LABELS: Record<Platform, string> = {
  common: "Common (Unix)",
  linux: "Linux",
  osx: "macOS",
  windows: "Windows",
  sunos: "SunOS / Solaris",
};

export const CATEGORY_LABELS: Record<CommandCategory, string> = {
  files: "Files & Directories",
  text: "Text Processing",
  network: "Network",
  process: "Process Management",
  system: "System Info",
  archive: "Archive / Compress",
  package: "Package Managers",
  user: "User & Permissions",
  git: "Git",
  misc: "Misc / Shell",
};

export const COMMAND_CATEGORIES = Object.keys(CATEGORY_LABELS) as CommandCategory[];

export const MAN_BASE_URL = "https://man7.org/linux/man-pages/man1";

export const CORPUS_SNAPSHOT_DATE = "2026-06";

// ---------------------------------------------------------------------------
// The bundled TLDR corpus (60+ commands, example-first).
// ---------------------------------------------------------------------------

export const COMMANDS: TldrCommand[] = [
  // ---- Files & Directories ----
  {
    name: "ls",
    oneLine: "List directory contents.",
    category: "files",
    platforms: ["common"],
    keywords: ["list", "directory", "files", "ls", "show"],
    seeAlso: ["tree", "stat", "find"],
    examples: [
      { code: "ls", description: "List files in the current directory." },
      { code: "ls -la", description: "Long format including hidden files." },
      { code: "ls -lh", description: "Long format with human-readable sizes." },
      { code: "ls -ltr", description: "Long format, sorted by modification time (oldest last)." },
      { code: "ls /etc", description: "List contents of /etc." },
    ],
  },
  {
    name: "cd",
    oneLine: "Change the current working directory.",
    category: "files",
    platforms: ["common"],
    keywords: ["change", "directory", "navigate", "cd", "go"],
    seeAlso: ["pwd", "pushd"],
    examples: [
      { code: "cd /var/log", description: "Go to /var/log." },
      { code: "cd", description: "Go to your home directory." },
      { code: "cd ..", description: "Go up one directory." },
      { code: "cd -", description: "Go back to the previous directory." },
    ],
  },
  {
    name: "pwd",
    oneLine: "Print the current working directory.",
    category: "files",
    platforms: ["common"],
    keywords: ["print", "current", "directory", "pwd", "where"],
    seeAlso: ["cd"],
    examples: [
      { code: "pwd", description: "Print the absolute path of the current directory." },
      { code: "pwd -P", description: "Print the physical path (resolve symlinks)." },
    ],
  },
  {
    name: "cp",
    oneLine: "Copy files and directories.",
    category: "files",
    platforms: ["common"],
    keywords: ["copy", "duplicate", "cp", "file"],
    seeAlso: ["mv", "rsync", "ln"],
    examples: [
      { code: "cp file.txt backup.txt", description: "Copy file.txt to backup.txt." },
      { code: "cp -r src/ dest/", description: "Recursively copy src/ into dest/." },
      { code: "cp -i file.txt dest/", description: "Copy, prompting before overwrite." },
      { code: "cp -p file.txt dest/", description: "Preserve mode, ownership, timestamps." },
    ],
  },
  {
    name: "mv",
    oneLine: "Move or rename files and directories.",
    category: "files",
    platforms: ["common"],
    keywords: ["move", "rename", "mv", "file"],
    seeAlso: ["cp", "rm"],
    examples: [
      { code: "mv old.txt new.txt", description: "Rename old.txt to new.txt." },
      { code: "mv file.txt /tmp/", description: "Move file.txt into /tmp/." },
      { code: "mv -i a.txt b.txt", description: "Move, prompting before overwrite." },
    ],
  },
  {
    name: "rm",
    oneLine: "Remove files or directories.",
    category: "files",
    platforms: ["common"],
    keywords: ["remove", "delete", "rm", "file"],
    seeAlso: ["rmdir", "trash"],
    examples: [
      { code: "rm file.txt", description: "Delete file.txt." },
      { code: "rm -r dir/", description: "Recursively delete a directory." },
      { code: "rm -f file.txt", description: "Force-delete without prompting." },
      { code: "rm -rf dir/", description: "Forcefully recursively delete (use with care)." },
    ],
  },
  {
    name: "mkdir",
    oneLine: "Create directories.",
    category: "files",
    platforms: ["common"],
    keywords: ["create", "directory", "mkdir", "folder"],
    seeAlso: ["rmdir", "cd"],
    examples: [
      { code: "mkdir notes", description: "Create a directory named notes." },
      { code: "mkdir -p a/b/c", description: "Create parents as needed; no error if exists." },
    ],
  },
  {
    name: "rmdir",
    oneLine: "Remove empty directories.",
    category: "files",
    platforms: ["common"],
    keywords: ["remove", "empty", "directory", "rmdir"],
    seeAlso: ["rm", "mkdir"],
    examples: [
      { code: "rmdir empty_dir", description: "Remove an empty directory." },
    ],
  },
  {
    name: "touch",
    oneLine: "Create empty files or update timestamps.",
    category: "files",
    platforms: ["common"],
    keywords: ["create", "empty", "file", "timestamp", "touch"],
    seeAlso: ["mkdir", "stat"],
    examples: [
      { code: "touch newfile.txt", description: "Create an empty file (or update its mtime)." },
      { code: "touch -t 202501010000 file.txt", description: "Set a specific timestamp." },
    ],
  },
  {
    name: "find",
    oneLine: "Search for files in a directory hierarchy.",
    category: "files",
    platforms: ["common"],
    keywords: ["search", "find", "files", "locate"],
    seeAlso: ["grep", "locate", "fd"],
    examples: [
      { code: "find . -name '*.log'", description: "Find all .log files under the current directory." },
      { code: "find /var -type d -name 'cache'", description: "Find directories named cache under /var." },
      { code: "find . -mtime -7", description: "Files modified in the last 7 days." },
      { code: "find . -size +100M", description: "Files larger than 100 MB." },
      { code: "find . -name '*.tmp' -delete", description: "Find and delete .tmp files." },
    ],
  },
  {
    name: "tree",
    oneLine: "Display directories as a depth-indented tree.",
    category: "files",
    platforms: ["common"],
    keywords: ["tree", "directory", "structure", "hierarchy"],
    seeAlso: ["ls", "find"],
    examples: [
      { code: "tree", description: "Print a tree of the current directory." },
      { code: "tree -L 2", description: "Limit depth to 2 levels." },
      { code: "tree -a", description: "Include hidden files." },
    ],
  },
  {
    name: "stat",
    oneLine: "Display file or file-system status.",
    category: "files",
    platforms: ["common"],
    keywords: ["stat", "file", "metadata", "size", "permissions"],
    seeAlso: ["ls", "file"],
    examples: [
      { code: "stat file.txt", description: "Show size, mode, owner, and timestamps." },
      { code: "stat -c '%n %s' file.txt", description: "Print name and size only." },
    ],
  },
  {
    name: "file",
    oneLine: "Determine file type.",
    category: "files",
    platforms: ["common"],
    keywords: ["file", "type", "identify", "magic"],
    seeAlso: ["stat", "ls"],
    examples: [
      { code: "file image.png", description: "Print the type of image.png." },
      { code: "file *", description: "Identify every file in the current directory." },
    ],
  },
  {
    name: "ln",
    oneLine: "Create hard or symbolic links.",
    category: "files",
    platforms: ["common"],
    keywords: ["link", "symlink", "ln", "shortcut"],
    seeAlso: ["cp", "readlink"],
    examples: [
      { code: "ln -s target linkname", description: "Create a symbolic link." },
      { code: "ln target hardlink", description: "Create a hard link." },
    ],
  },
  {
    name: "chmod",
    oneLine: "Change file mode (permissions).",
    category: "files",
    platforms: ["common"],
    keywords: ["chmod", "permissions", "mode", "execute", "read", "write"],
    seeAlso: ["chown", "umask"],
    examples: [
      { code: "chmod 755 script.sh", description: "rwxr-xr-x — owner all, group/other read+execute." },
      { code: "chmod +x script.sh", description: "Add execute permission for everyone." },
      { code: "chmod -R 644 docs/", description: "Recursively set rw-r--r--." },
      { code: "chmod u+w file.txt", description: "Add write for the owner only." },
    ],
  },
  {
    name: "chown",
    oneLine: "Change file owner and group.",
    category: "files",
    platforms: ["common"],
    keywords: ["chown", "owner", "group", "permissions"],
    seeAlso: ["chmod", "chgrp"],
    examples: [
      { code: "chown alice file.txt", description: "Set owner to alice." },
      { code: "chown alice:staff file.txt", description: "Set owner to alice and group to staff." },
      { code: "chown -R alice:staff /srv/app", description: "Recursively chown a tree." },
    ],
  },
  {
    name: "dd",
    oneLine: "Convert and copy a file (low-level).",
    category: "files",
    platforms: ["common"],
    keywords: ["dd", "clone", "image", "iso", "usb", "disk"],
    seeAlso: ["cp", "cat"],
    examples: [
      { code: "dd if=input.img of=/dev/sdX bs=4M", description: "Write a disk image to a device." },
      { code: "dd if=/dev/zero of=blank.img bs=1M count=100", description: "Create a 100 MB zero-filled file." },
    ],
  },

  // ---- Text Processing ----
  {
    name: "cat",
    oneLine: "Concatenate and print files.",
    category: "text",
    platforms: ["common"],
    keywords: ["cat", "concatenate", "print", "view", "file"],
    seeAlso: ["less", "head", "tail"],
    examples: [
      { code: "cat file.txt", description: "Print file.txt to stdout." },
      { code: "cat a.txt b.txt > c.txt", description: "Concatenate a.txt and b.txt into c.txt." },
      { code: "cat -n file.txt", description: "Print with line numbers." },
    ],
  },
  {
    name: "less",
    oneLine: "Open a pager for viewing large files.",
    category: "text",
    platforms: ["common"],
    keywords: ["less", "pager", "view", "scroll", "read"],
    seeAlso: ["more", "cat", "head"],
    examples: [
      { code: "less file.log", description: "View file.log with scrollback. Press q to quit." },
      { code: "command | less", description: "Pipe output into less." },
    ],
  },
  {
    name: "head",
    oneLine: "Output the first lines of a file.",
    category: "text",
    platforms: ["common"],
    keywords: ["head", "first", "top", "lines"],
    seeAlso: ["tail", "cat"],
    examples: [
      { code: "head file.txt", description: "Print the first 10 lines." },
      { code: "head -n 20 file.txt", description: "Print the first 20 lines." },
      { code: "head -c 100 file.txt", description: "Print the first 100 bytes." },
    ],
  },
  {
    name: "tail",
    oneLine: "Output the last lines of a file.",
    category: "text",
    platforms: ["common"],
    keywords: ["tail", "last", "follow", "log"],
    seeAlso: ["head", "less"],
    examples: [
      { code: "tail file.log", description: "Print the last 10 lines." },
      { code: "tail -n 50 file.log", description: "Print the last 50 lines." },
      { code: "tail -f file.log", description: "Follow the file as it grows." },
      { code: "tail -f -n 100 file.log", description: "Start from the last 100 lines and follow." },
    ],
  },
  {
    name: "grep",
    oneLine: "Search text using patterns (regex).",
    category: "text",
    platforms: ["common"],
    keywords: ["grep", "search", "pattern", "regex", "filter"],
    seeAlso: ["sed", "awk", "ripgrep"],
    examples: [
      { code: "grep 'error' file.log", description: "Print lines containing 'error'." },
      { code: "grep -i 'error' file.log", description: "Case-insensitive search." },
      { code: "grep -rn 'TODO' src/", description: "Recursively search src/, with line numbers." },
      { code: "grep -v 'debug' file.log", description: "Print lines that do NOT match." },
      { code: "grep -E 'a|b' file.txt", description: "Extended regex (alternation)." },
    ],
  },
  {
    name: "sed",
    oneLine: "Stream editor for filtering and transforming text.",
    category: "text",
    platforms: ["common"],
    keywords: ["sed", "substitute", "replace", "transform", "edit"],
    seeAlso: ["awk", "grep", "perl"],
    examples: [
      { code: "sed 's/old/new/' file.txt", description: "Replace first 'old' with 'new' on each line." },
      { code: "sed 's/old/new/g' file.txt", description: "Replace all occurrences per line." },
      { code: "sed -i 's/old/new/g' file.txt", description: "Edit the file in place." },
      { code: "sed -n '5,10p' file.txt", description: "Print lines 5 through 10." },
    ],
  },
  {
    name: "awk",
    oneLine: "Pattern scanning and processing language.",
    category: "text",
    platforms: ["common"],
    keywords: ["awk", "column", "field", "process", "report"],
    seeAlso: ["sed", "cut", "sort"],
    examples: [
      { code: "awk '{print $1}' file.txt", description: "Print the first column of each line." },
      { code: "awk -F',' '{print $2}' file.csv", description: "Print the second CSV column." },
      { code: "awk 'NR==3' file.txt", description: "Print line 3." },
      { code: "awk '{sum+=$1} END {print sum}' nums.txt", description: "Sum the first column." },
    ],
  },
  {
    name: "sort",
    oneLine: "Sort lines of text files.",
    category: "text",
    platforms: ["common"],
    keywords: ["sort", "order", "alphabetical", "numeric"],
    seeAlso: ["uniq", "tsort"],
    examples: [
      { code: "sort file.txt", description: "Sort lines alphabetically." },
      { code: "sort -n nums.txt", description: "Numeric sort." },
      { code: "sort -r file.txt", description: "Reverse sort." },
      { code: "sort -u file.txt", description: "Sort and remove duplicates." },
    ],
  },
  {
    name: "uniq",
    oneLine: "Filter out repeated adjacent lines.",
    category: "text",
    platforms: ["common"],
    keywords: ["uniq", "unique", "duplicate", "dedupe"],
    seeAlso: ["sort", "comm"],
    examples: [
      { code: "sort file.txt | uniq", description: "Remove all duplicate lines." },
      { code: "sort file.txt | uniq -c", description: "Count occurrences of each line." },
      { code: "uniq -d file.txt", description: "Print only duplicate lines." },
    ],
  },
  {
    name: "wc",
    oneLine: "Print newline, word, and byte counts.",
    category: "text",
    platforms: ["common"],
    keywords: ["wc", "count", "words", "lines", "bytes"],
    seeAlso: ["sort", "uniq"],
    examples: [
      { code: "wc file.txt", description: "Print lines, words, bytes." },
      { code: "wc -l file.txt", description: "Print only line count." },
      { code: "wc -w file.txt", description: "Print only word count." },
    ],
  },
  {
    name: "cut",
    oneLine: "Remove sections from each line of a file.",
    category: "text",
    platforms: ["common"],
    keywords: ["cut", "column", "field", "extract"],
    seeAlso: ["awk", "paste"],
    examples: [
      { code: "cut -d',' -f2 file.csv", description: "Print the second CSV field." },
      { code: "cut -c1-10 file.txt", description: "Print characters 1 through 10." },
    ],
  },
  {
    name: "tr",
    oneLine: "Translate or delete characters.",
    category: "text",
    platforms: ["common"],
    keywords: ["tr", "translate", "replace", "delete", "lowercase"],
    seeAlso: ["sed", "cut"],
    examples: [
      { code: "echo 'Hello' | tr 'a-z' 'A-Z'", description: "Convert lowercase to uppercase." },
      { code: "tr -d '\\n' < file.txt", description: "Delete all newlines." },
      { code: "tr -s ' ' < file.txt", description: "Squeeze repeated spaces into one." },
    ],
  },
  {
    name: "paste",
    oneLine: "Merge lines of files.",
    category: "text",
    platforms: ["common"],
    keywords: ["paste", "merge", "join", "columns"],
    seeAlso: ["cut", "join", "pr"],
    examples: [
      { code: "paste a.txt b.txt", description: "Merge lines side-by-side (tab-separated)." },
      { code: "paste -d',' a.txt b.txt", description: "Merge with comma separator." },
    ],
  },
  {
    name: "tee",
    oneLine: "Read stdin and write to stdout and files.",
    category: "text",
    platforms: ["common"],
    keywords: ["tee", "pipe", "log", "copy", "stdout"],
    seeAlso: ["cat", "xargs"],
    examples: [
      { code: "echo hi | tee out.txt", description: "Print 'hi' and save to out.txt." },
      { code: "cmd | tee -a log.txt", description: "Append output to log.txt and stdout." },
    ],
  },
  {
    name: "xargs",
    oneLine: "Build and execute command lines from stdin.",
    category: "text",
    platforms: ["common"],
    keywords: ["xargs", "pipe", "execute", "arguments", "batch"],
    seeAlso: ["find", "parallel"],
    examples: [
      { code: "find . -name '*.log' | xargs rm", description: "Delete every .log file found." },
      { code: "cat urls.txt | xargs -n1 curl", description: "Run curl on each URL." },
      { code: "echo 'a b c' | xargs -n1 echo", description: "Run echo once per token." },
    ],
  },
  {
    name: "jq",
    oneLine: "Command-line JSON processor.",
    category: "text",
    platforms: ["common"],
    keywords: ["jq", "json", "query", "filter", "transform"],
    seeAlso: ["yq", "curl"],
    examples: [
      { code: "jq '.' file.json", description: "Pretty-print JSON." },
      { code: "jq '.users[] | .name' file.json", description: "Extract every user's name." },
      { code: "curl -s api | jq '.data[0]'", description: "Get the first element of .data." },
    ],
  },

  // ---- Network ----
  {
    name: "ssh",
    oneLine: "OpenSSH remote login client.",
    category: "network",
    platforms: ["common"],
    keywords: ["ssh", "remote", "login", "shell", "secure"],
    seeAlso: ["scp", "rsync", "ssh-keygen"],
    examples: [
      { code: "ssh user@host", description: "Log in to host as user." },
      { code: "ssh -p 2222 user@host", description: "Connect on port 2222." },
      { code: "ssh -i ~/.ssh/key user@host", description: "Use a specific identity file." },
      { code: "ssh -J bastion user@internal", description: "Proxy through a bastion (jump) host." },
      { code: "ssh -L 8080:localhost:80 user@host", description: "Local port forward (tunnel host:80 to local 8080)." },
    ],
  },
  {
    name: "scp",
    oneLine: "Secure copy files over SSH.",
    category: "network",
    platforms: ["common"],
    keywords: ["scp", "copy", "secure", "ssh", "remote"],
    seeAlso: ["rsync", "ssh", "sftp"],
    examples: [
      { code: "scp file.txt user@host:/tmp/", description: "Copy file.txt to remote /tmp/." },
      { code: "scp user@host:/var/log/app.log .", description: "Copy a remote file to the local cwd." },
      { code: "scp -r dir/ user@host:~/", description: "Recursively copy a directory." },
      { code: "scp -P 2222 file user@host:", description: "Use a non-default SSH port." },
    ],
  },
  {
    name: "rsync",
    oneLine: "Fast, incremental file transfer.",
    category: "network",
    platforms: ["common"],
    keywords: ["rsync", "sync", "copy", "incremental", "backup", "mirror"],
    seeAlso: ["scp", "ssh", "cp"],
    examples: [
      { code: "rsync -av src/ user@host:/dest/", description: "Archive mode, verbose; copy contents of src/ to remote /dest/." },
      { code: "rsync -av --delete src/ dest/", description: "Mirror src to dest, deleting extras in dest." },
      { code: "rsync -avz src/ user@host:/dest/", description: "Compress during transfer." },
      { code: "rsync -av --dry-run src/ dest/", description: "Show what would be transferred." },
    ],
  },
  {
    name: "curl",
    oneLine: "Transfer data from or to a server.",
    category: "network",
    platforms: ["common"],
    keywords: ["curl", "http", "download", "request", "api", "url"],
    seeAlso: ["wget", "httpie", "jq"],
    examples: [
      { code: "curl https://example.com", description: "GET a URL and print the body." },
      { code: "curl -O https://example.com/file.zip", description: "Download to a file with the remote name." },
      { code: "curl -X POST -d 'a=1' https://api/x", description: "POST form-encoded data." },
      { code: "curl -H 'Authorization: Bearer TOKEN' https://api/me", description: "Send a header." },
      { code: "curl -s -o /dev/null -w '%{http_code}\\n' https://x", description: "Print only the HTTP status code." },
    ],
  },
  {
    name: "wget",
    oneLine: "Non-interactive network downloader.",
    category: "network",
    platforms: ["common"],
    keywords: ["wget", "download", "http", "url", "mirror"],
    seeAlso: ["curl", "aria2c"],
    examples: [
      { code: "wget https://example.com/file.zip", description: "Download a file." },
      { code: "wget -c https://example.com/file.zip", description: "Continue an interrupted download." },
      { code: "wget -r -l 2 https://example.com/", description: "Recursively download up to depth 2." },
      { code: "wget -q -O out.txt https://example.com", description: "Quiet mode, write to out.txt." },
    ],
  },
  {
    name: "ping",
    oneLine: "Send ICMP ECHO_REQUEST packets to a host.",
    category: "network",
    platforms: ["common"],
    keywords: ["ping", "icmp", "test", "connectivity", "latency"],
    seeAlso: ["traceroute", "nc", "curl"],
    examples: [
      { code: "ping example.com", description: "Ping until you press Ctrl+C." },
      { code: "ping -c 4 example.com", description: "Send exactly 4 packets." },
      { code: "ping -i 2 example.com", description: "Ping every 2 seconds." },
    ],
  },
  {
    name: "nc",
    oneLine: "Netcat — arbitrary TCP/UDP connections and listens.",
    category: "network",
    platforms: ["common"],
    keywords: ["nc", "netcat", "tcp", "udp", "port", "scan"],
    seeAlso: ["curl", "ssh", "socat"],
    examples: [
      { code: "nc -zv host 22", description: "Check if port 22 is open (verbose)." },
      { code: "nc -l 8080", description: "Listen on port 8080 (simple server)." },
      { code: "echo hi | nc host 8080", description: "Send 'hi' to host:8080." },
    ],
  },
  {
    name: "nslookup",
    oneLine: "Query Internet name servers interactively.",
    category: "network",
    platforms: ["common"],
    keywords: ["nslookup", "dns", "lookup", "domain", "resolve"],
    seeAlso: ["dig", "host"],
    examples: [
      { code: "nslookup example.com", description: "Resolve example.com." },
      { code: "nslookup example.com 8.8.8.8", description: "Query a specific DNS server." },
    ],
  },
  {
    name: "dig",
    oneLine: "DNS lookup utility.",
    category: "network",
    platforms: ["common"],
    keywords: ["dig", "dns", "lookup", "domain", "record"],
    seeAlso: ["nslookup", "host"],
    examples: [
      { code: "dig example.com", description: "Look up A records for example.com." },
      { code: "dig +short example.com", description: "Print just the answer." },
      { code: "dig MX example.com", description: "Look up MX records." },
      { code: "dig @8.8.8.8 example.com", description: "Query a specific DNS server." },
    ],
  },
  {
    name: "ip",
    oneLine: "Show / manipulate routing, devices, and tunnels.",
    category: "network",
    platforms: ["linux"],
    keywords: ["ip", "address", "route", "interface", "network"],
    seeAlso: ["ifconfig", "ping"],
    examples: [
      { code: "ip addr", description: "Show all IP addresses." },
      { code: "ip route", description: "Show the routing table." },
      { code: "ip link show", description: "Show network interfaces." },
    ],
  },
  {
    name: "ssh-keygen",
    oneLine: "Generate SSH keys and manage them.",
    category: "network",
    platforms: ["common"],
    keywords: ["ssh-keygen", "key", "generate", "ed25519", "rsa"],
    seeAlso: ["ssh", "ssh-add"],
    examples: [
      { code: "ssh-keygen -t ed25519 -C 'me@host'", description: "Generate an ed25519 key with a comment." },
      { code: "ssh-keygen -t rsa -b 4096", description: "Generate a 4096-bit RSA key." },
      { code: "ssh-keygen -y -f key", description: "Print the public key from a private key." },
    ],
  },
  {
    name: "traceroute",
    oneLine: "Print the route packets take to a host.",
    category: "network",
    platforms: ["common"],
    keywords: ["traceroute", "trace", "route", "hops", "network"],
    seeAlso: ["ping", "mtr"],
    examples: [
      { code: "traceroute example.com", description: "Show all hops to example.com." },
      { code: "traceroute -n example.com", description: "Skip DNS lookups (numeric only)." },
    ],
  },

  // ---- Process Management ----
  {
    name: "ps",
    oneLine: "Report a snapshot of current processes.",
    category: "process",
    platforms: ["common"],
    keywords: ["ps", "process", "list", "running"],
    seeAlso: ["top", "pgrep", "kill"],
    examples: [
      { code: "ps aux", description: "List all processes (BSD-style)." },
      { code: "ps -ef", description: "List all processes (System V-style)." },
      { code: "ps -u alice", description: "List processes owned by alice." },
    ],
  },
  {
    name: "top",
    oneLine: "Display Linux/Unix processes (interactive).",
    category: "process",
    platforms: ["common"],
    keywords: ["top", "monitor", "cpu", "memory", "process"],
    seeAlso: ["ps", "htop"],
    examples: [
      { code: "top", description: "Open the live process monitor. Press q to quit." },
      { code: "top -u alice", description: "Show only alice's processes." },
      { code: "top -n 1", description: "Run a single iteration and exit." },
    ],
  },
  {
    name: "htop",
    oneLine: "Interactive process viewer (nicer top).",
    category: "process",
    platforms: ["common"],
    keywords: ["htop", "monitor", "cpu", "memory", "process"],
    seeAlso: ["top", "ps"],
    examples: [
      { code: "htop", description: "Open the interactive viewer." },
      { code: "htop -p 1234", description: "Monitor only PID 1234." },
    ],
  },
  {
    name: "kill",
    oneLine: "Send a signal to a process.",
    category: "process",
    platforms: ["common"],
    keywords: ["kill", "signal", "terminate", "process", "pid"],
    seeAlso: ["killall", "pkill", "ps"],
    examples: [
      { code: "kill 1234", description: "Send SIGTERM to PID 1234." },
      { code: "kill -9 1234", description: "Send SIGKILL (force kill)." },
      { code: "kill -l", description: "List all signal names." },
    ],
  },
  {
    name: "killall",
    oneLine: "Kill processes by name.",
    category: "process",
    platforms: ["common"],
    keywords: ["killall", "kill", "process", "name"],
    seeAlso: ["kill", "pkill"],
    examples: [
      { code: "killall firefox", description: "Kill every process named firefox." },
      { code: "killall -9 firefox", description: "Force-kill by name." },
    ],
  },
  {
    name: "pkill",
    oneLine: "Signal processes by pattern.",
    category: "process",
    platforms: ["common"],
    keywords: ["pkill", "kill", "pattern", "process"],
    seeAlso: ["pgrep", "killall"],
    examples: [
      { code: "pkill -f 'node server.js'", description: "Kill any process whose full command matches." },
      { code: "pkill -u alice", description: "Kill all of alice's processes." },
    ],
  },
  {
    name: "pgrep",
    oneLine: "Find processes by name and print their PIDs.",
    category: "process",
    platforms: ["common"],
    keywords: ["pgrep", "find", "process", "pid"],
    seeAlso: ["pkill", "ps"],
    examples: [
      { code: "pgrep nginx", description: "Print PIDs of processes named nginx." },
      { code: "pgrep -af node", description: "Full command line, all matches." },
    ],
  },
  {
    name: "nohup",
    oneLine: "Run a command immune to hangups (survives logout).",
    category: "process",
    platforms: ["common"],
    keywords: ["nohup", "background", "survive", "logout"],
    seeAlso: ["disown", "screen", "tmux"],
    examples: [
      { code: "nohup ./longjob.sh &", description: "Run in background, output to nohup.out." },
      { code: "nohup ./job.sh > out.log 2>&1 &", description: "Redirect stdout and stderr." },
    ],
  },
  {
    name: "jobs",
    oneLine: "List active background jobs in the current shell.",
    category: "process",
    platforms: ["common"],
    keywords: ["jobs", "background", "shell"],
    seeAlso: ["bg", "fg", "nohup"],
    examples: [
      { code: "jobs", description: "List background jobs of this shell." },
      { code: "jobs -l", description: "Also print PIDs." },
    ],
  },

  // ---- System Info ----
  {
    name: "uname",
    oneLine: "Print system information.",
    category: "system",
    platforms: ["common"],
    keywords: ["uname", "kernel", "system", "os"],
    seeAlso: ["hostname", "uptime"],
    examples: [
      { code: "uname -a", description: "Print all system info." },
      { code: "uname -r", description: "Print the kernel release." },
    ],
  },
  {
    name: "df",
    oneLine: "Report file system disk space usage.",
    category: "system",
    platforms: ["common"],
    keywords: ["df", "disk", "free", "space", "filesystem"],
    seeAlso: ["du", "ls"],
    examples: [
      { code: "df -h", description: "Human-readable disk usage." },
      { code: "df -h /", description: "Usage for the root file system." },
      { code: "df -i", description: "Show inode usage." },
    ],
  },
  {
    name: "du",
    oneLine: "Estimate file and directory space usage.",
    category: "system",
    platforms: ["common"],
    keywords: ["du", "disk", "usage", "size", "directory"],
    seeAlso: ["df", "ncdu"],
    examples: [
      { code: "du -sh .", description: "Total size of the current directory." },
      { code: "du -sh *", description: "Size of each item in cwd." },
      { code: "du -h --max-depth=1 /var", description: "Size of each subdir, depth 1." },
    ],
  },
  {
    name: "free",
    oneLine: "Display amount of free and used memory.",
    category: "system",
    platforms: ["linux"],
    keywords: ["free", "memory", "ram", "swap"],
    seeAlso: ["top", "vmstat"],
    examples: [
      { code: "free -h", description: "Human-readable memory totals." },
      { code: "free -m", description: "Show in megabytes." },
    ],
  },
  {
    name: "whoami",
    oneLine: "Print the current effective user.",
    category: "system",
    platforms: ["common"],
    keywords: ["whoami", "user", "current"],
    seeAlso: ["id", "sudo"],
    examples: [
      { code: "whoami", description: "Print your current username." },
    ],
  },
  {
    name: "hostname",
    oneLine: "Print or set the system's host name.",
    category: "system",
    platforms: ["common"],
    keywords: ["hostname", "name", "machine", "host"],
    seeAlso: ["uname", "dnsdomainname"],
    examples: [
      { code: "hostname", description: "Print the current host name." },
      { code: "hostname -I", description: "Print all IP addresses of the host." },
    ],
  },
  {
    name: "date",
    oneLine: "Print or set the system date and time.",
    category: "system",
    platforms: ["common"],
    keywords: ["date", "time", "timestamp"],
    seeAlso: ["uptime", "cal"],
    examples: [
      { code: "date", description: "Print current date and time." },
      { code: "date -u", description: "Print UTC time." },
      { code: "date +%Y-%m-%d", description: "Print today as YYYY-MM-DD." },
      { code: "date -d 'tomorrow'", description: "Print tomorrow's date (GNU)." },
    ],
  },
  {
    name: "uptime",
    oneLine: "Tell how long the system has been running.",
    category: "system",
    platforms: ["common"],
    keywords: ["uptime", "load", "average", "running"],
    seeAlso: ["date", "w"],
    examples: [
      { code: "uptime", description: "Show uptime, users, and load averages." },
      { code: "uptime -p", description: "Pretty-print uptime duration." },
    ],
  },
  {
    name: "lsof",
    oneLine: "List open files and the processes holding them.",
    category: "system",
    platforms: ["common"],
    keywords: ["lsof", "open", "files", "ports", "process"],
    seeAlso: ["netstat", "ss"],
    examples: [
      { code: "lsof -i :8080", description: "Who is listening on port 8080." },
      { code: "lsof -p 1234", description: "Files opened by PID 1234." },
      { code: "lsof +D /var/log", description: "Open files under /var/log." },
    ],
  },
  {
    name: "dmesg",
    oneLine: "Print or control the kernel ring buffer.",
    category: "system",
    platforms: ["linux"],
    keywords: ["dmesg", "kernel", "log", "boot", "messages"],
    seeAlso: ["journalctl", "tail"],
    examples: [
      { code: "dmesg | tail", description: "Last 10 kernel messages." },
      { code: "dmesg --level=err", description: "Only error-level messages." },
    ],
  },

  // ---- Archive / Compress ----
  {
    name: "tar",
    oneLine: "Archive utility (tape archive).",
    category: "archive",
    platforms: ["common"],
    keywords: ["tar", "archive", "compress", "extract", "gzip"],
    seeAlso: ["zip", "gzip", "zstd"],
    examples: [
      { code: "tar -cvf out.tar dir/", description: "Create a tar archive (verbose)." },
      { code: "tar -xvf out.tar", description: "Extract a tar archive." },
      { code: "tar -czvf out.tar.gz dir/", description: "Create a gzip-compressed tarball." },
      { code: "tar -xzvf out.tar.gz", description: "Extract a gzip tarball." },
      { code: "tar -xjf out.tar.bz2", description: "Extract a bzip2 tarball." },
      { code: "tar -tf out.tar", description: "List contents without extracting." },
    ],
  },
  {
    name: "zip",
    oneLine: "Package and compress files into a ZIP archive.",
    category: "archive",
    platforms: ["common"],
    keywords: ["zip", "compress", "archive", "zip"],
    seeAlso: ["unzip", "tar", "gzip"],
    examples: [
      { code: "zip out.zip file1 file2", description: "Zip two files." },
      { code: "zip -r out.zip dir/", description: "Recursively zip a directory." },
      { code: "zip -e out.zip file.txt", description: "Encrypt with a password." },
    ],
  },
  {
    name: "unzip",
    oneLine: "Extract files from a ZIP archive.",
    category: "archive",
    platforms: ["common"],
    keywords: ["unzip", "extract", "zip", "decompress"],
    seeAlso: ["zip", "tar"],
    examples: [
      { code: "unzip out.zip", description: "Extract into the current directory." },
      { code: "unzip out.zip -d /tmp/", description: "Extract into /tmp/." },
      { code: "unzip -l out.zip", description: "List contents without extracting." },
    ],
  },
  {
    name: "gzip",
    oneLine: "Compress or expand files (GNU zip).",
    category: "archive",
    platforms: ["common"],
    keywords: ["gzip", "compress", "gz", "decompress"],
    seeAlso: ["gunzip", "tar", "bzip2"],
    examples: [
      { code: "gzip file.txt", description: "Compress to file.txt.gz (replaces original)." },
      { code: "gzip -k file.txt", description: "Keep the original file." },
      { code: "gzip -d file.txt.gz", description: "Decompress (same as gunzip)." },
    ],
  },
  {
    name: "gunzip",
    oneLine: "Decompress gzip files.",
    category: "archive",
    platforms: ["common"],
    keywords: ["gunzip", "decompress", "gz"],
    seeAlso: ["gzip", "zcat"],
    examples: [
      { code: "gunzip file.txt.gz", description: "Decompress to file.txt." },
      { code: "gunzip -c file.txt.gz", description: "Write decompressed output to stdout." },
    ],
  },
  {
    name: "bzip2",
    oneLine: "Block-sorting file compressor.",
    category: "archive",
    platforms: ["common"],
    keywords: ["bzip2", "compress", "bz2", "decompress"],
    seeAlso: ["gzip", "xz"],
    examples: [
      { code: "bzip2 file.txt", description: "Compress to file.txt.bz2." },
      { code: "bzip2 -d file.txt.bz2", description: "Decompress." },
    ],
  },
  {
    name: "xz",
    oneLine: "XZ-utils general-purpose data compressor.",
    category: "archive",
    platforms: ["common"],
    keywords: ["xz", "compress", "decompress", "lzma"],
    seeAlso: ["gzip", "bzip2", "zstd"],
    examples: [
      { code: "xz file.txt", description: "Compress to file.txt.xz." },
      { code: "xz -d file.txt.xz", description: "Decompress." },
      { code: "xz -9 file.txt", description: "Maximum compression." },
    ],
  },
  {
    name: "zstd",
    oneLine: "Zstandard fast compression.",
    category: "archive",
    platforms: ["common"],
    keywords: ["zstd", "compress", "fast", "zstandard"],
    seeAlso: ["gzip", "xz"],
    examples: [
      { code: "zstd file.txt", description: "Compress to file.txt.zst." },
      { code: "zstd -d file.txt.zst", description: "Decompress." },
      { code: "zstd -19 file.txt", description: "Level 19 (max)." },
    ],
  },

  // ---- Package Managers ----
  {
    name: "apt",
    oneLine: "Debian/Ubuntu package manager.",
    category: "package",
    platforms: ["linux"],
    keywords: ["apt", "debian", "ubuntu", "install", "package"],
    seeAlso: ["apt-get", "dpkg", "snap"],
    examples: [
      { code: "sudo apt update", description: "Refresh the package index." },
      { code: "sudo apt install nginx", description: "Install nginx." },
      { code: "sudo apt remove nginx", description: "Remove nginx (keep configs)." },
      { code: "apt search keyword", description: "Search the package list." },
      { code: "sudo apt upgrade", description: "Upgrade all upgradable packages." },
    ],
  },
  {
    name: "yum",
    oneLine: "RPM package manager (older RHEL/CentOS).",
    category: "package",
    platforms: ["linux"],
    keywords: ["yum", "rpm", "rhel", "centos", "install"],
    seeAlso: ["dnf", "rpm"],
    examples: [
      { code: "sudo yum install httpd", description: "Install httpd." },
      { code: "yum search nginx", description: "Search for packages." },
      { code: "sudo yum update", description: "Update all packages." },
    ],
  },
  {
    name: "dnf",
    oneLine: "Next-generation yum (Fedora, RHEL 8+).",
    category: "package",
    platforms: ["linux"],
    keywords: ["dnf", "rpm", "fedora", "rhel", "install"],
    seeAlso: ["yum", "rpm"],
    examples: [
      { code: "sudo dnf install vim", description: "Install vim." },
      { code: "sudo dnf upgrade", description: "Upgrade all packages." },
      { code: "dnf search nginx", description: "Search for nginx." },
    ],
  },
  {
    name: "brew",
    oneLine: "Homebrew package manager for macOS/Linux.",
    category: "package",
    platforms: ["osx", "linux"],
    keywords: ["brew", "homebrew", "macos", "install", "package"],
    seeAlso: ["apt", "npm"],
    examples: [
      { code: "brew install ripgrep", description: "Install ripgrep." },
      { code: "brew update", description: "Fetch newest list of formulae." },
      { code: "brew upgrade", description: "Upgrade all outdated packages." },
      { code: "brew search json", description: "Search formulae." },
    ],
  },
  {
    name: "pacman",
    oneLine: "Arch Linux package manager.",
    category: "package",
    platforms: ["linux"],
    keywords: ["pacman", "arch", "install", "package"],
    seeAlso: ["apt", "dnf"],
    examples: [
      { code: "sudo pacman -Syu", description: "Sync repos and upgrade the system." },
      { code: "sudo pacman -S vim", description: "Install vim." },
      { code: "sudo pacman -Rns vim", description: "Remove vim, its deps, and config." },
    ],
  },
  {
    name: "npm",
    oneLine: "Node.js package manager.",
    category: "package",
    platforms: ["common"],
    keywords: ["npm", "node", "javascript", "install", "package"],
    seeAlso: ["yarn", "pnpm", "npx"],
    examples: [
      { code: "npm install", description: "Install dependencies from package.json." },
      { code: "npm install lodash", description: "Add lodash to node_modules." },
      { code: "npm install -g typescript", description: "Install globally." },
      { code: "npm run build", description: "Run the build script." },
      { code: "npm update", description: "Update all deps to latest semver." },
    ],
  },
  {
    name: "pip",
    oneLine: "Python package installer.",
    category: "package",
    platforms: ["common"],
    keywords: ["pip", "python", "install", "pypi", "package"],
    seeAlso: ["pip3", "poetry", "conda"],
    examples: [
      { code: "pip install requests", description: "Install the requests package." },
      { code: "pip install -r requirements.txt", description: "Install all listed deps." },
      { code: "pip install --upgrade pip", description: "Upgrade pip itself." },
      { code: "pip list", description: "List installed packages." },
    ],
  },
  {
    name: "yarn",
    oneLine: "Fast, deterministic JS package manager.",
    category: "package",
    platforms: ["common"],
    keywords: ["yarn", "javascript", "node", "install", "package"],
    seeAlso: ["npm", "pnpm"],
    examples: [
      { code: "yarn install", description: "Install all deps from package.json." },
      { code: "yarn add lodash", description: "Add lodash as a dependency." },
      { code: "yarn add -D jest", description: "Add jest as a dev dependency." },
      { code: "yarn upgrade", description: "Upgrade all deps." },
    ],
  },

  // ---- User & Permissions ----
  {
    name: "useradd",
    oneLine: "Create a new user account.",
    category: "user",
    platforms: ["linux"],
    keywords: ["useradd", "create", "user", "account"],
    seeAlso: ["usermod", "passwd", "adduser"],
    examples: [
      { code: "sudo useradd -m -s /bin/bash alice", description: "Create alice with home dir and bash shell." },
      { code: "sudo useradd -G docker,wireshark bob", description: "Create bob, adding to supplementary groups." },
    ],
  },
  {
    name: "usermod",
    oneLine: "Modify a user account.",
    category: "user",
    platforms: ["linux"],
    keywords: ["usermod", "modify", "user", "group"],
    seeAlso: ["useradd", "passwd", "gpasswd"],
    examples: [
      { code: "sudo usermod -aG docker alice", description: "Append alice to the docker group." },
      { code: "sudo usermod -L alice", description: "Lock alice's password." },
    ],
  },
  {
    name: "passwd",
    oneLine: "Change a user's password.",
    category: "user",
    platforms: ["common"],
    keywords: ["passwd", "password", "user", "change"],
    seeAlso: ["usermod", "chpasswd"],
    examples: [
      { code: "passwd", description: "Change your own password." },
      { code: "sudo passwd alice", description: "Set/reset alice's password." },
      { code: "sudo passwd -l alice", description: "Lock alice's account." },
    ],
  },
  {
    name: "sudo",
    oneLine: "Execute a command as another user (usually root).",
    category: "user",
    platforms: ["common"],
    keywords: ["sudo", "root", "privilege", "admin"],
    seeAlso: ["su", "visudo"],
    examples: [
      { code: "sudo apt update", description: "Run apt update as root." },
      { code: "sudo -u alice whoami", description: "Run whoami as alice." },
      { code: "sudo -i", description: "Open an interactive root shell." },
    ],
  },
  {
    name: "su",
    oneLine: "Switch to another user account.",
    category: "user",
    platforms: ["common"],
    keywords: ["su", "switch", "user", "root"],
    seeAlso: ["sudo", "passwd"],
    examples: [
      { code: "su - alice", description: "Switch to alice with a login shell." },
      { code: "su -", description: "Switch to root with a login shell." },
    ],
  },
  {
    name: "id",
    oneLine: "Print user and group IDs.",
    category: "user",
    platforms: ["common"],
    keywords: ["id", "user", "group", "uid", "gid"],
    seeAlso: ["whoami", "groups"],
    examples: [
      { code: "id", description: "Print your uid, gid, and groups." },
      { code: "id alice", description: "Print IDs for alice." },
    ],
  },

  // ---- Git ----
  {
    name: "git",
    oneLine: "Distributed version control system.",
    category: "git",
    platforms: ["common"],
    keywords: ["git", "version", "control", "vcs", "commit", "branch"],
    seeAlso: ["gh", "git-config"],
    examples: [
      { code: "git clone https://github.com/x/y.git", description: "Clone a repository." },
      { code: "git status", description: "Show working-tree status." },
      { code: "git add . && git commit -m 'msg'", description: "Stage everything and commit." },
      { code: "git push origin main", description: "Push commits to the main branch." },
      { code: "git checkout -b feature", description: "Create and switch to a new branch." },
      { code: "git log --oneline -10", description: "Show the last 10 commits, one per line." },
    ],
  },
  {
    name: "gh",
    oneLine: "GitHub CLI.",
    category: "git",
    platforms: ["common"],
    keywords: ["gh", "github", "cli", "pull", "request", "issue"],
    seeAlso: ["git"],
    examples: [
      { code: "gh repo clone owner/name", description: "Clone a GitHub repo." },
      { code: "gh pr create --fill", description: "Open a pull request using commit info." },
      { code: "gh pr checkout 123", description: "Checkout PR #123 locally." },
      { code: "gh issue list", description: "List open issues in the current repo." },
    ],
  },

  // ---- Misc / Shell ----
  {
    name: "echo",
    oneLine: "Print arguments to stdout.",
    category: "misc",
    platforms: ["common"],
    keywords: ["echo", "print", "string", "stdout"],
    seeAlso: ["printf", "cat"],
    examples: [
      { code: "echo 'hello world'", description: "Print a string." },
      { code: "echo $HOME", description: "Print the HOME environment variable." },
      { code: "echo -n 'no newline'", description: "Print without a trailing newline." },
    ],
  },
  {
    name: "printf",
    oneLine: "Format and print text (C-style).",
    category: "misc",
    platforms: ["common"],
    keywords: ["printf", "format", "print"],
    seeAlso: ["echo", "awk"],
    examples: [
      { code: "printf '%s\\n' hello", description: "Print 'hello' followed by a newline." },
      { code: "printf '%-10s %d\\n' alice 42", description: "Left-aligned string and integer." },
    ],
  },
  {
    name: "export",
    oneLine: "Mark a shell variable for export to child processes.",
    category: "misc",
    platforms: ["common"],
    keywords: ["export", "env", "variable", "environment"],
    seeAlso: ["source", "env", "printenv"],
    examples: [
      { code: "export EDITOR=vim", description: "Set EDITOR for child processes." },
      { code: "export PATH=$PATH:/opt/bin", description: "Append a directory to PATH." },
    ],
  },
  {
    name: "alias",
    oneLine: "Create or print shell aliases.",
    category: "misc",
    platforms: ["common"],
    keywords: ["alias", "shortcut", "shell"],
    seeAlso: ["export", "source"],
    examples: [
      { code: "alias ll='ls -la'", description: "Create an alias ll for ls -la." },
      { code: "alias", description: "List all current aliases." },
      { code: "unalias ll", description: "Remove the ll alias." },
    ],
  },
  {
    name: "source",
    oneLine: "Execute a file in the current shell (read and run).",
    category: "misc",
    platforms: ["common"],
    keywords: ["source", "dot", "execute", "shell", "rc"],
    seeAlso: ["export", "alias"],
    examples: [
      { code: "source ~/.bashrc", description: "Reload your bashrc." },
      { code: "source venv/bin/activate", description: "Activate a Python virtualenv." },
      { code: ". ~/.profile", description: "Dot is the same as source." },
    ],
  },
  {
    name: "cron",
    oneLine: "Schedule periodic background jobs (crontab).",
    category: "misc",
    platforms: ["common"],
    keywords: ["cron", "schedule", "crontab", "periodic", "background"],
    seeAlso: ["at", "systemd-timer"],
    examples: [
      { code: "crontab -e", description: "Edit your crontab." },
      { code: "crontab -l", description: "List your cron jobs." },
      { code: "0 3 * * * /opt/backup.sh", description: "Run backup.sh every day at 03:00." },
    ],
  },
  {
    name: "systemctl",
    oneLine: "Control the systemd system and service manager.",
    category: "misc",
    platforms: ["linux"],
    keywords: ["systemctl", "systemd", "service", "daemon"],
    seeAlso: ["journalctl", "service"],
    examples: [
      { code: "sudo systemctl start nginx", description: "Start the nginx service." },
      { code: "sudo systemctl enable nginx", description: "Start nginx on boot." },
      { code: "sudo systemctl status nginx", description: "Show current status." },
      { code: "sudo systemctl restart nginx", description: "Restart the service." },
    ],
  },
];

// ---------------------------------------------------------------------------
// Lookup
// ---------------------------------------------------------------------------

export function getAllCommands(): TldrCommand[] {
  return COMMANDS.slice();
}

export function getByName(name: string): TldrCommand | undefined {
  const lower = name.trim().toLowerCase();
  if (!lower) return undefined;
  return COMMANDS.find((c) => c.name === lower);
}

export function filterByCategory(category: CommandCategory): TldrCommand[] {
  return COMMANDS.filter((c) => c.category === category);
}

export function filterByPlatform(platform: Platform): TldrCommand[] {
  // common applies to all; otherwise match either common or the specific platform
  if (platform === "common") return COMMANDS.slice();
  return COMMANDS.filter((c) => c.platforms.includes("common") || c.platforms.includes(platform));
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

export function search(query: string, opts: SearchOptions = {}): TldrCommand[] {
  const q = query.trim().toLowerCase();
  let list = COMMANDS.slice();
  if (opts.platform) list = filterByPlatform(opts.platform).filter((c) => list.includes(c));
  if (opts.category) list = list.filter((c) => c.category === opts.category);
  if (!q) {
    return typeof opts.limit === "number" ? list.slice(0, opts.limit) : list;
  }
  const scored = list
    .map((c) => {
      let score = 0;
      if (c.name === q) score = 100;
      else if (c.name.startsWith(q)) score = 80;
      else if (c.name.includes(q)) score = 60;
      else if (c.keywords.some((k) => k === q || k.startsWith(q))) score = 40;
      else if (c.oneLine.toLowerCase().includes(q)) score = 20;
      else if (c.seeAlso.some((s) => s.toLowerCase().includes(q))) score = 10;
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  const result = scored.map((s) => s.c);
  return typeof opts.limit === "number" ? result.slice(0, opts.limit) : result;
}

/** Task/intent search: 'compress a folder' → tar, zip, gzip, etc. */
export function searchByTask(query: string, opts: SearchOptions = {}): TldrCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  // Tokenize — drop common stopwords
  const stopwords = new Set([
    "a", "an", "the", "to", "of", "in", "on", "for", "and", "or", "with",
    "how", "do", "i", "is", "are", "my", "me", "please", "show",
  ]);
  const tokens = q.split(/\W+/).filter((t) => t.length > 1 && !stopwords.has(t));
  let list = COMMANDS.slice();
  if (opts.platform) list = filterByPlatform(opts.platform).filter((c) => list.includes(c));
  if (opts.category) list = list.filter((c) => c.category === opts.category);
  const scored = list
    .map((c) => {
      let score = 0;
      for (const t of tokens) {
        if (c.keywords.includes(t)) score += 30;
        else if (c.keywords.some((k) => k.includes(t) || t.includes(k))) score += 15;
        if (c.oneLine.toLowerCase().includes(t)) score += 5;
        if (c.name.includes(t)) score += 10;
      }
      // Bonus for matching category keywords
      if (tokens.includes(c.category)) score += 8;
      return { c, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name));
  return scored.map((s) => s.c);
}

// ---------------------------------------------------------------------------
// man page link
// ---------------------------------------------------------------------------

export function getManUrl(name: string): string {
  const lower = name.trim().toLowerCase();
  if (!lower) return MAN_BASE_URL;
  // ssh-keygen lives in man1; some commands live in man8 (ip). Default to man1.
  if (lower === "ip") return `https://man7.org/linux/man-pages/man8/ip.8.html`;
  return `${MAN_BASE_URL}/${lower}.1.html`;
}

// ---------------------------------------------------------------------------
// Favorites (localStorage)
// ---------------------------------------------------------------------------

const FAVORITES_KEY = "unqtools:man-page-tldr:favorites";

export function getFavorites(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function isFavorite(name: string): boolean {
  return getFavorites().includes(name);
}

export function toggleFavorite(name: string): string[] {
  const current = getFavorites();
  const lower = name.trim().toLowerCase();
  const next = current.includes(lower)
    ? current.filter((n) => n !== lower)
    : [...current, lower];
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  }
  return next;
}

export function clearFavorites(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(FAVORITES_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// Group + stats
// ---------------------------------------------------------------------------

export function groupCommands(list: TldrCommand[]): GroupedCommands[] {
  const groups: GroupedCommands[] = [];
  for (const cat of COMMAND_CATEGORIES) {
    const cmds = list.filter((c) => c.category === cat);
    if (cmds.length > 0) {
      groups.push({
        category: cat,
        label: CATEGORY_LABELS[cat],
        commands: cmds,
      });
    }
  }
  return groups;
}

export function computeStats(): CorpusStats {
  const byCategory = {} as Record<CommandCategory, number>;
  const byPlatform = {} as Record<Platform, number>;
  for (const cat of COMMAND_CATEGORIES) byCategory[cat] = 0;
  for (const p of PLATFORMS) byPlatform[p] = 0;
  let totalExamples = 0;
  for (const c of COMMANDS) {
    byCategory[c.category] += 1;
    for (const p of c.platforms) byPlatform[p] += 1;
    totalExamples += c.examples.length;
  }
  return {
    totalCommands: COMMANDS.length,
    byCategory,
    byPlatform,
    totalExamples,
    favoritesCount: getFavorites().length,
  };
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:man-page-tldr:history";
const HISTORY_MAX = 20;

export interface HistoryEntry {
  ts: number;
  command: string;
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
  // Dedupe by command name (keep most recent)
  const prev = loadHistory().filter((h) => h.command !== entry.command);
  const next = [entry, ...prev].slice(0, HISTORY_MAX);
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
// Shareable deep-link to a command
// ---------------------------------------------------------------------------

export function buildShareUrl(commandName: string): string {
  const params = new URLSearchParams();
  params.set("cmd", commandName.trim().toLowerCase());
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): { commandName: string } {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return { commandName: "" };
  const params = new URLSearchParams(clean);
  return { commandName: (params.get("cmd") ?? "").trim().toLowerCase() };
}

// ---------------------------------------------------------------------------
// Fallback note for unknown commands
// ---------------------------------------------------------------------------

export interface FallbackResult {
  found: boolean;
  command?: TldrCommand;
  manUrl: string;
  note?: string;
}

export function lookupWithFallback(name: string): FallbackResult {
  const cmd = getByName(name);
  if (cmd) return { found: true, command: cmd, manUrl: getManUrl(name) };
  return {
    found: false,
    manUrl: getManUrl(name),
    note: `No bundled TLDR page for "${name}". Open the full man page, or contribute a page at tldr-pages/tldr on GitHub.`,
  };
}

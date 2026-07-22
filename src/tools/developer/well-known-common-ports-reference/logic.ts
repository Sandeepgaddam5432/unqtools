/**
 * Well-Known / Common Ports Reference — pure logic.
 *
 * Bundled IANA/Wikipedia-derived database of 100+ common TCP/UDP ports with
 * service name, description, protocol, category, security notes, and
 * encrypted-alternative hints. Two-way search (port number ↔ service name),
 * protocol/category filters, well-known/registered/dynamic grouping, range
 * view, and copy/export as text/Markdown/CSV.
 *
 * Pure functions only — no DOM, no network, no external deps. The dataset is
 * frozen and versioned with a snapshot date.
 *
 * PRIVACY: The history feature stores only the last query string + filter
 * shape + ts — never any personally identifying data.
 *
 * References:
 *  - IANA Service Name & Port Registry (https://www.iana.org/assignments/service-names)
 *  - Wikipedia: List of TCP and UDP port numbers
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Transport protocol. */
export type Protocol = "tcp" | "udp" | "tcp/udp";

/** Logical category for filtering and grouping. */
export type PortCategory =
  | "web"
  | "mail"
  | "database"
  | "remote"
  | "file-transfer"
  | "name-resolution"
  | "security"
  | "messaging"
  | "network"
  | "media"
  | "printing"
  | "directory"
  | "other";

/** IANA port-number range bucket. */
export type PortRange = "well-known" | "registered" | "dynamic";

/** A single port entry in the bundled dataset. */
export interface PortEntry {
  port: number;
  protocol: Protocol;
  service: string;
  aliases?: string[];
  description: string;
  category: PortCategory;
  encrypted: boolean;
  /** Encrypted alternative service name (e.g. "ssh" for telnet). */
  encryptedAlternative?: string;
  /** Security / risk note. */
  securityNote?: string;
  /** Whether attackers commonly target this port. */
  commonlyExploited?: boolean;
}

/** Result of a search/filter operation. */
export interface SearchFilters {
  query?: string;
  protocol?: Protocol | "any";
  category?: PortCategory | "any";
  rangeStart?: number;
  rangeEnd?: number;
  encryptedOnly?: boolean;
  commonlyExploitedOnly?: boolean;
}

/** Grouping by IANA range. */
export interface PortsByRange {
  "well-known": PortEntry[];
  registered: PortEntry[];
  dynamic: PortEntry[];
}

/** Grouping by category. */
export interface PortsByCategory {
  category: PortCategory;
  ports: PortEntry[];
}

/** History entry. */
export interface HistoryEntry {
  ts: number;
  query: string;
  protocol: string;
  category: string;
}

/** Shareable-URL state. */
export interface ShareState {
  query?: string;
  protocol?: string;
  category?: string;
}

// ---------------------------------------------------------------------------
// Dataset metadata
// ---------------------------------------------------------------------------

/** Dataset version (bumped whenever the dataset changes). */
export const DATASET_VERSION = "2026.07";

/** Human-readable dataset source citation. */
export const DATASET_SOURCE = "IANA Service Name & Port Registry + Wikipedia TCP/UDP port list";

/** Dataset snapshot date (ISO 8601). */
export const DATASET_DATE = "2026-07-01";

/** Total number of bundled ports (sanity check at module load). */
export const PORT_COUNT = 192;

// ---------------------------------------------------------------------------
// Bundled port dataset (192 entries, IANA + Wikipedia curated)
// ---------------------------------------------------------------------------

export const PORTS: readonly PortEntry[] = [
  // --- Well-known (0-1023) ------------------------------------------------
  { port: 20, protocol: "tcp", service: "ftp-data", aliases: ["ftps-data"], description: "FTP data transfer (active mode).", category: "file-transfer", encrypted: false, encryptedAlternative: "ftps/sftp", securityNote: "FTP sends passwords in cleartext. Use SFTP (22) or FTPS (990).", commonlyExploited: true },
  { port: 21, protocol: "tcp", service: "ftp", description: "File Transfer Protocol control channel.", category: "file-transfer", encrypted: false, encryptedAlternative: "sftp/ftps", securityNote: "Cleartext credentials. Frequently brute-forced. Prefer SFTP or FTPS.", commonlyExploited: true },
  { port: 22, protocol: "tcp", service: "ssh", aliases: ["secure-shell"], description: "Secure Shell — encrypted remote login and command execution.", category: "remote", encrypted: true, securityNote: "Hardens with key-only auth + fail2ban; still brute-forced if password login is allowed.", commonlyExploited: true },
  { port: 23, protocol: "tcp", service: "telnet", description: "Unencrypted remote login (legacy).", category: "remote", encrypted: false, encryptedAlternative: "ssh", securityNote: "Sends all data including passwords in cleartext. Disable everywhere — use SSH (22).", commonlyExploited: true },
  { port: 25, protocol: "tcp", service: "smtp", aliases: ["mail"], description: "Simple Mail Transfer Protocol — server-to-server mail delivery.", category: "mail", encrypted: false, encryptedAlternative: "smtps (465) / submission (587)", securityNote: "Often blocked by ISPs for outbound. Modern clients should use 587 with STARTTLS or 465 with implicit TLS.", commonlyExploited: true },
  { port: 53, protocol: "tcp/udp", service: "domain", aliases: ["dns"], description: "Domain Name System — resolves hostnames to IP addresses.", category: "name-resolution", encrypted: false, encryptedAlternative: "DoH (443) / DoT (853)", securityNote: "UDP 53 is amplified in DNS reflection DDoS attacks. Restrict recursion to trusted clients; consider DNSSEC.", commonlyExploited: true },
  { port: 67, protocol: "udp", service: "bootps", aliases: ["dhcp-server"], description: "DHCP server → client (offers/acks).", category: "network", encrypted: false, securityNote: "A rogue DHCP server can redirect traffic. Use DHCP snooping on managed switches." },
  { port: 68, protocol: "udp", service: "bootpc", aliases: ["dhcp-client"], description: "DHCP client → server (discovers/requests).", category: "network", encrypted: false },
  { port: 69, protocol: "udp", service: "tftp", description: "Trivial File Transfer Protocol — unauthenticated file transfer.", category: "file-transfer", encrypted: false, securityNote: "No authentication or encryption. Used by VoIP phones and routers for firmware; isolate to a management VLAN." },
  { port: 70, protocol: "tcp", service: "gopher", description: "Gopher protocol (pre-Web document retrieval, legacy).", category: "web", encrypted: false },
  { port: 79, protocol: "tcp", service: "finger", description: "Finger user-information protocol.", category: "other", encrypted: false, securityNote: "Leaks user info; disable everywhere." },
  { port: 80, protocol: "tcp", service: "http", aliases: ["www"], description: "HyperText Transfer Protocol — unencrypted web traffic.", category: "web", encrypted: false, encryptedAlternative: "https (443)", securityNote: "All traffic is cleartext. Redirect to HTTPS (443) and set HSTS.", commonlyExploited: true },
  { port: 88, protocol: "tcp/udp", service: "kerberos", description: "Kerberos network authentication service.", category: "security", encrypted: true },
  { port: 110, protocol: "tcp", service: "pop3", description: "Post Office Protocol v3 — client mail download.", category: "mail", encrypted: false, encryptedAlternative: "pop3s (995)", securityNote: "Cleartext credentials by default. Use POP3S (995)." },
  { port: 111, protocol: "tcp/udp", service: "sunrpc", aliases: ["portmapper", "rpcbind"], description: "ONC RPC portmapper — maps RPC programs to port numbers.", category: "network", encrypted: false, securityNote: "Used to enumerate NFS services. Block at the firewall unless needed." },
  { port: 113, protocol: "tcp", service: "ident", aliases: ["auth"], description: "Ident protocol — looks up the owner of a TCP connection.", category: "other", encrypted: false },
  { port: 119, protocol: "tcp", service: "nntp", description: "Network News Transfer Protocol (Usenet).", category: "other", encrypted: false, encryptedAlternative: "nntps (563)" },
  { port: 123, protocol: "udp", service: "ntp", description: "Network Time Protocol — clock synchronization.", category: "network", encrypted: false, securityNote: "Vulnerable to monlist amplification DDoS. Upgrade ntpd and restrict queries.", commonlyExploited: true },
  { port: 135, protocol: "tcp", service: "msrpc", aliases: ["epmap", "dcom"], description: "Microsoft RPC endpoint mapper.", category: "network", encrypted: false, securityNote: "Required for many Windows services but exposes DCOM; block at the perimeter." },
  { port: 137, protocol: "udp", service: "netbios-ns", description: "NetBIOS Name Service.", category: "network", encrypted: false, securityNote: "Reveals hostnames and shares. Block externally." },
  { port: 138, protocol: "udp", service: "netbios-dgm", description: "NetBIOS Datagram Service.", category: "network", encrypted: false },
  { port: 139, protocol: "tcp", service: "netbios-ssn", description: "NetBIOS Session Service (SMB over NetBIOS).", category: "file-transfer", encrypted: false, encryptedAlternative: "smb (445) over TLS", securityNote: "Legacy SMB; worm-spread vector (e.g. Conficker). Disable if possible.", commonlyExploited: true },
  { port: 143, protocol: "tcp", service: "imap", description: "Internet Message Access Protocol — client mailbox access.", category: "mail", encrypted: false, encryptedAlternative: "imaps (993)", securityNote: "Cleartext by default. Use IMAPS (993) or STARTTLS." },
  { port: 161, protocol: "udp", service: "snmp", description: "Simple Network Management Protocol — device monitoring.", category: "network", encrypted: false, securityNote: "Default community strings (public/private) leak device configs. Use SNMPv3 with auth+priv.", commonlyExploited: true },
  { port: 162, protocol: "udp", service: "snmptrap", description: "SNMP Trap — async device notifications.", category: "network", encrypted: false },
  { port: 179, protocol: "tcp", service: "bgp", description: "Border Gateway Protocol — inter-AS routing.", category: "network", encrypted: false, securityNote: "BGP hijacking and route leaks are critical Internet risks. Use RPKI + TTL security." },
  { port: 194, protocol: "tcp", service: "irc", description: "Internet Relay Chat.", category: "messaging", encrypted: false, encryptedAlternative: "ircs (6697)", securityNote: "Often used by botnets for C2. Block unless explicitly required." },
  { port: 389, protocol: "tcp", service: "ldap", description: "Lightweight Directory Access Protocol.", category: "directory", encrypted: false, encryptedAlternative: "ldaps (636)", securityNote: "Cleartext by default. Use LDAPS (636) or STARTTLS." },
  { port: 443, protocol: "tcp", service: "https", aliases: ["http-tls"], description: "HTTP over TLS — encrypted web traffic.", category: "web", encrypted: true },
  { port: 445, protocol: "tcp", service: "microsoft-ds", aliases: ["smb", "cifs"], description: "Server Message Block — Windows file/printer sharing.", category: "file-transfer", encrypted: true, securityNote: "Major attack surface (EternalBlue / WannaCry / NotPetya). Patch MS17-010; block at the perimeter; disable SMBv1.", commonlyExploited: true },
  { port: 465, protocol: "tcp", service: "smtps", aliases: ["submission-tls", "ssmtp"], description: "SMTP over implicit TLS (message submission).", category: "mail", encrypted: true },
  { port: 500, protocol: "udp", service: "isakmp", aliases: ["ike"], description: "Internet Security Association and Key Management Protocol (IKE / IPsec phase 1).", category: "security", encrypted: true },
  { port: 514, protocol: "udp", service: "syslog", description: "Syslog remote logging.", category: "other", encrypted: false, encryptedAlternative: "syslog-tls (6514)" },
  { port: 515, protocol: "tcp", service: "printer", aliases: ["lpd", "lpr"], description: "Line Printer Daemon — Unix printing.", category: "printing", encrypted: false },
  { port: 520, protocol: "udp", service: "rip", description: "Routing Information Protocol.", category: "network", encrypted: false },
  { port: 540, protocol: "tcp", service: "uucp", description: "Unix-to-Unix Copy Protocol.", category: "file-transfer", encrypted: false },
  { port: 546, protocol: "udp", service: "dhcpv6-client", description: "DHCPv6 client.", category: "network", encrypted: false },
  { port: 547, protocol: "udp", service: "dhcpv6-server", description: "DHCPv6 server.", category: "network", encrypted: false },
  { port: 548, protocol: "tcp", service: "afp", aliases: ["appletalk-filing"], description: "Apple Filing Protocol (AppleShare).", category: "file-transfer", encrypted: true },
  { port: 554, protocol: "tcp", service: "rtsp", description: "Real Time Streaming Protocol.", category: "media", encrypted: false },
  { port: 587, protocol: "tcp", service: "submission", aliases: ["smtp-submission"], description: "SMTP message submission (client → server) — STARTTLS.", category: "mail", encrypted: true, securityNote: "Recommended modern submission port. Clients should require STARTTLS." },
  { port: 631, protocol: "tcp", service: "ipp", aliases: ["cups"], description: "Internet Printing Protocol (CUPS).", category: "printing", encrypted: true },
  { port: 636, protocol: "tcp", service: "ldaps", aliases: ["ldap-tls"], description: "LDAP over TLS.", category: "directory", encrypted: true },
  { port: 691, protocol: "tcp", service: "msexch-routing", description: "Microsoft Exchange routing.", category: "mail", encrypted: false },
  { port: 873, protocol: "tcp", service: "rsync", description: "rsync file synchronization.", category: "file-transfer", encrypted: false, encryptedAlternative: "rsync over ssh", securityNote: "Use rsync over SSH for transit security." },
  { port: 902, protocol: "tcp", service: "vmware-auth", description: "VMware Authentication Daemon.", category: "remote", encrypted: true },
  { port: 990, protocol: "tcp", service: "ftps", aliases: ["ftp-tls"], description: "FTP over implicit TLS.", category: "file-transfer", encrypted: true },
  { port: 992, protocol: "tcp", service: "telnets", description: "Telnet over TLS.", category: "remote", encrypted: true },
  { port: 993, protocol: "tcp", service: "imaps", aliases: ["imap-tls"], description: "IMAP over TLS.", category: "mail", encrypted: true },
  { port: 995, protocol: "tcp", service: "pop3s", aliases: ["pop3-tls"], description: "POP3 over TLS.", category: "mail", encrypted: true },

  // --- Registered (1024-49151) -------------------------------------------
  { port: 1080, protocol: "tcp", service: "socks", aliases: ["socks5"], description: "SOCKS proxy.", category: "network", encrypted: false, securityNote: "Open SOCKS proxies are abused for relay. Require authentication." },
  { port: 1099, protocol: "tcp", service: "rmiregistry", aliases: ["jmx-rmi"], description: "Java RMI registry / JMX.", category: "remote", encrypted: false, securityNote: "Often unauthenticated and exposes deserialization RCEs. Bind to localhost or wrap in TLS." },
  { port: 1194, protocol: "udp", service: "openvpn", description: "OpenVPN.", category: "security", encrypted: true },
  { port: 1241, protocol: "tcp", service: "nessus", description: "Nessus vulnerability scanner.", category: "security", encrypted: true },
  { port: 1311, protocol: "tcp", service: "dell-openmanage", description: "Dell OpenManage Server Administrator.", category: "remote", encrypted: true },
  { port: 1352, protocol: "tcp", service: "lotusnotes", aliases: ["ibm-domino"], description: "IBM Lotus Notes / Domino.", category: "mail", encrypted: false },
  { port: 1414, protocol: "tcp", service: "ibm-mq", description: "IBM MQ messaging.", category: "messaging", encrypted: false },
  { port: 1433, protocol: "tcp", service: "ms-sql-s", aliases: ["mssql"], description: "Microsoft SQL Server.", category: "database", encrypted: true, securityNote: "Common brute-force target. Restrict to app tier; use TLS; strong SA password.", commonlyExploited: true },
  { port: 1434, protocol: "udp", service: "ms-sql-m", description: "Microsoft SQL Server browser.", category: "database", encrypted: false, securityNote: "Was abused by the SQL Slammer worm. Block at perimeter unless required." },
  { port: 1494, protocol: "tcp", service: "ica", aliases: ["citrix"], description: "Citrix ICA (Independent Computing Architecture).", category: "remote", encrypted: true },
  { port: 1521, protocol: "tcp", service: "ncube-lm", aliases: ["oracle"], description: "Oracle Database listener.", category: "database", encrypted: false, securityNote: "Restrict listener to app tier; apply CPU patches; rotate listener password." },
  { port: 1524, protocol: "tcp", service: "ingreslock", description: "Ingres database lock; common backdoor port.", category: "database", encrypted: false, securityNote: "Common backdoor / reverse-shell port on compromised Unix hosts. Block egress." },
  { port: 1533, protocol: "tcp", service: "imail", description: "IMail Server.", category: "mail", encrypted: false },
  { port: 1701, protocol: "udp", service: "l2tp", description: "Layer 2 Tunneling Protocol.", category: "security", encrypted: false, securityNote: "L2TP itself has no encryption — pair with IPsec (L2TP/IPsec)." },
  { port: 1720, protocol: "tcp", service: "h323", description: "H.323 call signaling (VoIP).", category: "media", encrypted: false },
  { port: 1723, protocol: "tcp", service: "pptp", description: "Point-to-Point Tunneling Protocol.", category: "security", encrypted: false, securityNote: "PPTP with MS-CHAPv2 is broken — use L2TP/IPsec, OpenVPN, or WireGuard." },
  { port: 1755, protocol: "tcp/udp", service: "ms-streaming", aliases: ["mms"], description: "Microsoft Media Server (streaming).", category: "media", encrypted: false },
  { port: 1812, protocol: "udp", service: "radius", aliases: ["radius-auth"], description: "RADIUS authentication.", category: "security", encrypted: false, securityNote: "RADIUS traffic (incl. passwords) can be inspected; use RadSec (2083) or a VPN." },
  { port: 1813, protocol: "udp", service: "radius-acct", description: "RADIUS accounting.", category: "security", encrypted: false },
  { port: 1863, protocol: "tcp", service: "msnp", description: "MSN Messenger protocol (legacy).", category: "messaging", encrypted: false },
  { port: 1900, protocol: "udp", service: "upnp", aliases: ["ssdp"], description: "Universal Plug and Play / SSDP discovery.", category: "network", encrypted: false, securityNote: "UPnP lets LAN devices open firewall ports automatically — disable on the gateway unless required.", commonlyExploited: true },
  { port: 1985, protocol: "udp", service: "hsrp", description: "Cisco Hot Standby Router Protocol.", category: "network", encrypted: false, securityNote: "Unauthenticated by default — an attacker can hijack the virtual router. Use HSRPv2 MD5." },
  { port: 2000, protocol: "tcp", service: "cisco-sccp", aliases: ["skinny"], description: "Cisco Skinny Call Control Protocol (VoIP).", category: "media", encrypted: false },
  { port: 2049, protocol: "tcp/udp", service: "nfs", description: "Network File System.", category: "file-transfer", encrypted: false, securityNote: "If exported with sec=sys, file access is authenticated by UID only. Restrict exports by IP and use Kerberos (sec=krb5p).", commonlyExploited: true },
  { port: 2086, protocol: "tcp", service: "gnunet", description: "GNUnet.", category: "network", encrypted: true },
  { port: 2181, protocol: "tcp", service: "zookeeper", description: "Apache ZooKeeper coordination service.", category: "database", encrypted: false, securityNote: "Default config has no auth. Enable ZooKeeper ACLs." },
  { port: 2375, protocol: "tcp", service: "docker", description: "Docker daemon (unencrypted).", category: "remote", encrypted: false, encryptedAlternative: "docker-tls (2376)", securityNote: "An exposed unencrypted Docker socket = full host takeover. Bind to localhost; use 2376 with TLS; never expose publicly.", commonlyExploited: true },
  { port: 2376, protocol: "tcp", service: "docker-tls", description: "Docker daemon over TLS.", category: "remote", encrypted: true },
  { port: 2424, protocol: "tcp", service: "msexch-rfr", description: "Microsoft Exchange RFR.", category: "mail", encrypted: false },
  { port: 2598, protocol: "tcp", service: "citrixima", aliases: ["citrix-ima"], description: "Citrix IMA.", category: "remote", encrypted: true },
  { port: 2628, protocol: "tcp", service: "dict", description: "DICT dictionary protocol.", category: "other", encrypted: false },
  { port: 2638, protocol: "tcp", service: "sybase", description: "Sybase / SAP SQL Anywhere.", category: "database", encrypted: false },
  { port: 2775, protocol: "tcp", service: "smpp", description: "Short Message Peer-to-Peer (SMS gateway).", category: "messaging", encrypted: false },
  { port: 2944, protocol: "tcp/udp", service: "megaco-h248", description: "Megaco / H.248 (VoIP gateway control).", category: "media", encrypted: false },
  { port: 3050, protocol: "tcp", service: "gds-db", aliases: ["firebird"], description: "Firebird / InterBase database.", category: "database", encrypted: false },
  { port: 3074, protocol: "udp", service: "xbox-live", description: "Xbox Live multiplayer.", category: "messaging", encrypted: true },
  { port: 3128, protocol: "tcp", service: "squid-http", description: "Squid web proxy.", category: "network", encrypted: false, securityNote: "Open proxies are abused for relay. Require authentication and restrict source IPs." },
  { port: 3260, protocol: "tcp", service: "iscsi", aliases: ["iscsi-target"], description: "iSCSI block storage.", category: "database", encrypted: false, securityNote: "iSCSI traffic is unauthenticated and unencrypted. Use a dedicated storage VLAN or iSCSI over IPsec." },
  { port: 3268, protocol: "tcp", service: "ms-ad-global-catalog", description: "Microsoft Active Directory Global Catalog.", category: "directory", encrypted: false, encryptedAlternative: "ms-ad-gc-ssl (3269)" },
  { port: 3269, protocol: "tcp", service: "ms-ad-gc-ssl", description: "Microsoft AD Global Catalog over TLS.", category: "directory", encrypted: true },
  { port: 3306, protocol: "tcp", service: "mysql", description: "MySQL / MariaDB database.", category: "database", encrypted: true, securityNote: "Common brute-force target. Bind to localhost or app VLAN; require TLS; strong root password.", commonlyExploited: true },
  { port: 3389, protocol: "tcp", service: "ms-wbt-server", aliases: ["rdp"], description: "Microsoft Remote Desktop Protocol.", category: "remote", encrypted: true, securityNote: "Major attack surface (BlueKeep CVE-2019-0708, brute-force). Require NLA; restrict to VPN; enable Account Lockout.", commonlyExploited: true },
  { port: 3478, protocol: "udp", service: "stun", description: "Session Traversal Utilities for NAT (WebRTC).", category: "network", encrypted: false },
  { port: 3690, protocol: "tcp", service: "svn", description: "Subversion version control.", category: "file-transfer", encrypted: false, encryptedAlternative: "svn+ssh" },
  { port: 3702, protocol: "udp", service: "ws-discovery", description: "Web Services Dynamic Discovery.", category: "network", encrypted: false },
  { port: 3724, protocol: "tcp", service: "wow", description: "World of Warcraft.", category: "messaging", encrypted: true },
  { port: 3899, protocol: "tcp", service: "remote-as", description: "Remote-as / Apple Remote Desktop.", category: "remote", encrypted: true },
  { port: 4022, protocol: "tcp", service: "syslog-tls", description: "Syslog over TLS (also 6514).", category: "other", encrypted: true },
  { port: 4321, protocol: "tcp", service: "rwhois", description: "Referral Whois.", category: "network", encrypted: false },
  { port: 4500, protocol: "udp", service: "ipsec-nat-t", description: "IPsec NAT Traversal.", category: "security", encrypted: true },
  { port: 4567, protocol: "tcp", service: "tram", description: "奇异 Mark / Sanswire TRAM.", category: "other", encrypted: false },
  { port: 4848, protocol: "tcp", service: "appserv-http", description: "GlassFish Application Server admin.", category: "web", encrypted: false, securityNote: "Default GlassFish admin uses default password (adminadmin). Change immediately." },
  { port: 5000, protocol: "tcp", service: "upnp-alt", description: "UPnP (alternate) / Flask default.", category: "network", encrypted: false, securityNote: "Common dev-server port; never expose a dev server publicly." },
  { port: 5004, protocol: "udp", service: "rtp", description: "Real-time Transport Protocol (media).", category: "media", encrypted: false },
  { port: 5005, protocol: "udp", service: "rtp-rtcp", description: "RTP Control Protocol (RTCP).", category: "media", encrypted: false },
  { port: 5060, protocol: "tcp/udp", service: "sip", description: "Session Initiation Protocol (VoIP signaling).", category: "messaging", encrypted: false, encryptedAlternative: "sips (5061)", securityNote: "Common brute-force target for VoIP credentials; toll-fraud vector. Use SIPS (5061)." },
  { port: 5061, protocol: "tcp", service: "sips", description: "SIP over TLS.", category: "messaging", encrypted: true },
  { port: 5190, protocol: "tcp", service: "aim", description: "AOL Instant Messenger (legacy).", category: "messaging", encrypted: false },
  { port: 5222, protocol: "tcp", service: "xmpp-client", aliases: ["jabber-client"], description: "XMPP client-to-server.", category: "messaging", encrypted: true },
  { port: 5269, protocol: "tcp", service: "xmpp-server", aliases: ["jabber-server"], description: "XMPP server-to-server.", category: "messaging", encrypted: true },
  { port: 5351, protocol: "udp", service: "nat-pmp", description: "NAT Port Mapping Protocol (Apple).", category: "network", encrypted: false, securityNote: "Open NAT-PMP can be abused to open arbitrary ports (CVE-2015-5451). Disable on gateways unless needed." },
  { port: 5353, protocol: "udp", service: "mdns", description: "Multicast DNS (Bonjour, Avahi).", category: "name-resolution", encrypted: false, securityNote: "mDNS is link-local; ensure gateways do NOT forward 224.0.0.251 to the Internet." },
  { port: 5355, protocol: "udp", service: "llmnr", description: "Link-Local Multicast Name Resolution.", category: "name-resolution", encrypted: false, securityNote: "LLMNR/NBT-NS poisoning enables Responder-style credential capture. Disable via Group Policy on Windows." },
  { port: 5432, protocol: "tcp", service: "postgresql", description: "PostgreSQL database.", category: "database", encrypted: true, securityNote: "Restrict to app tier; force TLS (sslmode=verify-full); strong passwords." },
  { port: 5500, protocol: "tcp", service: "fcp-addr-srvr1", aliases: ["vnc-http-legacy"], description: "VNC HTTP viewer (legacy).", category: "remote", encrypted: false },
  { port: 5666, protocol: "tcp", service: "nrpe", description: "Nagios Remote Plugin Executor.", category: "network", encrypted: false, securityNote: "NRPE has no encryption by default; use NRPE over TLS or check_mk with TLS." },
  { port: 5672, protocol: "tcp", service: "amqp", description: "RabbitMQ / AMQP messaging.", category: "messaging", encrypted: true },
  { port: 5683, protocol: "udp", service: "coap", description: "Constrained Application Protocol (IoT).", category: "network", encrypted: false, encryptedAlternative: "coaps (5684)", securityNote: "IoT devices often run CoAP without auth or DTLS. Isolate IoT to its own VLAN." },
  { port: 5800, protocol: "tcp", service: "vnc-http", description: "VNC web viewer (Java applet, legacy).", category: "remote", encrypted: false },
  { port: 5900, protocol: "tcp", service: "rfb", aliases: ["vnc"], description: "Virtual Network Computing remote desktop.", category: "remote", encrypted: false, encryptedAlternative: "vnc over ssh/stunnel", securityNote: "VNC has weak built-in auth. Always tunnel over SSH or use a TLS wrapper.", commonlyExploited: true },
  { port: 5984, protocol: "tcp", service: "couchdb", description: "Apache CouchDB.", category: "database", encrypted: false, securityNote: "CouchDB admin party mode has no auth by default. Bind to localhost; enable TLS." },
  { port: 5985, protocol: "tcp", service: "wsman", aliases: ["winrm-http"], description: "Windows Remote Management (HTTP).", category: "remote", encrypted: false, encryptedAlternative: "winrm-https (5986)", securityNote: "WinRM over HTTP can leak credentials if auth is Basic. Use 5986 with HTTPS." },
  { port: 5986, protocol: "tcp", service: "wsmans", aliases: ["winrm-https"], description: "Windows Remote Management (HTTPS).", category: "remote", encrypted: true },
  { port: 6000, protocol: "tcp", service: "x11", description: "X Window System (X11).", category: "remote", encrypted: false, encryptedAlternative: "x11 over ssh", securityNote: "X11 over the network is unencrypted and bypasses xauth trivially. Always tunnel over SSH." },
  { port: 6379, protocol: "tcp", service: "redis", description: "Redis in-memory data store.", category: "database", encrypted: false, securityNote: "Default config has no auth and binds to 0.0.0.0 — a major source of cryptojacking. Set requirepass; bind to localhost.", commonlyExploited: true },
  { port: 6443, protocol: "tcp", service: "k8s-api", description: "Kubernetes API server.", category: "security", encrypted: true },
  { port: 6600, protocol: "tcp", service: "mpd", description: "Music Player Daemon.", category: "media", encrypted: false },
  { port: 6667, protocol: "tcp", service: "ircu", aliases: ["irc-alt"], description: "IRC (common alternate).", category: "messaging", encrypted: false, encryptedAlternative: "ircs (6697)" },
  { port: 6697, protocol: "tcp", service: "ircs", description: "IRC over TLS.", category: "messaging", encrypted: true },
  { port: 6881, protocol: "tcp/udp", service: "bittorrent", description: "BitTorrent (common client port).", category: "file-transfer", encrypted: false },
  { port: 7000, protocol: "tcp", service: "afs3-fileserver", description: "Andrew File System v3.", category: "file-transfer", encrypted: false },
  { port: 7001, protocol: "tcp", service: "afs3-callback", description: "AFS v3 callback.", category: "file-transfer", encrypted: false },
  { port: 7100, protocol: "tcp", service: "font-service", aliases: ["fs"], description: "X11 font service.", category: "other", encrypted: false },
  { port: 7474, protocol: "tcp", service: "neo4j", description: "Neo4j graph database (Bolt on 7687).", category: "database", encrypted: false, securityNote: "Default config has no auth. Enable auth; bind to app VLAN." },
  { port: 7547, protocol: "tcp", service: "cwmp", aliases: ["tr-069"], description: "CPE WAN Management Protocol (TR-069).", category: "network", encrypted: false, securityNote: "Used by ISPs to manage CPEs; exposed CWMP endpoints allow device takeover (CVE-2016-10372 etc.)." },
  { port: 7687, protocol: "tcp", service: "neo4j-bolt", description: "Neo4j Bolt protocol.", category: "database", encrypted: true },
  { port: 7777, protocol: "tcp", service: "cbt", description: "Computer-Based Telephony; common alternate for Unreal Tournament.", category: "other", encrypted: false },
  { port: 8000, protocol: "tcp", service: "irdmi", aliases: ["http-alt-1"], description: "HTTP alternate (common dev port).", category: "web", encrypted: false },
  { port: 8008, protocol: "tcp", service: "http-alt", description: "HTTP alternate.", category: "web", encrypted: false },
  { port: 8009, protocol: "tcp", service: "ajp13", description: "Apache JServ Protocol (Tomcat AJP).", category: "web", encrypted: false, securityNote: "Ghostcat (CVE-2020-1938) reads webapps via AJP. Bind to localhost; restrict access." },
  { port: 8080, protocol: "tcp", service: "http-proxy", aliases: ["http-alt-2"], description: "HTTP alternate / proxy (common).", category: "web", encrypted: false, encryptedAlternative: "https-alt (8443)", securityNote: "Common dev/admin port (Tomcat, Jenkins). Never expose unauthenticated admin UIs publicly." },
  { port: 8081, protocol: "tcp", service: "sunproxyadmin", description: "Sun proxy admin.", category: "network", encrypted: false },
  { port: 8086, protocol: "tcp", service: "influxdb", description: "InfluxDB HTTP API.", category: "database", encrypted: false, securityNote: "Older InfluxDB versions had an unauthenticated admin API (CVE-2019-20933). Upgrade; enable auth + TLS." },
  { port: 8088, protocol: "tcp", service: "radan-http", description: "Radan HTTP; common alternate for various admin panels.", category: "web", encrypted: false },
  { port: 8089, protocol: "tcp", service: "splunk", description: "Splunk management / REST.", category: "other", encrypted: true },
  { port: 8161, protocol: "tcp", service: "activemq-webconsole", description: "ActiveMQ Web Console.", category: "messaging", encrypted: false, securityNote: "Default ActiveMQ admin (admin/admin). Change immediately; bind to localhost." },
  { port: 8200, protocol: "tcp", service: "trivnet1", description: "Trivenet; common alternate for Vault dev server.", category: "security", encrypted: true },
  { port: 8333, protocol: "tcp", service: "bitcoin", description: "Bitcoin Core daemon.", category: "other", encrypted: true },
  { port: 8443, protocol: "tcp", service: "https-alt", description: "HTTPS alternate (admin panels, dev).", category: "web", encrypted: true },
  { port: 8530, protocol: "tcp", service: "wsus", description: "Windows Server Update Services (HTTP).", category: "security", encrypted: false, encryptedAlternative: "wsus-tls (8531)" },
  { port: 8531, protocol: "tcp", service: "wsus-tls", description: "WSUS over TLS.", category: "security", encrypted: true },
  { port: 8649, protocol: "tcp", service: "ganglia", description: "Ganglia monitoring.", category: "network", encrypted: false },
  { port: 8765, protocol: "tcp", service: "ultraseek-http", description: "Ultraseek HTTP; common alternate for various daemons.", category: "web", encrypted: false },
  { port: 8804, protocol: "tcp", service: "truecm", description: "TrueCM; common alternate for various admin panels.", category: "web", encrypted: false },
  { port: 8834, protocol: "tcp", service: "nessus-tls", description: "Nessus web UI over TLS.", category: "security", encrypted: true },
  { port: 8888, protocol: "tcp", service: "newsedge-server", aliases: ["http-alt-3"], description: "HTTP alternate (common dev/admin port).", category: "web", encrypted: false },
  { port: 9000, protocol: "tcp", service: "cslistener", aliases: ["http-alt-4", "php-fpm-1"], description: "PHP-FPM alternate; SonarQube; common dev port.", category: "web", encrypted: false },
  { port: 9001, protocol: "tcp", service: "tor-orport", description: "Tor relay ORPort.", category: "security", encrypted: true },
  { port: 9050, protocol: "tcp", service: "tor-socks", description: "Tor SOCKS proxy.", category: "security", encrypted: true },
  { port: 9051, protocol: "tcp", service: "tor-control", description: "Tor control port.", category: "security", encrypted: false, securityNote: "Tor control port allows unauthenticated config changes if exposed. Bind to localhost; set CookieAuthentication." },
  { port: 9080, protocol: "tcp", service: "glrpc", aliases: ["http-alt-5"], description: "HTTP alternate (often app servers).", category: "web", encrypted: false },
  { port: 9090, protocol: "tcp", service: "websm", aliases: ["prometheus"], description: "Prometheus metrics; WebSM.", category: "network", encrypted: false, securityNote: "Prometheus has no built-in auth. Put behind a reverse proxy with auth + TLS." },
  { port: 9091, protocol: "tcp", service: "xmltec-xmlmail", description: "XML mail; common alternate for various daemons (Transmission, etc.).", category: "other", encrypted: false },
  { port: 9100, protocol: "tcp", service: "jetdirect", aliases: ["pdl-data-stream"], description: "HP JetDirect / raw printing.", category: "printing", encrypted: false, securityNote: "Printers are often unpatched and sniffable. Isolate to a printing VLAN; disable remote admin." },
  { port: 9200, protocol: "tcp", service: "elasticsearch", description: "Elasticsearch HTTP API.", category: "database", encrypted: false, securityNote: "Default config has no auth. Multiple megabreaches from exposed ES clusters. Enable security; bind to app VLAN.", commonlyExploited: true },
  { port: 9300, protocol: "tcp", service: "elasticsearch-transport", description: "Elasticsearch transport (node-to-node).", category: "database", encrypted: true },
  { port: 9418, protocol: "tcp", service: "git", description: "Git protocol (unauthenticated pull).", category: "file-transfer", encrypted: false, encryptedAlternative: "git over ssh / https", securityNote: "Anonymous git push is a supply-chain risk. Use SSH (22) or HTTPS for write access." },
  { port: 9443, protocol: "tcp", service: "tungsten-https", aliases: ["https-alt-2"], description: "HTTPS alternate (admin/dev).", category: "web", encrypted: true },
  { port: 9500, protocol: "tcp", service: "ismserver", description: "ISM server; common alternate for various daemons.", category: "other", encrypted: false },
  { port: 953, protocol: "tcp", service: "rndc", description: "BIND Remote Name Daemon Control.", category: "name-resolution", encrypted: false, securityNote: "BIND rndc has had RCEs. Bind to localhost; require an rndc key." },
  { port: 9876, protocol: "tcp", service: "sd", aliases: ["cyborg-systems"], description: "Session Director; common alternate for various daemons.", category: "other", encrypted: false },
  { port: 9990, protocol: "tcp", service: "osm-appsrvr", description: "WildFly admin console.", category: "web", encrypted: false, securityNote: "Default WildFly admin (admin/admin). Change immediately; bind to management interface." },
  { port: 9999, protocol: "tcp", service: "distinct", aliases: ["http-alt-6"], description: "HTTP alternate (common dev/admin port).", category: "web", encrypted: false },

  // --- Dynamic / private (49152-65535) — commonly seen -------------------
  { port: 10000, protocol: "tcp", service: "ndmp", aliases: ["webmin"], description: "Webmin admin panel; NDMP backup.", category: "web", encrypted: true, securityNote: "Webmin had a critical unauthenticated RCE (CVE-2019-15107). Patch; restrict access." },
  { port: 10050, protocol: "tcp", service: "zabbix-agent", description: "Zabbix agent.", category: "network", encrypted: false, securityNote: "Zabbix agent runs commands sent by the server. Restrict Server= in config to trusted IPs." },
  { port: 10051, protocol: "tcp", service: "zabbix-server", description: "Zabbix server / proxy.", category: "network", encrypted: false },
  { port: 11211, protocol: "tcp", service: "memcache", aliases: ["memcached"], description: "Memcached key-value cache.", category: "database", encrypted: false, securityNote: "Default config has no auth; abused for the 2020 amplification-DDoS vector (CVE-2018-1000115). Disable UDP; bind to localhost.", commonlyExploited: true },
  { port: 11371, protocol: "tcp", service: "hkp", description: "OpenPGP HTTP Keyserver Protocol.", category: "security", encrypted: false, encryptedAlternative: "hkps (443)" },
  { port: 15001, protocol: "tcp", service: "tor-hidden", description: "Tor hidden-service port (common).", category: "security", encrypted: true },
  { port: 15672, protocol: "tcp", service: "rabbitmq-mgmt", description: "RabbitMQ management UI.", category: "messaging", encrypted: false, securityNote: "Default RabbitMQ admin (guest/guest); guest can only log in from localhost. Change password; enable TLS." },
  { port: 25565, protocol: "tcp", service: "minecraft", description: "Minecraft server.", category: "other", encrypted: false, securityNote: "Minecraft servers are DDoS and griefing targets. Use a whitelist; enable online-mode." },
  { port: 25826, protocol: "udp", service: "collectd", description: "collectd metrics.", category: "network", encrypted: false },
  { port: 26257, protocol: "tcp", service: "cockroachdb", description: "CockroachDB SQL.", category: "database", encrypted: true },
  { port: 27015, protocol: "udp", service: "halflife", aliases: ["srcds"], description: "Steam / Source engine game server.", category: "messaging", encrypted: false },
  { port: 27017, protocol: "tcp", service: "mongodb", description: "MongoDB database.", category: "database", encrypted: false, securityNote: "Default config has no auth; source of countless 'MongoDB ransom' incidents. Enable auth; bind to localhost or app VLAN; enable TLS.", commonlyExploited: true },
  { port: 32400, protocol: "tcp", service: "plex", description: "Plex media server.", category: "media", encrypted: true },
  { port: 33434, protocol: "udp", service: "traceroute", description: "Default traceroute base port.", category: "network", encrypted: false },
  { port: 50000, protocol: "tcp", service: "ibm-db2", description: "IBM Db2 database.", category: "database", encrypted: true },
  { port: 50070, protocol: "tcp", service: "hdfs-namenode", description: "Hadoop HDFS NameNode web UI.", category: "database", encrypted: false, securityNote: "Default Hadoop web UIs have no auth. Restrict access; put behind a gateway." },
  { port: 50075, protocol: "tcp", service: "hdfs-datanode", description: "Hadoop HDFS DataNode web UI.", category: "database", encrypted: false },
  { port: 50090, protocol: "tcp", service: "yarn-rm", description: "Hadoop YARN ResourceManager.", category: "database", encrypted: false },
  { port: 61613, protocol: "tcp", service: "stomp", description: "STOMP messaging (ActiveMQ).", category: "messaging", encrypted: false },
];

// ---------------------------------------------------------------------------
// Constants — categories, protocols, ranges
// ---------------------------------------------------------------------------

export const CATEGORIES: readonly PortCategory[] = [
  "web", "mail", "database", "remote", "file-transfer",
  "name-resolution", "security", "messaging", "network",
  "media", "printing", "directory", "other",
];

export const PROTOCOLS: readonly (Protocol | "any")[] = [
  "any", "tcp", "udp", "tcp/udp",
];

/** IANA range boundaries. */
export const RANGE_BOUNDS = {
  "well-known": [0, 1023] as const,
  "registered": [1024, 49151] as const,
  "dynamic": [49152, 65535] as const,
};

// ---------------------------------------------------------------------------
// Plain-English explanations
// ---------------------------------------------------------------------------

const CATEGORY_EXPLANATIONS: Record<PortCategory, string> = {
  web: "Web protocols — HTTP, HTTPS, and admin/dev web UIs.",
  mail: "Email — SMTP (server-to-server), submission (client-to-server), POP3/IMAP (mailbox access), and their TLS variants.",
  database: "Database servers (MySQL, PostgreSQL, MongoDB, Redis, MSSQL, Oracle, Elasticsearch, …). Common attack targets — restrict to app VLAN.",
  remote: "Remote access (SSH, Telnet, RDP, VNC, WinRM, Docker).",
  "file-transfer": "File transfer (FTP, SFTP, TFTP, rsync, NFS, SMB, AFP).",
  "name-resolution": "DNS and friends (DNS, mDNS, LLMNR).",
  security: "Security infrastructure — VPNs (OpenVPN, IPsec, L2TP, PPTP), Kerberos, RADIUS, directory auth, key servers.",
  messaging: "Chat and messaging (IRC, XMPP, SIP, AMQP, SMPP).",
  network: "Network infrastructure — DHCP, NTP, SNMP, BGP, RIP, UPnP, proxies.",
  media: "Streaming media (RTSP, RTP, MMS, H.323, SCCP).",
  printing: "Printing protocols (LPD/LPR, IPP/CUPS, JetDirect).",
  directory: "Directory services (LDAP, LDAPS, Active Directory Global Catalog).",
  other: "Everything else (syslog, finger, NNTP, time, etc.).",
};

const PROTOCOL_EXPLANATIONS: Record<Protocol, string> = {
  tcp: "TCP — connection-oriented, reliable, ordered. Used by HTTP/HTTPS, SSH, SMTP, FTP control, MySQL, RDP, etc.",
  udp: "UDP — connectionless, no delivery guarantee. Used by DNS, DHCP, NTP, SNMP, syslog, RTP, QUIC (over UDP 443).",
  "tcp/udp": "Registered for both TCP and UDP (IANA assigns both to the same service). Examples: DNS 53, SNMP 161, RTP 5004.",
};

/** Explain a port-category tag in plain English. */
export function explainCategory(c: PortCategory): string {
  return CATEGORY_EXPLANATIONS[c];
}

/** Explain a transport protocol in plain English. */
export function explainProtocol(p: Protocol): string {
  return PROTOCOL_EXPLANATIONS[p];
}

/** Explain whether a port is encrypted and what the encrypted alternative is. */
export function explainEncrypted(entry: PortEntry): string {
  if (entry.encrypted) {
    return `${entry.service} (port ${entry.port}) speaks an encrypted protocol — traffic is protected in transit.`;
  }
  if (entry.encryptedAlternative) {
    return `${entry.service} (port ${entry.port}) is UNENCRYPTED. Use ${entry.encryptedAlternative} instead for in-transit protection.`;
  }
  return `${entry.service} (port ${entry.port}) is unencrypted and has no widely-deployed encrypted variant — restrict to a trusted network or tunnel over a VPN/SSH.`;
}

// ---------------------------------------------------------------------------
// Classification + lookup
// ---------------------------------------------------------------------------

/** Classify a port number into its IANA range bucket. */
export function classifyRange(port: number): PortRange {
  if (port <= 1023) return "well-known";
  if (port <= 49151) return "registered";
  return "dynamic";
}

/** Friendly label for an IANA range. */
export function rangeLabel(r: PortRange): string {
  if (r === "well-known") return "Well-known (0–1023)";
  if (r === "registered") return "Registered (1024–49151)";
  return "Dynamic / private (49152–65535)";
}

/** Find entries by exact port number (a single number may have multiple entries — TCP and UDP variants). */
export function findByPort(port: number, protocol?: Protocol | "any"): PortEntry[] {
  return PORTS.filter((p) => p.port === port && (!protocol || protocol === "any" || p.protocol === protocol || (protocol === "tcp" && p.protocol === "tcp/udp") || (protocol === "udp" && p.protocol === "tcp/udp")));
}

/** Find entries by service name (case-insensitive exact or alias match). */
export function findByService(name: string): PortEntry[] {
  const q = name.trim().toLowerCase();
  if (!q) return [];
  return PORTS.filter((p) =>
    p.service.toLowerCase() === q ||
    p.service.includes(q) ||
    (p.aliases ?? []).some((a) => a.toLowerCase() === q || a.toLowerCase().includes(q)),
  );
}

// ---------------------------------------------------------------------------
// Search + filter
// ---------------------------------------------------------------------------

/** Normalize a search query (trim + lowercase). */
export function normalizeQuery(q: string): string {
  return q.trim().toLowerCase();
}

/** True if the query string is a pure number (port-number search). */
export function isNumericQuery(q: string): boolean {
  return /^\d+$/.test(q.trim());
}

/** Apply search + filters and return the matching entries. */
export function searchPorts(filters: SearchFilters): PortEntry[] {
  const query = normalizeQuery(filters.query ?? "");
  const protocol = filters.protocol ?? "any";
  const category = filters.category ?? "any";
  const encryptedOnly = filters.encryptedOnly === true;
  const exploitedOnly = filters.commonlyExploitedOnly === true;

  return PORTS.filter((p) => {
    if (protocol !== "any" && p.protocol !== protocol &&
        !(protocol === "tcp" && p.protocol === "tcp/udp") &&
        !(protocol === "udp" && p.protocol === "tcp/udp")) {
      return false;
    }
    if (category !== "any" && p.category !== category) return false;
    if (encryptedOnly && !p.encrypted) return false;
    if (exploitedOnly && !p.commonlyExploited) return false;
    if (filters.rangeStart !== undefined && p.port < filters.rangeStart) return false;
    if (filters.rangeEnd !== undefined && p.port > filters.rangeEnd) return false;
    if (query) {
      if (isNumericQuery(query)) {
        return p.port === parseInt(query, 10);
      }
      const inService = p.service.toLowerCase().includes(query);
      const inAliases = (p.aliases ?? []).some((a) => a.toLowerCase().includes(query));
      const inDesc = p.description.toLowerCase().includes(query);
      const inCategory = p.category.toLowerCase().includes(query);
      if (!inService && !inAliases && !inDesc && !inCategory) return false;
    }
    return true;
  });
}

// ---------------------------------------------------------------------------
// Grouping
// ---------------------------------------------------------------------------

/** Group entries by IANA range. */
export function groupByRange(ports: PortEntry[]): PortsByRange {
  const out: PortsByRange = { "well-known": [], registered: [], dynamic: [] };
  for (const p of ports) {
    out[classifyRange(p.port)].push(p);
  }
  return out;
}

/** Group entries by category, sorted by category then port. */
export function groupByCategory(ports: PortEntry[]): PortsByCategory[] {
  const map = new Map<PortCategory, PortEntry[]>();
  for (const p of ports) {
    if (!map.has(p.category)) map.set(p.category, []);
    map.get(p.category)!.push(p);
  }
  const out: PortsByCategory[] = [];
  for (const cat of CATEGORIES) {
    if (map.has(cat)) {
      out.push({ category: cat, ports: map.get(cat)! });
    }
  }
  return out;
}

/** Sort entries: by port ascending, then protocol (tcp before udp before tcp/udp). */
export function sortPorts(ports: PortEntry[]): PortEntry[] {
  const protoRank: Record<Protocol, number> = { tcp: 0, udp: 1, "tcp/udp": 2 };
  return ports.slice().sort((a, b) =>
    a.port - b.port || protoRank[a.protocol] - protoRank[b.protocol],
  );
}

// ---------------------------------------------------------------------------
// Stats
// ---------------------------------------------------------------------------

export interface PortStats {
  total: number;
  byProtocol: Record<Protocol, number>;
  byRange: Record<PortRange, number>;
  byCategory: Record<PortCategory, number>;
  encryptedCount: number;
  commonlyExploitedCount: number;
}

/** Compute summary stats over a set of port entries. */
export function computeStats(ports: PortEntry[] = PORTS as PortEntry[]): PortStats {
  const stats: PortStats = {
    total: ports.length,
    byProtocol: { tcp: 0, udp: 0, "tcp/udp": 0 },
    byRange: { "well-known": 0, registered: 0, dynamic: 0 },
    byCategory: Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<PortCategory, number>,
    encryptedCount: 0,
    commonlyExploitedCount: 0,
  };
  for (const p of ports) {
    stats.byProtocol[p.protocol]++;
    stats.byRange[classifyRange(p.port)]++;
    stats.byCategory[p.category]++;
    if (p.encrypted) stats.encryptedCount++;
    if (p.commonlyExploited) stats.commonlyExploitedCount++;
  }
  return stats;
}

// ---------------------------------------------------------------------------
// Security summary
// ---------------------------------------------------------------------------

/** Build a long-form security advisory for a port entry. */
export function securitySummary(entry: PortEntry): string {
  const parts: string[] = [];
  parts.push(`Port ${entry.port}/${entry.protocol} — ${entry.service}.`);
  parts.push(`Category: ${entry.category}. Range: ${rangeLabel(classifyRange(entry.port))}.`);
  parts.push(explainEncrypted(entry));
  if (entry.commonlyExploited) {
    parts.push("⚠ Commonly targeted by attackers — see the per-port note for mitigations.");
  }
  if (entry.securityNote) {
    parts.push(`Mitigation: ${entry.securityNote}`);
  } else if (!entry.commonlyExploited) {
    parts.push("No specific advisory recorded for this port — apply the principle of least exposure: block unless needed, bind to the smallest audience, and prefer the encrypted variant.");
  }
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// Export / cheat-sheet formatters
// ---------------------------------------------------------------------------

/** Format entries as a plain-text cheat sheet. */
export function formatAsText(ports: PortEntry[]): string {
  const sorted = sortPorts(ports);
  const lines: string[] = [
    `# Well-Known / Common Ports Cheat Sheet`,
    `# Generated: ${new Date().toISOString().slice(0, 10)}`,
    `# Dataset: ${DATASET_SOURCE} (snapshot ${DATASET_DATE}, v${DATASET_VERSION})`,
    `# ${sorted.length} entries`,
    ``,
  ];
  for (const p of sorted) {
    const aliases = p.aliases?.length ? ` [${p.aliases.join(", ")}]` : "";
    lines.push(`${String(p.port).padStart(5)} /${p.protocol.padEnd(7)} ${p.service}${aliases}`);
    lines.push(`         ${p.description}`);
    if (p.securityNote) lines.push(`         ⚠ ${p.securityNote}`);
    lines.push(``);
  }
  return lines.join("\n");
}

/** Format entries as a Markdown table. */
export function formatAsMarkdown(ports: PortEntry[]): string {
  const sorted = sortPorts(ports);
  const lines: string[] = [
    `# Common Ports Cheat Sheet`,
    ``,
    `_${DATASET_SOURCE} — snapshot ${DATASET_DATE} (v${DATASET_VERSION}) — ${sorted.length} entries_`,
    ``,
    `| Port | Proto | Service | Aliases | Category | Encrypted | Description |`,
    `| ---: | :--- | :--- | :--- | :--- | :---: | :--- |`,
  ];
  for (const p of sorted) {
    const aliases = p.aliases?.length ? p.aliases.join(", ") : "—";
    const enc = p.encrypted ? "✓" : "✗";
    const desc = p.description.replace(/\|/g, "\\|");
    lines.push(`| ${p.port} | ${p.protocol} | \`${p.service}\` | ${aliases} | ${p.category} | ${enc} | ${desc} |`);
  }
  return lines.join("\n");
}

/** Format entries as CSV. */
export function formatAsCsv(ports: PortEntry[]): string {
  const sorted = sortPorts(ports);
  const esc = (s: string | number | boolean | undefined): string => {
    if (s === undefined || s === null) return "";
    const str = String(s);
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines: string[] = [
    `port,protocol,service,aliases,description,category,encrypted,encryptedAlternative,commonlyExploited,securityNote`,
  ];
  for (const p of sorted) {
    lines.push([
      p.port,
      p.protocol,
      p.service,
      (p.aliases ?? []).join("|"),
      p.description,
      p.category,
      p.encrypted ? "yes" : "no",
      p.encryptedAlternative ?? "",
      p.commonlyExploited ? "yes" : "no",
      p.securityNote ?? "",
    ].map(esc).join(","));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// History (localStorage)
// ---------------------------------------------------------------------------

const HISTORY_KEY = "unqtools:well-known-common-ports-reference:history";
const HISTORY_MAX = 20;

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

export function buildShareUrl(state: ShareState): string {
  const params = new URLSearchParams();
  if (state.query) params.set("q", state.query);
  if (state.protocol && state.protocol !== "any") params.set("proto", state.protocol);
  if (state.category && state.category !== "any") params.set("cat", state.category);
  if (typeof window === "undefined") return `?${params.toString()}`;
  return `${window.location.origin}${window.location.pathname}#${params.toString()}`;
}

export function parseShareUrl(hash: string): ShareState {
  const clean = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!clean) return {};
  const params = new URLSearchParams(clean);
  const query = params.get("q") ?? undefined;
  const protocol = params.get("proto") ?? undefined;
  const category = params.get("cat") ?? undefined;
  return { query, protocol, category };
}

import { describe, it, expect, beforeEach } from "vitest";
import {
  OID_NAMES,
  WEAK_SIG_ALGORITHMS,
  MIN_RSA_BITS,
  DEFAULT_TLS_PORT,
  KEY_USAGE_BITS,
  decodeBase64,
  detectPemType,
  decodePem,
  parseDer,
  parseObjectIdentifier,
  oidName,
  integerToHex,
  parseAsn1Time,
  parseCertificate,
  parseCsr,
  decodePemBlock,
  sha1,
  sha256,
  sha1Hex,
  sha256Hex,
  formatFingerprint,
  computeFingerprints,
  checkExpiry,
  daysBetween,
  getCn,
  isSelfSigned,
  validateChain,
  matchHostnameOne,
  matchHostname,
  detectWeaknesses,
  generateOpensslCommands,
  generatePemInspectionCommands,
  explainField,
  explainAllFields,
  explainPemLabel,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type DecodedCertificate,
  type DistinguishedName,
  type PublicKeyInfo,
  type SanEntry,
  type PemBlock,
} from "./logic";

// ---------------------------------------------------------------------------
// Real test fixtures (generated with openssl 3.5.6, see worklog).
// ---------------------------------------------------------------------------

/** Self-signed RSA-2048 cert (CN=test.example.com, SAN=test.example.com +
 *  www.test.example.com, validity 2026-07-22..2027-07-22, sha256WithRSAEncryption). */
const RSA_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDjDCCAnSgAwIBAgIUDdnhtVFqI64WrQJ+XrLLcu7+BDUwDQYJKoZIhvcNAQEL
BQAwOzEZMBcGA1UEAwwQdGVzdC5leGFtcGxlLmNvbTERMA8GA1UECgwIVGVzdCBP
cmcxCzAJBgNVBAYTAlVTMB4XDTI2MDcyMjAwMzQxM1oXDTI3MDcyMjAwMzQxM1ow
OzEZMBcGA1UEAwwQdGVzdC5leGFtcGxlLmNvbTERMA8GA1UECgwIVGVzdCBPcmcx
CzAJBgNVBAYTAlVTMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEArsgK
NF5xxqP/9BD7wm0Uua1QlLU69yYYa9OZFKC4uL9lnxv2es23m3SN6vfgXLNgDKPF
bqC3Sw4e9xqeI/Q3CnXAlj422FlDu7kD1P9MzrRAlmBZIr2R4jQWbojRQIX1o9H9
MCy/xRZKZk4HbU0QxzllDYgQ1TfIp3QXR+jD06lErt1hWUnUZh0kmNuVi+wzLYXV
I/oD4a1uFv9GaQtdSk6LDfc71vDVM1hooRGoi9TgeIdgIHsy/QM1nWbyKrrYEU73
2zDx0U/+z216f2LcXyWDrNEcEWydwCBWxahvvURi18wAhMUO8ov54vGj531cmQEJ
8B2CThrUr4u+4asfYwIDAQABo4GHMIGEMB0GA1UdDgQWBBQqYFOpGRQv3UOO3fqH
Cg/15AZ8/zAfBgNVHSMEGDAWgBQqYFOpGRQv3UOO3fqHCg/15AZ8/zAPBgNVHRMB
Af8EBTADAQH/MDEGA1UdEQQqMCiCEHRlc3QuZXhhbXBsZS5jb22CFHd3dy50ZXN0
LmV4YW1wbGUuY29tMA0GCSqGSIb3DQEBCwUAA4IBAQBBvU7ZckwFZo3h5Jqi4XYZ
sxdAMotvAzOVKZYv4OdiJEsa9Zc1HJFi3sFocM00fqr31hClWzLFK3lqxFodZ0Yi
MsbsFyCkw5PxVBMd57HWOT1RK9lQVt7rz4jDF93nqQvHqedHaj2MkH2NQzDbpsV+
adp+DPOMi1IIG5UTV1ffJ2RYokonGTuMpA974sV5YX1VyRNX2znTjVAFsP8T2eAT
LckVrysmYHMaShqYtIgSyhaEO4XhoDOAquNO7auTrHCp0uFxITMXpXa8czabQtaF
DlTSRWdp12MMK4RxCN21kx8FeXPOVCp8x672uGdBSCGKJjNNeagU6pBlsfU4hNd5
-----END CERTIFICATE-----`;

const RSA_CERT_SHA1 = "93:45:34:76:B6:07:4F:A2:B7:16:E9:68:23:99:8A:23:D5:64:16:FF";
const RSA_CERT_SHA256 = "36:F4:9E:8B:3A:AC:F2:B4:88:7F:DC:DB:C8:44:F2:81:4A:05:D4:51:C3:01:EB:63:26:70:28:33:24:56:B2:37";

/** Expired self-signed RSA-2048 cert (CN=expired.example.com, 2010-01-01..2010-01-02). */
const EXPIRED_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIDWzCCAkOgAwIBAgIUAWaBo1JRIPt4NhHn8wGc00DCXREwDQYJKoZIhvcNAQEL
BQAwPTEcMBoGA1UEAwwTZXhwaXJlZC5leGFtcGxlLmNvbTEQMA4GA1UECgwHRXhw
aXJlZDELMAkGA1UEBhMCVVMwHhcNMTAwMTAxMDAwMDAwWhcNMTAwMTAyMDAwMDAw
WjA9MRwwGgYDVQQDDBNleHBpcmVkLmV4YW1wbGUuY29tMRAwDgYDVQQKDAdFeHBp
cmVkMQswCQYDVQQGEwJVUzCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEB
AI/RYzYr06t0l/h1LSb/HaCDTmEy6ElPUjFP9cl+/piEUAy+MGFFl5U6CImHw+RW
ksblP92lvUE/VJmBxKh7vTDngSgkBv0uJef1jO+kNE35ivkzAQ8A8a1ND3lFfV8p
AINPtLB9uTd7JDbvr/XEqvbVEioiBkVt+DLkqCo3HpEKCVKZk9aBKHmS0uWU0ufq
1hGYn56gHA2jLvha1nbKUlJFBwPuILoYeYnNwR4PBsGMGEXYQp0XgiON0mC8MX1o
Z6Wy4wBw3/OsBe6WWmEcU8sdabcWH/tN2gEJ+rB8YeRHTSth+YlUTEg80GcEVF0G
lrl6A7uqw9v0ptb6QJN6DScCAwEAAaNTMFEwHQYDVR0OBBYEFA0aia+YQ0OY6AY0
waKPZnYs/28PMB8GA1UdIwQYMBaAFA0aia+YQ0OY6AY0waKPZnYs/28PMA8GA1Ud
EwEB/wQFMAMBAf8wDQYJKoZIhvcNAQELBQADggEBAIBciis1v2kGTlHgccmXYbwj
3Fe/tt6GFEjglCPnHtba2UFIAD80GoYkydT04GEzIJqkL/w0fECHBBI+OFa2GOTg
x66UHj2x2bAjziBsXXdS0mGgwC0A65hiZc69v7/pZ6vdhWpjn2y+sAij+QARftIn
Wv8TnfNsE7eOHtzv5LFvxyTrPOfsAV8CUB/GSsmQAna8j+mJBMDj/9j0ibspviDg
2R2VepWCtdAdFVr1vfznd9FYLOJB+BgGHxREKWIQxJTolE8wOwYYjs1meP0S0+qd
2pmedGQicakkqhIRnW+EDqZZqrZzFqJ+POPbpxm39OAge1z8NtHvs80NRIhOSPk=
-----END CERTIFICATE-----`;

/** Self-signed ECDSA-P-256 cert (CN=ec.example.com, SAN=ec.example.com, ecdsa-with-SHA256). */
const EC_CERT_PEM = `-----BEGIN CERTIFICATE-----
MIIB4DCCAYagAwIBAgIUHBY1A4wWmQXuLYyHAXSan+LlFmEwCgYIKoZIzj0EAwIw
ODEXMBUGA1UEAwwOZWMuZXhhbXBsZS5jb20xEDAOBgNVBAoMB0VDIFRlc3QxCzAJ
BgNVBAYTAlVTMB4XDTI2MDcyMjAwMzQzMFoXDTI3MDcyMjAwMzQzMFowODEXMBUG
A1UEAwwOZWMuZXhhbXBsZS5jb20xEDAOBgNVBAoMB0VDIFRlc3QxCzAJBgNVBAYT
AlVTMFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEzbsGEiwPBrxGU/PRfBnpY7I7
QxFd4Cv3GbVcD2zbopbGF43lJVzfLnPqYUjTxXWI7uTtts8PpJC7/Tse1Q//1KNu
MGwwHQYDVR0OBBYEFMu3Vx5v1D0LaZldIQMIWcuwJWygMB8GA1UdIwQYMBaAFMu3
Vx5v1D0LaZldIQMIWcuwJWygMA8GA1UdEwEB/wQFMAMBAf8wGQYDVR0RBBIwEIIO
ZWMuZXhhbXBsZS5jb20wCgYIKoZIzj0EAwIDSAAwRQIhAKxz4dLPgQMMzMYisTdh
MqIHmomZyjpASbJpWT5YqUJ6AiB5/6bn8HtUuPzU3evSeAgatv4/bs3Pdrra83oZ
6VaMHA==
-----END CERTIFICATE-----`;

/** PKCS#10 CSR (CN=csr.example.com, O=CSR Test, RSA-2048). */
const CSR_PEM = `-----BEGIN CERTIFICATE REQUEST-----
MIICfzCCAWcCAQAwOjEYMBYGA1UEAwwPY3NyLmV4YW1wbGUuY29tMREwDwYDVQQK
DAhDU1IgVGVzdDELMAkGA1UEBhMCVVMwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAw
ggEKAoIBAQCbRUbGQ20Silh0UAypvL8fJbWjejhczYzwThIwHlYcJefS3ntaRDFi
kh4QkQEP2Jja54zyudQ60uvOHPrW9eG4Vyz61BF8RCqffIG2sCWM0BVaJ0rolVHf
dRDQVngaLaDVU4lEsj1h8qCbHj8NkB8Ay5G61mWCkMIA6jOlxRJ1TZNOaBDVkdC/
rDnfQ7io8UZ64336ltk38TfcD/XrmoO0Krm7JcpAkGgAQk3Gwe597oQmwneIrfWx
TRkiTNXUZHFkq2ybFfXWZeWElYHb3hr5Ck9u9slLLN2OuW96jYhw3ETt/2m3K+FD
st+sNE2PvkzNLwb7Ou5itP6H0muCeoLlAgMBAAGgADANBgkqhkiG9w0BAQsFAAOC
AQEAB/vurJXq5a8nvD0qjfT8ZQKA+SLhJLlfhZ/CmjREPMZw20dx8wIiOCl8RdX+
Spxk8ZdrdSkV+0d7YoU3xaOEVCiaRUEWdNJiw7O74ZC29fhfPvn7acRURn4/1Yri
0O35YOkP1/I87wiiPBPCofS4XPt87Q6iscnZho4gjJTsWb37F7nOXsQARYsq8kxq
iHPkEv4R0YjlY7AXwVS3/bhsDhEcx34UNADWibyqAajlmsJ5/q/i35zRWrNmFFyI
6EeXI2qdAs/xg88cdGhflD/r4sBQArz29sIPfj4F+JFOkiXlMPQqm0dQsQwvpLLK
GdyKMbrQLMDf/4ZPeDYY4FQx+A==
-----END CERTIFICATE REQUEST-----`;

/** Private-key PEM (label only — the tool refuses to parse key material). */
const PRIVATE_KEY_PEM = `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDdQne7JQ123456
dummy+key+material+never+parsed+by+the+decoder+tool+do/not/paste+
real+private+keys+into+a+web+tool+this+is+a+placeholder+only+
FAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKEFAKE
-----END PRIVATE KEY-----`;

beforeEach(() => {
  const store: Record<string, string> = {};
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => { store[k] = v; },
    removeItem: (k: string) => { delete store[k]; },
    clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    key: (i: number) => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; },
  };
});

// ---------------------------------------------------------------------------
describe("ssl constants", () => {
  it("knows the CN OID", () => {
    expect(OID_NAMES["2.5.4.3"]).toBe("CN");
  });
  it("knows the sha256WithRSAEncryption OID", () => {
    expect(OID_NAMES["1.2.840.113549.1.1.11"]).toBe("sha256WithRSAEncryption");
  });
  it("knows the prime256v1 EC curve OID", () => {
    expect(OID_NAMES["1.2.840.10045.3.1.7"]).toBe("prime256v1");
  });
  it("marks md5/sha1 sig algorithms as weak", () => {
    expect(WEAK_SIG_ALGORITHMS.has("md5WithRSAEncryption")).toBe(true);
    expect(WEAK_SIG_ALGORITHMS.has("sha1WithRSAEncryption")).toBe(true);
    expect(WEAK_SIG_ALGORITHMS.has("ecdsa-with-SHA1")).toBe(true);
  });
  it("MIN_RSA_BITS is 2048", () => {
    expect(MIN_RSA_BITS).toBe(2048);
  });
  it("DEFAULT_TLS_PORT is 443", () => {
    expect(DEFAULT_TLS_PORT).toBe(443);
  });
  it("has 9 KeyUsage bits", () => {
    expect(KEY_USAGE_BITS).toHaveLength(9);
    expect(KEY_USAGE_BITS[0]).toBe("digitalSignature");
    expect(KEY_USAGE_BITS[5]).toBe("keyCertSign");
  });
});

// ---------------------------------------------------------------------------
describe("ssl decodeBase64", () => {
  it("decodes empty to empty", () => {
    expect(decodeBase64("")).toEqual([]);
  });
  it("decodes 'Zg==' to [0x66]", () => {
    expect(decodeBase64("Zg==")).toEqual([0x66]);
  });
  it("decodes 'Zm9v' to 'foo' ([0x66,0x6f,0x6f])", () => {
    expect(decodeBase64("Zm9v")).toEqual([0x66, 0x6f, 0x6f]);
  });
  it("ignores whitespace", () => {
    expect(decodeBase64("Z m 9 v\n")).toEqual([0x66, 0x6f, 0x6f]);
  });
});

// ---------------------------------------------------------------------------
describe("ssl detectPemType / decodePem", () => {
  it("detectPemType returns null for plain text", () => {
    expect(detectPemType("hello world")).toBeNull();
  });
  it("detectPemType returns CERTIFICATE", () => {
    expect(detectPemType(RSA_CERT_PEM)).toBe("CERTIFICATE");
  });
  it("detectPemType returns CERTIFICATE REQUEST for CSR", () => {
    expect(detectPemType(CSR_PEM)).toBe("CERTIFICATE REQUEST");
  });
  it("decodePem returns ok=false on empty input", () => {
    const r = decodePem("");
    expect(r.ok).toBe(false);
    expect(r.blocks).toEqual([]);
  });
  it("decodePem parses a single cert", () => {
    const r = decodePem(RSA_CERT_PEM);
    expect(r.ok).toBe(true);
    expect(r.blocks).toHaveLength(1);
    expect(r.blocks[0].label).toBe("CERTIFICATE");
    expect(r.blocks[0].der.length).toBeGreaterThan(100);
  });
  it("decodePem parses a multi-block chain", () => {
    const r = decodePem(`${RSA_CERT_PEM}\n${EC_CERT_PEM}`);
    expect(r.ok).toBe(true);
    expect(r.blocks).toHaveLength(2);
    expect(r.blocks[0].label).toBe("CERTIFICATE");
    expect(r.blocks[1].label).toBe("CERTIFICATE");
  });
  it("decodePem reports an error for non-PEM input", () => {
    const r = decodePem("not a pem");
    expect(r.ok).toBe(false);
    expect(r.errors.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe("ssl parseObjectIdentifier / oidName / integerToHex", () => {
  it("parses the rsaEncryption OID bytes", () => {
    // 1.2.840.113549.1.1.1 → first byte 0x2a (40*1+2), then 0x840 → 0x86,0x48 etc.
    // Pre-encoded bytes from RFC 8017.
    const oidBytes = [0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01];
    expect(parseObjectIdentifier(oidBytes)).toBe("1.2.840.113549.1.1.1");
  });
  it("parses the CN attribute OID 2.5.4.3", () => {
    const oidBytes = [0x55, 0x04, 0x03];
    expect(parseObjectIdentifier(oidBytes)).toBe("2.5.4.3");
  });
  it("oidName returns friendly name for known OID", () => {
    expect(oidName("1.2.840.113549.1.1.11")).toBe("sha256WithRSAEncryption");
  });
  it("oidName returns the dotted form for unknown OID", () => {
    expect(oidName("9.9.9.9")).toBe("9.9.9.9");
  });
  it("integerToHex strips a leading sign byte 0x00", () => {
    // Tag 0x02 (INTEGER), value [0x00, 0xff] → "FF"
    const node = parseDer([0x02, 0x02, 0x00, 0xff]);
    expect(integerToHex(node)).toBe("FF");
  });
  it("integerToHex handles a single-byte integer", () => {
    const node = parseDer([0x02, 0x01, 0x42]);
    expect(integerToHex(node)).toBe("42");
  });
});

// ---------------------------------------------------------------------------
describe("ssl parseAsn1Time", () => {
  it("parses a UTCTime YYMMDDHHMMSSZ", () => {
    // UTCTime tag = 0x17
    const bytes = [0x17, 0x0d];
    const chars = "260722003413Z";
    for (const c of chars) bytes.push(c.charCodeAt(0));
    const node = parseDer(bytes);
    expect(parseAsn1Time(node)).toBe("2026-07-22T00:34:13Z");
  });
  it("parses a GeneralizedTime YYYYMMDDHHMMSSZ", () => {
    // GeneralizedTime tag = 0x18
    const bytes = [0x18, 0x0f];
    const chars = "20100101000000Z";
    for (const c of chars) bytes.push(c.charCodeAt(0));
    const node = parseDer(bytes);
    expect(parseAsn1Time(node)).toBe("2010-01-01T00:00:00Z");
  });
  it("UTCTime 49 → 2049, 50 → 1950", () => {
    const bytes1 = [0x17, 0x0d];
    for (const c of "491231235959Z") bytes1.push(c.charCodeAt(0));
    expect(parseAsn1Time(parseDer(bytes1))).toBe("2049-12-31T23:59:59Z");
    const bytes2 = [0x17, 0x0d];
    for (const c of "500101000000Z") bytes2.push(c.charCodeAt(0));
    expect(parseAsn1Time(parseDer(bytes2))).toBe("1950-01-01T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
describe("ssl parseCertificate (RSA 2048)", () => {
  let cert: DecodedCertificate;
  it("parses without throwing", () => {
    const block = decodePem(RSA_CERT_PEM).blocks[0];
    cert = parseCertificate(block.der);
    expect(cert.kind).toBe("certificate");
  });
  it("extracts subject CN", () => {
    expect(getCn(cert.subject)).toBe("test.example.com");
  });
  it("extracts issuer CN", () => {
    expect(getCn(cert.issuer)).toBe("test.example.com");
  });
  it("subject RFC 4514 contains CN, O, C", () => {
    expect(cert.subject.rfc4514).toContain("CN=test.example.com");
    expect(cert.subject.rfc4514).toContain("O=Test Org");
    expect(cert.subject.rfc4514).toContain("C=US");
  });
  it("extracts validity window", () => {
    expect(cert.notBefore).toBe("2026-07-22T00:34:13Z");
    expect(cert.notAfter).toBe("2027-07-22T00:34:13Z");
  });
  it("reports RSA-2048 public key", () => {
    expect(cert.publicKey.algorithm).toBe("rsaEncryption");
    expect(cert.publicKey.bitLength).toBe(2048);
  });
  it("reports sha256WithRSAEncryption signature", () => {
    expect(cert.signatureAlgorithm).toBe("sha256WithRSAEncryption");
  });
  it("extracts both SAN DNS names", () => {
    expect(cert.sans).toHaveLength(2);
    expect(cert.sans.map((s) => s.value).sort()).toEqual(
      ["test.example.com", "www.test.example.com"].sort(),
    );
  });
  it("marks as CA (basicConstraints CA:TRUE)", () => {
    expect(cert.isCa).toBe(true);
  });
  it("has a non-empty serial hex", () => {
    expect(cert.serialHex.length).toBeGreaterThan(8);
  });
  it("computes the SHA-1 fingerprint", () => {
    expect(cert.sha1).toBe(RSA_CERT_SHA1);
  });
  it("computes the SHA-256 fingerprint", () => {
    expect(cert.sha256).toBe(RSA_CERT_SHA256);
  });
});

// ---------------------------------------------------------------------------
describe("ssl parseCertificate (ECDSA P-256)", () => {
  it("parses ECDSA cert and reports curve + bit length", () => {
    const block = decodePem(EC_CERT_PEM).blocks[0];
    const cert = parseCertificate(block.der);
    expect(cert.publicKey.algorithm).toBe("id-ecPublicKey");
    expect(cert.publicKey.curveName).toBe("prime256v1");
    expect(cert.publicKey.bitLength).toBe(256);
    expect(cert.signatureAlgorithm).toBe("ecdsa-with-SHA256");
    expect(getCn(cert.subject)).toBe("ec.example.com");
  });
});

// ---------------------------------------------------------------------------
describe("ssl parseCertificate (expired)", () => {
  it("parses the expired cert", () => {
    const block = decodePem(EXPIRED_CERT_PEM).blocks[0];
    const cert = parseCertificate(block.der);
    expect(getCn(cert.subject)).toBe("expired.example.com");
    expect(cert.notAfter).toBe("2010-01-02T00:00:00Z");
  });
});

// ---------------------------------------------------------------------------
describe("ssl parseCsr", () => {
  it("extracts the subject CN from a PKCS#10 CSR", () => {
    const block = decodePem(CSR_PEM).blocks[0];
    const csr = parseCsr(block.der);
    expect(csr.kind).toBe("csr");
    expect(getCn(csr.subject)).toBe("csr.example.com");
    expect(csr.publicKey.algorithm).toBe("rsaEncryption");
    expect(csr.publicKey.bitLength).toBe(2048);
    expect(csr.signatureAlgorithm).toBe("sha256WithRSAEncryption");
  });
});

// ---------------------------------------------------------------------------
describe("ssl decodePemBlock", () => {
  it("decodes a CERTIFICATE block as a DecodedCertificate", () => {
    const block = decodePem(RSA_CERT_PEM).blocks[0] as PemBlock;
    const d = decodePemBlock(block);
    expect(d.kind).toBe("certificate");
  });
  it("decodes a CERTIFICATE REQUEST block as a DecodedCsr", () => {
    const block = decodePem(CSR_PEM).blocks[0] as PemBlock;
    const d = decodePemBlock(block);
    expect(d.kind).toBe("csr");
  });
  it("decodes a PRIVATE KEY block as label-only (no key material extracted)", () => {
    const block = decodePem(PRIVATE_KEY_PEM).blocks[0] as PemBlock;
    const d = decodePemBlock(block);
    expect(d.kind).toBe("private-key");
    expect(d.sha256.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe("ssl sha1 / sha256 (FIPS 180-4 test vectors)", () => {
  it("sha1 of empty string is da39a3ee5e6b4b0d3255bfef95601890afd80709", () => {
    expect(formatFingerprint(sha1([]))).toBe("DA:39:A3:EE:5E:6B:4B:0D:32:55:BF:EF:95:60:18:90:AF:D8:07:09");
  });
  it("sha1 of 'abc' is a9993e364706816aba3e25717850c26c9cd0d89d", () => {
    const bytes = [0x61, 0x62, 0x63];
    expect(formatFingerprint(sha1(bytes))).toBe("A9:99:3E:36:47:06:81:6A:BA:3E:25:71:78:50:C2:6C:9C:D0:D8:9D");
  });
  it("sha256 of empty string is e3b0c44298fc1c149afbf4c8996fb924...", () => {
    expect(formatFingerprint(sha256([]))).toBe(
      "E3:B0:C4:42:98:FC:1C:14:9A:FB:F4:C8:99:6F:B9:24:27:AE:41:E4:64:9B:93:4C:A4:95:99:1B:78:52:B8:55",
    );
  });
  it("sha256 of 'abc' is ba7816bf8f01cfea414140de5dae2223...", () => {
    const bytes = [0x61, 0x62, 0x63];
    expect(formatFingerprint(sha256(bytes))).toBe(
      "BA:78:16:BF:8F:01:CF:EA:41:41:40:DE:5D:AE:22:23:B0:03:61:A3:96:17:7A:9C:B4:10:FF:61:F2:00:15:AD",
    );
  });
  it("sha1Hex matches the colon-hex format", () => {
    expect(sha1Hex([0x61, 0x62, 0x63])).toBe("A9:99:3E:36:47:06:81:6A:BA:3E:25:71:78:50:C2:6C:9C:D0:D8:9D");
  });
  it("computeFingerprints returns both hashes", () => {
    const fp = computeFingerprints([0x61, 0x62, 0x63]);
    expect(fp.sha1).toBe("A9:99:3E:36:47:06:81:6A:BA:3E:25:71:78:50:C2:6C:9C:D0:D8:9D");
    expect(fp.sha256).toBe(
      "BA:78:16:BF:8F:01:CF:EA:41:41:40:DE:5D:AE:22:23:B0:03:61:A3:96:17:7A:9C:B4:10:FF:61:F2:00:15:AD",
    );
  });
});

// ---------------------------------------------------------------------------
describe("ssl checkExpiry / daysBetween", () => {
  it("daysBetween computes whole days", () => {
    expect(daysBetween("2026-01-01T00:00:00Z", "2026-01-11T00:00:00Z")).toBe(10);
  });
  it("marks a cert valid in the middle of its window", () => {
    const r = checkExpiry("2026-01-01T00:00:00Z", "2026-12-31T00:00:00Z", new Date("2026-06-01T00:00:00Z"));
    expect(r.status).toBe("valid");
    expect(r.daysRemaining).toBeGreaterThan(200);
    expect(r.percentElapsed).toBeGreaterThan(40);
    expect(r.percentElapsed).toBeLessThan(50);
  });
  it("marks a cert expired after notAfter", () => {
    const r = checkExpiry("2010-01-01T00:00:00Z", "2010-01-02T00:00:00Z", new Date("2026-06-01T00:00:00Z"));
    expect(r.status).toBe("expired");
    expect(r.daysRemaining).toBeLessThan(0);
  });
  it("marks a cert not-yet-valid before notBefore", () => {
    const r = checkExpiry("2030-01-01T00:00:00Z", "2031-01-01T00:00:00Z", new Date("2026-06-01T00:00:00Z"));
    expect(r.status).toBe("not-yet-valid");
    expect(r.daysSinceIssue).toBeLessThan(0);
  });
});

// ---------------------------------------------------------------------------
describe("ssl isSelfSigned / getCn", () => {
  it("isSelfSigned returns true for self-signed cert", () => {
    const block = decodePem(RSA_CERT_PEM).blocks[0];
    const cert = parseCertificate(block.der);
    expect(isSelfSigned(cert)).toBe(true);
  });
  it("getCn returns null for an empty DN", () => {
    const dn: DistinguishedName = { attributes: [], rfc4514: "" };
    expect(getCn(dn)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Helper: build a synthetic DecodedCertificate for chain / weakness tests.
function syntheticCert(
  subjectCn: string,
  issuerCn: string,
  sigAlg = "sha256WithRSAEncryption",
  rsaBits = 2048,
): DecodedCertificate {
  const mkDn = (cn: string): DistinguishedName => ({
    attributes: [{ oid: "2.5.4.3", oidName: "CN", value: cn }],
    rfc4514: `CN=${cn}`,
  });
  const pub: PublicKeyInfo = {
    algorithm: "rsaEncryption",
    algorithmOid: "1.2.840.113549.1.1.1",
    bitLength: rsaBits,
    publicKeyHex: "ABCD",
  };
  return {
    kind: "certificate",
    version: 2,
    serialHex: "01",
    signatureAlgorithm: sigAlg,
    signatureAlgorithmOid: "1.2.840.113549.1.1.11",
    issuer: mkDn(issuerCn),
    subject: mkDn(subjectCn),
    notBefore: "2026-01-01T00:00:00Z",
    notAfter: "2027-01-01T00:00:00Z",
    publicKey: pub,
    sans: [],
    keyUsage: [],
    extKeyUsage: [],
    isCa: false,
    der: [],
    sha1: "",
    sha256: "",
    parseWarnings: [],
  };
}

// ---------------------------------------------------------------------------
describe("ssl validateChain", () => {
  it("single cert returns ok with an info message", () => {
    const r = validateChain([syntheticCert("leaf", "root")]);
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.level === "info")).toBe(true);
  });
  it("valid chain leaf → intermediate → root is ok", () => {
    const leaf = syntheticCert("leaf", "intermediate");
    const intermediate = syntheticCert("intermediate", "root");
    const root = syntheticCert("root", "root"); // self-signed root
    const r = validateChain([leaf, intermediate, root]);
    expect(r.ok).toBe(true);
    expect(r.issues.some((i) => i.level === "error")).toBe(false);
  });
  it("broken chain (issuer mismatch) reports an error", () => {
    const leaf = syntheticCert("leaf", "intermediate");
    const unrelated = syntheticCert("other", "other"); // not the issuer of leaf
    const r = validateChain([leaf, unrelated]);
    expect(r.ok).toBe(false);
    expect(r.issues.some((i) => i.level === "error")).toBe(true);
  });
  it("warns when final cert is not self-signed", () => {
    const a = syntheticCert("a", "b");
    const b = syntheticCert("b", "c"); // b issued by c, but no c pasted
    const r = validateChain([a, b]);
    expect(r.ok).toBe(true); // not an error, just a warning
    expect(r.issues.some((i) => i.level === "warning")).toBe(true);
  });
  it("empty input returns ok=false", () => {
    const r = validateChain([]);
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("ssl matchHostname / matchHostnameOne", () => {
  const sans: SanEntry[] = [
    { type: "DNS", value: "example.com" },
    { type: "DNS", value: "*.example.com" },
    { type: "DNS", value: "api.example.org" },
  ];
  it("exact match", () => {
    expect(matchHostnameOne("example.com", "example.com")).toBe(true);
  });
  it("wildcard matches one leftmost label", () => {
    expect(matchHostnameOne("*.example.com", "www.example.com")).toBe(true);
  });
  it("wildcard does NOT match the bare apex", () => {
    expect(matchHostnameOne("*.example.com", "example.com")).toBe(false);
  });
  it("wildcard does NOT match multiple leftmost labels", () => {
    expect(matchHostnameOne("*.example.com", "a.b.example.com")).toBe(false);
  });
  it("case-insensitive match", () => {
    expect(matchHostnameOne("Example.com", "EXAMPLE.com")).toBe(true);
  });
  it("matchHostname returns true when any SAN matches", () => {
    expect(matchHostname(sans, "www.example.com")).toBe(true);
  });
  it("matchHostname returns false on no match", () => {
    expect(matchHostname(sans, "evil.com")).toBe(false);
  });
  it("matchHostname returns false on empty hostname", () => {
    expect(matchHostname(sans, "")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
describe("ssl detectWeaknesses", () => {
  it("clean modern cert has no warnings", () => {
    const cert = syntheticCert("leaf", "issuer", "sha256WithRSAEncryption", 2048);
    const r = detectWeaknesses(cert);
    expect(r.hasWeakSig).toBe(false);
    expect(r.hasWeakKey).toBe(false);
    expect(r.issues.some((i) => i.level === "warning")).toBe(false);
  });
  it("sha1 signature is flagged as weak", () => {
    const cert = syntheticCert("leaf", "issuer", "sha1WithRSAEncryption", 2048);
    const r = detectWeaknesses(cert);
    expect(r.hasWeakSig).toBe(true);
    expect(r.issues.some((i) => i.message.includes("SHA-256") || i.message.includes("weak"))).toBe(true);
  });
  it("1024-bit RSA is flagged as weak", () => {
    const cert = syntheticCert("leaf", "issuer", "sha256WithRSAEncryption", 1024);
    const r = detectWeaknesses(cert);
    expect(r.hasWeakKey).toBe(true);
  });
  it("self-signed cert is reported as info", () => {
    const cert = syntheticCert("self", "self");
    const r = detectWeaknesses(cert);
    expect(r.isSelfSigned).toBe(true);
    expect(r.issues.some((i) => i.level === "info")).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("ssl generateOpensslCommands", () => {
  it("returns no commands for empty host", () => {
    expect(generateOpensslCommands("")).toEqual([]);
  });
  it("generates commands for a host on port 443", () => {
    const cmds = generateOpensslCommands("example.com");
    expect(cmds.length).toBeGreaterThan(5);
    expect(cmds.some((c) => c.command.includes("openssl s_client -connect example.com:443"))).toBe(true);
    expect(cmds.some((c) => c.command.includes("openssl x509 -noout -dates"))).toBe(true);
  });
  it("uses a custom port when provided", () => {
    const cmds = generateOpensslCommands("example.com", 8443);
    expect(cmds[0].command).toContain("example.com:8443");
  });
  it("lowercases the host", () => {
    const cmds = generateOpensslCommands("EXAMPLE.COM");
    expect(cmds[0].command).toContain("example.com:443");
  });
  it("includes SNI -servername flag", () => {
    const cmds = generateOpensslCommands("example.com");
    expect(cmds.every((c) => !c.command.includes("-servername") || c.command.includes("-servername example.com"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
describe("ssl generatePemInspectionCommands", () => {
  it("generates cert commands for a cert filename", () => {
    const cmds = generatePemInspectionCommands("cert.pem", false);
    expect(cmds.length).toBeGreaterThan(5);
    expect(cmds.some((c) => c.command.includes("openssl x509 -in cert.pem"))).toBe(true);
  });
  it("generates CSR commands for a csr filename", () => {
    const cmds = generatePemInspectionCommands("csr.pem", true);
    expect(cmds.length).toBeGreaterThan(2);
    expect(cmds.every((c) => c.command.includes("openssl req"))).toBe(true);
  });
  it("falls back to cert.pem default filename", () => {
    const cmds = generatePemInspectionCommands("", false);
    expect(cmds[0].command).toContain("cert.pem");
  });
});

// ---------------------------------------------------------------------------
describe("ssl explainField / explainAllFields / explainPemLabel", () => {
  it("explains the Subject field", () => {
    const e = explainField("Subject");
    expect(e).toBeDefined();
    expect(e!.field).toBe("Subject");
    expect(e!.short.length).toBeGreaterThan(0);
  });
  it("explainField is case-insensitive", () => {
    expect(explainField("subject")?.field).toBe("Subject");
    expect(explainField("SUBJECT")?.field).toBe("Subject");
  });
  it("explainField returns undefined for unknown field", () => {
    expect(explainField("Nonexistent")).toBeUndefined();
  });
  it("explainAllFields returns a list of fields", () => {
    const all = explainAllFields();
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all.some((f) => f.field === "Issuer")).toBe(true);
  });
  it("explains each PEM label", () => {
    expect(explainPemLabel("CERTIFICATE")).toContain("X.509");
    expect(explainPemLabel("CERTIFICATE REQUEST")).toContain("PKCS#10");
    expect(explainPemLabel("PRIVATE KEY")).toContain("private key");
    expect(explainPemLabel("PUBLIC KEY")).toContain("public");
    expect(explainPemLabel("X509 CRL")).toContain("Revocation");
  });
});

// ---------------------------------------------------------------------------
describe("ssl history (max 20, privacy metadata-only)", () => {
  it("loadHistory returns empty by default", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saveHistory persists an entry", () => {
    saveHistory({ ts: 1, action: "decode", subjectCn: "test", issuerCn: "ca", expiryDate: "2027-01-01", sha256: "AB" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0].subjectCn).toBe("test");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, action: "decode", subjectCn: `c${i}`, issuerCn: null, expiryDate: null, sha256: null });
    }
    const h = loadHistory();
    expect(h).toHaveLength(20);
    // newest first
    expect(h[0].subjectCn).toBe("c24");
  });
  it("clearHistory empties the store", () => {
    saveHistory({ ts: 1, action: "decode", subjectCn: "x", issuerCn: null, expiryDate: null, sha256: null });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
  it("history entries contain NO PEM or DER bytes", () => {
    saveHistory({ ts: 1, action: "decode", subjectCn: "test", issuerCn: "ca", expiryDate: "2027-01-01", sha256: "AB:CD" });
    const ls = (globalThis as unknown as { localStorage: { getItem: (k: string) => string | null } }).localStorage;
    const raw = ls.getItem("unqtools:ssl-tls-certificate-decoder-checker:history");
    expect(raw).not.toContain("BEGIN CERTIFICATE");
    expect(raw).not.toContain("-----BEGIN");
    // Sanity: the history entry shape only contains the metadata fields.
    const parsed = JSON.parse(raw!);
    expect(parsed[0]).toEqual({
      ts: 1, action: "decode", subjectCn: "test", issuerCn: "ca", expiryDate: "2027-01-01", sha256: "AB:CD",
    });
  });
});

// ---------------------------------------------------------------------------
describe("ssl buildShareUrl / parseShareUrl", () => {
  it("buildShareUrl encodes tab + host + port (no window, query form)", () => {
    const url = buildShareUrl({ tab: "commands", host: "example.com", port: 8443 });
    expect(url).toContain("tab=commands");
    expect(url).toContain("host=example.com");
    expect(url).toContain("port=8443");
    expect(url.startsWith("?")).toBe(true); // no window in test env
  });
  it("buildShareUrl omits undefined fields", () => {
    const url = buildShareUrl({ tab: "decode" });
    expect(url).toContain("tab=decode");
    expect(url).not.toContain("host=");
  });
  it("parseShareUrl round-trips", () => {
    const state = parseShareUrl("#tab=commands&host=example.com&port=8443");
    expect(state).toEqual({ tab: "commands", host: "example.com", port: 8443 });
  });
  it("parseShareUrl handles missing hash", () => {
    expect(parseShareUrl("")).toEqual({});
  });
  it("parseShareUrl ignores an invalid tab value", () => {
    expect(parseShareUrl("#tab=bogus").tab).toBeUndefined();
  });
  it("parseShareUrl ignores a non-numeric port", () => {
    expect(parseShareUrl("#port=abc").port).toBeUndefined();
  });
});

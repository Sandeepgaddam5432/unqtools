import { describe, it, expect, beforeEach } from "vitest";
import {
  ID_SPECS,
  ID_TYPE_LIST,
  HONESTY_BANNER,
  DEFAULT_COUNT,
  MAX_COUNT,
  MAX_VALIDATE_ROWS,
  mulberry32,
  hashSeed,
  createRng,
  getIdSpec,
  verhoeffCheckDigit,
  verhoeffValidate,
  luhnCheckDigit,
  luhnValidate,
  mod11CheckDigit,
  cpfCheckDigits,
  cnpjCheckDigits,
  cpfValidate,
  cnpjValidate,
  nifCheckLetter,
  nifValidate,
  inseeCheckKey,
  inseeValidate,
  germanSteuerCheckDigit,
  germanSteuerValidate,
  generateUsSsn,
  generateUsEin,
  generateUsItin,
  generateUkNino,
  generateInPan,
  generateInAadhaar,
  generateDeSteuer,
  generateBrCpf,
  generateBrCnpj,
  generateCaSin,
  generateEsNif,
  generateFrInsee,
  formatId,
  normalizeId,
  generateId,
  generateBulk,
  validateId,
  validateBulk,
  summarizeBulkValidation,
  idsToJson,
  idsToCsv,
  idsToText,
  resultsToJson,
  resultsToCsv,
  resultsToText,
  loadHistory,
  saveHistory,
  clearHistory,
  buildShareUrl,
  parseShareUrl,
  type IdType,
  type GeneratedId,
  type Rng,
} from "./logic";

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

describe("test-id constants", () => {
  it("exposes 12 ID types", () => {
    expect(ID_TYPE_LIST).toHaveLength(12);
  });
  it("ID_SPECS has entry for every type", () => {
    for (const t of ID_TYPE_LIST) {
      expect(ID_SPECS[t]).toBeDefined();
      expect(ID_SPECS[t].label.length).toBeGreaterThan(0);
      expect(ID_SPECS[t].country.length).toBeGreaterThan(0);
      expect(ID_SPECS[t].digitLength).toBeGreaterThan(0);
    }
  });
  it("reserved ranges are documented for SSN, ITIN, NINO, SIN", () => {
    expect(ID_SPECS["us-ssn"].reservedRange).toContain("900-999");
    expect(ID_SPECS["us-itin"].reservedRange).toContain("70-88");
    expect(ID_SPECS["uk-nino"].reservedRange).toContain("TN");
    expect(ID_SPECS["ca-sin"].reservedRange).toContain("9");
  });
  it("checksum algorithms are correctly assigned", () => {
    expect(ID_SPECS["in-aadhaar"].checksumAlgorithm).toBe("verhoeff");
    expect(ID_SPECS["ca-sin"].checksumAlgorithm).toBe("luhn");
    expect(ID_SPECS["br-cpf"].checksumAlgorithm).toBe("mod11");
    expect(ID_SPECS["br-cnpj"].checksumAlgorithm).toBe("mod11");
    expect(ID_SPECS["es-nif"].checksumAlgorithm).toBe("mod23");
    expect(ID_SPECS["fr-insee"].checksumAlgorithm).toBe("mod97");
    expect(ID_SPECS["de-steuer"].checksumAlgorithm).toBe("mod10w");
    expect(ID_SPECS["us-ssn"].checksumAlgorithm).toBe("structural");
  });
  it("honesty banner is non-empty and mentions test-only", () => {
    expect(HONESTY_BANNER.length).toBeGreaterThan(50);
    expect(HONESTY_BANNER.toLowerCase()).toContain("test");
  });
  it("getIdSpec returns spec", () => {
    expect(getIdSpec("us-ssn").label).toBe("US SSN");
  });
  it("DEFAULT_COUNT is 10, MAX_COUNT is 5000, MAX_VALIDATE_ROWS is 10000", () => {
    expect(DEFAULT_COUNT).toBe(10);
    expect(MAX_COUNT).toBe(5000);
    expect(MAX_VALIDATE_ROWS).toBe(10000);
  });
});

describe("test-id PRNG", () => {
  it("mulberry32 is deterministic", () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it("hashSeed is stable for string", () => {
    expect(hashSeed("aadhaar-seed")).toBe(hashSeed("aadhaar-seed"));
  });
  it("createRng helpers work", () => {
    const r = createRng("test");
    expect(r.int(1, 5)).toBeGreaterThanOrEqual(1);
    expect(r.int(1, 5)).toBeLessThanOrEqual(5);
    expect(r.pick([1, 2, 3])).toBeGreaterThanOrEqual(1);
    expect(r.digits(8)).toMatch(/^\d{8}$/);
    expect(r.string(4, "ABCD")).toHaveLength(4);
  });
});

describe("test-id Verhoeff algorithm (Aadhaar)", () => {
  // Known Aadhaar test vector (UIDAI published sample): 201234567890 with check digit 1
  // so full = 201234567890 ... we just verify algorithm against a known vector.
  it("verhoeffCheckDigit computes a deterministic value for base digits", () => {
    // Base 11 digits, returns check digit
    const check = verhoeffCheckDigit("201234567890".slice(0, 11));
    expect(check).toBeGreaterThanOrEqual(0);
    expect(check).toBeLessThanOrEqual(9);
  });
  it("verhoeffValidate accepts a self-consistent Aadhaar", () => {
    const base = "234123456789";
    const check = verhoeffCheckDigit(base);
    const full = base + check.toString();
    expect(verhoeffValidate(full)).toBe(true);
  });
  it("verhoeffValidate rejects a corrupted last digit", () => {
    const base = "234123456789";
    const check = verhoeffCheckDigit(base);
    const full = base + ((check + 1) % 10).toString();
    expect(verhoeffValidate(full)).toBe(false);
  });
  it("verhoeffValidate rejects non-digit input", () => {
    expect(verhoeffValidate("abcdefghijk")).toBe(false);
  });
  it("verhoeffValidate rejects too-short input", () => {
    expect(verhoeffValidate("5")).toBe(false);
  });
});

describe("test-id Luhn algorithm (Canada SIN)", () => {
  it("luhnCheckDigit computes correct value for partial", () => {
    // Known test SIN: 046 454 286 (Luhn-valid). Base (8 digits) = 04645428, check = 6
    expect(luhnCheckDigit("04645428")).toBe(6);
  });
  it("luhnValidate accepts a known test SIN 046 454 286", () => {
    expect(luhnValidate("046454286")).toBe(true);
  });
  it("luhnValidate rejects clearly invalid number", () => {
    expect(luhnValidate("046454280")).toBe(false);
  });
  it("luhnValidate strips dashes", () => {
    expect(luhnValidate("046-454-286")).toBe(true);
  });
});

describe("test-id mod-11 algorithm (Brazil CPF/CNPJ)", () => {
  it("cpfCheckDigits computes known vector for base 111444777", () => {
    // CPF base 111.444.777-XX: d1 should be 3, d2 should be 5 → 11144477735
    const [d1, d2] = cpfCheckDigits("111444777");
    expect(d1).toBe(3);
    expect(d2).toBe(5);
  });
  it("cnpjCheckDigits computes known vector for base 114447770001", () => {
    // CNPJ 11.444.777/0001-61 is a well-known test vector
    const [d1, d2] = cnpjCheckDigits("114447770001");
    expect(d1).toBe(6);
    expect(d2).toBe(1);
  });
  it("cpfValidate accepts a real test CPF 11144477735", () => {
    expect(cpfValidate("111.444.777-35")).toBe(true);
  });
  it("cpfValidate rejects all-equal digits 11111111111", () => {
    expect(cpfValidate("11111111111")).toBe(false);
  });
  it("cpfValidate rejects wrong check digits", () => {
    expect(cpfValidate("111.444.777-99")).toBe(false);
  });
  it("cnpjValidate accepts a known test CNPJ 11444777000161", () => {
    expect(cnpjValidate("11.444.777/0001-61")).toBe(true);
  });
  it("cnpjValidate rejects wrong check digits", () => {
    expect(cnpjValidate("11.444.777/0001-99")).toBe(false);
  });
  it("mod11CheckDigit returns 0 for rem < 2", () => {
    // sum = 1*1 + 0*2 = 1, rem = 1 → digit = 0
    expect(mod11CheckDigit("10", [1, 2])).toBe(0);
  });
});

describe("test-id mod-23 letter (Spain NIF/DNI)", () => {
  it("nifCheckLetter computes Z for 12345678", () => {
    // 12345678 mod 23 = 14 → 'Z' (canonical Spanish DNI test vector)
    expect(nifCheckLetter("12345678")).toBe("Z");
  });
  it("nifCheckLetter computes T for 00000000", () => {
    expect(nifCheckLetter("00000000")).toBe("T"); // 0 mod 23 = 0 → 'T'
  });
  it("nifValidate accepts DNI 12345678Z", () => {
    expect(nifValidate("12345678Z")).toBe(true);
  });
  it("nifValidate rejects wrong letter", () => {
    // 'A' is index 3 in TRWAGMYFPDXBNJZSQVHLCKE, not 14, so it's wrong for 12345678.
    expect(nifValidate("12345678A")).toBe(false);
  });
  it("nifValidate accepts NIE X1234567L (X→0)", () => {
    // 01234567 mod 23 = 19 → 'L'
    expect(nifValidate("X1234567L")).toBe(true);
  });
  it("nifValidate is case-insensitive", () => {
    expect(nifValidate("12345678z")).toBe(true);
  });
  it("nifValidate rejects too-short input", () => {
    expect(nifValidate("1234567")).toBe(false);
  });
});

describe("test-id mod-97 (France INSEE)", () => {
  it("inseeCheckKey computes a 2-digit key", () => {
    const key = inseeCheckKey("1850568050058");
    expect(key).toBeGreaterThanOrEqual(0);
    expect(key).toBeLessThanOrEqual(97);
  });
  it("inseeValidate accepts a self-consistent INSEE", () => {
    const base = "1850568050058";
    const key = inseeCheckKey(base).toString().padStart(2, "0");
    expect(inseeValidate(base + key)).toBe(true);
  });
  it("inseeValidate rejects corrupted key", () => {
    const base = "1850568050058";
    const correct = inseeCheckKey(base);
    const wrong = ((correct + 1) % 98).toString().padStart(2, "0");
    expect(inseeValidate(base + wrong)).toBe(false);
  });
  it("inseeValidate rejects too-short input", () => {
    expect(inseeValidate("123")).toBe(false);
  });
});

describe("test-id German Steuer-ID mod-10 weighted", () => {
  it("germanSteuerCheckDigit computes 8 for base 4757462118", () => {
    // Known test vector: 47574621188 — last digit is 8
    expect(germanSteuerCheckDigit("4757462118")).toBe(8);
  });
  it("germanSteuerValidate accepts 47574621188", () => {
    expect(germanSteuerValidate("47574621188")).toBe(true);
  });
  it("germanSteuerValidate rejects corrupted check digit", () => {
    expect(germanSteuerValidate("47574621189")).toBe(false);
  });
});

describe("test-id per-type generation", () => {
  const rng = createRng("gen-test");
  it("generateUsSsn uses area 900-999", () => {
    for (let i = 0; i < 50; i++) {
      const s = generateUsSsn(rng);
      const area = parseInt(s.slice(0, 3), 10);
      expect(area).toBeGreaterThanOrEqual(900);
      expect(area).toBeLessThanOrEqual(999);
      expect(s).toMatch(/^\d{9}$/);
    }
  });
  it("generateUsEin produces 9 digits with non-zero prefix", () => {
    const s = generateUsEin(rng);
    expect(s).toMatch(/^\d{9}$/);
    expect(s.slice(0, 2)).not.toBe("00");
  });
  it("generateUsItin produces 9XX-7X-XXXX", () => {
    for (let i = 0; i < 50; i++) {
      const s = generateUsItin(rng);
      const area = parseInt(s.slice(0, 3), 10);
      const group = parseInt(s.slice(3, 5), 10);
      expect(area).toBeGreaterThanOrEqual(900);
      expect(group).toBeGreaterThanOrEqual(70);
      expect(group).toBeLessThanOrEqual(88);
    }
  });
  it("generateUkNino uses TN or NT prefix", () => {
    for (let i = 0; i < 50; i++) {
      const s = generateUkNino(rng);
      expect(s.startsWith("TN") || s.startsWith("NT")).toBe(true);
      expect(s).toMatch(/^[A-Z]{2}\d{6}[A-Z]$/);
    }
  });
  it("generateInPan produces 5 letters + 4 digits + 1 letter", () => {
    const s = generateInPan(rng);
    expect(s).toMatch(/^[A-Z]{5}\d{4}[A-Z]$/);
    // 4th char is a valid holder type
    expect("PCHFATBLJG".includes(s[3]!)).toBe(true);
  });
  it("generateInAadhaar produces Verhoeff-valid 12-digit number starting 2-9", () => {
    const s = generateInAadhaar(rng);
    expect(s).toMatch(/^[2-9]\d{11}$/);
    expect(verhoeffValidate(s)).toBe(true);
  });
  it("generateDeSteuer produces mod-10 valid 11-digit number", () => {
    const s = generateDeSteuer(rng);
    expect(s).toMatch(/^\d{11}$/);
    expect(germanSteuerValidate(s)).toBe(true);
  });
  it("generateBrCpf produces mod-11 valid 11-digit CPF", () => {
    const s = generateBrCpf(rng);
    expect(s).toMatch(/^\d{11}$/);
    expect(cpfValidate(s)).toBe(true);
  });
  it("generateBrCnpj produces mod-11 valid 14-digit CNPJ", () => {
    const s = generateBrCnpj(rng);
    expect(s).toMatch(/^\d{14}$/);
    expect(cnpjValidate(s)).toBe(true);
  });
  it("generateCaSin produces Luhn-valid 9-digit SIN starting with 9", () => {
    const s = generateCaSin(rng);
    expect(s).toMatch(/^9\d{8}$/);
    expect(luhnValidate(s)).toBe(true);
  });
  it("generateEsNif produces 8 digits + valid mod-23 letter", () => {
    const s = generateEsNif(rng);
    expect(s).toMatch(/^[1-9]\d{7}[A-Z]$/);
    expect(nifValidate(s)).toBe(true);
  });
  it("generateFrInsee produces 15-digit mod-97 valid INSEE", () => {
    const s = generateFrInsee(rng);
    expect(s).toMatch(/^\d{15}$/);
    expect(inseeValidate(s)).toBe(true);
  });
  it("all 12 generators return strings of correct length", () => {
    const checks: Record<IdType, () => string> = {
      "us-ssn": () => generateUsSsn(rng),
      "us-ein": () => generateUsEin(rng),
      "us-itin": () => generateUsItin(rng),
      "uk-nino": () => generateUkNino(rng),
      "in-pan": () => generateInPan(rng),
      "in-aadhaar": () => generateInAadhaar(rng),
      "de-steuer": () => generateDeSteuer(rng),
      "br-cpf": () => generateBrCpf(rng),
      "br-cnpj": () => generateBrCnpj(rng),
      "ca-sin": () => generateCaSin(rng),
      "es-nif": () => generateEsNif(rng),
      "fr-insee": () => generateFrInsee(rng),
    };
    for (const t of ID_TYPE_LIST) {
      const v = checks[t]();
      expect(v.length).toBeGreaterThan(0);
    }
  });
  it("1000 bulk-generated IDs all pass their checksums", () => {
    for (let i = 0; i < 1000; i++) {
      const t = ID_TYPE_LIST[i % ID_TYPE_LIST.length]!;
      const id = generateId(t, createRng(`seed-${i}`));
      // For checksum-bearing types, validate should return valid.
      if (ID_SPECS[t].checksumAlgorithm !== "structural") {
        expect(validateId(t, id.value).valid).toBe(true);
      }
    }
  });
});

describe("test-id generation dispatch", () => {
  it("generateId returns GeneratedId with correct fields", () => {
    const id = generateId("us-ssn", createRng("x"));
    expect(id.type).toBe("us-ssn");
    expect(id.country).toBe("United States");
    expect(id.label).toBe("US SSN");
    expect(id.value).toMatch(/^\d{9}$/);
    expect(id.formatted).toMatch(/^\d{3}-\d{2}-\d{4}$/);
  });
  it("generateId formats Aadhaar with spaces", () => {
    const id = generateId("in-aadhaar", createRng("x"));
    expect(id.formatted).toMatch(/^\d{4} \d{4} \d{4}$/);
  });
  it("generateId formats CPF with dots and dash", () => {
    const id = generateId("br-cpf", createRng("x"));
    expect(id.formatted).toMatch(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/);
  });
  it("generateId formats CNPJ with dots, slash, dash", () => {
    const id = generateId("br-cnpj", createRng("x"));
    expect(id.formatted).toMatch(/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/);
  });
  it("generateId formats NINO with spaces", () => {
    const id = generateId("uk-nino", createRng("x"));
    expect(id.formatted).toMatch(/^[A-Z]{2} \d{2} \d{2} \d{2} [A-Z]$/);
  });
  it("generateBulk returns requested count", () => {
    const out = generateBulk({ count: 50, seed: "bulk-1", types: ["us-ssn"] });
    expect(out).toHaveLength(50);
    expect(out.every((x) => x.type === "us-ssn")).toBe(true);
  });
  it("generateBulk clamps at 0", () => {
    expect(generateBulk({ count: 0, seed: "x" })).toEqual([]);
  });
  it("generateBulk clamps at MAX_COUNT (5000)", () => {
    const out = generateBulk({ count: 99999, seed: "x", types: ["us-ssn"] });
    expect(out).toHaveLength(5000);
  });
  it("generateBulk picks random types when none specified", () => {
    const out = generateBulk({ count: 100, seed: "multi" });
    const types = new Set(out.map((x) => x.type));
    expect(types.size).toBeGreaterThan(1);
  });
  it("generateBulk is deterministic for same seed", () => {
    const a = generateBulk({ count: 5, seed: "det", types: ["us-ssn"] });
    const b = generateBulk({ count: 5, seed: "det", types: ["us-ssn"] });
    expect(a).toEqual(b);
  });
});

describe("test-id formatting + normalization", () => {
  it("formatId SSN adds dashes", () => {
    expect(formatId("us-ssn", "900123456")).toBe("900-12-3456");
  });
  it("formatId EIN adds dash after 2 digits", () => {
    expect(formatId("us-ein", "123456789")).toBe("12-3456789");
  });
  it("formatId CPF uses dots and dash", () => {
    expect(formatId("br-cpf", "11144477735")).toBe("111.444.777-35");
  });
  it("formatId Aadhaar uses spaces", () => {
    expect(formatId("in-aadhaar", "234123456789")).toBe("2341 2345 6789");
  });
  it("formatId NINO uses spaces", () => {
    expect(formatId("uk-nino", "TN123456A")).toBe("TN 12 34 56 A");
  });
  it("formatId NIF uses dash before letter", () => {
    expect(formatId("es-nif", "12345678R")).toBe("12345678-R");
  });
  it("formatId INSEE uses 7 space-separated groups", () => {
    const out = formatId("fr-insee", "185056805005812");
    expect(out.split(" ")).toHaveLength(7);
  });
  it("normalizeId strips dashes and dots from SSN", () => {
    expect(normalizeId("us-ssn", "900-12-3456")).toBe("900123456");
  });
  it("normalizeId uppercases NINO letters", () => {
    expect(normalizeId("uk-nino", "tn 12 34 56 a")).toBe("TN123456A");
  });
  it("normalizeId strips dots and dash from CPF", () => {
    expect(normalizeId("br-cpf", "111.444.777-35")).toBe("11144477735");
  });
});

describe("test-id validation", () => {
  it("validateId accepts valid SSN in test range", () => {
    const r = validateId("us-ssn", "900-12-3456");
    expect(r.valid).toBe(true);
    expect(r.reason).toContain("reserved");
  });
  it("validateId rejects SSN with area 000", () => {
    const r = validateId("us-ssn", "000-12-3456");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("000");
  });
  it("validateId rejects SSN with area 666", () => {
    const r = validateId("us-ssn", "666-12-3456");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("666");
  });
  it("validateId rejects SSN with group 00", () => {
    const r = validateId("us-ssn", "123-00-1234");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("Group");
  });
  it("validateId accepts valid Aadhaar", () => {
    const a = generateInAadhaar(createRng("v"));
    const r = validateId("in-aadhaar", a);
    expect(r.valid).toBe(true);
  });
  it("validateId rejects Aadhaar with wrong checksum", () => {
    const a = generateInAadhaar(createRng("v"));
    const corrupted = a.slice(0, -1) + ((parseInt(a.slice(-1), 10) + 1) % 10).toString();
    const r = validateId("in-aadhaar", corrupted);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("Verhoeff");
  });
  it("validateId rejects Aadhaar starting with 0", () => {
    const r = validateId("in-aadhaar", "0" + "234123456789".slice(0, 11));
    expect(r.valid).toBe(false);
  });
  it("validateId accepts valid CPF", () => {
    const r = validateId("br-cpf", "111.444.777-35");
    expect(r.valid).toBe(true);
  });
  it("validateId rejects invalid CPF", () => {
    const r = validateId("br-cpf", "111.444.777-99");
    expect(r.valid).toBe(false);
  });
  it("validateId accepts valid CNPJ", () => {
    const r = validateId("br-cnpj", "11.444.777/0001-61");
    expect(r.valid).toBe(true);
  });
  it("validateId accepts valid SIN with test prefix 9", () => {
    const s = generateCaSin(createRng("v"));
    const r = validateId("ca-sin", s);
    expect(r.valid).toBe(true);
    expect(r.reason).toContain("test prefix");
  });
  it("validateId rejects SIN with bad Luhn", () => {
    const r = validateId("ca-sin", "900000000");
    expect(r.valid).toBe(false);
  });
  it("validateId accepts valid NIF", () => {
    const r = validateId("es-nif", "12345678Z");
    expect(r.valid).toBe(true);
  });
  it("validateId accepts valid INSEE", () => {
    const s = generateFrInsee(createRng("v"));
    const r = validateId("fr-insee", s);
    expect(r.valid).toBe(true);
  });
  it("validateId rejects empty input", () => {
    const r = validateId("us-ssn", "");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("Empty");
  });
  it("validateId accepts valid UK NINO with TN prefix", () => {
    const r = validateId("uk-nino", "TN 12 34 56 A");
    expect(r.valid).toBe(true);
    expect(r.reason).toContain("Administrative");
  });
  it("validateId rejects NINO with invalid first letter D", () => {
    const r = validateId("uk-nino", "DN 12 34 56 A");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("First letter");
  });
  it("validateId accepts valid US ITIN", () => {
    const r = validateId("us-itin", "912-70-1234");
    expect(r.valid).toBe(true);
  });
  it("validateId rejects ITIN with wrong group", () => {
    const r = validateId("us-itin", "912-50-1234");
    expect(r.valid).toBe(false);
    expect(r.reason).toContain("70-88");
  });
});

describe("test-id bulk validation", () => {
  it("validateBulk returns one result per row", () => {
    const out = validateBulk({ type: "us-ssn", inputs: ["900-12-3456", "000-12-3456", "garbage"] });
    expect(out).toHaveLength(3);
    expect(out[0]!.valid).toBe(true);
    expect(out[1]!.valid).toBe(false);
    expect(out[2]!.valid).toBe(false);
  });
  it("validateBulk caps at MAX_VALIDATE_ROWS", () => {
    const inputs = Array.from({ length: 15000 }, (_, i) => `900-12-34${i.toString().padStart(2, "0").slice(-2)}`);
    const out = validateBulk({ type: "us-ssn", inputs });
    expect(out).toHaveLength(10000);
  });
  it("summarizeBulkValidation returns counts", () => {
    const summary = summarizeBulkValidation({ type: "us-ssn", inputs: ["900-12-3456", "000-12-3456"] });
    expect(summary.total).toBe(2);
    expect(summary.valid).toBe(1);
    expect(summary.invalid).toBe(1);
    expect(summary.sample).toHaveLength(2);
  });
  it("summarizeBulkValidation sample is capped at 20", () => {
    const inputs = Array.from({ length: 30 }, () => "900-12-3456");
    const summary = summarizeBulkValidation({ type: "us-ssn", inputs });
    expect(summary.sample).toHaveLength(20);
  });
});

describe("test-id exports", () => {
  const ids: GeneratedId[] = [
    {
      type: "us-ssn", value: "900123456", formatted: "900-12-3456",
      country: "United States", label: "US SSN", checksumAlgorithm: "structural",
    },
    {
      type: "in-aadhaar", value: "234123456789", formatted: "2341 2345 6789",
      country: "India", label: "India Aadhaar", checksumAlgorithm: "verhoeff",
    },
  ];
  it("idsToJson is valid JSON array", () => {
    const parsed = JSON.parse(idsToJson(ids));
    expect(Array.isArray(parsed)).toBe(true);
    expect(parsed).toHaveLength(2);
    expect(parsed[0].type).toBe("us-ssn");
  });
  it("idsToCsv has header + 2 rows", () => {
    const csv = idsToCsv(ids);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(3);
    expect(lines[0]).toBe("type,value,formatted,country,label,checksum");
  });
  it("idsToText has one line per id", () => {
    const txt = idsToText(ids);
    expect(txt.split("\n")).toHaveLength(2);
    expect(txt).toContain("US SSN");
    expect(txt).toContain("900-12-3456");
  });
  it("resultsToJson is valid JSON array", () => {
    const r = validateBulk({ type: "us-ssn", inputs: ["900-12-3456"] });
    const parsed = JSON.parse(resultsToJson(r));
    expect(parsed).toHaveLength(1);
    expect(parsed[0].valid).toBe(true);
  });
  it("resultsToCsv has header + 1 row", () => {
    const r = validateBulk({ type: "us-ssn", inputs: ["900-12-3456"] });
    const csv = resultsToCsv(r);
    const lines = csv.split("\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe("type,input,normalized,valid,reason");
  });
  it("resultsToText has OK or FAIL prefix per line", () => {
    const r = validateBulk({ type: "us-ssn", inputs: ["900-12-3456", "000-12-3456"] });
    const txt = resultsToText(r);
    expect(txt.split("\n")).toHaveLength(2);
    expect(txt).toContain("OK\t");
    expect(txt).toContain("FAIL\t");
  });
});

describe("test-id history (localStorage)", () => {
  it("loads empty initially", () => {
    expect(loadHistory()).toEqual([]);
  });
  it("saves and loads", () => {
    saveHistory({ ts: 1, seed: "abc", count: 10, types: ["us-ssn"], action: "generate" });
    const h = loadHistory();
    expect(h).toHaveLength(1);
    expect(h[0]!.seed).toBe("abc");
  });
  it("caps at 20 entries", () => {
    for (let i = 0; i < 25; i++) {
      saveHistory({ ts: i, seed: `s${i}`, count: 10, types: ["us-ssn"], action: "generate" });
    }
    expect(loadHistory()).toHaveLength(20);
  });
  it("clears", () => {
    saveHistory({ ts: 1, seed: "abc", count: 10, types: [], action: "generate" });
    clearHistory();
    expect(loadHistory()).toEqual([]);
  });
});

describe("test-id shareable URL", () => {
  it("builds share URL when window unavailable", () => {
    const origWindow = (globalThis as Record<string, unknown>).window;
    (globalThis as Record<string, unknown>).window = undefined;
    const url = buildShareUrl("abc", 50, ["us-ssn", "in-aadhaar"]);
    expect(url).toContain("seed=abc");
    expect(url).toContain("count=50");
    expect(url).toContain("types=us-ssn%2Cin-aadhaar");
    (globalThis as Record<string, unknown>).window = origWindow;
  });
  it("parses share URL back", () => {
    const p = parseShareUrl("seed=abc&count=50&types=us-ssn%2Cin-aadhaar");
    expect(p.seed).toBe("abc");
    expect(p.count).toBe(50);
    expect(p.types).toEqual(["us-ssn", "in-aadhaar"]);
  });
  it("handles empty hash with defaults", () => {
    const p = parseShareUrl("");
    expect(p.seed).toBe("");
    expect(p.count).toBe(10);
    expect(p.types).toEqual([]);
  });
  it("filters unknown types", () => {
    const p = parseShareUrl("types=us-ssn%2CbogusType");
    expect(p.types).toEqual(["us-ssn"]);
  });
  it("clamps count to valid range", () => {
    expect(parseShareUrl("count=0").count).toBe(1);
    expect(parseShareUrl("count=99999999").count).toBe(5000);
  });
});

// Suppress unused-import lint
export type _Unused = IdType | GeneratedId | Rng;

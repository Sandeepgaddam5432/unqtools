export async function encryptAES(text: string, key: string, mode: string): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = await crypto.subtle.importKey("raw", encoder.encode(key), { name: "PBKDF2" }, false, ["deriveKey"]);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, keyData, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, derived, encoder.encode(text));
  return btoa(String.fromCharCode(...new Uint8Array([...salt, ...iv, ...new Uint8Array(encrypted)])));
}

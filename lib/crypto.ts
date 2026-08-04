"use client";

/**
 * Web Crypto helpers for Lantern's at-rest encryption.
 *
 * Threat model: data stored in IndexedDB is encrypted so that anyone who gains
 * access to the device or its browser profile (or takes a raw copy of the
 * database) cannot read logs or journal entries without the PIN.
 *
 * The PIN is passed through PBKDF2 (SHA-256) to derive an AES-256-GCM key.
 * The key never leaves the page — it lives only in memory while unlocked.
 */

export const KDF_ITERATIONS = 200_000;
export const VAULT_VERIFIER = "lantern:vault:v1";

export function b64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function randomBytes(length: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(length));
}

/** Derive an AES-256-GCM key from a PIN + salt via PBKDF2. */
export async function deriveKey(pin: string, salt: Uint8Array<ArrayBuffer>, iterations: number = KDF_ITERATIONS): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export interface EncBlob {
  iv: string;
  data: string;
}

/** Encrypt a UTF-8 string with a fresh random 96-bit IV. */
export async function encryptText(key: CryptoKey, plaintext: string): Promise<EncBlob> {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(ct)) };
}

/** Decrypt a blob. Returns null when the key is wrong or data is tampered with. */
export async function decryptText(key: CryptoKey, blob: EncBlob): Promise<string | null> {
  try {
    const pt = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: b64ToBytes(blob.iv) },
      key,
      b64ToBytes(blob.data),
    );
    return new TextDecoder().decode(pt);
  } catch {
    return null;
  }
}

export interface VaultMeta {
  salt: string; // base64
  iterations: number;
  verifier: EncBlob; // encryptText(key, VAULT_VERIFIER)
  version: 1;
}

/** Create fresh vault metadata from a PIN, proving the derived key works. */
export async function buildVaultMeta(pin: string): Promise<VaultMeta> {
  const salt = randomBytes(16);
  const key = await deriveKey(pin, salt, KDF_ITERATIONS);
  return {
    salt: bytesToB64(salt),
    iterations: KDF_ITERATIONS,
    verifier: await encryptText(key, VAULT_VERIFIER),
    version: 1,
  };
}

/** Derive the key and confirm it matches the vault verifier. */
export async function openVault(pin: string, meta: VaultMeta): Promise<CryptoKey | null> {
  const key = await deriveKey(pin, b64ToBytes(meta.salt), meta.iterations);
  const check = await decryptText(key, meta.verifier);
  return check === VAULT_VERIFIER ? key : null;
}

export const supportsWebCrypto = (): boolean =>
  typeof crypto !== "undefined" && !!crypto.subtle && typeof crypto.subtle.deriveKey === "function";

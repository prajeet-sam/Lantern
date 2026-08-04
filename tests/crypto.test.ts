import { describe, it, expect } from "vitest";
import {
  buildVaultMeta,
  decryptText,
  deriveKey,
  encryptText,
  openVault,
  supportsWebCrypto,
  VAULT_VERIFIER,
} from "@/lib/crypto";

const SALT = new Uint8Array(16).fill(7);

describe("crypto", () => {
  it("supports Web Crypto in this environment", () => {
    expect(supportsWebCrypto()).toBe(true);
  });

  it("encrypts and decrypts text with the same key", async () => {
    const key = await deriveKey("1234", SALT, 1000);
    const blob = await encryptText(key, "hello 🌙");
    const out = await decryptText(key, blob);
    expect(out).toBe("hello 🌙");
  });

  it("returns null when decrypting with the wrong key", async () => {
    const keyA = await deriveKey("1111", SALT, 1000);
    const keyB = await deriveKey("2222", SALT, 1000);
    const blob = await encryptText(keyA, "secret");
    expect(await decryptText(keyB, blob)).toBeNull();
  });

  it("builds vault metadata that opens with the right PIN only", async () => {
    const meta = await buildVaultMeta("2468");
    expect(meta.iterations).toBeGreaterThan(0);
    expect(meta.salt.length).toBeGreaterThan(0);
    expect(meta.verifier.data.length).toBeGreaterThan(0);

    const good = await openVault("2468", meta);
    expect(good).toBeTruthy();

    const bad = await openVault("0000", meta);
    expect(bad).toBeNull();
  });

  it("vault verifier round-trips the expected marker", async () => {
    const meta = await buildVaultMeta("1357");
    const key = await openVault("1357", meta);
    expect(key).toBeTruthy();
    const check = await decryptText(key as CryptoKey, meta.verifier);
    expect(check).toBe(VAULT_VERIFIER);
  });

  it("produces different ciphertext for the same text with a different IV", async () => {
    const key = await deriveKey("9999", SALT, 1000);
    const a = await encryptText(key, "same");
    const b = await encryptText(key, "same");
    expect(a.data).not.toBe(b.data);
    expect(a.iv).not.toBe(b.iv);
  });
});

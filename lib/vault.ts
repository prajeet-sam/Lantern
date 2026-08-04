"use client";

import { buildVaultMeta, openVault, type VaultMeta } from "@/lib/crypto";

/**
 * Vault lifecycle. The vault metadata (salt + verifier) lives in localStorage —
 * it contains no plaintext data and is only used to re-derive the encryption
 * key. The actual CryptoKey is held in memory here while the app is unlocked.
 */

const VAULT_KEY = "lantern:vault";

let activeKey: CryptoKey | null = null;

/** In-memory key for the current unlocked session. */
export function getActiveKey(): CryptoKey | null {
  return activeKey;
}

export function setActiveKey(key: CryptoKey | null): void {
  activeKey = key;
}

export function readVaultMeta(): VaultMeta | null {
  try {
    const raw = localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as VaultMeta;
    if (!parsed || parsed.version !== 1 || !parsed.salt || !parsed.verifier) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeVaultMeta(meta: VaultMeta | null): void {
  try {
    if (meta) localStorage.setItem(VAULT_KEY, JSON.stringify(meta));
    else localStorage.removeItem(VAULT_KEY);
  } catch {
    /* ignore quota errors */
  }
}

export function hasVault(): boolean {
  return !!readVaultMeta();
}

/** Create a vault from a new PIN and hold the derived key in memory. */
export async function createVault(pin: string): Promise<CryptoKey | null> {
  const meta = await buildVaultMeta(pin);
  const key = await openVault(pin, meta);
  if (!key) return null;
  writeVaultMeta(meta);
  activeKey = key;
  return key;
}

/** Attempt to unlock. Returns the key on success, null on wrong PIN. */
export async function unlockVault(pin: string): Promise<CryptoKey | null> {
  const meta = readVaultMeta();
  if (!meta) return null;
  const key = await openVault(pin, meta);
  if (key) activeKey = key;
  return key;
}

/** Clear the vault and drop the in-memory key. Data reverts to plaintext writes. */
export function clearVault(): void {
  writeVaultMeta(null);
  activeKey = null;
}

/** Drop the in-memory key without touching stored metadata (for locking). */
export function lockVault(): void {
  activeKey = null;
}

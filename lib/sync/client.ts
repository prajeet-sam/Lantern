/**
 * Thin Supabase layer for Lantern sync: auth, vault CRUD, recovery-code RPCs.
 *
 * No plaintext ever touches these calls — the caller encrypts with
 * lib/sync/vault.ts. Anon-key access is safe because PostgREST data access is
 * gated by row-level security (auth.uid() = user_id), not by the key.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { maskedEmail, usernameFromMaskedEmail } from "@/lib/sync/username";
import type { SyncVault } from "@/lib/sync/vault";

export interface VaultRow {
  user_id: string;
  salt: string;
  iterations: number;
  wrap_password_iv: string;
  wrap_password_data: string;
  recovery_salt: string | null;
  wrap_recovery_iv: string | null;
  wrap_recovery_data: string | null;
  blob_iv: string;
  blob_data: string;
  rev: number;
  updated_at: string;
}

export interface SyncUser {
  id: string;
  username: string;
}

export type SyncError =
  | { code: "invalid"; message: string }
  | { code: "network"; message: string }
  | { code: "unauthorized"; message: string }
  | { code: "conflict"; message: string }
  | { code: "server"; message: string };

export type SyncResult<T> = { ok: true; data: T } | { ok: false; error: SyncError };

const ENV_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const ENV_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

/** True when the environment has Supabase credentials configured. */
export function isSyncConfigured(): boolean {
  return ENV_URL.length > 0 && ENV_ANON_KEY.length > 0;
}

let cachedClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!isSyncConfigured()) return null;
  if (cachedClient) return cachedClient;
  cachedClient = createClient(ENV_URL, ENV_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return cachedClient;
}

function toError(e: unknown, fallback: string): SyncError {
  const msg = e instanceof Error ? e.message : fallback;
  const low = msg.toLowerCase();
  if (low.includes("failed to fetch") || low.includes("network")) {
    return { code: "network", message: "Couldn't reach the sync server. Check your connection." };
  }
  if (low.includes("already registered") || low.includes("already been registered")) {
    return { code: "invalid", message: "That username is already taken." };
  }
  if (low.includes("invalid login credentials") || low.includes("invalid email")) {
    return { code: "invalid", message: "Wrong username or password." };
  }
  if (low.includes("user already exists")) {
    return { code: "invalid", message: "That username is already taken." };
  }
  if (low.includes("confirm your email") || low.includes("email not confirmed")) {
    return { code: "unauthorized", message: "Your account email isn't confirmed yet." };
  }
  return { code: "server", message: msg };
}

/** Current signed-in user, resolved from the session + profile row. */
export async function getSyncUser(): Promise<SyncUser | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getUser();
  const user = data.user;
  if (!user) return null;
  const username = usernameFromMaskedEmail(user.email ?? "") || (user.user_metadata?.username as string | undefined);
  if (!username) return null;
  return { id: user.id, username };
}

export async function signUp(username: string, password: string): Promise<SyncResult<SyncUser>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: { code: "server", message: "Sync isn't configured." } };
  try {
    const { data, error } = await sb.auth.signUp({
      email: maskedEmail(username),
      password,
      options: { data: { username } },
    });
    if (error) return { ok: false, error: toError(error, error.message) };
    if (!data.user) return { ok: false, error: { code: "server", message: "Sign-up didn't complete." } };
    return { ok: true, data: { id: data.user.id, username } };
  } catch (e) {
    return { ok: false, error: toError(e, "Sign-up failed.") };
  }
}

export async function signIn(username: string, password: string): Promise<SyncResult<SyncUser>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: { code: "server", message: "Sync isn't configured." } };
  try {
    const { data, error } = await sb.auth.signInWithPassword({
      email: maskedEmail(username),
      password,
    });
    if (error) return { ok: false, error: toError(error, error.message) };
    if (!data.user) return { ok: false, error: { code: "server", message: "Sign-in didn't complete." } };
    return { ok: true, data: { id: data.user.id, username: usernameFromMaskedEmail(data.user.email ?? "") || username } };
  } catch (e) {
    return { ok: false, error: toError(e, "Sign-in failed.") };
  }
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.auth.signOut();
}

/** The current access token, or null when there's no live session. */
export async function getAccessToken(): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session?.access_token ?? null;
}

/**
 * Delete the account server-side (vault, profile, recovery code, auth user).
 * The server validates our own JWT before using its service-role key.
 */
export async function deleteAccountRequest(): Promise<SyncResult<null>> {
  const token = await getAccessToken();
  if (!token) return { ok: false, error: { code: "unauthorized", message: "Not signed in." } };
  try {
    const res = await fetch("/api/account", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok) {
      return { ok: false, error: { code: body?.ok === false ? "invalid" : "server", message: body?.error ?? "Couldn't delete the account." } };
    }
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toError(e, "Couldn't delete the account.") };
  }
}

/* ------------------------------ Vault CRUD ------------------------------ */

export function vaultToRow(vault: SyncVault, userId: string): VaultRow {
  return {
    user_id: userId,
    salt: vault.salt,
    iterations: vault.iterations,
    wrap_password_iv: vault.wrapPassword.iv,
    wrap_password_data: vault.wrapPassword.data,
    recovery_salt: vault.recoverySalt ?? null,
    wrap_recovery_iv: vault.wrapRecovery?.iv ?? null,
    wrap_recovery_data: vault.wrapRecovery?.data ?? null,
    blob_iv: vault.blob.iv,
    blob_data: vault.blob.data,
    rev: vault.rev,
    updated_at: new Date().toISOString(),
  };
}

export function rowToVault(row: VaultRow): SyncVault {
  return {
    salt: row.salt,
    iterations: row.iterations,
    wrapPassword: { iv: row.wrap_password_iv, data: row.wrap_password_data },
    recoverySalt: row.recovery_salt ?? undefined,
    wrapRecovery: row.wrap_recovery_iv ? { iv: row.wrap_recovery_iv, data: row.wrap_recovery_data ?? "" } : undefined,
    blob: { iv: row.blob_iv, data: row.blob_data },
    rev: row.rev,
  };
}

/** Fetch the user's encrypted vault row, or null when the account has none yet. */
export async function fetchVault(userId: string): Promise<VaultRow | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb
    .from("vaults")
    .select("user_id,salt,iterations,wrap_password_iv,wrap_password_data,recovery_salt,wrap_recovery_iv,wrap_recovery_data,blob_iv,blob_data,rev,updated_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/**
 * Save the vault. Uses an optimistic concurrency guard on `rev` so two devices
 * can't silently clobber each other: if the remote rev differs from `expectedRev`,
 * a `conflict` is returned and the caller should pull + merge + retry.
 */
export async function saveVault(vault: SyncVault, userId: string, expectedRev: number): Promise<SyncResult<{ rev: number }>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: { code: "server", message: "Sync isn't configured." } };
  const row = vaultToRow({ ...vault, rev: expectedRev + 1 }, userId);

  const existing = await fetchVault(userId);
  if (!existing) {
    const { error } = await sb.from("vaults").insert({ ...row, rev: 0 });
    if (error) return { ok: false, error: toError(error, "Couldn't create the sync vault.") };
    return { ok: true, data: { rev: 0 } };
  }
  if (existing.rev !== expectedRev) {
    return { ok: false, error: { code: "conflict", message: "Your data changed on another device. Syncing again." } };
  }
  const { error, data } = await sb
    .from("vaults")
    .update(row)
    .eq("user_id", userId)
    .eq("rev", expectedRev)
    .select("rev");
  if (error) return { ok: false, error: toError(error, "Couldn't save the sync vault.") };
  if (!data || data.length === 0) {
    return { ok: false, error: { code: "conflict", message: "Your data changed on another device. Syncing again." } };
  }
  return { ok: true, data: { rev: data[0].rev } };
}

export async function deleteVault(userId: string): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.from("vaults").delete().eq("user_id", userId);
}

/* ---------------------------- Recovery RPCs ----------------------------- */

/** Store the SHA-256 of the recovery key (server never sees the key). */
export async function saveRecoveryCode(hash: string): Promise<SyncResult<null>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: { code: "server", message: "Sync isn't configured." } };
  const { error } = await sb.rpc("save_recovery_code", { p_hash: hash });
  if (error) return { ok: false, error: toError(error, "Couldn't save the recovery code.") };
  return { ok: true, data: null };
}

export async function deleteRecoveryCode(): Promise<void> {
  const sb = getSupabase();
  if (sb) await sb.rpc("delete_recovery_code");
}

/**
 * Reset the account password with the recovery key. The server verifies the
 * key against the stored hash and sets the new password. Never sends the key
 * itself to any Supabase table.
 */
export async function resetPasswordWithRecovery(username: string, recoveryKey: string, newPassword: string): Promise<SyncResult<null>> {
  const sb = getSupabase();
  if (!sb) return { ok: false, error: { code: "server", message: "Sync isn't configured." } };
  try {
    const res = await fetch("/api/recovery", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, recoveryKey, newPassword }),
    });
    const body = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok) {
      return { ok: false, error: { code: body?.ok === false ? "invalid" : "server", message: body?.error ?? "Recovery failed." } };
    }
    return { ok: true, data: null };
  } catch (e) {
    return { ok: false, error: toError(e, "Recovery failed.") };
  }
}

/**
 * Server-only Supabase helpers for Lantern accounts.
 *
 * Imported only by the two Node API routes (app/api/recovery, app/api/account).
 * Never import from client code: it pulls in node:crypto and the service-role
 * key. Both endpoints use the SUPABASE_SERVICE_ROLE_KEY, which must never be
 * exposed to the client. A minimal in-memory rate limit bounds abuse; it is
 * per server instance (documented in docs/security.md).
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import { PASSWORD_MIN } from "@/lib/sync/username";

export const runtime = "nodejs";

const ADMIN_URL = process.env.SUPABASE_URL ?? "";
const ADMIN_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";

function adminConfigured(): boolean {
  return ADMIN_URL.length > 0 && ADMIN_KEY.length > 0;
}

export function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

/* ---------------- Minimal per-instance rate limiting ---------------- */

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;
const attempts = new Map<string, { count: number; resetAt: number }>();

function allowed(key: string): boolean {
  const now = Date.now();
  const cur = attempts.get(key);
  if (!cur || cur.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (cur.count >= MAX_ATTEMPTS) return false;
  cur.count += 1;
  return true;
}

/**
 * POST /api/recovery  { username, recoveryKey, newPassword }
 * Verify the recovery key against its stored SHA-256 hash and reset the
 * account password. The key itself is only ever hashed — never stored.
 */
export async function handleRecovery(request: Request): Promise<Response> {
  if (!adminConfigured()) {
    return Response.json({ ok: false, error: "Sync is not configured on this server." }, { status: 503 });
  }
  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > 10_000) {
      return Response.json({ ok: false, error: "Request too large." }, { status: 413 });
    }
    body = JSON.parse(text);
  } catch {
    return Response.json({ ok: false, error: "Invalid JSON." }, { status: 400 });
  }

  const { username, recoveryKey, newPassword } = (body ?? {}) as {
    username?: unknown;
    recoveryKey?: unknown;
    newPassword?: unknown;
  };

  if (typeof username !== "string" || typeof recoveryKey !== "string" || typeof newPassword !== "string") {
    return Response.json({ ok: false, error: "Missing fields." }, { status: 400 });
  }
  if (newPassword.length < PASSWORD_MIN) {
    return Response.json(
      { ok: false, error: `Use a password of at least ${PASSWORD_MIN} characters.` },
      { status: 400 },
    );
  }
  if (recoveryKey.length < 8 || recoveryKey.length > 128) {
    return Response.json({ ok: false, error: "That recovery key doesn't look right." }, { status: 400 });
  }
  if (!allowed(`recovery:${clientIp}:${username.toLowerCase()}`)) {
    return Response.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
  }

  const admin = createClient(ADMIN_URL, ADMIN_KEY, { auth: { persistSession: false } });

  const normalized = username.trim().toLowerCase();
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("username", normalized)
    .maybeSingle();
  if (!profile) {
    // Don't reveal whether a username exists.
    return Response.json({ ok: false, error: "That username or recovery key is wrong." }, { status: 401 });
  }

  const { data: code } = await admin
    .from("recovery_codes")
    .select("hash")
    .eq("user_id", profile.id)
    .maybeSingle();
  if (!code || code.hash !== sha256Hex(recoveryKey)) {
    return Response.json({ ok: false, error: "That username or recovery key is wrong." }, { status: 401 });
  }

  const { error } = await admin.auth.admin.updateUserById(profile.id, { password: newPassword });
  if (error) {
    return Response.json({ ok: false, error: "Couldn't reset the password. Try again." }, { status: 500 });
  }

  return Response.json({ ok: true });
}

/**
 * POST /api/account   Authorization: Bearer <user JWT>
 * Delete the signed-in account (vault, profile, recovery code cascade via FK).
 * The caller's own JWT is validated with the anon/publishable client before
 * anything is done with the admin client.
 */
export async function handleAccountDelete(request: Request): Promise<Response> {
  if (!adminConfigured()) {
    return Response.json({ ok: false, error: "Sync is not configured on this server." }, { status: 503 });
  }
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }
  if (!ANON_KEY) {
    return Response.json({ ok: false, error: "Sync is not configured." }, { status: 503 });
  }
  if (!allowed("account")) {
    return Response.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
  }

  // Validate the user's own JWT before doing anything with the admin client.
  const anon = createClient(ADMIN_URL, ANON_KEY, { auth: { persistSession: false } });
  const { data: userData, error: userError } = await anon.auth.getUser(token);
  if (userError || !userData.user) {
    return Response.json({ ok: false, error: "Not signed in." }, { status: 401 });
  }

  const admin = createClient(ADMIN_URL, ADMIN_KEY, { auth: { persistSession: false } });
  const { error } = await admin.auth.admin.deleteUser(userData.user.id);
  if (error) {
    return Response.json({ ok: false, error: "Couldn't delete the account. Try again." }, { status: 500 });
  }
  return Response.json({ ok: true });
}

/**
 * Username handling for sync accounts.
 *
 * Supabase Auth has no native username provider, so the sign-in identifier is a
 * masked email of the form `<username>@lantern.local`. The real username is
 * stored in `profiles` and used for password-reset lookups. The masked address
 * is never used to send mail — it's purely a stable auth identifier.
 */

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 24;
export const PASSWORD_MIN = 12;

const USERNAME_RE = /^[a-z0-9][a-z0-9_.-]*$/;
const MASKED_DOMAIN = "lantern.local";

export interface UsernameResult {
  ok: boolean;
  error?: string;
}

/** Normalize a username: trim, lowercase, strip leading/trailing dots. */
export function normalizeUsername(input: string): string {
  return input.trim().toLowerCase().replace(/^[._-]+|[._-]+$/g, "");
}

export function validateUsername(input: string): UsernameResult {
  const username = normalizeUsername(input);
  if (username.length < USERNAME_MIN) {
    return { ok: false, error: `Usernames must be at least ${USERNAME_MIN} characters.` };
  }
  if (username.length > USERNAME_MAX) {
    return { ok: false, error: `Usernames can be at most ${USERNAME_MAX} characters.` };
  }
  if (!USERNAME_RE.test(username)) {
    return { ok: false, error: "Use only letters, numbers, dots, hyphens and underscores." };
  }
  return { ok: true };
}

export function validatePassword(input: string): UsernameResult {
  if (input.length < PASSWORD_MIN) {
    return { ok: false, error: `Use a password of at least ${PASSWORD_MIN} characters.` };
  }
  if (input.length > 200) {
    return { ok: false, error: "That password is too long." };
  }
  return { ok: true };
}

/** Build the masked auth email for a normalized username. */
export function maskedEmail(username: string): string {
  return `${normalizeUsername(username)}@${MASKED_DOMAIN}`;
}

/** Recover a normalized username from a masked email (defensive). */
export function usernameFromMaskedEmail(email: string): string {
  return email.split("@")[0] ?? "";
}

/** Sanitize a username for display (never trust server input verbatim). */
export function displayUsername(username: string): string {
  return username.trim().toLowerCase().slice(0, USERNAME_MAX);
}

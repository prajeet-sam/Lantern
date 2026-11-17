import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms and conditions",
  description: "The terms for using Moonlit Garden.",
};

export default function TermsPage() {
  return <main className="mx-auto min-h-[100dvh] w-full max-w-3xl px-6 py-12 text-foreground">
    <Link href="/" className="text-sm font-semibold text-[var(--primary)]">← Moonlit Garden</Link>
    <h1 className="mt-8 font-display text-4xl font-semibold">Terms and conditions</h1>
    <p className="mt-2 text-sm text-muted-foreground">Last updated: November 17, 2026</p>
    <article className="legal-content mt-8 space-y-5 text-base leading-7 text-muted-foreground">
      <p>By using Moonlit Garden, you agree to these terms. If you do not agree, do not use the service.</p>
      <h2>Informational use</h2>
      <p>Moonlit Garden is a journaling and cycle-awareness tool, not medical advice, diagnosis, or treatment. Seek a qualified healthcare professional for urgent or concerning symptoms.</p>
      <h2>Your account and content</h2>
      <p>You are responsible for your device, PIN, sync password, and recovery key. Keep them private. You retain your content and should keep independent backups of anything important.</p>
      <h2>Acceptable use</h2>
      <p>Do not abuse, probe, disrupt, or attempt to gain unauthorized access to the service. We may limit access to protect users and the service.</p>
      <h2>Availability and changes</h2>
      <p>The service is provided as available and may change or be discontinued. We may update these terms and will post the revised version here.</p>
      <p><Link className="underline" href="/privacy">Read the privacy policy</Link> or return to <Link className="underline" href="/">Moonlit Garden</Link>.</p>
    </article>
  </main>;
}

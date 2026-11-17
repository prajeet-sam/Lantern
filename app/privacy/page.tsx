import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How Moonlit Garden stores, protects, and uses your information.",
};

export default function PrivacyPage() {
  return <LegalPage title="Privacy policy" updated="November 17, 2026">
    <p>Moonlit Garden is designed to keep your cycle and wellness notes private. This policy explains what is stored and why.</p>
    <h2>Information we store</h2>
    <p>Your entries are stored on your device by default. If you choose optional sync, encrypted account data is stored with our hosting provider. We do not sell personal information or use your health entries for advertising.</p>
    <h2>Analytics and cookies</h2>
    <p>Essential local storage keeps the app, theme, and consent preference working. Optional analytics are loaded only after you allow them through the consent banner. You can decline at any time by clearing this site&apos;s storage.</p>
    <h2>Security and retention</h2>
    <p>Your local vault uses encryption and your sync password is not available to the client&apos;s server in plaintext. You can delete local data in Settings and delete an optional synced account there as well.</p>
    <h2>Your choices</h2>
    <p>You may use the app without sync, export or delete your data, and contact the project owner through the repository for privacy questions.</p>
    <p><Link className="underline" href="/terms">Read the terms and conditions</Link> or return to <Link className="underline" href="/">Moonlit Garden</Link>.</p>
  </LegalPage>;
}

function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return <main className="mx-auto min-h-[100dvh] w-full max-w-3xl px-6 py-12 text-foreground">
    <Link href="/" className="text-sm font-semibold text-[var(--primary)]">← Moonlit Garden</Link>
    <h1 className="mt-8 font-display text-4xl font-semibold">{title}</h1>
    <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
    <article className="legal-content mt-8 space-y-5 text-base leading-7 text-muted-foreground">{children}</article>
  </main>;
}

import Link from "next/link";
import { LanternLogo } from "@/components/LanternLogo";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center px-6 text-center text-foreground">
      <LanternLogo className="h-20 w-20" />
      <h1 className="mt-6 font-display text-4xl font-semibold">This path is quiet.</h1>
      <p className="mt-3 max-w-md text-muted-foreground">The page you’re looking for may have moved or never existed.</p>
      <Link href="/" className="mt-6 rounded-xl bg-[var(--primary)] px-5 py-3 font-semibold text-[var(--primary-foreground)]">Return home</Link>
    </main>
  );
}

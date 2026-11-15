"use client";

import { Coins } from "lucide-react";
import { useAppContext } from "@/contexts/app";
import { Link } from "@/i18n/navigation";
import { isAuthEnabled } from "@/lib/auth";

export default function CreditsDisplay() {
  const { user } = useAppContext();

  if (!isAuthEnabled() || !user) {
    return null;
  }

  const leftCredits = user.credits?.left_credits ?? 0;

  return (
    <Link
      href={"/my-credits" as any}
      title="View my credits"
      className="flex items-center gap-1.5 rounded-full border bg-background px-3 py-1.5 text-sm leading-none transition-colors hover:bg-accent"
    >
      <Coins className="size-4 shrink-0 text-primary" />
      <span className="font-semibold">{leftCredits}</span>
      <span className="text-muted-foreground">credits</span>
    </Link>
  );
}

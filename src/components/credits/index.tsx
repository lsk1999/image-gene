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
      href={"/pricing" as any}
      title="View credits and pricing"
      className="flex h-11 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm leading-none shadow-sm transition-colors hover:border-primary/30 hover:bg-primary/5"
    >
      <Coins className="size-4 shrink-0 text-primary" />
      <span className="font-semibold">{leftCredits}</span>
      <span className="text-muted-foreground">credits</span>
    </Link>
  );
}

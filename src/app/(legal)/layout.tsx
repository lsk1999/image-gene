import Footer from "@/components/blocks/footer";
import { getLandingPage } from "@/services/page";
import { Sparkles } from "lucide-react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import styles from "./legal.module.css";

export const metadata: Metadata = {
  title: {
    template: "%s | AI Kitchen Design",
    default: "AI Kitchen Design Policies",
  },
};

export default async function LegalLayout({ children }: { children: ReactNode }) {
  const { footer } = await getLandingPage("en");

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-950" lang="en">
      <header className="border-b border-slate-200 bg-white">
        <nav aria-label="Main navigation" className="container flex min-h-20 items-center justify-between gap-3">
          <a href="/" className="flex min-w-0 items-center gap-3 text-base font-semibold tracking-tight sm:text-xl">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-5" aria-hidden="true" />
            </span>
            <span>AI Kitchen Design</span>
          </a>
          <a href="/pricing" className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium hover:bg-slate-100">
            Pricing
          </a>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8 sm:px-8 sm:py-12">
        <article className={styles.document}>{children}</article>
      </main>
      {footer && (
        <NextIntlClientProvider locale="en" messages={{}}>
          <Footer footer={footer} />
        </NextIntlClientProvider>
      )}
    </div>
  );
}

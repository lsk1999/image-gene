"use client";

import { useEffect, useState } from "react";
import { Menu, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Header as HeaderType } from "@/types/blocks/header";
import CreditsDisplay from "@/components/credits";
import Icon from "@/components/icon";
import { Link, usePathname } from "@/i18n/navigation";
import LocaleToggle from "@/components/locale/toggle";
import SignToggle from "@/components/sign/toggle";
import ThemeToggle from "@/components/theme/toggle";

function Brand({ header, compact = false }: { header: HeaderType; compact?: boolean }) {
  return (
    <Link href={(header.brand?.url as any) || "/"} className="group flex min-w-0 items-center gap-3">
      {header.brand?.logo?.src ? (
        <img src={header.brand.logo.src} alt={header.brand.logo.alt || header.brand.title} className="size-11 rounded-xl object-cover" />
      ) : (
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
          <Sparkles className="size-5" aria-hidden="true" />
        </span>
      )}
      {header.brand?.title && (
        <span className={`${compact ? "text-base sm:text-lg" : "text-xl"} truncate font-semibold tracking-[-0.03em] text-slate-950`}>
          {header.brand.title}
        </span>
      )}
    </Link>
  );
}

export default function Header({ header }: { header: HeaderType }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuMounted, setMenuMounted] = useState(false);
  useEffect(() => setMenuMounted(true), []);

  if (header.disabled) return null;

  const isActive = (url?: string) => {
    // Hash links point at a section of another page, so they never mark the current page.
    if (!url || url.includes("#")) return false;
    const path = url.replace(/\/$/, "") || "/";
    const current = pathname.replace(/\/$/, "") || "/";
    return path === current;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur-xl">
      <div className="container">
        <nav className="hidden min-h-24 items-center justify-between gap-8 xl:flex" aria-label="Main navigation">
          <div className="flex min-w-0 items-center gap-7 xl:gap-12">
            <Brand header={header} />
            <div className="flex shrink-0 items-center gap-1 xl:gap-2">
              {header.nav?.items?.map((item) => {
                const active = isActive(item.url);
                return (
                  <Link
                    key={item.title}
                    href={item.url as any}
                    target={item.target}
                    aria-current={active ? "page" : undefined}
                    className={`group relative flex items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary xl:px-4 ${active ? "text-primary after:absolute after:inset-x-3 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary/60 xl:after:inset-x-4" : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"}`}
                  >
                    {item.icon && (
                      <Icon
                        name={item.icon}
                        className={`size-4 transition-colors ${active ? "text-primary" : "text-slate-400 group-hover:text-primary"}`}
                      />
                    )}
                    <span>{item.title}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2.5">
            {header.show_locale && <LocaleToggle />}
            {header.show_theme && <ThemeToggle />}
            <CreditsDisplay />
            {header.buttons?.map((item) => (
              <Button key={item.title} asChild variant={item.variant} className="h-11 rounded-full px-5">
                <Link href={item.url as any} target={item.target || ""} className="flex items-center gap-2">
                  {item.title}
                  {item.icon && <Icon name={item.icon} className="size-4" />}
                </Link>
              </Button>
            ))}
            {header.show_sign && <SignToggle />}
          </div>
        </nav>

        <div className="flex min-h-20 items-center justify-between gap-2 sm:gap-4 xl:hidden">
          <Brand header={header} compact />
          <div className="flex shrink-0 items-center gap-2">
            <CreditsDisplay />
            {menuMounted ? <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="outline" size="icon" className="size-11 rounded-xl bg-slate-50 text-slate-900" aria-label="Open navigation">
                  <Menu className="size-5" />
                </Button>
              </SheetTrigger>
              <SheetContent className="flex w-[min(88vw,380px)] flex-col overflow-y-auto p-6">
                <SheetHeader className="border-b pb-5 text-left">
                  <SheetTitle asChild><div><Brand header={header} compact /></div></SheetTitle>
                </SheetHeader>
                <nav className="mt-6 flex flex-col gap-2" aria-label="Mobile navigation">
                  {header.nav?.items?.map((item) => {
                    const active = isActive(item.url);
                    return (
                      <Link key={item.title} href={item.url as any} target={item.target}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMenuOpen(false)}
                        className={`flex min-h-14 items-center gap-3 rounded-xl px-4 font-medium transition-colors ${active ? "bg-primary/5 text-slate-950" : "text-slate-700 hover:bg-slate-100 hover:text-slate-950"}`}>
                        {item.icon && <span className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary"><Icon name={item.icon} className="size-4" /></span>}
                        {item.title}
                      </Link>
                    );
                  })}
                </nav>
                <div className="mt-auto space-y-3 border-t pt-6">
                  {header.buttons?.map((item) => (
                    <Button key={item.title} asChild variant={item.variant} className="h-12 w-full rounded-xl">
                      <Link href={item.url as any} target={item.target || ""}>{item.title}</Link>
                    </Button>
                  ))}
                  {header.show_sign && <div className="flex min-h-12 items-center rounded-xl bg-slate-50 px-3"><SignToggle /></div>}
                  <div className="flex items-center gap-2">
                    {header.show_locale && <LocaleToggle />}
                    {header.show_theme && <ThemeToggle />}
                  </div>
                </div>
              </SheetContent>
            </Sheet> : (
              <Button variant="outline" size="icon" className="size-11 rounded-xl bg-slate-50 text-slate-900" aria-label="Open navigation" disabled>
                <Menu className="size-5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

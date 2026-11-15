"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, ArrowRightLeft, Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hero as HeroType } from "@/types/blocks/hero";
import Icon from "@/components/icon";
import { Link } from "@/i18n/navigation";

const COMPARE_TIMING = {
  beforeHold: 800,
  reveal: 3400,
  afterHold: 1500,
};

export default function Hero({ hero }: { hero: HeroType }) {
  const compareRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = compareRef.current;
    if (!el) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.style.setProperty("--reveal", "0.5");
      el.style.setProperty("--divider-opacity", "1");
      return;
    }

    const { beforeHold, reveal, afterHold } = COMPARE_TIMING;
    const cycle = beforeHold + reveal + afterHold;
    const easeInOut = (t: number) =>
      t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const t = (now - start) % cycle;
      let value = 0;

      if (t < beforeHold) {
        value = 0;
      } else if (t < beforeHold + reveal) {
        value = easeInOut((t - beforeHold) / reveal);
      } else {
        value = 1;
      }

      el.style.setProperty("--reveal", value.toFixed(4));
      el.style.setProperty(
        "--divider-opacity",
        Math.min(1, Math.min(value, 1 - value) * 14).toFixed(3),
      );
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (hero.disabled) return null;

  const highlightText = hero.highlight_text;
  const texts = highlightText ? hero.title?.split(highlightText, 2) : null;

  return (
    <section className="relative overflow-hidden border-b border-slate-200 bg-[#f7f8f4]">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -left-40 top-12 size-[32rem] rounded-full bg-sky-200/25 blur-3xl" />
        <div className="absolute -right-32 bottom-0 size-[28rem] rounded-full bg-amber-100/50 blur-3xl" />
      </div>
      <div className="container relative grid min-h-[calc(100dvh-6rem)] items-center gap-12 py-14 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16 lg:py-20">
        <div className="max-w-2xl">
          {texts && texts.length > 1 ? (
            <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-5xl">
              {texts[0]}<span className="text-primary">{highlightText}</span>{texts[1]}
            </h1>
          ) : (
            <h1 className="text-balance text-3xl font-semibold leading-[1.1] tracking-[-0.03em] text-slate-950 sm:text-4xl lg:text-5xl">{hero.title}</h1>
          )}

          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-slate-600" dangerouslySetInnerHTML={{ __html: hero.description || "" }} />

          {hero.buttons && (
            <div className="mt-9 flex flex-col items-start gap-3 sm:flex-row">
              {hero.buttons.map((item) => (
                <Button key={item.title} asChild size="lg" variant={item.variant || "default"}
                  className="group h-16 w-full rounded-2xl px-10 text-lg font-semibold shadow-xl shadow-primary/30 ring-1 ring-primary/20 transition-all duration-200 hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-2xl hover:shadow-primary/40 sm:w-auto">
                  <Link href={item.url as any} target={item.target || ""} className="flex items-center justify-center gap-2.5">
                    {item.icon && <Icon name={item.icon} className="size-5" />}
                    {item.title}
                    <ArrowRight className="size-5 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </Button>
              ))}
            </div>
          )}

          {hero.benefits && <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
            {hero.benefits.map((benefit) => <span key={benefit} className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{benefit}</span>)}
          </div>}

          {hero.announcement?.title && (
            <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-sm">
              <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-3.5" /></span>
              <span>{hero.announcement.title}</span>
            </div>
          )}
        </div>

        {hero.image?.src && (
          <div className="relative mx-auto w-full max-w-3xl">
            <div className="absolute -inset-5 rounded-[2.25rem] bg-white/60 shadow-[0_30px_80px_rgba(15,23,42,0.10)]" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white bg-white p-2.5 shadow-[0_24px_64px_rgba(15,23,42,0.14)]">
              {hero.after_image?.src ? (
                <div
                  ref={compareRef}
                  className="hero-compare relative aspect-[4/3] w-full overflow-hidden rounded-[1.3rem] bg-white"
                >
                  <img
                    src={hero.image.src}
                    alt={hero.image.alt || "Kitchen before redesign"}
                    className="absolute inset-0 size-full object-cover"
                  />
                  <img
                    src={hero.after_image.src}
                    alt={hero.after_image.alt || "Kitchen after redesign"}
                    className="absolute inset-0 size-full object-cover"
                    style={{ clipPath: "inset(0 calc(100% - var(--reveal) * 100%) 0 0)" }}
                  />
                  <span
                    className="absolute left-3 top-3 rounded-full bg-slate-900/75 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur"
                    style={{ opacity: "calc(1 - var(--reveal))" }}
                  >
                    {hero.before_label || "Before"}
                  </span>
                  <span
                    className="absolute right-3 top-3 rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-primary-foreground shadow-sm"
                    style={{ opacity: "var(--reveal)" }}
                  >
                    {hero.after_label || "After"}
                  </span>
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-y-0"
                    style={{ left: "calc(var(--reveal) * 100%)", opacity: "var(--divider-opacity)" }}
                  >
                    <div className="absolute inset-y-0 w-px -translate-x-1/2 bg-white/90" />
                    <div className="absolute inset-y-0 w-10 -translate-x-1/2 bg-gradient-to-r from-transparent via-white/30 to-transparent blur-md" />
                    <div className="absolute left-0 top-1/2 grid size-9 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-white bg-white/95 shadow-md">
                      <ArrowRightLeft className="size-4 text-slate-700" />
                    </div>
                  </div>
                </div>
              ) : (
                <img
                  src={hero.image.src}
                  alt={hero.image.alt || hero.title || "Kitchen design preview"}
                  className="aspect-[4/3] w-full rounded-[1.3rem] object-cover"
                />
              )}
              <div className="flex flex-wrap items-center justify-between gap-3 px-2 pb-1 pt-3.5">
                <div className="flex items-center gap-3">
                  <span className="grid size-9 place-items-center rounded-xl bg-primary text-white">
                    <Sparkles className="size-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{hero.preview_title}</p>
                    <p className="text-xs text-slate-500">{hero.preview_description}</p>
                  </div>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
                  {hero.preview_status}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

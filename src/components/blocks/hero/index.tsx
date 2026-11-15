import { ArrowRight, Check, ImagePlus, SlidersHorizontal, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Hero as HeroType } from "@/types/blocks/hero";
import Icon from "@/components/icon";
import { Link } from "@/i18n/navigation";

export default function Hero({ hero }: { hero: HeroType }) {
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
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary"><Sparkles className="size-3.5" /></span>
            <span>{hero.announcement?.title}</span>
          </div>

          {texts && texts.length > 1 ? (
            <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">
              {texts[0]}<span className="text-primary">{highlightText}</span>{texts[1]}
            </h1>
          ) : (
            <h1 className="text-balance text-5xl font-semibold leading-[1.02] tracking-[-0.055em] text-slate-950 sm:text-6xl lg:text-7xl">{hero.title}</h1>
          )}

          <p className="mt-6 max-w-xl text-pretty text-lg leading-8 text-slate-600" dangerouslySetInnerHTML={{ __html: hero.description || "" }} />

          {hero.buttons && (
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              {hero.buttons.map((item) => (
                <Button key={item.title} asChild size="lg" variant={item.variant || "default"}
                  className="h-14 rounded-xl px-7 text-base shadow-none">
                  <Link href={item.url as any} target={item.target || ""} className="flex items-center justify-center gap-2">
                    {item.icon && <Icon name={item.icon} className="size-5" />}
                    {item.title}
                    {!item.icon && <ArrowRight className="size-4" />}
                  </Link>
                </Button>
              ))}
            </div>
          )}

          {hero.benefits && <div className="mt-7 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-600">
            {hero.benefits.map((benefit) => <span key={benefit} className="flex items-center gap-2"><Check className="size-4 text-emerald-600" />{benefit}</span>)}
          </div>}
        </div>

        {hero.image?.src && (
          <div className="relative mx-auto w-full max-w-3xl">
            <div className="absolute -inset-5 rounded-[2.25rem] bg-white/60 shadow-[0_30px_80px_rgba(15,23,42,0.10)]" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white bg-white p-2.5 shadow-[0_24px_64px_rgba(15,23,42,0.14)]">
              <img src={hero.image.src} alt={hero.image.alt || hero.title || "Kitchen design preview"}
                className="aspect-[4/3] w-full rounded-[1.3rem] object-cover" />
              <div className="absolute inset-x-6 bottom-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/90 p-3.5 shadow-lg backdrop-blur-xl">
                <div className="flex items-center gap-3">
                  <span className="grid size-10 place-items-center rounded-xl bg-primary text-white"><Sparkles className="size-4" /></span>
                  <div><p className="text-sm font-semibold text-slate-950">{hero.preview_title}</p><p className="text-xs text-slate-500">{hero.preview_description}</p></div>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">{hero.preview_status}</span>
              </div>
            </div>
            <div className="absolute -left-5 top-12 hidden rounded-2xl border border-white bg-white/95 p-3 shadow-xl lg:flex lg:items-center lg:gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-sky-50 text-primary"><ImagePlus className="size-4" /></span>
              <div><p className="text-xs font-semibold">{hero.upload_label}</p><p className="text-[11px] text-slate-500">{hero.upload_description}</p></div>
            </div>
            <div className="absolute -right-5 top-32 hidden rounded-2xl border border-white bg-white/95 p-3 shadow-xl xl:flex xl:items-center xl:gap-3">
              <span className="grid size-9 place-items-center rounded-xl bg-amber-50 text-amber-700"><SlidersHorizontal className="size-4" /></span>
              <div><p className="text-xs font-semibold">{hero.control_label}</p><p className="text-[11px] text-slate-500">{hero.control_description}</p></div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import HappyUsers from "./happy-users";
import { Hero as HeroType } from "@/types/blocks/hero";
import Icon from "@/components/icon";
import { Link } from "@/i18n/navigation";

export default function Hero({ hero }: { hero: HeroType }) {
  if (hero.disabled) {
    return null;
  }

  const highlightText = hero.highlight_text;
  let texts = null;
  if (highlightText) {
    texts = hero.title?.split(highlightText, 2);
  }

  return (
    <section className="relative overflow-hidden">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-18rem] h-[36rem] w-[72rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute inset-x-0 bottom-0 h-48 bg-linear-to-b from-transparent to-background" />
      </div>

      <div className="container pb-16 pt-20 lg:pb-24 lg:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          {hero.show_badge && (
            <div className="mb-8 flex items-center justify-center">
              <img
                src="/imgs/badges/phdaily.svg"
                alt="phdaily"
                className="h-10 object-cover"
              />
            </div>
          )}

          {hero.announcement && (
            <Link
              href={hero.announcement.url as any}
              className="mx-auto mb-4 inline-flex items-center gap-3 rounded-full border bg-background/70 px-2 py-1 text-sm backdrop-blur"
            >
              {hero.announcement.label && (
                <Badge>{hero.announcement.label}</Badge>
              )}
              {hero.announcement.title}
            </Link>
          )}

          {texts && texts.length > 1 ? (
            <h1 className="text-balance text-4xl font-bold tracking-tight lg:text-7xl">
              {texts[0]}
              <span className="bg-linear-to-r from-primary via-primary/80 to-primary bg-clip-text text-transparent">
                {highlightText}
              </span>
              {texts[1]}
            </h1>
          ) : (
            <h1 className="text-balance text-4xl font-bold tracking-tight lg:text-7xl">
              {hero.title}
            </h1>
          )}

          <p
            className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-muted-foreground text-balance"
            dangerouslySetInnerHTML={{ __html: hero.description || "" }}
          />

          {hero.buttons && (
            <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
              {hero.buttons.map((item, i) => {
                return (
                  <Link
                    key={i}
                    href={item.url as any}
                    target={item.target || ""}
                    className="flex items-center"
                  >
                    <Button
                      className="h-12 w-full px-7 text-base"
                      size="lg"
                      variant={item.variant || "default"}
                    >
                      {item.icon && <Icon name={item.icon} className="" />}
                      {item.title}
                    </Button>
                  </Link>
                );
              })}
            </div>
          )}

          {hero.tip && (
            <p className="mt-8 text-md text-muted-foreground">{hero.tip}</p>
          )}

          {hero.show_happy_users && <HappyUsers />}
        </div>

        {hero.image?.src && (
          <div className="relative mx-auto mt-14 max-w-5xl lg:mt-20">
            <div
              aria-hidden
              className="absolute inset-x-6 -bottom-8 top-16 -z-10 rounded-[2.5rem] bg-primary/10 blur-2xl"
            />
            <div className="overflow-hidden rounded-2xl border bg-muted shadow-2xl shadow-slate-950/10">
              <img
                src={hero.image.src}
                alt={hero.image.alt || hero.title || "Kitchen design preview"}
                className="aspect-video w-full object-cover"
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

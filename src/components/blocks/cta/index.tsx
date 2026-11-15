import { Button } from "@/components/ui/button";
import Icon from "@/components/icon";
import Link from "next/link";
import { Section as SectionType } from "@/types/blocks/section";

export default function CTA({ section }: { section: SectionType }) {
  if (section.disabled) {
    return null;
  }

  return (
    <section id={section.name} className="bg-[#f7f8f4] py-20">
      <div className="container">
        <div className="relative overflow-hidden rounded-[2rem] bg-slate-950 px-6 py-14 text-center text-white shadow-2xl shadow-slate-950/10 md:p-20">
          <div aria-hidden className="absolute -left-24 -top-24 size-80 rounded-full bg-primary/30 blur-3xl" />
          <div aria-hidden className="absolute -bottom-32 -right-20 size-96 rounded-full bg-amber-300/15 blur-3xl" />
          <div className="relative mx-auto max-w-3xl">
            <h2 className="text-balance text-3xl font-semibold tracking-[-0.035em] md:text-5xl">
              {section.title}
            </h2>
            <p className="mx-auto mt-5 max-w-2xl text-slate-300 md:text-lg">
              {section.description}
            </p>
            {section.buttons && (
              <div className="mt-9 flex flex-col justify-center gap-3 sm:flex-row">
                {section.buttons.map((item, idx) => (
                  <Button key={idx} variant={item.variant || "default"} className={`h-12 rounded-xl px-6 ${item.variant === "outline" ? "border-white/20 bg-white/5 text-white hover:bg-white/10 hover:text-white" : ""}`}>
                    <Link
                      href={item.url || ""}
                      target={item.target}
                      className="flex items-center justify-center gap-1"
                    >
                      {item.title}
                      {item.icon && (
                        <Icon name={item.icon as string} className="size-6" />
                      )}
                    </Link>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

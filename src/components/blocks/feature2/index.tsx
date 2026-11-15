import { Badge } from "@/components/ui/badge";
import Icon from "@/components/icon";
import { Section as SectionType } from "@/types/blocks/section";

export default function Feature2({ section }: { section: SectionType }) {
  if (section.disabled) return null;

  return (
    <section id={section.name} className="bg-white py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          {section.label && <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">{section.label}</Badge>}
          <h2 className="mt-5 text-pretty text-3xl font-semibold tracking-[-0.035em] text-slate-950 lg:text-5xl">{section.title}</h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 lg:text-lg">{section.description}</p>
        </div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {section.items?.map((item) => (
            <article key={item.title} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
              {item.image?.src && (
                <div className="overflow-hidden">
                  <img src={item.image.src} alt={item.image.alt || item.title}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
              )}
              <div className="p-6">
                {item.icon && <span className="mb-5 grid size-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon name={item.icon} className="size-5" /></span>}
                <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

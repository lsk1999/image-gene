import Icon from "@/components/icon";
import { Section as SectionType } from "@/types/blocks/section";

export default function Feature({ section }: { section: SectionType }) {
  if (section.disabled) {
    return null;
  }

  return (
    <section id={section.name} className="bg-[#f7f8f4] py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="text-pretty text-3xl font-semibold tracking-[-0.035em] text-slate-950 lg:text-5xl">
            {section.title}
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 lg:text-lg">
            {section.description}
          </p>
        </div>
        <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {section.items?.map((item, i) =>
            item.image?.src ? (
              <div key={i} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
                <div className="overflow-hidden">
                  <img src={item.image.src} alt={item.image.alt || item.title || ""}
                    className="aspect-[4/3] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                </div>
                <div className="p-5">
                  <h3 className="font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              </div>
            ) : (
              <div key={i} className="flex min-h-56 flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-transform hover:-translate-y-1">
                {item.icon && (
                  <div className="mb-8 flex size-11 items-center justify-center rounded-xl bg-primary/10">
                    <Icon name={item.icon} className="size-5 text-primary" />
                  </div>
                )}
                <h3 className="text-lg font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
              </div>
            )
          )}
        </div>
      </div>
    </section>
  );
}

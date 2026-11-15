import Icon from "@/components/icon";
import { Section as SectionType } from "@/types/blocks/section";

export default function Feature1({ section }: { section: SectionType }) {
  if (section.disabled) {
    return null;
  }

  const items = section.items || [];

  return (
    <section id={section.name} className="scroll-mt-24 bg-white py-20 sm:py-24">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
          {section.image && (
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-slate-100" />
              <img
                src={section.image.src}
                alt={section.image.alt || section.title}
                className="aspect-[4/3] w-full rounded-[1.5rem] object-cover shadow-xl shadow-slate-950/10"
              />
            </div>
          )}

          <div>
            {section.title && (
              <h2 className="text-pretty text-3xl font-semibold tracking-[-0.035em] text-slate-950 lg:text-4xl">
                {section.title}
              </h2>
            )}
            {section.description && (
              <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 lg:text-lg">
                {section.description}
              </p>
            )}

            <ol className="mt-10">
              {items.map((item, i) => (
                <li key={i} className="flex gap-5">
                  <div className="flex flex-col items-center">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm shadow-slate-950/5">
                      {item.icon && (
                        <Icon name={item.icon} className="size-5 text-primary" />
                      )}
                    </span>
                    {i < items.length - 1 && (
                      <span
                        aria-hidden
                        className="my-2 w-px flex-1 bg-gradient-to-b from-slate-200 via-slate-200 to-slate-200/0"
                      />
                    )}
                  </div>
                  <div className={i === items.length - 1 ? "pb-1" : "pb-8"}>
                    <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <h3 className="mt-1.5 font-semibold text-slate-950">
                      {item.title}
                    </h3>
                    <p className="mt-1.5 text-sm leading-6 text-slate-600">
                      {item.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}

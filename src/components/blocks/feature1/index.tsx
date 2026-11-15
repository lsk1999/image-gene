import Icon from "@/components/icon";
import { Section as SectionType } from "@/types/blocks/section";

export default function Feature1({ section }: { section: SectionType }) {
  if (section.disabled) {
    return null;
  }

  return (
    <section id={section.name} className="bg-white py-20 sm:py-24">
      <div className="container">
        <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {section.image && (
            <div className="relative">
              <div className="absolute -inset-4 -z-10 rounded-[2rem] bg-slate-100" />
              <img src={section.image.src} alt={section.image.alt || section.title}
                className="aspect-[4/3] w-full rounded-[1.5rem] object-cover shadow-xl shadow-slate-950/10" />
            </div>
          )}
          <div className="flex flex-col">
            {section.title && (
              <h2 className="mb-5 text-pretty text-3xl font-semibold tracking-[-0.035em] text-slate-950 lg:text-5xl">
                {section.title}
              </h2>
            )}
            {section.description && (
              <p className="mb-9 max-w-xl text-base leading-7 text-slate-600 lg:text-lg">
                {section.description}
              </p>
            )}
            <ul className="space-y-3">
              {section.items?.map((item, i) => (
                <li key={i} className="flex gap-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                  {item.icon && (
                    <Icon
                      name={item.icon}
                      className="mt-0.5 size-5 shrink-0 text-primary"
                    />
                  )}
                  <div>
                    <div className="font-semibold text-slate-950">
                      {item.title}
                    </div>
                    <div className="mt-1 text-sm leading-6 text-slate-600">
                      {item.description}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

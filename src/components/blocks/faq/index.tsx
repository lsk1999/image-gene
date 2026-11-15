import { Badge } from "@/components/ui/badge";
import { Section as SectionType } from "@/types/blocks/section";

export default function FAQ({ section }: { section: SectionType }) {
  if (section.disabled) {
    return null;
  }

  return (
    <section id={section.name} className="bg-white py-20 sm:py-24">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          {section.label && (
            <Badge variant="outline" className="rounded-full border-primary/20 bg-primary/5 px-3 py-1 text-primary">{section.label}</Badge>
          )}
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.035em] text-slate-950 lg:text-5xl">{section.title}</h2>
          <p className="mt-5 text-base leading-7 text-slate-600 lg:text-lg">
            {section.description}
          </p>
        </div>
        <div className="mx-auto mt-12 grid gap-4 md:grid-cols-2">
          {section.items?.map((item, index) => (
            <div key={index} className="rounded-2xl border border-slate-200 bg-slate-50/60 p-6">
              <div>
                <h3 className="font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {item.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

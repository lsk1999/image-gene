import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { styleGuides } from "@/data/kitchen-style-guides";

export default function KitchenStyleGallery({ locale, featured = false }: { locale: string; featured?: boolean }) {
  const zh = locale === "zh";
  const featuredSlugs = ["modern", "transitional", "scandinavian", "japandi", "modern-farmhouse", "industrial"];
  const items = featured ? featuredSlugs.map(slug => styleGuides.find(style => style.slug === slug)!) : styleGuides;
  return (
    <section id="kitchen-styles" className="bg-[#f7f8f4] py-20 sm:py-24">
      <div className="container">
        {featured && <div className="mb-12 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
          <div className="max-w-2xl"><p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-800">{zh ? "找到你的设计方向" : "FIND YOUR DIRECTION"}</p><h2 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl">{zh ? "先了解风格，再设计你的厨房" : "Find the style that feels like you"}</h2><p className="mt-4 leading-7 text-slate-600">{zh ? "浏览配色、材质与搭配指南，再用自己的照片探索改造方案。风格指南目前以英文提供。" : "Explore the colors, materials and details behind each look before trying it in your own kitchen."}</p></div>
          <Link href="/kitchen-styles" className="inline-flex shrink-0 items-center gap-2 font-semibold text-emerald-900 underline underline-offset-4">{zh ? "浏览全部 18 种风格" : "Explore all 18 styles"}<ArrowRight size={17} /></Link>
        </div>}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((style, index) => <Link key={style.slug} href={`/kitchen-styles/${style.slug}`} className="group overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800">
            <div className="relative overflow-hidden"><img src={style.image} alt={style.alt} width={1200} height={900} loading="lazy" className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.04]" /><span className="absolute bottom-4 left-4 rounded-full bg-white/95 px-3 py-1 text-xs font-medium text-emerald-950">{String(index + 1).padStart(2, "0")} / {zh ? "风格指南" : "STYLE NOTES"}</span></div>
            <div className="p-6"><h3 className="text-xl font-semibold tracking-tight text-slate-950">{style.name}</h3><p className="mt-3 text-sm leading-6 text-slate-600">{style.description}</p><span className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">{zh ? "查看风格详情" : "Explore this style"}<ArrowRight size={16} className="transition group-hover:translate-x-1" /></span></div>
          </Link>)}
        </div>
      </div>
    </section>
  );
}

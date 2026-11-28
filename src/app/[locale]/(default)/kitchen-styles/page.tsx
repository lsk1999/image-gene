import type { Metadata } from "next";
import { Link } from "@/i18n/navigation";
import KitchenStyleGallery from "@/components/kitchen-style-gallery";

export const metadata: Metadata = {
  title: "Kitchen Design Styles | AI Kitchen Design",
  description: "Explore 18 kitchen design directions, with colors, materials, cabinetry and lighting ideas for your own space.",
};

export default async function KitchenStylesPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const zh = locale === "zh";
  return <>
    <section className="border-b border-stone-200 bg-[#f2f1eb] py-16 sm:py-24"><div className="container max-w-4xl text-center"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-800">{zh ? "厨房风格资料库" : "THE KITCHEN STYLE LIBRARY"}</p><h1 className="mt-5 text-4xl font-semibold tracking-[-0.04em] text-emerald-950 sm:text-6xl">{zh ? "为你的厨房，找到喜欢的风格" : "A look you love. A kitchen that feels like yours."}</h1><p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">{zh ? "了解 18 种设计方向的配色、橱柜、台面和灯光。详情指南目前以英文提供，选择喜欢的方向后即可进入工具，用自己的厨房照片探索。" : "Get to know 18 design directions through their colors, cabinetry, surfaces and lighting. Choose what speaks to you, then explore a concept with your own kitchen photo."}</p><Link href="/ai-kitchen-design" className="mt-8 inline-flex rounded-full bg-emerald-950 px-7 py-3.5 font-semibold text-white transition hover:bg-emerald-800">{zh ? "打开厨房设计工具" : "Open kitchen designer"}</Link></div></section>
    <KitchenStyleGallery locale={locale} />
  </>;
}

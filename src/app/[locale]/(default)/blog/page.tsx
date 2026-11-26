import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  const zh = locale === "zh";
  return {
    title: zh ? "厨房设计博客与实用指南 | AI Kitchen Design" : "Kitchen Design Blog & Practical Guides | AI Kitchen Design",
    description: zh ? "探索厨房设计思路、照片改造教程和实用 AI 提示词，从灵感走向自己的厨房设计。" : "Practical kitchen design guides, photo redesign workflows and AI prompts to help you explore a new look for your own space.",
    alternates: { canonical: `https://aidesignkitchen.com${zh ? "/zh" : ""}/blog`, languages: { en: "https://aidesignkitchen.com/blog", zh: "https://aidesignkitchen.com/zh/blog" } },
  };
}

export default async function BlogPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const zh = locale === "zh";
  return <div className="min-h-[65vh] bg-[#faf9f5] px-5 py-14 text-slate-900 sm:px-8 sm:py-20">
    <div className="mx-auto max-w-6xl">
      <nav aria-label="Breadcrumb" className="mb-10 flex gap-2 text-xs text-slate-500"><Link href="/" className="hover:underline">{zh ? "首页" : "Home"}</Link><span aria-hidden="true">/</span><span>Blog</span></nav>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-800">{zh ? "从灵感到自己的厨房" : "IDEAS FOR YOUR ACTUAL SPACE"}</p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{zh ? "厨房设计博客" : "The kitchen design journal"}</h1>
      <p className="mb-12 mt-5 max-w-2xl text-base leading-8 text-slate-600">{zh ? "实用的照片改造方法、AI 提示词与设计建议，帮助你明确想保留什么、想改变什么。" : "Photo-based design workflows, useful prompts and thoughtful guidance for deciding what stays and what changes."}</p>
      <Link href="/chatgpt-kitchen-design" className="group grid max-w-5xl overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm transition-shadow hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800 md:grid-cols-2">
        <img src="/imgs/kitchen-styles/organic-modern.jpg" width={1200} height={900} alt={zh ? "木色橱柜与白色石材岛台的厨房风格参考" : "Kitchen inspiration with wood cabinets and a white stone island"} className="aspect-[4/3] h-full w-full object-cover" />
        <div className="flex flex-col justify-center p-7 sm:p-10"><p className="mb-4 text-xs font-semibold uppercase tracking-widest text-emerald-800">{zh ? "AI 设计指南 · 英文文章" : "AI DESIGN GUIDE"}</p><h2 className="text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">ChatGPT Kitchen Design: How to Redesign Your Kitchen From a Photo</h2><p className="mt-5 text-sm leading-7 text-slate-600">{zh ? "从自己的厨房照片开始：学习操作步骤，选择保留、重做或局部修改提示词，并检查生成结果。" : "Start with your own kitchen photo. Follow the steps, copy a prompt for a refresh or full redesign, and learn what to check in the result."}</p><span className="mt-7 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900">{zh ? "阅读指南" : "Read the guide"}<ArrowRight size={17} className="transition-transform group-hover:translate-x-1" /></span></div>
      </Link>
    </div>
  </div>;
}

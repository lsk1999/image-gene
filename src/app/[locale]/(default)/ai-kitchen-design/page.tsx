import KitchenDesignPage from "@/components/kitchen-design";
import type { Metadata } from "next";
import { publicPageRobots } from "@/lib/search-indexing";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return {
    title: "AI Kitchen Design Tool: Redesign Your Kitchen From a Photo",
    description: "Upload your kitchen photo, choose a design style and explore cabinet, material and lighting ideas. Refine your AI kitchen concepts and save your favorite results.",
    robots: publicPageRobots(locale),
    alternates: { canonical: "https://aidesignkitchen.com/ai-kitchen-design" },
  };
}

export default function Page() {
  return <KitchenDesignPage />;
}

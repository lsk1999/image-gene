import KitchenDesignPage from "@/components/kitchen-design";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "AI Kitchen Design",
  description: "Upload your kitchen photo and explore personalized kitchen design ideas.",
};

export default function Page() {
  return <KitchenDesignPage />;
}

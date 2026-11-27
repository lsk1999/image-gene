import Pricing from "@/components/blocks/pricing";
import { paymentSettings } from "@/services/payment-settings";
import { getPricingPage } from "@/services/page";

export const dynamic = "force-dynamic";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const page = await getPricingPage(locale);
  return page.pricing ? (
    <Pricing pricing={page.pricing} {...paymentSettings()} />
  ) : null;
}

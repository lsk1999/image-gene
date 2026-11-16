import Pricing from "@/components/blocks/pricing";
import { dodoMode } from "@/integrations/dodo";
import { getPricingPage } from "@/services/page";

export const dynamic = "force-dynamic";

export default async function PricingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const page = await getPricingPage(locale);
  const mode = process.env.PAY_PROVIDER === "dodo" ? dodoMode() : undefined;

  const checkoutEnabled = process.env.CHECKOUT_ENABLED !== "false";

  return page.pricing ? (
    <Pricing pricing={page.pricing} dodoMode={mode} checkoutEnabled={checkoutEnabled} />
  ) : null;
}

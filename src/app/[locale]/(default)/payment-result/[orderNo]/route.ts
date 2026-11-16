import { redirect } from "next/navigation";

// Checkouts created before the Dodo callback was introduced still return here.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string; orderNo: string }> }
) {
  const { locale, orderNo } = await params;
  const query = new URLSearchParams({ order_no: orderNo, locale });
  redirect(`/api/pay/callback/dodo?${query}`);
}

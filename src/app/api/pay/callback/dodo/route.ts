import { redirect } from "@/i18n/navigation";
import { readDodoCheckoutBinding } from "@/integrations/dodo";
import { findOrderByOrderNo } from "@/models/order";
import { reconcileDodoCheckout } from "@/services/dodo-payment";
import { getUserUuid } from "@/services/user";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderNo = searchParams.get("order_no");
  const locale = searchParams.get("locale") === "zh" ? "zh" : "en";
  let href = process.env.NEXT_PUBLIC_PAY_FAIL_URL || "/";

  try {
    const userId = orderNo ? await getUserUuid() : undefined;
    const order = orderNo && userId ? await findOrderByOrderNo(orderNo) : undefined;

    if (order && order.user_uuid === userId && readDodoCheckoutBinding(order.order_detail)) {
      const paid = await reconcileDodoCheckout(order);
      if (paid) href = process.env.NEXT_PUBLIC_PAY_SUCCESS_URL || "/";
    }
  } catch (error) {
    console.error("Dodo return payment confirmation failed", {
      orderNo,
      message: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return redirect({ href, locale });
}

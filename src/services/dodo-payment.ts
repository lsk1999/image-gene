import { db } from "@/db";
import { credits, orders } from "@/db/schema";
import { dodoCheckoutBinding, dodoClient, readDodoCheckoutBinding } from "@/integrations/dodo";
import { addCalendarMonths } from "@/lib/time";
import { OrderStatus, updateOrderSession } from "@/models/order";
import { CreditsTransType, lockCredits } from "@/services/credit";
import { eq } from "drizzle-orm";
import { z } from "zod";

type LocalOrder = typeof orders.$inferSelect;

const productSchema = z.object({
  product_id: z.string(),
  price: z.object({
    type: z.literal("one_time_price"),
    currency: z.string(),
    price: z.number().int(),
    tax_inclusive: z.boolean().nullish(),
    pay_what_you_want: z.boolean().nullish(),
    discount: z.number().nullish(),
    discount_bps: z.number().nullish(),
    purchasing_power_parity: z.boolean().nullish(),
  }),
});

const checkoutSchema = z.object({
  session_id: z.string().min(1),
  checkout_url: z.string().url().refine((url) => new URL(url).protocol === "https:"),
});

const checkoutStatusSchema = z.object({
  id: z.string().min(1),
  payment_id: z.string().min(1).nullish(),
  payment_status: z.string().nullish(),
});

const paymentIdentitySchema = z.object({
  payment_id: z.string().min(1),
  status: z.literal("succeeded"),
  checkout_session_id: z.string().min(1).nullish(),
  metadata: z.object({ kitchen_order_no: z.string().min(1).optional() }).nullish(),
}).passthrough();

const paymentDetailsSchema = z.object({
  customer: z.object({ email: z.string().min(1) }),
  currency: z.string(),
  total_amount: z.number().int().positive(),
  tax: z.number().int().nonnegative().nullish(),
  refund_status: z.enum(["partial", "full"]).nullish(),
  product_cart: z.array(z.object({
    product_id: z.string(),
    quantity: z.number().int(),
  })).length(1),
});

export async function createDodoCheckout(order: LocalOrder, locale: string) {
  if (!process.env.DODO_WEBHOOK_SECRET) {
    throw new Error("Missing Dodo webhook signing secret");
  }
  const client = dodoClient();
  const products = z.record(z.string().min(1)).parse(JSON.parse(process.env.DODO_PRODUCTS || "{}"));
  const productId = order.product_id && products[order.product_id];
  if (!productId) throw new Error("Missing Dodo product mapping");
  if (!order.currency || !order.valid_months || order.valid_months < 1 || order.credits < 1) {
    throw new Error("Invalid credit pack");
  }

  const currency = order.currency.toUpperCase();
  const product = await client.request(`/products/${encodeURIComponent(productId)}`, productSchema);
  const price = product.price;
  if (product.product_id !== productId || price.pay_what_you_want
    || (price.discount_bps ?? price.discount ?? 0) !== 0 || price.purchasing_power_parity
    || price.currency !== currency || price.price !== order.amount) {
    throw new Error("Dodo product price does not match the credit pack");
  }

  const site = process.env.NEXT_PUBLIC_WEB_URL;
  if (!site) throw new Error("Missing site URL");
  const prefix = locale === "zh" ? "/zh" : "";
  const callbackUrl = new URL("/api/pay/callback/dodo", site);
  callbackUrl.searchParams.set("order_no", order.order_no);
  callbackUrl.searchParams.set("locale", locale);
  const result = await client.request("/checkouts", checkoutSchema, {
    product_cart: [{ product_id: productId, quantity: 1 }],
    customer: { email: order.user_email },
    billing_currency: currency,
    feature_flags: { allow_discount_code: false, allow_currency_selection: false },
    metadata: { kitchen_order_no: order.order_no },
    return_url: callbackUrl.href,
    cancel_url: new URL(`${prefix}/pricing`, site).href,
  });
  const binding = dodoCheckoutBinding.parse({
    provider: "dodo",
    mode: client.mode,
    productId,
    taxInclusive: price.tax_inclusive === true,
  });
  const saved = await updateOrderSession(order.order_no, result.session_id, JSON.stringify(binding));
  if (!saved) throw new Error("Could not bind Dodo checkout to order");
  return { order_no: order.order_no, session_id: result.session_id, checkout_url: result.checkout_url };
}

export async function reconcileDodoCheckout(order: LocalOrder) {
  const binding = readDodoCheckoutBinding(order.order_detail);
  const sessionId = order.stripe_session_id;
  if (!binding || !sessionId) return false;
  if (order.status === OrderStatus.Paid) return true;
  if (order.status !== OrderStatus.Created) return false;

  const client = dodoClient();
  if (binding.mode !== client.mode) throw new Error("Dodo checkout mode does not match");

  const checkout = await client.request(
    `/checkouts/${encodeURIComponent(sessionId)}`,
    checkoutStatusSchema
  );
  if (checkout.id !== sessionId) throw new Error("Dodo checkout ID does not match order");
  if (checkout.payment_status !== "succeeded") return false;
  if (!checkout.payment_id) throw new Error("Successful Dodo checkout has no payment ID");

  await fulfillDodoPayment(checkout.payment_id, order.order_no);
  return true;
}

export async function fulfillDodoPayment(paymentId: string, expectedOrderNo?: string) {
  const client = dodoClient();
  const identity = await client.request(
    `/payments/${encodeURIComponent(paymentId)}`,
    paymentIdentitySchema
  );
  const metadataOrderNo = identity.metadata?.kitchen_order_no;
  if (identity.payment_id !== paymentId || (expectedOrderNo && metadataOrderNo && expectedOrderNo !== metadataOrderNo)) {
    throw new Error("Dodo payment does not match order");
  }

  const orderNo = expectedOrderNo ?? metadataOrderNo;
  const sessionId = identity.checkout_session_id;
  if (!sessionId) {
    if (orderNo) throw new Error("Dodo payment is missing its bound checkout session");
    return;
  }

  await db().transaction(async (tx) => {
    const matches = await tx.select().from(orders)
      .where(orderNo ? eq(orders.order_no, orderNo) : eq(orders.stripe_session_id, sessionId))
      .limit(2)
      .for("update");
    if (matches.length > 1) throw new Error("Dodo checkout is bound to multiple orders");
    const [order] = matches;
    const binding = order && readDodoCheckoutBinding(order.order_detail);
    if (!orderNo && !binding) return;
    if (!order || !binding || binding.mode !== client.mode
      || order.stripe_session_id !== sessionId
      || order.interval !== "one-time" || !order.user_uuid
      || !order.valid_months || order.valid_months < 1 || order.credits < 1) {
      throw new Error("Dodo payment does not match a local checkout");
    }

    if (order.status === OrderStatus.Paid && order.paid_detail === paymentId) return;
    const payment = paymentDetailsSchema.parse(identity);
    if (payment.refund_status) throw new Error("Refunded Dodo payment requires manual review");
    const [item] = payment.product_cart;
    const packAmount = payment.total_amount - (binding.taxInclusive ? 0 : payment.tax ?? 0);
    if (order.status !== OrderStatus.Created || item.product_id !== binding.productId
      || item.quantity !== 1 || payment.currency.toUpperCase() !== order.currency?.toUpperCase()
      || packAmount !== order.amount) {
      throw new Error("Dodo payment amount or product does not match order");
    }

    const paidAt = new Date();
    const expiresAt = addCalendarMonths(paidAt, order.valid_months);
    await lockCredits(tx, order.user_uuid);
    await tx.insert(credits).values({
      trans_no: `order:${order.order_no}`,
      user_uuid: order.user_uuid,
      trans_type: CreditsTransType.OrderPay,
      credits: order.credits,
      order_no: order.order_no,
      created_at: paidAt,
      expired_at: expiresAt,
    });
    await tx.update(orders).set({
      status: OrderStatus.Paid,
      paid_at: paidAt,
      paid_email: payment.customer.email,
      paid_detail: paymentId,
      expired_at: expiresAt,
    }).where(eq(orders.order_no, order.order_no));
  });
}

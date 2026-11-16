import { verifyDodoWebhook } from "@/integrations/dodo/webhook";
import { fulfillDodoPayment } from "@/services/dodo-payment";
import { z } from "zod";

const eventSchema = z.object({ type: z.string(), data: z.unknown() });
const successSchema = z.object({
  payment_id: z.string().min(1),
  metadata: z.object({ kitchen_order_no: z.string().min(1).optional() }).nullish(),
});

export async function POST(request: Request) {
  const secret = process.env.DODO_WEBHOOK_SECRET;
  if (!secret) return new Response(null, { status: 503 });

  const body = await request.text();
  try {
    if (!await verifyDodoWebhook(body, request.headers, secret)) {
      return new Response(null, { status: 401 });
    }
  } catch {
    console.error("Dodo webhook verification could not run");
    return new Response(null, { status: 503 });
  }

  try {
    const event = eventSchema.parse(JSON.parse(body));
    if (event.type === "payment.succeeded") {
      const payment = successSchema.parse(event.data);
      await fulfillDodoPayment(payment.payment_id, payment.metadata?.kitchen_order_no);
    }
    return new Response(null, { status: 204 });
  } catch (error) {
    console.error("Dodo webhook processing failed", error instanceof Error ? error.message : "Unknown error");
    return new Response(null, { status: 500 });
  }
}

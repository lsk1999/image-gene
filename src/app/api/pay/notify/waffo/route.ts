import { verifyWebhook } from "@waffo/pancake-ts";
import { waffoConfig } from "@/integrations/waffo";
import { handleWaffoEvent } from "@/services/waffo-payment";
import { z } from "zod";

const envelope = z.object({
  id: z.string(),
  timestamp: z.string(),
  eventType: z.string().min(1).max(64),
  eventId: z.string().min(1).max(128),
  storeId: z.string().min(1).max(128),
  storeName: z.string(),
  mode: z.enum(["test", "prod"]),
  data: z.record(z.unknown()),
});

export async function POST(request: Request) {
  let config: ReturnType<typeof waffoConfig>;
  try {
    config = waffoConfig();
  } catch {
    return new Response(null, { status: 503 });
  }
  if (Number(request.headers.get("content-length")) > 262144)
    return new Response(null, { status: 413 });
  const raw = await request.text();
  if (raw.length > 262144) return new Response(null, { status: 413 });
  let event;
  try {
    event = envelope.parse(
      verifyWebhook(raw, request.headers.get("x-waffo-signature"), {
        environment: config.mode,
      }),
    );
  } catch {
    return new Response(null, { status: 401 });
  }
  if (event.storeId !== config.storeId || event.mode !== config.mode)
    return new Response(null, { status: 403 });
  try {
    await handleWaffoEvent(event);
    return new Response("OK", { status: 200 });
  } catch {
    console.error("Waffo webhook processing failed", {
      eventType: event.eventType,
      eventId: event.eventId,
    });
    return new Response(null, { status: 503 });
  }
}

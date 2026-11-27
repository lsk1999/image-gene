import "server-only";
import { WaffoPancake } from "@waffo/pancake-ts";
import { z } from "zod";

export function waffoConfig() {
  return z
    .object({
      mode: z.enum(["test", "prod"]),
      storeId: z.string().min(1),
    })
    .parse({
      mode: process.env.WAFFO_MODE,
      storeId: process.env.WAFFO_STORE_ID,
    });
}

export function waffoClient() {
  const merchantId = process.env.WAFFO_MERCHANT_ID;
  const privateKey = process.env.WAFFO_PRIVATE_KEY;
  if (!merchantId || !privateKey)
    throw new Error("Waffo merchant credentials are not configured.");
  return new WaffoPancake({
    merchantId,
    privateKey: privateKey.replace(/\\n/g, "\n"),
    fetch: async (input, init) => {
      const response = await fetch(input, {
        ...init,
        signal: AbortSignal.timeout(15_000),
        // Workers supports follow/manual, but rejects redirect: "error".
        // These are signed POSTs and must never forward credentials to a redirect.
        redirect: "manual",
      });
      if (response.status >= 300 && response.status < 400) {
        await response.body?.cancel().catch(() => undefined);
        throw new Error("Waffo returned an unexpected redirect.");
      }
      return response;
    },
  });
}

export const waffoBinding = z.object({
  provider: z.literal("waffo"),
  mode: z.enum(["test", "prod"]),
  storeId: z.string(),
  productId: z.string(),
  nonce: z.string().uuid(),
});

export function readWaffoBinding(value: string | null) {
  try {
    return waffoBinding.parse(JSON.parse(value || ""));
  } catch {
    return undefined;
  }
}

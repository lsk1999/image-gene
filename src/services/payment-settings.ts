import "server-only";
import { dodoMode } from "@/integrations/dodo";

// Only these non-secret settings may be serialized into the pricing client.
export function paymentSettings(): {
  checkoutEnabled: boolean;
  paymentMode?: "test" | "live";
} {
  const provider = process.env.PAY_PROVIDER || "stripe";
  const mode = process.env.WAFFO_MODE;
  let waffoReady = false;
  try {
    const products = JSON.parse(process.env.WAFFO_PRODUCTS || "{}");
    waffoReady = Boolean(
      process.env.WAFFO_MERCHANT_ID &&
        process.env.WAFFO_STORE_ID &&
        process.env.WAFFO_PRIVATE_KEY &&
        process.env.REPLICATE_API_TOKEN?.trim() &&
        ["starter", "standard", "premium"].every(
          (id) => typeof products[id] === "string" && products[id].trim(),
        ),
    );
  } catch {
    /* Invalid mapping keeps the purchase buttons disabled. */
  }
  return {
    checkoutEnabled:
      process.env.CHECKOUT_ENABLED === "true" &&
      ["stripe", "creem", "dodo", "waffo"].includes(provider) &&
      (provider !== "waffo" ||
        (waffoReady && (mode === "test" || mode === "prod"))),
    paymentMode:
      provider === "waffo"
        ? mode === "prod"
          ? "live"
          : "test"
        : provider === "dodo"
          ? dodoMode()
          : undefined,
  };
}

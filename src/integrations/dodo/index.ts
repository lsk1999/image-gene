import { z } from "zod";

export function dodoMode() {
  const mode = process.env.DODO_MODE || "test";
  if (mode !== "test" && mode !== "live") throw new Error("Invalid DODO_MODE");
  return mode;
}

export const dodoCheckoutBinding = z.object({
  provider: z.literal("dodo"),
  mode: z.enum(["test", "live"]),
  productId: z.string().min(1),
  taxInclusive: z.boolean(),
});

export function readDodoCheckoutBinding(value: string | null) {
  if (!value) return undefined;
  try {
    const parsed = dodoCheckoutBinding.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : undefined;
  } catch {
    return undefined;
  }
}

export function dodoClient() {
  const mode = dodoMode();
  const apiKey = process.env.DODO_PAYMENTS_API_KEY;
  if (!apiKey) throw new Error("Missing Dodo API key");

  async function request<T>(path: string, schema: z.ZodType<T>, body?: object) {
    const response = await fetch(`https://${mode}.dodopayments.com${path}`, {
      method: body ? "POST" : "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) throw new Error(`Dodo API request failed (${response.status})`);
    return schema.parse(await response.json());
  }

  return { mode, request };
}

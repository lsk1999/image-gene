import type { KitchenDesignState } from "./data";
import { getDesignParameters } from "./draft";

export class KitchenRequestError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function generateKitchenDesign(state: KitchenDesignState, signal: AbortSignal, requestId: string) {
  if (!state.originalImage) throw new Error("Upload a kitchen photo first.");
  const source = await fetch(state.originalImage.url, { signal });
  if (!source.ok) throw new Error("Please upload your kitchen photo again.");
  const form = new FormData();
  form.append("requestId", requestId);
  form.append("image", await source.blob(), state.originalImage.name);
  form.append("parameters", JSON.stringify(getDesignParameters(state)));
  const response = await fetch("/api/kitchen-design/generate", { method: "POST", body: form, signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.code !== 0) throw new KitchenRequestError(payload?.message || "Generation failed. Check History before retrying.", response.status);
  if (payload.data?.id !== requestId || payload.data?.url !== `/api/kitchen-design/images/${requestId}?kind=result`) throw new Error("Invalid saved image response.");
  return [payload.data as { id: string; url: string }];
}

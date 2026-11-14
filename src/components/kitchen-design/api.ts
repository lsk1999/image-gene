import type { KitchenDesignState } from "./data";
import { getDesignParameters } from "./draft";

export async function generateKitchenDesign(state: KitchenDesignState, signal: AbortSignal) {
  if (!state.originalImage) throw new Error("Upload a kitchen photo first.");
  const source = await fetch(state.originalImage.url, { signal });
  if (!source.ok) throw new Error("Please upload your kitchen photo again.");
  const form = new FormData();
  form.append("requestId", crypto.randomUUID());
  form.append("image", await source.blob(), state.originalImage.name);
  form.append("parameters", JSON.stringify(getDesignParameters(state)));
  const response = await fetch("/api/kitchen-design/generate", { method: "POST", body: form, signal });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.code !== 0) throw new Error(payload?.message || "Generation failed. Check History before retrying.");
  if (!payload.data?.id || !payload.data?.url?.startsWith("/api/kitchen-design/images/")) throw new Error("Invalid saved image response.");
  return [payload.data as { id: string; url: string }];
}

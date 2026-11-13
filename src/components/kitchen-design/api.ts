import type { KitchenDesignState } from "./data";

// The existing endpoint is text-to-image only. Keep the full request together so
// an image-conditioned provider can replace this adapter without changing the UI.
export function buildKitchenPrompt(state: KitchenDesignState) {
  return [
    "Photorealistic kitchen interior design concept, architectural photography.",
    `Design scope: ${state.designScope}.`,
    `Style: ${state.designStyle}.`,
    ...state.selectedAreas.map(area => {
      const preference = state.materialPreferences[area];
      return `${area}: ${preference?.value === "Custom" ? preference.custom : preference?.value || "Keep original"}.`;
    }),
    state.customPreferences.trim() ? `Additional preferences: ${state.customPreferences.trim()}` : "",
  ].filter(Boolean).join("\n");
}

export async function generateKitchenDesign(state: KitchenDesignState, signal: AbortSignal) {
  const response = await fetch("/api/demo/gen-image", {
    method: "POST", headers: { "Content-Type": "application/json" }, signal,
    body: JSON.stringify({ prompt: buildKitchenPrompt(state), provider: "openai", model: "dall-e-3" }),
  });
  if (!response.ok) throw new Error("The image service is unavailable. Please try again later.");
  const payload = await response.json();
  if (payload.code !== 0) throw new Error(payload.message || "Image generation failed.");
  const images = Array.isArray(payload.data) ? payload.data : [];
  const image = images.find((item: { url?: string }) => item.url && /^https?:\/\//.test(item.url));
  if (!image) throw new Error("No downloadable image was returned. Check the image provider and storage configuration.");
  return [{ id: crypto.randomUUID(), url: image.url }];
}

import { z } from "zod";
import { areas, scopes, styles } from "@/components/kitchen-design/data";

export const kitchenParameters = z.object({
  designScope: z.string().refine(value => scopes.some(scope => scope.name === value)),
  designStyle: z.string().refine(value => styles.some(style => style.name === value)),
  selectedAreas: z.array(z.string().refine(value => Object.prototype.hasOwnProperty.call(areas, value))).max(8),
  materialPreferences: z.record(z.object({ value: z.string().max(120), custom: z.string().max(1000) })),
  customPreferences: z.string().max(3000),
}).superRefine((parameters, context) => {
  if (new Set(parameters.selectedAreas).size !== parameters.selectedAreas.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["selectedAreas"], message: "Duplicate areas are not allowed." });
  }
  for (const area of parameters.selectedAreas) {
    const preference = parameters.materialPreferences[area];
    const config = areas[area];
    if (!config || !preference) continue;
    if (!["Keep original", "Custom", ...config.options].includes(preference.value)) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["materialPreferences", area], message: "Unknown material preference." });
    }
    if (preference.value === "Custom" && !preference.custom.trim()) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: ["materialPreferences", area, "custom"], message: "Describe the custom preference." });
    }
  }
});
export type KitchenParameters = z.infer<typeof kitchenParameters>;

export function kitchenPrompt(parameters: KitchenParameters) {
  const scope = scopes.find(item => item.name === parameters.designScope)!;
  const style = styles.find(item => item.name === parameters.designStyle)!;
  return [
    "Edit the supplied kitchen photograph into a photorealistic residential kitchen design. Use this exact room and camera viewpoint as the reference. Keep doors, windows and structural walls in their original locations. No captions, watermarks or before/after collage.",
    `Design scope: ${scope.name}. ${scope.description}`,
    `Design style: ${style.name}. ${style.description}`,
    parameters.designScope === "Complete Design" ? "For an unfinished room, add a complete functional kitchen within the visible room envelope." : "Keep the existing layout. Only modify elements allowed by the design scope.",
    ...parameters.selectedAreas.map(area => {
      const preference = parameters.materialPreferences[area];
      if (!preference) return "";
      return `${area}: ${preference.value === "Custom" ? preference.custom : preference.value}.`;
    }),
    `For areas without an explicit preference, follow the selected scope and style. User preferences: ${parameters.customPreferences}`,
  ].filter(Boolean).join("\n");
}

export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" && Buffer.from(bytes.slice(8, 12)).toString() === "WEBP") return "image/webp";
  return null;
}

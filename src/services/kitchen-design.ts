import { z } from "zod";
import { areas, furnitureSetting, hasAreaChange, restoreCustomPreferences, styles } from "@/components/kitchen-design/data";

export const kitchenParameters = z.object({
  keepExistingFurniture: z.boolean().optional(),
  designScope: z.string().optional(),
  renovationScope: z.string().optional(),
  layoutGoal: z.string().max(500).optional(),
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
}).transform(({ keepExistingFurniture, designScope, renovationScope, layoutGoal, customPreferences, ...settings }) => ({
  ...settings,
  keepExistingFurniture: furnitureSetting(keepExistingFurniture, designScope ?? renovationScope),
  customPreferences: restoreCustomPreferences(customPreferences, layoutGoal, designScope ?? renovationScope),
}));
export type KitchenParameters = z.infer<typeof kitchenParameters>;

export function kitchenPrompt(parameters: KitchenParameters) {
  const style = styles.find(item => item.name === parameters.designStyle)!;
  const editableAreas = parameters.selectedAreas.filter(area => hasAreaChange(parameters.materialPreferences[area]));
  const preservedAreas = parameters.keepExistingFurniture
    ? parameters.selectedAreas.filter(area => parameters.materialPreferences[area]?.value === "Keep original")
    : [];
  const additionalPreferences = parameters.customPreferences.trim();
  const areaChanges = editableAreas.map(area => {
    const preference = parameters.materialPreferences[area]!;
    return `${area}: ${preference.value === "Custom" ? preference.custom.trim() : preference.value}.`;
  });
  const preserveAreas = preservedAreas.length > 0
    ? `Keep these areas as in the reference, where present: ${preservedAreas.join(", ")}.`
    : "";

  return [
    "Create one photorealistic kitchen concept from the reference photo. Preserve the camera viewpoint, room proportions, structural walls, doors, and windows. Keep walkways clear. For an empty room, design a functional kitchen that fits. No captions, watermarks, or before/after collage.",
    parameters.keepExistingFurniture
      ? "Keep the original kitchen furniture, cabinetry, island, appliances, sink, and fixtures in their existing positions and appearance, except for explicit changes in Areas & Materials. Keep elements marked Keep original unchanged."
      : "Treat the reference as an empty room shell. Remove all existing furniture and kitchen fittings from the design, including cabinets, countertops, island, appliances, sink, faucet, and lighting fixtures. Design and install a new set of kitchen fittings and furnish the room as needed. Use the area settings to specify the new components. Make the replacements visibly distinct and do not reuse original items, even if the new design uses similar finishes.",
    preserveAreas,
    ...areaChanges,
    additionalPreferences && `Apply these requests where compatible with the furniture and area settings above: ${additionalPreferences}`,
    `Use this style for new or explicitly changed elements: ${style.name}. ${style.description}`,
  ].filter(Boolean).join("\n");
}

export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" && Buffer.from(bytes.slice(8, 12)).toString() === "WEBP") return "image/webp";
  return null;
}

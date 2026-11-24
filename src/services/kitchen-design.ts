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
  const keepExisting = parameters.keepExistingFurniture;
  const additionalPreferences = parameters.customPreferences.trim();
  const componentChoices = parameters.selectedAreas
    .filter(area => hasAreaChange(parameters.materialPreferences[area]))
    .map(area => {
      const preference = parameters.materialPreferences[area]!;
      // Built-in options target either the sink or faucet; custom text may cover both.
      const label = area === "Sink & Faucet" && preference.value !== "Custom"
        ? preference.value.endsWith(" Faucet") ? "Faucet finish" : "Sink material/type"
        : area;
      const value = preference.value === "Custom" ? preference.custom.trim() : preference.value;
      return `- ${label}: ${value}.`;
    });
  const preservedAreas = keepExisting
    ? parameters.selectedAreas.filter(area => parameters.materialPreferences[area]?.value === "Keep original")
    : [];
  if (preservedAreas.length) {
    componentChoices.push(`- Keep original: ${preservedAreas.join(", ")}.`);
  }

  return [
    keepExisting
      ? "Create one photorealistic kitchen design image based on retaining and reusing the existing furniture. The overall design should be beautiful and harmonious, with thoughtful proportions, colors, materials and lighting, combining functionality with a refined visual result."
      : "Create one photorealistic image of a completely redesigned kitchen. The overall design should be beautiful and harmonious, with thoughtful proportions, colors, materials and lighting, combining functionality with a refined visual result.",
    "1. SPACE\nPreserve the camera viewpoint, room proportions, and the positions of walls, doors, and windows.",
    keepExisting
      ? "2. PRESERVE AND MODIFY\nRetain the main forms and recognizable features of the existing furniture. Keep its original colors, materials, finishes and placement by default. Apply changes to these attributes when specified in the component choices or additional requirements below, and add furniture, lighting and kitchen fittings as needed for the space and its functions.\nDo not replace all existing furniture unless the user explicitly requests it. Keep items explicitly marked Keep original unchanged. Ensure a functional layout, clear walkways, and that all items fit the available space."
      : "2. REDESIGN\nRemove the existing furniture. Based on the selected style, component choices and additional requirements below, plan a new layout and furnish the kitchen with entirely new fittings.\nCreate visibly different furniture forms, cabinet compositions, appliance arrangements and lighting placement, rather than simply changing colors or materials.\nKeep the layout functional, walkways clear, and all components appropriate for the available space.",
    [
      "3. STYLE",
      `${style.name}: ${style.description}`,
      keepExisting
        ? "Use this style as the main design direction for requested changes and added components. Express a distinctive, harmonious style while retaining original furniture and unspecified finishes and placement. Respect the component choices, additional requirements and items explicitly marked Keep original."
        : "Use this style as the main design direction. Express distinctive, harmonious style through furniture forms, colors, materials and lighting, rather than only changing colors. Respect the specified component choices and additional requirements.",
    ].join("\n"),
    [
      "4. COMPONENT CHOICES",
      ...componentChoices,
      keepExisting
        ? "For components without a specified choice, keep the original items as they are unless the additional requirements request a change."
        : "Choose unspecified kitchen components to suit the selected style, available space and additional requirements.",
    ].filter(Boolean).join("\n"),
    additionalPreferences && `5. ADDITIONAL REQUIREMENTS\n${additionalPreferences}`,
    "6. OUTPUT\nReturn one finished photorealistic kitchen image.\nNo captions, labels, visible watermarks, or before-and-after collage.",
  ].filter(Boolean).join("\n\n");
}

export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" && Buffer.from(bytes.slice(8, 12)).toString() === "WEBP") return "image/webp";
  return null;
}

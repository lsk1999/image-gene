import { z } from "zod";
import { areas, hasAreaChange, scopes, styles } from "@/components/kitchen-design/data";

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
  const selectedAreasOnly = scope.name === "Selected Areas";
  const completeDesign = scope.name === "Complete Design";
  const editableAreas = parameters.selectedAreas.filter(area => hasAreaChange(parameters.materialPreferences[area]));
  const preservedAreas = parameters.selectedAreas.filter(area => {
    const preference = parameters.materialPreferences[area];
    return preference?.value === "Keep original" || (selectedAreasOnly && !preference);
  });
  const additionalPreferences = parameters.customPreferences.trim();
  const scopeInstruction = completeDesign
    ? "Design a complete, functional kitchen. For an existing kitchen, visibly replan the layout by changing the position or configuration of cabinet runs, work zones, or appliances where space and explicit preservation requirements allow. Consider a new island or peninsula configuration only if it fits. For an unfinished room, create a complete kitchen from scratch. Maintain clear circulation and use the available space realistically. Apply general preferences where they fit the new spatial plan and honor the specific area settings below."
    : selectedAreasOnly
      ? "Make only the changes explicitly requested in the area settings or the written requests below. Written requests may target features that have no area setting. Preserve the existing kitchen layout and the appearance and placement of everything outside the requested changes. Keep original settings take precedence, followed by explicit area changes, then written requests. Apply style guidance only to the requested changes."
      : `Design scope: ${scope.name}. ${scope.description}`;
  return [
    completeDesign
      ? "Create a photorealistic kitchen redesign inside the room shown. Preserve the camera viewpoint and the locations of structural walls, doors, and windows. Use the existing kitchen arrangement only as context for the new design. No captions, watermarks or before/after collage."
      : "Edit the supplied kitchen photograph into a photorealistic residential kitchen design. Use this exact room and camera viewpoint as the reference. Keep doors, windows and structural walls in their original locations. No captions, watermarks or before/after collage.",
    scopeInstruction,
    `${selectedAreasOnly ? "Style for requested changes only" : "Design style"}: ${style.name}. ${style.description}`,
    !selectedAreasOnly && !completeDesign && "Keep the existing layout. Only modify elements allowed by the design scope.",
    preservedAreas.length > 0 && `Keep these areas as in the reference, where present: ${preservedAreas.join(", ")}.`,
    ...editableAreas.map(area => {
      const preference = parameters.materialPreferences[area]!;
      return `${area}: ${preference.value === "Custom" ? preference.custom.trim() : preference.value}.`;
    }),
    !selectedAreasOnly && "For areas without an explicit preference, follow the scope above and the selected style.",
    additionalPreferences && `${selectedAreasOnly ? "Written change requests" : "User preferences"}: ${additionalPreferences}`,
  ].filter(Boolean).join("\n");
}

export function imageMime(bytes: Uint8Array): string | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.slice(0, 8).join(",") === "137,80,78,71,13,10,26,10") return "image/png";
  if (Buffer.from(bytes.slice(0, 4)).toString() === "RIFF" && Buffer.from(bytes.slice(8, 12)).toString() === "WEBP") return "image/webp";
  return null;
}

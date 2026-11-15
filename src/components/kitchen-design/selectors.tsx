"use client";

import { useState } from "react";
import { Armchair, Check, ChevronDown, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { areas, styles, type KitchenDesignState } from "./data";

export type UpdateDesign = (patch: Partial<KitchenDesignState>) => void;


function ExpandToggle({ expanded, onToggle, count, noun }: {
  expanded: boolean;
  onToggle: () => void;
  count: number;
  noun: string;
}) {
  // Keep text and icon nodes mounted to tolerate browser translation.
  return (
    <button type="button" aria-expanded={expanded} onClick={onToggle}
      className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
      <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${expanded ? "rotate-180" : "rotate-0"}`} />
      <span className={expanded ? "hidden" : "inline"}>Explore all {count} {noun}</span>
      <span className={expanded ? "inline" : "hidden"}>Show fewer {noun}</span>
    </button>
  );
}

export function Choice({ selected, children, onClick }: { selected: boolean; children: React.ReactNode; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`rounded-lg border px-4 py-3 text-left text-sm transition-colors focus-visible:outline-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary/5 text-primary" : "border-slate-200 hover:border-slate-400"}`}>{children}</button>;
}

export function ImageChoice({ title, description, image, imageAlt, selected, onClick }: { title: string; description?: string; image: string; imageAlt?: string; selected: boolean; onClick: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onClick} className={`relative overflow-hidden rounded-xl border text-left transition-colors focus-visible:outline-2 focus-visible:outline-primary ${selected ? "border-primary ring-1 ring-primary" : "border-slate-200 hover:border-slate-400"}`}>
    <img src={image} alt={imageAlt || `${title} kitchen inspiration`} className="h-20 w-full object-cover sm:h-24" loading="lazy" />
    {selected && <span className="absolute right-2 top-2 rounded-full bg-primary p-0.5 text-white"><Check size={12} /></span>}
    <span className="block px-2.5 py-2"><span className="flex min-h-6 items-center text-[10px] font-medium leading-4 sm:text-[11px]">{title}</span>{description && <span className="mt-1.5 block text-xs leading-relaxed text-slate-500">{description}</span>}</span>
  </button>;
}

export function FurniturePreservation({ state, update }: SelectorProps) {
  const enabled = state.keepExistingFurniture;
  const optionClass = (selected: boolean) =>
    `flex items-center justify-center gap-2 rounded-xl border-2 px-3 py-3.5 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${selected ? "border-primary bg-primary text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:border-slate-400"}`;
  return (
    <div className="grid grid-cols-2 gap-2.5">
      <button type="button" aria-pressed={enabled} onClick={() => update({ keepExistingFurniture: true })} className={optionClass(enabled)}>
        <Armchair size={17} aria-hidden="true" /> <span>Keep existing</span>
      </button>
      <button type="button" aria-pressed={!enabled} onClick={() => update({ keepExistingFurniture: false })} className={optionClass(!enabled)}>
        <Sparkles size={17} aria-hidden="true" /> <span>Redesign everything</span>
      </button>
    </div>
  );
}

export function StyleSelector({ state, update }: { state: KitchenDesignState; update: UpdateDesign }) {
  const [expanded, setExpanded] = useState(false);
  const selectedStyle = styles.find(style => style.name === state.designStyle);
  return <div className="space-y-4">
    <div className={`rounded-lg border px-3.5 py-3 ${selectedStyle ? "border-primary/20 bg-primary/[0.03]" : "border-slate-200 bg-slate-50"}`}>
      <span className="block text-xs font-semibold text-slate-800">{selectedStyle?.name || "Choose a style"}</span>
      <span className="mt-1 block text-xs leading-5 text-slate-500">{selectedStyle?.description || "Select a visual direction to guide the colors, materials, cabinetry, and overall atmosphere."}</span>
    </div>
    <div className="grid grid-cols-3 gap-2.5">
      {styles.map((style, index) => <div key={style.name} className={!expanded && index >= 6 ? "hidden" : "block"}><ImageChoice title={style.name} image={style.image} imageAlt={style.alt} selected={state.designStyle === style.name} onClick={() => update({ designStyle: style.name })} /></div>)}
    </div>
    <ExpandToggle expanded={expanded} onToggle={() => setExpanded(value => !value)} count={styles.length} noun="styles" />
  </div>;
}

type SelectorProps = { state: KitchenDesignState; update: UpdateDesign };
const areaEntries = Object.entries(areas);

function AreaCard({ area, config, state, update }: SelectorProps & {
  area: string;
  config: (typeof areas)[string];
}) {
  const enabled = state.selectedAreas.includes(area);
  const preference = state.materialPreferences[area] || { value: "Keep original", custom: "" };
  const keepOriginal = preference.value === "Keep original";
  const status = enabled && !keepOriginal
    ? "Customize"
    : state.keepExistingFurniture ? (enabled ? "Keep original" : "Use existing") : "AI decides";
  const options = state.keepExistingFurniture
    ? ["Keep original", ...config.options, "Custom"]
    : [...config.options, "Custom"];
  const changePreference = (patch: Partial<typeof preference>) => update({
    materialPreferences: { ...state.materialPreferences, [area]: { ...preference, ...patch } },
  });
  const toggleArea = () => update({
    selectedAreas: enabled
      ? state.selectedAreas.filter(value => value !== area)
      : [...state.selectedAreas, area],
    ...(!enabled && !state.materialPreferences[area] ? {
      materialPreferences: { ...state.materialPreferences, [area]: preference },
    } : {}),
  });

  return (
    <div className="rounded-xl border border-slate-200 p-4">
      <label className="flex cursor-pointer items-start justify-between gap-3">
        <span>
          <span className="block font-medium">
            <span>{area}</span>
            <span className="ml-3 text-xs font-normal text-slate-500">{status}</span>
          </span>
          <span className="mt-1 block text-xs leading-5 text-slate-500">{config.description}</span>
        </span>
        <input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={enabled} onChange={toggleArea} />
      </label>
      {enabled && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            {options.map(option => (
              <Choice key={option} selected={preference.value === option} onClick={() => changePreference({ value: option })}>
                {option}
              </Choice>
            ))}
          </div>
          {preference.value === "Custom" && (
            <Input aria-label={`Custom ${area}`} placeholder={`Describe your preferred ${area.toLowerCase()}…`}
              value={preference.custom} onChange={event => changePreference({ custom: event.target.value })} maxLength={1000} />
          )}
        </div>
      )}
    </div>
  );
}

export function AreasSelector({ state, update }: SelectorProps) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="space-y-3">
      <p className="mb-3 text-xs leading-5 text-slate-500">
        {state.keepExistingFurniture
          ? "Existing items stay unless you specify a change below."
          : "AI designs all new kitchen components. Choose materials or styles below to guide it."}
      </p>
      {areaEntries.map(([area, config], index) => (
        <div key={area} className={!expanded && index >= 4 && !state.selectedAreas.includes(area) ? "hidden" : "block"}>
          <AreaCard area={area} config={config} state={state} update={update} />
        </div>
      ))}
      <ExpandToggle expanded={expanded} onToggle={() => setExpanded(value => !value)} count={areaEntries.length} noun="areas" />
    </div>
  );
}

export function AdditionalRequirements({ state, update }: { state: KitchenDesignState; update: UpdateDesign }) {
  const suggestions = ["Keep the existing layout.", "Make the room brighter and warmer.", "Add more closed storage.", "Create a more open feeling."];
  return (
    <div>
      <Textarea
        id="kitchen-preferences"
        aria-label="Additional requirements"
        rows={6}
        maxLength={3000}
        value={state.customPreferences}
        onChange={event => update({ customPreferences: event.target.value })}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map(text => (
          <button key={text} type="button" className="rounded-full bg-slate-100 px-3 py-2 text-xs hover:bg-slate-200"
            onClick={() => update({ customPreferences: [state.customPreferences, text].filter(Boolean).join("\n").slice(0, 3000) })}>
            + {text}
          </button>
        ))}
      </div>
    </div>
  );
}

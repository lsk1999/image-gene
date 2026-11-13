"use client";

import { useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { areas, scopes, styles, type KitchenDesignState } from "./data";

export type UpdateDesign = (patch: Partial<KitchenDesignState>) => void;

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

export function ScopeSelector({ state, update }: { state: KitchenDesignState; update: UpdateDesign }) {
  const selectedScope = scopes.find(scope => scope.name === state.designScope);
  return <div className="space-y-3">
    <div className="grid grid-cols-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
      {scopes.map(scope => {
        const selected = state.designScope === scope.name;
        return <button key={scope.name} type="button" aria-pressed={selected} onClick={() => update({ designScope: scope.name })} className={`flex min-h-16 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-center text-[11px] font-medium leading-4 transition-colors focus-visible:outline-2 focus-visible:outline-primary sm:text-xs ${selected ? "bg-white text-primary shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"}`}>{selected && <Check size={13} className="shrink-0" />}<span>{scope.name}</span></button>;
      })}
    </div>
    <div className={`rounded-lg border px-3.5 py-3 text-xs leading-5 ${selectedScope ? "border-primary/20 bg-primary/[0.03] text-slate-600" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
      {selectedScope ? selectedScope.description : "Choose how much of your existing kitchen the new concept may change."}
    </div>
  </div>;
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
    <button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900">
      <ChevronDown size={14} aria-hidden="true" className={`transition-transform ${expanded ? "rotate-180" : "rotate-0"}`} />
      <span className={expanded ? "hidden" : "inline"}>Explore all {styles.length} styles</span>
      <span className={expanded ? "inline" : "hidden"}>Show fewer styles</span>
    </button>
  </div>;
}

export function AreasSelector({ state, update }: { state: KitchenDesignState; update: UpdateDesign }) {
  const [expanded, setExpanded] = useState(false);
  const areaEntries = Object.entries(areas);
  return <div className="space-y-3"><p className="mb-3 text-xs leading-5 text-slate-500">Choose materials and finishes only for the areas you want to customize. Unselected areas will be designed by AI to match your chosen style.</p>{areaEntries.map(([area, config], index) => {
    const enabled = state.selectedAreas.includes(area);
    const preference = state.materialPreferences[area] || { value: "Keep original", custom: "" };
    const change = (patch: Partial<typeof preference>) => update({ materialPreferences: { ...state.materialPreferences, [area]: { ...preference, ...patch } } });
    const hidden = !expanded && index >= 4 && !enabled;
    return <div key={area} className={hidden ? "hidden" : "block"}><div className="rounded-xl border border-slate-200 p-4"><label className="flex cursor-pointer items-start justify-between gap-3"><span><span className="block font-medium">{area}<span className="ml-3 text-xs font-normal text-slate-500">{enabled ? "Customize" : "AI decides"}</span></span><span className="mt-1 block text-xs leading-5 text-slate-500">{config.description}</span></span><input type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" checked={enabled} onChange={() => update({ selectedAreas: enabled ? state.selectedAreas.filter(value => value !== area) : [...state.selectedAreas, area] })} /></label>{enabled && <div className="mt-4 space-y-3"><div className="flex flex-wrap gap-2">{["Keep original", ...config.options, "Custom"].map(option => <Choice key={option} selected={preference.value === option} onClick={() => change({ value: option })}>{option}</Choice>)}</div>{preference.value === "Custom" && <Input aria-label={`Custom ${area}`} placeholder={`Describe your preferred ${area.toLowerCase()}…`} value={preference.custom} onChange={event => change({ custom: event.target.value })} maxLength={1000} />}</div>}</div></div>;
  })}<button type="button" aria-expanded={expanded} onClick={() => setExpanded(value => !value)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 py-2 text-xs font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"><ChevronDown size={14} aria-hidden="true" className={`transition-transform ${expanded ? "rotate-180" : "rotate-0"}`} /><span className={expanded ? "hidden" : "inline"}>Explore all {areaEntries.length} areas</span><span className={expanded ? "inline" : "hidden"}>Show fewer areas</span></button></div>;
}

export function AdditionalRequirements({ state, update }: { state: KitchenDesignState; update: UpdateDesign }) {
  return <div><Textarea id="kitchen-preferences" aria-label="Additional requirements" rows={6} maxLength={3000} placeholder="Add any other requirements…" value={state.customPreferences} onChange={event => update({ customPreferences: event.target.value })} /><div className="mt-3 flex flex-wrap gap-2">{["Keep the existing layout.", "Make the room brighter and warmer.", "Add more closed storage.", "Create a more open feeling."].map(text => <button key={text} type="button" className="rounded-full bg-slate-100 px-3 py-2 text-xs hover:bg-slate-200" onClick={() => update({ customPreferences: `${state.customPreferences}${state.customPreferences ? "\n" : ""}${text}`.slice(0, 3000) })}>+ {text}</button>)}</div></div>;
}

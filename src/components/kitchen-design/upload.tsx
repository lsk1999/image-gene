"use client";
import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type KitchenDesignState, initialState } from "./data";
import type { UpdateDesign } from "./selectors";

export function UploadKitchenPhoto({ state, update, onError, reading, onReadingChange, locked }: {
  state: KitchenDesignState;
  update: UpdateDesign;
  onError: (message: string) => void;
  reading: boolean;
  onReadingChange: (reading: boolean) => void;
  locked: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const [dragging, setDragging] = useState(false);
  async function accept(file?: File) {
    if (!file || locked || state.originalImage) return;
    const version = ++readVersion.current;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || !file.size || file.size > 10 * 1024 * 1024) {
      onReadingChange(false);
      onError(file.size > 10 * 1024 * 1024 ? "The photo must be 10 MB or smaller." : "Choose a readable JPG, PNG or WEBP image.");
      return;
    }
    onError("");
    onReadingChange(true);
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error()); reader.readAsDataURL(file); });
      if (version === readVersion.current) { update({ originalImage: { url, name: file.name } }); onError(""); }
    } catch {
      if (version === readVersion.current) onError("This image could not be read. Please choose another photo.");
    } finally {
      if (version === readVersion.current) onReadingChange(false);
    }
  }
  return (
    <fieldset disabled={locked} className="min-w-0">
      <input ref={input} aria-label="Upload kitchen photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only"
        onChange={event => { void accept(event.target.files?.[0]); event.target.value = ""; }} />
      <div onDragOver={event => { event.preventDefault(); if (!locked && !state.originalImage) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={event => { event.preventDefault(); setDragging(false); void accept(event.dataTransfer.files[0]); }}
        className={`overflow-hidden rounded-xl border-2 border-dashed ${dragging && !locked ? "border-primary bg-primary/5" : "border-slate-200 bg-slate-50/60"}`}>
        {state.originalImage ? (
          <div className="flex items-center gap-4 p-3">
            <img src={state.originalImage.url} alt="Your original kitchen" className="h-24 w-28 shrink-0 rounded-lg bg-white object-cover" />
            <div className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{state.originalImage.name}</span>
              <span className="mt-1 block text-xs text-slate-500">Photo ready</span>
              <div className="mt-3">
                <Button type="button" size="sm" variant="ghost" aria-label="Remove photo" onClick={() => {
                  ++readVersion.current;
                  onReadingChange(false);
                  // Clear the configuration together with the photo, so a newly
                  // uploaded photo never inherits the previous photo's settings.
                  update({
                    originalImage: null,
                    keepExistingFurniture: initialState.keepExistingFurniture,
                    designStyle: initialState.designStyle,
                    selectedAreas: initialState.selectedAreas,
                    materialPreferences: initialState.materialPreferences,
                    customPreferences: initialState.customPreferences,
                  });
                  onError("");
                }}><X />Remove</Button>
              </div>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => input.current?.click()} className="flex min-h-32 w-full items-center justify-center gap-3.5 p-4 text-left">
            <span className="rounded-full border border-slate-200 bg-white p-2.5 text-primary"><UploadCloud size={22} /></span>
            <span>
              <span className="block text-sm font-medium">{reading ? "Reading your photo…" : "Click to upload or drag and drop"}</span>
              <span className="mt-1 block text-xs text-slate-500">JPG, PNG or WEBP · Up to 10 MB</span>
            </span>
          </button>
        )}
      </div>
    </fieldset>
  );
}

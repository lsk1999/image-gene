"use client";
import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { type KitchenDesignState } from "./data";
import type { UpdateDesign } from "./selectors";

export function UploadKitchenPhoto({ state, update, onError }: { state: KitchenDesignState; update: UpdateDesign; onError: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const readVersion = useRef(0);
  const [dragging, setDragging] = useState(false);
  const [reading, setReading] = useState(false);
  async function accept(file?: File) {
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return onError("Choose a JPG, PNG or WEBP image.");
    if (file.size > 10 * 1024 * 1024) return onError("The photo must be smaller than 10 MB.");
    const version = ++readVersion.current;
    setReading(true);
    try {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      const url = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error()); reader.readAsDataURL(file); });
      if (version === readVersion.current) { update({ originalImage: { url, name: file.name } }); onError(""); }
    } catch { onError("This image could not be read. Please choose another photo."); }
    finally { if (version === readVersion.current) setReading(false); }
  }
  return <div><input ref={input} aria-label="Upload kitchen photo" type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={event => { void accept(event.target.files?.[0]); event.target.value = ""; }} />
    <div onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void accept(event.dataTransfer.files[0]); }} className={`overflow-hidden rounded-xl border-2 border-dashed ${dragging ? "border-primary bg-primary/5" : "border-slate-200 bg-slate-50/60"}`}>
      {state.originalImage ? <div className="flex items-center gap-4 p-3"><img src={state.originalImage.url} alt="Your original kitchen" className="h-24 w-28 shrink-0 rounded-lg bg-white object-cover" /><div className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{state.originalImage.name}</span><span className="mt-1 block text-xs text-slate-500">Photo ready</span><div className="mt-3 flex gap-2"><Button size="sm" variant="outline" onClick={() => input.current?.click()}>Replace</Button><Button size="sm" variant="ghost" aria-label="Remove photo" onClick={() => { ++readVersion.current; setReading(false); update({ originalImage: null }); }}><X />Remove</Button></div></div></div> : <button type="button" onClick={() => input.current?.click()} className="flex min-h-32 w-full items-center justify-center gap-3.5 p-4 text-left"><span className="rounded-full border border-slate-200 bg-white p-2.5 text-primary"><UploadCloud size={22} /></span><span><span className="block text-sm font-medium">{reading ? "Reading your photo…" : "Click to upload or drag and drop"}</span><span className="mt-1 block text-xs text-slate-500">JPG, PNG or WEBP · Up to 10 MB</span></span></button>}
    </div></div>;
}

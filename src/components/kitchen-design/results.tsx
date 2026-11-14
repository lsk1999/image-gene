"use client";

import { useEffect, useState } from "react";
import { Download, Heart, ImageIcon, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KitchenDesignState } from "./data";
import type { UpdateDesign } from "./selectors";

type ResultsProps = {
  state: KitchenDesignState;
  update: UpdateDesign;
  busy: boolean;
  cancel: () => void;
  onError: (message: string) => void;
};

export function KitchenDesignResults({ state, update, busy, cancel, onError }: ResultsProps) {
  const [tab, setTab] = useState<"preview" | "history">("preview");
  const [activeIndex, setActiveIndex] = useState(0);
  const [compare, setCompare] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [historyError, setHistoryError] = useState("");

  useEffect(() => {
    if (busy) return;
    const abort = new AbortController();
    fetch("/api/kitchen-design/history", { signal: abort.signal, cache: "no-store" })
      .then(async response => {
        const payload = await response.json();
        if (abort.signal.aborted) return;
        if (!response.ok || payload.code !== 0) throw new Error(payload.message || "Could not load saved designs.");
        update({ generationHistory: payload.data });
        setHistoryError("");
      })
      .catch(error => { if (!abort.signal.aborted) setHistoryError(error instanceof Error ? error.message : "Could not load saved designs."); });
    return () => abort.abort();
  }, [tab, busy, update]);

  useEffect(() => {
    setActiveIndex(0);
    if (state.generationResults.length) setTab("preview");
  }, [state.generationResults]);

  const activeResult = state.generationResults[activeIndex] || state.generationResults[0];

  async function downloadResult() {
    if (!activeResult) return;
    setDownloading(true);
    try {
      const response = await fetch(activeResult.url);
      if (!response.ok) throw new Error();
      const objectUrl = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `kitchen-design-${activeResult.id}.png`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
    } catch {
      onError("Download could not start. Open the full-size image and save it from your browser.");
    } finally {
      setDownloading(false);
    }
  }

  function restoreHistory(run: KitchenDesignState["generationHistory"][number]) {
    update({ ...run.parameters, originalImage: run.originalImage || null, generationResults: run.results, favoriteId: null });
    setActiveIndex(0);
    setTab("preview");
  }

  return (
    <section className="flex min-h-[620px] flex-col rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 lg:min-h-[760px]">
      <div className="mx-auto mb-5 grid w-full max-w-md grid-cols-2 rounded-xl bg-slate-100 p-1">
        {(["preview", "history"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setTab(item)} className={`rounded-lg px-4 py-2.5 text-sm font-medium capitalize transition-colors ${tab === item ? "bg-white text-slate-950 shadow-sm" : "text-slate-500 hover:text-slate-800"}`}>
            {item}
          </button>
        ))}
      </div>

      {tab === "history" ? (
        <div className="flex-1 rounded-xl border border-dashed border-slate-300 p-5 sm:p-7">
          <div className="mb-6 flex items-center gap-3">
            <span className="rounded-lg bg-slate-100 p-2 text-slate-600"><RotateCcw size={18} /></span>
            <div><h2 className="font-semibold">Generation history</h2><p className="text-sm text-slate-500">Saved to your account.</p></div>
          </div>
          {historyError ? <p role="alert" className="text-sm text-slate-500">{historyError}</p> : state.generationHistory.length ? (
            <div className="grid gap-4 sm:grid-cols-2">
              {state.generationHistory.map((run) => (
                <button key={run.id} type="button" onClick={() => restoreHistory(run)} className="overflow-hidden rounded-xl border border-slate-200 text-left transition-colors hover:border-primary">
                  <div className={`grid h-36 gap-px bg-slate-200 ${run.results.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                    {run.results.slice(0, 2).map((result) => <img key={result.id} src={result.url} alt="Previously generated kitchen concept" className="h-full w-full bg-slate-50 object-cover" />)}
                  </div>
                  <span className="block p-4"><span className="block truncate text-sm font-medium">{run.summary}</span><span className="mt-1 block text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()} · {run.results.length} image{run.results.length === 1 ? "" : "s"}</span></span>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex min-h-80 flex-col items-center justify-center text-center"><ImageIcon className="mb-4 text-slate-300" size={38} /><h3 className="font-medium">No designs yet</h3><p className="mt-2 max-w-sm text-sm leading-6 text-slate-500">Generated kitchen concepts will appear here so you can return to them later.</p></div>
          )}
        </div>
      ) : (
        <div className="flex flex-1 flex-col rounded-xl border border-dashed border-slate-300 p-4 sm:p-7">
          {busy ? (
            <div role="status" className="flex flex-1 flex-col items-center justify-center text-center"><Loader2 className="animate-spin text-primary" size={38} /><h2 className="mt-5 text-xl font-semibold">Creating your kitchen design</h2><p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Generating one image. This may take a few minutes.</p><Button className="mt-5" variant="outline" onClick={cancel}>Cancel generation</Button></div>
          ) : activeResult ? (
            <>
              <div className="mb-6 text-center"><span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800"><Sparkles size={14} /> AI-GENERATED RESULT</span><h2 className="mt-4 text-2xl font-semibold tracking-tight sm:text-3xl">Your Kitchen Design</h2><p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">Compare your starting photo with the generated design and save the result.</p></div>
              <div className={`grid flex-1 gap-4 ${compare && state.originalImage ? "md:grid-cols-2" : ""}`}>
                {compare && state.originalImage && <figure className="flex min-h-72 flex-col"><div className="relative flex flex-1 items-center overflow-hidden rounded-xl bg-slate-100"><img src={state.originalImage.url} alt="Original kitchen" className="max-h-[520px] w-full object-contain" /><span className="absolute bottom-3 left-3 rounded-md bg-slate-950/75 px-3 py-1.5 text-xs font-medium text-white">Before</span></div></figure>}
                <figure className="flex min-h-72 flex-col"><div className="relative flex flex-1 items-center overflow-hidden rounded-xl bg-slate-100"><img src={activeResult.url} alt={`Generated kitchen concept ${activeIndex + 1}`} className="max-h-[520px] w-full object-contain" /><span className="absolute bottom-3 right-3 rounded-md bg-slate-950/75 px-3 py-1.5 text-xs font-medium text-white">Concept</span></div></figure>
              </div>
              {state.generationResults.length > 1 && <div className="mt-5 flex gap-3 overflow-x-auto pb-1">{state.generationResults.map((result, index) => <button key={result.id} type="button" aria-label={`View concept ${index + 1}`} aria-pressed={result.id === activeResult.id} onClick={() => setActiveIndex(index)} className={`shrink-0 overflow-hidden rounded-lg border-2 ${result.id === activeResult.id ? "border-primary" : "border-transparent"}`}><img src={result.url} alt={`Concept ${index + 1}`} className="h-20 w-28 object-cover" /></button>)}</div>}
              <div className="mt-5 flex flex-wrap gap-3 border-t border-slate-100 pt-5"><Button variant="outline" onClick={() => setCompare((value) => !value)}>{compare ? "Hide original" : "Compare original"}</Button><Button variant="outline" onClick={() => update({ favoriteId: state.favoriteId === activeResult.id ? null : activeResult.id })}><Heart className={state.favoriteId === activeResult.id ? "fill-primary text-primary" : ""} />{state.favoriteId === activeResult.id ? "Favorite" : "Choose favorite"}</Button><Button onClick={() => void downloadResult()} disabled={downloading}><Download /> {downloading ? "Downloading…" : "Download"}</Button><Button asChild variant="ghost"><a href={activeResult.url} target="_blank" rel="noreferrer">Open full size</a></Button></div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center"><span className="rounded-full bg-amber-50 p-4 text-amber-600"><Sparkles size={30} /></span><span className="mt-5 inline-flex rounded-full bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800">AI-GENERATED RESULT</span><h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">Design Your Ideal Kitchen Layout</h2><p className="mt-3 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">Upload a kitchen photo and configure the design options on the left. Your generated concepts will appear here.</p>{state.originalImage && <img src={state.originalImage.url} alt="Selected kitchen awaiting generation" className="mt-8 max-h-80 w-full max-w-2xl rounded-xl bg-slate-100 object-contain" />}</div>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { Download, ExternalLink, Heart, ImageIcon, Pencil, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { KitchenDesignState } from "./data";
import type { UpdateDesign } from "./selectors";
import { RefineDialog } from "./refine-dialog";

type ResultsProps = {
  state: KitchenDesignState;
  update: UpdateDesign;
  busy: boolean;
  refining: boolean;
  readingPhoto: boolean;
  onRefiningChange: (busy: boolean) => void;
  onRefinementSaved: (run: KitchenDesignState["generationHistory"][number], parentId: string) => void;
  onError: (message: string) => void;
  onAccessRequired: (status: number) => Promise<boolean>;
};

export function KitchenDesignResults({
  state, update, busy, refining, readingPhoto, onRefiningChange, onRefinementSaved, onError, onAccessRequired,
}: ResultsProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editResult, setEditResult] = useState<KitchenDesignState["generationResults"][number]>();
  const [editorSession, setEditorSession] = useState(0);
  const editButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (busy || refining) return;

    const abort = new AbortController();
    fetch("/api/kitchen-design/history", { signal: abort.signal, cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (abort.signal.aborted) return;
        if (!response.ok || payload.code !== 0) {
          throw new Error(payload.message || "Could not load saved designs.");
        }
        update({ generationHistory: payload.data });
        setHistoryError("");
      })
      .catch((error) => {
        if (!abort.signal.aborted) {
          setHistoryError(error instanceof Error ? error.message : "Could not load saved designs.");
        }
      });

    return () => abort.abort();
  }, [busy, refining, update]);

  useEffect(() => {
    setActiveIndex(0);
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
    update({
      keepExistingFurniture: false,
      ...(run.parameters || {}),
      originalImage: run.originalImage || null,
      generationResults: run.results,
      favoriteId: null,
    });
    setActiveIndex(0);
  }

  function saveEdit(run: KitchenDesignState["generationHistory"][number], parentId: string) {
    setEditResult(run.results[0]);
    onRefinementSaved(run, parentId);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-28 lg:flex lg:h-[calc(100dvh-180px)] lg:min-h-[680px] lg:flex-col">
      {editResult && (
        <RefineDialog
          key={editorSession}
          open={editorOpen}
          onOpenChange={setEditorOpen}
          result={editResult}
          onSaved={saveEdit}
          onBusyChange={onRefiningChange}
          onAccessRequired={onAccessRequired}
          restoreFocus={() => editButton.current?.focus()}
        />
      )}
      {refining && !editorOpen && (
        <button type="button" className="shrink-0 bg-slate-50 px-4 py-2 text-left text-sm text-primary" onClick={() => setEditorOpen(true)}>
          Applying changes… View progress
        </button>
      )}
      <div className="flex min-h-[540px] flex-1 flex-col p-3 sm:p-4 lg:min-h-0">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
          {busy ? (
            <div role="status" className="flex flex-1 flex-col items-center justify-center bg-gradient-to-b from-white to-primary/5 px-5 py-10 text-center">
              <div aria-hidden="true" className="relative grid size-32 place-items-center">
                <span className="absolute inset-0 rounded-full border border-primary/15" />
                <span className="absolute inset-3 rounded-full border border-primary/20" />
                <span className="absolute inset-3 rounded-full border-2 border-transparent border-t-primary/70 motion-safe:animate-[spin_2.4s_linear_infinite]" />
                <span className="relative grid size-20 place-items-center rounded-2xl border border-primary/15 bg-white text-primary shadow-sm">
                  <ImageIcon size={32} strokeWidth={1.6} />
                  <Sparkles size={17} className="absolute right-2 top-2 motion-safe:animate-pulse" />
                </span>
              </div>
              <h2 className="mt-6 text-xl font-semibold">Creating your kitchen design</h2>
              <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">We’re preparing your photo and generating one design. This may take a few minutes.</p>
            </div>
          ) : activeResult ? (
            <>
              <figure className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden bg-slate-100 p-2 sm:p-3">
                <img
                  src={activeResult.url}
                  alt={`Generated kitchen concept ${activeIndex + 1}`}
                  className="h-full w-full rounded-lg object-contain"
                />

                <div className="absolute right-3 top-3 flex items-center gap-1 rounded-xl bg-white/85 p-1 shadow-sm ring-1 ring-slate-950/5 backdrop-blur-md sm:right-4 sm:top-4">
                  <Button
                    ref={editButton}
                    variant="secondary"
                    className="h-8 gap-1.5 px-2.5 text-xs"
                    disabled={refining}
                    onClick={() => {
                      if (editResult?.id !== activeResult.id) setEditorSession((session) => session + 1);
                      setEditResult(activeResult);
                      setEditorOpen(true);
                    }}
                  >
                    <Pencil size={15} /> <span>Edit Design</span>
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-8 w-8 p-0"
                    title="Save to favorites"
                    aria-label="Save to favorites"
                    aria-pressed={state.favoriteId === activeResult.id}
                    onClick={() => update({ favoriteId: state.favoriteId === activeResult.id ? null : activeResult.id })}
                  >
                    <Heart size={16} className={state.favoriteId === activeResult.id ? "fill-primary text-primary" : ""} />
                  </Button>
                  <Button asChild variant="ghost" className="h-8 w-8 p-0" title="Open full size">
                    <a href={activeResult.url} target="_blank" rel="noreferrer" aria-label="Open full size">
                      <ExternalLink size={16} />
                    </a>
                  </Button>
                  <Button className="h-8 gap-1.5 px-2.5 text-xs" onClick={() => void downloadResult()} disabled={downloading}>
                    <Download size={15} />
                    <span className="hidden sm:inline">{downloading ? "Saving…" : "Download"}</span>
                  </Button>
                </div>

                <span className="absolute bottom-3 right-3 rounded-md bg-slate-950/60 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">AI result</span>

                {state.generationResults.length > 1 && (
                  <div className="absolute bottom-6 left-6 flex gap-2 rounded-xl bg-white/90 p-2 shadow-sm backdrop-blur">
                    {state.generationResults.map((result, index) => (
                      <button
                        key={result.id}
                        type="button"
                        aria-label={`View result ${index + 1}`}
                        aria-pressed={result.id === activeResult.id}
                        onClick={() => setActiveIndex(index)}
                        className={`shrink-0 overflow-hidden rounded-md border-2 ${result.id === activeResult.id ? "border-primary" : "border-transparent"}`}
                      >
                        <img src={result.url} alt={`Result ${index + 1}`} className="h-12 w-16 object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </figure>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center text-center">
              <span className="rounded-full bg-white p-4 text-amber-600 shadow-sm"><Sparkles size={30} /></span>
              <h2 className="mt-5 text-2xl font-semibold tracking-tight sm:text-3xl">Your design will appear here</h2>
              <p className="mt-3 max-w-xl text-sm leading-7 text-slate-500 sm:text-base">
                Upload a kitchen photo, choose your preferences, and generate a new kitchen concept.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="shrink-0 border-t border-slate-200 bg-white px-4 py-3 sm:px-5">
        <div className="mb-2 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold text-slate-950">Previous Results</h2>
          </div>
          {state.generationHistory.length > 0 && (
            <span className="shrink-0 text-xs text-slate-400">{state.generationHistory.length} saved</span>
          )}
        </div>

        {historyError && state.generationHistory.length === 0 ? (
          <p role="alert" className="flex h-24 items-center text-sm text-slate-500">{historyError}</p>
        ) : state.generationHistory.length > 0 ? (
          <div className="flex gap-2.5 overflow-x-auto pb-1">
            {state.generationHistory.map((run) => {
              const result = run.results[0];
              if (!result) return null;
              const selected = state.generationResults.some((item) => item.id === result.id);

              return (
                <button
                  key={run.id}
                  type="button"
                  onClick={() => restoreHistory(run)}
                  disabled={busy || readingPhoto}
                  aria-label={`Open ${run.summary}`}
                  aria-pressed={selected}
                  className={`group relative h-24 w-32 shrink-0 overflow-hidden rounded-lg border bg-slate-100 text-left transition-colors sm:w-36 ${selected ? "border-primary ring-1 ring-primary" : "border-slate-200 hover:border-slate-400"}`}
                >
                  <img
                    src={result.url}
                    alt={run.summary || "Previously generated kitchen design"}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
                  />
                  <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/80 to-transparent px-2.5 pb-2 pt-6 text-white">
                    <span className="block truncate text-[11px] font-medium">{run.summary}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="flex h-24 items-center justify-center gap-3 rounded-lg bg-slate-50 text-sm text-slate-400">
            <ImageIcon size={20} /> <span>Generated results will appear here.</span>
          </div>
        )}
      </div>
    </section>
  );
}

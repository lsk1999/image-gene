"use client";

import { useRef, useState, type FormEvent } from "react";
import { Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { KitchenDesignState } from "./data";

type Result = KitchenDesignState["generationResults"][number];
type SavedDesign = KitchenDesignState["generationHistory"][number];

export function RefineDialog({ open, onOpenChange, result, onSaved, onBusyChange, restoreFocus }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  result: Result;
  onSaved: (design: SavedDesign, parentId: string) => void;
  onBusyChange: (busy: boolean) => void;
  restoreFocus: () => void;
}) {
  const [instruction, setInstruction] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [savedResultId, setSavedResultId] = useState<string>();
  const title = useRef<HTMLHeadingElement>(null);
  const inFlight = useRef(false);
  const lastRequest = useRef<{ input: string; id: string } | null>(null);

  async function refine(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const prompt = instruction.trim();
    if (inFlight.current || !prompt) return;
    inFlight.current = true;
    setPending(true);
    onBusyChange(true);
    setError("");
    setSavedResultId(undefined);

    try {
      const input = { parentResultId: result.id, instruction: prompt };
      const key = JSON.stringify(input);
      if (lastRequest.current?.input !== key) {
        lastRequest.current = { input: key, id: crypto.randomUUID() };
      }
      const response = await fetch("/api/kitchen-design/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, requestId: lastRequest.current.id }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok || payload?.code !== 0) {
        if (response.status === 422) lastRequest.current = null;
        throw new Error(payload?.message || "Could not confirm the edit. Try again to check the same request.");
      }

      const saved = payload.data as SavedDesign | undefined;
      if (!saved || saved.id !== lastRequest.current.id || saved.results?.[0]?.id !== saved.id ||
        saved.results[0].url !== `/api/kitchen-design/images/${saved.id}?kind=result`) {
        throw new Error("Could not confirm the saved result. Try again to check the same request.");
      }
      lastRequest.current = null;
      setInstruction("");
      onSaved(saved, input.parentResultId);
      setSavedResultId(saved.id);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "Could not edit this design.");
    } finally {
      inFlight.current = false;
      onBusyChange(false);
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-dvh max-w-none flex-col gap-0 overflow-hidden p-0 sm:h-[90dvh] sm:w-[94vw] sm:max-w-[1440px] sm:rounded-2xl"
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          title.current?.focus();
        }}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          restoreFocus();
        }}
      >
        <header className="shrink-0 border-b px-5 py-4 pr-12">
          <DialogTitle ref={title} tabIndex={-1}>Edit Design</DialogTitle>
          <DialogDescription className="mt-1.5">Describe what you want to change in this result.</DialogDescription>
        </header>
        <div className="flex min-h-0 flex-1 flex-col md:flex-row">
          <figure className="relative h-[34dvh] min-h-0 shrink-0 bg-slate-100 md:h-auto md:flex-1">
            <img key={result.id} className="absolute inset-0 h-full w-full object-contain p-2" src={result.url} alt="Kitchen design being edited" />
            {pending && (
              <div role="status" className="absolute inset-0 flex items-center justify-center bg-slate-950/35">
                <span className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm text-slate-900">
                  <Loader2 size={16} className="animate-spin" />
                  <span>Applying your changes…</span>
                </span>
              </div>
            )}
          </figure>
          <form onSubmit={refine} className="flex min-h-0 flex-1 flex-col border-t md:w-[360px] md:flex-none md:border-t-0 md:border-l">
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-5">
              <label className="block text-sm font-medium">
                What would you like to change?
                <textarea
                  className="mt-2 block w-full resize-y rounded-lg border bg-background p-3 text-sm"
                  rows={4}
                  maxLength={1000}
                  placeholder="Change only the upper cabinets to light oak. Keep the existing layout, countertop, and lighting."
                  value={instruction}
                  disabled={pending}
                  required
                  onChange={(event) => setInstruction(event.target.value)}
                />
              </label>
              {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
              {savedResultId === result.id && (
                <p role="status" className="text-sm text-muted-foreground">New result saved.</p>
              )}
            </div>
            <div className="shrink-0 border-t p-4">
              <Button className="w-full" type="submit" disabled={pending || !instruction.trim()}>
                <Loader2 aria-hidden="true" className={pending ? "animate-spin" : "hidden"} />
                <Sparkles aria-hidden="true" className={pending ? "hidden" : undefined} />
                <span>{pending ? "Applying changes…" : "Apply changes"}</span>
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

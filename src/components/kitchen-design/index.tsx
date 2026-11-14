"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialState, type KitchenDesignState } from "./data";
import {
  AreasSelector,
  AdditionalRequirements,
  FurniturePreservation,
  StyleSelector,
} from "./selectors";
import { UploadKitchenPhoto } from "./upload";
import { KitchenDesignResults } from "./results";
import { generateKitchenDesign } from "./api";
import { getDesignParameters, loadDraft, saveDraft } from "./draft";

function ConfigSection({
  title,
  optional = false,
  children,
}: {
  title: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 py-5 first:border-t-0 first:pt-4">
      <div className="mb-3 min-w-0 rounded-r-lg border-l-4 border-primary bg-slate-50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold leading-5 text-slate-950">{title}</h2>{optional && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Optional</span>}</div>
      </div>
      {children}
    </section>
  );
}

export default function KitchenDesignPage() {
  const [state, setState] = useState<KitchenDesignState>(initialState);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [refining, setRefining] = useState(false);
  const [ready, setReady] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const { keepExistingFurniture, designStyle, selectedAreas, materialPreferences, customPreferences } = state;
  const draft = useMemo(() => ({ keepExistingFurniture, designStyle, selectedAreas, materialPreferences, customPreferences }),
    [keepExistingFurniture, designStyle, selectedAreas, materialPreferences, customPreferences]);

  useEffect(() => {
    setState(previous => ({ ...previous, ...loadDraft() }));
    setReady(true);
    return () => controller.current?.abort();
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => saveDraft(draft), 500);
    return () => window.clearTimeout(timer);
  }, [ready, draft]);

  const update = useCallback((patch: Partial<KitchenDesignState>) =>
    setState(previous => ({
      ...previous,
      ...(Object.prototype.hasOwnProperty.call(patch, "originalImage") ? { generationResults: [], favoriteId: null } : {}),
      ...patch,
    })), []);

  function saveRefinement(run: KitchenDesignState["generationHistory"][number], parentId: string) {
    setState((previous) => {
      const stillViewingParent = previous.generationResults.some((result) => result.id === parentId);
      return {
        ...previous,
        ...(stillViewingParent ? { generationResults: run.results, favoriteId: null } : {}),
        generationHistory: [
          run,
          ...previous.generationHistory.filter((item) => item.id !== run.id),
        ].slice(0, 50),
      };
    });
  }

  function validate() {
    if (!state.originalImage) {
      return "Upload a kitchen photo before generating.";
    }
    if (!state.designStyle) {
      return "Choose a design style before generating.";
    }
    const missingCustomArea = state.selectedAreas.find(
      (area) =>
        state.materialPreferences[area]?.value === "Custom" &&
        !state.materialPreferences[area]?.custom.trim()
    );
    if (missingCustomArea) {
      return `Describe your custom preference for ${missingCustomArea}.`;
    }
    return "";
  }

  async function generate() {
    if (controller.current || refining) return;
    const validationMessage = validate();
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");
    setBusy(true);
    const abort = new AbortController();
    controller.current = abort;

    try {
      const results = await generateKitchenDesign(state, abort.signal);
      const generatedAt = new Date().toISOString();
      const style = state.designStyle;
      const summary = style;
      const parameters = getDesignParameters(state);

      setState((previous) => ({
        ...previous,
        generationResults: previous.originalImage === state.originalImage ? results : previous.generationResults,
        favoriteId: null,
        generationHistory: [
          {
            id: results[0].id,
            createdAt: generatedAt,
            results,
            summary,
            originalImage: { name: "Kitchen photo", url: `/api/kitchen-design/images/${results[0].id}?kind=source` },
            parameters,
          },
          ...previous.generationHistory,
        ].slice(0, 50),
      }));
    } catch (failure) {
      if (!abort.signal.aborted) {
        setError(
          failure instanceof Error
            ? failure.message
            : "Generation failed. Please try again."
        );
      }
    } finally {
      setBusy(false);
      controller.current = null;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid items-start gap-6 lg:grid-cols-[440px_minmax(0,1fr)] xl:grid-cols-[500px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-5 lg:flex lg:h-[calc(100dvh-180px)] lg:min-h-[680px] lg:flex-col">
            <div className="shrink-0 border-b border-slate-200 p-4">
              <div className="flex min-h-14 items-center justify-between rounded-lg border border-slate-200 px-4 py-3">
                <span className="flex items-center gap-2.5 text-base font-medium">
                  <ImageIcon size={18} className="text-primary" /> <span>Kitchen Design</span>
                </span>
                <ChevronDown size={18} className="text-slate-400" />
              </div>
            </div>

            <div className="max-h-none px-5 sm:px-6 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">
              <ConfigSection
                title="Upload Kitchen Photo"
              >
                <UploadKitchenPhoto
                  state={state}
                  update={update}
                  onError={setError}
                />
              </ConfigSection>

              <ConfigSection
                title="Design Style"
              >
                <StyleSelector state={state} update={update} />
              </ConfigSection>

              <ConfigSection
                title="Furniture"
              >
                <FurniturePreservation state={state} update={update} />
              </ConfigSection>

              <ConfigSection
                title="Areas & Materials"
                optional
              >
                <AreasSelector state={state} update={update} />
              </ConfigSection>

              <ConfigSection
                title="Custom Preferences"
                optional
              >
                <AdditionalRequirements state={state} update={update} />
              </ConfigSection>

            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-6 sm:p-7">
              {error && <p role="alert" className="mb-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}
              <div className="mb-4 text-base font-semibold text-slate-950">Generate & Refine</div>
              {busy ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-full text-base"
                  onClick={() => controller.current?.abort()}
                >
                  <Loader2 className="animate-spin" /> <span>Cancel generation</span>
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-14 w-full text-base"
                  disabled={refining}
                  onClick={() => void generate()}
                >
                  <Sparkles /> <span>Generate Design</span>
                </Button>
              )}
            </div>
          </aside>

          <div className="min-w-0">
            <KitchenDesignResults
              state={state}
              update={update}
              busy={busy}
              refining={refining}
              onRefiningChange={setRefining}
              onRefinementSaved={saveRefinement}
              cancel={() => controller.current?.abort()}
              onError={setError}
            />
          </div>
        </div>

        <div className="mx-auto max-w-3xl py-14 text-center sm:py-16">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            AI厨房设计
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
            用人工智能改造你的厨房。上传照片，自定义你的偏好，打造你梦想中的厨房。
          </p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initialState, type KitchenDesignState } from "./data";
import {
  AreasSelector,
  AdditionalRequirements,
  ScopeSelector,
  StyleSelector,
} from "./selectors";
import { UploadKitchenPhoto } from "./upload";
import { KitchenDesignResults } from "./results";
import { generateKitchenDesign } from "./api";

const storageKey = "shipany-kitchen-design-v2";

const scopeMigrations: Record<string, string> = {
  "Cosmetic Refresh": "Visual Refresh",
  "Partial Renovation": "Selected Areas",
  "Full Renovation": "Complete Design",
};

const materialPreferenceMigrations: Record<string, Record<string, string>> = {
  Cabinets: { White: "White Painted MDF", Walnut: "Walnut Veneer", Black: "Matte Black", "Navy Blue": "Navy Painted", "Sage Green": "Sage Green Painted" },
  Countertops: { Quartz: "Engineered Quartz" },
  Backsplash: { "Subway Tile": "Ceramic Subway Tile", Marble: "Marble Slab", Mosaic: "Glass Mosaic", "Natural Stone": "Natural Stone Tile" },
  Flooring: { Hardwood: "Engineered Hardwood" },
  "Kitchen Island": { "Waterfall Island": "Waterfall Stone Edge" },
  Lighting: { "Pendant Lights": "Pendant Lights", "Recessed Lighting": "Recessed Downlights", "Under-cabinet Lighting": "Under-cabinet LED" },
  "Sink & Faucet": { "Undermount Sink": "Stainless Steel Undermount", "Farmhouse Sink": "Fireclay Apron-front", "Stainless Steel": "Stainless Steel Undermount", "Brushed Brass": "Brushed Brass Faucet", "Matte Black": "Matte Black Faucet" },
  Appliances: { Integrated: "Panel-ready Integrated", White: "Matte White" },
};

function migrateMaterialPreferences(preferences: KitchenDesignState["materialPreferences"] | undefined) {
  if (!preferences) return {};
  return Object.fromEntries(Object.entries(preferences).map(([area, preference]) => [area, {
    ...preference,
    value: materialPreferenceMigrations[area]?.[preference.value] || preference.value,
  }]));
}

function ConfigSection({
  title,
  description,
  optional = false,
  children,
}: {
  title: string;
  description?: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-slate-200 py-5 first:border-t-0 first:pt-4">
      <div className="mb-3 min-w-0 rounded-r-lg border-l-4 border-primary bg-slate-50 px-3 py-2.5">
          <div className="flex flex-wrap items-center gap-2"><h2 className="text-base font-semibold leading-5 text-slate-950">{title}</h2>{optional && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">Optional</span>}</div>
          {description && (
            <p className="mt-1 text-xs leading-5 text-slate-500">{description}</p>
          )}
      </div>
      {children}
    </section>
  );
}

export default function KitchenDesignPage() {
  const [state, setState] = useState<KitchenDesignState>(initialState);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const saved = JSON.parse(raw);
        if (
          saved.version === 2 &&
          saved.state &&
          Array.isArray(saved.state.selectedAreas) &&
          Array.isArray(saved.state.generationResults)
        ) {
          const savedState = { ...saved.state };
          delete savedState.numberOfImages;
          delete savedState.imageQuality;
          delete savedState.preservationSettings;
          delete savedState.customStyle;
          const savedScope = savedState.designScope || savedState.renovationScope || "";
          delete savedState.renovationScope;
          setState({
            ...initialState,
            ...savedState,
            designStyle: savedState.designStyle === "Custom" ? "" : savedState.designStyle,
            designScope: scopeMigrations[savedScope] || savedScope,
            materialPreferences: migrateMaterialPreferences(savedState.materialPreferences),
            generationHistory: Array.isArray(savedState.generationHistory)
              ? savedState.generationHistory
              : [],
          });
        }
      }
    } catch {
      // Browser storage is optional; start with a clean form if it cannot be read.
    }
    setReady(true);

    return () => {
      controller.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const timer = window.setTimeout(() => {
      try {
        const hasLocalUpload = state.originalImage?.url.startsWith("data:");
        const persistableState: KitchenDesignState = {
          ...state,
          originalImage: hasLocalUpload ? null : state.originalImage,
          generationHistory: state.generationHistory.slice(0, 12),
        };
        localStorage.setItem(
          storageKey,
          JSON.stringify({ version: 2, state: persistableState })
        );
      } catch {
        // Keep the current session usable when browser storage is unavailable.
      }
    }, 500);
    return () => window.clearTimeout(timer);
  }, [state, ready]);

  const update = (patch: Partial<KitchenDesignState>) =>
    setState((previous) => ({ ...previous, ...patch }));

  function validate() {
    if (!state.originalImage) {
      return "Upload a kitchen photo or choose a sample kitchen before generating.";
    }
    if (!state.designScope) {
      return "Choose a design scope before generating.";
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
      const summary = `${style} · ${state.designScope}`;
      const snapshot = JSON.stringify({
        originalImage: state.originalImage
          ? { name: state.originalImage.name }
          : null,
        designScope: state.designScope,
        designStyle: state.designStyle,
        selectedAreas: state.selectedAreas,
        materialPreferences: state.materialPreferences,
        customPreferences: state.customPreferences,
        generatedAt,
      });

      setState((previous) => ({
        ...previous,
        generationResults: results,
        favoriteId: null,
        generationSnapshot: snapshot,
        generationHistory: [
          {
            id: crypto.randomUUID(),
            createdAt: generatedAt,
            results,
            summary,
          },
          ...previous.generationHistory,
        ].slice(0, 12),
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
                  <ImageIcon size={18} className="text-primary" /> Kitchen Design
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
                title="Design Scope"
              >
                <ScopeSelector state={state} update={update} />
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

              {error && (
                <div className="border-t border-slate-200 py-6">
                  <p
                    role="alert"
                    className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                  >
                    {error}
                  </p>
                </div>
              )}
            </div>

            <div className="shrink-0 border-t border-slate-200 bg-white p-6 sm:p-7">
              <div className="mb-4 text-base font-semibold text-slate-950">Generate & Refine</div>
              {busy ? (
                <Button
                  size="lg"
                  variant="outline"
                  className="h-14 w-full text-base"
                  onClick={() => controller.current?.abort()}
                >
                  <Loader2 className="animate-spin" /> Cancel generation
                </Button>
              ) : (
                <Button
                  size="lg"
                  className="h-14 w-full text-base"
                  onClick={() => void generate()}
                >
                  <Sparkles /> Generate Design
                </Button>
              )}
            </div>
          </aside>

          <div className="min-w-0 lg:sticky lg:top-5">
            <KitchenDesignResults
              state={state}
              update={update}
              busy={busy}
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

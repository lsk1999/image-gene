"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Coins, Gift, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSession, signIn } from "next-auth/react";
import { Link, useRouter } from "@/i18n/navigation";
import { useAppContext } from "@/contexts/app";
import { isAuthEnabled, isGoogleAuthEnabled } from "@/lib/auth";
import { initialState, KITCHEN_DESIGN_CREDIT_COST, type KitchenDesignState } from "./data";
import {
  AreasSelector,
  AdditionalRequirements,
  FurniturePreservation,
  StyleSelector,
} from "./selectors";
import { UploadKitchenPhoto } from "./upload";
import { KitchenDesignResults } from "./results";
import { generateKitchenDesign, KitchenRequestError } from "./api";
import { getDesignParameters, loadDraft, saveDraft, saveRedirectDraft, takeRedirectDraft } from "./draft";

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
  const [readingPhoto, setReadingPhoto] = useState(false);
  const [authPrompt, setAuthPrompt] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const lastGeneration = useRef<{ photo: KitchenDesignState["originalImage"]; settings: string; id: string } | null>(null);
  const redirectDraft = useRef<ReturnType<typeof takeRedirectDraft> | null>(null);
  const router = useRouter();
  const { user, setUser, authStatus } = useAppContext();
  const creditsReady =
    isAuthEnabled() &&
    authStatus !== "loading" &&
    (authStatus !== "authenticated" || Boolean(user?.credits));
  const leftCredits = user?.credits?.left_credits ?? 0;
  const outOfCredits =
    authStatus === "authenticated" && Boolean(user?.credits) && leftCredits < KITCHEN_DESIGN_CREDIT_COST;
  const { keepExistingFurniture, designStyle, selectedAreas, materialPreferences, customPreferences } = state;
  const draft = useMemo(() => ({ keepExistingFurniture, designStyle, selectedAreas, materialPreferences, customPreferences }),
    [keepExistingFurniture, designStyle, selectedAreas, materialPreferences, customPreferences]);

  useEffect(() => {
    let active = true;
    redirectDraft.current ??= takeRedirectDraft();
    void redirectDraft.current.then((restored) => {
      if (!active) return;
      setState(previous => ({
        ...previous,
        ...loadDraft(),
        ...(previous.originalImage ? {} : restored),
      }));
      setReady(true);
    });
    return () => {
      active = false;
      controller.current?.abort();
    };
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
    if (readingPhoto) return "Reading your photo. Please wait.";
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

  const validationMessage = validate();

  async function handleAccess(status: number) {
    if (status !== 401 && status !== 402) return false;
    if (status === 401 && (!isAuthEnabled() || !isGoogleAuthEnabled())) {
      throw new Error("Google sign-in is currently unavailable.");
    }
    try {
      await saveRedirectDraft(state);
    } catch {
      throw new Error("Could not keep your photo across pages. Allow site storage and try again.");
    }
    if (status === 402) router.push("/pricing");
    else await signIn("google", { redirectTo: window.location.href });
    return true;
  }

  async function refreshCredits() {
    try {
      const resp = await fetch("/api/get-user-info", { method: "POST" });
      if (!resp.ok) return;
      const { code, data } = await resp.json();
      if (code === 0 && data) setUser(data);
    } catch {
      // keep the current balance if the refresh fails
    }
  }

  async function startSignIn() {
    if (authStatus === "loading") return;
    if (!isGoogleAuthEnabled()) {
      setError("Google sign-in is currently unavailable.");
      return;
    }
    setError("");
    try {
      await saveRedirectDraft(state);
    } catch {
      setError("Could not keep your photo across pages. Allow site storage and try again.");
      return;
    }
    await signIn("google", { redirectTo: window.location.href });
  }

  async function generate() {
    if (!ready || controller.current || refining) return;
    if (validationMessage) {
      setError(validationMessage);
      return;
    }

    setError("");
    const abort = new AbortController();
    controller.current = abort;

    try {
      const session = isAuthEnabled() ? await getSession() : null;
      if (!session?.user?.uuid) {
        // Do not jump to Google automatically; prompt in place instead.
        setAuthPrompt(true);
        return;
      }
      setBusy(true);
      const parameters = getDesignParameters(state);
      const settings = JSON.stringify(parameters);
      const previous = lastGeneration.current;
      const requestId = previous && previous.photo === state.originalImage && previous.settings === settings
        ? previous.id
        : crypto.randomUUID();
      lastGeneration.current = { photo: state.originalImage, settings, id: requestId };
      let results: KitchenDesignState["generationResults"];
      try {
        results = await generateKitchenDesign(state, abort.signal, requestId);
      } catch (failure) {
        if (!(failure instanceof KitchenRequestError) || failure.status !== 422) throw failure;
        const retryId = crypto.randomUUID();
        lastGeneration.current = { photo: state.originalImage, settings, id: retryId };
        results = await generateKitchenDesign(state, abort.signal, retryId);
      }
      lastGeneration.current = null;
      const generatedAt = new Date().toISOString();
      const style = state.designStyle;
      const summary = style;

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
          ...previous.generationHistory.filter((item) => item.id !== results[0].id),
        ].slice(0, 50),
      }));
    } catch (failure) {
      if (failure instanceof KitchenRequestError && failure.status === 401 && !abort.signal.aborted) {
        setAuthPrompt(true);
        return;
      }
      if (failure instanceof KitchenRequestError && failure.status === 402 && !abort.signal.aborted) {
        router.push("/pricing");
        return;
      }
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
      void refreshCredits();
    }
  }

  return (
    <div className="min-h-screen bg-slate-50/70 text-slate-900">
      <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="grid items-start gap-6 lg:grid-cols-[440px_minmax(0,1fr)] xl:grid-cols-[500px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-2xl border border-slate-200 bg-white lg:sticky lg:top-28 lg:flex lg:h-[calc(100dvh-180px)] lg:min-h-[680px] lg:flex-col">
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
                  reading={readingPhoto}
                  onReadingChange={setReadingPhoto}
                  locked={busy}
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
              <div className="mb-3 flex items-center justify-between gap-3">
                <div className="text-base font-semibold text-slate-950">Generate</div>
                {creditsReady && (
                  <Link
                    href="/pricing"
                    title="Buy more credits"
                    className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium leading-none text-slate-600 transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-slate-900"
                  >
                    <Coins aria-hidden="true" className="size-3.5 text-primary" />
                    <span className="text-sm font-semibold tabular-nums">{leftCredits}</span>
                    <span className="text-slate-400">credits left</span>
                    <span aria-hidden="true" className="ml-0.5 font-semibold text-primary">+</span>
                  </Link>
                )}
              </div>
              {isAuthEnabled() && authStatus === "unauthenticated" && (
                <div
                  aria-live="polite"
                  className={`mb-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border px-3 py-2.5 leading-5 ${authPrompt ? "border-primary/40 bg-primary/10 text-slate-700 shadow-sm" : "border-primary/20 bg-primary/5 text-slate-600"}`}
                >
                  <Gift aria-hidden="true" className={`shrink-0 text-primary ${authPrompt ? "size-4" : "size-3.5"}`} />
                  <div className="min-w-0 flex-1 text-xs">
                    {authPrompt ? (
                      <>
                        <p className="text-sm font-semibold text-slate-900">Sign in to generate your design</p>
                        <p className="mt-0.5">Free credits are added automatically after you sign in with Google.</p>
                      </>
                    ) : (
                      <p>Sign in with Google to get your free design credits.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => void startSignIn()}
                    className={`shrink-0 rounded-full bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90 ${authPrompt ? "px-3.5 py-2 text-sm" : "px-3 py-1.5 text-xs"}`}
                  >
                    Sign in
                  </button>
                </div>
              )}
              {outOfCredits && (
                <p className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                  <span>You need {KITCHEN_DESIGN_CREDIT_COST} credit to generate.</span>
                  <Link href="/pricing" className="font-semibold text-primary underline underline-offset-2">Get more credits</Link>
                </p>
              )}
              <Button
                type="button"
                size="lg"
                className="h-14 w-full text-base"
                disabled={!ready || busy || refining || outOfCredits || Boolean(validationMessage)}
                aria-describedby={ready && !busy && !refining && validationMessage ? "kitchen-generate-hint" : undefined}
                onClick={() => void generate()}
              >
                <Loader2 aria-hidden="true" className={busy ? "motion-safe:animate-spin" : "hidden"} />
                <Sparkles aria-hidden="true" className={busy ? "hidden" : undefined} />
                <span className={busy ? "inline" : "hidden"}>Generating design…</span>
                <span className={busy ? "hidden" : "inline"}>Generate Design · {KITCHEN_DESIGN_CREDIT_COST} credit</span>
              </Button>
              {ready && !busy && !refining && validationMessage && (
                <p id="kitchen-generate-hint" className="mt-2 text-xs leading-5 text-slate-600">{validationMessage}</p>
              )}
            </div>
          </aside>

          <div className="min-w-0">
            <KitchenDesignResults
              state={state}
              update={update}
              busy={busy}
              refining={refining}
              readingPhoto={readingPhoto}
              onRefiningChange={setRefining}
              onRefinementSaved={saveRefinement}
              onError={setError}
              onAccessRequired={handleAccess}
            />
          </div>
        </div>

        <div className="mx-auto max-w-3xl py-14 text-center sm:py-16">
          <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            AI Kitchen Design
          </h1>
          <p className="mt-4 text-sm leading-7 text-slate-500 sm:text-base">
            Upload a kitchen photo, choose a style and materials, and generate an AI concept for your space.
          </p>
        </div>
      </div>
    </div>
  );
}

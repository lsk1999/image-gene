import type { Metadata } from "next";
import { kitchenModelName } from "@/services/kitchen-replicate";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "AI models and safety | AI Kitchen Design",
};

export default function Page() {
  const model = kitchenModelName();
  return (
    <article className="container max-w-3xl py-20 leading-8 text-slate-700">
      <h1 className="mb-8 text-4xl font-semibold text-slate-950">
        AI models and safety
      </h1>
      <p>
        AI Kitchen Design is an independent kitchen visualization service.
        Kitchen concepts are AI-generated images, not construction plans or
        guaranteed measurements.
      </p>
      <h2 className="mb-3 mt-9 text-2xl font-semibold text-slate-950">
        Kitchen image generation
      </h2>
      <p>
        The currently configured image model is <strong>{model}</strong>,
        accessed through Replicate. Initial designs and refinements use this
        model. Model names identify the technology used; they do not imply that
        we are an official product of, or endorsed by, the model provider.
      </p>
      <h2 className="mb-3 mt-9 text-2xl font-semibold text-slate-950">
        Content safety
      </h2>
      <p>
        With the Waffo integration enabled, Waffo Prompt Sift screens design
        instructions before generation. Uploaded photos and generated results
        are not scanned by a separate image moderation service. The generation
        model retains its provider-managed safety controls. These controls do
        not replace an independent output review. Please follow our{" "}
        <a href="/acceptable-use-policy" className="underline">
          Acceptable Use Policy
        </a>
        .
      </p>
      <p className="mt-6">
        Questions or reports:{" "}
        <a href="mailto:support@aidesignkitchen.com" className="underline">
          support@aidesignkitchen.com
        </a>
        .
      </p>
    </article>
  );
}

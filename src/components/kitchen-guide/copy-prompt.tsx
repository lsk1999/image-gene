"use client";
import { Check, Copy } from "lucide-react";
import { useState } from "react";

export default function CopyPrompt({ text }: { text: string }) {
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  return <div><button type="button" onClick={async () => {
    try { await navigator.clipboard.writeText(text); setStatus("copied"); }
    catch { setStatus("error"); }
  }} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-emerald-900/20 bg-white px-4 text-sm font-semibold text-emerald-950 hover:bg-emerald-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-800">
    {status === "copied" ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{status === "copied" ? "Copy again" : "Copy prompt"}
  </button><span role="status" className="ml-3 text-xs text-slate-600">{status === "copied" ? "Copied to clipboard." : status === "error" ? "Select the prompt text above and copy it manually." : ""}</span></div>;
}

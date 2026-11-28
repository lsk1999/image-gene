import type { Metadata } from "next";

// Only the four explicitly opted-in English pages may be indexed.
// All other pages inherit noindex from the root layout.
export function publicPageRobots(locale: string): Metadata["robots"] {
  const index = locale === "en";
  return { index, follow: true, googleBot: { index, follow: true } };
}

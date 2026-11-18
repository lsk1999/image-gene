"use client";

import { GoogleTagManager as NextGoogleTagManager } from "@next/third-parties/google";

const GOOGLE_TAG_MANAGER_ID = "GTM-M59T358N";

export default function GoogleTagManager() {
  if (process.env.NODE_ENV !== "production") {
    return null;
  }

  return <NextGoogleTagManager gtmId={GOOGLE_TAG_MANAGER_ID} />;
}

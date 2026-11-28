import "@/app/globals.css";

import { getLocale, setRequestLocale } from "next-intl/server";
import type { Metadata } from "next";

// Default-deny indexing. Only the four public landing pages opt in locally.
export const metadata: Metadata = {
  robots: { index: false, follow: true, googleBot: { index: false, follow: true } },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  setRequestLocale(locale);

  const googleAdsenseCode = process.env.NEXT_PUBLIC_GOOGLE_ADCODE || "";

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        {googleAdsenseCode && (
          <meta name="google-adsense-account" content={googleAdsenseCode} />
        )}

        <link rel="icon" type="image/png" sizes="48x48" href="/imgs/seo/favicon-48.png" />
        <link rel="icon" type="image/png" sizes="96x96" href="/imgs/seo/favicon-96.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/imgs/seo/favicon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" sizes="180x180" href="/imgs/seo/apple-touch-icon.png" />

      </head>
      <body>{children}</body>
    </html>
  );
}

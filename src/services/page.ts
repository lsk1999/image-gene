import { LandingPage, PricingPage, ShowcasePage } from "@/types/pages/landing";

// Keep import paths literal so both Turbopack and production bundlers can
// discover every page JSON without resolving a dynamic alias pattern.
const pageLoaders: Record<string, Record<string, () => Promise<unknown>>> = {
  landing: {
    en: () => import("@/i18n/pages/landing/en.json").then(module => module.default),
    zh: () => import("@/i18n/pages/landing/zh.json").then(module => module.default),
  },
  pricing: {
    en: () => import("@/i18n/pages/pricing/en.json").then(module => module.default),
    zh: () => import("@/i18n/pages/pricing/zh.json").then(module => module.default),
  },
  showcase: {
    en: () => import("@/i18n/pages/showcase/en.json").then(module => module.default),
    zh: () => import("@/i18n/pages/showcase/zh.json").then(module => module.default),
  },
};

export async function getLandingPage(locale: string): Promise<LandingPage> {
  return (await getPage("landing", locale)) as LandingPage;
}

export async function getPricingPage(locale: string): Promise<PricingPage> {
  return (await getPage("pricing", locale)) as PricingPage;
}

export async function getShowcasePage(locale: string): Promise<ShowcasePage> {
  return (await getPage("showcase", locale)) as ShowcasePage;
}

export async function getPage(
  name: string,
  locale: string
): Promise<LandingPage | PricingPage | ShowcasePage> {
  if (!Object.hasOwn(pageLoaders, name)) {
    throw new Error(`Unknown page: ${name}`);
  }
  const loaders = pageLoaders[name];
  const normalizedLocale = locale.toLowerCase() === "zh-cn" ? "zh" : locale.toLowerCase();
  const load = Object.hasOwn(loaders, normalizedLocale) ? loaders[normalizedLocale] : loaders.en;

  try {
    return await load() as LandingPage | PricingPage | ShowcasePage;
  } catch (error) {
    if (load === loaders.en) throw error;
    console.warn(`Failed to load ${locale}.json, falling back to en.json`);
    return await loaders.en() as LandingPage | PricingPage | ShowcasePage;
  }
}

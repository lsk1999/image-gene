import { areas, furnitureSetting, restoreCustomPreferences, styles, type KitchenDesignState } from "./data";

const key = "shipany-kitchen-design-draft";
const legacyKey = "shipany-kitchen-design-v2";

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
export type DesignParameters = NonNullable<KitchenDesignState["generationHistory"][number]["parameters"]>;

export function getDesignParameters(state: DesignParameters): DesignParameters {
  return {
    keepExistingFurniture: state.keepExistingFurniture,
    designStyle: state.designStyle,
    selectedAreas: state.selectedAreas,
    materialPreferences: state.materialPreferences,
    customPreferences: state.customPreferences,
  };
}

function normalizeDraft(value: unknown): Partial<DesignParameters> {
  if (!value || typeof value !== "object") return {};
  const source = value as Record<string, unknown>;
  const selectedAreas = Array.isArray(source.selectedAreas)
    ? Array.from(new Set(source.selectedAreas.filter((area): area is string => typeof area === "string" && Object.hasOwn(areas, area))))
    : [];
  const materialPreferences: DesignParameters["materialPreferences"] = {};
  const preferences = source.materialPreferences;
  if (preferences && typeof preferences === "object") {
    for (const [area, entry] of Object.entries(preferences)) {
      if (!Object.hasOwn(areas, area) || !entry || typeof entry !== "object") continue;
      const candidate = entry as Record<string, unknown>;
      if (typeof candidate.value !== "string") continue;
      const value = materialPreferenceMigrations[area]?.[candidate.value] || candidate.value;
      if (!["Keep original", "Custom", ...areas[area].options].includes(value)) continue;
      materialPreferences[area] = { value, custom: typeof candidate.custom === "string" ? candidate.custom.slice(0, 1000) : "" };
    }
  }
  const legacyScope = source.designScope ?? source.renovationScope;
  return {
    keepExistingFurniture: furnitureSetting(source.keepExistingFurniture, legacyScope),
    designStyle: styles.some(style => style.name === source.designStyle) ? source.designStyle as string : "",
    selectedAreas,
    materialPreferences,
    customPreferences: restoreCustomPreferences(source.customPreferences, source.layoutGoal, legacyScope),
  };
}

export function loadDraft(): Partial<DesignParameters> {
  try {
    const raw = localStorage.getItem(key);
    // Custom preferences are intentionally not restored from saved drafts:
    // the field must always start empty, never show a previous request.
    if (raw) return { ...normalizeDraft(JSON.parse(raw)), customPreferences: "" };
    const legacy = localStorage.getItem(legacyKey);
    if (!legacy) return {};
    const saved = JSON.parse(legacy);
    const parameters = { ...normalizeDraft(saved?.state), customPreferences: "" };
    localStorage.setItem(key, JSON.stringify(parameters));
    // Remove obsolete image/history caches only after the new draft is saved.
    localStorage.removeItem(legacyKey);
    return parameters;
  } catch {
    return {};
  }
}

export function saveDraft(state: DesignParameters) {
  try {
    localStorage.setItem(key, JSON.stringify(getDesignParameters(state)));
  } catch {
    // Saving a draft is optional; the active session remains usable.
  }
}

const redirectDraftKey = "kitchen-design-redirect-draft";

function openRedirectDraft(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(redirectDraftKey, 1);
    request.onupgradeneeded = () => request.result.createObjectStore("photos");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error("Photo storage is blocked."));
  });
}

export async function saveRedirectDraft(state: KitchenDesignState) {
  saveDraft(state);
  if (!state.originalImage) return;
  const id = sessionStorage.getItem(redirectDraftKey) || crypto.randomUUID();
  const database = await openRedirectDraft();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction("photos", "readwrite");
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error);
      const store = tx.objectStore("photos");
      const now = Date.now();
      const expired = store.openCursor();
      expired.onsuccess = () => {
        const cursor = expired.result;
        if (!cursor) return;
        if (cursor.value.expiresAt <= now) cursor.delete();
        cursor.continue();
      };
      store.put({
        photo: state.originalImage,
        parameters: getDesignParameters(state),
        expiresAt: now + 60 * 60_000,
      }, id);
    });
    sessionStorage.setItem(redirectDraftKey, id);
  } finally {
    database.close();
  }
}

export async function takeRedirectDraft(): Promise<Partial<KitchenDesignState>> {
  try {
    const id = sessionStorage.getItem(redirectDraftKey);
    if (!id) return {};
    const database = await openRedirectDraft();
    try {
      const saved = await new Promise<{ photo: KitchenDesignState["originalImage"]; parameters: DesignParameters; expiresAt: number } | undefined>((resolve, reject) => {
        const tx = database.transaction("photos", "readwrite");
        const store = tx.objectStore("photos");
        const request = store.get(id);
        store.delete(id);
        tx.oncomplete = () => resolve(request.result);
        tx.onabort = () => reject(tx.error);
      });
      sessionStorage.removeItem(redirectDraftKey);
      return saved && saved.expiresAt > Date.now()
        ? { ...normalizeDraft(saved.parameters), originalImage: saved.photo }
        : {};
    } finally {
      database.close();
    }
  } catch {
    return {};
  }
}

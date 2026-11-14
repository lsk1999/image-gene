export const scopes = [
  {
    name: "Visual Refresh",
    description:
      "Update colors, finishes, hardware, and styling while keeping the existing layout and main kitchen elements.",
  },
  {
    name: "Selected Areas",
    description:
      "Redesign only the parts you choose, such as cabinets, countertops, backsplash, lighting, sink, or appliances.",
  },
  {
    name: "Complete Design",
    description:
      "Design the whole kitchen from scratch or fully rethink an existing one, including its layout, cabinetry, island, and appliance placement.",
  },
];
export const styles = [
  { name: "Modern", description: "Rooted in 20th-century modernism: simple geometric forms, little applied ornament, flat surfaces, and functional layouts.", image: "/imgs/kitchen-styles/modern.png", alt: "Bright modern kitchen with streamlined cabinetry, neutral finishes, and abundant natural light" },
  { name: "Contemporary", description: "A present-day style rather than a fixed historical period, typically using clean lines, open space, mixed materials, and current finishes.", image: "/imgs/kitchen-styles/contemporary.png", alt: "Contemporary kitchen with sculptural lighting, marble surfaces, and warm refined finishes" },
  { name: "Minimalist", description: "Reduced forms, limited visual clutter, restrained color, and integrated storage that keeps work surfaces clear.", image: "/imgs/kitchen-styles/minimalist.jpg", alt: "Minimalist kitchen with clean white cabinetry, a central island, and an uncluttered layout" },
  { name: "Scandinavian", description: "Functional simplicity with light neutral colors, natural wood, practical details, and an emphasis on daylight.", image: "/imgs/kitchen-styles/scandinavian.jpg", alt: "Airy Scandinavian kitchen with pale colors, natural materials, and simple functional decor" },
  { name: "Japandi", description: "A blend of Japanese and Scandinavian design, combining minimal forms, natural materials, muted colors, texture, and visible craftsmanship.", image: "/imgs/kitchen-styles/japandi.jpg", alt: "Japandi kitchen combining warm wood, natural stone, soft neutral colors, and restrained details" },
  { name: "Modern Farmhouse", description: "Farmhouse features such as Shaker cabinetry, apron-front sinks, natural wood, and simple tile updated with cleaner lines and modern fixtures.", image: "/imgs/kitchen-styles/modern-farmhouse.jpg", alt: "Modern farmhouse kitchen with white cabinetry, subway tile, and warm open wood shelves" },
  { name: "Traditional", description: "Classic cabinet profiles, decorative millwork, balanced composition, substantial hardware, and familiar materials such as wood and stone.", image: "/imgs/kitchen-styles/traditional.jpg", alt: "Elegant traditional kitchen with detailed white cabinetry, wood flooring, and a generous island" },
  { name: "Transitional", description: "Traditional cabinet forms and subtle detailing combined with contemporary colors, hardware, lighting, and cleaner lines.", image: "/imgs/kitchen-styles/transitional.jpg", alt: "Transitional kitchen balancing classic cabinet profiles with restrained modern finishes" },
  { name: "Rustic", description: "A material-led style using visibly grained or reclaimed wood, stone, aged finishes, and handcrafted details.", image: "/imgs/kitchen-styles/rustic.jpg", alt: "Inviting rustic kitchen with natural timber cabinetry, warm textures, and soft daylight" },
  { name: "Industrial", description: "Inspired by factories and lofts, with exposed brick or structure, metal, concrete, open shelving, and utilitarian fixtures.", image: "/imgs/kitchen-styles/industrial.png", alt: "Industrial kitchen with exposed brick, crisp cabinetry, metal details, and loft character" },
  { name: "Mediterranean", description: "Draws from Southern European interiors through textured plaster, terracotta or patterned tile, natural stone, warm wood, and earthy colors.", image: "/imgs/kitchen-styles/mediterranean.jpg", alt: "Mediterranean kitchen with textured plaster, stone worktops, open shelves, pottery, and warm sunlight" },
  { name: "Coastal", description: "Light, airy interiors using white, sand, pale blue, light wood, and natural textures; it does not require nautical-themed decoration.", image: "/imgs/kitchen-styles/coastal.jpg", alt: "Sun-filled coastal kitchen with white cabinetry, natural wood accents, and a relaxed airy palette" },
  { name: "Mid-Century Modern", description: "Based on mid-20th-century design, with clean geometric lines, warm wood, minimal ornament, and occasional organic forms or period color.", image: "/imgs/kitchen-styles/mid-century-modern.jpg", alt: "Mid-century modern kitchen with warm wood, period cabinetry, and distinctive retro color" },
  { name: "French Country", description: "Inspired by rural French homes, using traditional cabinet shapes, muted warm colors, natural materials, aged finishes, and restrained ornament.", image: "/imgs/kitchen-styles/french-country.jpg", alt: "French country kitchen with collected furnishings, open shelves, warm wood, and lived-in charm" },
  { name: "Luxury", description: "A finish level rather than a historical style: custom cabinetry, premium stone or wood, integrated appliances, precise detailing, and layered lighting.", image: "/imgs/kitchen-styles/luxury.jpg", alt: "Luxury kitchen with richly veined marble, tailored wood cabinetry, and warm architectural lighting" },
  { name: "Organic Modern", description: "A contemporary direction pairing simple modern forms with natural wood, stone, earthy colors, daylight, and softly curved elements.", image: "/imgs/kitchen-styles/organic-modern.jpg", alt: "Organic modern kitchen with natural wood, calm stone tones, clean lines, and an open city view" },
  { name: "Dark & Moody", description: "A color and atmosphere direction rather than a historical style, using deep finishes, low contrast, layered lighting, and dark stone or metal accents.", image: "/imgs/kitchen-styles/dark-moody.jpg", alt: "Dark moody kitchen with deep cabinetry, warm metallic accents, and dramatic layered lighting" },
  { name: "Eclectic", description: "A deliberate combination of periods, colors, patterns, and materials, unified by repeated colors, shapes, or proportions rather than one strict style.", image: "/imgs/kitchen-styles/eclectic.jpg", alt: "Eclectic kitchen with expressive green cabinetry, mixed materials, and character-rich details" },
];
export const areas: Record<string, { description: string; options: string[] }> = {
  Cabinets: {
    description: "Cabinet finish or color.",
    options: ["White Painted MDF", "Natural Oak", "Walnut Veneer", "Textured Laminate", "Matte Black", "Navy Painted", "Sage Green Painted"],
  },
  Countertops: {
    description: "Main worktop material.",
    options: ["Engineered Quartz", "Quartzite", "Marble", "Granite", "Porcelain Slab", "Butcher Block", "Concrete"],
  },
  Backsplash: {
    description: "Finish behind the countertop.",
    options: ["Ceramic Subway Tile", "Zellige Tile", "Porcelain Slab", "Marble Slab", "Glass Mosaic", "Natural Stone Tile"],
  },
  Flooring: {
    description: "Kitchen floor finish.",
    options: ["Engineered Hardwood", "Porcelain Tile", "Natural Stone", "Terrazzo", "Luxury Vinyl Plank", "Microcement"],
  },
  "Kitchen Island": {
    description: "Island layout or finish.",
    options: ["No Island", "Compact Island", "Island with Seating", "Waterfall Stone Edge", "Contrasting Cabinet Finish", "Butcher Block Top"],
  },
  Lighting: {
    description: "Fixtures and lighting layers.",
    options: ["Pendant Lights", "Recessed Downlights", "Under-cabinet LED", "Track Lighting", "Wall Sconces", "Warm Layered Lighting"],
  },
  "Sink & Faucet": {
    description: "Sink material or faucet finish.",
    options: ["Stainless Steel Undermount", "Fireclay Apron-front", "Enameled Cast Iron", "Granite Composite", "Brushed Nickel Faucet", "Brushed Brass Faucet", "Matte Black Faucet"],
  },
  Appliances: {
    description: "Appliance front finish.",
    options: ["Panel-ready Integrated", "Stainless Steel", "Black Stainless Steel", "Matte Black", "Matte White", "Retro Style"],
  },
};
export interface KitchenDesignState {
  originalImage: { url: string; name: string } | null;
  designScope: string;
  designStyle: string;
  selectedAreas: string[];
  materialPreferences: Record<string, { value: string; custom: string }>;
  customPreferences: string;
  generationResults: { id: string; url: string }[];
  favoriteId: string | null;
  generationHistory: {
    id: string;
    createdAt: string;
    results: { id: string; url: string }[];
    summary: string;
    originalImage?: { url: string; name: string };
    parameters?: Pick<KitchenDesignState, "designScope" | "designStyle" | "selectedAreas" | "materialPreferences" | "customPreferences">;
  }[];
}
export const initialState: KitchenDesignState = {
  originalImage: null, designScope: "", designStyle: "",
  selectedAreas: [], materialPreferences: {},
  customPreferences: "", generationResults: [], favoriteId: null,
  generationHistory: [],
};

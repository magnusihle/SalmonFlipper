export type CutId =
  | 'head'
  | 'cheek'
  | 'collar'
  | 'upperFillet'
  | 'loin'
  | 'fillet'
  | 'steak'
  | 'tail'
  | 'belly'
  | 'toro'
  | 'spine'

export interface CutInfo {
  id: CutId
  name: string
  sub?: string
  blurb: string
  bestFor: string[]
  /** 1–5, how fatty / rich the cut is */
  richness: number
  /** where the label sits in the legend row, left → right */
  order: number
  /** product codes in the deboning graph this piece ends up in, most relevant first */
  products: string[]
  /** how the plant treats this piece */
  plant: string
}

export const CUTS: Record<CutId, CutInfo> = {
  head: {
    id: 'head',
    name: 'Head',
    blurb:
      'Bony, collagen-rich and full of flavour. Simmered for stock, or split and roasted whole the Japanese way.',
    bestFor: ['Stock & broth', 'Roast whole', 'Kabutoyaki'],
    richness: 3,
    order: 0,
    products: ['HEAD', 'HOG'],
    plant: 'Comes off at heading — 11% of every head-on gutted fish. Sold whole on the fish when the order is HOG.',
  },
  cheek: {
    id: 'cheek',
    name: 'Cheek',
    blurb:
      'A tiny medallion just behind the eye. Tender, sweet, and famously the chef’s treat — two per fish.',
    bestFor: ['Pan-sear', 'Confit'],
    richness: 3,
    order: 1,
    products: ['HEAD'],
    plant: 'The plant does not cut cheeks; they leave with the head at heading.',
  },
  collar: {
    id: 'collar',
    name: 'Collar',
    sub: 'Kama',
    blurb:
      'The strip behind the gills that carries the pectoral fin. Fatty, gelatinous and impossible to overcook.',
    bestFor: ['Grill', 'Broil with salt', 'Shio-yaki'],
    richness: 5,
    order: 2,
    products: ['FRAME', 'HEADLESS'],
    plant: 'Stays on the frame when the fillets are lifted — it is not a product of its own in the cut pattern.',
  },
  upperFillet: {
    id: 'upperFillet',
    name: 'Upper Fillet',
    blurb:
      'The thick shoulder block. Even in shape, lean but not dry — the piece that cuts cleanest for sashimi.',
    bestFor: ['Sashimi', 'Slow roast', 'Cure'],
    richness: 3,
    order: 3,
    products: ['FILLET_A', 'TRIM_C', 'TRIM_D'],
    plant: 'The front of the Trim A fillet. Trimming to C or D keeps it skin-on and pin-bone-out.',
  },
  loin: {
    id: 'loin',
    name: 'Loin',
    blurb:
      'The prime centre cut. Uniform thickness means it cooks evenly — the restaurant portion.',
    bestFor: ['Pan-roast', 'Sous vide', 'Cure'],
    richness: 3,
    order: 4,
    products: ['TRIM_D', 'PORTION_E', 'TRIM_C'],
    plant: 'The centre of the fillet is where portions are cut from — the Trim E → portion line.',
  },
  fillet: {
    id: 'fillet',
    name: 'Fillet',
    blurb:
      'The tapering back half. Thinner and leaner than the loin, so it takes heat quickly and smoke beautifully.',
    bestFor: ['Poach', 'Hot smoke', 'Pan-fry'],
    richness: 2,
    order: 5,
    products: ['TRIM_E', 'PORTION_E', 'TRIM_C'],
    plant: 'Skinless Trim E is the fillet with the skin taken off; the skin becomes its own by-product.',
  },
  steak: {
    id: 'steak',
    name: 'Steak',
    blurb:
      'A bone-in cross-section through the whole fish. The spine keeps it juicy on the grill and the skin holds it together.',
    bestFor: ['Grill', 'Griddle', 'Bake'],
    richness: 3,
    order: 6,
    products: ['HEADLESS'],
    plant: 'Cut straight across the head-off gutted fish, before filleting — so it bypasses the fillet table.',
  },
  tail: {
    id: 'tail',
    name: 'Tail',
    blurb:
      'Thin, muscular and lean — the fish did a lot of swimming with this. Quick heat or a long cure.',
    bestFor: ['Gravlax', 'Grill', 'Fish cakes'],
    richness: 1,
    order: 7,
    products: ['MINCE', 'TRIM_E'],
    plant: 'The thin tail end is trimmed off and goes to mince — the residual sink of the pattern.',
  },
  belly: {
    id: 'belly',
    name: 'Belly',
    blurb:
      'The thin flap along the underside, streaked with fat. Crisps like bacon under a broiler.',
    bestFor: ['Broil', 'Tare glaze', 'Skewers'],
    richness: 5,
    order: 8,
    products: ['BELLY_FLAP'],
    plant: 'Comes off at trimming: 7% of the fillet on the C pattern, 9% on D and E — the if/or yield.',
  },
  toro: {
    id: 'toro',
    name: 'Belly',
    sub: 'Toro',
    blurb:
      'The richest slice of the belly. Buttery, marbled and melts at body temperature — serve it raw.',
    bestFor: ['Sashimi', 'Nigiri', 'Aburi'],
    richness: 5,
    order: 9,
    products: ['BELLY_FLAP', 'TRIM_C'],
    plant: 'On the C trim the belly stays on the fillet; on D and E it is trimmed into the belly flap.',
  },
  spine: {
    id: 'spine',
    name: 'Spine',
    blurb:
      'Bones, and the sweet scraped meat between them (nakaochi). Roast for crackling or simmer for dashi.',
    bestFor: ['Dashi', 'Roast crisp', 'Nakaochi'],
    richness: 2,
    order: 10,
    products: ['FRAME'],
    plant: 'The frame: 18% of the head-off fish after the fillets are lifted.',
  },
}

export const CUT_ORDER: CutId[] = (Object.values(CUTS) as CutInfo[])
  .sort((a, b) => a.order - b.order)
  .map((c) => c.id)

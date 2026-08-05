export interface CardVariantDto {
  condition: string;
  printing: string;
  language: string | null;
  tcgplayerSkuId?: string;
  price: number | null;
  lastUpdated: number | null;
  priceChange24hr?: number | null;
  priceChange7d?: number | null;
}

export interface CardDto {
  id: string;
  uuid: string;
  name: string;
  game: string;
  set: string;
  setName?: string;
  number: string | null;
  rarity: string | null;
  tcgplayerId: string | null;
  variants: CardVariantDto[];
}

export interface SkuMappingDto {
  toastSku: string;
  cardId: string;
  tcgplayerId: string | null;
  tcgplayerSkuId: string | null;
  cardName: string;
  linkedAt: string;
}

export interface LookupSuccess {
  toastSku: string;
  /** @deprecated use toastSku — kept for older UI during transition */
  sku: string;
  mapping: SkuMappingDto;
  card: CardDto;
}

export interface LookupError {
  error: string;
  code?: "not_found" | "unmapped" | "config" | "upstream" | "bad_request";
}

export interface SearchSuccess {
  query: string;
  cards: CardDto[];
}
